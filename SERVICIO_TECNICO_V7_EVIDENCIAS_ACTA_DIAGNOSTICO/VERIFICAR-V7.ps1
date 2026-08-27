$ErrorActionPreference = "Stop"

Write-Host "===== V7 · BACKEND ====="

$backendFiles = @(
  ".\backend\src\controllers\service-order.controller.js",
  ".\backend\src\routes\service-orders.routes.js",
  ".\backend\src\controllers\user-location.controller.js",
  ".\backend\src\services\ip-reputation.service.js"
)

foreach ($file in $backendFiles) {
  if (-not (Test-Path $file)) { throw "Falta $file" }
  node --check $file
  if ($LASTEXITCODE -ne 0) { throw "Error de sintaxis en $file" }
}

Write-Host "OK: backend sin errores de sintaxis."

Write-Host ""
Write-Host "===== V7 · FRONTEND ====="

$mis = ".\frontend\src\pages\Dashboard\MisServicios.jsx"
if (-not (Test-Path $mis)) { throw "Falta $mis" }

$misText = Get-Content -Raw -Encoding UTF8 $mis
$requiredFrontend = @(
  "Evidencias iniciales",
  "Acta de recibo",
  "Diagnóstico y resultado",
  "reception-act/sign",
  "/diagnosis"
)

foreach ($pattern in $requiredFrontend) {
  if ($misText -notmatch [regex]::Escape($pattern)) {
    throw "MisServicios.jsx no contiene: $pattern"
  }
}

Write-Host "OK: MisServicios contiene evidencias, acta y diagnóstico."

Write-Host ""
Write-Host "===== V7 · SQL ====="

$tablesRaw = @(
  docker exec tecnicos_db psql -U postgres -d tecnicos -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('service_order_evidences','service_order_reception_acts','service_order_diagnostics') ORDER BY table_name;"
)

if ($LASTEXITCODE -ne 0) { throw "No se pudo consultar PostgreSQL en tecnicos_db." }

$tables = @(
  $tablesRaw |
  ForEach-Object { $_.ToString().Trim() } |
  Where-Object { $_ -ne '' }
)

$requiredTables = @(
  'service_order_evidences',
  'service_order_reception_acts',
  'service_order_diagnostics'
)

$missing = @()
foreach ($table in $requiredTables) {
  if ($tables -contains $table) {
    Write-Host "OK: $table"
  } else {
    Write-Warning "FALTA: $table"
    $missing += $table
  }
}

if ($missing.Count -gt 0) {
  Write-Host ""
  Write-Warning "Faltan tablas V7. Ejecuta solamente backend\sql\20260825-service-order-evidence-act-diagnosis.sql"
  exit 2
}

Write-Host ""
Write-Host "===== V7 · ALMACENAMIENTO ====="

$evidenceDir = ".\backend\uploads\service-orders"
New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
$probe = Join-Path $evidenceDir ".write-test"
"ok" | Set-Content -Encoding UTF8 $probe
Remove-Item $probe -Force
Write-Host "OK: carpeta de evidencias escribible: $evidenceDir"

Write-Host ""
Write-Host "===== RESULTADO ====="
Write-Host "OK: V7 instalado estructuralmente."
Write-Host "Siguiente:"
Write-Host "  cd .\frontend"
Write-Host "  npm.cmd run build"
