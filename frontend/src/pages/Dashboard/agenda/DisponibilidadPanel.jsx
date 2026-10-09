// src/pages/Dashboard/agenda/DisponibilidadPanel.jsx
import React, { useState, useEffect } from 'react';
import { User, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import api from '../../../services/api';

const DisponibilidadPanel = ({ fecha, onSelectTecnico, onConfigureHorario }) => {
  const [tecnicos, setTecnicos] = useState([]);
  const [errorMessage,setErrorMessage]=useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (fecha) {
      fetchDisponibilidad();
    }
  }, [fecha]);

  const fetchDisponibilidad = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/agenda/disponibilidad?fecha=${fecha}`);
      const rows=Array.isArray(res.data)?res.data:res.data?.data;
      if(!Array.isArray(rows))throw new Error('Respuesta de disponibilidad no válida');
      setTecnicos(rows);setErrorMessage('');
    } catch (error) {
      console.error('Error fetching disponibilidad:', error);
      setErrorMessage(error.response?.data?.message||'No fue posible cargar la disponibilidad de técnicos.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="w-6 h-6 animate-spin accent-text" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {errorMessage&&<p role="alert" className="text-sm text-red-600">{errorMessage}</p>}
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <User className="w-4 h-4" />
        Disponibilidad de Técnicos
      </h3>
      
      {tecnicos.length === 0 && !errorMessage ? (
        <p className="text-sm text-gray-500 text-center py-4">No hay técnicos registrados</p>
      ) : (
        tecnicos.map((tecnico) => (
          <div
            key={tecnico.tecnico_id}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              tecnico.disponible
                ? 'accent-soft accent-border dark:accent-soft dark:accent-border hover:accent-soft'
                : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700 cursor-not-allowed'
            }`}
            onClick={() => tecnico.disponible && onSelectTecnico(tecnico)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {tecnico.tecnico_nombre}
                </p>
                {tecnico.disponible ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-3 h-3 accent-text" />
                    <span className="text-xs accent-text">
                      Sin reservas para este día
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-red-500 mt-1">{tecnico.motivo}</p>
                )}
              </div>
              {tecnico.disponible ? (
                <CheckCircle className="w-5 h-5 accent-text" />
              ) : (
                <XCircle className="w-5 h-5 text-gray-400" />
              )}
            </div>
            
            {tecnico.horarios_ocupados?.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500">Ocupado:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {tecnico.horarios_ocupados.map((ocupado, idx) => (
                    <span key={idx} className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                      {ocupado.servicio}: {new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ocupado.inicio))}–{new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ocupado.fin))}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default DisponibilidadPanel;