$ErrorActionPreference = "Stop"

$root = Get-Location
$payload = Join-Path $root "_V7_FILES"

if (-not (Test-Path $payload)) {
    throw "No encuentro _V7_FILES. Ejecuta este script desde la raiz de Servicio-Tecnico despues de extraer el ZIP."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $root "_BACKUPS_V7\$stamp"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

$files = @(
    @{ Relative = "backend\src\controllers\service-order.controller.js" },
    @{ Relative = "backend\src\routes\service-orders.routes.js" },
    @{ Relative = "frontend\src\pages\Dashboard\MisServicios.jsx" }
)

foreach ($item in $files) {
    $relative = $item.Relative
    $source = Join-Path $payload $relative
    $target = Join-Path $root $relative

    if (-not (Test-Path $source)) {
        throw "Falta archivo V7: $source"
    }

    if (Test-Path $target) {
        $backup = Join-Path $backupRoot $relative
        New-Item -ItemType Directory -Path (Split-Path $backup -Parent) -Force | Out-Null
        Copy-Item $target $backup -Force
        Write-Host "Backup: $relative"
    }

    New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
    Copy-Item $source $target -Force
    Write-Host "Actualizado: $relative"
}

# Copiar SQL y ejemplo de variables, sin tocar .env real.
$sqlSource = Join-Path $payload "backend\sql\20260825-service-order-evidence-act-diagnosis.sql"
$sqlTarget = Join-Path $root "backend\sql\20260825-service-order-evidence-act-diagnosis.sql"
Copy-Item $sqlSource $sqlTarget -Force

$envExampleSource = Join-Path $payload "backend\.env.v7-example"
$envExampleTarget = Join-Path $root "backend\.env.v7-example"
Copy-Item $envExampleSource $envExampleTarget -Force

New-Item -ItemType Directory -Path (Join-Path $root "backend\uploads\service-orders") -Force | Out-Null

Write-Host ""
Write-Host "===== VALIDACION DE SINTAXIS BACKEND ====="
node --check (Join-Path $root "backend\src\controllers\service-order.controller.js")
if ($LASTEXITCODE -ne 0) { throw "Error de sintaxis en service-order.controller.js" }
node --check (Join-Path $root "backend\src\routes\service-orders.routes.js")
if ($LASTEXITCODE -ne 0) { throw "Error de sintaxis en service-orders.routes.js" }

Write-Host ""
Write-Host "OK: archivos V7 aplicados."
Write-Host "Backup: $backupRoot"
Write-Host ""
Write-Host "Ahora ejecuta SOLO el SQL V7:"
Write-Host 'Get-Content -Raw .\backend\sql\20260825-service-order-evidence-act-diagnosis.sql | docker exec -i tecnicos_db psql -U postgres -d tecnicos'
Write-Host ""
Write-Host "Luego:"
Write-Host 'powershell -ExecutionPolicy Bypass -File .\VERIFICAR-V7.ps1'
