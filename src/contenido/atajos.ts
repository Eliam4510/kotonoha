// Atajos de teclado sobre el video. Se capturan antes que los del sitio solo si hay algo que hacer.

import { motor, fondo } from '../compartido/rpc';
import type { EstadoPalabra, LineaAnalizada } from '../compartido/tipos';
import { desconocidas } from '../nucleo/frases';
import { tieneJapones } from '../nucleo/tokens';
import {
  abrirConsultaDe,
  ajustarDesfase,
  alternarMarcador,
  alternarSeleccion,
  combinarSeleccionadas,
  generarSecundarios,
  irALinea,
  lineaAnteriorOSiguiente,
  reproducir,
  saltar,
} from './controlador';
import {
  ajustes,
  avisar,
  consulta,
  indiceVisual,
  lineasObjetivo,
  panel,
  pausado,
  seleccionadas,
  tiempoMs,
  verTemporal,
} from './estado';
import { cambiarAjuste, cerrarConsulta, fijarOculto } from './Reproductor';
import { cancelarUnClic, crearUnClic, enviarACreador } from './tarjetas';

// La que se ve en pantalla, también en el instante en que aguanta entre dos líneas.
const lineaActual = (): LineaAnalizada | null => {
  const i = indiceVisual.value;
  return i >= 0 ? lineasObjetivo.value[i] : null;
};

function cambiarEstado(estado?: EstadoPalabra, alternarRastreo = false) {
  const c = consulta.value;
  if (!c) return false;
  const p = c.palabra;
  const rastreada = alternarRastreo ? !p.rastreada : undefined;
  motor.cambiarPalabras([{ clave: p.clave, lema: p.lema, lectura: p.lecturaLema, estado, rastreada }]).catch((e) => avisar(String(e), 'error'));
  return true;
}

function siguientePalabra(soloDesconocidas: boolean) {
  const l = lineaActual();
  if (!l) return;
  const lista = soloDesconocidas ? desconocidas(l.palabras) : l.palabras.filter((p) => p.esPalabra);
  if (!lista.length) return;
  const actual = consulta.value?.palabra;
  const i = actual ? lista.findIndex((p) => p.clave === actual.clave) : -1;
  abrirConsultaDe(lista[(i + 1) % lista.length], l);
}

function seleccionadaVecina(direccion: -1 | 1) {
  const sel = [...seleccionadas.value].sort((a, b) => a - b);
  if (!sel.length) return;
  const lineas = lineasObjetivo.value;
  const ids = lineas.filter((l) => sel.includes(l.id));
  const ms = tiempoMs.value;
  const destino = direccion === 1 ? ids.find((l) => l.inicio > ms + 100) : [...ids].reverse().find((l) => l.inicio < ms - 100);
  if (destino) irALinea(destino);
}

export function ejecutarComando(comando: string) {
  if (comando === 'crear-tarjeta') crearUnClic(consulta.value?.palabra ?? null, consulta.value?.linea ?? lineaActual(), fijarOculto);
}

