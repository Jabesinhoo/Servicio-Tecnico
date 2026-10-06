# Dashboard, taller y finalización del técnico — 6 de octubre de 2026

Esta es una actualización acumulativa. Conserva las correcciones anteriores de clientes, notificaciones, firmas, cierre, entrega y actas. No es un proyecto nuevo ni una base de datos de reemplazo.

## Instalación de esta versión

1. Detén backend y frontend con Ctrl+C.
2. Extrae este ZIP completo en una carpeta separada, por ejemplo `Descargas\ActualizacionServicio`.
3. Abre PowerShell en esa carpeta y ejecuta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALAR_MEJORAS.ps1
```

Si el proyecto está en otra ruta, añade `-ProjectPath "C:\ruta\Servicio-Tecnico"`.
El instalador valida los archivos, respalda los existentes, aplica SQL y ejecuta 56 pruebas y la compilación. No reinstala dependencias ni reemplaza `.env`, fotos o logos. Reinicia ambos servidores después del mensaje OK.

## Cómo usar los cambios

- **Horario:** configura los turnos reales de cada técnico en Agenda y la duración de cada tipo de servicio. La programación automática y manual exigen que el servicio completo quepa en el turno de todos los técnicos asignados, sin atravesar descansos ni crear cruces. La agenda trabaja en `America/Bogota`. Sin horario configurado no se inventa disponibilidad; la aprobación puede conservarse con una advertencia y requiere programación antes de iniciar.
- **Trabajo del técnico:** en Mis servicios, inicia o reanuda dentro del horario y de la programación. El sistema registra las sesiones efectivas; las pausas detienen el tiempo. Pulsa **Finalizar trabajo**, completa resultado, verificaciones y evidencia final, y confirma el cierre técnico. Si acabas antes de la duración estimada, registra el motivo. La duración es una estimación: no se finaliza automáticamente un trabajo ni se impide registrar un cierre tardío. La validación de Dirección y la entrega final siguen siendo pasos posteriores.
- **Taller:** la creación actual de productos y sus fotos se conserva. En Inventarios abre **Inventario de taller · uso e historial** y clasifica los productos existentes como herramienta o insumo. En Mis servicios abre **Herramientas y materiales**, elige una herramienta y cantidad; el retiro baja las unidades disponibles y registra orden, usuario y técnico. Consulta quién las tiene y registra devoluciones completas o parciales. Los insumos/repuestos usan el flujo existente de Materiales. No se confirma la entrega final con herramientas pendientes de devolver.
- **Dashboard:** reemplaza la sección Reportes. Muestra servicios, rendimiento de técnicos, clientes con mayor facturación, controles financieros, stock bajo y herramientas en custodia. Los filtros de período se refieren a la fecha de creación de las órdenes; la facturación corresponde a esas órdenes. El inventario y la custodia muestran el estado actual.
- **Finanzas:** se distinguen valor facturado neto de notas crédito y valor esperado. Se excluyen borradores y anulaciones. Facturado no significa cobrado: no se presentan estos montos como recaudo ni utilidad.
- **Excel:** el dashboard exporta el detalle completo del período, tablas y gráficas nativas vinculadas a celdas, hasta 10.000 órdenes por período. Puedes editar los datos fuente en la hoja Gráficas. El inventario de taller exporta su consulta visible: hasta 100 productos y las últimas 200 asignaciones/eventos; el archivo indica ese alcance.
- **Clientes y carga:** se cancelan búsquedas anteriores, se mantiene la paginación y se evita expandir todos los perfiles de World Office para contar filas. Se añaden índices y las páginas se cargan cuando se abren. La mejora se verificó en el entorno de pruebas; el tiempo real de respuesta depende de tu base de datos y equipo.

## Datos históricos y permisos

Los servicios anteriores sin sesiones medidas no reciben tiempos ficticios ni cuentan como mediciones de cumplimiento. Las nuevas sesiones se registran al iniciar/reanudar después de instalar. Administración ve finanzas y ranking de clientes; el técnico ve servicios de su equipo y sus herramientas. El servidor verifica pertenencia, cantidades y disponibilidad.

## Verificaciones de esta versión

56 pruebas del backend aprobadas y frontend compilado. Pruebas con PostgreSQL local verificaron stock, permisos, reversión, devoluciones parciales, horarios, duración por tipo, sesiones, finanzas y alcance del dashboard. Pruebas de navegador verificaron el dashboard móvil, la descarga Excel, herramientas con foto, cantidades, custodia, devolución e historial y la hora de Colombia en el calendario. El Excel se abrió con sus cuatro gráficas nativas y referencias a celdas. No se ejecutó esta instalación en tu computador.

---

# Corrección de cierre y entrega; nuevo diseño de actas

- Cierre: administración y el técnico principal pueden guardar el resultado, las verificaciones y las evidencias mientras la orden está asignada, en espera o en ejecución. El formulario usa el estado actualizado del servidor y permite iniciar/reanudar desde allí. Una autorización pendiente exige registrar la decisión del cliente antes de reanudar.
- Administración puede completar el cierre técnico y registrar la entrega interna. Se conserva el técnico responsable y el historial identifica al usuario que realizó cada acción. La confirmación exige ejecución, diagnóstico, verificaciones, evidencia y custodia válida.
- Entrega final: el borrador de receptor, firma y soportes es editable antes de validar el cierre. La confirmación exige cierre validado, controles financieros, aviso al cliente y custodia de quien realiza la entrega.
- La actualización periódica del tablero ya no recarga estos dos formularios ni borra los campos mientras escribes.
- Las tres actas usan tablas, encabezados verdes #8aa645, fondos suaves y fuente Verdana. Los estados y las verificaciones se presentan en español. Se mantienen las dos opciones de logo. Puedes ajustar los colores del PDF en Documentos PDF; este diseño es independiente del color elegido para la interfaz.
- Los PDF ya emitidos conservan su versión anterior. Usa Vista previa y Generar PDF para crear una nueva versión con este diseño.

## Verificación de esta corrección

56 pruebas de backend aprobadas; compilación frontend correcta. Pruebas reales sobre PostgreSQL local verificaron borradores, permisos, confirmación del cierre, recepción/validación de Dirección y entrega final con bloqueo financiero. Pruebas de navegador verificaron los formularios del administrador y del técnico, actualización del estado y borrador de entrega. Se generaron los tres tipos de PDF en A4 y se revisó el diseño.

# Actualización final: clientes, colores, agenda y entrega

- Las acciones de Servicios, Mis servicios, Clientes, Agenda y sus formularios siguen el color seleccionado en Personalizar. Los avisos de error y las acciones destructivas conservan su identificación.
- El detalle del cliente muestra su información aunque falle la consulta de estadísticas. Se corrigen identificadores de World Office, columnas financieras ausentes y montos grandes.
- La agenda conserva el calendario al actualizar; las órdenes se abren al pulsar su evento. La disponibilidad muestra un error recuperable si su consulta falla.
- Administración y el técnico asignado pueden preparar aviso, receptor, soportes y firma como borrador. La confirmación exige validación del cierre por Dirección Técnica y custodia del usuario que entrega. El formulario explica los requisitos pendientes y permite abrir el cierre y la autorización.
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

56 pruebas de backend aprobadas. Pruebas sobre PostgreSQL local verificaron permisos de entrega, bloqueo financiero, reversión, cierre y liberación de custodia, además de perfiles y estadísticas de clientes. Las pruebas de navegador verificaron detalle de clientes, entrega del técnico, conservación de firma, requisitos del acta, cambio de color y apertura desde agenda. Frontend compilado. La base de datos y los servidores de tu computador no se modificaron durante estas comprobaciones.

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

El instalador valida cada archivo, respalda los existentes antes de copiarlos, aplica las migraciones repetibles, ejecuta 56 pruebas y compila frontend. Conserva .env, node_modules y los logos. No vuelve a sincronizar World Office; si aún no actualizaste la extracción completa de clientes, ejecuta después desde backend `node scripts/sync-client-profiles.js`.

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

56 pruebas de backend, compilación frontend, pruebas SQL/API de avisos agrupados, actor correcto, reversión, histórico, firmas de cliente/tercero y permisos. Pruebas de navegador móvil para logos, colores, borrador, cierre pendiente, firmas e historial. Generación de PDF con imágenes de prueba; los archivos originales logot.png y logo3.jpeg de tu computador se verifican al usar la actualización allí.
