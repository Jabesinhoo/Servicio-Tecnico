"use strict";
const normalizeKey = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const ALIASES = {
 telefono:['Telefono','Telefono1','Teléfono','Tel','Celular','Movil','TelefonoPrincipal'],
 telefono_2:['Telefono2','Telefono_2','Celular2','Movil2'],
 email:['Email','Correo','CorreoElectronico','EMail','Email1'], email_2:['Email2','Correo2','CorreoElectronico2'],
 direccion:['Direccion','Dirección','Direccion1','DireccionPrincipal','Domicilio'], direccion_2:['Direccion2','Direccion_2'],
 ciudad:['Ciudad','Municipio','NombreCiudad','NombreMunicipio'], departamento:['Departamento','NombreDepartamento'],
 pais:['Pais','NombrePais'], codigo_postal:['CodigoPostal','CodPostal'],
 contacto:['Contacto','PersonaContacto','NombreContacto'],
 latitude:['Latitud','Latitude'], longitude:['Longitud','Longitude'],
 tipo_documento:['IdTipoIdentificacion','TipoIdentificacion'], documento:['Identificacion','Documento'],
 razon_social:['Nombre','RazonSocial'], primer_nombre:['Primer_Nombre'], segundo_nombre:['Segundo_Nombre'],
 primer_apellido:['Primer_Apellido'], segundo_apellido:['Segundo_Apellido']
};
function object(value){if(typeof value==='string'){try{return JSON.parse(value);}catch{return {};}}return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
function profileFromRaw(raw,relations={}){
 raw=object(raw);relations=object(relations);const result={};
 const records=[raw,...Object.values(relations).flat().filter(v=>v&&typeof v==='object')];
 for(const [field,aliases] of Object.entries(ALIASES)){
  const names=aliases.map(normalizeKey);
  for(const record of records){
   const entry=Object.entries(record).find(([key,value])=>names.includes(normalizeKey(key))&&value!==null&&value!==undefined&&String(value).trim()!=='');
   if(entry){result[field]=typeof entry[1]==='string'?entry[1].trim():entry[1];break;}
  }
 }
 // Lookup catalogs keep their original names in the detailed view; use only geography tables for labels.
 for(const [table,rows] of Object.entries(relations)){
  const key=normalizeKey(table);let field=key.includes('ciudad')||key.includes('municip')?'ciudad':key.includes('depart')?'departamento':key.includes('pais')?'pais':null;
  if(field&&(!result[field]||typeof result[field]!=='string')&&rows?.[0]){const entry=Object.entries(rows[0]).find(([k,v])=>['nombre','descripcion','ciudad','municipio','departamento','pais'].includes(normalizeKey(k))&&typeof v==='string'&&v.trim());if(entry)result[field]=entry[1];}
 }
 return result;
}
module.exports={normalizeKey,object,profileFromRaw};
