# Fotos de Inventario y listado de administración — 9 de octubre

- Fotos: se unifica la visualización en tarjetas, detalle, edición y taller. Admite imágenes guardadas como URL, objeto o lista JSON, resuelve las rutas relativas contra el backend y consulta rutas de imágenes protegidas con la sesión. Las fotos nuevas se guardan comprimidas como contenido permanente y se conservan al editar otros datos del producto.
- Fotos antiguas: si se guardó un enlace temporal **blob:**, el archivo ya no está disponible después de cerrar aquella sesión. Se muestra **Foto antigua: vuelve a adjuntarla**. Abre **Editar**, quita esa foto, adjunta el archivo original y pulsa **Actualizar**. No se inventa ni recupera una imagen que nunca quedó almacenada. Una ruta o archivo externo inexistente muestra **Foto no disponible**.
- Administración: **Operación técnica** incluye todos los servicios creados, también cerrados, cancelados y sin técnico principal. Abre por defecto en **Todos los estados** y **Todos los técnicos**. Puedes filtrar activos, cerrados o cancelados. Si seleccionas un técnico solo aparecen las órdenes de ese integrante. Los contadores del directorio dicen **OS activas** para distinguirlos del total histórico. El listado de cada técnico conserva su alcance por asignación.

Instalación: detén backend y frontend, extrae el ZIP en la raíz de Servicio-Tecnico y ejecuta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALAR_MEJORAS.ps1
```

Reinicia ambos y recarga el navegador. Las correcciones de fotos/listado no requieren una nueva migración SQL; el instalador conserva las migraciones anteriores. Verificación: 135 pruebas de backend, compilación de producción e integración PostgreSQL del tablero con órdenes activas/cerradas/canceladas/sin asignar. Las funciones de historial y evidencias de devolución de la actualización anterior siguen incluidas.

# Historial de herramientas y evidencias de devolución — 9 de octubre

Esta actualización se concentra en Inventario y la explicación de la bitácora. Conserva la confirmación de cierre, custodia y devolución existentes.

- En **Inventario → Inventario de taller · uso e historial** consulta responsable, orden de servicio, asignaciones, cantidades devueltas/consumidas y pendientes. El botón permanece visible después de cargar.
- En el detalle de un artículo, pulsa **Ver historial de uso y devoluciones**. La consulta se limita a ese artículo y muestra quién registró la devolución y quién tenía la herramienta.
- Al **Devolver**, puedes adjuntar fotografías o usar **Tomar foto**. La foto se guarda vinculada al movimiento, al servicio y al usuario que la adjuntó. También puedes **Adjuntar evidencia** o **Tomar foto** en una devolución histórica. **Ver foto de devolución** abre la imagen desde el servidor con acceso autenticado.
- Las fotos son opcionales y las devoluciones anteriores siguen funcionando. Cuando no se adjuntó una imagen se muestra **Sin foto de devolución registrada**. Añadir una fotografía a una devolución histórica no altera su fecha ni vuelve a aumentar stock. Los archivos aceptados son JPG, PNG o WEBP de hasta 10 MB.
- Excel conserva los datos de uso/devolución y añade responsable y cantidad de fotografías (no incrusta las imágenes).
- En **Equipo y bitácora**, **Actividades realizadas (opcional)** explica su propósito: notas de cada técnico sobre pruebas, instalación, apoyo y resultados. Se registran durante la ejecución, no sustituyen el resultado final y no son obligatorias para cerrar.

Instalación: detén backend y frontend, extrae el ZIP en la raíz de Servicio-Tecnico y ejecuta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALAR_MEJORAS.ps1
```

El instalador aplica la nueva tabla de fotos y metadata de movimientos sin borrar historial. Reinicia ambos y recarga el navegador. Verificación: 130 pruebas de backend, compilación frontend y prueba de integración con PostgreSQL local de asignación, consumo, devolución y fotografía histórica con permisos. Incluye las correcciones anteriores descritas debajo.

# Finalizar trabajo y entrega al cliente — 8 de octubre

Esta versión simplifica el flujo y sustituye los requisitos anteriores de diagnóstico obligatorio, entrega a Dirección Técnica, notificación al cliente y liberación financiera del servicio principal.

