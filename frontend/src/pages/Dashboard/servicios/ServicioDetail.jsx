// src/pages/Dashboard/servicios/ServicioDetail.jsx
import React, { useState, useEffect } from 'react';
import { X, User, Calendar, Clock, Package, Wrench, CheckCircle, AlertCircle, MapPin, Building, Phone, Mail, FileText, DollarSign, CheckCircle as ApproveIcon, XCircle, Edit } from 'lucide-react';
import api from '../../../services/api';
import StatusBadge from './StatusBadge';
import MaterialesPanel from './components/MaterialesPanel';

const ServicioDetail = ({ isOpen, onClose, servicioId, onRefresh }) => {
  const [servicio, setServicio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  const [tecnicos, setTecnicos] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAgendarModal, setShowAgendarModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectMotivo, setRejectMotivo] = useState('');
  const [agendamiento, setAgendamiento] = useState({
    fecha_agendada: '',
    hora_inicio: '09:00',
    duracion_estimada: 60
  });

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.rol === 'admin';

  useEffect(() => {
    if (isOpen && servicioId) {
      fetchServicio();
      fetchTecnicos();
    }
  }, [isOpen, servicioId]);

  const fetchServicio = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/service-orders/${servicioId}`);
      setServicio(res.data);
    } catch (error) {
      console.error('Error fetching servicio:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTecnicos = async () => {
    try {
      const res = await api.get('/api/users?rol=tecnico');
      setTecnicos(res.data || []);
    } catch (error) {
      console.error('Error fetching tecnicos:', error);
    }
  };

  const handleAssignTech = async (tecnicoId) => {
    try {
      await api.patch(`/api/service-orders/${servicioId}/assign`, { tecnico_id: tecnicoId });
      await fetchServicio();
      setShowAssignModal(false);
      onRefresh();
    } catch (error) {
      console.error('Error assigning tech:', error);
    }
  };

  const handleApprove = async () => {
    try {
      await api.patch(`/api/service-orders/${servicioId}/approve`);
      await fetchServicio();
      setShowApproveModal(false);
      onRefresh();
    } catch (error) {
      console.error('Error approving service:', error);
    }
  };

  const handleReject = async () => {
    if (!rejectMotivo.trim()) {
      alert('Debe ingresar un motivo de rechazo');
      return;
    }
    try {
      await api.patch(`/api/service-orders/${servicioId}/reject`, { motivo: rejectMotivo });
      await fetchServicio();
      setShowRejectModal(false);
      setRejectMotivo('');
      onRefresh();
    } catch (error) {
      console.error('Error rejecting service:', error);
    }
  };

  const handleAgendar = async () => {
    try {
      await api.put(`/api/agenda/servicio/${servicioId}`, agendamiento);
      await fetchServicio();
      setShowAgendarModal(false);
      onRefresh();
    } catch (error) {
      console.error('Error agendando:', error);
    }
  };

  const handleChangeStatus = async (newStatus) => {
    try {
      await api.patch(`/api/service-orders/${servicioId}/status`, { estado: newStatus });
      await fetchServicio();
      onRefresh();
    } catch (error) {
      console.error('Error changing status:', error);
    }
  };

  const tabs = [
    { id: 'info', label: 'Información', icon: FileText },
    { id: 'servicios', label: 'Servicios', icon: Wrench },
    { id: 'materiales', label: 'Materiales', icon: Package },
    { id: 'tiempos', label: 'Tiempos', icon: Clock },
  ];

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full p-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!servicio) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {servicio.codigo_os}
                </h3>
                <StatusBadge status={servicio.estado} />
                <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full ${
                  servicio.prioridad === 'urgente' ? 'bg-red-100 text-red-800' :
                  servicio.prioridad === 'alta' ? 'bg-orange-100 text-orange-800' :
                  servicio.prioridad === 'baja' ? 'bg-green-100 text-green-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {servicio.prioridad?.toUpperCase() || 'NORMAL'}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Creado: {new Date(servicio.createdAt).toLocaleString()}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex gap-4 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-2 px-1 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6">
          {/* Tab Información */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* Datos del Cliente */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Building className="w-4 h-4 text-blue-600" />
                  Cliente
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Nombre</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {servicio.cliente_nombre || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Documento</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {servicio.cliente_documento || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Teléfono</p>
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-gray-400" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {servicio.cliente_telefono || '—'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <div className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-gray-400" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {servicio.cliente_email || '—'}
                      </p>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500">Dirección</p>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {servicio.cliente_direccion || '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Asignación y Agenda */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  Asignación y Agenda
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Técnico Asignado</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {servicio.tecnico_nombre || 'Sin asignar'}
                      </p>
                      {isAdmin && !servicio.tecnico_nombre && servicio.estado === 'aprobado' && (
                        <button
                          onClick={() => setShowAssignModal(true)}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Asignar
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Fecha Agendada</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {servicio.fecha_agendada 
                          ? new Date(servicio.fecha_agendada).toLocaleDateString()
                          : 'No agendado'}
                      </p>
                      {isAdmin && (
                        <button
                          onClick={() => setShowAgendarModal(true)}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          {servicio.fecha_agendada ? 'Reagendar' : 'Agendar'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Hora de Inicio</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {servicio.hora_inicio_agendada || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Duración Estimada</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {servicio.duracion_estimada ? `${servicio.duracion_estimada} minutos` : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Descripción del Servicio */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-blue-600" />
                  Descripción del Servicio
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {servicio.descripcion_inicial || 'Sin descripción'}
                </p>
                {servicio.diagnostico_final && (
                  <div className="border-t border-gray-200 dark:border-gray-700 my-3 pt-3">
                    <p className="text-xs text-gray-500 mb-1">Diagnóstico Final</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {servicio.diagnostico_final}
                    </p>
                  </div>
                )}
              </div>

              {/* Motivo de Rechazo */}
              {servicio.estado === 'rechazado' && servicio.motivo_rechazo && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                  <h4 className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    Motivo de Rechazo
                  </h4>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {servicio.motivo_rechazo}
                  </p>
                </div>
              )}

              {/* Notas */}
              {servicio.observaciones && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Observaciones
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {servicio.observaciones}
                  </p>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex flex-wrap gap-3 pt-4">
                {isAdmin && servicio.estado === 'pendiente' && (
                  <>
                    <button
                      onClick={() => setShowApproveModal(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      <ApproveIcon className="w-4 h-4" />
                      Aprobar
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Rechazar
                    </button>
                  </>
                )}
                {servicio.estado === 'aprobado' && !servicio.tecnico_nombre && (
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Asignar Técnico
                  </button>
                )}
                {servicio.estado === 'asignada' && (
                  <button
                    onClick={() => handleChangeStatus('en_ejecucion')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Iniciar Servicio
                  </button>
                )}
                {servicio.estado === 'en_ejecucion' && (
                  <>
                    <button
                      onClick={() => setActiveTab('materiales')}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      Registrar Materiales
                    </button>
                    <button
                      onClick={() => handleChangeStatus('cerrada')}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Completar Servicio
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Tab Servicios */}
          {activeTab === 'servicios' && (
            <div className="space-y-4">
              {servicio.servicios && servicio.servicios.length > 0 ? (
                servicio.servicios.map((s, idx) => (
                  <div key={idx} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      {s.tipo_servicio_nombre || `Servicio ${idx + 1}`}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {s.descripcion_problema}
                    </p>
                    {s.equipo_relacionado && (
                      <p className="text-xs text-gray-500">Equipo: {s.equipo_relacionado}</p>
                    )}
                    {s.precio_estimado > 0 && (
                      <p className="text-xs text-gray-500">Precio estimado: ${s.precio_estimado.toLocaleString()}</p>
                    )}
                    {s.repuestos_necesarios && (
                      <p className="text-xs text-gray-500 mt-2">Repuestos: {s.repuestos_necesarios}</p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">No hay servicios registrados</div>
              )}
            </div>
          )}

          {/* Tab Materiales */}
          {activeTab === 'materiales' && (
            <MaterialesPanel 
              servicioId={servicioId}
              tecnicoId={servicio.tecnico_id}
              isAdmin={isAdmin}
              onRefresh={fetchServicio}
            />
          )}

          {/* Tab Tiempos */}
          {activeTab === 'tiempos' && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
              <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Módulo de tiempos en desarrollo</p>
              <p className="text-xs text-gray-400 mt-1">Próximamente: registro de horas trabajadas</p>
            </div>
          )}
        </div>

        {/* Modal Asignar Técnico */}
        {showAssignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
              <div className="px-6 py-4 border-b flex justify-between">
                <h3 className="text-lg font-semibold">Asignar Técnico</h3>
                <button onClick={() => setShowAssignModal(false)}>✕</button>
              </div>
              <div className="p-6">
                <select
                  onChange={(e) => handleAssignTech(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  defaultValue=""
                >
                  <option value="" disabled>Seleccionar técnico...</option>
                  {tecnicos.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nombre1} {t.apellidos || ''} - {t.usuario}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Modal Agendar */}
        {showAgendarModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
              <div className="px-6 py-4 border-b flex justify-between">
                <h3 className="text-lg font-semibold">Agendar Servicio</h3>
                <button onClick={() => setShowAgendarModal(false)}>✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha</label>
                  <input
                    type="date"
                    value={agendamiento.fecha_agendada}
                    onChange={(e) => setAgendamiento({ ...agendamiento, fecha_agendada: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Hora de Inicio</label>
                  <input
                    type="time"
                    value={agendamiento.hora_inicio}
                    onChange={(e) => setAgendamiento({ ...agendamiento, hora_inicio: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Duración Estimada</label>
                  <select
                    value={agendamiento.duracion_estimada}
                    onChange={(e) => setAgendamiento({ ...agendamiento, duracion_estimada: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value={30}>30 minutos</option>
                    <option value={60}>1 hora</option>
                    <option value={90}>1.5 horas</option>
                    <option value={120}>2 horas</option>
                    <option value={180}>3 horas</option>
                    <option value={240}>4 horas</option>
                  </select>
                </div>
              </div>
              <div className="px-6 py-4 border-t flex justify-end gap-3">
                <button onClick={() => setShowAgendarModal(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
                <button onClick={handleAgendar} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Guardar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Aprobar */}
        {showApproveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
              <div className="px-6 py-4 border-b flex justify-between">
                <h3 className="text-lg font-semibold">Aprobar Servicio</h3>
                <button onClick={() => setShowApproveModal(false)}>✕</button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600">¿Estás seguro de aprobar este servicio?</p>
                <p className="text-xs text-gray-500 mt-2">Se podrá asignar un técnico después de la aprobación.</p>
              </div>
              <div className="px-6 py-4 border-t flex justify-end gap-3">
                <button onClick={() => setShowApproveModal(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
                <button onClick={handleApprove} className="px-4 py-2 bg-green-600 text-white rounded-lg">Aprobar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Rechazar */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
              <div className="px-6 py-4 border-b flex justify-between">
                <h3 className="text-lg font-semibold">Rechazar Servicio</h3>
                <button onClick={() => setShowRejectModal(false)}>✕</button>
              </div>
              <div className="p-6">
                <label className="block text-sm font-medium mb-2">Motivo del rechazo *</label>
                <textarea
                  value={rejectMotivo}
                  onChange={(e) => setRejectMotivo(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Especifique la razón por la que se rechaza este servicio..."
                />
              </div>
              <div className="px-6 py-4 border-t flex justify-end gap-3">
                <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
                <button onClick={handleReject} className="px-4 py-2 bg-red-600 text-white rounded-lg">Rechazar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServicioDetail;