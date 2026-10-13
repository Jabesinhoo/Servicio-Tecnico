# Cambiar la factura de una orden cerrada

Copia backend y frontend del ZIP en la raíz de tu proyecto. Reinicia el backend local,
recarga la web y haz commit/push para aplicar el cambio en producción. No requiere SQL
ni migraciones nuevas.

En Servicios, como administrador, pulsa Editar sobre una OS cerrada. Se abrirá un modal
exclusivo para su factura: busca el documento, selecciónalo, revisa su resumen y pulsa
Guardar factura. La API vuelve a verificarlo contra el cliente original de la orden.

Se permite añadir o sustituir la factura de World Office. No permite escribir una
referencia inventada ni cambiar el cliente, técnicos, agenda, inventario, diagnóstico,
cierre, entrega o estado. Una petición que mezcle esos campos se rechaza por completo.
Las órdenes canceladas o rechazadas mantienen su bloqueo de edición.

El cambio actualiza el documento vinculado y la referencia del control financiero.
Se registra actor, factura anterior y factura nueva en el historial. No modifica las
actas ya emitidas ni confirma pagos. Si se sustituye la factura, se retira el PDF de
soporte de creación perteneciente a la factura anterior para evitar mostrarlo como
soporte del documento nuevo; las actas emitidas se conservan.

Para una OS antigua sin solicitud de origen se crea únicamente el vínculo de origen
necesario para guardar la factura, asociado a la misma OS y cliente, sin reabrirla.
Con el paquete del dashboard financiero, el total leerá el documento nuevo al actualizar.

Validado: restricciones de rol/campos, cliente diferente rechazado, estado y datos
originales inmutables, historial, vinculación de OS antiguas y compilación del frontend.
Falta comprobar el flujo visual y la consulta real desde tu instalación.
