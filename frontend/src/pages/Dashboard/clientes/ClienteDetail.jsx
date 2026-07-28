// src/pages/Dashboard/clientes/ClienteDetail.jsx
import React from 'react';
import { X, Phone, Mail, MapPin, Building, FileText, Edit } from 'lucide-react';

const ClienteDetail = ({ isOpen, onClose, cliente, onEdit }) => {
  if (!isOpen || !cliente) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {cliente.nombre_razon_social}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {cliente.documento || 'Sin documento'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(cliente)}
              className="text-green-600 hover:text-green-800 dark:text-green-400 transition-colors p-1"
              title="Editar"
            >
              <Edit className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Teléfono</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{cliente.telefono || '—'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{cliente.email || '—'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 md:col-span-2">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Dirección</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{cliente.direccion || '—'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Building className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Ciudad</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{cliente.ciudad || '—'}</p>
              </div>
            </div>

            {cliente.notas && (
              <div className="flex items-start gap-3 md:col-span-2">
                <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Notas</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{cliente.notas}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClienteDetail;