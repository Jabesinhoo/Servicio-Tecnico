# Deploy de Servicio Técnico para futuros commits

Este paquete sustituye tu workflow. Copia el contenido en la raíz del repositorio,
conservando `.github` (carpeta oculta), `deploy` y `backend`. No contiene contraseñas.
Elimina o deshabilita el workflow anterior para evitar dos despliegues por commit.

## 1. Preparar el VPS una sola vez, antes de activar el workflow

Lleva `deploy/configurar-produccion.py` al VPS, por ejemplo desde PowerShell:

```powershell
scp .\deploy\configurar-produccion.py jabesinho@31.97.102.152:/home/jabesinho/
```

En tu sesión SSH:

```bash
sudo python3 /home/jabesinho/configurar-produccion.py
```

Introduce la contraseña de **Externas** cuando la pida; no se muestra en pantalla.
El script captura las variables del backend actual (incluidas PostgreSQL y JWT),
corrige World Office y guarda una configuración privada fuera del repositorio en
`/opt/tecnicos/config/compose.production.json`. No reinicia contenedores.
Esta configuración prevalece sobre la del repositorio en cada deploy.
Para modificarla en el futuro: `sudo nano /opt/tecnicos/config/compose.production.json`.
Usa `$$` para un signo `$` literal dentro de los valores: Compose interpola esos campos.
No publiques este archivo ni los respaldos en GitHub.

El usuario SSH necesita acceso a Docker sin contraseña y escritura en el repositorio.
Comprueba **en una nueva sesión SSH**:

```bash
docker info >/dev/null
test -w /opt/tecnicos/Servicio-Tecnico/.git && echo 'Git: escritura OK'
```

Si Docker indica permiso denegado, un administrador puede ejecutar:

```bash
sudo usermod -aG docker jabesinho
```

Cierra SSH y vuelve a entrar. Pertenecer al grupo Docker otorga control administrativo
sobre Docker; el deploy utiliza esa cuenta que ya administras. No requiere crear usuarios.
Si falla la escritura del repositorio, corrige su propietario/permisos antes de desplegar.
También necesita `git`, `python3`, `curl`, `flock` y Docker Compose v2.

## 2. Secrets de GitHub

En el repositorio: **Settings → Secrets and variables → Actions**:

| Secret | Valor |
|---|---|
| VPS_HOST | `31.97.102.152` |
| VPS_USER | `jabesinho` |
| VPS_PORT | `22` (o tu puerto SSH real) |
| VPS_SSH_KEY_B64 | Tu clave SSH privada de despliegue, en base64; conserva la que ya tienes |
| VPS_KNOWN_HOSTS | La clave pública SSH del VPS, obtenida desde tu sesión confiable |

Obtén **VPS_KNOWN_HOSTS** en el VPS, para el puerto 22:

```bash
sudo awk '{print "31.97.102.152 " $1 " " $2}' /etc/ssh/ssh_host_ed25519_key.pub
```

Copia toda la línea en ese secret. Para otro puerto, el primer campo debe ser
`[31.97.102.152]:PUERTO`. Esto verifica al VPS; no confía en una clave descubierta durante
el propio deploy. La clave privada correspondiente a VPS_SSH_KEY_B64 debe estar autorizada
para `jabesinho` en `~/.ssh/authorized_keys` del servidor.
No guardes la contraseña SQL Server en el workflow ni en el repositorio.

## 3. Subir los archivos y desplegar

Añade los archivos de este paquete a tu repositorio y haz commit/push a `main`.
También puedes usar **Actions → Deploy Sistema Técnicos VPS → Run workflow**, rama `main`.
No hace falta modificar `package.json` ni el Compose existente.

Cada deploy:

1. Verifica SSH y despliega exactamente el commit que disparó la ejecución.
2. Conserva la configuración externa de producción y espera si ya hay un deploy activo.
3. Respalda `tecnicos` y conserva las imágenes actuales para recuperación.
4. Construye solo backend y frontend. Detiene brevemente el backend para las migraciones.
5. Ejecuta las nuevas migraciones una vez, actualiza esos dos contenedores y sincroniza permisos.
6. Comprueba backend local, conexión PostgreSQL, frontend y la API pública por HTTPS.
7. Ante un fallo después de detener el backend, intenta recuperar las imágenes anteriores.

No ejecuta `down`, no elimina volúmenes, no usa `--remove-orphans`, no actualiza Postgres,
n8n u Ollama y no importa registros de localhost. El primer deploy crea únicamente la
 tabla de control `tecnicos_schema_migrations`; la estructura que ya instalaste no se repite.

## Futuras modificaciones de base de datos

Los futuros cambios de esquema deben incluir su migración nueva en
`backend/migrations/production/`, siguiendo el README de esa carpeta.
No se ejecuta automáticamente cualquier archivo antiguo de `backend/sql`.
Cambiar código que necesita una columna sin añadir su migración todavía causaría errores.

La recuperación de imágenes **no restaura automáticamente la base de datos** ni revierte
migraciones ya confirmadas. Usa cambios compatibles con la versión anterior.
Los respaldos quedan en `/opt/tecnicos/config/backups`; no se eliminan automáticamente.
Conserva también el respaldo que ya hiciste antes de actualizar la estructura.

## Comprobación tras el primer deploy

Confirma que puedes iniciar sesión y buscar una factura real desde la web.
La disponibilidad de SQL Server externo no bloquea el deploy: la factura sigue siendo opcional.
Si su conexión falla, revisa desde el VPS:

```bash
docker logs --since 10m --tail 100 tecnicos_backend
```

El puerto TCP reportado como `-3193` en la consulta anterior no se configura: se utiliza la
instancia `WORLDOFFICE22` con `SQLSERVER_PORT` vacío, igual que en la prueba que funcionó.
Las fotos, firmas y PDFs necesitan almacenamiento persistente de uploads en tu Compose;
este workflow conserva los montajes existentes, pero no crea uno si faltaba.

Validado localmente: sintaxis Bash/Python/Node, YAML del workflow, manejo de migraciones
(repetición, checksum y rollback de una migración fallida) y rutas principales del deploy con
Docker simulado. El primer deploy real y la conexión desde la web deben verificarse en tu VPS.
