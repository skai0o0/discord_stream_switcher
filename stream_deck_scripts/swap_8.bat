@echo off
setlocal enableextensions enabledelayedexpansion
curl -s -X POST "http://localhost:3333/api/streams/swap-by-index/7" >nul 2>nul
