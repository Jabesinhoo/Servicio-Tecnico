// src/pages/Dashboard/tecnicos/components/TecnicoTable.jsx
import React from 'react';
import { Eye, Edit, Trash2, Phone, Mail, UserCheck, UserX } from 'lucide-react';

const TecnicoTable = ({ tecnicos, loading, onViewDetail, onEdit, onDelete, onToggleStatus }) => {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-sm text-gray-500 mt-2">Cargando técnicos...</p>
      </div>
    );
  }

  if (!tecnicos || tecnicos.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <p className="text-gray-500 dark:text-gray-400">No hay técnicos registrados</p>
        <p className="text-sm text-gray-400 mt-1">Haz clic en "Nuevo Técnico" para comenzar</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nombre</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Usuario</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Contacto</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cédula</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estado</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
          {tecnicos.map((tecnico) => (
            <tr key={tecnico.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <td className="px-6 py-4">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {tecnico.nombre1} {tecnico.apellidos || ''}
                </div>
               </td>
              <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                {tecnico.usuario}
               </td>
              <td className="px-6 py-4">
                <div className="space-y-1">
                  {tecnico.celular && (
                    <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                      <Phone className="w-3 h-3" />
                      <span>{tecnico.celular}</span>
                    </div>
                  )}
                  {tecnico.email && (
                    <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                      <Mail className="w-3 h-3" />
                      <span className="truncate max-w-[150px]">{tecnico.email}</span>
                    </div>
                  )}
                </div>
               </td>
              <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                {tecnico.cedula || '—'}
               </td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  tecnico.activo 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                }`}>
                  {tecnico.activo ? 'Activo' : 'Inactivo'}
                </span>
               </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onViewDetail(tecnico.id)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    title="Ver detalle"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onEdit(tecnico)}
                    className="text-green-600 hover:text-green-800 dark:text-green-400"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onToggleStatus(tecnico)}
                    className={tecnico.activo ? 'text-yellow-600 hover:text-yellow-800' : 'text-green-600 hover:text-green-800'}
                    title={tecnico.activo ? 'Desactivar' : 'Activar'}
                  >
                    {tecnico.activo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => onDelete(tecnico.id)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
               </td>
             </tr>
          ))}
        </tbody>
       </table>
    </div>
  );
};

export default TecnicoTable;