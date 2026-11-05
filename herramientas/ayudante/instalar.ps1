# Registra el ayudante de Kotonoha en Edge y Chrome, solo para tu usuario de Windows.
#
# Uso:        powershell -ExecutionPolicy Bypass -File herramientas\ayudante\instalar.ps1
# Quitarlo:   powershell -ExecutionPolicy Bypass -File herramientas\ayudante\instalar.ps1 -Quitar
# Otra copia de la extensión (su identificador sale en edge://extensions):
#             powershell -ExecutionPolicy Bypass -File herramientas\ayudante\instalar.ps1 -Extension abcdefghijklmnop

param(
  [switch]$Quitar,
  # Solo genera los archivos, sin tocar el registro: lo usan las pruebas automáticas.
  [switch]$SinRegistro,
  [string[]]$Extension = @()
)

$ErrorActionPreference = 'Stop'
$nombre = 'com.kotonoha.ayudante'
$carpeta = Split-Path -Parent $MyInvocation.MyCommand.Path
$claves = @(
  "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$nombre",
  "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$nombre"
)

if ($Quitar) {
  foreach ($c in $claves) { if (Test-Path $c) { Remove-Item $c } }
  Remove-Item -ErrorAction SilentlyContinue (Join-Path $carpeta "$nombre.json"), (Join-Path $carpeta 'kotonoha_ayudante.bat')
  Write-Output 'Ayudante quitado.'
  exit 0
}

# La ruta real de Python: el navegador no siempre arranca con el mismo PATH que tu terminal.
$python = & python -c "import sys; print(sys.executable)"
if (-not $python) { throw 'No encuentro Python. Instálalo y vuelve a ejecutar este script.' }
& $python -c "import yt_dlp" 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Output 'Instalando yt-dlp...'
  & $python -m pip install -U "yt-dlp[default]"
}
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue) -and -not (Test-Path 'C:\ffmpeg\bin\ffmpeg.exe')) {
  Write-Output 'Falta ffmpeg: instálalo con  winget install Gyan.FFmpeg'
}

$lanzador = Join-Path $carpeta 'kotonoha_ayudante.bat'
Set-Content -Path $lanzador -Encoding Ascii -Value "@echo off`r`n`"$python`" -u `"%~dp0kotonoha_ayudante.py`" %*"

# La copia que usas y la de las pruebas automáticas.
$permitidas = @('oalgcmmceedcbncodijboeeojdndioof', 'pldipbgollbhkjjigkgnojdjpfhanhhf') + $Extension
$manifiesto = [ordered]@{
  name = $nombre
  description = 'Kotonoha: descarga el audio de un video para transcribirlo en tu equipo'
  path = 'kotonoha_ayudante.bat'
  type = 'stdio'
  allowed_origins = @($permitidas | ForEach-Object { "chrome-extension://$_/" })
}
$rutaManifiesto = Join-Path $carpeta "$nombre.json"
# Sin BOM: el navegador no lee el JSON si lo lleva.
[System.IO.File]::WriteAllText($rutaManifiesto, ($manifiesto | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))

if ($SinRegistro) {
  Write-Output "Archivos generados en $carpeta, sin tocar el registro."
  exit 0
}

foreach ($c in $claves) {
  New-Item -Path $c -Force | Out-Null
  Set-ItemProperty -Path $c -Name '(default)' -Value $rutaManifiesto
}
Write-Output 'Ayudante instalado. Recarga la extensión en edge://extensions y vuelve a abrir el panel.'
