import React from 'react';
import { Eye, Edit, Trash2, UserCheck } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { formatDateOnly, formatDateTime, formatTime, money, serviceSchedule } from './serviceFormatters';

const priorityClass = {
  baja: 'accent-soft accent-text',
  normal: 'accent-soft accent-text',
  alta: 'bg-orange-100 text-orange-800',
  urgente: 'bg-red-100 text-red-800',
};

export default function ServicioTable({
  servicios,
  loading,
  onViewDetail,
  onAssignTech,
  onEdit,
  onDelete,
  isAdmin = false,
}) {
  if (loading) {
    return <div className="py-12 text-center text-sm text-gray-500">Cargando servicios...</div>;
  }

  if (!servicios?.length) {
    return <div className="py-12 text-center text-sm text-gray-500">No hay órdenes que coincidan con los filtros.</div>;
  }

  return (
    <div className="service-orders-scroll overflow-x-auto min-w-0">
      <table className="service-order-table min-w-[1250px] w-full divide-y divide-gray-200 dark:divide-gray-800">
        <thead className="bg-gray-50 dark:bg-gray-950/60">
          <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">Orden</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Servicio / factura</th>
            <th className="px-4 py-3">Equipo técnico</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Agenda</th>
            <th className="px-4 py-3">Creación</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
          {servicios.map((servicio) => (
            <tr key={servicio.id} className="align-top hover:bg-gray-50 dark:hover:bg-gray-800/60">
              <td data-label="Orden" className="px-4 py-4">
                <button onClick={() => onViewDetail(servicio.id)} className="font-semibold accent-text hover:underline">
                  {servicio.codigo_os}
                </button>
                <div className="mt-1 max-w-[240px] text-xs text-gray-500 line-clamp-2">
                  {servicio.descripcion_inicial || 'Sin descripción'}
                </div>
                <span className={`inline-flex mt-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${priorityClass[servicio.prioridad] || priorityClass.normal}`}>
                  {(servicio.prioridad || 'normal').toUpperCase()}
                </span>
              </td>

              <td data-label="Cliente" className="px-4 py-4 text-sm">
                <div className="font-medium text-gray-900 dark:text-white">{servicio.cliente_nombre || '—'}</div>
                <div className="text-xs text-gray-500">Doc: {servicio.cliente_documento || '—'}</div>
                <div className="text-xs text-gray-500">{servicio.cliente_telefono || servicio.cliente_email || 'Sin contacto'}</div>
              </td>

              <td data-label="Servicio / factura" className="px-4 py-4 text-sm">
                <div className="font-medium">{servicio.service_type_name || '—'}</div>
                <div className="text-xs text-gray-500">Factura: {servicio.invoice_reference || '—'}</div>
                {servicio.base_value !== null && servicio.base_value !== undefined && (
                  <div className="text-xs text-gray-500">Base: {money(servicio.base_value)}</div>
                )}
              </td>

              <td data-label="Equipo técnico" className="px-4 py-4 text-sm">
                <div>{servicio.tecnico_nombre || 'Sin principal'}</div>
                <div className="text-xs text-gray-500">Equipo: {Number(servicio.team_size || 0)} técnico(s)</div>
              </td>

              <td data-label="Estado" className="px-4 py-4"><StatusBadge status={servicio.estado} /></td>

              <td data-label="Agenda" className="px-4 py-4 text-sm">
                <div>{serviceSchedule(servicio).date ? formatDateOnly(serviceSchedule(servicio).date) : 'Sin agendar'}</div>
                <div className="text-xs text-gray-500">
                  {servicio.hora_inicio_agendada ? `${formatTime(serviceSchedule(servicio).time)} · ${servicio.duracion_estimada || 60} min` : '—'}
                </div>
              </td>

              <td data-label="Creación" className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                {formatDateTime(servicio.createdAt)}
              </td>

              <td data-label="Acciones" className="px-4 py-4">
                <div className="flex-wrap flex justify-end gap-1">
                  <button onClick={() => onViewDetail(servicio.id)} className="icon-action rounded-lg accent-text hover:accent-soft dark:hover:accent-soft" title="Ver detalle" aria-label="Ver detalle">
                    <Eye className="w-4 h-4" />
                  </button>
                  {isAdmin && (
                    <button onClick={() => onEdit(servicio)} className="icon-action rounded-lg accent-text hover:accent-soft dark:hover:accent-soft" title="Editar" aria-label="Editar">
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  {isAdmin && !servicio.tecnico_id && !['cancelado', 'cerrada', 'rechazado'].includes(servicio.estado) && (
                    <button onClick={() => onAssignTech(servicio.id)} className="icon-action rounded-lg accent-text hover:accent-soft dark:hover:accent-soft" title="Asignar técnico" aria-label="Asignar técnico">
                      <UserCheck className="w-4 h-4" />
                    </button>
                  )}
                  {isAdmin && !['cerrada', 'rechazado', 'cancelado'].includes(servicio.estado) && (
                    <button onClick={() => onDelete(servicio)} className="icon-action rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950" title="Eliminar / cancelar" aria-label="Eliminar / cancelar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
