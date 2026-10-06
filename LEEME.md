# Actualización final: clientes, colores, agenda y entrega

- Las acciones de Servicios, Mis servicios, Clientes, Agenda y sus formularios siguen el color seleccionado en Personalizar. Los avisos de error y las acciones destructivas conservan su identificación.
- El detalle del cliente muestra su información aunque falle la consulta de estadísticas. Se corrigen identificadores de World Office, columnas financieras ausentes y montos grandes.
- La agenda conserva el calendario al actualizar; las órdenes se abren al pulsar su evento. La disponibilidad muestra un error recuperable si su consulta falla.
- El técnico asignado con custodia puede registrar aviso, receptor y firma y confirmar la entrega después de la validación del cierre por Dirección Técnica. El formulario explica los requisitos pendientes y permite abrir el cierre y la autorización.
- La firma se conserva al dibujar y al cambiar el tamaño del formulario.
- El acta de entrega final se habilita después de confirmar la entrega; el formulario de documentos permite abrir ese paso directamente.

## Cómo cerrar OS-2026-0015

La captura mostraba autorización pendiente y la orden en espera. Instalar esta actualización no confirma acciones reales por ti.

1. En Autorización, registra la decisión real del cliente y continúa el trabajo autorizado.
2. Completa el resultado y los requisitos del cierre y pulsa Confirmar cierre técnico.
3. Dirección Técnica recibe y valida el cierre.
4. Con la liberación financiera y la custodia vigentes, el técnico asignado abre Entrega final: registra la notificación real al cliente, los datos del receptor, los controles, la firma y confirma la entrega. Si recibe un tercero, adjunta su autorización.
5. En Documentos PDF, genera el acta de entrega final.

## Comprobaciones adicionales

45 pruebas de backend aprobadas. Pruebas sobre PostgreSQL local verificaron permisos de entrega, bloqueo financiero, reversión, cierre y liberación de custodia, además de perfiles y estadísticas de clientes. Las pruebas de navegador verificaron detalle de clientes, entrega del técnico, conservación de firma, requisitos del acta, cambio de color y apertura desde agenda. Frontend compilado. La base de datos y los servidores de tu computador no se modificaron durante estas comprobaciones.

Corrección adicional — 6 de octubre de 2026

- Inicio: corrige el conflicto de tipos del parámetro de estado PostgreSQL; conserva fechas al reanudar.
- Vista previa: desplaza la pantalla al borrador; muestra avisos si falta el logo o una imagen. No flexibiliza la emisión del acta formal.
- Si la vista previa sigue fallando, copia el error que imprime el backend al pulsar Vista previa.

# Historial, avisos al creador, firmas y actas — 6 de octubre de 2026

Paquete acumulativo sobre el proyecto con recepción y constancias instalado. Incluye los ajustes anteriores de clientes completos, archivos de evidencia, asignación, remoto/local/visita externa y custodia/GPS. No sustituye todo el proyecto.

## Instalación

1. Detén backend y frontend con Ctrl+C.
2. Extrae el ZIP completo en una carpeta separada.
3. Abre la terminal en esa carpeta y ejecuta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALAR_MEJORAS.ps1
```

Destino predeterminado: `C:\Users\USUARIO\Desktop\inventario-app\Servicio-Tecnico`. Para otro destino agrega `-ProjectPath "C:\ruta\Servicio-Tecnico"`.

El instalador valida cada archivo, respalda los existentes antes de copiarlos, aplica las migraciones repetibles, ejecuta 45 pruebas y compila frontend. Conserva .env, node_modules y los logos. No vuelve a sincronizar World Office; si aún no actualizaste la extracción completa de clientes, ejecuta después desde backend `node scripts/sync-client-profiles.js`.

Reinicia backend y frontend y recarga la página.

## Notificaciones e historial

- Las operaciones guardadas en la orden, asignación, equipo, custodia, visita, recepción, firmas, evidencias, diagnóstico, bitácora, autorizaciones, cierre, finanzas, documentos y entrega dejan un historial con usuario, fecha y acción.
- La identidad del actor procede de la sesión autenticada. Las operaciones sin actor identificado se muestran como Sistema.
- El creador de la solicitud vinculada recibe avisos internos de las acciones de su servicio. Los cambios de una misma transacción se agrupan en un aviso; el historial conserva cada cambio. Las operaciones revertidas no dejan avisos ni acciones.
- La campana se actualiza con el intervalo existente de 15 segundos mientras la plataforma está abierta y al recuperar foco. No implica correo, WhatsApp o notificaciones del navegador con la plataforma cerrada.
- Mis servicios muestra al técnico creador las órdenes que creó aunque tengan otro técnico asignado, con consulta de historial y documentos y sin acciones propias del técnico asignado.
- Auditoría / Historial de acciones permite filtrar por usuario y cargar más registros. Se incorporan eventos anteriores ya existentes; no se inventan acciones que nunca se registraron.
- Solo administración, creador y equipo asignado pueden consultar el nuevo historial y la galería de firmas de esa orden.

## Firmas por cliente

- Las firmas de recepción y las firmas de entregas confirmadas se vinculan al cliente de la orden, al acta, al firmante y a la fecha.
- Las firmas anteriores se incorporan cuando existe el registro confirmado y su ruta de imagen. Esto no recupera imágenes eliminadas.
- Documentos PDF muestra Firmas vinculadas al cliente y permite consultar su imagen con autorización.
- La ficha de Clientes muestra las referencias de actas y firmantes. World Office se vincula mediante su código o un documento local único.
- Un tercero autorizado se identifica como tercero; su firma no se atribuye al cliente.
- La firma anterior queda como antecedente. No se pega automáticamente en nuevas actas: cada documento nuevo exige su firma correspondiente.

## Logos, colores y vista previa

Coloca o conserva los archivos originales aquí:

```
frontend/src/assets/img/logot.png
frontend/src/assets/img/logo3.jpeg
```

También se admiten los archivos en frontend/src/assets y logo3.jpg. Las dos opciones aparecen en Documentos PDF junto con Color principal y Color de fondo. No se incluyen imágenes sustitutas ni se sobrescriben tus logos: las capturas enviadas muestran la ubicación de los archivos, no sus originales completos.

Selecciona logo y colores y pulsa Vista previa en el tipo de acta. La vista previa se identifica como borrador y usa los datos actuales. Generar PDF utiliza esas mismas opciones y conserva la versión y su diseño. Si falta un logo, se informa qué archivo debes colocar; no se fabrica uno.

## El mensaje de cierre técnico

Tener un técnico asignado identifica quién atiende la orden. Confirmar el cierre es otro paso: registrar el resultado/diagnóstico, completar los controles y evidencias del cierre y pulsar Confirmar cierre técnico en Cierre técnico.

El acta formal de cierre se habilita cuando el cierre está confirmado. Documentos PDF muestra el requisito y un acceso al formulario para el técnico; la vista previa funciona antes de confirmar. Se conserva el técnico asignado en el acta.

## Validación

45 pruebas de backend, compilación frontend, pruebas SQL/API de avisos agrupados, actor correcto, reversión, histórico, firmas de cliente/tercero y permisos. Pruebas de navegador móvil para logos, colores, borrador, cierre pendiente, firmas e historial. Generación de PDF con imágenes de prueba; los archivos originales logot.png y logo3.jpeg de tu computador se verifican al usar la actualización allí.
