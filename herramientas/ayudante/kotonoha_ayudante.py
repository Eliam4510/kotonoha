#!/usr/bin/env python3
"""Ayudante local de Kotonoha.

Una extensión no puede descargar el audio de un video por sí sola. Este programa, al que solo la
extensión puede llamar (Native Messaging), lo hace con yt-dlp, lo convierte con ffmpeg a las muestras
que necesita Whisper y se las entrega por partes. Todo queda en tu equipo, y los archivos temporales
se borran al terminar.

Mensajes que recibe:
  {"accion": "hola"}
  {"accion": "abrir", "url": "https://..."}
  {"accion": "leer", "id": 1, "desde": 0, "cuantas": 960000}
  {"accion": "cerrar"}

Mensajes que envía:
  {"tipo": "hola", "version": 1, "ytdlp": "2026.8.19", "ffmpeg": true}
  {"tipo": "descarga", "porcentaje": 42}
  {"tipo": "convirtiendo"}
  {"tipo": "listo", "muestras": 22145150}
  {"tipo": "pcm", "id": 1, "datos": "<base64>", "fin": false}
  {"tipo": "error", "mensaje": "..."}
"""

import base64
import glob
import importlib.metadata
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import threading
import time
from urllib.parse import urlparse

VERSION = 1
FRECUENCIA = 16000
BYTES_POR_MUESTRA = 4
# Chrome admite mensajes de hasta 1 MB desde un programa nativo. En base64 esto ocupa 256 KB.
BYTES_POR_MENSAJE = 192 * 1024
PREFIJO_TEMPORAL = "kotonoha-"
HORAS_ANTES_DE_LIMPIAR = 24
RUTAS_FFMPEG = [r"C:\ffmpeg\bin\ffmpeg.exe"]
SIN_VENTANA = getattr(subprocess, "CREATE_NO_WINDOW", 0)

cerrojo_salida = threading.Lock()
procesos = []
carpeta = None
archivo_pcm = None
muestras = 0


def enviar(mensaje):
    datos = json.dumps(mensaje, ensure_ascii=False).encode("utf-8")
    with cerrojo_salida:
        sys.stdout.buffer.write(struct.pack("@I", len(datos)) + datos)
        sys.stdout.buffer.flush()


def recibir():
    cabecera = sys.stdin.buffer.read(4)
    if len(cabecera) < 4:
        return None
    largo = struct.unpack("@I", cabecera)[0]
    return json.loads(sys.stdin.buffer.read(largo).decode("utf-8"))


def buscar_ffmpeg():
    encontrado = shutil.which("ffmpeg")
    if encontrado:
        return encontrado
    return next((r for r in RUTAS_FFMPEG if os.path.exists(r)), None)


def version_ytdlp():
    try:
        return importlib.metadata.version("yt-dlp")
    except importlib.metadata.PackageNotFoundError:
        return None


def limpiar_restos():
    """Por si una sesión anterior terminó de golpe y no pudo borrar sus archivos."""
    limite = time.time() - HORAS_ANTES_DE_LIMPIAR * 3600
    for ruta in glob.glob(os.path.join(tempfile.gettempdir(), PREFIJO_TEMPORAL + "*")):
        try:
            if os.path.getmtime(ruta) < limite:
                shutil.rmtree(ruta, ignore_errors=True)
        except OSError:
            pass


def cerrar():
    for p in procesos:
        try:
            p.kill()
        except OSError:
            pass
    if carpeta:
        # El proceso recién terminado puede tardar un instante en soltar sus archivos.
        for _ in range(10):
            shutil.rmtree(carpeta, ignore_errors=True)
            if not os.path.exists(carpeta):
                break
            time.sleep(0.2)


def lanzar(orden):
    p = subprocess.Popen(
        orden,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        creationflags=SIN_VENTANA,
        encoding="utf-8",
        errors="replace",
    )
    procesos.append(p)
    return p


def explicar_error(texto):
    """Lo que yt-dlp cuenta suele ser largo y en inglés: se traduce lo habitual."""
    casos = [
        (r"Sign in to confirm your age|age-restricted", "Este video tiene restricción de edad y hace falta iniciar sesión."),
        (r"Private video", "Este video es privado."),
        (r"members-only|Join this channel", "Este video es solo para miembros del canal."),
        (r"Sign in to confirm you.re not a bot", "YouTube pide iniciar sesión para este video."),
        (r"Video unavailable", "Este video no está disponible."),
        (r"DRM", "Este video está protegido contra descargas."),
        (r"Unsupported URL", "yt-dlp no sabe descargar de este sitio."),
        (r"Requested format is not available", "yt-dlp no encontró audio que descargar."),
    ]
    for patron, mensaje in casos:
        if re.search(patron, texto, re.I):
            return mensaje
    errores = [l for l in texto.splitlines() if l.startswith("ERROR")]
    return (errores[-1] if errores else texto.strip()[-300:]) or "yt-dlp terminó con un error."


