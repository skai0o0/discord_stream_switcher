@echo off
setlocal enableextensions enabledelayedexpansion
curl -s -X POST "http://localhost:3333/api/streams/previous" >nul 2>nul
