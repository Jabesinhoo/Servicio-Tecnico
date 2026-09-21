SERVICIOS PATCH V6.1
====================

Corrección de continuidad sobre V6.

Qué corrige:
- PATCH-V6 ya no depende de coincidencias exactas de texto/CRLF.
- Inserta service_order_services estructuralmente dentro de exports.activate.
- Es idempotente: si el detalle ya se inserta, no duplica el bloque.
- Recupera OS históricas activadas que tienen intake pero aparecen como Servicios (0).
- Mantiene el módulo de materiales y el modal de cancelación de V6.

Instalación:
  cd "C:\Users\USUARIO\Desktop\inventario-app\Servicio-Tecnico\Servicios-Patch-V6.1"
  Set-ExecutionPolicy -Scope Process Bypass
  .\INSTALAR-V6.1.ps1 `
    -ProjectRoot "C:\Users\USUARIO\Desktop\inventario-app\Servicio-Tecnico" `
    -BuildFrontend

No vuelvas a ejecutar V6 después de V6.1.
