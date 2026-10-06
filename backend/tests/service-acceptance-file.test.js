'use strict';
const {test}=require('node:test'); const assert=require('node:assert/strict');
const {validateFile,MAX_BYTES}=require('../src/domain/service-acceptance-file');
test('acepta PDF y conserva un nombre sin rutas',()=>{const meta=validateFile('../aceptacion.pdf',Buffer.from('%PDF-1.7\n'));assert.equal(meta.safeName,'aceptacion.pdf');assert.equal(meta.mime,'application/pdf');});
test('admite cabeceras de fotos, videos y documentos',()=>{for(const [name,hex] of [['foto.jpg','ffd8ff'],['foto.png','89504e470d0a1a0a'],['foto.webp','524946460000000057454250'],['video.mp4','0000001866747970'],['video.webm','1a45dfa3'],['video.mov','0000001866747970'],['archivo.docx','504b0304'],['archivo.xlsx','504b0304'],['archivo.doc','d0cf11e0a1b11e1'],['archivo.xls','d0cf11e0a1b11e1']])assert.ok(validateFile(name,Buffer.from(hex,'hex')));});
test('rechaza archivos vacíos, tamaños excesivos y formatos ejecutables',()=>{assert.throws(()=>validateFile('a.pdf',Buffer.alloc(0)));assert.throws(()=>validateFile('a.pdf',Buffer.alloc(MAX_BYTES+1)));assert.throws(()=>validateFile('a.html',Buffer.from('<script>')));assert.throws(()=>validateFile('a.exe',Buffer.from('MZ')));});
test('rechaza contenido que no corresponde a la extensión',()=>{assert.throws(()=>validateFile('foto.png',Buffer.from('texto')));assert.throws(()=>validateFile('a.pdf',Buffer.from('<html>')));});
