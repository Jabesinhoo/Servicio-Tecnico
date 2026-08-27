SERVICIO TÉCNICO · V7
EVIDENCIAS INICIALES + ACTA DE RECIBO + DIAGNÓSTICO/RESULTADO

OBJETIVO
========
Este bloque continúa el flujo funcional original compartido para Servicio Técnico:

12. Recepción del equipo
13. Checklist de recepción
14. Evidencias iniciales
15. Acta de recibo con firma
16. Envío del acta (pendiente para un bloque posterior)
17. Programación
18. Ejecución
19. Diagnóstico y resultado

V7 implementa especialmente los pasos 14, 15 y 19 y endurece el inicio de la ejecución para no saltarse la recepción documentada.

QUÉ AGREGA
==========
1. Evidencias fotográficas por orden
   - cámara del celular o selección de imagen;
   - JPG / PNG / WEBP;
   - máximo 8 MB por archivo;
   - etapa recepción o diagnóstico;
   - nota, técnico, fecha y metadatos;
   - la evidencia deja de poder retirarse cuando la etapa queda confirmada.

2. Acta de recibo
   - exige checklist de recepción confirmado;
   - exige al menos una fotografía inicial;
   - exige custodia vigente del técnico;
   - captura nombre y documento de quien firma;
   - firma manuscrita desde pantalla táctil/mouse;
   - una vez firmada queda bloqueada;
   - conserva ubicación precisa confiable si está disponible al momento de la firma.

3. Nueva regla antes de iniciar servicio
   El técnico no puede pasar a EN_EJECUCION hasta tener:
   - asignación aceptada;
   - custodia;
   - checklist de recepción confirmado;
   - evidencia fotográfica inicial;
   - acta de recibo firmada.

4. Diagnóstico / resultado
   Dos tipos:
   A. Revisión técnica de diagnóstico
      - resultado positivo / negativo;
      - descripción;
      - si tiene solución: costo aproximado y componentes requeridos;
      - actividades efectuadas;
      - evidencia fotográfica obligatoria antes de confirmar.

   B. Servicio técnico específico
      - descripción del trabajo;
      - funcionamiento / condición obtenida;
      - actividades efectuadas;
      - evidencia fotográfica obligatoria antes de confirmar.

5. Vista administrativa
   El admin puede consultar:
   - evidencias iniciales;
   - acta firmada;
   - firma;
   - diagnóstico y su estado;
   - evidencias del diagnóstico.
   El admin no modifica la información operativa confirmada desde este flujo.

6. Responsive
   - modales 100dvh en celular;
   - header/footer fijos;
   - scroll interno táctil;
   - botón de cámara grande;
   - firma táctil;
   - grids adaptables a tablet/escritorio.

INSTALACIÓN DESDE V6
====================
1. Extraer este ZIP sobre la raíz de Servicio-Tecnico conservando rutas.

2. Ejecutar SOLO el SQL nuevo:

Get-Content -Raw .\backend\sql\20260825-service-order-evidence-act-diagnosis.sql | docker exec -i tecnicos_db psql -U postgres -d tecnicos

Salida esperada aproximada:
BEGIN
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE INDEX
COMMIT

Si PostgreSQL muestra NOTICE de objetos existentes pero termina en COMMIT, el script es seguro para reintento.

3. Verificar:

powershell -ExecutionPolicy Bypass -File .\VERIFICAR-V7.ps1

4. Backend:

cd .\backend
npm.cmd run dev

5. Frontend, en otra terminal:

cd .\frontend
npm.cmd run build
npm.cmd run dev

PRUEBA FUNCIONAL
================
ADMIN:
- crear/aprobar/asignar una OS como ya se venía haciendo.

TÉCNICO:
- aceptar asignación;
- tomar custodia;
- completar y confirmar checklist;
- abrir "Tomar evidencias iniciales";
- tomar por lo menos una foto;
- abrir "Firmar acta de recibo";
- registrar firma del cliente/persona que entrega;
- iniciar servicio;
- durante EN_EJECUCION abrir "Evidencias diagnóstico";
- tomar una foto;
- abrir "Diagnóstico / resultado";
- guardar borrador;
- confirmar diagnóstico.

ADMIN:
- entrar a Mis servicios;
- abrir evidencias, acta y diagnóstico del técnico en modo consulta.

ALMACENAMIENTO DE FOTOS
=======================
En desarrollo local, si SERVICE_EVIDENCE_DIR está vacío, los archivos se almacenan en:

backend\uploads\service-orders

IMPORTANTE EN PRODUCCIÓN CON DOCKER:
No dejes las evidencias únicamente dentro de una capa efímera del contenedor.
Configura SERVICE_EVIDENCE_DIR apuntando a una carpeta persistente/bind mount/volumen.
Ejemplo conceptual dentro del contenedor:

SERVICE_EVIDENCE_DIR=/app/uploads/service-orders

Y monta esa ruta de forma persistente en docker-compose antes del despliegue de producción.

Si Nginx limita cargas por debajo de 8 MB, configura client_max_body_size acorde con la política de evidencias.

NO HACER
========
- No ejecutar todas las migraciones.
- No sequelize.sync({ force: true }).
- No sequelize.sync({ alter: true }).
- No borrar tablas P2/P3/V5/V6.
- No eliminar físicamente evidencias confirmadas.

PENDIENTES DEL FLUJO ORIGINAL PARA SIGUIENTES BLOQUES
=====================================================
- envío/descarga formal del acta de recibo;
- checklists parametrizables por tipo de equipo;
- autorización adicional del cliente;
- bloqueo de repuestos/trabajos sin autorización;
- checklist de cierre técnico;
- entrega a Dirección Técnica y cambio de custodia;
- validación interna;
- notificación al cliente;
- checklist de entrega;
- firma final / tercero autorizado;
- cierre auditable.
