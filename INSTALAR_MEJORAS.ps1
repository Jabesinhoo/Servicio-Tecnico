param(
  [string]$ProjectPath = "C:\Users\USUARIO\Desktop\inventario-app\Servicio-Tecnico"
)
$ErrorActionPreference = 'Stop'
if (!(Test-Path (Join-Path $ProjectPath 'backend\package.json')) -or !(Test-Path (Join-Path $ProjectPath 'frontend\package.json'))) {
  throw "No se encontro el proyecto en $ProjectPath. Usa -ProjectPath con la ruta correcta."
}
$ProjectPath = (Resolve-Path $ProjectPath).Path
$packageFiles = @(
  @{ path = 'backend\scripts\diagnose-worldoffice-invoices.js'; hash = '9e82edee411d61e6cfebd810a6a1699754362fa142cf57ac2f9c42ef03310956' },
  @{ path = 'backend\scripts\install-client-profiles-service-sites.js'; hash = '7db4a1b5fc6c3603b67d720268213b2d74610a785145e13948fb9069686e4a65' },
  @{ path = 'backend\scripts\install-service-activity-signatures.js'; hash = 'e36ba0d7e64ffca83cb2927568db51239cdbbbb0baa0c57a66159b26190502b5' },
  @{ path = 'backend\scripts\install-service-assignment-notifications.js'; hash = 'e8c025c81ec780554cecdbfe013270f6c5c4867b4826fc727a301023f0094d65' },
  @{ path = 'backend\scripts\install-service-creation-v2.js'; hash = '07063b6d920657bd31dc671e502083a7357ab979a63d90258df6648831da9009' },
  @{ path = 'backend\scripts\install-workshop-performance.js'; hash = '9f700448f870a393344c4bbf0ce9c3ee223dedf896743e7f3672de4d0cde1dbb' },
  @{ path = 'backend\scripts\sync-client-profiles.js'; hash = '555accfb21e19d88833223ead65c6d2eedbe4e5dbe0d0b7b95173f7799e027ed' },
  @{ path = 'backend\sql\20260902-worldoffice-financial-readonly-v18.sql'; hash = '764bad315b9004a150a6acef4e96fc3823444309eb9dc77c6ae7f798fa403cd5' },
  @{ path = 'backend\sql\20261005-client-profiles-service-sites.sql'; hash = '138c77259d78a499892734efaba17bf6b2eb21d74b8b5011a27a703bb193fdab' },
  @{ path = 'backend\sql\20261005-service-acceptance-evidences.sql'; hash = 'd2ea28ea3fc72326bde670adc9df89b36c0de29fe26c9af92224a4bab52cd7e6' },
  @{ path = 'backend\sql\20261005-service-assignment-notifications.sql'; hash = 'cfb80cc15df9d0bff43b27a843d936d2c6654bdeabaa5109572a27103981fee1' },
  @{ path = 'backend\sql\20261006-service-activity-signatures.sql'; hash = '9e2d7a8bd07a2abb31e54e8549b122a952eb4f5ed8dc9e410a6aa611cf8fe5ea' },
  @{ path = 'backend\sql\20261006-workshop-performance.sql'; hash = '194a255c040e3d5ca4d7a1d0b86c60eec32f26b07f9c852132a5cc2190e86653' },
  @{ path = 'backend\sql\20261007-service-creation-v2.sql'; hash = '3110303b8023a3f505701ef9d572f840cc6189e256ce944feb82bfd2e8e09765' },
  @{ path = 'backend\sql\20261008-order-multiple-equipment.sql'; hash = 'a4016cd7b9eb1a42c56de1a5de83f2f49196be31f207703e62fe6ff67eca8b97' },
  @{ path = 'backend\sql\20261008-order-multiple-service-types.sql'; hash = '09c4f14eca14a9c94b0a8faee6ff810c6f395c9eab5a010b0493d493799ce00b' },
  @{ path = 'backend\sql\20261008-service-acceptance-inventory.sql'; hash = '991519e49011a391fbda0b07ae18e525b4c2d8a0c16386930a29d4dc32c14d7c' },
  @{ path = 'backend\sql\20261008-service-type-inventory.sql'; hash = '238dec0bac5e7ea22cd6dbd101b5eac15898977edd1756be82ba417a34f38cc9' },
  @{ path = 'backend\src\context\request-actor.js'; hash = '8b7ce2f19bc51e6326d6a85e975e7f81920601263af0b18aff09cc71b584b066' },
  @{ path = 'backend\src\controllers\agenda.controller.js'; hash = 'bd3d8aab074e2b93716822fdcaaf9774b5a61c3e42733cd7fa0ab882637ee5d0' },
  @{ path = 'backend\src\controllers\client.controller.js'; hash = '0f0d6bc63abee8115ff4c60e2af34c73ecc6a4961dd1fdbd7a2911f41910bbe7' },
  @{ path = 'backend\src\controllers\operations-dashboard.controller.js'; hash = 'e8c318314460924d251279bcb3e462087fbe1da6ef1a6fc7f517d95b142a30e9' },
  @{ path = 'backend\src\controllers\product.controller.js'; hash = '1017e1fa6cfdcf15acdd10faea7c60fad078d439f57ee949e35f0ba825840192' },
  @{ path = 'backend\src\controllers\service-acceptance-evidence.controller.js'; hash = '931f3454fc7dd946200e20698de353933910c3796d91789589eca53fd44780cd' },
  @{ path = 'backend\src\controllers\service-activity.controller.js'; hash = '9bf7bfa9723a4410fe36927d363fb1972875ebdaa016abdc0944e4202affd128' },
  @{ path = 'backend\src\controllers\service-closure.controller.js'; hash = 'fa710a14ed78fea3d1c19db0863bc6ef309ae1028caa5c9b3c7a2ee9aa1bd2f1' },
  @{ path = 'backend\src\controllers\service-creation.controller.js'; hash = '7ce67c33b5d17c5ba979c80bfa0d1b14d1a9b11578ca4985ec44ead5ba92c487' },
  @{ path = 'backend\src\controllers\service-delivery.controller.js'; hash = 'f455308fbcc4e9a0e454339d58a919bd70ec9dda422dd2113b67bf2eddd53ba2' },
  @{ path = 'backend\src\controllers\service-document.controller.js'; hash = 'ba6e90c1d6d1db094b741f57da20799ce00604f686e3505b14aba63f7fac9ae8' },
  @{ path = 'backend\src\controllers\service-intake.controller.js'; hash = '0764f316eab5ab60d3e018188d4ad5c0558e12619ff27ac2a4292eb46eea7a65' },
  @{ path = 'backend\src\controllers\service-order.controller.js'; hash = 'b8d40ac06cd9fb2ea84e83f40fd85ae6a911109a58770575008426447028af64' },
  @{ path = 'backend\src\controllers\service-team.controller.js'; hash = '1193d83c1549721e49c8bfaa14a8f5ee450a71c36d6b98d7e88bae51647a990c' },
  @{ path = 'backend\src\controllers\sync.controller.js'; hash = '66231a9dd2652ef130c0f966b1281904289cd2f6325dff964bf77f4fe28ee22f' },
  @{ path = 'backend\src\controllers\tipo-servicio.controller.js'; hash = 'd95985282d4b30702c055d158b3f52da55b4d3ef6e5c28cf28d9b02160da692f' },
  @{ path = 'backend\src\controllers\workshop.controller.js'; hash = 'a06003f293f23fccf034b198430b865feffecb1d5ed144ce789ff33f07450cf5' },
  @{ path = 'backend\src\db\pool.js'; hash = 'fb4c0fb1028408de6d55fbfc26f057e910acd8bfd117855dbe0b3ac99a31c02d' },
  @{ path = 'backend\src\domain\intake-acceptance.js'; hash = '4ad8cdae70a7075cdcfc22b791d41b0bf194951a4d7481b1bc2d45c9f328ec39' },
  @{ path = 'backend\src\domain\service-acceptance-file.js'; hash = '76df18e77bd6392be277ac893071a7a25416bdd03adc2ca5cd36f93372873208' },
  @{ path = 'backend\src\domain\service-delivery-permissions.js'; hash = 'f2e8b462f3a5e3969f1712656b6aad0787b88b5919b28e41e892c8cb8cbcfddc' },
  @{ path = 'backend\src\domain\service-equipment-intake.js'; hash = 'd8b238187425db007a570b25e9e24242401872c93386163033409cc1710d77ab' },
  @{ path = 'backend\src\domain\service-site.js'; hash = '147f239e22811bd61bd0b5489691f80d7392fceab8c64a156da3072a673e08ac' },
  @{ path = 'backend\src\domain\service-work-calendar.js'; hash = '8b91c2a789ac2cde3a9f67c5ca5e9790859a8c82fffaf80f2716c6217c17f5b2' },
  @{ path = 'backend\src\domain\worldoffice-client-profile.js'; hash = '7ca82c519f3eff870991001e854e3f417094c64f850de57280f2cde2bdd72eea' },
  @{ path = 'backend\src\middlewares\auth.middleware.js'; hash = '7fa062d4b1035732d84d020ad071fcc0c9e5f94dae12e6e33bcbca33ae9230b7' },
  @{ path = 'backend\src\routes\client.routes.js'; hash = '439355063a5976b156980a4a973e828bdce9d357a29fa7bb866b4502c643f297' },
  @{ path = 'backend\src\routes\dashboard.routes.js'; hash = 'd733f63a92d1587203427670e074e53bf77ea7ef166bbcf8f4815325f1372f35' },
  @{ path = 'backend\src\routes\notificaciones.routes.js'; hash = 'cdb15db221a6b8db0e8e98ea3795ec9579c265322f1b5b51a49fc9c06f8f8c23' },
  @{ path = 'backend\src\routes\product.routes.js'; hash = '1aa187874223cd1e000a4051b1c9ee34dd0c19e6054743366878e3852465a345' },
  @{ path = 'backend\src\routes\service-orders.routes.js'; hash = '41df46a66592a7654f623f9bc4041e80d9c95c7b5710c99b3c7daed92ecc665e' },
  @{ path = 'backend\src\routes\tipo-servicio.routes.js'; hash = '12181820d36e5a496d90ef48d35527658fe1e69eae2cbf45a0ec2536d5d4ffe8' },
  @{ path = 'backend\src\services\client-profile.service.js'; hash = '2dbbb00a1e729f1a0b241043c1a91e11a34d00f158e3e69748608b35df995072' },
  @{ path = 'backend\src\services\client-query.service.js'; hash = 'b77c53f6d129b366bed3374de90fc30244fe8f52eee20c379e109b92c8d7675e' },
  @{ path = 'backend\src\services\client-summary.service.js'; hash = 'eb944cb6bf4fff594db352c4a06f859dc98bc3b4062d22d1ed9057b17e4cf6e1' },
  @{ path = 'backend\src\services\creation-availability.service.js'; hash = '2b4f90c0ccc444a83c84782db482ab9c73d78ac39bbc7b1c663029afafd84331' },
  @{ path = 'backend\src\services\intake-photo-copy.service.js'; hash = '52d7388f9d44a05369c3613e1dec82ee8e72a2f25b45461b8cceb8e83d7c8c84' },
  @{ path = 'backend\src\services\operations-dashboard.service.js'; hash = 'cfb11143a04d55fa18b853d59be1a8906fce3ef2b6b1605650f8ababfcc9916a' },
  @{ path = 'backend\src\services\operations-excel.service.js'; hash = 'a9bd0d094fb36962ccf8becc150efbb31f56eb35121f45a3ff4e9a6ed1018f11' },
  @{ path = 'backend\src\services\order-equipment.service.js'; hash = 'c98481b094d97637f5d64b1531a9a4ad823ea3b8a7fbaf977b31f97b2466dfd1' },
  @{ path = 'backend\src\services\order-service-types.service.js'; hash = 'c4a5a4f462c81f4f8a32955fa81075e474343c2fce6903159d330b62f428d78a' },
  @{ path = 'backend\src\services\service-acceptance-inventory.service.js'; hash = '64551f1144225387d170e49efc42830d3549a058e6f0fbef8d63f2f85288f10f' },
  @{ path = 'backend\src\services\service-document-branding.service.js'; hash = '83f136df70d8680835bdd1b731dbcfc4e8e8abe94be17603eff1a6e46ce5fa78' },
  @{ path = 'backend\src\services\service-document-template.service.js'; hash = '1624fa28d50b491e5d7bf0f39648e6da16a0eafdb3a57016312b260a340da479' },
  @{ path = 'backend\src\services\service-execution-time.service.js'; hash = '336cef1c101c04005b2e774c851e2e2ef31d67a26f085549da7083685f1cfd2e' },
  @{ path = 'backend\src\services\service-geocoding.service.js'; hash = 'c3a210cc6c3db2fa73500eef271f0189da63d7360df4d33d06c98844d09c6883' },
  @{ path = 'backend\src\services\service-scheduling.service.js'; hash = '20d557d0900aa77f69d96c916c53628a851c9c328eb11ac8062825c984a296d3' },
  @{ path = 'backend\src\services\service-site.service.js'; hash = '9057f347804e56c382c547cc040417552c8d2c2eed9df2966fe2b84fe9d34af3' },
  @{ path = 'backend\src\services\service-type-inventory.service.js'; hash = '92a746e6ab782ffdd76a3437591235d991e9bba6fc149045fc7b53ec8dbb60da' },
  @{ path = 'backend\src\services\worldoffice-client-extraction.service.js'; hash = 'b6f842ecff55eb83f22c68c9f19a671a578e902708b97945623d55c7992399d8' },
  @{ path = 'backend\src\services\worldoffice-client-mirror.service.js'; hash = '7d5d8239d2dd1c3bb4df91eafa0fd2c1cf957cd0fe4927c3ae5422bb71623cf7' },
  @{ path = 'backend\src\services\worldoffice-financial-readonly.service.js'; hash = '5c47d465fd4215e154825a96b9c9fa6e2e6e803ed1f7cb41ce35d6ad83cc3576' },
  @{ path = 'backend\src\services\worldoffice-invoices.service.js'; hash = 'f94bfbf50b81529583558191fd928066d0a1eac70ca1b8ddb0b911880db7ee9f' },
  @{ path = 'backend\src\services\worldoffice.service.js'; hash = '5c99767530d57e680a3fd494a56b6ac28232f93d3fc8a499c9275a76b102ee2d' },
  @{ path = 'backend\tests\client-profiles-service-sites.test.js'; hash = '0dc8053b85345be551376a9930b3d41ca6febcc92fa81ee5e68d6d84298c2f0f' },
  @{ path = 'backend\tests\operations-excel.test.js'; hash = '934ba932a048e5f8e251ee534a52f03852b71ce40c029c6eee081670197a4d5f' },
  @{ path = 'backend\tests\order-service-types.test.js'; hash = '8e8f99ff86279220d2b03ddbf1459601edc4ac0f5cd0f0fbe595ad29fa6e1fd7' },
  @{ path = 'backend\tests\service-acceptance-file.test.js'; hash = '7fe3c26bcc3d8d54e81f9123d69b3d810e3995fde4cd9fdd5e2aca37a861842e' },
  @{ path = 'backend\tests\service-acceptance-inventory.test.js'; hash = 'c9a0e5aa7fd7286c5a9ab66d1e019e211b4cd457ba9b615339d9aabbe13521fa' },
  @{ path = 'backend\tests\service-activity-branding.test.js'; hash = '8130ede5140753767ca13e7db9c82fcb87dd7c370a2851bb23ff4de1cb2bb261' },
  @{ path = 'backend\tests\service-creation-v2.test.js'; hash = '5b4dbe0c2c9fb1e72ac9476fac4334e6c84a402336f0ab0b9ed5c3fba76cdc4f' },
  @{ path = 'backend\tests\service-delivery-permissions.test.js'; hash = '5f740ff5bc0adc6d10e5d52d2084606fe3ad24f0db03c7313360ec9a3c18bfb9' },
  @{ path = 'backend\tests\service-document-access.test.js'; hash = '2315092d9bfa6e2321ae089b97aaf148a909073bc4b9d0af86a83129981fbe4f' },
  @{ path = 'backend\tests\service-intake-draft-signing.test.js'; hash = '02a06a617b5677d21b3d6f247ffa4da3f91de3233af8ec00aec4449210594298' },
  @{ path = 'backend\tests\service-invoice-edit.test.js'; hash = 'cec4cb5f49bcd370562181d325d2149d00ad07e0e78e5cd9d342a86650105b26' },
  @{ path = 'backend\tests\service-invoice-optional.test.js'; hash = '5a5bd84a7aa91d68fd68a06baa689a79a95f39397eb536cad22c27c4fdc1f652' },
  @{ path = 'backend\tests\service-multiple-equipment.test.js'; hash = 'bac55fe8db58a1de755c0e18f1b47ca34d1664dfdb4ffce88bc04b498c3d3007' },
  @{ path = 'backend\tests\service-reception-documents.test.js'; hash = '49ed6065cb461c88306613d073ef913b13a61e539b35d06ecd3c93d904c32fc4' },
  @{ path = 'backend\tests\service-type-inventory.test.js'; hash = '3d14bfc89b4d6b73bba0d6ca7283a7b639e347f46cf796894376e5190b700243' },
  @{ path = 'backend\tests\service-work-calendar.test.js'; hash = '5dc39764b47b1a04d70e963c32d29c6e1203c2b73ac967f96d8dbc8c8a774d82' },
  @{ path = 'backend\tests\worldoffice-invoices.test.js'; hash = 'bb042a9752a1e51ce1092c5694adabd8313e82496666921ba7450d593c31d49b' },
  @{ path = 'frontend\src\App.jsx'; hash = '5f84309dbef6f5ce061ea5798b1692ea14a2058e4dab5bf132208fc5f3cd5c6c' },
  @{ path = 'frontend\src\components\DashboardLayout.jsx'; hash = 'f5570ae05709c73db99c948b2f88f65945588405b04597aa604e19d6e4dfffb7' },
  @{ path = 'frontend\src\components\LocationTracker.jsx'; hash = '353d9476b8c563696baafb6f481eb48ee1ecb4b4ebff7e4733bcbe11bb7d4c31' },
  @{ path = 'frontend\src\components\ui\NotificacionesCampana.jsx'; hash = 'd7bbd99bfe07d1b1423c29f7e93233c0dd284a81ebb4495bef016ce9e8be0749' },
  @{ path = 'frontend\src\components\ui\ResponsiveSignaturePad.jsx'; hash = 'c3c6e73792a2aae850c293deac8782e21769d217fe0c10cf1351f58ba90d96d3' },
  @{ path = 'frontend\src\context\NotificacionesContext.jsx'; hash = 'd0bf25e1c7081accf84365d5770a9808a920b5f3f586774e430a75db6504a349' },
  @{ path = 'frontend\src\context\ThemeContext.jsx'; hash = 'e3b9ba0c6c0feb7021f47c1afa0f9c9ef7347a7f8817c412efd05f9a71b283ed' },
  @{ path = 'frontend\src\index.css'; hash = 'ab3976366dd8b0c03d25ecb062ab6f3f1a932820a91541de3e0454be852884fb' },
  @{ path = 'frontend\src\pages\Dashboard\Agenda.jsx'; hash = '8112f4ab63687af7b9d2446fbd1f217e39592adae9a212d3255b662abc2782a7' },
  @{ path = 'frontend\src\pages\Dashboard\Clientes.jsx'; hash = '07add6637b110bfb7a69c77aa46700525083ece0144349e445fa2465d4c49b90' },
  @{ path = 'frontend\src\pages\Dashboard\Dashboard.jsx'; hash = 'dff5322ac546b6b491831893a97079d0630912d97758975898f0d01b69a0b080' },
  @{ path = 'frontend\src\pages\Dashboard\Inventarios.jsx'; hash = '2500a5cb6d5102e7af2bca2a8f680391cc252b45b58eb1d7b7c6de70bbe98adf' },
  @{ path = 'frontend\src\pages\Dashboard\MisServicios.jsx'; hash = 'c136fd21b4ac254d14f7dea6021e1578be56830dcdcc9e55d03a1c825c2d4684' },
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
  @{ path = 'frontend\src\pages\Dashboard\inventarios\WorkshopPanel.jsx'; hash = 'cd2b5c8ffd67931d2700050ae9058a4b3106cbd109c0dbf24b353fdce50b7f4d' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\AssignTechModal.jsx'; hash = '2db7c099c3a4624a517afbf21d93c29341e4117ce524930d914c730a393a489e' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\DeleteServiceModal.jsx'; hash = '50880cb7e26fa30cfec4c7f2fbce42a4a586cd155ad70251eac024e4a2a5bf6a' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\ServicioCreateWizard.jsx'; hash = 'dfd95b5a980a1b105ae97f3ae1527516bf3cf645e12903092a3c8fe13f28bba9' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\ServicioDetail.jsx'; hash = '552bf81e83a63abd7faf12dbb43dbf305623bae79ca851abed1131905a9c68bd' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\ServicioEditModal.jsx'; hash = 'ddb2984030e7a64e14e6aec9c7b8084ab217fc0ee12ddde09e23b40abb6c6f2d' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\ServicioFilters.jsx'; hash = 'ed0c9547289c7f6ff1ab49304c0bedfa2198aecd88404a3fca5808c401578a70' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\ServicioForm.jsx'; hash = 'a891749c2f81d279914dc91f6fdc4b130205699ccf21d117fd3d979f6d5c7e8f' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\ServicioTable.jsx'; hash = '32bff4bb094bb36f4bf30790fd46009d7c4c9a0cdcbeb6e7e976bde9471405fd' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\StatusBadge.jsx'; hash = '2dc1e30aa06ccac6090769c7e99f40ac4d8f410e5cab05280ec8ee5a754aa9ee' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\acceptanceFiles.js'; hash = '008b7ea1685b6b65a90a87b777adb730a21576a8ed741a334e812001b22b32df' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\AcceptanceEvidenceFiles.jsx'; hash = '70352f050dcb9bad1a43b0d52a8c44ab60616400ba969987af79ceb977ca3b45' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\AddPartModal.jsx'; hash = '7461e5ec276082a1eccb22a9b382ac65af77e2ca9226504e3cbf44048523d07f' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\AttachmentPreview.jsx'; hash = '1ecebdb47a12a832d7fc58fd62da6254b91ff58cb84c2628fc66d28a0989e75c' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\AuditTimelineModal.jsx'; hash = 'f6c9c8968507f122710be951be71bbddb7b47e31bce01cc3f7969a7f34672a74' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ClientProfilePanel.jsx'; hash = 'f0dd00a5c4e46d980c677b704ec1c6ed29af5699ec4488b26ca04bf1b30664b5' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ClientSignatureHistory.jsx'; hash = '1a743e7cfda9f402589b1887883710cd12c39e2c06a77e8ad1d1a54a243e1290' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\CreationOrderDocuments.jsx'; hash = '5752f50f3ad37432170bceb0fab33bfd2e20ba2a216e524ac0aedb938339e958' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\EquipmentIntakeFields.jsx'; hash = '6663e4f908f50a39f553b838f17bf252886da2e9c156da6c074d735df4278083' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\EquipmentIntakeList.jsx'; hash = 'e3063cbfbce6d0275a5f7e9dea8be3f122fc4b497da76673450850a29c259293' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\FinalDeliveryModal.jsx'; hash = '8b5a1e3aebdc39e46fdc7f7f6cfcfbd514564f14f45045b32604d94916eed570' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\FinancialControlModal.jsx'; hash = 'f6c24a405c26fa52927da5fd4c38ed6f32e0eb077fd90fcd58cc06beff06fb97' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\IntakeCreationDocuments.jsx'; hash = 'f3ab4b7749b4da00a04221494ac633c196aa3cdf46718201fb94a6cc5ba83f74' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\IntakeInvoicePicker.jsx'; hash = '82d0a9b02089d43210e66aef7de587f087b0b3c545737f8b2efb914032318136' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\InvoiceRecord.jsx'; hash = 'db0fed44fe8dda09a6f575b191d18ba6708753eb22326014dea9da8c7c3cf1ee' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\MaterialesPanel.jsx'; hash = '43e648ba0e07402ee5ecad29545d80fc557015ea5b14ba2daecca45877b877e7' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceActivityModal.jsx'; hash = '94e93ab7558e5b33889f2a90a147b189d88dfa9954b282867da9643a26f4cad5' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceCard.jsx'; hash = '59de494e0422df52bed27edb560f4efa1822747773c81801530a52ed732698a7' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceClientSnapshot.jsx'; hash = '7dcb7d696867bea20797d28f792147bdc71ffdaa8ce184d693c56a9e56ba4018' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceDocumentsModal.jsx'; hash = 'fa4cc77eafb734f2e73636b2dfe11200f8f6f7259640cfb8e8a5f624dae15b1c' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceIntakeBoard.jsx'; hash = 'bcf769662fa5831997920d38cab68ce9bbcb172149120e72adabb4e9eb4b4095' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceInventoryRequirements.jsx'; hash = '43294068fae30879adb3d4808e64df775b3b20d11182c23fea121f76aee23b27' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceSiteFields.jsx'; hash = '4296ca083c448d1479cf0af5b5efd2cbf07c41bea1368311e5c420862c1e175c' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceSiteModal.jsx'; hash = '213a295b86c5a05e6d2a83ed805e1366e235e06b7541cac0c417879ae7563f3c' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceTypePicker.jsx'; hash = '0c190eb289ff34c21e045588d9998930ddf0b599410cd7924be4b4c2446022e8' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\WorldOfficeDiscoveryModal.jsx'; hash = '30ea126a597df942096eea08123f92740b1a67be0e476d6a919274f526096625' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\intakeCreationFiles.js'; hash = '792c7bdfca822551037b338190765555e8e3d5d13814d5eff7d6f5db149376b8' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\serviceLocation.js'; hash = 'b8752e000163f3bbf5572d05c485cd8bc09c31935c4ae53e8bd12829250f3836' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\serviceTypeSelection.js'; hash = '1701e46817dea693ef470f2ecb302449d7ab8de101687a73b412bb340ef504a9' },
  @{ path = 'frontend\src\pages\Dashboard\tipos-servicio\TipoServicioForm.jsx'; hash = '871c81a6d0c496c59bad1b47da2577984e929d96e033e891889c3807046f1179' }
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
  & node --test tests/service-equipment-intake.test.js tests/service-reception-documents.test.js tests/service-document-access.test.js tests/service-acceptance-file.test.js tests/client-profiles-service-sites.test.js tests/service-activity-branding.test.js tests/service-delivery-permissions.test.js tests/service-work-calendar.test.js tests/operations-excel.test.js tests/service-creation-v2.test.js tests/service-intake-draft-signing.test.js tests/worldoffice-invoices.test.js tests/service-invoice-edit.test.js tests/service-type-inventory.test.js tests/service-acceptance-inventory.test.js tests/service-invoice-optional.test.js tests/order-service-types.test.js tests/service-multiple-equipment.test.js
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
