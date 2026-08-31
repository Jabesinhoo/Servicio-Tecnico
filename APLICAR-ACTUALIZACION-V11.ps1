$ErrorActionPreference = "Stop"

$root = Get-Location
$payload = Join-Path $root "_V11_FILES"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

if (-not (Test-Path $payload)) {
    throw "No existe _V11_FILES. Extrae el ZIP completo en la raiz del proyecto."
}

$replaceFiles = @(
    "backend\src\controllers\service-intake.controller.js",
    "backend\src\controllers\service-team.controller.js",
    "backend\src\controllers\agenda.controller.js",
    "backend\src\routes\service-orders.routes.js",
    "frontend\src\pages\Dashboard\servicios\ServicioCreateWizard.jsx",
    "frontend\src\pages\Dashboard\Agenda.jsx",
    "frontend\src\pages\Dashboard\Reportes.jsx"
)

$newFiles = @(
    "backend\src\services\service-scheduling.service.js",
    "backend\src\controllers\service-schedule.controller.js",
    "backend\src\controllers\technical-stats.controller.js",
    "frontend\src\pages\Dashboard\reportes\TechnicalStatisticsPanel.jsx",
    "backend\sql\20260828-auto-schedule-stats-v11.sql"
)

foreach ($relative in $replaceFiles) {
    $source = Join-Path $payload $relative
    $destination = Join-Path $root $relative

    if (-not (Test-Path $source)) {
        throw "Falta archivo V11: $source"
    }

    if (Test-Path $destination) {
        Copy-Item $destination "$destination.backup-v11-$stamp" -Force
        Write-Host "Backup: $destination.backup-v11-$stamp"
    }

    New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
    Copy-Item $source $destination -Force
    Write-Host "Actualizado: $relative"
}

foreach ($relative in $newFiles) {
    $source = Join-Path $payload $relative
    $destination = Join-Path $root $relative

    if (-not (Test-Path $source)) {
        throw "Falta archivo V11: $source"
    }

    New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
    Copy-Item $source $destination -Force
    Write-Host "Instalado: $relative"
}

Write-Host ""
Write-Host "Validando backend..."

$checks = @(
    ".\backend\src\controllers\service-intake.controller.js",
    ".\backend\src\controllers\service-team.controller.js",
    ".\backend\src\controllers\agenda.controller.js",
    ".\backend\src\controllers\service-schedule.controller.js",
    ".\backend\src\controllers\technical-stats.controller.js",
    ".\backend\src\services\service-scheduling.service.js",
    ".\backend\src\routes\service-orders.routes.js"
)

foreach ($file in $checks) {
    node --check $file

    if ($LASTEXITCODE -ne 0) {
        throw "Error de sintaxis en $file"
    }
}

Write-Host ""
Write-Host "OK: V11 aplicado."
Write-Host ""
Write-Host "Siguiente:"
Write-Host "  Get-Content -Raw .\backend\sql\20260828-auto-schedule-stats-v11.sql | docker exec -i tecnicos_db psql -U postgres -d tecnicos"
Write-Host "  powershell -ExecutionPolicy Bypass -File .\VERIFICAR-V11.ps1"
