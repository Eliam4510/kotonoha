# Ayudante local de Kotonoha, escrito en PowerShell, que viene con Windows: no hace falta instalar nada más.
#
# Una extensión no puede descargar el audio de un video por sí sola. Este programa, al que solo la extensión puede
# llamar (Native Messaging), lo baja con yt-dlp y se lo entrega por partes. Si FFmpeg está instalado, aquí mismo lo
# convierte a las muestras que necesita Whisper; si no, entrega el archivo tal cual y la extensión lo convierte con
# su propio FFmpeg. También actualiza la extensión que lo llama: baja el paquete de la versión nueva de GitHub,
# comprueba su SHA-256 y lo copia sobre su carpeta. Todo queda en tu equipo, y los archivos temporales se borran al
# terminar.
#
# Mensajes que recibe:
#   {"accion": "hola"}
#   {"accion": "abrir", "url": "https://..."}
#   {"accion": "leer", "id": 1, "desde": 0, "cuantas": 960000}
#   {"accion": "actualizar", "version": "0.17.1", "actual": "0.17.0"}
#   {"accion": "cerrar"}
#
# Mensajes que envía:
#   {"tipo": "hola", "version": 2, "ytdlp": "2026.10.26", "ffmpeg": true, "js": "quickjs", "actualizar": true}
#   {"tipo": "descarga", "porcentaje": 42}
#   {"tipo": "convirtiendo"}
#   {"tipo": "listo", "muestras": 22145150}                  con FFmpeg: muestras de 32 bits, mono, a 16 kHz
#   {"tipo": "listo", "bytes": 5123456, "formato": "webm"}   sin FFmpeg: el archivo descargado, en bytes
#   {"tipo": "pcm", "id": 1, "datos": "<base64>", "fin": false}   un trozo de lo pedido con «leer»
#   {"tipo": "actualizado", "version": "0.17.1"}
#   {"tipo": "error", "mensaje": "..."}
#
# El navegador lo arranca con el origen de la extensión que llama como primer argumento.

param()

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$VERSION = 2
$FRECUENCIA = 16000
# Chrome admite mensajes de hasta 1 MB desde un programa nativo. En base64 esto ocupa 256 KB.
$BYTES_POR_MENSAJE = 192 * 1024
$PREFIJO_TEMPORAL = 'kotonoha-'
$HORAS_ANTES_DE_LIMPIAR = 24
$DIAS_ENTRE_ACTUALIZACIONES = 7
$REPOSITORIO = 'Eliam4510/kotonoha'

$carpetaAyudante = $PSScriptRoot
$origenLlamada = if ($args.Count -gt 0) { [string]$args[0] } else { '' }
$utf8 = New-Object System.Text.UTF8Encoding($false)
$entrada = [Console]::OpenStandardInput()
$salida = [Console]::OpenStandardOutput()
$cabecera = New-Object byte[] 4
$script:tareaCabecera = $null
$script:procesos = New-Object System.Collections.ArrayList
$script:carpetaTemporal = $null
$script:archivoListo = $null
$script:unidad = 1
$script:tamano = 0

# GitHub solo acepta TLS 1.2 o más nuevo, y Windows PowerShell no siempre lo usa por omisión.
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

# ---------- Mensajes con la extensión ----------

function Escribir([string]$json) {
  $datos = $utf8.GetBytes($json)
  $largo = [BitConverter]::GetBytes([int]$datos.Length)
  $salida.Write($largo, 0, 4)
  $salida.Write($datos, 0, $datos.Length)
  $salida.Flush()
}

function Enviar($objeto) {
  Escribir ($objeto | ConvertTo-Json -Compress -Depth 4)
}

function LeerExacto([byte[]]$bufer, [int]$desde, [int]$cuantos) {
  while ($cuantos -gt 0) {
    $n = $entrada.Read($bufer, $desde, $cuantos)
    if ($n -le 0) { return $false }
    $desde += $n
    $cuantos -= $n
  }
  return $true
}

