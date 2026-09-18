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
  'frontend\src\pages\Dashboard\Servicios.jsx',
  'frontend\src\pages\Dashboard\servicios\ServicioCreateWizard.jsx',
  'frontend\src\pages\Dashboard\servicios\ServicioDetail.jsx',
  'frontend\src\pages\Dashboard\servicios\DeleteServiceModal.jsx'
)

Write-Host '1) Installing V5 files...' -ForegroundColor Yellow

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
    $Backup = "$Target.bak-servicios-v5-$Stamp"
    Copy-Item $Target $Backup -Force
  }

  Copy-Item $Source $Target -Force
  Write-Host "OK  $Relative" -ForegroundColor Green
}

Write-Host ''
Write-Host '2) Checking backend syntax and handlers...' -ForegroundColor Yellow

$Backend = Join-Path $ProjectRoot 'backend'
Push-Location $Backend
try {
  node --check '.\src\controllers\service-order.controller.js'
  if ($LASTEXITCODE -ne 0) {
    throw 'Backend syntax check failed.'
  }

  node -e "const c=require('./src/controllers/service-order.controller'); const required=['list','getById','update','delete','reject']; const missing=required.filter(k=>typeof c[k]!=='function'); if(missing.length){console.error('Missing handlers:',missing.join(', '));process.exit(1)} console.log('OK handlers:',required.join(', '));"
  if ($LASTEXITCODE -ne 0) {
    throw 'Backend handler check failed.'
  }
}
finally {
  Pop-Location
}

Write-Host 'OK  Backend checks passed.' -ForegroundColor Green

if ($BuildFrontend) {
  Write-Host ''
  Write-Host '3) Building frontend...' -ForegroundColor Yellow
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
Write-Host 'INSTALLATION V5 COMPLETED.' -ForegroundColor Green
Write-Host "Backup suffix: .bak-servicios-v5-$Stamp"
Write-Host 'Restart backend/frontend if nodemon or Vite did not reload automatically.'
