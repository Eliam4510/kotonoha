# Instala el ayudante de Kotonoha para tu usuario de Windows, sin permisos de administrador. Lo cómodo es hacer
# doble clic en Instalar.cmd, que llama a este script.
#
# Qué hace:
#   1. Copia el ayudante a %LOCALAPPDATA%\Kotonoha\ayudante y baja allí yt-dlp y QuickJS de sus páginas oficiales en
#      GitHub, comprobando el SHA-256 de cada uno. No hace falta Python ni FFmpeg.
#   2. Busca Kotonoha en Chrome, Edge, Brave y Chromium, y registra el ayudante para cada copia que encuentra.
#   3. Si no encuentra ninguna, ofrece instalar la extensión en %LOCALAPPDATA%\Kotonoha\extension, con un
#      identificador fijo: el mismo en cualquier equipo y en cualquier carpeta.
#
# Opciones:
#   -Quitar          Quita el registro y la carpeta del ayudante. La extensión y sus datos no se tocan.
#   -Extension ID    Admite también esa copia (su identificador sale en chrome://extensions o edge://extensions).
#   -ConExtension    Instala la extensión sin preguntar, aunque ya haya otras copias.   -SinExtension  No la ofrece.
#   -AquiMismo       Usa esta misma carpeta en lugar de copiarla, para quien trabaja con el código.
#   -Carpeta RUTA    Instala el ayudante en otra carpeta.
#   -CarpetaExtension RUTA  Instala la extensión en otra carpeta (con -ConExtension).
#   -SinRegistro     Prepara los archivos sin tocar el registro: lo usan las pruebas automáticas.
#   -SinDescargas    No baja yt-dlp ni QuickJS.