# La lectura de la entrada va siempre adelantada: así, mientras se descarga, se nota enseguida si la extensión
# cancela o se cierra, sin hilos.
function EmpezarLectura {
  $script:tareaCabecera = $entrada.ReadAsync($cabecera, 0, 4)
}

# El mensaje que ya empezó a llegar, o $null si la extensión cerró la conexión.
function TerminarLectura {
  $n = $script:tareaCabecera.Result
  $script:tareaCabecera = $null
  if ($n -le 0) { return $null }
  if ($n -lt 4 -and -not (LeerExacto $cabecera $n (4 - $n))) { return $null }
  $largo = [BitConverter]::ToInt32($cabecera, 0)
  if ($largo -le 0 -or $largo -gt 4MB) { return $null }
  $cuerpo = New-Object byte[] $largo
  if (-not (LeerExacto $cuerpo 0 $largo)) { return $null }
  return ($utf8.GetString($cuerpo) | ConvertFrom-Json)
}

# Para cortar lo que esté en marcha cuando la extensión se va.
class Cierre : System.Exception {
  Cierre() : base('cierre') {}
}

# Mientras se descarga, convierte o actualiza: atiende lo que llegue sin parar el trabajo.
function MirarEntrada {
  if (-not $script:tareaCabecera.IsCompleted) { return }
  $m = TerminarLectura
  if ($null -eq $m -or $m.accion -eq 'cerrar') { throw [Cierre]::new() }
  EmpezarLectura
  if ($m.accion -eq 'hola') { Saludar }
  else { Enviar ([ordered]@{ tipo = 'error'; mensaje = 'Espera a que termine lo que está en marcha.' }) }
}

# ---------- Programas ----------

