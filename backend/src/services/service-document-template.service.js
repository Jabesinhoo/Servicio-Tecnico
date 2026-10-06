'use strict';

const fs = require('fs');
const path = require('path');
const {normalizeBranding,logoUri}=require('./service-document-branding.service');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function fmtDate(value) {
  if (!value) return '—';

  try {
    return new Intl.DateTimeFormat(
      'es-CO',
      {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone:
          process.env.SERVICE_DOCUMENT_TIMEZONE ||
          'America/Bogota',
      }
    ).format(
      new Date(value)
    );
  } catch (_) {
    return String(value);
  }
}

function money(value) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return '—';
  }

  return new Intl.NumberFormat(
    'es-CO',
    {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }
  ).format(number);
}

function logoDataUri() {
  const explicit =
    String(
      process.env.SERVICE_DOCUMENT_LOGO_PATH ||
        ''
    ).trim();

  const candidates = [
    explicit,
    path.resolve(
      process.cwd(),
      '../frontend/src/assets/logo.png'
    ),
    path.resolve(
      process.cwd(),
      '../frontend/src/assets/logo.webp'
    ),
    path.resolve(
      process.cwd(),
      '../frontend/public/logo.png'
    ),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) {
        continue;
      }

      const ext =
        path.extname(candidate)
          .toLowerCase();

      const mime =
        ext === '.webp'
          ? 'image/webp'
          : ext === '.jpg' ||
            ext === '.jpeg'
            ? 'image/jpeg'
            : 'image/png';

      return `data:${mime};base64,${fs
        .readFileSync(candidate)
        .toString('base64')}`;
    } catch (_) {}
  }

  return '';
}

function signatureHtml(
  dataUri,
  label
) {
  if (!dataUri) {
    return `
      <div class="signature-empty">
        Firma no disponible
      </div>
    `;
  }

  return `
    <div class="signature-box">
      <img
        src="${dataUri}"
        alt="${escapeHtml(label)}"
      />
    </div>
  `;
}

function row(label, value) {
  const labels = {asignada:'Asignada',en_ejecucion:'En ejecución',en_espera:'En espera',cerrada:'Cerrada',draft:'Borrador',confirmed:'Confirmado',technical_closed:'Cierre técnico confirmado',handed_to_direction:'Entregado a Dirección Técnica',direction_received:'Recibido por Dirección Técnica',validated:'Validado por Dirección Técnica',rework_required:'Reproceso requerido'};
  if (['Estado','Estado cierre','Estado diagnóstico'].includes(label)) value = labels[value] || value;
  return `<td class="field"><span class="field-label">${escapeHtml(label)}</span><span class="field-value">${escapeHtml(value === null || value === undefined || value === '' ? '—' : value)}</span></td>`;
}

function fieldTables(body) {
  return body.replace(/<div class="grid">([\s\S]*?)<\/div>/g, (_, fields) => {
    const cells = fields.match(/<td class="field">[\s\S]*?<\/td>/g) || [];
    const rows = [];
    for (let i=0;i<cells.length;i+=2) rows.push(`<tr>${cells[i]}${cells[i+1] || '<td class="field field-empty"></td>'}</tr>`);
    return `<table class="data-table"><tbody>${rows.join('')}</tbody></table>`;
  });
}

function yesNo(value) {
  if (value === true) return 'Sí';
  if (value === false) return 'No';
  return '—';
}

const FIELD_LABELS = {
  tests_completed: 'Pruebas finales realizadas', functional_verified: 'Funcionamiento final verificado',
  accessories_checked: 'Accesorios / piezas verificados', cleaning_done: 'Limpieza realizada',
  protective_packaging: 'Equipo protegido / empacado', safety_checked: 'Seguridad verificada',
  good: 'Buen estado', scratches: 'Rayones', dents: 'Golpes / abolladuras',
  broken: 'Partes rotas', humidity: 'Señales de humedad', tampered: 'Manipulado / abierto',
  other: 'Otra novedad', charger: 'Cargador / adaptador recibido', battery: 'Batería recibida',
  bag: 'Maletín / estuche', power_cable: 'Cable de poder', network_cable: 'Cable de red',
};

function checklistRows(checklist) {
  if (!checklist || typeof checklist !== 'object' || !Object.keys(checklist).length) {
    return '<div class="muted">Sin elementos registrados.</div>';
  }
  return Object.entries(checklist).map(([key, value]) => {
    const label = FIELD_LABELS[key] || key.replaceAll('_', ' ');
    const text = typeof value === 'boolean' ? yesNo(value)
      : value && typeof value === 'object' ? JSON.stringify(value) : value;
    return `<div class="check-row"><strong>${escapeHtml(label)}:</strong>
      <span>${escapeHtml(text ?? '—')}</span></div>`;
  }).join('');
}

function receptionEquipmentSection(snapshot) {
  const checklist = snapshot.reception_checklist?.checklist || snapshot.reception_checklist || {};
  return `<h2>Equipo recibido</h2><div class="grid">
    ${row('Equipo', checklist.equipment_type)}${row('Marca', checklist.brand)}
    ${row('Modelo', checklist.model)}${row('Serial', checklist.serial_number || 'Ver observaciones')}
    ${row('Entregado por', checklist.received_from_name)}
    ${row('Documento de quien entrega', checklist.received_from_document)}
    ${row('Pedido World Office', snapshot.intake?.equipment_intake?.worldoffice_order_reference)}
    ${row('Recepción confirmada', fmtDate(checklist.confirmed_at))}
    </div><h3>Falla reportada / solicitud del cliente</h3>
    <div class="note">${escapeHtml(snapshot.intake?.request_description || snapshot.order?.descripcion_inicial || '—')}</div>
    <h3>Estado físico</h3><div class="checklist">${checklistRows(checklist.condition_flags)}</div>
    <h3>Accesorios, cargador y batería</h3><div class="checklist">${checklistRows(checklist.accessories)}</div>
    <div class="note">${escapeHtml(checklist.accessories_other || 'Sin accesorios adicionales registrados')}</div>
    <h3>Observaciones de recepción</h3><div class="note">${escapeHtml(checklist.observations || '—')}</div>`;
}

function receptionPhotos(items) {
  if (!Array.isArray(items) || !items.length) return '<div class="muted">Sin fotografías registradas.</div>';
  return `<div class="photo-grid">${items.map(item => `<figure class="photo-card">
    <img src="${escapeHtml(item.data_uri)}" alt="${escapeHtml(item.note || item.original_name || 'Equipo recibido')}">
    <figcaption>${escapeHtml(item.note || item.original_name || 'Equipo recibido')}<br>
    ${escapeHtml(fmtDate(item.captured_at || item.created_at))}</figcaption>
    </figure>`).join('')}</div>`;
}

function evidenceList(items) {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return `
      <div class="muted">
        Sin evidencias listadas.
      </div>
    `;
  }

  return `
    <ul class="compact-list">
      ${items
        .map(
          (item) => `
            <li>
              ${escapeHtml(
                item.original_name ||
                item.category ||
                'Evidencia'
              )}
              ${
                item.note
                  ? ` - ${escapeHtml(
                      item.note
                    )}`
                  : ''
              }
            </li>
          `
        )
        .join('')}
    </ul>
  `;
}

function baseHtml({
  title,
  subtitle,
  order,
  body,
  footerText,
}) {
  const logo =
    order.document_branding?logoUri(order.document_branding.logo_key):logoDataUri();

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page {
    size: A4;
    margin: 14mm 12mm 16mm 12mm;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family: Verdana, Geneva, sans-serif;
    color: #172033;
    font-size: 10.5pt;
    line-height: 1.42;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding-bottom: 10px;
    border-bottom: 2px solid ${order.document_branding?.accent_color||'#8aa645'};
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .brand img {
    width: 140px;
    max-height: 54px;
    object-fit: contain;
  }

  .brand-fallback {
    font-size: 18pt;
    font-weight: 800;
    letter-spacing: .5px;
  }

  .doc-meta {
    text-align: right;
    min-width: 190px;
  }

  .doc-meta strong {
    display: block;
    font-size: 10pt;
  }

  .title {
    margin: 16px 0 4px;
    font-size: 18pt;
    line-height: 1.15;
  }

  .subtitle {
    color: #5d6678;
    margin-bottom: 14px;
  }

  h2 {
    margin: 18px 0 8px;
    font-size: 12.5pt;
    border-left: 4px solid ${order.document_branding?.accent_color||'#8aa645'};
    padding-left: 8px;
  }

  h3 {
    margin: 14px 0 7px;
    font-size: 11pt;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px 10px;
  }

  .grid-3 {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 7px 10px;
  }

  .field {
    border: 1px solid #dfe3ea;
    border-radius: 6px;
    padding: 7px 8px;
    min-height: 46px;
    break-inside: avoid;
  }

  .field-label {
    font-size: 8pt;
    color: #667085;
    text-transform: uppercase;
    letter-spacing: .2px;
    margin-bottom: 2px;
  }

  .field-value {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .note {
    white-space: pre-wrap;
    border: 1px solid #dfe3ea;
    background: #f8fafc;
    border-radius: 7px;
    padding: 9px;
    min-height: 46px;
    overflow-wrap: anywhere;
  }

  .checklist {
    border: 1px solid #dfe3ea;
    border-radius: 7px;
    overflow: hidden;
  }

  .check-row {
    display: flex;
    gap: 8px;
    padding: 6px 8px;
    border-bottom: 1px solid #edf0f4;
  }

  .check-row:last-child {
    border-bottom: 0;
  }

  .check {
    width: 18px;
    font-weight: 800;
    color: ${order.document_branding?.accent_color||'#8aa645'};
  }

  .signature-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    margin-top: 10px;
  }

  .signature-box,
  .signature-empty {
    height: 100px;
    border: 1px solid #dfe3ea;
    border-radius: 7px;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .signature-box img {
    max-width: 95%;
    max-height: 88px;
    object-fit: contain;
  }

  .signature-empty {
    color: #98a2b3;
    font-size: 9pt;
  }

  .signature-label {
    margin-top: 5px;
    text-align: center;
    font-size: 8.5pt;
    color: #667085;
  }

  .compact-list {
    margin: 4px 0 0 18px;
    padding: 0;
  }

  .compact-list li {
    margin: 3px 0;
  }

  .status {
    display: inline-block;
    border-radius: 999px;
    padding: 4px 8px;
    font-size: 8.5pt;
    font-weight: 700;
    background: ${order.document_branding?.background_color||'#f3f6eb'};
    color: #17643a;
  }

  .muted {
    color: #667085;
  }

  .footer {
    margin-top: 24px;
    padding-top: 8px;
    border-top: 1px solid #dfe3ea;
    color: #7a8495;
    font-size: 7.8pt;
  }

  .photo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .photo-card { margin: 0; padding: 8px; border: 1px solid #dfe3ea; border-radius: 7px; break-inside: avoid; }
  .photo-card img { width: 100%; height: 210px; object-fit: contain; }
  .photo-card figcaption { margin-top: 6px; font-size: 8.5pt; overflow-wrap: anywhere; }
  .signature-grid { break-inside: avoid; }
  .page-break {
    break-before: page;
  }


  :root { --accent: ${order.document_branding?.accent_color||'#8aa645'}; --tint: ${order.document_branding?.background_color||'#f3f6eb'}; }
  body { font-size: 9pt; line-height: 1.5; color: #263126; }
  .header { border-bottom: 4px solid var(--accent); padding: 2mm 0 4mm; }
  .brand img { width: 155px; max-height: 62px; }
  .doc-meta { border-left: 1px solid var(--accent); padding-left: 16px; font-size: 8pt; }
  .doc-meta strong { color: #354327; font-size: 11pt; margin-bottom: 3px; }
  .title { margin: 5mm 0 2mm; font-size: 19pt; letter-spacing: -.5px; color: #29351e; }
  .subtitle { font-size: 8.5pt; color: #55634b; padding-bottom: 3mm; border-bottom: 1px solid #dce4d0; }
  h2 { margin: 5mm 0 0; background: var(--accent); color: #182211; border: 0; padding: 7px 10px; font-size: 10pt; letter-spacing: .2px; break-after: avoid; }
  h3 { color: #3d4d2e; font-size: 9pt; margin: 4mm 0 2mm; break-after: avoid; }
  .data-table { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 0 0 3mm; }
  .data-table tr { break-inside: avoid; }
  .data-table .field { width: 50%; border: 1px solid #d3ddc3; border-radius: 0; vertical-align: top; padding: 7px 10px; }
  .data-table tr:nth-child(odd) .field { background: var(--tint); }
  .field-label { display: block; color: #59664a; font-size: 7pt; letter-spacing: .25px; margin-bottom: 3px; }
  .field-value { display: block; font-size: 9pt; font-weight: bold; }
  .field-empty { background: #fff !important; }
  .note { border: 1px solid #d3ddc3; border-left: 3px solid var(--accent); border-radius: 0; background: var(--tint); padding: 8px 10px; min-height: 0; }
  .checklist { border-color: #d3ddc3; border-radius: 0; }
  .check-row { justify-content: space-between; border-bottom-color: #d3ddc3; padding: 6px 10px; break-inside: avoid; }
  .check-row:nth-child(odd) { background: var(--tint); }
  .photo-card { border-color: #d3ddc3; border-radius: 0; padding: 8px; }
  .photo-card img { height: 165px; }
  .photo-card figcaption { color: #59664a; font-size: 7pt; }
  .signature-box, .signature-empty { border-color: #d3ddc3; border-radius: 0; height: 90px; }
  .signature-label { padding-top: 5px; border-top: 2px solid var(--accent); color: #3d4d2e; }
  .footer { border-top: 2px solid var(--accent); color: #59664a; margin-top: 6mm; }

  @media print {
    .avoid-break {
      break-inside: avoid;
    }
  }
  @media screen {
    body { padding: 12px; overflow-wrap: anywhere; }
    .header, .brand, .doc-meta, .grid > *, .grid-3 > *, .signature-grid > * { min-width: 0; }
    img { max-width: 100%; }
  }
  @media screen and (max-width: 600px) {
    .header { flex-wrap: wrap; }
    .doc-meta { text-align: left; }
    .grid, .grid-3, .signature-grid { grid-template-columns: 1fr; }
    .brand img { width: 110px; }
  }
</style>
</head>
<body>
  <header class="header">
    <div class="brand">
      ${
        logo
          ? `<img src="${logo}" alt="Tecno Nacho">`
          : `<div class="brand-fallback">TECNO NACHO</div>`
      }
    </div>

    <div class="doc-meta">
      <strong>
        ${escapeHtml(order?.codigo_os || 'Orden de servicio')}
      </strong>
      <span>
        Generado:
        ${escapeHtml(fmtDate(new Date()))}
      </span>
    </div>
  </header>

  <h1 class="title">
    ${escapeHtml(title)}
  </h1>

  <div class="subtitle">
    ${escapeHtml(subtitle || '')}
  </div>

  ${fieldTables(body)}

  <footer class="footer">
    ${
      escapeHtml(
        footerText ||
          'Documento generado por el sistema de Servicio Técnico.'
      )
    }
  </footer>
</body>
</html>`;
}

function commonOrderSection(snapshot) {
  const order =
    snapshot.order || {};

  return `
    <h2>Orden y cliente</h2>

    <div class="grid">
      ${row(
        'Orden de servicio',
        order.codigo_os
      )}
      ${row(
        'Estado',
        order.estado
      )}
      ${row(
        'Cliente',
        order.client_name
      )}
      ${row(
        'Documento cliente',
        order.client_document
      )}
      ${row(
        'Teléfono',
        order.client_phone
      )}
      ${row(
        'Correo',
        order.client_email
      )}
    </div>
  `;
}

function buildReceptionAct(snapshot) {
  const act =
    snapshot.reception_act ||
    {};

  const body = `
    ${commonOrderSection(snapshot)}

    <h2>Recepción</h2>

    <div class="grid">
      ${row(
        'Firmante',
        (act.signed_by_name || act.signer_name)
      )}
      ${row(
        'Documento firmante',
        (act.signed_by_document || act.signer_document)
      )}
      ${row(
        'Fecha de firma',
        fmtDate(
          act.signed_at
        )
      )}
      ${row(
        'Técnico responsable',
        snapshot.primary_technician_name
      )}
    </div>

    ${receptionEquipmentSection(snapshot)}
    <h3>Fotografías del estado inicial</h3>
    ${receptionPhotos(snapshot.reception_evidences)}

    <h2>Firma de recepción</h2>
    <div class="signature-grid">
      <div>
        ${signatureHtml(
          snapshot.reception_signature_data_uri,
          'Firma de recepción'
        )}
        <div class="signature-label">
          ${escapeHtml(
            (act.signed_by_name || act.signer_name) ||
              'Firmante'
          )}
        </div>
      </div>

      <div>
        <div class="signature-empty">
          Recepción confirmada en el sistema por el técnico
        </div>
        <div class="signature-label">
          ${escapeHtml(
            snapshot.primary_technician_name ||
              'Responsable técnico'
          )}
        </div>
      </div>
    </div>
  `;

  return baseHtml({
    title:
      'Acta de recepción del equipo',
    subtitle:
      'Constancia de ingreso, estado recibido, evidencias y aceptación.',
    order:
      snapshot.order,
    body,
  });
}

function buildTechnicalClosure(snapshot) {
  const closure =
    snapshot.closure || {};

  const diagnosis =
    snapshot.diagnosis || {};

  const body = `
    ${commonOrderSection(snapshot)}

    ${receptionEquipmentSection(snapshot)}

    <h2>Diagnóstico / resultado</h2>

    <div class="grid">
      ${row(
        'Tipo de trabajo',
        diagnosis.work_type
      )}
      ${row(
        'Estado diagnóstico',
        diagnosis.status
      )}
      ${row(
        'Resultado',
        diagnosis.result_status
      )}
      ${row(
        'Solución disponible',
        yesNo(
          diagnosis.solution_available
        )
      )}
      ${row(
        'Costo aproximado',
        diagnosis.approximate_cost !==
          null &&
        diagnosis.approximate_cost !==
          undefined
          ? money(
              diagnosis.approximate_cost
            )
          : '—'
      )}
      ${row(
        'Confirmado',
        fmtDate(
          diagnosis.confirmed_at
        )
      )}
    </div>

    <h3>Descripción técnica</h3>
    <div class="note">
      ${escapeHtml(
        diagnosis.description ||
          '—'
      )}
    </div>

    <h3>Solución / resultado funcional</h3>
    <div class="note">
      ${escapeHtml(
        diagnosis.functional_result ||
          '—'
      )}
    </div>

    <h2>Cierre técnico</h2>

    <div class="grid">
      ${row(
        'Estado cierre',
        closure.status
      )}
      ${row(
        'Fecha cierre técnico',
        fmtDate(
          closure.technical_closed_at
        )
      )}
      ${row(
        'Responsable',
        snapshot.primary_technician_name
      )}
      ${row(
        'Reprocesos',
        closure.rework_count
      )}
    </div>

    <h3>Duración del trabajo</h3><div class="grid">${row('Duración estimada', closure.estimated_minutes == null ? 'Sin registro' : closure.estimated_minutes + ' min')}${row('Tiempo activo registrado', closure.actual_minutes == null ? 'Sin medición' : Number(closure.actual_minutes).toFixed(1) + ' min')}</div>
    ${closure.duration_note ? `<div class="note">${escapeHtml(closure.duration_note)}</div>` : ''}
    <h3>Checklist final</h3>
    <div class="checklist">
      ${checklistRows(
        closure.checklist
      )}
    </div>

    <h3>Resultado final</h3>
    <div class="note">
      ${escapeHtml(
        closure.final_result ||
          '—'
      )}
    </div>

    <h3>Notas finales</h3>
    <div class="note">
      ${escapeHtml(
        closure.final_notes ||
          '—'
      )}
    </div>

    <h3>Evidencias finales</h3>
    ${evidenceList(
      snapshot.final_evidences
    )}

    <h2>Dirección Técnica</h2>

    <div class="grid">
      ${row(
        'Entregado a Dirección',
        fmtDate(
          closure.handed_to_direction_at
        )
      )}
      ${row(
        'Recibido por Dirección',
        fmtDate(
          closure.direction_received_at
        )
      )}
      ${row(
        'Validado por Dirección',
        fmtDate(
          closure.direction_validated_at
        )
      )}
      ${row(
        'Estado validación',
        closure.status ===
          'validated'
          ? 'Validado'
          : 'Pendiente / en proceso'
      )}
    </div>

    <h3>Observación de Dirección Técnica</h3>
    <div class="note">
      ${escapeHtml(
        closure.direction_validation_note ||
          '—'
      )}
    </div>
  `;

  return baseHtml({
    title:
      'Acta de cierre técnico',
    subtitle:
      'Diagnóstico, trabajo realizado, pruebas finales y validación técnica.',
    order:
      snapshot.order,
    body,
  });
}

function buildFinalDelivery(snapshot) {
  const delivery =
    snapshot.delivery || {};

  const satisfaction =
    snapshot.satisfaction ||
    null;

  const body = `
    ${commonOrderSection(snapshot)}

    <h2>Entrega final</h2>

    <div class="grid">
      ${row(
        'Tipo de receptor',
        delivery.receiver_type ===
          'third_party'
          ? 'Tercero autorizado'
          : 'Cliente'
      )}
      ${row(
        'Nombre receptor',
        delivery.receiver_name
      )}
      ${row(
        'Documento receptor',
        delivery.receiver_document
      )}
      ${row(
        'Teléfono receptor',
        delivery.receiver_phone
      )}
      ${row(
        'Relación con cliente',
        delivery.receiver_relationship
      )}
      ${row(
        'Fecha de entrega',
        fmtDate(
          delivery.delivered_at
        )
      )}
    </div>

    <h3>Controles de entrega</h3>

    <div class="checklist">
      <div class="check-row">
        <span class="check">
          ${
            delivery.identity_verified
              ? '✓'
              : '✗'
          }
        </span>
        <span>
          Identidad del receptor verificada
        </span>
      </div>

      <div class="check-row">
        <span class="check">
          ${
            delivery.final_condition_verified
              ? '✓'
              : '✗'
          }
        </span>
        <span>
          Estado final del equipo verificado
        </span>
      </div>

      <div class="check-row">
        <span class="check">
          ${
            delivery.accessories_verified
              ? '✓'
              : '✗'
          }
        </span>
        <span>
          Accesorios verificados
        </span>
      </div>

      <div class="check-row">
        <span class="check">
          ${
            delivery.financial_clearance
              ? '✓'
              : '✗'
          }
        </span>
        <span>
          Liberación financiera confirmada
        </span>
      </div>
    </div>

    <h3>Observación financiera</h3>
    <div class="note">
      ${escapeHtml(
        delivery.financial_note ||
          '—'
      )}
    </div>

    ${
      delivery.receiver_type ===
      'third_party'
        ? `
          <h3>Autorización de tercero</h3>
          <div class="note">
            ${escapeHtml(
              delivery.third_party_authorization_note ||
                '—'
            )}
          </div>

          ${evidenceList(
            snapshot.third_party_evidences
          )}
        `
        : ''
    }

    <h3>Observación de entrega</h3>
    <div class="note">
      ${escapeHtml(
        delivery.delivery_note ||
          '—'
      )}
    </div>

    <h2>Firma del receptor</h2>

    <div class="signature-grid">
      <div>
        ${signatureHtml(
          snapshot.delivery_signature_data_uri,
          'Firma de entrega'
        )}
        <div class="signature-label">
          ${escapeHtml(
            delivery.receiver_name ||
              'Receptor'
          )}
        </div>
      </div>

      <div>
        <div class="signature-empty">
          Entrega confirmada por el custodio interno
        </div>
        <div class="signature-label">
          ${escapeHtml(
            snapshot.delivered_by_name ||
              'Responsable de entrega'
          )}
        </div>
      </div>
    </div>

    <h2>Satisfacción</h2>

    ${
      satisfaction
        ? `
          <div class="grid">
            ${row(
              'Calificación',
              `${satisfaction.rating} / 5`
            )}
            ${row(
              'Recomendaría el servicio',
              yesNo(
                satisfaction.would_recommend
              )
            )}
          </div>

          <h3>Comentario</h3>
          <div class="note">
            ${escapeHtml(
              satisfaction.comment ||
                '—'
            )}
          </div>
        `
        : `
          <div class="muted">
            No se registró encuesta de satisfacción.
          </div>
        `
    }
  `;

  return baseHtml({
    title:
      'Acta de entrega final',
    subtitle:
      'Constancia de entrega, identidad, accesorios, conformidad y firma.',
    order:
      snapshot.order,
    body,
  });
}

function buildServiceDocumentHtml(
  documentType,
  snapshot,
  branding
) {
  snapshot={...snapshot,order:{...snapshot.order,document_branding:normalizeBranding(branding??snapshot.document_branding)}};
  switch (documentType) {
    case 'reception_act':
      return buildReceptionAct(
        snapshot
      );

    case 'technical_closure':
      return buildTechnicalClosure(
        snapshot
      );

    case 'final_delivery':
      return buildFinalDelivery(
        snapshot
      );

    default:
      throw new Error(
        `Tipo de documento no soportado: ${documentType}`
      );
  }
}

module.exports = {
  buildServiceDocumentHtml,
  fmtDate,
};