1. Técnico → **Finalizar trabajo**: marca las comprobaciones, escribe el resultado y adjunta al menos una foto final. Pulsa **Confirmar cierre técnico**. El botón guarda también el resultado y checklist; no necesitas guardarlos por separado. Si finalizas antes de la duración estimada, explica el motivo.
2. **Documentos PDF**: ya puedes generar el **Acta de cierre técnico**.
3. **Entrega final al cliente**: verifica identidad, estado del equipo y accesorios. Completa receptor, firma y pulsa **Confirmar entrega final y cerrar OS**. La firma recién dibujada se guarda al confirmar. Debe hacerlo quien tenga la custodia; las herramientas prestadas deben estar devueltas/regularizadas. Para un tercero conserva el soporte de autorización.
4. **Documentos PDF**: genera el **Acta de entrega final**. El técnico asignado puede generarla después de confirmar la entrega.

**Servicio extra** es opcional y no exige diagnóstico previo. Se usa para trabajo adicional que necesita aprobación. Una solicitud pendiente de aprobación bloquea finalizar; un extra aprobado con costo requiere revisión financiera posterior a su aprobación antes de entregar. No se muestra «Control financiero V17» ni observación financiera en la entrega del servicio principal y tampoco se declara pagada una factura por omitir ese paso.

**WhatsApp:** abre el chat usando el contacto del cliente y un mensaje preparado. Descarga el PDF y adjúntalo manualmente; abrir el chat no envía archivos ni registra que los hayas enviado.

**Versiones:** el icono de papelera elimina únicamente actas históricas sustituidas, con confirmación. Puede hacerlo administración o quien generó esa versión. La versión vigente se conserva y se registra la eliminación en el historial.

Validación: 125 pruebas de backend; flujo con PostgreSQL y generación real de PDF de cierre y entrega mediante Chromium; prueba de cierre en celular que conserva el resultado al adjuntar evidencia. El paquete contiene también las correcciones anteriores.

# Equipo sin horarios personales, actas y clientes — 8 de octubre

**Esta versión sustituye la exigencia anterior de configurar horarios laborales individuales.** Todos los técnicos de una orden viajan juntos: la reserva se hace para todo el equipo, por toda la duración de sus tipos de servicio, en hora de Colombia y sin cruces con otras órdenes. No se requiere configurar días ni turnos personales. Se retiró «Horario laboral del equipo» del formulario y la configuración de turnos de Agenda. Una reserva de cualquier integrante impide usar ese integrante en otra orden durante el intervalo. El inicio respeta la fecha programada y evita cruces por tiempo restante; no exige horario laboral individual. El instalador intenta reservar las órdenes asignadas que siguen sin agenda.

