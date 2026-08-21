# VERIFICAR-P2.ps1
# Ejecutar desde la raíz del proyecto.

$ErrorActionPreference = "Stop"

Write-Host "===== BACKEND: sintaxis ====="
node --check .\backend\src\controllers\service-order.controller.js
node --check .\backend\src\routes\service-orders.routes.js

Write-Host ""
Write-Host "===== FRONTEND: archivos ====="

$files = @(
  ".\frontend\src\pages\Dashboard\MisServicios.jsx",
  ".\frontend\src\App.jsx",
  ".\frontend\src\components\DashboardLayout.jsx"
)

foreach ($file in $files) {
  if (-not (Test-Path $file)) {
    throw "Falta $file"
  }

  Write-Host "OK: $file"
}

Write-Host ""
Write-Host "===== RUTAS P2 ====="

Select-String `
  -Path .\backend\src\routes\service-orders.routes.js `
  -Pattern "my-work|assignment/accept|assignment/impediment|custody/take"

Write-Host ""
Write-Host "===== FRONTEND P2 ====="

Select-String `
  -Path .\frontend\src\App.jsx `
  -Pattern "mis-servicios|MisServicios"

Select-String `
  -Path .\frontend\src\components\DashboardLayout.jsx `
  -Pattern "Mis servicios|mis-servicios"

Write-Host ""
Write-Host "Verificación estática finalizada."
