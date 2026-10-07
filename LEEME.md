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

El destino predeterminado es `C:\Users\USUARIO\Desktop\inventario-app\Servicio-Tecnico`. Para otra ruta agrega `-ProjectPath "ruta del proyecto"`. El instalador verifica y respalda archivos, copia los cambios, aplica las migraciones idempotentes, ejecuta 73 pruebas y compila el frontend. Conserva `.env` y los logos existentes. Detener los servidores evita dependencias bloqueadas en Windows. No pegues SQL directamente en PowerShell.

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