function Citar([string]$s) {
  if ($s -ne '' -and $s -notmatch '[\s"]') { return $s }
  $r = '"'
  $barras = 0
  foreach ($c in $s.ToCharArray()) {
    if ($c -eq '\') { $barras++; continue }
    if ($c -eq '"') { $r += ('\' * ($barras * 2 + 1)) + '"'; $barras = 0; continue }
    $r += ('\' * $barras) + $c
    $barras = 0
  }
  return $r + ('\' * ($barras * 2)) + '"'
}

function Lanzar([string]$programa, [string[]]$argumentos) {
  $pi = New-Object System.Diagnostics.ProcessStartInfo
  $pi.FileName = $programa
  $pi.Arguments = (($argumentos | ForEach-Object { Citar $_ }) -join ' ')
  $pi.UseShellExecute = $false
  $pi.CreateNoWindow = $true
  # La entrada propia es la conexión con el navegador: los programas que se lanzan no deben heredarla.
  $pi.RedirectStandardInput = $true
  $pi.RedirectStandardOutput = $true
  $pi.RedirectStandardError = $true
  $pi.StandardOutputEncoding = $utf8
  $pi.StandardErrorEncoding = $utf8
  $pi.EnvironmentVariables['PYTHONUTF8'] = '1'
  $p = [System.Diagnostics.Process]::Start($pi)
  $p.StandardInput.Close()
  [void]$script:procesos.Add($p)
  return $p
}

# yt-dlp.exe arranca un segundo proceso: se termina el árbol entero.
function Terminar($p) {
  try {
    if (-not $p.HasExited) {
      $t = New-Object System.Diagnostics.ProcessStartInfo
      $t.FileName = Join-Path $env:SystemRoot 'System32\taskkill.exe'
      $t.Arguments = "/T /F /PID $($p.Id)"
      $t.UseShellExecute = $false
      $t.CreateNoWindow = $true
      $t.RedirectStandardOutput = $true
      $t.RedirectStandardError = $true
      $k = [System.Diagnostics.Process]::Start($t)
      [void]$k.WaitForExit(5000)
    }
  } catch {}
}

function ProgramaYtdlp {
  $propio = Join-Path $carpetaAyudante 'yt-dlp.exe'
  if (Test-Path $propio) { return $propio }
  $c = Get-Command yt-dlp.exe -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  return $null
}

function VersionYtdlp {
  $y = ProgramaYtdlp
  if (-not $y) { return $null }
  # La versión va en los datos del ejecutable: leerla es instantáneo, y arrancarlo tarda un par de segundos.
  $v = (Get-Item $y).VersionInfo.FileVersion
  if ($v) { return $v.Trim() }
  return 'desconocida'
}

function BuscarFfmpeg {
  if ($env:KOTONOHA_SIN_FFMPEG) { return $null }
  $c = Get-Command ffmpeg.exe -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  # El navegador no siempre arranca con el mismo PATH que una terminal: también se mira donde lo deja winget.
  $sitios = @(
    (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\ffmpeg.exe'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\*FFmpeg*\*\bin\ffmpeg.exe'),
    'C:\ffmpeg\bin\ffmpeg.exe',
    (Join-Path $env:ProgramFiles 'ffmpeg\bin\ffmpeg.exe')
  )
  foreach ($s in $sitios) {
    $r = Resolve-Path $s -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($r) { return $r.Path }
  }
  return $null
}

# YouTube pide resolver un desafío en JavaScript. El instalador deja QuickJS junto al ayudante; si no está, sirven
# Deno (yt-dlp lo busca solo) o Node.
function OpcionesJs {
  $qjs = Join-Path $carpetaAyudante 'qjs.exe'
  if (Test-Path $qjs) { return @('--js-runtimes', "quickjs:$qjs") }
  if (Get-Command deno.exe -ErrorAction SilentlyContinue) { return @() }
  if (Get-Command node.exe -ErrorAction SilentlyContinue) { return @('--js-runtimes', 'node') }
  return @()
}

function NombreJs {
  if (Test-Path (Join-Path $carpetaAyudante 'qjs.exe')) { return 'quickjs' }
  if (Get-Command deno.exe -ErrorAction SilentlyContinue) { return 'deno' }
  if (Get-Command node.exe -ErrorAction SilentlyContinue) { return 'node' }
  return $null
}

function Saludar {
  Enviar ([ordered]@{
    tipo = 'hola'
    version = $VERSION
    ytdlp = (VersionYtdlp)
    ffmpeg = [bool](BuscarFfmpeg)
    js = (NombreJs)
    actualizar = $true
  })
}

# ---------- Archivos temporales ----------

function LimpiarRestos {
  # Por si una sesión anterior terminó de golpe y no pudo borrar sus archivos.
  $limite = (Get-Date).AddHours(-$HORAS_ANTES_DE_LIMPIAR)
  Get-ChildItem ([IO.Path]::GetTempPath()) -Directory -Filter "$PREFIJO_TEMPORAL*" -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt $limite } |
    ForEach-Object { Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
}

function NuevaCarpetaTemporal {
  $c = Join-Path ([IO.Path]::GetTempPath()) ($PREFIJO_TEMPORAL + [Guid]::NewGuid().ToString('N').Substring(0, 12))
  [void](New-Item -ItemType Directory -Path $c)
  return $c
}

function BorrarCarpeta([string]$c) {
  if (-not $c) { return }
  # El proceso recién terminado puede tardar un instante en soltar sus archivos.
  for ($i = 0; $i -lt 10 -and (Test-Path $c); $i++) {
    Remove-Item $c -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $c) { Start-Sleep -Milliseconds 200 }
  }
}

function Cerrar {
  foreach ($p in $script:procesos) { Terminar $p }
  BorrarCarpeta $script:carpetaTemporal
}

# ---------- Descargar y convertir ----------

function ExplicarError([string]$texto) {
  # Lo que cuenta yt-dlp suele ser largo y en inglés: se traduce lo habitual.
  $casos = @(
    @('Sign in to confirm your age|age-restricted', 'Este video tiene restricción de edad y hace falta iniciar sesión.'),
    @('Private video', 'Este video es privado.'),
    @('members-only|Join this channel', 'Este video es solo para miembros del canal.'),
    @('Sign in to confirm you.re not a bot', 'YouTube pide iniciar sesión para este video.'),
    @('Video unavailable|This video is unavailable', 'Este video no está disponible.'),
    @('DRM', 'Este video está protegido contra descargas.'),
    @('Unsupported URL', 'yt-dlp no sabe descargar de este sitio.'),
    @('Unable to download webpage|Failed to establish a new connection|getaddrinfo failed|timed out', 'No se pudo conectar con el sitio del video. Comprueba la conexión.'),
    @('Requested format is not available', 'yt-dlp no encontró audio que descargar.')
  )
  foreach ($c in $casos) {
    if ($texto -match "(?i)$($c[0])") { return $c[1] }
  }
  $errores = @($texto -split "`r?`n" | Where-Object { $_ -like 'ERROR*' })
  if ($errores.Count -gt 0) { return $errores[-1] }
  $t = $texto.Trim()
  if ($t.Length -gt 300) { $t = $t.Substring($t.Length - 300) }
  if ($t) { return $t }
  return 'yt-dlp terminó con un error.'
}

# yt-dlp tiene que estar al día para que YouTube no lo rechace: se pone al día solo, una vez por semana.
function PonerYtdlpAlDia([string]$ytdlp) {
  if ((Split-Path $ytdlp -Parent) -ne $carpetaAyudante) { return }
  $marca = Join-Path $carpetaAyudante 'yt-dlp.comprobado'
  if ((Test-Path $marca) -and (Get-Item $marca).LastWriteTime -gt (Get-Date).AddDays(-$DIAS_ENTRE_ACTUALIZACIONES)) { return }
  # Sin mirar la entrada mientras tanto: cortarla a medias podría dejar yt-dlp.exe sin reemplazar.
  try {
    $p = Lanzar $ytdlp @('-U')
    $errores = $p.StandardError.ReadToEndAsync()
    $fuera = $p.StandardOutput.ReadToEndAsync()
    if (-not $p.WaitForExit(90000)) { Terminar $p }
    [IO.File]::WriteAllText($marca, (Get-Date).ToString('o'))
  } catch {}
}

function Descargar([string]$url, [string]$destino) {
  $ytdlp = ProgramaYtdlp
  if (-not $ytdlp) { throw 'Falta yt-dlp. Vuelve a ejecutar Instalar.cmd del ayudante.' }
  PonerYtdlpAlDia $ytdlp
  $argumentos = @(
    '--ignore-config', '--no-playlist', '--no-warnings', '--newline', '--no-part', '--no-mtime',
    # Un directo no termina nunca: para eso está la transcripción en tiempo real.
    '--match-filter', '!is_live',
    '--progress-template', 'download:KK %(progress.downloaded_bytes)s %(progress.total_bytes,progress.total_bytes_estimate)s',
    '-f', 'ba/b',
    '-o', (Join-Path $destino 'audio.%(ext)s')
  ) + (OpcionesJs) + @('--', $url)
  $p = Lanzar $ytdlp $argumentos
  # Los errores se leen aparte: si su tubería se llena, yt-dlp se quedaría esperando.
  $errores = $p.StandardError.ReadToEndAsync()
  $linea = $p.StandardOutput.ReadLineAsync()
  $ultimo = -1
  while ($true) {
    $listas = [System.Threading.Tasks.Task[]]@($linea, $script:tareaCabecera)
    [void][System.Threading.Tasks.Task]::WaitAny($listas, 250)
    MirarEntrada
    if (-not $linea.IsCompleted) { continue }
    $texto = $linea.Result
    if ($null -eq $texto) { break }
    $linea = $p.StandardOutput.ReadLineAsync()
    if ($texto -match '^KK (\d+) (\d+(?:\.\d+)?)') {
      $total = [Math]::Max([double]$Matches[2], 1)
      $porcentaje = [int][Math]::Min(100, [Math]::Floor([double]$Matches[1] * 100 / $total))
      if ($porcentaje -ne $ultimo) {
        $ultimo = $porcentaje
        Enviar ([ordered]@{ tipo = 'descarga'; porcentaje = $porcentaje })
      }
    }
  }
  while (-not $p.HasExited) {
    MirarEntrada
    [void]$p.WaitForExit(200)
  }
  $archivos = @(Get-ChildItem $destino -Filter 'audio.*' -File)
  if ($p.ExitCode -ne 0 -or $archivos.Count -eq 0) {
    if ($p.ExitCode -eq 0) { throw 'No hay audio que descargar: quizá sea un directo.' }
    throw (ExplicarError $errores.Result)
  }
  return $archivos[0].FullName
}

function Convertir([string]$origen, [string]$destino, [string]$ffmpeg) {
  $p = Lanzar $ffmpeg @('-nostdin', '-y', '-loglevel', 'error', '-i', $origen, '-vn', '-ac', '1', '-ar', "$FRECUENCIA", '-f', 'f32le', $destino)
  $errores = $p.StandardError.ReadToEndAsync()
  $fuera = $p.StandardOutput.ReadToEndAsync()
  while (-not $p.HasExited) {
    MirarEntrada
    [void]$p.WaitForExit(200)
  }
  if ($p.ExitCode -ne 0) {
    $t = $errores.Result.Trim()
    if ($t.Length -gt 300) { $t = $t.Substring($t.Length - 300) }
    throw "ffmpeg no pudo leer el audio: $t"
  }
}

function Abrir([string]$url) {
  $u = $null
  if (-not [Uri]::TryCreate($url, [UriKind]::Absolute, [ref]$u) -or ($u.Scheme -ne 'http' -and $u.Scheme -ne 'https') -or -not $u.Host) {
    throw 'La dirección del video no es válida.'
  }
  Cerrar
  $script:procesos.Clear()
  $script:archivoListo = $null
  $script:carpetaTemporal = NuevaCarpetaTemporal
  $descargado = Descargar $u.AbsoluteUri $script:carpetaTemporal
  $ffmpeg = BuscarFfmpeg
  if ($ffmpeg) {
    Enviar ([ordered]@{ tipo = 'convirtiendo' })
    $pcm = Join-Path $script:carpetaTemporal 'audio.pcm'
    Convertir $descargado $pcm $ffmpeg
    # El original ya no hace falta: mejor no ocupar el doble de disco.
    Remove-Item $descargado -Force
    $script:archivoListo = $pcm
    $script:unidad = 4
    $script:tamano = (Get-Item $pcm).Length
    Enviar ([ordered]@{ tipo = 'listo'; muestras = [long][Math]::Floor($script:tamano / 4) })
  } else {
    $script:archivoListo = $descargado
    $script:unidad = 1
    $script:tamano = (Get-Item $descargado).Length
    Enviar ([ordered]@{ tipo = 'listo'; bytes = [long]$script:tamano; formato = ([IO.Path]::GetExtension($descargado).TrimStart('.')) })
  }
}

function Leer($m) {
  if (-not $script:archivoListo) {
    Enviar ([ordered]@{ tipo = 'error'; mensaje = 'El audio aún no está listo.' })
    return
  }
  $id = [long]$m.id
  $desde = [Math]::Max([long]0, [long]$m.desde) * $script:unidad
  $pendientes = [Math]::Max([long]0, [Math]::Min([long]$m.cuantas * $script:unidad, $script:tamano - $desde))
  $bufer = New-Object byte[] $BYTES_POR_MENSAJE
  $f = [IO.File]::OpenRead($script:archivoListo)
  try {
    if ($desde -lt $script:tamano) { $f.Position = $desde }
    while ($true) {
      $quiero = [int][Math]::Min([long]$BYTES_POR_MENSAJE, $pendientes)
      $n = 0
      while ($n -lt $quiero) {
        $leidos = $f.Read($bufer, $n, $quiero - $n)
        if ($leidos -le 0) { break }
        $n += $leidos
      }
      $pendientes -= $n
      $fin = ($pendientes -le 0) -or ($n -eq 0)
      # A mano y no con ConvertTo-Json: el base64 no lleva comillas ni barras, y así es mucho más rápido.
      $b64 = [Convert]::ToBase64String($bufer, 0, $n)
      Escribir ('{"tipo":"pcm","id":' + $id + ',"datos":"' + $b64 + '","fin":' + $(if ($fin) { 'true' } else { 'false' }) + '}')
      if ($fin) { break }
    }
  } finally {
    $f.Dispose()
  }
}

# ---------- Actualizar la extensión ----------

function IdDeLaLlamada {
  if ($origenLlamada -match '^chrome-extension://([a-p]{32})/?$') { return $Matches[1] }
  return $null
}

function LeerJson([string]$ruta) {
  Add-Type -AssemblyName System.Web.Extensions
  $s = New-Object System.Web.Script.Serialization.JavaScriptSerializer
  $s.MaxJsonLength = [int]::MaxValue
  return $s.DeserializeObject([IO.File]::ReadAllText($ruta, $utf8))
}

function Valor($d, [string[]]$camino) {
  foreach ($c in $camino) {
    if ($null -eq $d -or -not ($d -is [System.Collections.IDictionary]) -or -not $d.ContainsKey($c)) { return $null }
    $d = $d[$c]
  }
  return $d
}

# Las carpetas de datos de los navegadores basados en Chromium que se conocen.
function RaicesDeNavegadores {
  $l = $env:LOCALAPPDATA
  return @(
    "$l\Google\Chrome\User Data", "$l\Google\Chrome Beta\User Data", "$l\Google\Chrome Dev\User Data", "$l\Google\Chrome SxS\User Data",
    "$l\Microsoft\Edge\User Data", "$l\Microsoft\Edge Beta\User Data", "$l\Microsoft\Edge Dev\User Data", "$l\Microsoft\Edge SxS\User Data",
    "$l\Chromium\User Data", "$l\BraveSoftware\Brave-Browser\User Data"
  ) | Where-Object { Test-Path $_ }
}

# Las copias cargadas desde una carpeta con ese identificador, en cualquier perfil de cualquier navegador.
function CarpetasDeExtension([string]$id) {
  if ($env:KOTONOHA_CARPETA_EXTENSION) { return @($env:KOTONOHA_CARPETA_EXTENSION) }
  $carpetas = @()
  foreach ($raiz in RaicesDeNavegadores) {
    foreach ($perfil in Get-ChildItem $raiz -Directory -ErrorAction SilentlyContinue) {
      foreach ($nombre in 'Secure Preferences', 'Preferences') {
        $archivo = Join-Path $perfil.FullName $nombre
        if (-not (Test-Path $archivo)) { continue }
        try {
          $ruta = Valor (LeerJson $archivo) @('extensions', 'settings', $id, 'path')
          if ($ruta -and [IO.Path]::IsPathRooted($ruta) -and (Test-Path (Join-Path $ruta 'manifest.json'))) { $carpetas += $ruta }
        } catch {}
      }
    }
  }
  return @($carpetas | Sort-Object -Unique)
}

# Antes de reemplazar nada, que la carpeta sea de verdad una copia de Kotonoha.
function EsCarpetaDeKotonoha([string]$c) {
  $manifiesto = Join-Path $c 'manifest.json'
  if (-not (Test-Path $manifiesto) -or -not (Test-Path (Join-Path $c '_locales'))) { return $false }
  if (Test-Path (Join-Path $c '.git')) { return $false }
  $m = LeerJson $manifiesto
  return ($m['name'] -eq 'Kotonoha') -and -not $m.ContainsKey('update_url')
}

function BajarUnaVez([string]$url, [string]$destino, [bool]$conAvance) {
  $peticion = [Net.HttpWebRequest]::Create($url)
  $peticion.UserAgent = 'kotonoha-ayudante'
  $peticion.Timeout = 30000
  $peticion.ReadWriteTimeout = 30000
  $respuesta = $peticion.GetResponse()
  try {
    $total = $respuesta.ContentLength
    $flujo = $respuesta.GetResponseStream()
    $archivo = [IO.File]::Create($destino)
    try {
      $bufer = New-Object byte[] (256KB)
      $hechos = [long]0
      $ultimo = -1
      while (($n = $flujo.Read($bufer, 0, $bufer.Length)) -gt 0) {
        $archivo.Write($bufer, 0, $n)
        $hechos += $n
        if ($conAvance -and $total -gt 0) {
          $porcentaje = [int][Math]::Floor($hechos * 100 / $total)
          if ($porcentaje -ne $ultimo) {
            $ultimo = $porcentaje
            Enviar ([ordered]@{ tipo = 'descarga'; porcentaje = $porcentaje })
            MirarEntrada
          }
        }
      }
    } finally {
      $archivo.Dispose()
    }
  } finally {
    $respuesta.Dispose()
  }
}

# GitHub contesta a veces con un error pasajero (502, 504): se reintenta antes de rendirse.
function Bajar([string]$url, [string]$destino, [bool]$conAvance) {
  for ($intento = 1; ; $intento++) {
    try {
      BajarUnaVez $url $destino $conAvance
      return
    } catch [Cierre] {
      throw
    } catch {
      if ($intento -ge 3) { throw }
      Start-Sleep -Seconds (2 * $intento)
    }
  }
}

function Actualizar($m) {
  $version = [string]$m.version
  if ($version -notmatch '^\d{1,4}\.\d{1,4}\.\d{1,4}$') { throw 'La versión pedida no es válida.' }
  $id = IdDeLaLlamada
  if (-not $id) { throw 'No se sabe qué extensión pide la actualización.' }
  $candidatas = @(CarpetasDeExtension $id | Where-Object { EsCarpetaDeKotonoha $_ })
  if ($candidatas.Count -gt 1 -and $m.actual) {
    $candidatas = @($candidatas | Where-Object { (LeerJson (Join-Path $_ 'manifest.json'))['version'] -eq [string]$m.actual })
  }
  if ($candidatas.Count -eq 0) { throw 'No se encontró la carpeta de esta copia de Kotonoha. Descarga la versión nueva desde GitHub.' }
  if ($candidatas.Count -gt 1) { throw 'Hay varias carpetas de Kotonoha con este identificador. Descarga la versión nueva desde GitHub.' }
  $carpeta = ([string]$candidatas[0]).TrimEnd('\')

  Cerrar
  $script:procesos.Clear()
  $script:carpetaTemporal = NuevaCarpetaTemporal
  $base = if ($env:KOTONOHA_URL_VERSIONES) { $env:KOTONOHA_URL_VERSIONES } else { "https://github.com/$REPOSITORIO/releases/download" }
  $nombreZip = "kotonoha-$version-extension.zip"
  $zip = Join-Path $script:carpetaTemporal $nombreZip
  $sumas = Join-Path $script:carpetaTemporal 'SHA256SUMS.txt'
  Bajar "$base/v$version/SHA256SUMS.txt" $sumas $false
  Bajar "$base/v$version/$nombreZip" $zip $true

  $esperada = $null
  foreach ($l in [IO.File]::ReadAllLines($sumas)) {
    if ($l -match '^([0-9a-fA-F]{64})\s+\*?(.+)$' -and $Matches[2].Trim() -eq $nombreZip) { $esperada = $Matches[1].ToLowerInvariant() }
  }
  if (-not $esperada) { throw 'El paquete no figura en SHA256SUMS.txt.' }
  $real = (Get-FileHash -Algorithm SHA256 -Path $zip).Hash.ToLowerInvariant()
  if ($real -ne $esperada) { throw 'El SHA-256 del paquete descargado no coincide: no se ha cambiado nada.' }

  Enviar ([ordered]@{ tipo = 'convirtiendo' })
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $extraido = Join-Path $script:carpetaTemporal 'extraido'
  [IO.Compression.ZipFile]::ExtractToDirectory($zip, $extraido)
  $nueva = Join-Path $extraido 'kotonoha'
  if (-not (EsCarpetaDeKotonoha $nueva) -or (LeerJson (Join-Path $nueva 'manifest.json'))['version'] -ne $version) {
    throw 'El paquete descargado no es el esperado: no se ha cambiado nada.'
  }

  # Una copia con clave tiene el mismo identificador en cualquier carpeta; una sin clave lo saca de su carpeta.
  # El paquete no lleva clave: se conserva la de la copia, para que el identificador, y con él sus datos, no cambie.
  $clave = (LeerJson (Join-Path $carpeta 'manifest.json'))['key']
  if ($clave) {
    $rutaManifiesto = Join-Path $nueva 'manifest.json'
    $texto = [IO.File]::ReadAllText($rutaManifiesto, $utf8)
    $i = $texto.IndexOf('{')
    $texto = '{' + "`n  `"key`": `"$clave`"," + $texto.Substring($i + 1)
    [IO.File]::WriteAllText($rutaManifiesto, $texto, $utf8)
  }

  # compilacion.txt va al final: la extensión se recarga cuando cambia, y para entonces todo lo demás ya está escrito.
  $robocopy = Join-Path $env:SystemRoot 'System32\robocopy.exe'
  $p = Lanzar $robocopy @($nueva, $carpeta, '/MIR', '/XF', 'compilacion.txt', '/R:3', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS', '/NP')
  $fuera = $p.StandardOutput.ReadToEndAsync()
  $errores = $p.StandardError.ReadToEndAsync()
  while (-not $p.HasExited) { [void]$p.WaitForExit(200) }
  if ($p.ExitCode -ge 8) { throw "No se pudieron copiar los archivos nuevos ($($p.ExitCode)). Cierra lo que use la carpeta y vuelve a intentarlo." }
  Copy-Item (Join-Path $nueva 'compilacion.txt') (Join-Path $carpeta 'compilacion.txt') -Force
  (Get-Item (Join-Path $carpeta 'compilacion.txt')).LastWriteTime = Get-Date
  BorrarCarpeta $script:carpetaTemporal
  $script:carpetaTemporal = $null
  Enviar ([ordered]@{ tipo = 'actualizado'; version = $version })
}

# ---------- Bucle principal ----------

function Atender($m) {
  try {
    switch ([string]$m.accion) {
      'hola' { Saludar }
      'abrir' { Abrir ([string]$m.url) }
      'leer' { Leer $m }
      'actualizar' { Actualizar $m }
      default { Enviar ([ordered]@{ tipo = 'error'; mensaje = "Acción desconocida: $($m.accion)" }) }
    }
  } catch [Cierre] {
    throw
  } catch {
    Enviar ([ordered]@{ tipo = 'error'; mensaje = [string]$_.Exception.Message })
  }
}

try {
  LimpiarRestos
  EmpezarLectura
  while ($true) {
    $script:tareaCabecera.Wait()
    $m = TerminarLectura
    if ($null -eq $m -or $m.accion -eq 'cerrar') { break }
    EmpezarLectura
    Atender $m
  }
} catch [Cierre] {
} finally {
  Cerrar
}
exit 0
