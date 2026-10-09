export function inventoryImages(value){
 if(typeof value==='string'){try{const parsed=JSON.parse(value);if(Array.isArray(parsed))value=parsed;else value=[value];}catch{value=[value];}}
 if(!Array.isArray(value))return [];
 return value.map((image,index)=>typeof image==='string'?{id:index,url:image,name:'Foto '+(index+1)}:{...image,id:image?.id??index,url:image?.url||image?.src||image?.path||'',name:image?.name||'Foto '+(index+1)});
}
export function inventoryImageSource(image,baseURL){
 const raw=typeof image==='string'?image:image?.url||image?.src||image?.path;
 if(typeof raw!=='string'||!raw.trim())return {url:null,reason:'missing'};
 const value=raw.trim();
 if(/^blob:/i.test(value))return {url:null,reason:'expired'};
 if(/^data:image\/(png|jpe?g|webp|gif|avif);base64,/i.test(value))return {url:value,reason:null};
 if(/^(data:|javascript:|file:)/i.test(value))return {url:null,reason:'invalid'};
 try{const url=new URL(value,new URL(baseURL,window.location.origin).href.replace(/\/+$/,'')+'/');if(!['https:','http:'].includes(url.protocol))return {url:null,reason:'invalid'};return {url:url.href,reason:null};}catch{return {url:null,reason:'invalid'};}
}
