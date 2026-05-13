// src/pages/Dashboard/tipos-servicio/components/TipoServicioCard.jsx
import React from 'react';
import { Edit, Trash2, CheckCircle, XCircle, Clock, DollarSign, FileText } from 'lucide-react';

const TipoServicioCard = ({ tipo, onEdit, onDelete, onToggleStatus, canEdit }) => {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-blue-500" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
              {tipo.nombre}
            </h3>
          </div>
          
          {tipo.categoria && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Categoría: {tipo.categoria}
            </p>
          )}
          
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
            {tipo.descripcion || 'Sin descripción'}
          </p>
          
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                ${Number(tipo.valor_base).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {tipo.duracion_estimada} min
              </span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1 mb-3">
            {tipo.requiere_diagnostico && (
              <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">
                Diagnóstico
              </span>
            )}
            {tipo.requiere_repuestos && (
              <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800">
                Repuestos
              </span>
            )}
            {tipo.requiere_aprobacion && (
              <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-800">
                Requiere aprobación
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
              tipo.activo 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
            }`}>
              {tipo.activo ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {tipo.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1 ml-2">
          {canEdit && (
            <>
              <button
                onClick={() => onToggleStatus(tipo)}
                className={`p-1.5 rounded-lg transition-colors ${
                  tipo.activo 
                    ? 'text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50 dark:hover:bg-yellow-900/30'
                    : 'text-green-600 hover:text-green-800 hover:bg-green-50 dark:hover:bg-green-900/30'
                }`}
                title={tipo.activo ? 'Desactivar' : 'Activar'}
              >
                {tipo.activo ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              </button>
              <button
                onClick={() => onEdit(tipo)}
                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                title="Editar"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(tipo)}
                className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                title="Eliminar permanentemente"
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

export default TipoServicioCard;