**Instalación:** detén backend y frontend, extrae el ZIP en la raíz de Servicio-Tecnico y ejecuta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALAR_MEJORAS.ps1
```

Reinicia ambos y recarga el navegador.

- Actas: se quitó `equipment_id` de la consulta de autorizaciones de entrega, pues esos soportes pertenecen al receptor y la tabla existente no tiene esa columna. Las evidencias de recepción conservan su relación con el equipo. No se requiere añadir una columna ficticia a la tabla de entrega.
- Detalles del cliente: World Office puede devolver el tipo de identificación como número. La vista ya no intenta llamar `toUpperCase()` sobre ese número. También tolera listas de relaciones y firmas vacías o con registros inválidos, para que abrir el ojito no derribe la página.
- En camino y Registrar llegada siguen bloqueándose después de registrarlos, incluso al recargar; el servidor evita duplicados. El GPS sigue opcional.
- Finalizar trabajo exige al menos una foto final JPG, PNG o WEBP, tomada con **Tomar foto** o adjuntada desde archivos. Se admiten varias y PDF adicional. El servidor también exige la foto, y un reproceso requiere una nueva.

## Conexión World Office: ENOTFOUND tecnoserver

El error indica que el computador no resuelve el nombre del servidor; no es un resultado vacío de la búsqueda ni un cambio del número de factura. El paquete conserva las credenciales y el host actual de `.env`. Ambas consultas (sincronización y facturas) usan la misma resolución de dirección. Si DNS falla en Windows, se intenta la resolución LAN/NetBIOS que usa `ping.exe`. Si tampoco encuentra el servidor, es necesario estar en la red/VPN con acceso a TECNOSERVER o indicar una IP real accesible.

Desde backend ejecuta:

```powershell
node .\scripts\diagnose-worldoffice-connection.js --save
```

Comprueba conexión, autenticación y permiso de lectura de facturas en Melissa, Power_ON y SAS. **Solo si logra conectar** guarda la dirección comprobada en `SQLSERVER_ADDRESS`, con respaldo local de `.env`; conserva usuario, contraseña y demás ajustes. Reinicia backend después de un guardado exitoso. Si imprime que no encuentra el servidor, sustituye `IP_DEL_SERVIDOR` por la IP real de TECNOSERVER y ejecuta:

```powershell
node .\scripts\diagnose-worldoffice-connection.js --address IP_DEL_SERVIDOR --save
```

Si conoces el puerto TCP real de la instancia, añade `--port PUERTO_REAL`; no se supone 1433 para una instancia nombrada. Al indicar un puerto, la conexión es TCP directa y no depende de SQL Server Browser. Sin puerto se conserva `SQLSERVER_INSTANCE`. Si falla la autenticación o conexión no se guardan cambios. No publica la contraseña. La factura sigue opcional y el formulario informa desconexión en lugar de fingir que no hay resultados.

**Límite de comprobación:** no hay acceso desde este entorno al servidor SQL Server de tu red. No se inventó su IP ni se puede confirmar aquí que la red/VPN actual llegue a TECNOSERVER. El diagnóstico verifica eso en tu computador.

Validación: **119 pruebas backend aprobadas**, frontend compilado; PostgreSQL embebido sin tabla de horarios personales, dos técnicos reservados al mismo tiempo, cruce del apoyo rechazado con rollback, programación automática/reparación e inicio; snapshot del acta contra una tabla de evidencias de entrega sin `equipment_id`; navegador a 390 px con tipo de documento numérico, teléfono y relaciones irregulares sin excepción, y Agenda sin configurar horarios. Las pruebas de conexión usan resolución simulada; la conectividad real se comprueba con el diagnóstico anterior.

# Corrección de materiales, fotos, agenda y GPS — 8 de octubre

**Instalación:** detén frontend y backend, extrae el paquete en la raíz de Servicio-Tecnico y ejecuta `powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALAR_MEJORAS.ps1`. Reinicia ambos y recarga el navegador. La nueva salida incluye `OK SQL: técnico de materiales, agenda y avisos legibles`.

- Solicitar materiales guarda el técnico responsable exigido por la tabla existente. Se comprobó con `tecnico_id NOT NULL`, conservando la restricción. Acepta uno o varios artículos del inventario o externos en el mismo servicio.
- En Solicitar material, elige el artículo o escribe el externo y usa **Añadir a lista**; repite para los demás y pulsa **Solicitar**. Puedes quitar entradas antes del envío. Máximo 50 artículos por envío, cada uno con cantidad, unidad/especificaciones y observaciones. El envío es una transacción: si uno no se puede registrar, no queda una lista parcial. El creador recibe el detalle y decide por artículo; pedir o aprobar no descuenta stock.
- Las fotos nuevas del inventario se comprimen y guardan como imagen persistente. Antes se guardaba una URL `blob:` del navegador, que expiraba al recargar. También se conservan todas las fotos seleccionadas juntas. **Las fotos antiguas cuyo enlace temporal ya venció deben volver a adjuntarse editando el producto**, pues esos enlaces no contienen una copia recuperable de la imagen. El taller muestra Foto no disponible para esos enlaces y resuelve rutas relativas contra el backend.
- Agenda usa los bloques activos como reserva real y muestra fecha/hora de Colombia. La migración recupera la fecha faltante de las reservas existentes. El instalador intenta programar las órdenes **asignadas** que carecen de bloque, usando duración de los tipos, todo el equipo y evitando cruces. No altera servicios en ejecución ni cancelados. Si no hay intervalo libre común, muestra **Agenda pendiente OS-...: ...** con el motivo; programa la orden desde Agenda o repite el instalador. Las nuevas aprobaciones ya no terminan como asignadas si fracasa la reserva: informan el motivo y la orden permanece pendiente de aprobar/programar. La solicitud y el acta ya creadas se conservan para reintentar.
- Llegada y custodia no exigen GPS preciso, aunque el entorno anterior conserve `CUSTODY_REQUIRE_PRECISE_LOCATION=true`. Se registra llegada declarada cuando no se puede validar el punto y llegada validada cuando sí se confirma. La custodia sigue exigiendo técnico asignado, aceptación y que no la tenga otro usuario. Iniciar trabajo conserva las reglas de agenda, cruces y recepción necesarias.
- Los avisos nuevos traducen en_camino y los estados de materiales y no repiten nombre/segundo nombre/apellido si los campos son idénticos. Los avisos antiguos conservan su registro original.

Validación: 108 pruebas backend; compilación de frontend; PostgreSQL embebido con esquema que exige técnico, solicitudes mixtas de varios artículos, rollback de lista inválida, notificaciones e historial; reserva real con fecha/hora de Colombia, duración y horarios; reparación de agenda sin duplicar reservas; llegada y custodia sin GPS con sus controles de permisos. Navegador con API simulada a 320, 390, 768, 1366, 1920 y 3840 px; fecha del turno visible, custodia habilitada sin GPS, lista mixta y aprobación; dos fotos comprimidas conservadas tras JSON y recarga.

# Técnico: botones, inventario previsto y solicitudes — 8 de octubre

- Los botones de cada tarjeta se distribuyen según el ancho de la tarjeta, con texto dentro del botón, incluso cuando el monitor muestra varias columnas.
- En Ítems de taller y materiales → Inventario asignado se ven los artículos previstos por todos los tipos del servicio, su cantidad total y cuánto se ha asignado. Se muestran antes de aceptar; al aceptar se conserva el descuento único y el historial por servicio/técnico.
- Solicitar materiales adicionales permite elegir un producto del catálogo o escribir un artículo fuera del inventario, con especificaciones, unidad, cantidad y observaciones. Puede solicitarse un producto sin existencias; entregarlo exige stock suficiente.
- El creador recibe notificación con usuario, artículo y cantidad. En Inventario asignado consulta las solicitudes y puede aprobarlas o rechazarlas; administración/inventario también puede decidir. El técnico asignado no puede aprobar su propia solicitud salvo que sea el creador. La entrega queda a cargo de administración/inventario. Solicitar y aprobar no descuentan stock; entregar un artículo del catálogo sí. Los artículos externos no generan movimientos ficticios de inventario.
- La migración reconoce Herramienta/herramienta/herramientas/tool e insumo/insumos/consumible/supply en Tipo del producto y los vincula al taller, incluyendo productos existentes. Respeta una clasificación ya guardada en el catálogo. Un texto no reconocido sigue requiriendo clasificación explícita en Inventario de taller.

**Instalación:** detén backend y frontend. Extrae el paquete en la raíz de Servicio-Tecnico y ejecuta desde esa carpeta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALAR_MEJORAS.ps1
```

