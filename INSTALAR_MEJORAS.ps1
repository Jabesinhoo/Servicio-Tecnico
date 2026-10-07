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
  @{ path = 'backend\scripts\install-service-creation-v2.js'; hash = '55379b320073594677e0735ac2bc76215bc20551bc4ce818f9f1625e67c983c6' },
  @{ path = 'backend\scripts\install-workshop-performance.js'; hash = '9f700448f870a393344c4bbf0ce9c3ee223dedf896743e7f3672de4d0cde1dbb' },
  @{ path = 'backend\scripts\sync-client-profiles.js'; hash = '555accfb21e19d88833223ead65c6d2eedbe4e5dbe0d0b7b95173f7799e027ed' },
  @{ path = 'backend\sql\20261005-client-profiles-service-sites.sql'; hash = '138c77259d78a499892734efaba17bf6b2eb21d74b8b5011a27a703bb193fdab' },
  @{ path = 'backend\sql\20261005-service-acceptance-evidences.sql'; hash = 'd2ea28ea3fc72326bde670adc9df89b36c0de29fe26c9af92224a4bab52cd7e6' },
  @{ path = 'backend\sql\20261005-service-assignment-notifications.sql'; hash = 'cfb80cc15df9d0bff43b27a843d936d2c6654bdeabaa5109572a27103981fee1' },
  @{ path = 'backend\sql\20261006-service-activity-signatures.sql'; hash = '14937e8284e6df5a49d65a27249ba9b8657ce57c7d97ab5eb43ce2e503dad0c5' },
  @{ path = 'backend\sql\20261006-workshop-performance.sql'; hash = '194a255c040e3d5ca4d7a1d0b86c60eec32f26b07f9c852132a5cc2190e86653' },
  @{ path = 'backend\sql\20261007-service-creation-v2.sql'; hash = '3110303b8023a3f505701ef9d572f840cc6189e256ce944feb82bfd2e8e09765' },
  @{ path = 'backend\src\context\request-actor.js'; hash = '8b7ce2f19bc51e6326d6a85e975e7f81920601263af0b18aff09cc71b584b066' },
  @{ path = 'backend\src\controllers\agenda.controller.js'; hash = 'bd3d8aab074e2b93716822fdcaaf9774b5a61c3e42733cd7fa0ab882637ee5d0' },
  @{ path = 'backend\src\controllers\client.controller.js'; hash = '0f0d6bc63abee8115ff4c60e2af34c73ecc6a4961dd1fdbd7a2911f41910bbe7' },
  @{ path = 'backend\src\controllers\operations-dashboard.controller.js'; hash = 'e8c318314460924d251279bcb3e462087fbe1da6ef1a6fc7f517d95b142a30e9' },
  @{ path = 'backend\src\controllers\product.controller.js'; hash = 'f76fe59c0e23cfef8829a1cd625cc8f06b7987c7042916c55a330b2ff2d4cb4e' },
  @{ path = 'backend\src\controllers\service-acceptance-evidence.controller.js'; hash = '931f3454fc7dd946200e20698de353933910c3796d91789589eca53fd44780cd' },
  @{ path = 'backend\src\controllers\service-activity.controller.js'; hash = '9bf7bfa9723a4410fe36927d363fb1972875ebdaa016abdc0944e4202affd128' },
  @{ path = 'backend\src\controllers\service-closure.controller.js'; hash = 'fa710a14ed78fea3d1c19db0863bc6ef309ae1028caa5c9b3c7a2ee9aa1bd2f1' },
  @{ path = 'backend\src\controllers\service-creation.controller.js'; hash = '60130424be9a9de04bb8d175f089ec210a3aec2e12a4d86d59f887afcc6c5bbb' },
  @{ path = 'backend\src\controllers\service-delivery.controller.js'; hash = '59e2343d8a7a1a506ced5d44becefedafe2e3f7bc2322a9f0108d1a9d5764d4b' },
  @{ path = 'backend\src\controllers\service-document.controller.js'; hash = '809210cc36eb8f04564fffbe6a4e28dc4a3586c97128366409de9250567d7163' },
  @{ path = 'backend\src\controllers\service-intake.controller.js'; hash = '586a2101f8a6872ebfdf0a2e193a9efc3cf08821bdb9c110f89551b281d821ff' },
  @{ path = 'backend\src\controllers\service-order.controller.js'; hash = 'ebec84bfe261598f5c5f99a9c24b48beee49576a31816dd5bcb813df5b9cb6f9' },
  @{ path = 'backend\src\controllers\service-team.controller.js'; hash = '1193d83c1549721e49c8bfaa14a8f5ee450a71c36d6b98d7e88bae51647a990c' },
  @{ path = 'backend\src\controllers\sync.controller.js'; hash = '66231a9dd2652ef130c0f966b1281904289cd2f6325dff964bf77f4fe28ee22f' },
  @{ path = 'backend\src\controllers\tipo-servicio.controller.js'; hash = 'b98f0c29a6c3af0852a2674a18cedf0df2b56d49a539533c54773e48353d07b8' },
  @{ path = 'backend\src\controllers\workshop.controller.js'; hash = '5045d836edfb2ee050044bba193012de357180d98c39ddc1196357060f25e4fd' },
  @{ path = 'backend\src\db\pool.js'; hash = 'fb4c0fb1028408de6d55fbfc26f057e910acd8bfd117855dbe0b3ac99a31c02d' },
  @{ path = 'backend\src\domain\intake-acceptance.js'; hash = 'e369c77041d1f61b628cf36c19307e8a4ea3ee8ccdc70feb19424fe1e2c100f1' },
  @{ path = 'backend\src\domain\service-acceptance-file.js'; hash = '76df18e77bd6392be277ac893071a7a25416bdd03adc2ca5cd36f93372873208' },
  @{ path = 'backend\src\domain\service-delivery-permissions.js'; hash = 'f2e8b462f3a5e3969f1712656b6aad0787b88b5919b28e41e892c8cb8cbcfddc' },
  @{ path = 'backend\src\domain\service-site.js'; hash = '147f239e22811bd61bd0b5489691f80d7392fceab8c64a156da3072a673e08ac' },
  @{ path = 'backend\src\domain\service-work-calendar.js'; hash = '8b91c2a789ac2cde3a9f67c5ca5e9790859a8c82fffaf80f2716c6217c17f5b2' },
  @{ path = 'backend\src\domain\worldoffice-client-profile.js'; hash = '7ca82c519f3eff870991001e854e3f417094c64f850de57280f2cde2bdd72eea' },
  @{ path = 'backend\src\middlewares\auth.middleware.js'; hash = '7fa062d4b1035732d84d020ad071fcc0c9e5f94dae12e6e33bcbca33ae9230b7' },
  @{ path = 'backend\src\routes\client.routes.js'; hash = '439355063a5976b156980a4a973e828bdce9d357a29fa7bb866b4502c643f297' },
  @{ path = 'backend\src\routes\dashboard.routes.js'; hash = 'd733f63a92d1587203427670e074e53bf77ea7ef166bbcf8f4815325f1372f35' },
  @{ path = 'backend\src\routes\notificaciones.routes.js'; hash = 'cdb15db221a6b8db0e8e98ea3795ec9579c265322f1b5b51a49fc9c06f8f8c23' },
  @{ path = 'backend\src\routes\product.routes.js'; hash = 'd31744bbfe61eaeadc80c58a5b053ab31f3f503dccc23f9ba34ad478cd63eadb' },
  @{ path = 'backend\src\routes\service-orders.routes.js'; hash = 'e638bfe0f9a46d5644433301d49d83a44bc677db20d3462740684e503a4b1a25' },
  @{ path = 'backend\src\services\client-profile.service.js'; hash = '2dbbb00a1e729f1a0b241043c1a91e11a34d00f158e3e69748608b35df995072' },
  @{ path = 'backend\src\services\client-query.service.js'; hash = 'b77c53f6d129b366bed3374de90fc30244fe8f52eee20c379e109b92c8d7675e' },
  @{ path = 'backend\src\services\client-summary.service.js'; hash = 'eb944cb6bf4fff594db352c4a06f859dc98bc3b4062d22d1ed9057b17e4cf6e1' },
  @{ path = 'backend\src\services\creation-availability.service.js'; hash = 'f92734787e7a85d7f409497b98c2e9b24ce491b5cfbf216d0d738044e700942f' },
  @{ path = 'backend\src\services\intake-photo-copy.service.js'; hash = 'caf048abcdf5865b7ddf8e26dc340a7190f3da8049afcfbb1a4bd22c1856daca' },
  @{ path = 'backend\src\services\operations-dashboard.service.js'; hash = 'f63fcdcd14a15dc345ae34757d3c6ede9f7b96d00678d89489de4aefca00ac17' },
  @{ path = 'backend\src\services\operations-excel.service.js'; hash = 'a9bd0d094fb36962ccf8becc150efbb31f56eb35121f45a3ff4e9a6ed1018f11' },
  @{ path = 'backend\src\services\service-document-branding.service.js'; hash = '83f136df70d8680835bdd1b731dbcfc4e8e8abe94be17603eff1a6e46ce5fa78' },
  @{ path = 'backend\src\services\service-document-template.service.js'; hash = '51b8bd3c60ff3e1df9ea96e0f3003abf62ff5318fe3694e8df24d4c4477e2ca2' },
  @{ path = 'backend\src\services\service-execution-time.service.js'; hash = '336cef1c101c04005b2e774c851e2e2ef31d67a26f085549da7083685f1cfd2e' },
  @{ path = 'backend\src\services\service-geocoding.service.js'; hash = 'c3a210cc6c3db2fa73500eef271f0189da63d7360df4d33d06c98844d09c6883' },
  @{ path = 'backend\src\services\service-scheduling.service.js'; hash = '067c228f628293a8e8c69c64c920e00587dd468e0a71559ec92b6e62afd360d9' },
  @{ path = 'backend\src\services\service-site.service.js'; hash = '9057f347804e56c382c547cc040417552c8d2c2eed9df2966fe2b84fe9d34af3' },
  @{ path = 'backend\src\services\worldoffice-client-extraction.service.js'; hash = 'b6f842ecff55eb83f22c68c9f19a671a578e902708b97945623d55c7992399d8' },
  @{ path = 'backend\src\services\worldoffice-client-mirror.service.js'; hash = '7d5d8239d2dd1c3bb4df91eafa0fd2c1cf957cd0fe4927c3ae5422bb71623cf7' },
  @{ path = 'backend\src\services\worldoffice-financial-readonly.service.js'; hash = '6dd3d4100807a6d4952fc6d0ef9eb5705fe528f2a866a24568d842c890aec283' },
  @{ path = 'backend\src\services\worldoffice.service.js'; hash = '5c99767530d57e680a3fd494a56b6ac28232f93d3fc8a499c9275a76b102ee2d' },
  @{ path = 'backend\tests\client-profiles-service-sites.test.js'; hash = '0dc8053b85345be551376a9930b3d41ca6febcc92fa81ee5e68d6d84298c2f0f' },
  @{ path = 'backend\tests\operations-excel.test.js'; hash = '934ba932a048e5f8e251ee534a52f03852b71ce40c029c6eee081670197a4d5f' },
  @{ path = 'backend\tests\service-acceptance-file.test.js'; hash = '7fe3c26bcc3d8d54e81f9123d69b3d810e3995fde4cd9fdd5e2aca37a861842e' },
  @{ path = 'backend\tests\service-activity-branding.test.js'; hash = '8130ede5140753767ca13e7db9c82fcb87dd7c370a2851bb23ff4de1cb2bb261' },
  @{ path = 'backend\tests\service-creation-v2.test.js'; hash = '5b4dbe0c2c9fb1e72ac9476fac4334e6c84a402336f0ab0b9ed5c3fba76cdc4f' },
  @{ path = 'backend\tests\service-delivery-permissions.test.js'; hash = '5f740ff5bc0adc6d10e5d52d2084606fe3ad24f0db03c7313360ec9a3c18bfb9' },
  @{ path = 'backend\tests\service-document-access.test.js'; hash = '2315092d9bfa6e2321ae089b97aaf148a909073bc4b9d0af86a83129981fbe4f' },
  @{ path = 'backend\tests\service-reception-documents.test.js'; hash = '49ed6065cb461c88306613d073ef913b13a61e539b35d06ecd3c93d904c32fc4' },
  @{ path = 'backend\tests\service-work-calendar.test.js'; hash = '5dc39764b47b1a04d70e963c32d29c6e1203c2b73ac967f96d8dbc8c8a774d82' },
  @{ path = 'frontend\src\App.jsx'; hash = '5f84309dbef6f5ce061ea5798b1692ea14a2058e4dab5bf132208fc5f3cd5c6c' },
  @{ path = 'frontend\src\components\DashboardLayout.jsx'; hash = 'f5570ae05709c73db99c948b2f88f65945588405b04597aa604e19d6e4dfffb7' },
  @{ path = 'frontend\src\components\LocationTracker.jsx'; hash = '353d9476b8c563696baafb6f481eb48ee1ecb4b4ebff7e4733bcbe11bb7d4c31' },
  @{ path = 'frontend\src\components\ui\NotificacionesCampana.jsx'; hash = 'd7bbd99bfe07d1b1423c29f7e93233c0dd284a81ebb4495bef016ce9e8be0749' },
  @{ path = 'frontend\src\components\ui\ResponsiveSignaturePad.jsx'; hash = '02b1bd95bfd65deb5369ba47152f92f1269662ba80b63b4325c06c0a0fc0cd22' },
  @{ path = 'frontend\src\context\NotificacionesContext.jsx'; hash = 'd0bf25e1c7081accf84365d5770a9808a920b5f3f586774e430a75db6504a349' },
  @{ path = 'frontend\src\context\ThemeContext.jsx'; hash = 'e3b9ba0c6c0feb7021f47c1afa0f9c9ef7347a7f8817c412efd05f9a71b283ed' },
  @{ path = 'frontend\src\index.css'; hash = 'ab3976366dd8b0c03d25ecb062ab6f3f1a932820a91541de3e0454be852884fb' },
  @{ path = 'frontend\src\pages\Dashboard\Agenda.jsx'; hash = '8112f4ab63687af7b9d2446fbd1f217e39592adae9a212d3255b662abc2782a7' },
  @{ path = 'frontend\src\pages\Dashboard\Clientes.jsx'; hash = '07add6637b110bfb7a69c77aa46700525083ece0144349e445fa2465d4c49b90' },
  @{ path = 'frontend\src\pages\Dashboard\Dashboard.jsx'; hash = 'dff5322ac546b6b491831893a97079d0630912d97758975898f0d01b69a0b080' },
  @{ path = 'frontend\src\pages\Dashboard\Inventarios.jsx'; hash = '2500a5cb6d5102e7af2bca2a8f680391cc252b45b58eb1d7b7c6de70bbe98adf' },
  @{ path = 'frontend\src\pages\Dashboard\MisServicios.jsx'; hash = '0330a09739a2e42693d8b0ab61359a3403d8a5880dec5aaf61ff4f36ae6e560f' },
  @{ path = 'frontend\src\pages\Dashboard\Servicios.jsx'; hash = 'a4038757b18bef148b6faee89761d716bece260ae1268de4c6ee41e12d89da07' },
  @{ path = 'frontend\src\pages\Dashboard\agenda\AgendarModal.jsx'; hash = '4e05e9a9ace5343674ccb40f58b47f4f0644aec43e2aeb61b96f13f7fa03d254' },
  @{ path = 'frontend\src\pages\Dashboard\agenda\DisponibilidadPanel.jsx'; hash = 'c18c3d9f8b8a27b824ca584ff21ecc4399c96bade70386eb60aaeb7a737d6f85' },
  @{ path = 'frontend\src\pages\Dashboard\agenda\HorarioConfigModal.jsx'; hash = '180cf5a511159166d5d9eeeb7dcb0df25fb11359e7db4a18093decae929b92da' },
  @{ path = 'frontend\src\pages\Dashboard\agenda\bogotaTimeZone.js'; hash = 'e7032efff39207f11f9d228ff40c5b9c4bc83ceb7f2427afa3355bda158e36d5' },
  @{ path = 'frontend\src\pages\Dashboard\clientes\ClienteDetail.jsx'; hash = '69931f3a1f51bdaebbe660b227bc56e709a3bf3de4e1967c2ef93442dfd72f00' },
  @{ path = 'frontend\src\pages\Dashboard\clientes\ClienteDetailModal.jsx'; hash = 'a87eaa1f8af1e6e030e8de1c3475b8c5011c556429d836e449abee0d263b65c5' },
  @{ path = 'frontend\src\pages\Dashboard\clientes\components\ClientCard.jsx'; hash = '11c31d3a6c1d5c1546817720f2f205fc937dd93ab3fe214f6ded40807a668ff1' },
  @{ path = 'frontend\src\pages\Dashboard\clientes\components\ClienteFilters.jsx'; hash = 'c3fc377a722bae6107d4b27d92ab214318593ee19ec6f80327bc56837bdfbb9f' },
  @{ path = 'frontend\src\pages\Dashboard\clientes\components\ClienteTable.jsx'; hash = 'b3689c4e686e694826363258c4473c8e9166402c58be851ad406af069507a145' },
  @{ path = 'frontend\src\pages\Dashboard\inventarios\ProductForm.jsx'; hash = 'b0fc21b02ce3321a1b07e8c8e850c7edd56a42806c3be518a1fd2b45d226d824' },
  @{ path = 'frontend\src\pages\Dashboard\inventarios\WorkshopPanel.jsx'; hash = '1fec07c2cf52c79f9ef09c6df4297f72908cfa1d28a2c13a5a388052a47b3e4d' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\AssignTechModal.jsx'; hash = '2db7c099c3a4624a517afbf21d93c29341e4117ce524930d914c730a393a489e' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\DeleteServiceModal.jsx'; hash = '50880cb7e26fa30cfec4c7f2fbce42a4a586cd155ad70251eac024e4a2a5bf6a' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\ServicioCreateWizard.jsx'; hash = '0ec378f0819ab1d6023bdb3ca9a5b0594698f55d8e1608745b2cbb5cf0360554' },
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
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\CreationOrderDocuments.jsx'; hash = 'f2ae0d8f78f244e66cd49443214b92395de792a6b8a4c549f2b69ce223d24783' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\EquipmentIntakeFields.jsx'; hash = '6c5772de225ea25a16345d578b162479e13742529a91602e275ed55983925be4' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\FinalDeliveryModal.jsx'; hash = '8b5a1e3aebdc39e46fdc7f7f6cfcfbd514564f14f45045b32604d94916eed570' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\FinancialControlModal.jsx'; hash = 'f6c24a405c26fa52927da5fd4c38ed6f32e0eb077fd90fcd58cc06beff06fb97' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\IntakeCreationDocuments.jsx'; hash = 'ee468c60659855f0465c90619157f21b41e92fc1c45a1bbccd8b3e8b6a37635f' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\IntakeInvoicePicker.jsx'; hash = 'a1430d347271d348294e6747734a3484d79cf4cea83ef2fd2e0895d6ab8004c1' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\MaterialesPanel.jsx'; hash = '43e648ba0e07402ee5ecad29545d80fc557015ea5b14ba2daecca45877b877e7' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceActivityModal.jsx'; hash = '94e93ab7558e5b33889f2a90a147b189d88dfa9954b282867da9643a26f4cad5' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceCard.jsx'; hash = '59de494e0422df52bed27edb560f4efa1822747773c81801530a52ed732698a7' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceClientSnapshot.jsx'; hash = '7dcb7d696867bea20797d28f792147bdc71ffdaa8ce184d693c56a9e56ba4018' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceDocumentsModal.jsx'; hash = 'fa4cc77eafb734f2e73636b2dfe11200f8f6f7259640cfb8e8a5f624dae15b1c' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceIntakeBoard.jsx'; hash = 'bcf769662fa5831997920d38cab68ce9bbcb172149120e72adabb4e9eb4b4095' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceSiteFields.jsx'; hash = '4296ca083c448d1479cf0af5b5efd2cbf07c41bea1368311e5c420862c1e175c' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceSiteModal.jsx'; hash = '213a295b86c5a05e6d2a83ed805e1366e235e06b7541cac0c417879ae7563f3c' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceTypePicker.jsx'; hash = '97639e89ebbd292212703c152220dd703ad9ca83e1d936eb88132cc203f469a7' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\WorldOfficeDiscoveryModal.jsx'; hash = '30ea126a597df942096eea08123f92740b1a67be0e476d6a919274f526096625' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\intakeCreationFiles.js'; hash = 'c71874202694ec2b0989a37611f92eeb030df9eb02928034eacbc829bd6690d8' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\serviceLocation.js'; hash = 'b8752e000163f3bbf5572d05c485cd8bc09c31935c4ae53e8bd12829250f3836' }
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
  & node scripts/install-workshop-performance.js
  if ($LASTEXITCODE -ne 0) { throw 'Fallo SQL de taller, tiempos y dashboard. No inicies el servidor hasta resolver el error.' }
  & node scripts/install-service-creation-v2.js
  if ($LASTEXITCODE -ne 0) { throw 'Fallo SQL de creación, firmas e inventario. No inicies el servidor hasta resolver el error.' }
  & node --test tests/service-equipment-intake.test.js tests/service-reception-documents.test.js tests/service-document-access.test.js tests/service-acceptance-file.test.js tests/client-profiles-service-sites.test.js tests/service-activity-branding.test.js tests/service-delivery-permissions.test.js tests/service-work-calendar.test.js tests/operations-excel.test.js tests/service-creation-v2.test.js
  if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas del backend' }
} finally { Pop-Location }
Push-Location (Join-Path $ProjectPath 'frontend')
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Fallo la compilacion del frontend' }
} finally { Pop-Location }
Write-Host 'OK: creación, clientes, firmas, adjuntos, inventario, dashboard y actas actualizados. Reinicia backend y frontend.' -ForegroundColor Green
foreach ($logo in @('logot.png','logo3.jpeg')) {
  if (!(Test-Path (Join-Path $ProjectPath ("frontend\src\assets\img\"+$logo)))) {
    Write-Host ("Logo pendiente en frontend/src/assets/img: "+$logo) -ForegroundColor Yellow
  }
}
