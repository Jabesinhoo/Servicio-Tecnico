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

$RequiredV5 = Join-Path $ProjectRoot 'frontend\src\pages\Dashboard\servicios\DeleteServiceModal.jsx'
if (-not (Test-Path $RequiredV5)) {
  Write-Host 'WARNING: V5 marker not found. V6.1 can still install, but it was designed to be applied after V5.' -ForegroundColor Yellow
}

$Files = @(
  'backend\src\controllers\service-order.controller.js',
  'backend\src\controllers\material.controller.js',
  'backend\src\routes\material.routes.js',
  'frontend\src\pages\Dashboard\Servicios.jsx',
  'frontend\src\pages\Dashboard\servicios\DeleteServiceModal.jsx',
  'frontend\src\pages\Dashboard\servicios\ServicioDetail.jsx',
  'frontend\src\pages\Dashboard\servicios\hooks\useServicios.js',
  'frontend\src\pages\Dashboard\servicios\components\MaterialesPanel.jsx'
)

Write-Host '1) Installing V6.1 files...' -ForegroundColor Yellow

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
    Copy-Item $Target "$Target.bak-servicios-v61-$Stamp" -Force
  }

  Copy-Item $Source $Target -Force
  Write-Host "OK  $Relative" -ForegroundColor Green
}

Write-Host ''
Write-Host '2) Patching intake service details...' -ForegroundColor Yellow
node (Join-Path $PackageRoot 'PATCH-V6.cjs') $ProjectRoot
if ($LASTEXITCODE -ne 0) {
  throw 'Intake V6 patch failed.'
}

Write-Host ''
Write-Host '3) Applying materials database migration...' -ForegroundColor Yellow
node (Join-Path $PackageRoot 'APLICAR-BD-V6.cjs') $ProjectRoot
if ($LASTEXITCODE -ne 0) {
  throw 'Materials DB migration failed.'
}

Write-Host ''
Write-Host '4) Checking backend syntax and handlers...' -ForegroundColor Yellow
$Backend = Join-Path $ProjectRoot 'backend'
Push-Location $Backend
try {
  node --check '.\src\controllers\service-order.controller.js'
  if ($LASTEXITCODE -ne 0) { throw 'service-order.controller syntax failed.' }

  node --check '.\src\controllers\material.controller.js'
  if ($LASTEXITCODE -ne 0) { throw 'material.controller syntax failed.' }

  node --check '.\src\routes\material.routes.js'
  if ($LASTEXITCODE -ne 0) { throw 'material.routes syntax failed.' }

  node --check '.\src\controllers\service-intake.controller.js'
  if ($LASTEXITCODE -ne 0) { throw 'service-intake.controller syntax failed.' }

  node -e "const m=require('./src/controllers/material.controller'); const required=['getMaterialesByServicio','solicitarMateriales','aprobarMaterial','rechazarMaterial','entregarMateriales','reportarUso','devolverMaterial','getConsumoTecnico']; const missing=required.filter(k=>typeof m[k]!=='function'); if(missing.length){console.error('Missing material handlers:',missing.join(', '));process.exit(1)} console.log('OK material handlers');"
  if ($LASTEXITCODE -ne 0) { throw 'Material handler check failed.' }
}
finally {
  Pop-Location
}

Write-Host 'OK  Backend checks passed.' -ForegroundColor Green

if ($BuildFrontend) {
  Write-Host ''
  Write-Host '5) Building frontend...' -ForegroundColor Yellow
  $Frontend = Join-Path $ProjectRoot 'frontend'
  Push-Location $Frontend
  try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
      throw 'Frontend build failed.'
    }
  }
  finally {
    Pop-Location
  }
  Write-Host 'OK  Frontend build completed.' -ForegroundColor Green
}

Write-Host ''
Write-Host 'INSTALLATION V6.1 COMPLETED.' -ForegroundColor Green
Write-Host "Backup suffix: .bak-servicios-v61-$Stamp"
Write-Host 'Restart backend/frontend if nodemon or Vite did not reload automatically.'
