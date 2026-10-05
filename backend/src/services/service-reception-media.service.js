'use strict';
const fs = require('fs/promises');
const path = require('path');
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

async function storedImage(root, relative, mimeType) {
  try {
    if (!relative || !IMAGE_TYPES.has(mimeType)) throw new Error('Imagen inválida');
    const absolute = path.resolve(root, relative);
    if (!absolute.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error('Ruta inválida');
    const bytes = await fs.readFile(absolute);
    if (!bytes.length) throw new Error('Imagen vacía');
    return `data:${mimeType};base64,${bytes.toString('base64')}`;
  } catch (_) {
    const error = new Error('No fue posible cargar una foto o la firma de recepción. Revisa los archivos de la orden antes de generar el PDF.');
    error.code = 'RECEPTION_MEDIA_MISSING';
    throw error;
  }
}

async function loadReceptionMedia(snapshot, root) {
  const act = snapshot.reception_act || {};
  snapshot.reception_signature_data_uri = await storedImage(root,
    act.signature_storage_path || act.signature_path, act.signature_mime_type || 'image/png');
  // Secuencial para limitar lecturas simultáneas de fotos grandes.
  for (const item of snapshot.reception_evidences || []) {
    item.data_uri = await storedImage(root, item.storage_path, item.mime_type);
  }
}

module.exports = { storedImage, loadReceptionMedia };
