$ErrorActionPreference = "Stop"

Write-Host "===== VERIFICACION BACKEND ====="

node --check .\backend\src\controllers\service-order.controller.js
if ($LASTEXITCODE -ne 0) {
    throw "Fallo de sintaxis en service-order.controller.js"
}

node --check .\backend\src\routes\service-orders.routes.js
if ($LASTEXITCODE -ne 0) {
    throw "Fallo de sintaxis en service-orders.routes.js"
}

Write-Host "OK: backend sin errores de sintaxis."

Write-Host ""
Write-Host "===== VERIFICACION ARCHIVOS FRONTEND ====="

$mis = '.\frontend\src\pages\Dashboard\MisServicios.jsx'

if (-not (Test-Path $mis)) {
    throw "No existe $mis"
}

$app = Get-Content -Raw -Encoding UTF8 .\frontend\src\App.jsx
$layout = Get-Content -Raw -Encoding UTF8 .\frontend\src\components\DashboardLayout.jsx

if ($app -notmatch 'MisServicios') {
    throw 'App.jsx no contiene MisServicios'
}

if ($app -notmatch 'mis-servicios') {
    throw 'App.jsx no contiene la ruta mis-servicios'
}

if ($layout -notmatch '/dashboard/mis-servicios') {
    throw 'DashboardLayout.jsx no contiene el menu Mis servicios'
}

Write-Host "OK: App.jsx y DashboardLayout.jsx contienen MisServicios."

Write-Host ""
Write-Host "===== VERIFICACION SQL ====="

# PowerShell devuelve una colección de líneas desde docker/psql.
# Usamos @() + Trim() + -contains para evitar falsos positivos
# de -notmatch sobre arrays.
$tablesRaw = @(
    docker exec tecnicos_db psql -U postgres -d tecnicos -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('service_order_assignments','service_order_current_custody','service_order_reception_checklists') ORDER BY table_name;"
)

if ($LASTEXITCODE -ne 0) {
    throw "No se pudo consultar PostgreSQL dentro de tecnicos_db."
}

$tables = @(
    $tablesRaw |
    ForEach-Object { $_.ToString().Trim() } |
    Where-Object { $_ -ne '' }
)

$requiredTables = @(
    'service_order_assignments',
    'service_order_current_custody',
    'service_order_reception_checklists'
)

foreach ($table in $requiredTables) {
    if ($tables -contains $table) {
        Write-Host "OK: $table"
    }
    else {
        Write-Warning "FALTA: $table"
    }
}

$missing = @(
    $requiredTables |
    Where-Object { $tables -notcontains $_ }
)

if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Warning "Faltan $($missing.Count) tabla(s). No continues con pruebas funcionales hasta corregirlo."
    Write-Host "Tablas faltantes:"
    $missing | ForEach-Object { Write-Host "  - $_" }
    exit 2
}

Write-Host ""
Write-Host "OK: las 3 tablas P2/P3 existen en PostgreSQL."

Write-Host ""
Write-Host "===== RESULTADO ====="
Write-Host "OK: P2/P3 verificado correctamente."
Write-Host ""
Write-Host "Siguiente:"
Write-Host "  cd .\frontend"
Write-Host "  npm.cmd run build"