Reinicia backend y frontend; recarga el navegador. La salida debe incluir `OK SQL: clasificación de taller y solicitudes externas de materiales`. El instalador aplica `20261008-technician-material-requests.sql`; no pegues SQL en PowerShell.

**Validación:** 102 pruebas de backend aprobadas y compilación de frontend. Pruebas adicionales con PostgreSQL embebido: migración repetida, clasificación automática y preservación de clasificación manual, aceptación con inventario consolidado sin doble descuento, permisos de creador, notificación real e historial, solicitudes externas, entrega/consumo/devolución, falta de stock y acceso ajeno. Navegador con API simulada: tarjetas pobladas a 320, 390, 768, 1366, 1920 y 3840 px; inventario visible antes de aceptar; solicitud externa en celular y aprobación por creador. La base de datos de tu equipo se actualiza al ejecutar el instalador.

# Interfaz responsive e iconos — 8 de octubre

Las acciones de quitar equipos, tipos de servicio, artículos previstos y evidencias usan icono de papelera. Borrar firma usa borrador. Cada botón conserva nombre accesible, ayuda al pasar el cursor, estado deshabilitado y área de 44 × 44 px; guardar y confirmar conservan texto.

En Servicios, la tabla se presenta como fichas en celulares, conservando todas las columnas y acciones. En tablet/escritorio mantiene tabla con desplazamiento horizontal interno cuando lo necesita. Barra de acciones, paginación, tarjetas, cabecera general y formularios permiten distribuir controles en más de una línea. La navegación de creación muestra todos los pasos mediante iconos en celular e indica el paso activo. Las ventanas de personalización y ayuda de ubicación permanecen dentro de la pantalla.

Revisión estática de los 122 archivos JSX de producción. Ajustes en grupos de acciones de clientes, inventarios, técnicos, usuarios, tipos, agenda, facturas, alquileres, roles, modales y componentes comunes. Se respetan los colores de Personalizar.

Validación en navegador con API simulada: Servicios y creación en 320, 360, 390, 768, 1024, 1366, 1920, 2560 y 3840 px; 12 módulos principales en seis tamaños; 13 modales operativos en ocho tamaños, incluida orientación horizontal; firma conservada al girar y borrado intencional; ventanas de ubicación, notificaciones y personalización; temas claro/oscuro; creación con altura reducida y acciones visibles. Selección y eliminación de tipos y equipos siguen funcionando. Compilación de frontend aprobada. Se probaron resoluciones, no dispositivos físicos ni controles remotos de TV; no se garantiza un comportamiento idéntico en todos los navegadores o datos posibles.

