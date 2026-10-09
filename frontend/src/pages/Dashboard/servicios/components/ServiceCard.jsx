import React from 'react';
import { Calendar, Clock, Edit, Eye, Trash2, UserRound, UsersRound, Wrench, UserCheck } from 'lucide-react';
import StatusBadge from '../StatusBadge';
import { formatDateOnly, serviceSchedule, formatTime } from '../serviceFormatters';

export default function ServiceCard({ servicio, onViewDetail, onEdit, onDelete, canEdit, onAssignTech }) {
  return (
    <article className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button onClick={() => onViewDetail(servicio.id)} className="font-bold accent-text hover:underline">
            {servicio.codigo_os}
          </button>
          <div className="mt-1"><StatusBadge status={servicio.estado} /></div>
        </div>
        <div className="flex-wrap flex gap-1">
          <button onClick={() => onViewDetail(servicio.id)} className="icon-action accent-text" title="Ver" aria-label="Ver"><Eye className="w-4 h-4" /></button>
          {canEdit && ['aprobado','asignada','cancelado'].includes(servicio.estado) && <button onClick={()=>onAssignTech(servicio.id)} className="icon-action accent-text" title={servicio.estado==='cancelado'?'Reactivar y asignar':'Asignar / reasignar técnico'} aria-label={servicio.estado==='cancelado'?'Reactivar y asignar':'Asignar / reasignar técnico'}><UserCheck className="w-4 h-4" /></button>}
          {canEdit && <button onClick={() => onEdit(servicio)} className="icon-action accent-text" title="Editar" aria-label="Editar"><Edit className="w-4 h-4" /></button>}
          {canEdit && !['cerrada', 'rechazado', 'cancelado'].includes(servicio.estado) && (
            <button onClick={() => onDelete(servicio)} className="icon-action text-red-600" title="Eliminar / cancelar" aria-label="Eliminar / cancelar"><Trash2 className="w-4 h-4" /></button>
          )}
        </div>
      </div>

      <p className="mt-3 text-sm text-gray-700 dark:text-gray-300 line-clamp-3">{servicio.descripcion_inicial || 'Sin descripción'}</p>

      <div className="mt-4 space-y-2 text-xs text-gray-500">
        <div className="flex gap-2"><UserRound className="w-4 h-4" /><span>{servicio.cliente_nombre || '—'} · {servicio.cliente_documento || 'sin documento'}</span></div>
        <div className="flex gap-2"><Wrench className="w-4 h-4" /><span>{servicio.service_type_name || 'Tipo no registrado'}</span></div>
        <div className="flex gap-2"><UsersRound className="w-4 h-4" /><span>{servicio.tecnico_nombre || 'Sin técnico'} {servicio.team_size ? `· equipo ${servicio.team_size}` : ''}</span></div>
        <div className="flex gap-2"><Calendar className="w-4 h-4" /><span>{serviceSchedule(servicio).date ? formatDateOnly(serviceSchedule(servicio).date) : 'Sin agenda'}</span></div>
        <div className="flex gap-2"><Clock className="w-4 h-4" /><span>{servicio.hora_inicio_agendada ? `${formatTime(servicio.hora_inicio_agendada)} · ${servicio.duracion_estimada || 60} min` : '—'}</span></div>
      </div>

      {servicio.invoice_reference && (
        <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs">Factura: <strong>{servicio.invoice_reference}</strong></div>
      )}
    </article>
  );
}
