@echo off
rem Quita el ayudante de Kotonoha; la extension y sus datos no se tocan. Va en una sola linea porque el script borra esta carpeta.
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar.ps1" -Quitar %* & echo. & pause & exit /b
