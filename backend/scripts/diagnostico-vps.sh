#!/usr/bin/env bash
# Read-only inventory. Does not read .env files or modify services.
set -u
printf '\nSistema y hora\n'
uname -sr
command -v timedatectl >/dev/null && timedatectl show --property=Timezone
printf '\nNode, PM2 y PostgreSQL\n'
command -v node >/dev/null && node --version
command -v pm2 >/dev/null && pm2 list
command -v psql >/dev/null && psql --version
command -v pg_dump >/dev/null && pg_dump --version
printf '\nProcesos PM2: nombre, carpeta y script (sin variables privadas)\n'
if command -v pm2 >/dev/null && command -v node >/dev/null; then
 pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{for(const p of JSON.parse(s)) console.log(JSON.stringify({name:p.name,cwd:p.pm2_env?.pm_cwd,script:p.pm2_env?.pm_exec_path,status:p.pm2_env?.status}));}catch{console.log("No se pudo leer PM2");}});'
fi
printf '\nPuertos en escucha\n'
command -v ss >/dev/null && ss -ltn
printf '\nContenedores, si el usuario tiene acceso\n'
command -v docker >/dev/null && docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
printf '\nNavegador para generar PDF\n'
for bin in chromium chromium-browser google-chrome google-chrome-stable; do command -v "$bin" 2>/dev/null || true; done
