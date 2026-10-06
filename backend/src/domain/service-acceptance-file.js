"use strict";
const path = require('path');
const MAX_BYTES = 25 * 1024 * 1024;
const TYPES = {
 '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
 '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
 '.pdf': 'application/pdf', '.doc': 'application/msword',
 '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};
function validateFile(name, bytes) {
 const safeName = String(name || '').split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g, '').slice(0, 180);
 const extension = path.extname(safeName).toLowerCase();
 if (!TYPES[extension]) throw Object.assign(new Error('Formato no permitido. Usa foto, video, PDF, Word o Excel.'), {status:400});
 if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_BYTES) throw Object.assign(new Error('El archivo debe tener contenido y pesar máximo 25 MB.'), {status:413});
 const head = bytes.subarray(0, 16);
 const valid = extension === '.pdf' ? head.toString().startsWith('%PDF-') :
 ['.jpg','.jpeg'].includes(extension) ? head[0]===255 && head[1]===216 && head[2]===255 :
 extension === '.png' ? head.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) :
 extension === '.webp' ? head.toString('ascii',0,4)==='RIFF' && head.toString('ascii',8,12)==='WEBP' :
 ['.mp4','.mov'].includes(extension) ? head.toString('ascii',4,8)==='ftyp' :
 extension === '.webm' ? head.subarray(0,4).equals(Buffer.from('1a45dfa3','hex')) :
 ['.docx','.xlsx'].includes(extension) ? head.subarray(0,4).equals(Buffer.from('504b0304','hex')) :
 head.subarray(0,8).equals(Buffer.from('d0cf11e0a1b11e1','hex'));
 if (!valid) throw Object.assign(new Error('El contenido no corresponde al formato del archivo.'), {status:400});
 return {safeName, extension, mime:TYPES[extension]};
}
module.exports = { MAX_BYTES, validateFile };
