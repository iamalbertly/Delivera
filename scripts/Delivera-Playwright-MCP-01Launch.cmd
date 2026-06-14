@echo off
setlocal
set "ROOT=%~dp0.."
set "NODE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE%" set "NODE=node"
"%NODE%" "%ROOT%\node_modules\@playwright\mcp\cli.js" %*
