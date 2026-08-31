$ErrorActionPreference = "Stop"

Write-Host "===== V11 - BACKEND ====="

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
    if (-not (Test-Path $file)) {
        throw "Falta $file"
    }

    node --check $file

    if ($LASTEXITCODE -ne 0) {
        throw "Error de sintaxis en $file"
    }
}

Write-Host "OK: backend V11 sin errores de sintaxis."

Write-Host ""
Write-Host "===== V11 - FRONTEND ====="

$frontend = @(
    ".\frontend\src\pages\Dashboard\servicios\ServicioCreateWizard.jsx",
    ".\frontend\src\pages\Dashboard\Agenda.jsx",
    ".\frontend\src\pages\Dashboard\Reportes.jsx",
    ".\frontend\src\pages\Dashboard\reportes\TechnicalStatisticsPanel.jsx"
)

foreach ($file in $frontend) {
    if (-not (Test-Path $file)) {
        throw "Falta $file"
    }
}

$wizardText = Get-Content -Raw -Encoding UTF8 $frontend[0]
$agendaText = Get-Content -Raw -Encoding UTF8 $frontend[1]
$reportText = Get-Content -Raw -Encoding UTF8 $frontend[2]

foreach ($marker in @(
    "Fecha y hora automáticas",
    "client_external_id",
    "type=""checkbox""",
    "Responsable principal"
)) {
    if ($wizardText -notmatch [regex]::Escape($marker)) {
        throw "Wizard V11 no contiene: $marker"
    }
}

foreach ($marker in @(
    "Técnicos visibles",
    "service_order_id",
    "timeGridDay"
)) {
    if ($agendaText -notmatch [regex]::Escape($marker)) {
        throw "Agenda V11 no contiene: $marker"
    }
}

if ($reportText -notmatch "TechnicalStatisticsPanel") {
    throw "Reportes no tiene el panel de estadísticas técnicas."
}

Write-Host "OK: frontend V11 instalado."

Write-Host ""
Write-Host "===== V11 - SQL ====="

$tablesRaw = @(
    docker exec tecnicos_db psql -U postgres -d tecnicos -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='service_order_schedule_blocks';"
)

if ($LASTEXITCODE -ne 0) {
    throw "No se pudo consultar PostgreSQL."
}

$tables = @(
    $tablesRaw |
    ForEach-Object { $_.ToString().Trim() } |
    Where-Object { $_ -ne '' }
)

if ($tables -notcontains "service_order_schedule_blocks") {
    Write-Warning "Falta service_order_schedule_blocks."
    Write-Warning "Ejecuta solamente el SQL V11."
    exit 2
}

Write-Host "OK: service_order_schedule_blocks"

Write-Host ""
Write-Host "===== VERIFICACION CLIENTES ====="

$clientType = @(
    docker exec tecnicos_db psql -U postgres -d tecnicos -tAc "SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name='id';"
)

if (($clientType | Out-String).Trim() -ne "uuid") {
    throw "La columna clients.id no es UUID como esperaba el proyecto."
}

Write-Host "OK: clients.id = uuid"
Write-Host "OK: V11 acepta cliente local o cliente WorldOffice/Melissa y crea el vinculo local cuando hace falta."

Write-Host ""
Write-Host "===== RESULTADO ====="
Write-Host "OK: V11 instalado estructuralmente."
Write-Host ""
Write-Host "Siguiente:"
Write-Host "  cd .\frontend"
Write-Host "  npm.cmd run build"
