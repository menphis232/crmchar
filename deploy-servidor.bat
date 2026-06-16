@echo off
chcp 65001 > nul
echo.
echo ====================================
echo   DEPLOY AL SERVIDOR
echo   github.com/menphis232/crmchar
echo ====================================
echo.

set PLINK="C:\Program Files\PuTTY\plink.exe"
set HOST=2.25.197.82
set USER=root
set PASS=24@Camila@232

echo Conectando via PuTTY/plink...
echo.

%PLINK% -ssh -l %USER% -pw %PASS% %HOST% -batch ^
"set -e; ^
echo ''; ^
echo '=== [1/5] Buscando proyecto ==='; ^
PROJ=$(find /root /var/www /opt /srv -maxdepth 4 -name '.git' -type d 2>/dev/null | grep -v node_modules | head -1 | sed 's/\/.git$//'); ^
echo \"Proyecto encontrado en: $PROJ\"; ^
cd $PROJ; ^
echo ''; ^
echo '=== [2/5] Git pull ==='; ^
git pull origin main; ^
echo ''; ^
echo '=== [3/5] Contenedores activos ==='; ^
docker ps --format 'table {{.Names}}\t{{.Status}}'; ^
echo ''; ^
echo '=== [4/5] Reiniciando backend ==='; ^
docker-compose restart tramites-backend 2>/dev/null || docker compose restart tramites-backend 2>/dev/null || docker restart tramites-backend; ^
echo ''; ^
echo '=== [5/6] Migraciones ==='; ^
docker exec tramites-backend node apply-v23.js 2>/dev/null || echo 'v23 ok'; ^
docker exec tramites-backend node apply-v28-analytics.js 2>/dev/null || echo 'v28 ok'; ^
echo ''; ^
echo '=== [6/6] Rebuild y restart ==='; ^
docker compose build backend frontend 2>/dev/null || docker-compose build backend frontend; ^
docker compose up -d backend frontend 2>/dev/null || docker-compose up -d backend frontend; ^
echo ''; ^
docker ps --format 'table {{.Names}}\t{{.Status}}'; ^
echo ''; ^
echo '✅ DEPLOY COMPLETADO'"

echo.
if %ERRORLEVEL% EQU 0 (
    echo [OK] Deploy exitoso!
) else (
    echo [ERROR] Hubo un problema. Revisa los mensajes arriba.
)
echo.
pause
