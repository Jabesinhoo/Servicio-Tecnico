import React,{useState,useEffect} from 'react';import api from '../../../../services/api';import ClientProfilePanel from './ClientProfilePanel';
export default function ServiceClientSnapshot({serviceId}){
 const[profile,setProfile]=useState(null);const[loading,setLoading]=useState(true);const[error,setError]=useState('');
 useEffect(()=>{let active=true;setLoading(true);api.get(`/api/service-orders/${serviceId}`).then(async r=>{const order=r.data?.data||r.data;let value=order.intake?.client_snapshot;
 if(!value&&order.client_id){const response=await api.get(`/api/clients/${order.client_id}/profile`);value=response.data?.data;}
 if(active)setProfile(value||null);}).catch(()=>{if(active)setError('No se pudo cargar la ficha del cliente del servicio.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[serviceId]);
 return <ClientProfilePanel profile={profile} loading={loading} error={error}/>;
}
