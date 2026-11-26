@echo off
title Adedonha Ao Vivo - NAO FECHE ESTA JANELA
cd /d "%~dp0"
echo.
echo  ================================================
echo     ADEDONHA AO VIVO
echo  ================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [!] O Node.js nao esta instalado neste computador.
  echo.
  echo  Vou abrir o site do Node.js. Baixe a versao "LTS",
  echo  instale clicando em Avancar ate o fim, e depois
  echo  clique de novo neste arquivo INICIAR-JOGO.
  echo.
  start "" https://nodejs.org/pt
  pause
  exit /b
)

node -e "process.exit(+process.versions.node.split('.')[0] < 20 ? 1 : 0)"
if errorlevel 1 (
  echo  [!] Seu Node.js e muito antigo. Instale a versao LTS mais nova em nodejs.org
  start "" https://nodejs.org/pt
  pause
  exit /b
)

if not exist "node_modules\tiktok-live-connector" (
  echo  Primeira vez: instalando as pecas do jogo. Pode levar 1 ou 2 minutos...
  echo.
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo  [!] Nao consegui instalar. Confira se o computador esta com internet e tente de novo.
    pause
    exit /b
  )
)

echo  Abrindo o painel no navegador em alguns segundos...
start "" /min cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000/painel"
node server.js
echo.
echo  O jogo foi fechado.
pause
