SERVICIOS PATCH V4
==================

Compatible with Windows PowerShell 5.1.

1. Extract this ZIP inside:
   C:\Users\USUARIO\Desktop\inventario-app\Servicio-Tecnico

The extraction must create:
   Servicio-Tecnico\Servicios-Patch-V4\INSTALAR-V4.ps1

2. Run:

cd "C:\Users\USUARIO\Desktop\inventario-app\Servicio-Tecnico\Servicios-Patch-V4"
Set-ExecutionPolicy -Scope Process Bypass
.\INSTALAR-V4.ps1 `
  -ProjectRoot "C:\Users\USUARIO\Desktop\inventario-app\Servicio-Tecnico" `
  -BuildFrontend

Do not run the old installer, V2 or V3.
