import React, { useState } from 'react';
import { ClipboardList, LayoutGrid, Plus, RefreshCw, Table2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import ServicioCreateWizard from './servicios/ServicioCreateWizard';
import ServicioDetail from './servicios/ServicioDetail';
import ServicioFilters from './servicios/ServicioFilters';
import ServicioTable from './servicios/ServicioTable';
import AssignTechModal from './servicios/AssignTechModal';
import DeleteServiceModal from './servicios/DeleteServiceModal';
import ServiceCard from './servicios/components/ServiceCard';
import ServiceIntakeBoard from './servicios/components/ServiceIntakeBoard';
import { DEFAULT_FILTERS, useServicios } from './servicios/hooks/useServicios';

export default function Servicios() {
  const { user } = useAuth();
  const userRole = user?.rol || user?.role?.name || 'usuario';
  const isAdmin = userRole === 'admin';
  const canCreate = isAdmin || userRole === 'tecnico';

  const {
    servicios, loading, error, total, pagination,
    filters, setFilters, fetchServicios,
    assignTech, deleteServicio,
  } = useServicios();

  const [viewMode, setViewMode] = useState('table');
  const [showCreate, setShowCreate] = useState(false);
  const [showIntakes, setShowIntakes] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [editService, setEditService] = useState(null);
  const [assignId, setAssignId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleDelete = (service) => {
    if (!service?.id) return;
    setDeleteTarget(service);
  };

  const confirmDelete = async (service, reason) => {
    const result = await deleteServicio(service.id, reason);
    await fetchServicios();
    return result;
  };

  return (
    <div className="workflow-theme responsive-page min-w-0 space-y-4 sm:space-y-5">
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Órdenes de Servicio</h1>
          <p className="text-sm text-gray-500 mt-1">{total} orden(es)</p>
        </div>
        <div className="service-toolbar flex flex-wrap gap-2 min-w-0">
          <div className="flex-wrap flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
            <button onClick={() => setViewMode('table')} className={`p-2 ${viewMode === 'table' ? 'accent-fill text-white' : ''}`} title="Tabla" aria-label="Ver servicios en tabla" aria-pressed={viewMode === 'table'}><Table2 className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('cards')} className={`p-2 ${viewMode === 'cards' ? 'accent-fill text-white' : ''}`} title="Tarjetas" aria-label="Ver servicios en tarjetas" aria-pressed={viewMode === 'cards'}><LayoutGrid className="w-4 h-4" /></button>
          </div>
          <button onClick={() => fetchServicios()} aria-label="Actualizar servicios" title="Actualizar servicios" className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 flex items-center gap-2 text-sm"><RefreshCw className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">Actualizar</span></button>
          {isAdmin && <button onClick={() => setShowIntakes(true)} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 flex items-center gap-2 text-sm"><ClipboardList className="w-4 h-4" />Solicitudes previas</button>}
          {canCreate && <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg accent-fill text-white flex items-center gap-2 text-sm font-medium"><Plus className="w-4 h-4" />Nueva OS</button>}
        </div>
      </header>

      <ServicioFilters
        filters={filters}
        onFilterChange={setFilters}
        onClearFilters={() => setFilters({ ...DEFAULT_FILTERS })}
        onSearch={() => fetchServicios()}
      />

      {error && <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

      {viewMode === 'table' ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <ServicioTable
            servicios={servicios}
            loading={loading}
            onViewDetail={setDetailId}
            onAssignTech={setAssignId}
            onEdit={setEditService}
            onDelete={handleDelete}
            isAdmin={isAdmin}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {loading ? <p className="text-sm text-gray-500">Cargando...</p> : servicios.map((servicio) => (
            <ServiceCard key={servicio.id} servicio={servicio} onViewDetail={setDetailId} onEdit={setEditService} onDelete={handleDelete} canEdit={isAdmin} onAssignTech={setAssignId} />
          ))}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-gray-500">Página {pagination.page} de {pagination.pages}</span>
          <div className="flex-wrap flex gap-2">
            <button disabled={pagination.page <= 1} onClick={() => setFilters({ page: pagination.page - 1 })} aria-label="Página anterior" title="Página anterior" className="icon-action border"><ChevronLeft aria-hidden="true" className="w-5 h-5"/></button>
            <button disabled={pagination.page >= pagination.pages} onClick={() => setFilters({ page: pagination.page + 1 })} aria-label="Página siguiente" title="Página siguiente" className="icon-action border"><ChevronRight aria-hidden="true" className="w-5 h-5"/></button>
          </div>
        </div>
      )}

      <ServicioCreateWizard isOpen={showCreate} onClose={() => setShowCreate(false)} onCreated={fetchServicios} userRole={userRole} />
      <ServiceIntakeBoard isOpen={showIntakes} onClose={() => setShowIntakes(false)} onActivated={fetchServicios} />

      {detailId && <ServicioDetail isOpen servicioId={detailId} onClose={() => setDetailId(null)} onRefresh={fetchServicios} />}
      {editService && (
        <ServicioCreateWizard
          isOpen
          mode="edit"
          serviceId={editService.id}
          service={editService}
          onClose={() => setEditService(null)}
          onSaved={fetchServicios}
          userRole={userRole}
        />
      )}
      <AssignTechModal isOpen={Boolean(assignId)} servicioId={assignId} servicio={servicios.find(s => s.id === assignId)} onClose={() => setAssignId(null)} onSubmit={assignTech} />

      <DeleteServiceModal
        service={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
