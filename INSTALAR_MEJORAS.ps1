param(
  [string]$ProjectPath = "C:\Users\USUARIO\Desktop\inventario-app\Servicio-Tecnico"
)
$ErrorActionPreference = 'Stop'
if (!(Test-Path (Join-Path $ProjectPath 'backend\package.json')) -or !(Test-Path (Join-Path $ProjectPath 'frontend\package.json'))) {
  throw "No se encontro el proyecto en $ProjectPath. Usa -ProjectPath con la ruta correcta."
}
$ProjectPath = (Resolve-Path $ProjectPath).Path
$packageFiles = @(
  @{ path = 'backend\scripts\diagnose-worldoffice-connection.js'; hash = 'a727528419708868b641c6d801cd2fb6b876cb8a5da3eb28585ab21c0a3619b0' },
  @{ path = 'backend\scripts\diagnose-worldoffice-invoices.js'; hash = '9e82edee411d61e6cfebd810a6a1699754362fa142cf57ac2f9c42ef03310956' },
  @{ path = 'backend\scripts\install-client-profiles-service-sites.js'; hash = '7db4a1b5fc6c3603b67d720268213b2d74610a785145e13948fb9069686e4a65' },
  @{ path = 'backend\scripts\install-service-activity-signatures.js'; hash = 'e36ba0d7e64ffca83cb2927568db51239cdbbbb0baa0c57a66159b26190502b5' },
  @{ path = 'backend\scripts\install-service-assignment-notifications.js'; hash = 'e8c025c81ec780554cecdbfe013270f6c5c4867b4826fc727a301023f0094d65' },
  @{ path = 'backend\scripts\install-service-creation-v2.js'; hash = '1398b8e55df165e923e2f300815328737534e599f12c813fdff6ba634ec1473d' },
  @{ path = 'backend\scripts\install-workshop-performance.js'; hash = '9f700448f870a393344c4bbf0ce9c3ee223dedf896743e7f3672de4d0cde1dbb' },
  @{ path = 'backend\scripts\sync-client-profiles.js'; hash = '555accfb21e19d88833223ead65c6d2eedbe4e5dbe0d0b7b95173f7799e027ed' },
  @{ path = 'backend\sql\20260902-worldoffice-financial-readonly-v18.sql'; hash = '764bad315b9004a150a6acef4e96fc3823444309eb9dc77c6ae7f798fa403cd5' },
  @{ path = 'backend\sql\20261005-client-profiles-service-sites.sql'; hash = '138c77259d78a499892734efaba17bf6b2eb21d74b8b5011a27a703bb193fdab' },
  @{ path = 'backend\sql\20261005-service-acceptance-evidences.sql'; hash = 'd2ea28ea3fc72326bde670adc9df89b36c0de29fe26c9af92224a4bab52cd7e6' },
  @{ path = 'backend\sql\20261005-service-assignment-notifications.sql'; hash = 'cfb80cc15df9d0bff43b27a843d936d2c6654bdeabaa5109572a27103981fee1' },
  @{ path = 'backend\sql\20261006-service-activity-signatures.sql'; hash = 'f35f4cc8fc992dbd5752320f05416a954794d04388fd8b0f96c894b0ff828ae9' },
  @{ path = 'backend\sql\20261006-workshop-performance.sql'; hash = '194a255c040e3d5ca4d7a1d0b86c60eec32f26b07f9c852132a5cc2190e86653' },
  @{ path = 'backend\sql\20261007-service-creation-v2.sql'; hash = '3110303b8023a3f505701ef9d572f840cc6189e256ce944feb82bfd2e8e09765' },
  @{ path = 'backend\sql\20261008-order-multiple-equipment.sql'; hash = 'a4016cd7b9eb1a42c56de1a5de83f2f49196be31f207703e62fe6ff67eca8b97' },
  @{ path = 'backend\sql\20261008-order-multiple-service-types.sql'; hash = '09c4f14eca14a9c94b0a8faee6ff810c6f395c9eab5a010b0493d493799ce00b' },
  @{ path = 'backend\sql\20261008-service-acceptance-inventory.sql'; hash = '991519e49011a391fbda0b07ae18e525b4c2d8a0c16386930a29d4dc32c14d7c' },
  @{ path = 'backend\sql\20261008-service-type-inventory.sql'; hash = '238dec0bac5e7ea22cd6dbd101b5eac15898977edd1756be82ba417a34f38cc9' },
  @{ path = 'backend\sql\20261008-technician-material-requests.sql'; hash = '89149a9f57d06b89a5105b018192d79dc51790439ddd96f75406cca8995497fa' },
  @{ path = 'backend\sql\20261008-technician-workflow-fixes.sql'; hash = '118055aeca32ee8b28ff74cf790be000fa0e8902ad6254f0abbca2c9d6f598fe' },
  @{ path = 'backend\sql\20261009-workshop-returns-evidence.sql'; hash = '1b692f3590b3c0fc40849e58996053c3e02c718c2f73da55163d06dc9030d623' },
  @{ path = 'backend\src\context\request-actor.js'; hash = '8b7ce2f19bc51e6326d6a85e975e7f81920601263af0b18aff09cc71b584b066' },
  @{ path = 'backend\src\controllers\agenda.controller.js'; hash = '64d0654d3923babee1d5bb377a80cd4c4c3c54d6c5c81ad9069d3ba9529a6d3a' },
  @{ path = 'backend\src\controllers\client.controller.js'; hash = '0f0d6bc63abee8115ff4c60e2af34c73ecc6a4961dd1fdbd7a2911f41910bbe7' },
  @{ path = 'backend\src\controllers\material.controller.js'; hash = '96113189c1360d8d1612bf1d19f85ba3d42c4ef4d7e2dbeeda2edeff4e8ef9f0' },
  @{ path = 'backend\src\controllers\operations-dashboard.controller.js'; hash = 'e8c318314460924d251279bcb3e462087fbe1da6ef1a6fc7f517d95b142a30e9' },
  @{ path = 'backend\src\controllers\product.controller.js'; hash = 'a5c093f8384e56a4be4165d4133495b26964997a23bab2afe0b3771b8924686b' },
  @{ path = 'backend\src\controllers\service-acceptance-evidence.controller.js'; hash = '931f3454fc7dd946200e20698de353933910c3796d91789589eca53fd44780cd' },
  @{ path = 'backend\src\controllers\service-activity.controller.js'; hash = '9bf7bfa9723a4410fe36927d363fb1972875ebdaa016abdc0944e4202affd128' },
  @{ path = 'backend\src\controllers\service-authorization.controller.js'; hash = 'c45c4fefc22179d8724e9686ce2b737d3951650b3ee482d0a84f196b2f22da7d' },
  @{ path = 'backend\src\controllers\service-closure.controller.js'; hash = 'f99c8c8f975cbc33bb337c6154003e2e80c2f880588519d3f544cbf385680e91' },
  @{ path = 'backend\src\controllers\service-creation.controller.js'; hash = '7ce67c33b5d17c5ba979c80bfa0d1b14d1a9b11578ca4985ec44ead5ba92c487' },
  @{ path = 'backend\src\controllers\service-delivery.controller.js'; hash = '4df69f2d362c9b563b2af27899232f0853a484f451db1ae3242e696b1cfd948d' },
  @{ path = 'backend\src\controllers\service-document.controller.js'; hash = '725774894b643f12881a7f91ce2507a4ea0b664ae808651de422e9378695139f' },
  @{ path = 'backend\src\controllers\service-intake.controller.js'; hash = '0764f316eab5ab60d3e018188d4ad5c0558e12619ff27ac2a4292eb46eea7a65' },
  @{ path = 'backend\src\controllers\service-order.controller.js'; hash = '8f237e8b72f5c45127dcdc31a4ec47787d1f8bb7e67081e719d57efa332dccad' },
  @{ path = 'backend\src\controllers\service-team.controller.js'; hash = 'f1cf7e4b6c80eab99b50d92b3cf8b1a10834308f0a6db6a5276a4842e3e91455' },
  @{ path = 'backend\src\controllers\sync.controller.js'; hash = '66231a9dd2652ef130c0f966b1281904289cd2f6325dff964bf77f4fe28ee22f' },
  @{ path = 'backend\src\controllers\tipo-servicio.controller.js'; hash = 'd95985282d4b30702c055d158b3f52da55b4d3ef6e5c28cf28d9b02160da692f' },
  @{ path = 'backend\src\controllers\workshop.controller.js'; hash = '15cf9a98be75b522d8be179c86c67d22f2c513f995837b4a5c9ca8891701173c' },
  @{ path = 'backend\src\db\pool.js'; hash = 'fb4c0fb1028408de6d55fbfc26f057e910acd8bfd117855dbe0b3ac99a31c02d' },
  @{ path = 'backend\src\domain\final-photo-evidence.js'; hash = 'e02eb7469adab17beb9bed10495c3340daa6cfd630acd2df2255a346a9a2d5dc' },
  @{ path = 'backend\src\domain\intake-acceptance.js'; hash = '4ad8cdae70a7075cdcfc22b791d41b0bf194951a4d7481b1bc2d45c9f328ec39' },
  @{ path = 'backend\src\domain\product-images.js'; hash = 'e6118eb127f4d65922136c8f8512f878512dd740bd43653437a698033877399e' },
  @{ path = 'backend\src\domain\service-acceptance-file.js'; hash = '76df18e77bd6392be277ac893071a7a25416bdd03adc2ca5cd36f93372873208' },
  @{ path = 'backend\src\domain\service-delivery-permissions.js'; hash = '2c6a0c5f7b8a84704659fbf4915d2893034741c01194a3f92d0052a3b6108594' },
  @{ path = 'backend\src\domain\service-equipment-intake.js'; hash = 'd8b238187425db007a570b25e9e24242401872c93386163033409cc1710d77ab' },
  @{ path = 'backend\src\domain\service-free-calendar.js'; hash = '00ef170aa111a92c3fe73c416b1367b1fc6a08f4c2c3de24e19a58e6506f32b8' },
  @{ path = 'backend\src\domain\service-site.js'; hash = '147f239e22811bd61bd0b5489691f80d7392fceab8c64a156da3072a673e08ac' },
  @{ path = 'backend\src\domain\service-work-calendar.js'; hash = '8b91c2a789ac2cde3a9f67c5ca5e9790859a8c82fffaf80f2716c6217c17f5b2' },
  @{ path = 'backend\src\domain\technician-work-hours.js'; hash = 'aafe4c17dd3e0a6b1542e360f7b8867a5d2b668d30c7fbff3f37d3d30d25135f' },
  @{ path = 'backend\src\domain\worldoffice-client-profile.js'; hash = '7ca82c519f3eff870991001e854e3f417094c64f850de57280f2cde2bdd72eea' },
  @{ path = 'backend\src\middlewares\auth.middleware.js'; hash = '7fa062d4b1035732d84d020ad071fcc0c9e5f94dae12e6e33bcbca33ae9230b7' },
  @{ path = 'backend\src\routes\client.routes.js'; hash = '439355063a5976b156980a4a973e828bdce9d357a29fa7bb866b4502c643f297' },
  @{ path = 'backend\src\routes\dashboard.routes.js'; hash = 'd733f63a92d1587203427670e074e53bf77ea7ef166bbcf8f4815325f1372f35' },
  @{ path = 'backend\src\routes\material.routes.js'; hash = '59c0b9e808823093db0705e37ad4f3212b6841e8c0a0aa2fa0cb484c0db0e25a' },
  @{ path = 'backend\src\routes\notificaciones.routes.js'; hash = 'cdb15db221a6b8db0e8e98ea3795ec9579c265322f1b5b51a49fc9c06f8f8c23' },
  @{ path = 'backend\src\routes\product.routes.js'; hash = 'df988a13587cabbda6363a4f2c00e0799f75fe1f978046347c6e6d729948829a' },
  @{ path = 'backend\src\routes\service-orders.routes.js'; hash = '59a90b16e55ed8556414bbf0ec5d271c0d8991c8d637e17eff793728bc519fdf' },
  @{ path = 'backend\src\routes\tipo-servicio.routes.js'; hash = '12181820d36e5a496d90ef48d35527658fe1e69eae2cbf45a0ec2536d5d4ffe8' },
  @{ path = 'backend\src\services\client-profile.service.js'; hash = '2dbbb00a1e729f1a0b241043c1a91e11a34d00f158e3e69748608b35df995072' },
  @{ path = 'backend\src\services\client-query.service.js'; hash = 'b77c53f6d129b366bed3374de90fc30244fe8f52eee20c379e109b92c8d7675e' },
  @{ path = 'backend\src\services\client-summary.service.js'; hash = 'eb944cb6bf4fff594db352c4a06f859dc98bc3b4062d22d1ed9057b17e4cf6e1' },
  @{ path = 'backend\src\services\creation-availability.service.js'; hash = '24a87d998bae308adfa9d807baaebbca7ad719c5d3d3f3d1bb110b04eae1b8c8' },
  @{ path = 'backend\src\services\intake-photo-copy.service.js'; hash = '52d7388f9d44a05369c3613e1dec82ee8e72a2f25b45461b8cceb8e83d7c8c84' },
  @{ path = 'backend\src\services\operations-dashboard.service.js'; hash = 'cfb11143a04d55fa18b853d59be1a8906fce3ef2b6b1605650f8ababfcc9916a' },
  @{ path = 'backend\src\services\operations-excel.service.js'; hash = 'a9bd0d094fb36962ccf8becc150efbb31f56eb35121f45a3ff4e9a6ed1018f11' },
  @{ path = 'backend\src\services\order-equipment.service.js'; hash = 'c98481b094d97637f5d64b1531a9a4ad823ea3b8a7fbaf977b31f97b2466dfd1' },
  @{ path = 'backend\src\services\order-service-types.service.js'; hash = 'c4a5a4f462c81f4f8a32955fa81075e474343c2fce6903159d330b62f428d78a' },
  @{ path = 'backend\src\services\repair-missing-schedules.service.js'; hash = 'ad61d4541526bca5d760239a37e12e8edaa14d7ea074cc784434502a781a6b55' },
  @{ path = 'backend\src\services\service-acceptance-inventory.service.js'; hash = '64551f1144225387d170e49efc42830d3549a058e6f0fbef8d63f2f85288f10f' },
  @{ path = 'backend\src\services\service-document-branding.service.js'; hash = '83f136df70d8680835bdd1b731dbcfc4e8e8abe94be17603eff1a6e46ce5fa78' },
  @{ path = 'backend\src\services\service-document-template.service.js'; hash = '1624fa28d50b491e5d7bf0f39648e6da16a0eafdb3a57016312b260a340da479' },
  @{ path = 'backend\src\services\service-execution-time.service.js'; hash = '336cef1c101c04005b2e774c851e2e2ef31d67a26f085549da7083685f1cfd2e' },
  @{ path = 'backend\src\services\service-geocoding.service.js'; hash = 'c3a210cc6c3db2fa73500eef271f0189da63d7360df4d33d06c98844d09c6883' },
  @{ path = 'backend\src\services\service-reactivation.service.js'; hash = '831dc6fc8d8d7f6c8b29aa3382d900cba08b3aa14000561cf434bd84a9e6a076' },
  @{ path = 'backend\src\services\service-scheduling.service.js'; hash = '1157a818b94329a71e0fdf6c5d950d70002c1b69e904eed7e6c1d45972da2c4e' },
  @{ path = 'backend\src\services\service-site.service.js'; hash = '9057f347804e56c382c547cc040417552c8d2c2eed9df2966fe2b84fe9d34af3' },
  @{ path = 'backend\src\services\service-type-inventory.service.js'; hash = '92a746e6ab782ffdd76a3437591235d991e9bba6fc149045fc7b53ec8dbb60da' },
  @{ path = 'backend\src\services\worldoffice-client-extraction.service.js'; hash = 'b6f842ecff55eb83f22c68c9f19a671a578e902708b97945623d55c7992399d8' },
  @{ path = 'backend\src\services\worldoffice-client-mirror.service.js'; hash = '7d5d8239d2dd1c3bb4df91eafa0fd2c1cf957cd0fe4927c3ae5422bb71623cf7' },
  @{ path = 'backend\src\services\worldoffice-connection-config.js'; hash = '8e325742b6773ddf26f65f8813407647ef819aeb8768fe7377a9adf85f6990fe' },
  @{ path = 'backend\src\services\worldoffice-financial-readonly.service.js'; hash = '6b32145fe2b5f965148c9ad2588781534da95b331bc061a34a47a81f1b02b8dc' },
  @{ path = 'backend\src\services\worldoffice-invoices.service.js'; hash = 'f94bfbf50b81529583558191fd928066d0a1eac70ca1b8ddb0b911880db7ee9f' },
  @{ path = 'backend\src\services\worldoffice.service.js'; hash = 'b487bc0ef0f7fa818d467fe4743f360a77ec0841d3211889577336f015e55bd6' },
  @{ path = 'backend\tests\client-profiles-service-sites.test.js'; hash = '0dc8053b85345be551376a9930b3d41ca6febcc92fa81ee5e68d6d84298c2f0f' },
  @{ path = 'backend\tests\final-photo-evidence.test.js'; hash = '81de173e60547a28b185e7601a84fa95633a015d440afacb34a2b2010f692355' },
  @{ path = 'backend\tests\inventory-images-admin-board.test.js'; hash = '93d113554cfbdee673ff75e7f1324b540c93201f96381a53f2e4b524b0a07330' },
  @{ path = 'backend\tests\operations-excel.test.js'; hash = '934ba932a048e5f8e251ee534a52f03852b71ce40c029c6eee081670197a4d5f' },
  @{ path = 'backend\tests\order-service-types.test.js'; hash = '8e8f99ff86279220d2b03ddbf1459601edc4ac0f5cd0f0fbe595ad29fa6e1fd7' },
  @{ path = 'backend\tests\service-acceptance-file.test.js'; hash = '7fe3c26bcc3d8d54e81f9123d69b3d810e3995fde4cd9fdd5e2aca37a861842e' },
  @{ path = 'backend\tests\service-acceptance-inventory.test.js'; hash = 'c9a0e5aa7fd7286c5a9ab66d1e019e211b4cd457ba9b615339d9aabbe13521fa' },
  @{ path = 'backend\tests\service-activity-branding.test.js'; hash = '8130ede5140753767ca13e7db9c82fcb87dd7c370a2851bb23ff4de1cb2bb261' },
  @{ path = 'backend\tests\service-approval-agenda.test.js'; hash = 'f8d3edbe02c25827d281276be1afe161547fd00ef9441a3e9d882606861483b5' },
  @{ path = 'backend\tests\service-creation-v2.test.js'; hash = '5b4dbe0c2c9fb1e72ac9476fac4334e6c84a402336f0ab0b9ed5c3fba76cdc4f' },
  @{ path = 'backend\tests\service-delivery-permissions.test.js'; hash = '24c72278d9de54a34078b63cc679177177adce537e206783f08e0b257e857a7d' },
  @{ path = 'backend\tests\service-document-access.test.js'; hash = '2315092d9bfa6e2321ae089b97aaf148a909073bc4b9d0af86a83129981fbe4f' },
  @{ path = 'backend\tests\service-document-schema.test.js'; hash = 'd0b1301436c19514f99f3bb39fb717bc2235625583750479d9ae361123c909fb' },
  @{ path = 'backend\tests\service-intake-draft-signing.test.js'; hash = '02a06a617b5677d21b3d6f247ffa4da3f91de3233af8ec00aec4449210594298' },
  @{ path = 'backend\tests\service-invoice-edit.test.js'; hash = 'cec4cb5f49bcd370562181d325d2149d00ad07e0e78e5cd9d342a86650105b26' },
  @{ path = 'backend\tests\service-invoice-optional.test.js'; hash = '5a5bd84a7aa91d68fd68a06baa689a79a95f39397eb536cad22c27c4fdc1f652' },
  @{ path = 'backend\tests\service-multiple-equipment.test.js'; hash = 'bac55fe8db58a1de755c0e18f1b47ca34d1664dfdb4ffce88bc04b498c3d3007' },
  @{ path = 'backend\tests\service-reactivation.test.js'; hash = 'e2e3c18d2126d4d7219bf8473540a7febeea84a9040c699d78bba525f746dfa1' },
  @{ path = 'backend\tests\service-reception-documents.test.js'; hash = '49ed6065cb461c88306613d073ef913b13a61e539b35d06ecd3c93d904c32fc4' },
  @{ path = 'backend\tests\service-simple-completion.test.js'; hash = '20cbc7a73167e09e0bf5a8f7cfff9136d3641b5c42d7df422a7abb50c5e9e551' },
  @{ path = 'backend\tests\service-type-inventory.test.js'; hash = '3d14bfc89b4d6b73bba0d6ca7283a7b639e347f46cf796894376e5190b700243' },
  @{ path = 'backend\tests\service-work-calendar.test.js'; hash = '5dc39764b47b1a04d70e963c32d29c6e1203c2b73ac967f96d8dbc8c8a774d82' },
  @{ path = 'backend\tests\service-work-hours-feedback.test.js'; hash = '4c6050e76919658b5eb5409754bf276efee4ba919dc057fc2ac103514e3990b9' },
  @{ path = 'backend\tests\technician-location-optional.test.js'; hash = '6e88a117340552561d83448bb7555dfdccf86405468e10d2b50c4d62e3df1e84' },
  @{ path = 'backend\tests\technician-material-requests.test.js'; hash = '09b0e1c4966b884857ff18193e5bd3b616bbf1d219a733b67b51e2196f89c645' },
  @{ path = 'backend\tests\workshop-history-evidence.test.js'; hash = 'bca4edfd2176c47728a9004b0ace15178d79128a674ea6d9252b250794240d43' },
  @{ path = 'backend\tests\worldoffice-connection-config.test.js'; hash = '062cc131e0f06a0d4917eeb77f9eb0b7c952d37b9c210d2211d6ea7cf8cd5cfe' },
  @{ path = 'backend\tests\worldoffice-invoices.test.js'; hash = 'bb042a9752a1e51ce1092c5694adabd8313e82496666921ba7450d593c31d49b' },
  @{ path = 'frontend\src\App.jsx'; hash = '5f84309dbef6f5ce061ea5798b1692ea14a2058e4dab5bf132208fc5f3cd5c6c' },
  @{ path = 'frontend\src\components\DashboardLayout.jsx'; hash = '43b2c76e27d5266d7b70db9040aaeb0d7efc683dbd9b6f8ca94b7bfebf29813e' },
  @{ path = 'frontend\src\components\LocationTracker.jsx'; hash = '60415ecc2ac9bb0e4e9917ad7d8048fbdabae56b818a8b80451881c27aaecc34' },
  @{ path = 'frontend\src\components\ThemeToggle.jsx'; hash = 'ae3c2093b205a3f616971404c85ea3d142eca00c6c10851663a8fbf1b315d793' },
  @{ path = 'frontend\src\components\ui\BarcodeScanner.jsx'; hash = '7b4dae986b0ef0d1ac4e527a6219f3b69af35231811570f1a13b2c33becad354' },
  @{ path = 'frontend\src\components\ui\ColorPicker.jsx'; hash = 'cf8fc3bcfc2a6bcff1252f30339f164933c82a7a8a75d69e63e929a53a05b4fb' },
  @{ path = 'frontend\src\components\ui\ConfirmModal.jsx'; hash = '13d44b95e55e7deb8a77dada8c3d43e72a017c6771cf3989797a56cc2bfb2019' },
  @{ path = 'frontend\src\components\ui\IAChat.jsx'; hash = 'ecfc546e8274acb90cffd2f0407b6f98a46ecdcda83053d45c15d712960660f5' },
  @{ path = 'frontend\src\components\ui\IconAction.jsx'; hash = '482d347408aaefbd0ccfa92fd6e8c572bd8ff71632996f62c6a7784bb2f9901a' },
  @{ path = 'frontend\src\components\ui\Modal.jsx'; hash = '843352284560d2904faea86f97ee77cea47197fae1156302f83efbc664eca18c' },
  @{ path = 'frontend\src\components\ui\NotificacionesCampana.jsx'; hash = 'db87bd8e142878e33aa62f234df237f948403453d7c908e227ca00a6e15c3e19' },
  @{ path = 'frontend\src\components\ui\ResponsiveSignaturePad.jsx'; hash = 'c3c6e73792a2aae850c293deac8782e21769d217fe0c10cf1351f58ba90d96d3' },
  @{ path = 'frontend\src\context\NotificacionesContext.jsx'; hash = 'd0bf25e1c7081accf84365d5770a9808a920b5f3f586774e430a75db6504a349' },
  @{ path = 'frontend\src\context\ThemeContext.jsx'; hash = 'e3b9ba0c6c0feb7021f47c1afa0f9c9ef7347a7f8817c412efd05f9a71b283ed' },
  @{ path = 'frontend\src\index.css'; hash = 'fba7a379a0df02f67e8319ebd44b770e7b9a9d1473a5f2740d94c8ff3a1175b3' },
  @{ path = 'frontend\src\pages\Dashboard\Agenda.jsx'; hash = 'c9caa43146c968e2cc8d7aa1f70bbeeb2001bb89506354fa30fa5c517255b25a' },
  @{ path = 'frontend\src\pages\Dashboard\Alquileres\SolicitudDetail.jsx'; hash = '3046af77bbf52810022f02bb83cb3c7f953f7ff7b5c2a8932fb0e1722b3ac93f' },
  @{ path = 'frontend\src\pages\Dashboard\Alquileres\SolicitudList.jsx'; hash = 'c4a8a0c4bb10af3dc7497576dd7eca5383f712acb0bd1b53fd4fb121e1106b0f' },
  @{ path = 'frontend\src\pages\Dashboard\Alquileres\components\ChecklistTecnico.jsx'; hash = '3206a418bb9ccd7d455cdffea4460d0a10b23b6114e10497c75764e4f4121613' },
  @{ path = 'frontend\src\pages\Dashboard\Alquileres\components\ItemCard.jsx'; hash = '27ca86f449c6334e8d4e103589825f4de8b0f5c633dce557e55dfd666d0b9109' },
  @{ path = 'frontend\src\pages\Dashboard\ClienteForm.jsx'; hash = 'd1367ecb6e69f2a8f84d1c6a6ef16dd09430f60af4a741e0bc8df29d6dc7422c' },
  @{ path = 'frontend\src\pages\Dashboard\Clientes.jsx'; hash = '0a33abd664e05d2b4f10723f5a285f156eaab5879cce11e82f467f06c4f8dc75' },
  @{ path = 'frontend\src\pages\Dashboard\Dashboard.jsx'; hash = 'a077d2217f436fe5647ba9793290e53ef779db12506805f9c3f4af43e2a3b4c0' },
  @{ path = 'frontend\src\pages\Dashboard\Facturas.jsx'; hash = '14e1b6c0fe5ce077696ea7d1d9d88506a117afcb6cac047c83fd59f1315bfe50' },
  @{ path = 'frontend\src\pages\Dashboard\Inventarios.jsx'; hash = '7bef50f0416c591b986815ebc072f29514081e748c8c8d6ea8ee0093cfde4eee' },
  @{ path = 'frontend\src\pages\Dashboard\MisServicios.jsx'; hash = '35bb83703358803bc81b2335a4baa70f5a708911cff883297043e46e39a5f67f' },
  @{ path = 'frontend\src\pages\Dashboard\Reportes.jsx'; hash = 'c3533c7ebdbe16e856c32c71ef969a2ab2228185c8de38651a3fbaf9fccc5138' },
  @{ path = 'frontend\src\pages\Dashboard\Servicios.jsx'; hash = '5b5c790d10ef9e833c45ca3caf2226501f718da43bada999c05c76dc20d24e74' },
  @{ path = 'frontend\src\pages\Dashboard\Tecnicos.jsx'; hash = '902be714755b55f176596e3996b48b672282bbdcfee42404c98cc8e98ce34e50' },
  @{ path = 'frontend\src\pages\Dashboard\TiposServicio.jsx'; hash = '96c7e727057800f889bb34c8738faa9c6f2162826218c8532c603b41696e7c8c' },
  @{ path = 'frontend\src\pages\Dashboard\agenda\AgendarModal.jsx'; hash = '4e05e9a9ace5343674ccb40f58b47f4f0644aec43e2aeb61b96f13f7fa03d254' },
  @{ path = 'frontend\src\pages\Dashboard\agenda\DisponibilidadPanel.jsx'; hash = '81f21866194e2fd21a695bc377af47a65618b0b14c99fc2dfd8ace7ac9f44a53' },
  @{ path = 'frontend\src\pages\Dashboard\agenda\HorarioConfigModal.jsx'; hash = 'fe851bcd082e0a07378b45df3c56c8bbccf8442b624fa282d3c3c454f7130d9b' },
  @{ path = 'frontend\src\pages\Dashboard\agenda\bogotaTimeZone.js'; hash = 'e7032efff39207f11f9d228ff40c5b9c4bc83ceb7f2427afa3355bda158e36d5' },
  @{ path = 'frontend\src\pages\Dashboard\clientes\ClienteDetail.jsx'; hash = '35c82bc50b18ac3b81c817fddced683edc8d56abb64c7cbc831c34c52b30ddc8' },
  @{ path = 'frontend\src\pages\Dashboard\clientes\ClienteDetailModal.jsx'; hash = '8bb37afcc2548fe3f5bf840b495f8a78a904fd7304e4611637604f631008acdb' },
  @{ path = 'frontend\src\pages\Dashboard\clientes\components\ClientCard.jsx'; hash = '11c31d3a6c1d5c1546817720f2f205fc937dd93ab3fe214f6ded40807a668ff1' },
  @{ path = 'frontend\src\pages\Dashboard\clientes\components\ClienteFilters.jsx'; hash = 'c3fc377a722bae6107d4b27d92ab214318593ee19ec6f80327bc56837bdfbb9f' },
  @{ path = 'frontend\src\pages\Dashboard\clientes\components\ClienteTable.jsx'; hash = '91d7f03142bd485b6508acc793b2664ada550ff21ab1de99a1aa5d108d028f03' },
  @{ path = 'frontend\src\pages\Dashboard\facturas\FacturaDetail.jsx'; hash = '402bfbe22e4ced6b5d7ac1619fbb2581493f22e1f8f499d3d09830162cf63592' },
  @{ path = 'frontend\src\pages\Dashboard\inventarios\ProductForm.jsx'; hash = '5ea5db7e7c5372cff8ececebba9eeb77e77e89669a25ecb14704d1f812e9fead' },
  @{ path = 'frontend\src\pages\Dashboard\inventarios\WorkshopPanel.jsx'; hash = '82e4eff47945220d5b68873c414fc0dfe44491638e7f68c57b2a406e37552fd5' },
  @{ path = 'frontend\src\pages\Dashboard\inventarios\components\InventoryImage.jsx'; hash = 'e7ba96441d3065730500cdb7cfe40707a49c7b0483eb4950caa17643c5e03843' },
  @{ path = 'frontend\src\pages\Dashboard\inventarios\components\ProductCard.jsx'; hash = '924f19e03c9b4ba4af23e4e516976bd8ca2d1ab3d12ec7661992491e2b2f5f8d' },
  @{ path = 'frontend\src\pages\Dashboard\inventarios\components\ProductDetailModal.jsx'; hash = 'fd81b4d7481464935e9cc943cbb98594894ae3907e2024a0434359d462e71355' },
  @{ path = 'frontend\src\pages\Dashboard\inventarios\components\ProductImageUpload.jsx'; hash = '32395fd9d3e1d26aa87a4460431b4dec232b6521e1bd05f2b3adbac001dcdfc1' },
  @{ path = 'frontend\src\pages\Dashboard\inventarios\inventoryImages.js'; hash = '3775980ad6ec19964cee4b5b3e2e78da3524f327df45b7bd94503e9ec7313a89' },
  @{ path = 'frontend\src\pages\Dashboard\reportes\QualityDashboardPanel.jsx'; hash = '8563d8914568a9b6ca487d5a6b2485ff9ae73fa3de6d681a627b14b9f32d450d' },
  @{ path = 'frontend\src\pages\Dashboard\reportes\TechnicalStatisticsPanel.jsx'; hash = '41ae43643d2858d653bf086379b851ca26753d91b8bad965f1d455ac45cea4fb' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\AssignTechModal.jsx'; hash = 'b116108e7a4de45b21d45aa953a70263feb1306ae660c9847d3fcd1f5a4571de' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\DeleteServiceModal.jsx'; hash = '50880cb7e26fa30cfec4c7f2fbce42a4a586cd155ad70251eac024e4a2a5bf6a' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\ServicioCreateWizard.jsx'; hash = 'b1b59d01205bcd7b139cb727d92bd19d7324a12d46e7dd96dd7e00668c5b3911' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\ServicioDetail.jsx'; hash = 'f64b0d0ad697519de1dad8d9a647d872b46f4af00cbd0d38287fc2097e0c46f9' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\ServicioEditModal.jsx'; hash = '6a641c7481b3998f7a3e3f97ea4bbef650401917e5408f5367fba3aed5f1ac46' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\ServicioFilters.jsx'; hash = 'ed0c9547289c7f6ff1ab49304c0bedfa2198aecd88404a3fca5808c401578a70' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\ServicioForm.jsx'; hash = '17994e5bf972f867c98fd70c277c4980657f579cc97f34f3fe41d1bc45e2a540' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\ServicioTable.jsx'; hash = '20b22671a35023c30255552974a82f30ca2dd343869c7d34b4ccd37a7ca41e5f' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\StatusBadge.jsx'; hash = '2dc1e30aa06ccac6090769c7e99f40ac4d8f410e5cab05280ec8ee5a754aa9ee' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\acceptanceFiles.js'; hash = '008b7ea1685b6b65a90a87b777adb730a21576a8ed741a334e812001b22b32df' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\AcceptanceEvidenceFiles.jsx'; hash = '4d28d36cd4ed883b19b86caef9be05993afb582495528993937cd3a3b878e7f0' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\AddPartModal.jsx'; hash = '7461e5ec276082a1eccb22a9b382ac65af77e2ca9226504e3cbf44048523d07f' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\AttachmentPreview.jsx'; hash = '95c35ae970c2c3ab968f078168ef84135f5e1c1ef82125103c26dedf71d530cc' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\AuditTimelineModal.jsx'; hash = 'f6c9c8968507f122710be951be71bbddb7b47e31bce01cc3f7969a7f34672a74' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ClientProfilePanel.jsx'; hash = 'd3ad40a47e33e515b562547d255fd1489cfbdafa5ef260d70b4b3da2cb18fd4e' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ClientSignatureHistory.jsx'; hash = '1a743e7cfda9f402589b1887883710cd12c39e2c06a77e8ad1d1a54a243e1290' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\CreationOrderDocuments.jsx'; hash = '5752f50f3ad37432170bceb0fab33bfd2e20ba2a216e524ac0aedb938339e958' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\EquipmentIntakeFields.jsx'; hash = '6663e4f908f50a39f553b838f17bf252886da2e9c156da6c074d735df4278083' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\EquipmentIntakeList.jsx'; hash = '3888d882ac32fb75fba03c5f02bbdaca1a46d66023174176270cfb913df3c3cf' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\FinalDeliveryModal.jsx'; hash = '6211b445af9d7bee8ce9d3dc67564e0bf05c47c614b64af26c77b63e5944e03c' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\FinancialControlModal.jsx'; hash = 'af53f8cc1b814a6d2956ce0a27dc36a40ff44d70b352703dcc6b6076e668efc1' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\IntakeCreationDocuments.jsx'; hash = '6999261c8fcbf3b3b7f7eb6219d55baccaf3bd66db217497f960b490d3986e10' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\IntakeInvoicePicker.jsx'; hash = '0b2aa4f03853b056b126844be2da6e4dde09c21bdd7ca5e0e19d6849712048b3' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\InvoiceRecord.jsx'; hash = 'db0fed44fe8dda09a6f575b191d18ba6708753eb22326014dea9da8c7c3cf1ee' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\MaterialesPanel.jsx'; hash = '59a1e058d96bd171e684ecbb37084c4e8b0bfd6050223fff8bbb3f4f59dfb0df' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceActivityModal.jsx'; hash = '5f51993f07b71f574956307e1364206b4ba192c16e3bf54bcc4835590694d39f' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceCard.jsx'; hash = 'b0bb9789bbfa3bda8ba98e1cd79f7a90b7c6de3575b2adebbfbacc908425640f' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceClientSnapshot.jsx'; hash = '7dcb7d696867bea20797d28f792147bdc71ffdaa8ce184d693c56a9e56ba4018' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceDocumentsModal.jsx'; hash = '133e7f5929ad01d752f6c0c895c71868d585ca8dcfd9dcd9b0309d7fd4d41e0f' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceIntakeBoard.jsx'; hash = '296b24dd240cbcbb21bd6d6d4468c9c9fe758b2397ea3acd6cdbc2fbb6a67c67' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceInventoryRequirements.jsx'; hash = 'da3f406d6412e811fb3fe0dd6c452b25b12f80e4326773773ffc8a5548596e99' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceSiteFields.jsx'; hash = '4296ca083c448d1479cf0af5b5efd2cbf07c41bea1368311e5c420862c1e175c' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceSiteModal.jsx'; hash = '213a295b86c5a05e6d2a83ed805e1366e235e06b7541cac0c417879ae7563f3c' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\ServiceTypePicker.jsx'; hash = '8a9cf5be1d9fcad7c24ecc7b1b6703e18d39cdadda404af0883a6fa64802b378' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\components\WorldOfficeDiscoveryModal.jsx'; hash = '30ea126a597df942096eea08123f92740b1a67be0e476d6a919274f526096625' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\hooks\useServicios.js'; hash = 'f5c1f2d12979b9b4a0650685746bc72fc8fbe6541c4ec614906398c35b73e735' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\intakeCreationFiles.js'; hash = '792c7bdfca822551037b338190765555e8e3d5d13814d5eff7d6f5db149376b8' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\serviceFormatters.js'; hash = '48d03afac6b0a9621149c22c1da6091f5d8ead1a41c0bcb9e99f95fd37bc5178' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\serviceLocation.js'; hash = 'b8752e000163f3bbf5572d05c485cd8bc09c31935c4ae53e8bd12829250f3836' },
  @{ path = 'frontend\src\pages\Dashboard\servicios\serviceTypeSelection.js'; hash = '1701e46817dea693ef470f2ecb302449d7ab8de101687a73b412bb340ef504a9' },
  @{ path = 'frontend\src\pages\Dashboard\tecnicos\components\TecnicoFilters.jsx'; hash = '029907372009d49dabedfb1e6f357c9fe19bc07c9f5b45ae0d12aaea2e1fb6d7' },
  @{ path = 'frontend\src\pages\Dashboard\tecnicos\components\TecnicoTable.jsx'; hash = '142766d4cfd1109c14b264b20c3bbe7fd18df5de0aa4b46230c05af2c4807b61' },
  @{ path = 'frontend\src\pages\Dashboard\tipos-servicio\TipoServicioForm.jsx'; hash = '871c81a6d0c496c59bad1b47da2577984e929d96e033e891889c3807046f1179' },
  @{ path = 'frontend\src\pages\Dashboard\usuarios\UsuarioDetailModal.jsx'; hash = 'b3bc7fc24e82fa248062bb750a654de739d5a5ab8f70c8d23da331cddc147d06' },
  @{ path = 'frontend\src\pages\Dashboard\usuarios\components\UsuarioFilters.jsx'; hash = 'f40127d016c178bbfde82179160c68de085a0e8d66216b6c18639dfb479609a1' },
  @{ path = 'frontend\src\pages\RolesManagement.jsx'; hash = 'e838e9a16e3453f7c9468575a6f1c766cb1522f10f78284a67ca7f7ec8d8a8eb' },
  @{ path = 'frontend\src\pages\UserRolesAssignment.jsx'; hash = 'b7b15ac917bbb2d5919ec8eca304a8e355f4e922fa070870a621c17074f9d0e9' }
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
  & node --test tests/service-equipment-intake.test.js tests/service-reception-documents.test.js tests/service-document-access.test.js tests/service-acceptance-file.test.js tests/client-profiles-service-sites.test.js tests/service-activity-branding.test.js tests/service-delivery-permissions.test.js tests/service-work-calendar.test.js tests/operations-excel.test.js tests/service-creation-v2.test.js tests/service-intake-draft-signing.test.js tests/worldoffice-invoices.test.js tests/service-invoice-edit.test.js tests/service-type-inventory.test.js tests/service-acceptance-inventory.test.js tests/service-invoice-optional.test.js tests/order-service-types.test.js tests/service-multiple-equipment.test.js tests/technician-material-requests.test.js tests/technician-location-optional.test.js tests/service-approval-agenda.test.js tests/service-work-hours-feedback.test.js tests/final-photo-evidence.test.js tests/worldoffice-connection-config.test.js tests/service-document-schema.test.js tests/service-simple-completion.test.js tests/workshop-history-evidence.test.js tests/inventory-images-admin-board.test.js tests/service-reactivation.test.js
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