param(
  [switch]$Quitar,
  [string[]]$Extension = @(),
  [switch]$ConExtension,
  [switch]$SinExtension,
  [switch]$AquiMismo,
  [string]$Carpeta,
  [string]$CarpetaExtension,
  [switch]$SinRegistro,
  [switch]$SinDescargas
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
trap {
  Write-Host "`nNo se pudo terminar: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Comprueba la conexión y vuelve a ejecutar Instalar.cmd.'
  exit 1
}
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$NOMBRE = 'com.kotonoha.ayudante'
$REPOSITORIO = 'Eliam4510/kotonoha'
# La clave pública de las instalaciones nuevas: con ella en el manifiesto, el identificador es siempre este.
$CLAVE_FIJA = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuwo1Wq78iaSUw7/DGPcoZG54WXFnLWrglO/L1AZbKzc/dm0ysVhT63zAE+T4zOSNXaXmJnlE+zpGQQ1ko+V2WASxk/bwN872oQ+EAxhF0+rtrxgXnuc6dT3FdPP020wPTTNjU0GZC0rjzh+6oX9u62+AHG1ZTWrrAqzaLdiNFkJM8K3LoxR2jPfLYpdrh0v/IWW9dEs8Yb3MtwrcfO7ga3NjCEg9PChpEltesQnyssqMxajR1fdEZFMkYsoxGShyTYF8VECqcCcwqXYFmwHYKSCBqHW22xvQGEZE1CEbOsDh9uyVTUpE8pbU7BmkIbqTitdt5t3Wik8Rgl8eVXkMaQIDAQAB'
$ID_FIJO = 'pndmalmeggkhpinfpnfebbknfbmafgep'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$origen = $PSScriptRoot
$raizKotonoha = Join-Path $env:LOCALAPPDATA 'Kotonoha'
$destino = if ($AquiMismo) { $origen } elseif ($Carpeta) { $Carpeta } else { Join-Path $raizKotonoha 'ayudante' }
$carpetaExtension = if ($CarpetaExtension) { $CarpetaExtension } else { Join-Path $raizKotonoha 'extension' }

$claves = @(
  "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$NOMBRE",
  "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$NOMBRE",
  "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\$NOMBRE",
  "HKCU:\Software\Chromium\NativeMessagingHosts\$NOMBRE"
)

function Paso([string]$texto) { Write-Host "`n$texto" -ForegroundColor Cyan }
function Bien([string]$texto) { Write-Host "  $texto" -ForegroundColor Green }
function Nota([string]$texto) { Write-Host "  $texto" }

# ---------- Quitar ----------

if ($Quitar) {
  if (-not $SinRegistro) {
    foreach ($c in $claves) { if (Test-Path $c) { Remove-Item $c -Force } }
  }
  if (-not $AquiMismo -and (Test-Path $destino)) {
    # El script que se está ejecutando puede vivir ahí: se borra todo lo demás y él al final.
    Get-ChildItem $destino -Force | Where-Object { $_.FullName -ne $PSCommandPath } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $PSCommandPath -Force -ErrorAction SilentlyContinue
    Remove-Item $destino -Force -ErrorAction SilentlyContinue
  } else {
    Remove-Item -ErrorAction SilentlyContinue (Join-Path $destino "$NOMBRE.json"), (Join-Path $destino 'kotonoha_ayudante.cmd')
  }
  Write-Host 'Ayudante quitado. La extensión y sus datos siguen en el navegador.'
  exit 0
}

# ---------- Utilidades ----------

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

# GitHub contesta a veces con un error pasajero (502, 504): se reintenta antes de rendirse.
function ConReintentos([scriptblock]$tarea) {
  for ($intento = 1; ; $intento++) {
    try { return (& $tarea) } catch {
      if ($intento -ge 4) { throw }
      Start-Sleep -Seconds (2 * $intento)
    }
  }
}

function Bajar([string]$url, [string]$archivo) {
  ConReintentos {
    $w = New-Object Net.WebClient
    $w.Headers['User-Agent'] = 'kotonoha-instalador'
    try { $w.DownloadFile($url, $archivo) } finally { $w.Dispose() }
  }
}

function Sha256([string]$archivo) { return (Get-FileHash -Algorithm SHA256 -Path $archivo).Hash.ToLowerInvariant() }

function UltimaVersion([string]$repositorio) {
  $texto = ConReintentos {
    $w = New-Object Net.WebClient
    $w.Headers['User-Agent'] = 'kotonoha-instalador'
    $w.Headers['Accept'] = 'application/vnd.github+json'
    $w.Encoding = [Text.Encoding]::UTF8
    # Las pruebas sirven la versión desde el propio equipo.
    $api = if ($env:KOTONOHA_API_VERSIONES -and $repositorio -eq $REPOSITORIO) { $env:KOTONOHA_API_VERSIONES } else { "https://api.github.com/repos/$repositorio/releases/latest" }
    try { $w.DownloadString($api) } finally { $w.Dispose() }
  }
  Add-Type -AssemblyName System.Web.Extensions
  $s = New-Object System.Web.Script.Serialization.JavaScriptSerializer
  $s.MaxJsonLength = [int]::MaxValue
  return $s.DeserializeObject($texto)
}

# Baja un archivo de la última versión de un proyecto de GitHub y comprueba su SHA-256 con el que publica GitHub.
function BajarDeGitHub([string]$repositorio, [string]$asset, [string]$destinoArchivo) {
  $version = UltimaVersion $repositorio
  $a = @($version['assets'] | Where-Object { $_['name'] -eq $asset }) | Select-Object -First 1
  if (-not $a) { throw "No encuentro $asset en la última versión de $repositorio." }
  $esperada = ([string]$a['digest']) -replace '^sha256:', ''
  if (-not $esperada) { throw "GitHub no da el SHA-256 de $asset." }
  if ((Test-Path $destinoArchivo) -and (Sha256 $destinoArchivo) -eq $esperada) {
    Nota "$([IO.Path]::GetFileName($destinoArchivo)) $($version['tag_name']) ya estaba al día."
    return
  }
  $temporal = "$destinoArchivo.descarga"
  Bajar $a['browser_download_url'] $temporal
  if ((Sha256 $temporal) -ne $esperada) {
    Remove-Item $temporal -Force
    throw "El SHA-256 de $asset no coincide con el que publica GitHub: no se ha instalado."
  }
  Move-Item $temporal $destinoArchivo -Force
  Bien "$([IO.Path]::GetFileName($destinoArchivo)) $($version['tag_name']), SHA-256 comprobado."
}

# Las copias de Kotonoha de cada perfil de cada navegador: las cargadas desde una carpeta y las de las tiendas.
function CopiasDeKotonoha {
  $l = $env:LOCALAPPDATA
  $navegadores = [ordered]@{
    'Chrome' = "$l\Google\Chrome\User Data"; 'Chrome Beta' = "$l\Google\Chrome Beta\User Data"; 'Chrome Dev' = "$l\Google\Chrome Dev\User Data"; 'Chrome Canary' = "$l\Google\Chrome SxS\User Data"
    'Edge' = "$l\Microsoft\Edge\User Data"; 'Edge Beta' = "$l\Microsoft\Edge Beta\User Data"; 'Edge Dev' = "$l\Microsoft\Edge Dev\User Data"; 'Edge Canary' = "$l\Microsoft\Edge SxS\User Data"
    'Brave' = "$l\BraveSoftware\Brave-Browser\User Data"; 'Chromium' = "$l\Chromium\User Data"
  }
  $copias = @()
  foreach ($n in $navegadores.Keys) {
    $raiz = $navegadores[$n]
    if (-not (Test-Path $raiz)) { continue }
    foreach ($perfil in Get-ChildItem $raiz -Directory -ErrorAction SilentlyContinue) {
      foreach ($archivo in 'Secure Preferences', 'Preferences') {
        $ruta = Join-Path $perfil.FullName $archivo
        if (-not (Test-Path $ruta)) { continue }
        try { $ajustes = Valor (LeerJson $ruta) @('extensions', 'settings') } catch { continue }
        if (-not $ajustes) { continue }
        foreach ($id in @($ajustes.Keys)) {
          $camino = Valor $ajustes @($id, 'path')
          if (-not $camino) { continue }
          $carpeta = if ([IO.Path]::IsPathRooted($camino)) { $camino } else { Join-Path $perfil.FullName "Extensions\$camino" }
          $manifiesto = Join-Path $carpeta 'manifest.json'
          if (-not (Test-Path $manifiesto)) { continue }
          try { if ((LeerJson $manifiesto)['name'] -ne 'Kotonoha') { continue } } catch { continue }
          $copias += [pscustomobject]@{ Navegador = $n; Perfil = $perfil.Name; Id = $id; Carpeta = $carpeta; Tienda = -not [IO.Path]::IsPathRooted($camino) }
        }
      }
    }
  }
  return @($copias | Sort-Object Navegador, Perfil, Id -Unique)
}

# Pone la clave fija en el manifiesto de una copia nueva, justo tras la llave de apertura.
function PonerClaveFija([string]$carpeta) {
  $ruta = Join-Path $carpeta 'manifest.json'
  $texto = [IO.File]::ReadAllText($ruta, $utf8)
  if ($texto -match '"key"\s*:') { return }
  $i = $texto.IndexOf('{')
  [IO.File]::WriteAllText($ruta, '{' + "`n  `"key`": `"$CLAVE_FIJA`"," + $texto.Substring($i + 1), $utf8)
}

function InstalarExtension {
  Paso 'Instalando la extensión'
  $version = UltimaVersion $REPOSITORIO
  $v = ([string]$version['tag_name']) -replace '^v', ''
  $nombreZip = "kotonoha-$v-extension.zip"
  $temporal = Join-Path ([IO.Path]::GetTempPath()) ('kotonoha-instalar-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  [void](New-Item -ItemType Directory -Path $temporal)
  try {
    $zip = Join-Path $temporal $nombreZip
    $sumas = Join-Path $temporal 'SHA256SUMS.txt'
    $base = if ($env:KOTONOHA_URL_VERSIONES) { $env:KOTONOHA_URL_VERSIONES } else { "https://github.com/$REPOSITORIO/releases/download" }
    Bajar "$base/v$v/SHA256SUMS.txt" $sumas
    Bajar "$base/v$v/$nombreZip" $zip
    $esperada = $null
    foreach ($linea in [IO.File]::ReadAllLines($sumas)) {
      if ($linea -match '^([0-9a-fA-F]{64})\s+\*?(.+)$' -and $Matches[2].Trim() -eq $nombreZip) { $esperada = $Matches[1].ToLowerInvariant() }
    }
    if (-not $esperada -or (Sha256 $zip) -ne $esperada) { throw "El SHA-256 de $nombreZip no coincide: no se ha instalado." }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($zip, (Join-Path $temporal 'extraido'))
    $nueva = Join-Path $temporal 'extraido\kotonoha'
    PonerClaveFija $nueva
    [void](New-Item -ItemType Directory -Path $carpetaExtension -Force)
    & (Join-Path $env:SystemRoot 'System32\robocopy.exe') $nueva $carpetaExtension /MIR /R:3 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "No se pudo copiar la extensión a $carpetaExtension." }
    Bien "Kotonoha $v, SHA-256 comprobado, en $carpetaExtension"
  } finally {
    Remove-Item $temporal -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# ---------- Instalar ----------

Write-Host 'Kotonoha: ayudante para transcribir videos de internet enteros' -ForegroundColor White

Paso 'Copiando el ayudante'
[void](New-Item -ItemType Directory -Path $destino -Force)
if ((Resolve-Path $destino).Path -ne (Resolve-Path $origen).Path) {
  foreach ($a in 'kotonoha_ayudante.ps1', 'instalar.ps1', 'Instalar.cmd', 'Desinstalar.cmd', 'LEEME.txt', 'LICENSE.txt') {
    $de = Join-Path $origen $a
    if (Test-Path $de) { Copy-Item $de (Join-Path $destino $a) -Force }
  }
}
# Lo que dejaba el ayudante de Python, que ya no se usa.
Remove-Item (Join-Path $destino 'kotonoha_ayudante.bat') -Force -ErrorAction SilentlyContinue
Bien $destino

if (-not $SinDescargas) {
  Paso 'Bajando yt-dlp y QuickJS'
  $arquitectura = $env:PROCESSOR_ARCHITECTURE
  $ytdlp = if ($arquitectura -eq 'ARM64') { 'yt-dlp_arm64.exe' } elseif ($arquitectura -eq 'x86') { 'yt-dlp_x86.exe' } else { 'yt-dlp.exe' }
  $qjs = if ($arquitectura -eq 'x86') { 'qjs-windows-x86.exe' } else { 'qjs-windows-x86_64.exe' }
  BajarDeGitHub 'yt-dlp/yt-dlp' $ytdlp (Join-Path $destino 'yt-dlp.exe')
  BajarDeGitHub 'quickjs-ng/quickjs' $qjs (Join-Path $destino 'qjs.exe')
  # Recién bajado: no hace falta que el ayudante lo ponga al día en su primera descarga.
  [IO.File]::WriteAllText((Join-Path $destino 'yt-dlp.comprobado'), (Get-Date).ToString('o'))
}

Paso 'Buscando Kotonoha en los navegadores'
$copias = @(CopiasDeKotonoha)
foreach ($c in $copias) {
  $donde = if ($c.Tienda) { 'de la tienda' } else { $c.Carpeta }
  Bien "$($c.Navegador), perfil «$($c.Perfil)»: $($c.Id) ($donde)"
}
$instalada = $false
$si = [bool]$ConExtension
if ($copias.Count -eq 0) {
  Nota 'No encuentro Kotonoha en ningún navegador.'
  if (-not $si -and -not $SinExtension -and [Environment]::UserInteractive) {
    $r = Read-Host '  ¿Instalar ahora la extensión? [S/n]'
    $si = ($r -eq '' -or $r -match '^[sSyY]')
  }
}
if ($si) {
  InstalarExtension
  $instalada = $true
}

$ids = @($copias | ForEach-Object { $_.Id }) + @($ID_FIJO) + @($Extension | ForEach-Object { $_.Trim().ToLowerInvariant() })
$malos = @($ids | Where-Object { $_ -notmatch '^[a-p]{32}$' })
if ($malos.Count -gt 0) { throw "Identificador no válido: $($malos -join ', ')" }
$ids = @($ids | Sort-Object -Unique)

Paso 'Registrando el ayudante'
$lanzador = Join-Path $destino 'kotonoha_ayudante.cmd'
$orden = '"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0kotonoha_ayudante.ps1" %*'
[IO.File]::WriteAllText($lanzador, "@echo off`r`n$orden`r`n", [Text.Encoding]::ASCII)
$manifiesto = [ordered]@{
  name = $NOMBRE
  description = 'Kotonoha: descarga el audio de un video para transcribirlo en tu equipo'
  path = 'kotonoha_ayudante.cmd'
  type = 'stdio'
  allowed_origins = @($ids | ForEach-Object { "chrome-extension://$_/" })
}
$rutaManifiesto = Join-Path $destino "$NOMBRE.json"
# Sin BOM: el navegador no lee el JSON si lo lleva.
[IO.File]::WriteAllText($rutaManifiesto, ($manifiesto | ConvertTo-Json), $utf8)

if ($SinRegistro) {
  Bien "Archivos listos en $destino, sin tocar el registro."
} else {
  foreach ($c in $claves) {
    [void](New-Item -Path $c -Force)
    Set-ItemProperty -Path $c -Name '(default)' -Value $rutaManifiesto
  }
  Bien 'Registrado para Chrome, Edge, Brave y Chromium, solo para tu usuario.'
}

Write-Host ''
if ($instalada) {
  # En las pruebas, sin tocar el portapapeles ni abrir ventanas.
  if (-not $SinRegistro) { try { Set-Clipboard -Value $carpetaExtension } catch {} }
  Write-Host 'Falta un paso, que el navegador solo deja hacer a mano:' -ForegroundColor White
  Nota '1. Abre chrome://extensions en Chrome o edge://extensions en Edge.'
  Nota '2. Activa el «Modo de desarrollador».'
  Nota '3. Pulsa «Cargar descomprimida» y elige esta carpeta (ya está copiada en el portapapeles):'
  Nota "   $carpetaExtension"
  if (-not $SinRegistro) { try { Start-Process explorer.exe $carpetaExtension } catch {} }
} elseif ($copias.Count -gt 0) {
  Write-Host 'Listo. En Kotonoha, Ajustes, Transcripción, pulsa «Comprobar» para verlo instalado.' -ForegroundColor White
} else {
  Write-Host 'Listo. Cuando instales Kotonoha, vuelve a ejecutar Instalar.cmd para que la encuentre.' -ForegroundColor White
}
