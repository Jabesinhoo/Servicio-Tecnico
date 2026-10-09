import React,{useEffect,useState} from 'react';
import {ImageOff} from 'lucide-react';
import api from '../../../../services/api';
import {inventoryImageSource} from '../inventoryImages';
export default function InventoryImage({image,alt='Foto del artículo',className=''}){
 const source=inventoryImageSource(image,api.defaults.baseURL),[failed,setFailed]=useState(false),[protectedUrl,setProtectedUrl]=useState(null);
 useEffect(()=>{setFailed(false);setProtectedUrl(null);let cancelled=false,objectUrl;
  if(source.url){const base=new URL(api.defaults.baseURL,window.location.origin),url=new URL(source.url,window.location.origin);if(url.origin===base.origin&&url.pathname.startsWith('/api/')){api.get(url.href,{responseType:'blob'}).then(r=>{objectUrl=URL.createObjectURL(r.data);if(!cancelled)setProtectedUrl(objectUrl);else URL.revokeObjectURL(objectUrl);}).catch(()=>{if(!cancelled)setFailed(true);});}}
  return()=>{cancelled=true;if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[source.url]);
 let authenticated=false;if(source.url){const base=new URL(api.defaults.baseURL,window.location.origin),url=new URL(source.url);authenticated=url.origin===base.origin&&url.pathname.startsWith('/api/');}
 if(!source.url||failed)return <div role="img" aria-label={alt+' no disponible'} className={className+' flex flex-col items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-500 p-2 text-center'}><ImageOff className="w-7 h-7 shrink-0"/><span className="text-xs">{source.reason==='expired'?'Foto antigua: vuelve a adjuntarla':'Foto no disponible'}</span></div>;
 if(authenticated&&!protectedUrl)return <div className={className+' flex items-center justify-center text-xs'}>Cargando foto…</div>;
 return <img src={protectedUrl||source.url} alt={alt} className={className} loading="lazy" onError={()=>setFailed(true)}/>;
}
