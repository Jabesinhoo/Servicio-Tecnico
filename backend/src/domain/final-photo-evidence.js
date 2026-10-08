'use strict';

const PHOTO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function validEvidenceBytes(mime, buffer) {
  if (!Buffer.isBuffer(buffer)) return false;
  if (mime === 'image/jpeg') {
    return buffer.length > 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  }
  if (mime === 'image/png') {
    return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mime === 'image/webp') {
    return buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  if (mime === 'application/pdf') {
    return buffer.length > 5 && buffer.toString('ascii', 0, 5) === '%PDF-';
  }
  return false;
}

function finalPhotoCount(evidences, closure) {
  const after = closure?.status === 'rework_required' ? Date.parse(closure.rework_started_at) : null;
  return (evidences || []).filter(evidence =>
    PHOTO_MIME.has(evidence.mime_type) &&
    (after === null || Date.parse(evidence.created_at) > after)
  ).length;
}

module.exports = { validEvidenceBytes, finalPhotoCount };
