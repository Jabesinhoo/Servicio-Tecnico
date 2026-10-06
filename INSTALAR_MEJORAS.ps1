param(
  [string]$ProjectPath = "C:\Users\USUARIO\Desktop\inventario-app\Servicio-Tecnico"
)
$ErrorActionPreference = 'Stop'
if (!(Test-Path (Join-Path $ProjectPath 'backend\package.json')) -or !(Test-Path (Join-Path $ProjectPath 'frontend\package.json'))) {
  throw "No se encontro el proyecto en $ProjectPath. Usa -ProjectPath con la ruta correcta."
}
$ProjectPath = (Resolve-Path $ProjectPath).Path
$packageFiles = @(
  @{ path = 'backend\scripts\install-client-profiles-service-sites.js'; hash = '7db4a1b5fc6c3603b67d720268213b2d74610a785145e13948fb9069686e4a65' },
  @{ path = 'backend\scripts\install-service-activity-signatures.js'; hash = 'e36ba0d7e64ffca83cb2927568db51239cdbbbb0baa0c57a66159b26190502b5' },
  @{ path = 'backend\scripts\install-service-assignment-notifications.js'; hash = 'e8c025c81ec780554cecdbfe013270f6c5c4867b4826fc727a301023f0094d65' },
  @{ path = 'backend\scripts\sync-client-profiles.js'; hash = '555accfb21e19d88833223ead65c6d2eedbe4e5dbe0d0b7b95173f7799e027ed' },
  @{ path = 'backend\sql\20261005-client-profiles-service-sites.sql'; hash = '138c77259d78a499892734efaba17bf6b2eb21d74b8b5011a27a703bb193fdab' },
  @{ path = 'backend\sql\20261005-service-acceptance-evidences.sql'; hash = 'd2ea28ea3fc72326bde670adc9df89b36c0de29fe26c9af92224a4bab52cd7e6' },
  @{ path = 'backend\sql\20261005-service-assignment-notifications.sql'; hash = 'cfb80cc15df9d0bff43b27a843d936d2c6654bdeabaa5109572a27103981fee1' },
  @{ path = 'backend\sql\20261006-service-activity-signatures.sql'; hash = 'b7f894bd8bbf0c553c165ea7b7a09807061241b5007a1f080f89e18a3aa5e9b9' },
  @{ path = 'backend\src\context\request-actor.js'; hash = '8b7ce2f19bc51e6326d6a85e975e7f81920601263af0b18aff09cc71b584b066' },
  @{ path = 'backend\src\controllers\client.controller.js'; hash = '686a36c33c0f7478a61f2a8ca4398216cc96fd109966256c65cb629a4df198b0' },
  @{ path = 'backend\src\controllers\service-acceptance-evidence.controller.js'; hash = '931f3454fc7dd946200e20698de353933910c3796d91789589eca53fd44780cd' },
  @{ path = 'backend\src\controllers\service-activity.controller.js'; hash = 'ba13ade0f7ebaae7f6e34d7680f06bc145218189dcb529b537c2f0a63759a5eb' },
  @{ path = 'backend\src\controllers\service-delivery.controller.js'; hash = 'eb83ff4f4f1f634d0f323305b94c377ed7de2d55ee15f3a830b4d9c66b8161bc' },
  @{ path = 'backend\src\controllers\service-document.controller.js'; hash = '809210cc36eb8f04564fffbe6a4e28dc4a3586c97128366409de9250567d7163' },
  @{ path = 'backend\src\controllers\service-intake.controller.js'; hash = 'ab5bdc7d4fe1ac66277f6dd0b3fab1c395daa26560fab227345be7191ea7bf9b' },
  @{ path = 'backend\src\controllers\service-order.controller.js'; hash = 'dc43629e9d1e175f7895ac0acd47ba9b27e345f6221a885a7eb4c895f7f5a6d5' },
  @{ path = 'backend\src\controllers\sync.controller.js'; hash = '66231a9dd2652ef130c0f966b1281904289cd2f6325dff964bf77f4fe28ee22f' },
  @{ path = 'backend\src\db\pool.js'; hash = 'fb4c0fb1028408de6d55fbfc26f057e910acd8bfd117855dbe0b3ac99a31c02d' },
  @{ path = 'backend\src\domain\service-acceptance-file.js'; hash = '76df18e77bd6392be277ac893071a7a25416bdd03adc2ca5cd36f93372873208' },
  @{ path = 'backend\src\domain\service-delivery-permissions.js'; hash = '320f4d95664bf35c89c587248b3309e986f742b4d7337e5096c51bb845509dc0' },
  @{ path = 'backend\src\domain\service-site.js'; hash = 'd241156b511aee830d213beb94f30cdbd9e158853c7a6b16835632e207e6c8ea' },
  @{ path = 'backend\src\domain\worldoffice-client-profile.js'; hash = '2824c1c65ce92c06c1c94f05d90950d0b3c9f3d224edf50437e3043a2851467e' },
  @{ path = 'backend\src\middlewares\auth.middleware.js'; hash = '7fa062d4b1035732d84d020ad071fcc0c9e5f94dae12e6e33bcbca33ae9230b7' },
  @{ path = 'backend\src\routes\client.routes.js'; hash = 'a5dfdb3e21184bb2668af13444e817a199a7b3928c18dc1463cd43bcb2851533' },
  @{ path = 'backend\src\routes\notificaciones.routes.js'; hash = 'cdb15db221a6b8db0e8e98ea3795ec9579c265322f1b5b51a49fc9c06f8f8c23' },
  @{ path = 'backend\src\routes\service-orders.routes.js'; hash = '9b7b60055602370b1cc89821d65f340a2e415f2c3e3a1cb879f3c8f4129bd12d' },
  @{ path = 'backend\src\services\client-profile.service.js'; hash = '942c8b4883471395d628565b3d6cb40cd23f868fdbd1c32f5ed8a30139534617' },
  @{ path = 'backend\src\services\client-query.service.js'; hash = '29adb909a35210e83509e980b816ac4d8a1c045adb65dfe971ba678ed093ab95' },
  @{ path = 'backend\src\services\service-document-branding.service.js'; hash = 'e83f22029d25c7b5e7b0652fa76051f95a1d96f367db8d15dd278311331c7098' },
  @{ path = 'backend\src\services\service-document-template.service.js'; hash = '145db75b35e995c5bd3b31d36b499f3cd27546389649a1eb0080c31c70d621c2' },
  @{ path = 'backend\src\services\service-site.service.js'; hash = '2295f60a17ba9eb314db534a19c9a689347ca4d090a58f7f6b1b4a8c1e749a7f' },
  @{ path = 'backend\src\services\worldoffice-client-extraction.service.js'; hash = 'b6f842ecff55eb83f22c68c9f19a671a578e902708b97945623d55c7992399d8' },
  @{ path = 'backend\src\services\worldoffice-client-mirror.service.js'; hash = '7d5d8239d2dd1c3bb4df91eafa0fd2c1cf957cd0fe4927c3ae5422bb71623cf7' },
  @{ path = 'backend\src\services\worldoffice.service.js'; hash = '5c99767530d57e680a3fd494a56b6ac28232f93d3fc8a499c9275a76b102ee2d' },
  @{ path = 'backend\tests\client-profiles-service-sites.test.js'; hash = '0dc8053b85345be551376a9930b3d41ca6febcc92fa81ee5e68d6d84298c2f0f' },
  @{ path = 'backend\tests\service-acceptance-file.test.js'; hash = '7fe3c26bcc3d8d54e81f9123d69b3d810e3995fde4cd9fdd5e2aca37a861842e' },
  @{ path = 'backend\tests\service-activity-branding.test.js'; hash = '8130ede5140753767ca13e7db9c82fcb87dd7c370a2851bb23ff4de1cb2bb261' },
  @{ path = 'backend\tests\service-delivery-permissions.test.js'; hash = '81ce4aa7411a2552247b4efec83e634660c9971d0b9985f6ffdccd11b9f00ba5' },
  @{ path = 'backend\tests\service-document-access.test.js'; hash = '2315092d9bfa6e2321ae089b97aaf148a909073bc4b9d0af86a83129981fbe4f' },
  @{ path = 'frontend\src\components\LocationTracker.jsx'; hash = '353d9476b8c563696baafb6f481eb48ee1ecb4b4ebff7e4733bcbe11bb7d4c31' },
  @{ path = 'frontend\src\components\ui\NotificacionesCampana.jsx'; hash = 'd7bbd99bfe07d1b1423c29f7e93233c0dd284a81ebb4495bef016ce9e8be0749' },
  @{ path = 'frontend\src\components\ui\ResponsiveSignaturePad.jsx'; hash = '02b1bd95bfd65deb5369ba47152f92f1269662ba80b63b4325c06c0a0fc0cd22' },
  @{ path = 'frontend\src\context\NotificacionesContext.jsx'; hash = 'd0bf25e1c7081accf84365d5770a9808a920b5f3f586774e430a75db6504a349' },
  @{ path = 'frontend\src\context\ThemeContext.jsx'; hash = 'e3b9ba0c6c0feb7021f47c1afa0f9c9ef7347a7f8817c412efd05f9a71b283ed' },
  @{ path = 'frontend\src\index.css'; hash = 'ab3976366dd8b0c03d25ecb062ab6f3f1a932820a91541de3e0454be852884fb' },
  @{ path = 'frontend\src\pages\Dashboard\Agenda.jsx'; hash = '1db0657bc1aecb695fa8c5b2c1e3d6a83b88b13b73d442bc363d31d5b5647b06' },
  @{ path = 'frontend\src\pages\Dashboard\Clientes.jsx'; hash = 'eb3eb5b82dbb10c4a66fc51a847fd2b77db747fe11505039d1aa33fc84d074b0' },
  @{ path = 'frontend\src\pages\Dashboard\MisServicios.jsx'; hash = '5f72e12740efc9eb830ebcda1f4bf1385ac22d0ccd5ae52033a55b610c0a8d38' },
  @{ path = 'frontend\src\pages\Dashboard\Servicios.jsx'; hash = 'a4038757b18bef148b6faee89761d716bece260ae1268de4c6ee41e12d89da07' },
  @{ path = 'frontend\src\pages\Dashboard\agenda\AgendarModal.jsx'; hash = 'd97ebd4535359dc1ad949620623cb4409a5afb1f087a251333eb4eadc95da40d' },
  @{ path = 'frontend\src\pages\Dashboard\agenda\DisponibilidadPanel.jsx'; hash = 'c18c3d9f8b8a27b824ca584ff21ecc4399c96bade70386eb60aaeb7a737d6f85' },
  @{ path = 'frontend\src\pages\Dashboard\agenda\HorarioConfigModal.jsx'; hash = '180cf5a511159166d5d9eeeb7dcb0df25fb11359e7db4a18093decae929b92da' },
  @{ path = 'frontend\src\pages\Dashboard\clientes\ClienteDetail.jsx'; hash = '69931f3a1f51bdaebbe660b227bc56e709a3bf3de4e1967c2ef93442dfd72f00' },
  @{ path = 'frontend\src\pages\Dashboard\clientes\ClienteDetailModal.jsx'; hash = 'a87eaa1f8af1e6e030e8de1c3475b8c5011c556429d836e449abee0d263b65c5' },
  @{ path = 'frontend\src\pages\Dashboard\clientes\components\ClientCard.jsx'; hash = '11c31d3a6c1d5c1546817720f2f205fc937dd93ab3fe214f6ded40807a668ff1' },
  @{ path = 'frontend\src\pages\Dashboard\clientes\components\ClienteFilters.jsx'; hash = 'c3fc377a722bae6107d4b27d92ab214318593ee19ec6f80327bc56837bdfbb9f' },
  @{ path = 'frontend\src\pages\Dashboard\clientes\components\ClienteTable.jsx'; hash = 'b3689c4e686e694826363258c4473c8e9166402c58be851ad406af069507a145' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\AssignTechModal.jsx'; hash = '2db7c099c3a4624a517afbf21d93c29341e4117ce524930d914c730a393a489e' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\DeleteServiceModal.jsx'; hash = '50880cb7e26fa30cfec4c7f2fbce42a4a586cd155ad70251eac024e4a2a5bf6a' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\ServicioCreateWizard.jsx'; hash = '5b67154d7dc9d367473dbf13ac0045dc2a55267204547024063310ffa679fcc9' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\ServicioDetail.jsx'; hash = '552bf81e83a63abd7faf12dbb43dbf305623bae79ca851abed1131905a9c68bd' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\ServicioEditModal.jsx'; hash = 'ddb2984030e7a64e14e6aec9c7b8084ab217fc0ee12ddde09e23b40abb6c6f2d' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\ServicioFilters.jsx'; hash = 'ed0c9547289c7f6ff1ab49304c0bedfa2198aecd88404a3fca5808c401578a70' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\ServicioForm.jsx'; hash = 'a891749c2f81d279914dc91f6fdc4b130205699ccf21d117fd3d979f6d5c7e8f' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\ServicioTable.jsx'; hash = '32bff4bb094bb36f4bf30790fd46009d7c4c9a0cdcbeb6e7e976bde9471405fd' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\StatusBadge.jsx'; hash = '2dc1e30aa06ccac6090769c7e99f40ac4d8f410e5cab05280ec8ee5a754aa9ee' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\AcceptanceEvidenceFiles.jsx'; hash = '7a7b9c2b7d2f84f18d067729a920896d41a230ef1b52f9b1e41b9538930784bd' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\AddPartModal.jsx'; hash = '7461e5ec276082a1eccb22a9b382ac65af77e2ca9226504e3cbf44048523d07f' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\AuditTimelineModal.jsx'; hash = 'f6c9c8968507f122710be951be71bbddb7b47e31bce01cc3f7969a7f34672a74' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ClientProfilePanel.jsx'; hash = 'f0dd00a5c4e46d980c677b704ec1c6ed29af5699ec4488b26ca04bf1b30664b5' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ClientSignatureHistory.jsx'; hash = '1a743e7cfda9f402589b1887883710cd12c39e2c06a77e8ad1d1a54a243e1290' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\EquipmentIntakeFields.jsx'; hash = 'a976324e8a3a1ba4e738e7e4b3e54f7177053c3a0c6cc7bc2635b8ed0625bed4' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\FinalDeliveryModal.jsx'; hash = '84da411adeb495b5028fc473533c7962d14d2682693ba4e4f2e631c0b911b21d' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\FinancialControlModal.jsx'; hash = 'f6c24a405c26fa52927da5fd4c38ed6f32e0eb077fd90fcd58cc06beff06fb97' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\MaterialesPanel.jsx'; hash = 'e9ef200bbd23c49a2aaeb2e59a2e2fb92f20b4fdb84452fb566918c6f6859f6c' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceActivityModal.jsx'; hash = 'e6c42b1f188c1d2462ed4ceb4f3f17bfe2023db866b09c33389a1f133d367d2a' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceCard.jsx'; hash = '59de494e0422df52bed27edb560f4efa1822747773c81801530a52ed732698a7' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceClientSnapshot.jsx'; hash = '7dcb7d696867bea20797d28f792147bdc71ffdaa8ce184d693c56a9e56ba4018' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceDocumentsModal.jsx'; hash = '14813931ec2ef03ef4a5f9e7964af4384a0b8921dc8d287e4d64df28caced546' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceIntakeBoard.jsx'; hash = 'bcf769662fa5831997920d38cab68ce9bbcb172149120e72adabb4e9eb4b4095' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceSiteFields.jsx'; hash = 'ea1800c7a3d2c24b22120a2cbf744b5b64651ae155eaf3294483ea539fa68a7a' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceSiteModal.jsx'; hash = '213a295b86c5a05e6d2a83ed805e1366e235e06b7541cac0c417879ae7563f3c' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\WorldOfficeDiscoveryModal.jsx'; hash = '30ea126a597df942096eea08123f92740b1a67be0e476d6a919274f526096625' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\serviceLocation.js'; hash = '0c3918886d82163360441ffa84ff16b04cd504726bba11a207a2c3810b5fd64b' }
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
  throw 'Extrae el ZIP completo en una carpeta separada y ejecuta alli INSTALAR_MEJORAS.ps1 para aplicar los archivos. No se copio nada ni se ejecuto SQL.'
}
if ($inPlace) {
  Write-Host 'Los archivos actualizados ya estan en el proyecto. Se omite la copia sobre si mismos.'
} else {
  $backupPath = Join-Path $ProjectPath ("backups\historial-firmas-actas-" + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
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
  & node scripts/install-service-assignment-notifications.js
  if ($LASTEXITCODE -ne 0) { throw 'Fallo la instalacion SQL. Revisa el error antes de iniciar el servidor.' }
  & node scripts/install-client-profiles-service-sites.js
  if ($LASTEXITCODE -ne 0) { throw 'Fallo SQL de clientes/ubicacion. Revisa el error antes de iniciar el servidor.' }
  & node scripts/install-service-activity-signatures.js
  if ($LASTEXITCODE -ne 0) { throw 'Fallo SQL de historial y firmas. No inicies el servidor hasta resolver el error.' }
  & node --test tests/service-equipment-intake.test.js tests/service-reception-documents.test.js tests/service-document-access.test.js tests/service-acceptance-file.test.js tests/client-profiles-service-sites.test.js tests/service-activity-branding.test.js tests/service-delivery-permissions.test.js
  if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas del backend' }
} finally { Pop-Location }
Push-Location (Join-Path $ProjectPath 'frontend')
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Fallo la compilacion del frontend' }
} finally { Pop-Location }
Write-Host 'OK: clientes, colores, agenda, entrega, historial, firmas y actas actualizados. Reinicia backend y frontend.' -ForegroundColor Green
foreach ($logo in @('logot.png','logo3.jpeg')) {
  if (!(Test-Path (Join-Path $ProjectPath ("frontend\src\assets\img\"+$logo)))) {
    Write-Host ("Logo pendiente en frontend/src/assets/img: "+$logo) -ForegroundColor Yellow
  }
}