def descargar(url, destino):
    orden = [
        sys.executable, "-m", "yt_dlp",
        "--ignore-config",
        "--no-playlist",
        "--no-warnings",
        "--newline",
        "--no-part",
        "--no-mtime",
        # Un directo no termina nunca: para eso está la transcripción en tiempo real.
        "--match-filter", "!is_live",
        "--progress-template", "download:KK %(progress.downloaded_bytes)s %(progress.total_bytes,progress.total_bytes_estimate)s",
        "-f", "ba/b",
        "-o", os.path.join(destino, "audio.%(ext)s"),
    ]
    if shutil.which("node"):
        orden += ["--js-runtimes", "node"]
    orden += ["--", url]
    p = lanzar(orden)
    errores = []
    # stderr se lee aparte: si su tubería se llena, yt-dlp se quedaría esperando.
    lector = threading.Thread(target=lambda: errores.extend(p.stderr), daemon=True)
    lector.start()
    ultimo = -1
    for linea in p.stdout:
        m = re.match(r"KK (\d+) (\d+(?:\.\d+)?)", linea)
        if not m:
            continue
        porcentaje = min(100, int(float(m.group(1)) * 100 / max(float(m.group(2)), 1)))
        if porcentaje != ultimo:
            ultimo = porcentaje
            enviar({"tipo": "descarga", "porcentaje": porcentaje})
    p.wait()
    lector.join(timeout=2)
    archivos = glob.glob(os.path.join(destino, "audio.*"))
    if p.returncode != 0 or not archivos:
        if p.returncode == 0:
            raise RuntimeError("No hay audio que descargar: quizá sea un directo.")
        raise RuntimeError(explicar_error("".join(errores)))
    return archivos[0]


def convertir(origen, destino, ffmpeg):
    p = lanzar([ffmpeg, "-nostdin", "-y", "-loglevel", "error", "-i", origen, "-vn", "-ac", "1", "-ar", str(FRECUENCIA), "-f", "f32le", destino])
    _, errores = p.communicate()
    if p.returncode != 0:
        raise RuntimeError(f"ffmpeg no pudo leer el audio: {errores.strip()[-300:]}")


def abrir(url):
    global carpeta, archivo_pcm, muestras
    try:
        partes = urlparse(url)
        if partes.scheme not in ("http", "https") or not partes.netloc:
            raise RuntimeError("La dirección del video no es válida.")
        if not version_ytdlp():
            raise RuntimeError("Falta yt-dlp. Instálalo con: python -m pip install -U yt-dlp")
        ffmpeg = buscar_ffmpeg()
        if not ffmpeg:
            raise RuntimeError("Falta ffmpeg. Instálalo con: winget install Gyan.FFmpeg")
        carpeta = tempfile.mkdtemp(prefix=PREFIJO_TEMPORAL)
        descargado = descargar(url, carpeta)
        enviar({"tipo": "convirtiendo"})
        pcm = os.path.join(carpeta, "audio.pcm")
        convertir(descargado, pcm, ffmpeg)
        # El original ya no hace falta: mejor no ocupar el doble de disco.
        os.remove(descargado)
        archivo_pcm = pcm
        muestras = os.path.getsize(pcm) // BYTES_POR_MUESTRA
        enviar({"tipo": "listo", "muestras": muestras})
    except Exception as e:
        enviar({"tipo": "error", "mensaje": str(e)})


def leer(peticion):
    if not archivo_pcm:
        enviar({"tipo": "error", "mensaje": "El audio aún no está listo."})
        return
    desde = max(0, int(peticion["desde"]))
    pendientes = max(0, min(int(peticion["cuantas"]), muestras - desde)) * BYTES_POR_MUESTRA
    with open(archivo_pcm, "rb") as f:
        f.seek(desde * BYTES_POR_MUESTRA)
        while True:
            parte = f.read(min(BYTES_POR_MENSAJE, pendientes))
            pendientes -= len(parte)
            fin = pendientes <= 0 or not parte
            enviar({"tipo": "pcm", "id": peticion["id"], "datos": base64.b64encode(parte).decode("ascii"), "fin": fin})
            if fin:
                return


def main():
    if sys.platform == "win32":
        import msvcrt

        # Sin esto Windows convierte los saltos de línea y corrompe los mensajes.
        msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
        msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)
    limpiar_restos()
    try:
        while True:
            m = recibir()
            if m is None or m.get("accion") == "cerrar":
                return
            accion = m.get("accion")
            if accion == "hola":
                enviar({"tipo": "hola", "version": VERSION, "ytdlp": version_ytdlp(), "ffmpeg": bool(buscar_ffmpeg())})
            elif accion == "abrir":
                # La descarga va aparte: mientras tanto hay que seguir atento por si se cancela.
                threading.Thread(target=abrir, args=(m.get("url", ""),), daemon=True).start()
            elif accion == "leer":
                leer(m)
            else:
                enviar({"tipo": "error", "mensaje": f"Acción desconocida: {accion}"})
    finally:
        cerrar()


if __name__ == "__main__":
    main()
