param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot,

  [switch]$BuildFrontend
)

$ErrorActionPreference = 'Stop'
$PackageRoot = $PSScriptRoot
$PayloadRoot = Join-Path $PackageRoot 'payload'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

Write-Host "Project: $ProjectRoot" -ForegroundColor Cyan
Write-Host "Package: $PackageRoot" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $ProjectRoot)) {
  throw "Project root does not exist: $ProjectRoot"
}

$Files = @(
  'backend\src\controllers\service-order.controller.js',
  'backend\src\controllers\material.controller.js',
  'backend\src\routes\material.routes.js',
  'backend\src\services\service-scheduling.service.js',
  'frontend\src\pages\Dashboard\Servicios.jsx',
  'frontend\src\pages\Dashboard\servicios\DeleteServiceModal.jsx',
  'frontend\src\pages\Dashboard\servicios\ServicioDetail.jsx',
  'frontend\src\pages\Dashboard\servicios\hooks\useServicios.js',
  'frontend\src\pages\Dashboard\servicios\components\MaterialesPanel.jsx'
)

Write-Host '1) Installing V7 payload...' -ForegroundColor Yellow

foreach ($Relative in $Files) {
  $Source = Join-Path $PayloadRoot $Relative
  $Target = Join-Path $ProjectRoot $Relative

  if (-not (Test-Path $Source)) {
    throw "Missing package file: $Source"
  }

  $TargetDir = Split-Path $Target -Parent
  if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
  }

  if (Test-Path $Target) {
    Copy-Item $Target "$Target.bak-servicios-v7-$Stamp" -Force
  }

  Copy-Item $Source $Target -Force
  Write-Host "OK  $Relative" -ForegroundColor Green
}

Write-Host ''
Write-Host '2) Applying PostgreSQL V7 migration...' -ForegroundColor Yellow
node (Join-Path $PackageRoot 'APLICAR-BD-V7.cjs') $ProjectRoot
if ($LASTEXITCODE -ne 0) { throw 'V7 DB migration failed.' }

Write-Host ''
Write-Host '3) Enabling client change in edit wizard...' -ForegroundColor Yellow
node (Join-Path $PackageRoot 'PATCH-WIZARD-CLIENT-V7.cjs') $ProjectRoot
if ($LASTEXITCODE -ne 0) { throw 'Wizard V7 patch failed.' }

Write-Host ''
Write-Host '4) Checking backend syntax...' -ForegroundColor Yellow
$Backend = Join-Path $ProjectRoot 'backend'
Push-Location $Backend
try {
  $Checks = @(
    '.\src\controllers\service-order.controller.js',
    '.\src\controllers\material.controller.js',
    '.\src\routes\material.routes.js',
    '.\src\services\service-scheduling.service.js',
    '.\src\controllers\service-intake.controller.js'
  )

  foreach ($File in $Checks) {
    node --check $File
    if ($LASTEXITCODE -ne 0) { throw "Syntax check failed: $File" }
  }

  node -e "const c=require('./src/controllers/service-order.controller'); if(typeof c.delete!=='function') process.exit(1); const s=require('./src/services/service-scheduling.service'); if(typeof s.scheduleOrderAutomatically!=='function'||typeof s.rescheduleOrderAt!=='function') process.exit(2); console.log('OK V7 handlers');"
  if ($LASTEXITCODE -ne 0) { throw 'V7 handler export check failed.' }
}
finally {
  Pop-Location
}

if ($BuildFrontend) {
  Write-Host ''
  Write-Host '5) Building frontend...' -ForegroundColor Yellow
  $Frontend = Join-Path $ProjectRoot 'frontend'
  Push-Location $Frontend
  try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
  }
  finally {
    Pop-Location
  }
  Write-Host 'OK frontend build completed.' -ForegroundColor Green
}

Write-Host ''
Write-Host 'INSTALLATION V7 COMPLETED.' -ForegroundColor Green
Write-Host "Backup suffix: .bak-servicios-v7-$Stamp"
Write-Host 'Restart backend/frontend before functional tests.'
