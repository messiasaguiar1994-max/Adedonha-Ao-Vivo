@echo off
rem Abre a tela do jogo numa janela propria em pe (9:16), boa para "Captura de janela".
rem Primeiro abra o INICIAR-JOGO.bat e deixe a janela preta aberta.
set URL=http://localhost:3000/jogo
set PERFIL=%LOCALAPPDATA%\AdedonhaAoVivoJanela
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=%URL% --window-size=540,990 --user-data-dir="%PERFIL%" --autoplay-policy=no-user-gesture-required
  exit /b
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=%URL% --window-size=540,990 --user-data-dir="%PERFIL%" --autoplay-policy=no-user-gesture-required
  exit /b
)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=%URL% --window-size=540,990 --user-data-dir="%PERFIL%" --autoplay-policy=no-user-gesture-required
  exit /b
)
start "" %URL%
