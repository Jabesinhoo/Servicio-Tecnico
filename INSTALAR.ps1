param(
  [string]$ProjectPath = "C:\Users\USUARIO\Desktop\inventario-app\Servicio-Tecnico"
)
$ErrorActionPreference = 'Stop'
if (!(Test-Path (Join-Path $ProjectPath 'backend\package.json')) -or !(Test-Path (Join-Path $ProjectPath 'frontend\package.json'))) {
  throw "No se encontro el proyecto en $ProjectPath. Usa -ProjectPath con la ruta correcta."
}
$ProjectPath = (Resolve-Path $ProjectPath).Path
$packageFiles = @(
  @{ path = 'backend\Dockerfile'; hash = 'a8f2a6ba6da427c20863995b6c961057cee3cf83e0f7110755fbd3151125f283' },
  @{ path = 'backend\package-lock.json'; hash = 'c4cb7d0460dccdcf298c6520ec342d9c778796a55bbaf4a722e5560624b17ec3' },
  @{ path = 'backend\package.json'; hash = '631f60a38281bd4e12d55a8cb98891a1fc74d1220325e64a4752309772084215' },
  @{ path = 'backend\scripts\install-reception-documents.js'; hash = '66c0044d0caa36d2a456d6705cec5bbc498ad7c64c00183187ab0085793fd383' },
  @{ path = 'backend\sql\20260901-formal-service-documents-v16.sql'; hash = '99f42bcfc0c64bda3bc4b0ca304016928348ccc9784222153617d8f540e6a2bb' },
  @{ path = 'backend\sql\20261005-service-equipment-intake.sql'; hash = '15c707a206dc9c930668b2747a6a9be11029d08efc11373f116ac506fa862553' },
  @{ path = 'backend\src\controllers\service-document.controller.js'; hash = '0b0193973e17092f75831c8e4a6c96f1aacd267a94ad032befda6c05f8d45da6' },
  @{ path = 'backend\src\controllers\service-intake.controller.js'; hash = 'ce6f45f59f25b3be36eb23e72da0c02a873503b18f24961b85c7375a0f624d46' },
  @{ path = 'backend\src\controllers\service-order.controller.js'; hash = '4aa663855c19108cb245105f928c2c029c2c703143f82927dc46e1cf356bb09f' },
  @{ path = 'backend\src\domain\service-document-dispatch.js'; hash = '81423b282427a0cf41d1503843c8cd5d5928c77110f6f9637fbb6b994dcb88f2' },
  @{ path = 'backend\src\domain\service-equipment-intake.js'; hash = '688cdd5cb630b54c07548fe0cc87ac704e7064e1e7254637a3e352e8b3451640' },
  @{ path = 'backend\src\routes\service-orders.routes.js'; hash = '53fb6dc4701a0b0968ebe24e90d687545af692426836e91c23e8051f91de0992' },
  @{ path = 'backend\src\services\service-document-pdf.service.js'; hash = '1bde1bcc308ef66d28b75133e9e3a948b62027d3f5f80cc2343fa9305d2a57db' },
  @{ path = 'backend\src\services\service-document-template.service.js'; hash = '6c60e867d04560f601cc95a30350d911e4f870cbeb120a5ac0843e5569c01358' },
  @{ path = 'backend\src\services\service-reception-media.service.js'; hash = '60e66f82b65f913022ae4994ec6e41e0a9da467d62e8c2ad0671007126b6e348' },
  @{ path = 'backend\src\services\service-scheduling.service.js'; hash = '12aff35c491789b21b00ac2d629f596acf5a31dda3344a2d58414ddc1e7f4ba0' },
  @{ path = 'backend\tests\service-document-access.test.js'; hash = 'f2b42e80c2d68a2a546ef86bc09f7a185222853ce20a8da49782822625a7f08f' },
  @{ path = 'backend\tests\service-equipment-intake.test.js'; hash = '8eabd5d0d78d50a11778cad8560a6665fece84c138bfde790a13b11b54f46ebb' },
  @{ path = 'backend\tests\service-reception-documents.test.js'; hash = '3747e036512b497eee561779aa093face4760066768f9c8ec93d3bf116ea21c1' },
  @{ path = 'frontend\src\App.jsx'; hash = 'd3a653f18505c163a2a0df8b39e6d17c62872c3989ddb3f522f273af0bc913e7' },
  @{ path = 'frontend\src\pages\Dashboard\MisServicios.jsx'; hash = 'f7eff39ac139a61b913049b8c306ed392bdcb8c4bacc601b6028e3b67753850e' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\ServicioCreateWizard.jsx'; hash = '25b45b110c22bfa927750575fb334c181b401910bb555839e955a29be3f52ae6' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\EquipmentIntakeFields.jsx'; hash = 'a976324e8a3a1ba4e738e7e4b3e54f7177053c3a0c6cc7bc2635b8ed0625bed4' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceDocumentsModal.jsx'; hash = '80e71bfb00b93bf150be987f98c92eaf44de6e448d0d3dbabb5cf2b33a05032e' }
)
function Get-NormalizedHash([string]$FilePath) {
  $text = [System.IO.File]::ReadAllText($FilePath, [System.Text.Encoding]::UTF8)
  $text = $text.Replace("`r`n", "`n").Replace("`r", "`n").TrimStart([char]0xFEFF)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
    return [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant()
  } finally { $sha.Dispose() }
}
$sourcePath = (Resolve-Path $PSScriptRoot).Path
$inPlace = [string]::Equals($sourcePath.TrimEnd('\'), $ProjectPath.TrimEnd('\'), [StringComparison]::OrdinalIgnoreCase)
# Verifica solo los archivos del paquete; nunca recorre node_modules o credenciales.
$invalid = @()
foreach ($item in $packageFiles) {
  $sourceFile = Join-Path $sourcePath $item.path
  if (!(Test-Path -LiteralPath $sourceFile -PathType Leaf)) {
    $invalid += "$($item.path) (falta)"
  } elseif ((Get-NormalizedHash $sourceFile) -ne $item.hash) {
    $invalid += "$($item.path) (version diferente)"
  }
}
if ($invalid.Count -gt 0) {
  Write-Host 'Estos archivos no corresponden a la actualizacion:' -ForegroundColor Yellow
  $invalid | ForEach-Object { Write-Host " - $_" }
  throw 'Extrae el ZIP completo en una carpeta separada y ejecuta alli INSTALAR.ps1 para aplicar los archivos. No se copio nada ni se ejecuto SQL.'
}
if ($inPlace) {
  Write-Host 'Los archivos actualizados ya estan en el proyecto. Se omite la copia sobre si mismos.'
} else {
  $backupPath = Join-Path $ProjectPath ("backups\recepcion-" + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
  New-Item -ItemType Directory -Path $backupPath -Force | Out-Null
  $manifest = @()
  # Respalda todos los archivos existentes antes de reemplazar el primero.
  foreach ($item in $packageFiles) {
    $destination = Join-Path $ProjectPath $item.path
    $existed = Test-Path -LiteralPath $destination
    $manifest += [PSCustomObject]@{ path = $item.path; existed = $existed }
    if ($existed) {
      $backupFile = Join-Path $backupPath $item.path
      New-Item -ItemType Directory -Path (Split-Path $backupFile -Parent) -Force | Out-Null
      Copy-Item -LiteralPath $destination -Destination $backupFile -Force
    }
  }
  $manifest | ConvertTo-Json | Set-Content (Join-Path $backupPath 'archivos.json') -Encoding UTF8
  foreach ($item in $packageFiles) {
    $destination = Join-Path $ProjectPath $item.path
    New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $sourcePath $item.path) -Destination $destination -Force
  }
  Write-Host "Respaldo: $backupPath"
}
Push-Location (Join-Path $ProjectPath 'backend')
try {
  & npm.cmd ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Fallo npm ci en backend' }
  & node scripts/install-reception-documents.js
  if ($LASTEXITCODE -ne 0) { throw 'Fallo la instalacion SQL. Revisa el error antes de iniciar el servidor.' }
  & node --test tests/service-equipment-intake.test.js tests/service-reception-documents.test.js tests/service-document-access.test.js
  if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas del backend' }
} finally { Pop-Location }
Push-Location (Join-Path $ProjectPath 'frontend')
try {
  & npm.cmd ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Fallo npm ci en frontend' }
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Fallo la compilacion del frontend' }
} finally { Pop-Location }
Write-Host 'OK: actualizacion instalada. Reinicia backend y frontend con tus comandos habituales.' -ForegroundColor Green
Write-Host 'Prueba una orden existente: checklist, fotos, firma, Generar PDF y Preparar envio.'
