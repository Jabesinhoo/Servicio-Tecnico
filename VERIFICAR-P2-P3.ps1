$ErrorActionPreference = "Stop"

Write-Host "===== VERIFICACION BACKEND ====="
node --check .\backend\src\controllers\service-order.controller.js
node --check .\backend\src\routes\service-orders.routes.js

Write-Host ""
Write-Host "===== VERIFICACION ARCHIVOS FRONTEND ====="
$mis = '.\frontend\src\pages\Dashboard\MisServicios.jsx'
if (-not (Test-Path $mis)) { throw "No existe $mis" }

$app = Get-Content -Raw -Encoding UTF8 .\frontend\src\App.jsx
$layout = Get-Content -Raw -Encoding UTF8 .\frontend\src\components\DashboardLayout.jsx

if ($app -notmatch 'MisServicios') { throw 'App.jsx no contiene MisServicios' }
if ($app -notmatch 'mis-servicios') { throw 'App.jsx no contiene la ruta mis-servicios' }
if ($layout -notmatch '/dashboard/mis-servicios') { throw 'DashboardLayout.jsx no contiene el menu Mis servicios' }

Write-Host "OK: App.jsx y DashboardLayout.jsx contienen MisServicios."

Write-Host ""
Write-Host "===== VERIFICACION SQL ====="
$tables = docker exec tecnicos_db psql -U postgres -d tecnicos -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('service_order_assignments','service_order_current_custody','service_order_reception_checklists') ORDER BY table_name;"
Write-Host $tables

if ($tables -notmatch 'service_order_assignments') { Write-Warning 'Falta service_order_assignments: ejecuta SQL P2.' }
if ($tables -notmatch 'service_order_current_custody') { Write-Warning 'Falta service_order_current_custody: ejecuta SQL P2.' }
if ($tables -notmatch 'service_order_reception_checklists') { Write-Warning 'Falta service_order_reception_checklists: ejecuta SQL P3.' }

Write-Host ""
Write-Host "OK: verificaciones de archivos terminadas."
Write-Host "Ahora ejecuta en frontend: npm.cmd run build"
