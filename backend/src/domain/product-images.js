'use strict';
function cleanProductImages(value){
 if(value==null)return [];
 if(typeof value==='string'){try{value=JSON.parse(value);}catch{throw Object.assign(new Error('Las fotos deben enviarse como una lista de imágenes'),{status:400});}}
 if(!Array.isArray(value))throw Object.assign(new Error('Las fotos deben enviarse como una lista de imágenes'),{status:400});
 return value.map((image,index)=>{
  const row=typeof image==='string'?{url:image}:image;
  const url=row?.url||row?.src||row?.path;
  if(typeof url!=='string'||!url.trim())throw Object.assign(new Error('Una foto no tiene archivo disponible. Elimínala y vuelve a adjuntarla.'),{status:400});
  if(/^blob:/i.test(url.trim()))throw Object.assign(new Error('La foto usa un enlace temporal del navegador. Elimínala y vuelve a adjuntarla para guardarla permanentemente.'),{status:400});
  if(/^(javascript:|file:)/i.test(url.trim())||(/^data:/i.test(url.trim())&&!/^data:image\/(png|jpe?g|webp|gif|avif);base64,/i.test(url.trim())))throw Object.assign(new Error('El formato de la foto no es válido'),{status:400});
  return {id:row.id??index,url:url.trim(),name:row.name||'Foto '+(index+1)};
 });
}
module.exports={cleanProductImages};
