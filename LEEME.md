# Visita, horarios laborales y fotos obligatorias al finalizar — 8 de octubre

**Instala esta actualización acumulativa:** detén backend y frontend, extrae el ZIP en la raíz de Servicio-Tecnico y ejecuta `powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALAR_MEJORAS.ps1`. Reinicia ambos y recarga el navegador.

- **En camino** y **Registrar llegada** quedan bloqueados después de registrarse correctamente y permanecen así al recargar. El servidor impide duplicar esos eventos del mismo técnico. Llegada conserva el registro sin GPS obligatorio; el botón ya no incluye «sin validación GPS».
- **Agenda vacía no equivale a horario laboral configurado.** Antes Disponibilidad mostraba libre a un técnico sin turnos. Ahora explica si faltan horarios, si ese día no trabaja o si existe otra reserva, y muestra los turnos reales en hora de Colombia. La revisión de creación distingue esas causas y muestra los códigos OS cuando hay cruce de reservas.
- **Para los dos técnicos del ejemplo:** como administrador entra en Agenda → Configurar horario laboral (o al engranaje de horario) y guarda los días y horas reales de **cada** técnico, principal y apoyo. También puedes hacerlo desde Equipo técnico de la creación, sin perder el formulario. El servicio completo, con la suma de duración de sus tipos, debe caber en un turno común. No se inventa un horario ni se eliminan reservas para permitir iniciar fuera de turno.
- Guardar horarios intenta programar las órdenes ya asignadas y sin reserva que usan ese técnico. Si todavía falta configurar a otro integrante o no existe un espacio común, la orden sigue pendiente de agenda. Si la programación automática no puede completarse por otro error, el horario ya guardado se conserva. Después de configurar todo el equipo, revisa la fecha reservada en Agenda. Cambia una fecha manual que esté fuera del turno; iniciar mantiene las reglas de tiempo y disponibilidad.
- **Finalizar trabajo → Evidencias finales:** es obligatoria al menos una fotografía del trabajo terminado (JPG, PNG o WEBP). Usa **Tomar foto** para abrir la cámara cuando el dispositivo lo permita o **Adjuntar archivos** para seleccionar una o varias fotos guardadas. Puedes añadir PDF como soporte; no sustituye la foto. El servidor también exige la fotografía antes de confirmar, y rechaza archivos cuya cabecera no coincide con el formato declarado. Las fotos iniciales de recepción no sustituyen las finales. Después de un reproceso se exige una foto nueva.

Validación de esta actualización: **115 pruebas backend aprobadas** y frontend compilado. PostgreSQL embebido: eventos de visita sin duplicados, reserva en hora de Colombia, duración, límites laborales y reparación sin duplicar bloques. Navegador con API simulada: botones persistentes tras recarga; configuración y actualización del horario visible; a 390 px, PDF insuficiente, cámara, selección múltiple y cierre habilitado después de cargar una foto. Estos controles no verifican la base de datos de tu computador; la instalación y configuración de los turnos reales siguen siendo necesarias.

# Corrección de materiales, fotos, agenda y GPS — 8 de octubre

**Instalación:** detén frontend y backend, extrae el paquete en la raíz de Servicio-Tecnico y ejecuta `powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALAR_MEJORAS.ps1`. Reinicia ambos y recarga el navegador. La nueva salida incluye `OK SQL: técnico de materiales, agenda y avisos legibles`.

- Solicitar materiales guarda el técnico responsable exigido por la tabla existente. Se comprobó con `tecnico_id NOT NULL`, conservando la restricción. Acepta uno o varios artículos del inventario o externos en el mismo servicio.
- En Solicitar material, elige el artículo o escribe el externo y usa **Añadir a lista**; repite para los demás y pulsa **Solicitar**. Puedes quitar entradas antes del envío. Máximo 50 artículos por envío, cada uno con cantidad, unidad/especificaciones y observaciones. El envío es una transacción: si uno no se puede registrar, no queda una lista parcial. El creador recibe el detalle y decide por artículo; pedir o aprobar no descuenta stock.
- Las fotos nuevas del inventario se comprimen y guardan como imagen persistente. Antes se guardaba una URL `blob:` del navegador, que expiraba al recargar. También se conservan todas las fotos seleccionadas juntas. **Las fotos antiguas cuyo enlace temporal ya venció deben volver a adjuntarse editando el producto**, pues esos enlaces no contienen una copia recuperable de la imagen. El taller muestra Foto no disponible para esos enlaces y resuelve rutas relativas contra el backend.
- Agenda usa los bloques activos como reserva real y muestra fecha/hora de Colombia. La migración recupera la fecha faltante de las reservas existentes. El instalador intenta programar las órdenes **asignadas** que carecen de bloque, usando duración de los tipos, horario laboral, todo el equipo y evitando cruces. No altera servicios en ejecución ni cancelados. Si falta horario o no hay turno común, muestra **Agenda pendiente OS-...: ...** con el motivo; configura los horarios en Técnicos y programa la orden desde Agenda o repite el instalador. No se inventan horarios. Las nuevas aprobaciones ya no terminan como asignadas si fracasa la reserva: informan el motivo y la orden permanece pendiente de aprobar/programar. La solicitud y el acta ya creadas se conservan para reintentar.
- Llegada y custodia no exigen GPS preciso, aunque el entorno anterior conserve `CUSTODY_REQUIRE_PRECISE_LOCATION=true`. Se registra llegada declarada cuando no se puede validar el punto y llegada validada cuando sí se confirma. La custodia sigue exigiendo técnico asignado, aceptación y que no la tenga otro usuario. Iniciar trabajo conserva las reglas de agenda, horario y recepción necesarias.
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