**Instalación:** detén frontend y backend; reemplaza los archivos con este paquete y ejecuta `INSTALAR_MEJORAS.ps1`. Contiene los cambios anteriores y el validador de varios equipos corregido. Esta mejora visual no añade una migración nueva.

# Corrección del paquete de instalación

El paquete anterior omitió `backend/src/domain/service-equipment-intake.js`. Las migraciones se aplicaron, pero el validador anterior causaba tres fallos en las pruebas de varios equipos. Este paquete incluye el archivo faltante y conserva todos los cambios anteriores.

Detén backend y frontend, extrae este ZIP actualizado y reemplaza los archivos del proyecto, incluido el validador indicado. Ejecuta de nuevo `INSTALAR_MEJORAS.ps1`. Las migraciones pueden repetirse; no debes borrar la base de datos. El instalador debe aprobar las 98 pruebas y completar la compilación del frontend.

# Una orden con uno o varios equipos — 8 de octubre

En **Nueva orden → Equipo recibido**, registra el primer equipo y usa **Agregar otro equipo** para los demás (hasta 50). Cada ficha tiene identificación, serial o motivo de ausencia, persona que entrega, condiciones, accesorios, observaciones y hasta tres fotos propias. El cliente seleccionado completa la persona que entrega; puedes corregirla por equipo.

Para servicios en sitio o remotos, desmarca la recepción en taller: podrás conservar los equipos atendidos con sus datos descriptivos, sin exigir condiciones de ingreso. También puedes quitar todas las fichas si el servicio no requiere equipos físicos. Antes de quitar un equipo con fotos guardadas, elimina sus fotos.

El Resumen y las actas de aceptación, recepción, cierre técnico y entrega identifican todos los equipos. Modificar una ficha en el borrador invalida la aceptación anterior. El técnico verifica todas las fichas en recepción, sin añadir ni retirar equipos de la orden; al confirmar se conserva el registro. Las fotos quedan asociadas al equipo correspondiente. Los servicios anteriores con un solo equipo siguen siendo compatibles.

Los equipos físicos no multiplican automáticamente la duración ni el inventario: estos siguen el plan de tipos de servicio y las cantidades configuradas. La custodia y el cierre permanecen agrupados por orden.

**Instalación:** detén backend y frontend, extrae este paquete aparte y ejecuta `INSTALAR_MEJORAS.ps1`. Aplica `20261008-order-multiple-equipment.sql` automáticamente. Debe mostrar `OK SQL: varios equipos por orden y fotos por equipo`. Si ya copiaste los archivos, ejecuta desde backend `node .\scripts\install-service-creation-v2.js` antes de reiniciar; evita ejecutar el SQL directamente en PowerShell.

Validación: 98 pruebas de backend aprobadas; pruebas con PostgreSQL de creación/edición, fotos por equipo y recepción técnica; controles de identidad, modificación y reversión; vista a 390 y 1366 px y compilación del frontend. Incluye los cambios anteriores.

# Una orden con varios tipos de servicio — 8 de octubre

**Nueva orden → Clasificación:** busca y selecciona uno o varios tipos. Cada clic agrega o retira un tipo; los seleccionados también tienen botón Quitar. La duración total y el valor base inicial se suman automáticamente. El inventario previsto combina las cantidades de los productos repetidos. El valor inicial puede ajustarse en el formulario.

Ejemplo: mantenimiento de 60 minutos e instalación de 90 minutos reservan 150 minutos para el técnico principal y todos los apoyos. Si cada tipo requiere 1 y 2 unidades del mismo artículo, al aceptar se asignan y descuentan 3, una sola vez. Es una orden con el mismo cliente/equipo técnico/flujo y varias filas en service_order_services. No crea órdenes separadas.

La solicitud guarda los tipos con sus nombres, valores, duraciones e inventarios. La activación crea una fila por cada tipo; la agenda usa la suma de sus duraciones guardadas. Resumen y el acta de aceptación muestran la lista completa. Cambiar la lista en el borrador invalida la firma anterior. Las órdenes anteriores de un solo tipo siguen siendo compatibles.

