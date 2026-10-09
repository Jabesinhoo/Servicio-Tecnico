#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
SHA="${1:?Falta el SHA del commit}"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo 'SHA inválido'; exit 1; }
PROJECT_DIR=/opt/tecnicos/Servicio-Tecnico
CONFIG_DIR=/opt/tecnicos/config
OVERRIDE="$CONFIG_DIR/compose.production.json"
test -r "$OVERRIDE" || { echo 'Primero ejecuta deploy/configurar-produccion.py en el VPS.'; exit 1; }
PROJECT="$(cat "$CONFIG_DIR/project-name")"
[[ "$PROJECT" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || exit 1
# Same lock for GitHub and manual deployments. Keep the previous deploy running.
exec 9>"$CONFIG_DIR/deploy.lock"
flock -w 1800 9 || { echo 'Otro deploy sigue en curso.'; exit 1; }
cd "$PROJECT_DIR"
docker info > /dev/null
[[ -w .git ]] || { echo 'El usuario SSH necesita permiso de escritura en este repositorio.'; exit 1; }
STAMP="$(date -u +%Y%m%d-%H%M%S)-${SHA:0:12}"
BACKUPS="$CONFIG_DIR/backups"
mkdir -p "$BACKUPS"
DC=(docker compose --project-directory "$PROJECT_DIR" -p "$PROJECT" -f "$PROJECT_DIR/docker-compose.prod.yml" -f "$OVERRIDE")
ACTIVE=0
ROLLBACK="$BACKUPS/rollback-$STAMP.json"
finish() {
  local result=$?
  trap - EXIT INT TERM
  if [[ "$result" -ne 0 && "$ACTIVE" == 1 ]]; then
    echo 'Deploy fallido. Intentando recuperar las imágenes anteriores; se conserva la base de datos.'
    if "${DC[@]}" -f "$ROLLBACK" up -d --no-deps --no-build --force-recreate backend frontend; then
      echo 'Contenedores anteriores recuperados. Revisa su salud y el error del deploy.'
    else
      echo 'La recuperación automática falló. Conserva el respaldo y revisa Docker en el VPS.'
    fi
  fi
  exit "$result"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "Preparando commit $SHA"
git fetch origin main
git cat-file -e "$SHA^{commit}"
git merge-base --is-ancestor "$SHA" origin/main
# No git clean: preserve untracked .env and local uploaded files.
git reset --hard "$SHA"
"${DC[@]}" config --quiet
# Tag images before build changes their normal tags.
BACKEND_IMAGE="$(docker inspect -f '{{.Image}}' tecnicos_backend)"
FRONTEND_IMAGE="$(docker inspect -f '{{.Image}}' tecnicos_frontend)"
BACKEND_ROLLBACK="tecnicos-rollback/backend:$STAMP"
FRONTEND_ROLLBACK="tecnicos-rollback/frontend:$STAMP"
docker image tag "$BACKEND_IMAGE" "$BACKEND_ROLLBACK"
docker image tag "$FRONTEND_IMAGE" "$FRONTEND_ROLLBACK"
python3 - "$ROLLBACK" "$BACKEND_ROLLBACK" "$FRONTEND_ROLLBACK" <<'PY'
import json,sys
with open(sys.argv[1],'w') as output:
    json.dump({'services':{'backend':{'image':sys.argv[2],'pull_policy':'never'},
                          'frontend':{'image':sys.argv[3],'pull_policy':'never'}}},output)
PY
# Existing Postgres is backed up, never replaced or initialized.
BACKUP="$BACKUPS/tecnicos-$STAMP.dump"
docker exec tecnicos_db pg_dump -U postgres -d tecnicos --format=custom > "$BACKUP"
test -s "$BACKUP"
docker exec -i tecnicos_db pg_restore --list < "$BACKUP" > /dev/null
echo "Respaldo: $BACKUP"
"${DC[@]}" build backend frontend
# Mount runner explicitly: works even if Dockerfile only copies src/package files.
test -f backend/scripts/migrate-production.cjs
test -d backend/migrations/production
ACTIVE=1
"${DC[@]}" stop backend
"${DC[@]}" run --rm --no-deps -T \
  -v "$PROJECT_DIR/backend/scripts/migrate-production.cjs:/tmp/migrate-production.cjs:ro" \
  -v "$PROJECT_DIR/backend/migrations/production:/tmp/production-migrations:ro" \
  backend node /tmp/migrate-production.cjs /tmp/production-migrations
"${DC[@]}" up -d --no-deps --no-build --force-recreate backend frontend

wait_http() {
  local url="$1" label="$2"
  for attempt in $(seq 1 40); do
    if curl --fail --silent --show-error --max-time 5 "$url" > /dev/null 2>&1; then
      echo "$label disponible"; return 0
    fi
    sleep 3
  done
  echo "ERROR: $label no respondió"
  "${DC[@]}" ps
  "${DC[@]}" logs --tail=100 backend frontend
  return 1
}
wait_http http://127.0.0.1:3001/api/health Backend
"${DC[@]}" exec -T backend node -e '
const {Client}=require("pg");
const c=new Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||5432),
 database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,
 connectionTimeoutMillis:10000});
(async()=>{try{await c.connect();const r=await c.query("SELECT current_database() AS name");
 if(r.rows[0].name!=="tecnicos")throw new Error("Base inesperada");console.log("PostgreSQL OK");
 }finally{await c.end();}})().catch(e=>{console.error(e.message);process.exitCode=1;});'
"${DC[@]}" exec -T backend node -e '
const {syncPermissionsToDatabase}=require("./src/services/permissionsRegistry");
syncPermissionsToDatabase().then(p=>{console.log("Permisos:",p.length);process.exit(0);})
 .catch(e=>{console.error(e.message);process.exit(1);});'
wait_http http://127.0.0.1:8082/ Frontend
# Check API routing, not just a frontend HTML page that returns 200.
"${DC[@]}" exec -T backend node -e '
(async()=>{const r=await fetch("https://tecnicos.tecnonacho.com/api/health",{signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error("API HTTPS: "+r.status);const data=await r.json();
 if(data.ok!==true)throw new Error("La ruta HTTPS no devuelve la salud de la API");
 console.log("API HTTPS OK");})().catch(e=>{console.error(e.message);process.exitCode=1;});'
curl --fail --silent --show-error --max-time 15 https://tecnicos.tecnonacho.com/ > /dev/null
ACTIVE=0
printf '%s\n' "$SHA" > "$CONFIG_DIR/last-successful-commit"
"${DC[@]}" ps
echo "DEPLOY OK: $SHA — https://tecnicos.tecnonacho.com"
