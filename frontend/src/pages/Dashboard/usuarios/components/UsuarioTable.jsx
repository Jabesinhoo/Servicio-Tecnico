// src/pages/Dashboard/usuarios/components/UsuarioTable.jsx
import React from 'react';
import { Eye, Edit, Trash2, Phone, Mail, UserCheck, UserX } from 'lucide-react';

const roleColors = {
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  tecnico: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  ventas: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  inventario: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  facturacion: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  usuario: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

const roleNames = {
  admin: 'Administrador',
  tecnico: 'Técnico',
  ventas: 'Ventas',
  inventario: 'Inventario',
  facturacion: 'Facturación',
  usuario: 'Usuario',
};

const UsuarioTable = ({ usuarios, loading, onViewDetail, onEdit, onDelete, onToggleStatus, canEdit }) => {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-sm text-gray-500 mt-2">Cargando usuarios...</p>
      </div>
    );
  }

  if (!usuarios || usuarios.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <p className="text-gray-500 dark:text-gray-400">No hay usuarios registrados</p>
        <p className="text-sm text-gray-400 mt-1">Haz clic en "Nuevo Usuario" para comenzar</p>
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
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rol</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estado</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
          {usuarios.map((usuario) => (
            <tr key={usuario.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <td className="px-6 py-4">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {usuario.nombre1} {usuario.apellidos || ''}
                </div>
               </td>
              <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                {usuario.usuario}
               </td>
              <td className="px-6 py-4">
                <div className="space-y-1">
                  {usuario.celular && (
                    <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                      <Phone className="w-3 h-3" />
                      <span>{usuario.celular}</span>
                    </div>
                  )}
                  {usuario.email && (
                    <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                      <Mail className="w-3 h-3" />
                      <span className="truncate max-w-[150px]">{usuario.email}</span>
                    </div>
                  )}
                </div>
               </td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[usuario.rol]}`}>
                  {roleNames[usuario.rol] || usuario.rol}
                </span>
               </td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  usuario.activo 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                }`}>
                  {usuario.activo ? 'Activo' : 'Inactivo'}
                </span>
               </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onViewDetail(usuario.id)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    title="Ver detalle"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {canEdit && (
                    <>
                      <button
                        onClick={() => onEdit(usuario)}
                        className="text-green-600 hover:text-green-800 dark:text-green-400"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onToggleStatus(usuario)}
                        className={usuario.activo ? 'text-yellow-600 hover:text-yellow-800' : 'text-green-600 hover:text-green-800'}
                        title={usuario.activo ? 'Desactivar' : 'Activar'}
                      >
                        {usuario.activo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => onDelete(usuario.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
               </td>
             </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UsuarioTable;