En edición se pueden cambiar los tipos antes de que el técnico reciba el inventario. Se recalcula el tiempo y se comprueba/reserva la nueva agenda: si no hay espacio, la edición completa se revierte. Una vez asignado el inventario al aceptar, se conserva la lista para no alterar su custodia ni duplicar descuentos; los trabajos adicionales se registran por separado.

**Instalación:** ejecuta INSTALAR_MEJORAS.ps1 con backend/frontend detenidos. Aplica automáticamente la migración `20261008-order-multiple-service-types.sql`. Si ya copiaste los archivos manualmente, ejecuta desde backend `node .\scripts\install-service-creation-v2.js` antes de reiniciar. Debe aparecer `OK SQL: varios tipos por orden de servicio`.

Validación: 91 pruebas de backend aprobadas; creación/actualización de solicitud con PostgreSQL de prueba; múltiples filas y descuento conjunto al aceptar; agenda de 150 minutos con principal/apoyo; edición con reversión por conflicto; selección, eliminación y Resumen en el modal real a 390 y 1366 px; compilación del frontend aprobada. Incluye las mejoras anteriores, incluida la factura opcional.

# Aceptación con inventario automático y factura opcional — 8 de octubre

**Aceptar servicio:** el técnico principal recibe automáticamente los artículos previstos en la copia guardada al activar la orden. Se descuenta la disponibilidad, se registra su custodia por cantidad/orden/técnico y se crean movimientos de salida e historial. La aceptación y el inventario se guardan juntos: cualquier falta de stock, artículo inactivo o sin clasificación revierte toda la operación. Cada orden se procesa una sola vez, incluso con reintentos o reasignación posterior. Una reasignación no supone una devolución física ni vuelve a descontar los artículos.

**Antes de probar:** en Inventario de taller clasifica los artículos del tipo como herramienta retornable o insumo. Crea una orden con ese tipo y deja al técnico principal aceptarla. Se abre Inventario de taller con las asignaciones. Ahí puede devolver herramientas, registrar consumo de insumos y devolver sobrantes. Consumo no vuelve a descontar lo que ya salió al aceptar; devolución solo suma la cantidad pendiente devuelta. No permite consumir herramientas ni devolver lo ya consumido. Al cierre definitivo deben quedar resueltas todas las cantidades.

El responsable inicial es el técnico principal que acepta; no se multiplica la lista por cada apoyo. Administración e inventario ven responsables, órdenes, cantidades asignadas/devueltas/consumidas/pendientes e historial, también exportables a Excel. Los eventos alimentan el historial y las notificaciones al creador mediante el mecanismo existente. Las órdenes antiguas ya aceptadas no reciben descuentos retroactivos. Las órdenes sin inventario previsto siguen funcionando.

**Factura opcional:** se permite avanzar, registrar y activar sin factura World Office, también verificar un pago con su soporte sin número de factura. Se conserva el control de pago y la autorización de pospago. Puedes vincular la factura después desde edición; una consulta fallida no obliga a vincularla. Esta actualización no modifica la conexión ni resuelve por sí sola `ENOTFOUND tecnoserver`.

Validación: 83 pruebas de backend; controladores reales con PostgreSQL de prueba para aceptación, reintento, falta de existencias con reversión, permisos, consumo y devoluciones; verificación de pago sin factura; selector/tabla en móvil y escritorio; compilación aprobada. El instalador aplica ambas migraciones nuevas y ejecuta las pruebas.

# Inventario por tipo de servicio y verificación de agenda — 8 de octubre

En **Tipos de servicio**, crea o edita un tipo y usa **Inventario necesario** para buscar artículos por código/nombre, agregarlos, indicar cantidades o quitarlos. También está disponible al crear un tipo dentro de la nueva orden. Al seleccionar el tipo, aparece la lista y se repite en Resumen. Al activar la orden se conserva una copia del inventario previsto; editar la plantilla no reescribe esa copia. No se descuentan existencias ni se asigna material por configurar una plantilla. El registro de uso por el técnico se revisará en la siguiente etapa.

**Agenda:** la implementación existente reserva la duración completa para principal y apoyos; las comprobaciones y los bloqueos de transacción se aplican a todos ellos. Se probó que un apoyo ocupado impide otra orden, que iniciar justo al terminar el intervalo es válido y que los bloques liberados permiten reutilizar al técnico. Esto impide cruces de asignación, sin impedir el acceso del técnico al sistema.