export function instalarAtajos(): void {
  window.addEventListener(
    'keydown',
    (e) => {
      const objetivo = e.composedPath()[0] as HTMLElement | undefined;
      if (objetivo && (objetivo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(objetivo.tagName))) return;
      if (!ajustes.value.activo) return;

      const a = ajustes.value;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const { altKey: alt, shiftKey: shift, ctrlKey: ctrl, metaKey: meta } = e;
      if (meta || (ctrl && k !== 'x')) return;

      // Con texto japonés seleccionado en la página, E y Alt+K/U/I actúan sobre la selección (webAtajos).
      const seleccion = window.getSelection()?.toString() ?? '';
      if (seleccion.trim() && tieneJapones(seleccion) && ((k === 'e' && !alt && !shift) || (alt && !shift && /^[kui]$/.test(k)))) return;

      const hay = lineasObjetivo.value.length > 0;
      const hecho = () => {
        e.preventDefault();
        e.stopImmediatePropagation();
      };

      if (k === 'Escape') {
        if (consulta.value) {
          cerrarConsulta();
          hecho();
        } else if (panel.value) {
          panel.value = null;
          hecho();
        }
        return;
      }

      if (ctrl) {
        if (k === 'x') {
          cancelarUnClic();
          hecho();
        }
        return;
      }

      if (alt && !shift) {
        switch (k) {
          case 'x':
            cambiarAjuste({ desanclarBarra: !a.desanclarBarra });
            return hecho();
          case 'z':
            verTemporal.value = true;
            return hecho();
          case 't':
            panel.value = panel.value === 'traductor' ? null : 'traductor';
            return hecho();
          case 'l':
            cambiarAjuste({ mostrarEstado: !a.mostrarEstado });
            return hecho();
          case 'c':
            cambiarAjuste({ colorAcento: a.colorAcento === 'ninguno' ? 'siempre' : 'ninguno' });
            return hecho();
          case 'ArrowRight':
          case 'd':
            saltar(tiempoMs.value + 5000);
            return hecho();
          case 'ArrowLeft':
          case 'a':
            saltar(tiempoMs.value - 5000);
            return hecho();
          case 'i':
            ajustarDesfase('objetivo', -100);
            avisar('Japonés 0,1 s antes', undefined, undefined, 1200);
            return hecho();
          case 'o':
            ajustarDesfase('objetivo', 100);
            avisar('Japonés 0,1 s después', undefined, undefined, 1200);
            return hecho();
          case 'n':
            siguientePalabra(false);
            return hecho();
          case 's': {
            const sel = window.getSelection()?.toString().trim();
            const lema = sel || consulta.value?.palabra.lema;
            if (lema) fondo.abrirApp(`diccionario?q=${encodeURIComponent(lema)}`);
            return hecho();
          }
          case '+':
          case '=':
            cambiarAjuste({ escalaObjetivo: a.escalaObjetivo + 10 });
            return hecho();
          case '-':
            cambiarAjuste({ escalaObjetivo: Math.max(40, a.escalaObjetivo - 10) });
            return hecho();
        }
        return;
      }

      if (alt && shift) {
        switch (k) {
          case 'g':
            generarSecundarios();
            return hecho();
          case 'i':
            ajustarDesfase('secundaria', -100);
            avisar('Secundarios 0,1 s antes', undefined, undefined, 1200);
            return hecho();
          case 'o':
            ajustarDesfase('secundaria', 100);
            avisar('Secundarios 0,1 s después', undefined, undefined, 1200);
            return hecho();
          case '+':
          case '=':
            cambiarAjuste({ escalaSecundario: a.escalaSecundario + 10 });
            return hecho();
          case '-':
          case '_':
            cambiarAjuste({ escalaSecundario: Math.max(40, a.escalaSecundario - 10) });
            return hecho();
        }
        return;
      }

      if (shift) {
        switch (k) {
          case 'ArrowLeft':
          case 'a':
            seleccionadaVecina(-1);
            return hecho();
          case 'ArrowRight':
          case 'd':
            seleccionadaVecina(1);
            return hecho();
          case 'ArrowUp':
          case 'w':
            cambiarAjuste({ ocultarSecundario: !a.ocultarSecundario });
            return hecho();
        }
        return;
      }

      // Teclas sueltas. Si no hay subtítulos, se dejan pasar para no romper los atajos del sitio.
      if (!hay) {
        if (k === 'g') {
          cambiarAjuste({ navegadorAbierto: !a.navegadorAbierto });
          hecho();
        }
        return;
      }
      const linea = lineaActual();
      switch (k) {
        case 'ArrowLeft':
        case 'a': {
          const l = lineaAnteriorOSiguiente(-1);
          if (l) irALinea(l);
          return hecho();
        }
        case 'ArrowRight':
        case 'd': {
          const l = lineaAnteriorOSiguiente(1);
          if (l) irALinea(l);
          return hecho();
        }
        case 'ArrowDown':
        case 's':
          if (linea) {
            irALinea(linea);
            if (pausado.value) reproducir();
          }
          return hecho();
        case 'ArrowUp':
        case 'w':
          cambiarAjuste({ ocultarObjetivo: !a.ocultarObjetivo });
          return hecho();
        case 'r': {
          const ocultar = !(a.ocultarObjetivo && a.ocultarSecundario);
          cambiarAjuste({ ocultarObjetivo: ocultar, ocultarSecundario: ocultar });
          return hecho();
        }
        case 'g':
          cambiarAjuste({ navegadorAbierto: !a.navegadorAbierto });
          return hecho();
        case 'c':
          if (linea) {
            navigator.clipboard.writeText(linea.texto).catch(() => {});
            avisar('Subtítulo copiado', 'exito', undefined, 1500);
          }
          return hecho();
        case 'b':
          if (linea) alternarMarcador(linea.id);
          return hecho();
        case 'l':
          if (linea) alternarSeleccion(linea.id);
          return hecho();
        case 'j':
          combinarSeleccionadas();
          return hecho();
        case 'x':
          seleccionadas.value = new Set();
          return hecho();
        case 'n':
          siguientePalabra(true);
          return hecho();
        case 'q':
          crearUnClic(consulta.value?.palabra ?? null, consulta.value?.linea ?? linea, fijarOculto);
          return hecho();
        case 'e':
          enviarACreador(consulta.value?.palabra ?? null, consulta.value?.linea ?? linea, fijarOculto);
          return hecho();
        case '1':
        case 'u':
          if (cambiarEstado('desconocida')) hecho();
          return;
        case '2':
        case 't':
          if (cambiarEstado(undefined, true)) hecho();
          return;
        case '3':
        case 'k':
          if (cambiarEstado('conocida')) hecho();
          return;
        case '4':
        case 'i':
          if (cambiarEstado('ignorada')) hecho();
          return;
      }
    },
    true
  );

  window.addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() === 'z' || e.key === 'Alt') verTemporal.value = false;
  }, true);
}
