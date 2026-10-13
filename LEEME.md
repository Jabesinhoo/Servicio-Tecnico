# Editar el formulario completo de una orden finalizada

Este paquete reemplaza el cambio anterior que limitaba la edición a la factura.

## Instalar

1. Copia las carpetas backend y frontend de este paquete sobre las del proyecto Servicio-Tecnico.
2. En localhost reinicia el backend y actualiza el navegador.
3. Para producción sube estos cambios a GitHub y deja terminar el deploy. Recarga el navegador después.
4. No necesitas ejecutar SQL ni reinstalar dependencias.

## Validar

Desde administración abre Servicios, busca una orden cerrada y pulsa el lápiz de editar. Se abre el formulario completo: cliente, solicitud, equipos y fotos de ingreso, tipos de servicio, alcance, condiciones, datos de aceptación, técnicos, fecha histórica y facturación. Cambia los campos necesarios y guarda. Vuelve a abrir para comprobar los datos y revisa el historial.

La orden permanece cerrada y conserva su fecha real de finalización. Cambiar tipos, técnicos o programación en una orden cerrada corrige sus datos sin asignar inventario nuevamente, crear trabajo pendiente ni reservar a los técnicos. Los movimientos de materiales ya realizados se conservan.

La factura seleccionada se comprueba contra World Office y debe corresponder al cliente. Si cambias de cliente y no eliges una factura nueva, se desvincula la anterior para no atribuirla al cliente equivocado. Una factura inválida revierte la edición de datos.

Las firmas y las actas emitidas conservan su contenido original. Corregir las condiciones o el cliente del formulario no modifica retroactivamente lo que se firmó. Las correcciones de datos y adjuntos quedan registradas en la bitácora.

Solo administración puede corregir órdenes cerradas. Órdenes canceladas o rechazadas conservan su flujo de reactivación existente.

## Verificación realizada

Prueba de integración del controlador sobre el esquema PostgreSQL exportado: edición completa, factura, fecha histórica, conservación del cierre y del técnico aceptado, sin nuevas reservas ni asignaciones pendientes, cambio de tipo con inventario previamente asignado, rechazo a técnico, rollback de factura inválida y desvinculación al cambiar cliente. Compilación Vite correcta y sintaxis JSX/backend validada. Falta comprobar visualmente en tu instalación.