Para comprobarlo tras instalar: configura un tipo de 90 minutos con dos artículos, selecciónalo en una nueva orden y revisa Resumen. Programa principal y apoyo a las 09:00; intenta otra orden con ese apoyo a las 10:00 (debe rechazarse) y a las 10:30 (debe permitirse si su horario lo admite). Horas de Colombia; el intervalo completo debe caber en la jornada laboral. Las reservas se consolidan al aprobar/asignar: un borrador no reserva agenda.

76 pruebas de backend aprobadas, migración repetible y CRUD con PostgreSQL de prueba, cruces de agenda con equipo completo, selector de inventario en móvil/escritorio y compilación del frontend. Instalar aplica automáticamente la nueva migración. Incluye todos los ajustes anteriores.

# Corrección de búsqueda en edición y detalle en Resumen

La captura de OS-2026-0017 mostraba **Editar**. En esa pantalla el número era texto y no se consultaba World Office: el buscador estaba condicionado al modo de creación. Esta versión habilita el buscador real también al editar, elimina el campo duplicado y carga en Resumen la factura seleccionada con sus líneas. Las facturas vinculadas se precargan al volver a abrir la orden.

**Facturación:** escribe `FV FE 82602` o `82602` en **Número, prefijo o factura completa** y pulsa Enter o **Buscar en World Office**. Selecciona el resultado de la empresa correcta con **Vincular esta factura**. Sus datos aparecen en **Resumen**. En edición, pulsa **Guardar cambios** para conservarla: buscar y seleccionar no modifica la orden ni crea otro borrador.

Al guardar una edición, el backend vuelve a consultar World Office, verifica el cliente y conserva empresa, clave y líneas en la misma transacción de edición. Una factura ajena o ambigua revierte los cambios. Se conserva el historial de actualización y las restricciones de edición de órdenes cerradas.

El control de pago existente se encuentra en **Control de pago**, plegado para reducir ruido. Seleccionar una factura no constituye una verificación de pago. El PDF no es necesario para buscar ni vincular los datos.

Se probaron ambos textos en el modal de edición completo, en móvil y escritorio: búsqueda real desde el formulario, detalle en Resumen y ausencia de escrituras antes de Guardar. 73 pruebas de backend y compilación aprobadas. Estas pruebas usaron datos de prueba; la consulta a tu SQL Server se comprueba tras instalar.

# Servicio Técnico — facturas con el extractor de TecnoNacho Sales

Actualización acumulativa del 7 de octubre de 2026. Incluye las mejoras anteriores y reemplaza la búsqueda de facturas con las consultas verificadas en el código `sales_sync.py` que compartiste.

## Instalar

