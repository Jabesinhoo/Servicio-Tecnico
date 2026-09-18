SERVICIOS PATCH V5

Changes included:
- Delete service now uses a real modal instead of window.confirm/window.alert.
- Edit service reuses the same wizard UI as service creation.
- Edit mode preloads client, request, classification, type, conditions, acceptance,
  technical team, scheduling, billing and payment data.
- Backend PUT /api/service-orders/:id accepts the complete controlled edit payload.
- Team changes are persisted to service_order_team_members.
- Schedule is recalculated only when scheduling/team data actually changed.
- Manual scheduling validates conflicts/past dates through the existing scheduler.
- Automatic scheduling keeps edits even if no common slot is available and returns
  a scheduling warning instead of discarding the rest of the edit.
- History is human-readable; raw event names, UUIDs and JSON are no longer shown.
- The missing reject handler is included, so /service-orders/:id/reject keeps working.

INSTALL
1) Extract this ZIP so this folder exists:
   C:\Users\USUARIO\Desktop\inventario-app\Servicio-Tecnico\Servicios-Patch-V5

2) Run PowerShell:
   cd "C:\Users\USUARIO\Desktop\inventario-app\Servicio-Tecnico\Servicios-Patch-V5"
   Set-ExecutionPolicy -Scope Process Bypass
   .\INSTALAR-V5.ps1 `
     -ProjectRoot "C:\Users\USUARIO\Desktop\inventario-app\Servicio-Tecnico" `
     -BuildFrontend

3) Restart backend/frontend only if they did not hot-reload.

Do NOT run V1/V2/V3/V4 again after V5.
