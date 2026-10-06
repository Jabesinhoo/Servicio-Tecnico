'use strict';
const fs=require('fs');const path=require('path');
const assets=path.resolve(__dirname,'../../../frontend/src/assets');
const choices={logot:['img/logot.png','logot.png'],logo3:['img/logo3.jpeg','img/logo3.jpg','logo3.jpeg','logo3.jpg']};
function normalizeBranding(input){
 if(input===undefined||input===null)return null;
 const fail=()=>{throw Object.assign(new Error('Logo o colores del documento no válidos'),{status:400});};
 if(!choices[input.logo_key])fail();
 const result={logo_key:input.logo_key};for(const [key,value]of Object.entries({accent_color:input.accent_color??'#8aa645',background_color:input.background_color??'#f3f6eb'})){if(!/^#[0-9a-f]{6}$/i.test(value))fail();result[key]=value;}
 return result;
}
function logoUri(key){
 if(!choices[key])throw Object.assign(new Error('Logo no válido'),{status:400});
 for(const rel of choices[key]){const file=path.join(assets,rel);if(!fs.existsSync(file))continue;const data=fs.readFileSync(file);const png=data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));const jpeg=data[0]===255&&data[1]===216&&data[2]===255;if(!png&&!jpeg)continue;return 'data:image/'+(png?'png':'jpeg')+';base64,'+data.toString('base64');}
 throw Object.assign(new Error('No se encontró '+key+' en frontend/src/assets/img. Coloca allí el archivo original.'),{status:400});
}
function brandingOptions(){return Object.keys(choices).map(key=>{try{return {key,label:key==='logot'?'logot.png':'logo3.jpeg',available:true,data_uri:logoUri(key)};}catch{return {key,label:key==='logot'?'logot.png':'logo3.jpeg',available:false};}});}
module.exports={normalizeBranding,logoUri,brandingOptions};
