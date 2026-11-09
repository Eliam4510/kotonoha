@echo off
rem Instala el ayudante de Kotonoha para este usuario de Windows: basta con hacer doble clic.
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar.ps1" %*
echo.
pause
