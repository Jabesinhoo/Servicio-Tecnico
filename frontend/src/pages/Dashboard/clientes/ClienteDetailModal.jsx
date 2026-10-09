// src/pages/Dashboard/clientes/ClienteDetailModal.jsx
import React, { useState, useEffect } from 'react';
import { X, User, Building, Phone, Mail, MapPin, FileText, CreditCard, Calendar, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import api from '../../../services/api';
import ClientProfilePanel from '../servicios/components/ClientProfilePanel';

const ClienteDetailModal = ({ isOpen, onClose, clienteId }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [profile,setProfile]=useState(null);
  const [error,setError]=useState('');
  const [statsWarning,setStatsWarning]=useState('');

  useEffect(() => {
    if(!isOpen||!clienteId)return;
    let active=true;
    const id=typeof clienteId==='object'?clienteId.id:clienteId;
    const origin=clienteId?.origin||'local';
    setLoading(true);setStats(null);setProfile(null);setError('');setStatsWarning('');
    (async()=>{
      try{
        const response=await api.get(`/api/clients/${id}/profile`,{params:{origin}});
        if(!active)return;
        const data=response.data.data;setProfile(data);
        setStats({cliente:data});
        if(origin!=='melissa') {
          try { const result=await api.get(`/api/clients/${id}/stats`);if(active)setStats({...result.data,cliente:data}); }
          catch { if(active)setStatsWarning('La ficha está disponible. No fue posible cargar las estadísticas de servicios.'); }
        }
      }catch(e){if(active)setError(e.response?.data?.message||'No se pudo cargar el detalle del cliente.');}
      finally{if(active)setLoading(false);}
    })();
    return ()=>{active=false;};
  },[isOpen,clienteId]);

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="workflow-theme fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 accent-border"></div>
          </div>
        </div>
      </div>
    );
  }

  const cliente = profile || stats?.cliente;
  if (!cliente) return <div className="workflow-theme fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><div className="bg-white dark:bg-gray-900 rounded-xl p-6"><p role="alert">{error}</p><button onClick={onClose} className="mt-4 underline">Cerrar</button></div></div>;

  const esJuridico = cliente.tipo_persona === 'juridica';

  return (
    <div className="workflow-theme fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {cliente.nombre_completo || cliente.razon_social || [cliente.primer_nombre,cliente.segundo_nombre,cliente.primer_apellido,cliente.segundo_apellido].filter(Boolean).join(' ')}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                cliente.activo 
                  ? 'accent-soft accent-text dark:accent-soft dark:accent-text'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
              }`}>
                {cliente.activo ? 'Activo' : 'Inactivo'}
              </span>
              <span className="text-xs text-gray-500">
                {esJuridico ? 'Persona Jurídica' : 'Persona Natural'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {statsWarning && <p role="status" className="text-sm text-gray-500">{statsWarning}</p>}
          <ClientProfilePanel profile={profile} />
          {/* Información General */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 accent-text" />
              Información General
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Documento</p>
                <p className="text-sm font-medium">
                  {String(cliente.tipo_documento ?? '').toUpperCase()} {cliente.documento}
                  {cliente.digito_verificacion && `-${cliente.digito_verificacion}`}
                </p>
              </div>
              {esJuridico ? (
                <div>
                  <p className="text-xs text-gray-500">Razón Social</p>
                  <p className="text-sm font-medium">{cliente.razon_social}</p>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-gray-500">Nombres</p>
                    <p className="text-sm font-medium">{cliente.primer_nombre} {cliente.segundo_nombre || ''}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Apellidos</p>
                    <p className="text-sm font-medium">{cliente.primer_apellido} {cliente.segundo_apellido || ''}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Contacto */}
          {(cliente.telefono || cliente.email) && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Phone className="w-4 h-4 accent-text" />
                Contacto
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cliente.telefono && (
                  <div>
                    <p className="text-xs text-gray-500">Teléfono</p>
                    <p className="text-sm font-medium">{cliente.telefono}</p>
                  </div>
                )}
                {cliente.telefono_2 && (
                  <div>
                    <p className="text-xs text-gray-500">Teléfono 2</p>
                    <p className="text-sm font-medium">{cliente.telefono_2}</p>
                  </div>
                )}
                {cliente.email && (
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm font-medium">{cliente.email}</p>
                  </div>
                )}
                {cliente.email_2 && (
                  <div>
                    <p className="text-xs text-gray-500">Email 2</p>
                    <p className="text-sm font-medium">{cliente.email_2}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dirección */}
          {(cliente.direccion || cliente.ciudad) && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 accent-text" />
                Dirección
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cliente.direccion && (
                  <div>
                    <p className="text-xs text-gray-500">Dirección</p>
                    <p className="text-sm font-medium">{cliente.direccion}</p>
                  </div>
                )}
                {cliente.direccion_2 && (
                  <div>
                    <p className="text-xs text-gray-500">Dirección 2</p>
                    <p className="text-sm font-medium">{cliente.direccion_2}</p>
                  </div>
                )}
                {cliente.ciudad && (
                  <div>
                    <p className="text-xs text-gray-500">Ciudad</p>
                    <p className="text-sm font-medium">{cliente.ciudad}</p>
                  </div>
                )}
                {cliente.codigo_postal && (
                  <div>
                    <p className="text-xs text-gray-500">Código Postal</p>
                    <p className="text-sm font-medium">{cliente.codigo_postal}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Configuración Fiscal */}
          {clienteId?.origin !== 'melissa' && <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Building className="w-4 h-4 accent-text" />
              Configuración Fiscal
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                {cliente.responsable_iva ? (
                  <CheckCircle className="w-4 h-4 accent-text" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
                <span className="text-sm">Responsable de IVA</span>
              </div>
              <div className="flex items-center gap-2">
                {cliente.autoretenedor ? (
                  <CheckCircle className="w-4 h-4 accent-text" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
                <span className="text-sm">Autoretenedor</span>
              </div>
              <div className="flex items-center gap-2">
                {cliente.gran_contribuyente ? (
                  <CheckCircle className="w-4 h-4 accent-text" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
                <span className="text-sm">Gran Contribuyente</span>
              </div>
              {cliente.clasificacion_dian && (
                <div>
                  <p className="text-xs text-gray-500">Clasificación DIAN</p>
                  <p className="text-sm font-medium capitalize">{cliente.clasificacion_dian}</p>
                </div>
              )}
              {cliente.actividad_economica && (
                <div>
                  <p className="text-xs text-gray-500">Actividad Económica</p>
                  <p className="text-sm font-medium">{cliente.actividad_economica}</p>
                </div>
              )}
              {cliente.codigo_ciiu && (
                <div>
                  <p className="text-xs text-gray-500">Código CIIU</p>
                  <p className="text-sm font-medium">{cliente.codigo_ciiu}</p>
                </div>
              )}
            </div>
          </div>}

          {/* Crédito y Comercial */}
          {(cliente.plazo_credito > 0 || cliente.cupo_credito > 0 || cliente.lista_precios || cliente.forma_pago) && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4 accent-text" />
                Crédito y Comercial
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cliente.plazo_credito > 0 && (
                  <div>
                    <p className="text-xs text-gray-500">Plazo de Crédito</p>
                    <p className="text-sm font-medium">{cliente.plazo_credito} días</p>
                  </div>
                )}
                {cliente.cupo_credito > 0 && (
                  <div>
                    <p className="text-xs text-gray-500">Cupo de Crédito</p>
                    <p className="text-sm font-medium">${Number(cliente.cupo_credito).toLocaleString()}</p>
                  </div>
                )}
                {cliente.lista_precios && (
                  <div>
                    <p className="text-xs text-gray-500">Lista de Precios</p>
                    <p className="text-sm font-medium">{cliente.lista_precios}</p>
                  </div>
                )}
                {cliente.forma_pago && (
                  <div>
                    <p className="text-xs text-gray-500">Forma de Pago</p>
                    <p className="text-sm font-medium">{cliente.forma_pago}</p>
                  </div>
                )}
                {cliente.codigo_worldoffice && (
                  <div>
                    <p className="text-xs text-gray-500">Código WorldOffice</p>
                    <p className="text-sm font-medium">{cliente.codigo_worldoffice}</p>
                  </div>
                )}
                {cliente.fecha_aniversario && (
                  <div>
                    <p className="text-xs text-gray-500">Fecha Aniversario</p>
                    <p className="text-sm font-medium">{new Date(cliente.fecha_aniversario).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Estadísticas de Servicios */}
          {stats?.totalServicios !== undefined && <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 accent-text" />
              Estadísticas de Servicios
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalServicios}</p>
                <p className="text-xs text-gray-500">Total Servicios</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold accent-text">{stats.totalGenerado == null ? 'Sin dato' : '$'+Number(stats.totalGenerado).toLocaleString('es-CO')}</p>
                <p className="text-xs text-gray-500">Total Generado</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{stats.serviciosPendientes}</p>
                <p className="text-xs text-gray-500">Pendientes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold accent-text">{stats.serviciosCompletados}</p>
                <p className="text-xs text-gray-500">Completados</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-xs text-gray-500">Promedio por Servicio</p>
                <p className="text-sm font-semibold">{stats.promedioPorServicio == null ? 'Sin dato' : '$'+Number(stats.promedioPorServicio).toLocaleString('es-CO')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Servicio más caro</p>
                <p className="text-sm font-semibold">{stats.servicioMasCaro == null ? 'Sin dato' : '$'+Number(stats.servicioMasCaro).toLocaleString('es-CO')}</p>
              </div>
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
};

export default ClienteDetailModal;