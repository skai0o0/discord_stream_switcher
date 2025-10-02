@echo off
setlocal enableextensions enabledelayedexpansion
curl -s -X POST "http://localhost:3333/api/streams/next" >nul 2>nul