1. Detén backend y frontend con Ctrl+C.
2. Extrae el ZIP completo en una carpeta separada del proyecto. Abre PowerShell en esa carpeta y ejecuta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALAR_MEJORAS.ps1
```

El destino predeterminado es `C:\Users\USUARIO\Desktop\inventario-app\Servicio-Tecnico`. Para otra ruta agrega `-ProjectPath "ruta del proyecto"`. El instalador verifica y respalda archivos, copia los cambios, aplica las migraciones idempotentes, ejecuta 91 pruebas y compila el frontend. Conserva `.env` y los logos existentes. Detener los servidores evita dependencias bloqueadas en Windows. No pegues SQL directamente en PowerShell.

3. Reinicia los dos servidores como normalmente los inicias.

## Cambio que resuelve el origen de la búsqueda

El extractor compartido usa **Melissa → CC**, **Power_ON → FV**, **SAS → FV**. Consulta `dbo.Vista_Auxiliar_Movimientos_Inventario` en cada base, no una API ni un PDF. La búsqueda anterior consultaba encabezados y tipos FV en la base configurada; eso podía excluir las ventas CC de Melissa y las facturas de las otras empresas.

Ahora se consulta la misma vista y los mismos tipos del extractor, con las credenciales `SQLSERVER_*` ya existentes. Las tres empresas están permitidas explícitamente; no se aceptan nombres arbitrarios desde el navegador. Las consultas son SELECT parametrizados y no escriben en World Office. No se modifica el sistema TecnoNacho Sales ni se requiere su SQLite.

El cliente se identifica por su documento/NIT normalizado, sin exigir su ID interno de Melissa en Power_ON o SAS. La clave conservada es **empresa + source_id**, donde `source_id` sigue el formato del extractor: `sale|tipo|prefijo|número`. Por ejemplo, `SAS + sale|FV|FE|81315`. Se rechazan documentos anulados o documentos que mezclen identificaciones de clientes.

Se buscan hasta 30 documentos recientes por empresa; el listado indica empresa y fecha. Si una empresa no se puede consultar, se muestra un aviso explícito y se conservan los resultados disponibles. Si no se puede consultar ninguna, se informa el error. Tu usuario SQL necesita permiso de lectura de las tres bases; el instalador no cambia permisos.

## Qué se conserva al vincular

Referencia, empresa, tipo, prefijo, número, fecha, cliente, identificación, vendedor, forma de pago, dirección, observaciones y detalle de productos/servicios. Cada línea incluye código, nombre, unidad, cantidad, valor unitario, descuento, subtotal y datos de IVA.

Se conservan **todas las líneas documentales**, incluidos los servicios técnicos y conceptos excluidos del KPI de ventas. No se aplican filtros comerciales del KPI a una factura que respalda el servicio. Las devoluciones DMC y otras notas no se presentan como facturas de venta ni se descuentan automáticamente del documento original.

El subtotal procede de la suma de los subtotales absolutos de las líneas, como `fetch_sales()`. Sales usa ese importe antes de IVA para su total/KPI. Por eso el formulario diferencia **Subtotal**, **IVA** y **Subtotal + IVA (calculado)**; no confunde el KPI con el importe con impuesto. El descuento ya está reflejado en el subtotal del origen y no se aplica por segunda vez.

Si aparece IVA fuera del rango 0–1 o ImpoConsumo/ImpoSaludable distinto de cero, se guarda el subtotal y se muestra un aviso: el extractor original no ha validado la semántica de esos impuestos. No se inventa un total para ese caso. Los importes calculados son información documental, no una certificación de saldo.

**Pagado y saldo permanecen Sin dato** en este origen de ventas: las líneas de venta no prueban pagos ni saldo pendiente. Vincular no confirma pago ni libera el control financiero automáticamente.

No se obtiene un PDF original desde esta vista. Los datos y las líneas se muestran en tabla, y **Adjuntar PDF de factura (opcional)** permite incluir el original exportado si lo tienes. Cambiar de empresa/documento elimina el PDF anterior para no conservar un soporte de otra factura.

## Prueba rápida con tus facturas

1. Nueva orden de servicio → selecciona el cliente correcto.
2. Facturación → busca `81315`, `FE 81315` o una referencia existente del cliente. Una búsqueda vacía lista las más recientes.
3. Comprueba la empresa y pulsa **Vincular esta factura**.
4. Revisa los datos y las líneas, incluidos los servicios técnicos.
5. Crea la orden y abre **Documentos y factura de creación**: debe conservar los datos y el detalle.
6. Prueba otra identificación: no debe permitir vincular la factura anterior.
7. Si aparece un aviso de empresa inaccesible, revisa el permiso de lectura de esa base para el usuario SQL utilizado por este backend.

No es necesario volver a compartir el diagnóstico ni configurar un mapeo financiero para esta búsqueda. Si anteriormente activaste `WORLDOFFICE_INVOICE_SOURCE=mapped`, elimina esa variable o cambia su valor a `sales` y reinicia el backend para usar el extractor de esta actualización. El modo predeterminado es Sales. `WORLDOFFICE_INVOICE_LOOKUP_ENABLED=false` permite deshabilitar explícitamente la consulta; el instalador no modifica `.env`.

## Mejoras anteriores incluidas

Notificaciones e historial de actividad por servicio y técnico; firmas vinculadas al cliente; cierre técnico y entrega final con permisos; actas Verdana, tablas, color #8aa645 y logos existentes. Creación por pasos, resumen de cliente con teléfono, atención remota/local/externa, ubicación OpenStreetMap opcional, receptor inicial tomado del cliente y hasta tres fotos. Búsqueda/creación de tipos de servicio, firma con borrado y versiones, entrada de lápiz/táctil/mouse e importación PNG. Vistas previas autenticadas, equipo técnico con disponibilidad y horarios en Colombia, inventario simplificado y seguimiento de uso, dashboard y exportaciones existentes.

Una tableta de firmas que requiere SDK propio necesita integración específica de su marca/modelo.

## Validación

73 pruebas de backend aprobadas. Integración con PostgreSQL local: persistencia de empresa, clave y líneas; rechazo de ambigüedad; documentos consultables en la orden; permisos y cambio de PDF. Prueba del formulario en móvil y escritorio con detalle sin desbordamiento de pantalla. Componentes revisados sin errores de lint y compilación de producción aprobada.

Las consultas se adaptaron a tu código real. No se consultó el SQL Server de tu computador desde este entorno; queda probar la factura real después de instalar.
