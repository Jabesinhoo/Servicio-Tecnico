SERVICIO TÉCNICO — PATCH V7
=============================

Este paquete se instala SOBRE el proyecto que ya tiene V6.1.

V7 incluye:
- Agenda operativa sin horarios laborales de técnicos.
- AUTO: siguiente espacio libre común del equipo.
- MANUAL: fecha/hora elegida por administración.
- Duración completa de la OS bloqueando a todos los técnicos del equipo.
- Protección PostgreSQL contra solapamientos activos.
- Eliminación mediante modal -> cancelación trazable.
- Liberación de agenda y asignaciones al cancelar.
- Cambio de cliente en edición usando el buscador existente.
- Materiales conectados al inventario `products`; no crea inventario paralelo.
- Migración PostgreSQL e índices.
- Verificador de agenda y solapamientos.
- Backups automáticos antes de copiar archivos.
- Build opcional del frontend.

INSTALACIÓN
-----------
cd "C:\Users\USUARIO\Desktop\inventario-app\Servicio-Tecnico\Servicios-Patch-V7"
Set-ExecutionPolicy -Scope Process Bypass

.\INSTALAR-V7.ps1 `
  -ProjectRoot "C:\Users\USUARIO\Desktop\inventario-app\Servicio-Tecnico" `
  -BuildFrontend

VERIFICACIÓN
------------
cd "C:\Users\USUARIO\Desktop\inventario-app\Servicio-Tecnico"

node ".\Servicios-Patch-V7\VERIFICAR-V7.cjs" `
  "C:\Users\USUARIO\Desktop\inventario-app\Servicio-Tecnico"

MATERIALES
----------
El inventario maestro sigue siendo `products`.
El flujo es:
solicitar -> aprobar -> entregar -> consumir/devolver.

La entrega descuenta `products.stock_actual`.
La devolución reintegra stock y registra movimiento.

IMPORTANTE
----------
No contiene .env, node_modules, dist ni credenciales.
Es un PATCH V7 para aplicar sobre V6.1, no una copia completa del proyecto.
