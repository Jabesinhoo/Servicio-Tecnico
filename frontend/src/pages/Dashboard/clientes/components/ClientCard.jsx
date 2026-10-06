// src/pages/Dashboard/clientes/components/ClientCard.jsx
import React from 'react';
import { Eye, Edit, Trash2, Phone, Mail, MapPin, Building, User } from 'lucide-react';

const ClientCard = ({ cliente, onViewDetail, onEdit, onDelete, canEdit }) => {
  const getNombreMostrar = () => {
    if (cliente.tipo_persona === 'juridica') {
      return cliente.razon_social || '—';
    }
    return `${cliente.primer_nombre || ''} ${cliente.primer_apellido || ''}`.trim() || '—';
  };

  const getTipoPersona = () => {
    return cliente.tipo_persona === 'juridica' ? 'Empresa' : 'Persona Natural';
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {cliente.tipo_persona === 'juridica' ? (
              <Building className="w-5 h-5 accent-text" />
            ) : (
              <User className="w-5 h-5 accent-text" />
            )}
            <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
              {getNombreMostrar()}
            </h3>
          </div>
          
          <div className="space-y-1.5 mt-3">
            <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <span className="text-xs text-gray-400 w-20">Documento:</span>
              <span>{cliente.documento || '—'}</span>
            </p>
            {cliente.telefono && (
              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                <span>{cliente.telefono}</span>
              </p>
            )}
            {cliente.email && (
              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 truncate">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                <span className="truncate">{cliente.email}</span>
              </p>
            )}
            {cliente.ciudad && (
              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                <span>{cliente.ciudad}</span>
              </p>
            )}
          </div>
          
          <div className="mt-3">
            <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
              cliente.tipo_persona === 'juridica' 
                ? 'accent-soft accent-text dark:accent-soft dark:accent-text'
                : 'accent-soft accent-text dark:accent-soft dark:accent-text'
            }`}>
              {getTipoPersona()}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => onViewDetail(cliente.id)}
            className="p-1.5 accent-text hover:accent-text dark:accent-text hover:accent-soft dark:hover:accent-soft rounded-lg transition-colors"
            title="Ver detalle"
          >
            <Eye className="w-4 h-4" />
          </button>
          {canEdit && (
            <>
              <button
                onClick={() => onEdit(cliente)}
                className="p-1.5 accent-text hover:accent-text dark:accent-text hover:accent-soft dark:hover:accent-soft rounded-lg transition-colors"
                title="Editar"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(cliente)}
                className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientCard;