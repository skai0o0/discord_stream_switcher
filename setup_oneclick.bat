@echo off
setlocal
REM One-click setup v3 — same-window server
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup_oneclick_v3.ps1"
exit /b %errorlevel%
