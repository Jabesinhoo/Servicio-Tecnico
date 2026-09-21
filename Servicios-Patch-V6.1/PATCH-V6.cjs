'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = process.argv[2];
if (!projectRoot) {
  console.error('Usage: node PATCH-V6.cjs <ProjectRoot>');
  process.exit(1);
}

const intakePath = path.join(
  projectRoot,
  'backend',
  'src',
  'controllers',
  'service-intake.controller.js'
);

if (!fs.existsSync(intakePath)) {
  throw new Error(`No existe: ${intakePath}`);
}

let text = fs.readFileSync(intakePath, 'utf8');

// Idempotencia: si el bloque V6/V6.1 ya quedó instalado, no vuelve a insertarlo.
if (
  text.includes('V6.1 · Guardar detalle del servicio seleccionado') ||
  text.includes('V6 · Guardar detalle del servicio seleccionado')
) {
  console.log('OK intake: detalle del servicio ya estaba parcheado.');
  process.exit(0);
}

const activateIndex = text.indexOf('exports.activate = async');
if (activateIndex < 0) {
  throw new Error('No encontré exports.activate en service-intake.controller.js.');
}

// Trabajamos únicamente dentro de exports.activate para no confundirnos con
// otras referencias a service_order_services que pueda tener el archivo.
const cancelIndex = text.indexOf('exports.cancel = async', activateIndex);
const activateEnd = cancelIndex >= 0 ? cancelIndex : text.length;
const activateText = text.slice(activateIndex, activateEnd);

if (activateText.includes('INSERT INTO service_order_services')) {
  console.log('OK intake: exports.activate ya inserta service_order_services.');
  process.exit(0);
}

// Ancla estructural estable: el equipo se consulta DESPUÉS de crear la OS.
// Insertamos justo antes de ese paso, sin depender del texto del comentario
// "TEMPORALMENTE DESHABILITADO" ni de CRLF/LF.
const teamLogRelative = activateText.indexOf("console.log('👥 Getting planned team...')");
const plannedTeamRelative = activateText.indexOf('let plannedTeam = []');

let anchorRelative = teamLogRelative >= 0 ? teamLogRelative : plannedTeamRelative;
if (anchorRelative < 0) {
  throw new Error(
    'No encontré el punto estructural anterior a getIntakeTeam dentro de exports.activate. No modifiqué el archivo.'
  );
}

let anchorAbsolute = activateIndex + anchorRelative;

// Si inmediatamente antes del ancla hay comentarios/logs del bloque viejo,
// los quitamos para no dejar el mensaje "skipped" después de habilitarlo.
const prefix = text.slice(activateIndex, anchorAbsolute);
const oldDisabledRegex = /\n[ \t]*\/\/\s*5\.[^\n]*(?:service details|detalle)[^\n]*\n[ \t]*console\.log\([^\n]*(?:skipped|deshabilitad)[^\n]*\);?\s*\n?/i;
const match = prefix.match(oldDisabledRegex);
if (match && typeof match.index === 'number') {
  const matchStart = activateIndex + match.index;
  const matchEnd = matchStart + match[0].length;
  text = text.slice(0, matchStart) + '\n' + text.slice(matchEnd);
  anchorAbsolute -= (matchEnd - matchStart) - 1;
}

const newBlock = `    // 5. V6.1 · Guardar detalle del servicio seleccionado\n    console.log('🧾 Guardando detalle del servicio de la OS...');\n\n    await client.query(\n      \`\n        INSERT INTO service_order_services (\n          service_order_id,\n          tipo_servicio_id,\n          tipo_servicio_nombre,\n          descripcion_problema,\n          observaciones,\n          precio_estimado,\n          equipo_relacionado,\n          requiere_diagnostico,\n          requiere_repuestos,\n          repuestos_necesarios,\n          "createdAt",\n          "updatedAt"\n        )\n        SELECT\n          $1,$2,$3,$4,$5,$6,NULL,$7,FALSE,NULL,NOW(),NOW()\n        WHERE NOT EXISTS (\n          SELECT 1\n          FROM service_order_services\n          WHERE service_order_id = $1\n        )\n      \`,\n      [\n        serviceOrderId,\n        intake.service_type_id && isUuid(intake.service_type_id)\n          ? intake.service_type_id\n          : null,\n        intake.service_type_name || null,\n        intake.request_description || null,\n        intake.scope_text || null,\n        intake.base_value ?? null,\n        intake.classification === 'diagnostic',\n      ]\n    );\n\n    console.log('✅ Detalle del servicio guardado en service_order_services');\n\n`;

const backup = `${intakePath}.bak-servicios-v61-${Date.now()}`;
fs.copyFileSync(intakePath, backup);

text = text.slice(0, anchorAbsolute) + newBlock + text.slice(anchorAbsolute);
fs.writeFileSync(intakePath, text, 'utf8');

console.log('OK intake: service_order_services se guardará al activar una OS.');
console.log('Backup:', backup);
