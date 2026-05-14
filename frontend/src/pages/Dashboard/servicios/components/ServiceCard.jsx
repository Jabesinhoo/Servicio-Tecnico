// src/pages/Dashboard/servicios/components/ServiceCard.jsx
import React from 'react';
import { Calendar, Clock, User, MapPin, AlertCircle, CheckCircle, XCircle, Eye, Edit, Trash2, Building, Users, Wrench, Briefcase } from 'lucide-react';
import StatusBadge from '../StatusBadge';  // ← Ruta corregida (subir un nivel)

const ServiceCard = ({ servicio, onViewDetail, onEdit, onDelete, onApprove, onReject, canEdit, userRole }) => {
  const getPriorityColor = (prioridad) => {
    const colors = {
      baja: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      normal: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      alta: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      urgente: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    };
    return colors[prioridad] || 'bg-gray-100 text-gray-800';
  };

  const getOriginIcon = (origen) => {
    const icons = {
      local: <Building className="w-3 h-3" />,
      ventas: <Users className="w-3 h-3" />,
      tecnico: <Wrench className="w-3 h-3" />,
      proyecto: <Briefcase className="w-3 h-3" />
    };
    return icons[origen] || <Building className="w-3 h-3" />;
  };

  const getOriginLabel = (origen) => {
    const labels = {
      local: 'Local',
      ventas: 'Ventas',
      tecnico: 'Técnico',
      proyecto: 'Proyecto'
    };
    return labels[origen] || 'Local';
  };

  const isPending = servicio.estado === 'pendiente';
  const isRechazado = servicio.estado === 'rechazado';
  const isAprobado = servicio.estado === 'aprobado';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {servicio.codigo_os}
            </h3>
            <StatusBadge status={servicio.estado} />
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${getPriorityColor(servicio.prioridad)}`}>
              <AlertCircle className="w-3 h-3" />
              {servicio.prioridad?.toUpperCase()}
            </span>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
            {servicio.descripcion_inicial || 'Sin descripción'}
          </p>
          
          <div className="space-y-1.5 text-xs">
            <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <User className="w-3.5 h-3.5" />
              {servicio.cliente_nombre || 'Cliente no especificado'}
            </p>
            <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
              {getOriginIcon(servicio.origen)}
              Origen: {getOriginLabel(servicio.origen)}
            </p>
            {servicio.fecha_agendada && (
              <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(servicio.fecha_agendada).toLocaleDateString()}
                {servicio.hora_inicio_agendada && (
                  <span className="ml-2 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {servicio.hora_inicio_agendada}
                  </span>
                )}
              </p>
            )}
            {servicio.tecnico_nombre && (
              <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <User className="w-3.5 h-3.5" />
                Técnico: {servicio.tecnico_nombre}
              </p>
            )}
          </div>

          {isRechazado && servicio.motivo_rechazo && (
            <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">Motivo de rechazo:</p>
              <p className="text-xs text-red-600 dark:text-red-400">{servicio.motivo_rechazo}</p>
            </div>
          )}

          {isAprobado && !servicio.tecnico_nombre && (
            <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-xs text-yellow-600 dark:text-yellow-400">Pendiente de asignación de técnico</p>
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-1 ml-2">
          <button
            onClick={() => onViewDetail(servicio.id)}
            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            title="Ver detalle"
          >
            <Eye className="w-4 h-4" />
          </button>
          {canEdit && (
            <>
              <button
                onClick={() => onEdit(servicio)}
                className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                title="Editar"
              >
                <Edit className="w-4 h-4" />
              </button>
              {userRole === 'admin' && isPending && (
                <>
                  <button
                    onClick={() => onApprove(servicio.id)}
                    className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                    title="Aprobar"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onReject(servicio.id)}
                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                    title="Rechazar"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </>
              )}
              <button
                onClick={() => onDelete(servicio)}
                className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
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

export default ServiceCard;