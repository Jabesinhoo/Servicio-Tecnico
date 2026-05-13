// src/pages/Dashboard/servicios/ServicioForm.jsx
import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import { 
  X, Save, Search, User, Phone, Mail, MapPin, Building, 
  Calendar, Clock, AlertCircle, FileText, Wrench, CheckSquare, 
  Truck, Plus, Trash2, DollarSign, Package, Tool, ClipboardList 
} from 'lucide-react';

const ServicioForm = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    cliente: {
      primer_nombre: '',
      segundo_nombre: '',
      primer_apellido: '',
      segundo_apellido: '',
      telefono: '',
      email: '',
      direccion: '',
      codigo_worldoffice: '',
    },
    facturacion: {
      tipo_documento: 'cedula',
      numero_documento: '',
      razon_social: '',
      requiere_factura_electronica: false,
      medio_pago: '',
    },
    ubicacion: {
      lugar_servicio: 'local',
      direccion: '',
      ciudad_barrio: '',
      referencia: '',
    },
    programacion: {
      requiere_agendamiento: false,
      fecha_agendada: '',
      hora_inicio: '09:00',
      duracion_estimada: 60,
      tecnico_id: '',
      prioridad: 'normal',
    },
    servicios: [{
      tipo_servicio: '',
      equipo_relacionado: '',
      descripcion_problema: '',
      observaciones: '',
      precio_estimado: '',
      requiere_diagnostico: false,
      requiere_repuestos: false,
    }],
    notas: {
      observaciones_tecnico: '',
      notas_internas: '',
    }
  });

  const [tecnicos, setTecnicos] = useState([]);
  const [tiposServicioData, setTiposServicioData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [searchClienteTerm, setSearchClienteTerm] = useState('');
  const [clientesEncontrados, setClientesEncontrados] = useState([]);
  const [showClienteSearch, setShowClienteSearch] = useState(false);
  const [searchingClient, setSearchingClient] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [tiposServicioCargados, setTiposServicioCargados] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTecnicos();
      fetchTiposServicio();
    }
  }, [isOpen]);

  const fetchTecnicos = async () => {
    try {
      const res = await api.get('/api/users?rol=tecnico');
      setTecnicos(res.data || []);
    } catch (error) {
      console.error('Error fetching tecnicos:', error);
    }
  };

  const fetchTiposServicio = async () => {
    try {
      const res = await api.get('/api/tipos-servicio/activos');
      setTiposServicioData(res.data || []);
      setTiposServicioCargados(true);
    } catch (error) {
      console.error('Error fetching tipos servicio:', error);
    }
  };

  const buscarCliente = async () => {
    if (searchClienteTerm.length < 2) {
      setErrors({ search: 'Ingrese al menos 2 caracteres para buscar' });
      return;
    }
    
    setSearchingClient(true);
    try {
      const res = await api.get(`/api/clients/search?q=${encodeURIComponent(searchClienteTerm)}`);
      setClientesEncontrados(res.data || []);
      setShowClienteSearch(true);
      setErrors({});
    } catch (error) {
      console.error('Error searching client:', error);
      setClientesEncontrados([]);
    } finally {
      setSearchingClient(false);
    }
  };

  const seleccionarCliente = (cliente) => {
    // Verificar si es persona natural o jurídica
    const esJuridica = cliente.tipo_persona === 'juridica';
    
    setFormData(prev => ({
      ...prev,
      cliente: {
        primer_nombre: esJuridica ? '' : (cliente.primer_nombre || ''),
        segundo_nombre: esJuridica ? '' : (cliente.segundo_nombre || ''),
        primer_apellido: esJuridica ? '' : (cliente.primer_apellido || ''),
        segundo_apellido: esJuridica ? '' : (cliente.segundo_apellido || ''),
        telefono: cliente.telefono || '',
        email: cliente.email || '',
        direccion: cliente.direccion || '',
        codigo_worldoffice: cliente.codigo_worldoffice || '',
      },
      facturacion: {
        ...prev.facturacion,
        tipo_documento: cliente.tipo_documento || 'cedula',
        numero_documento: cliente.documento || '',
        razon_social: esJuridica ? cliente.razon_social : `${cliente.primer_nombre || ''} ${cliente.primer_apellido || ''}`.trim(),
      }
    }));
    setShowClienteSearch(false);
    setSearchClienteTerm('');
    setClientesEncontrados([]);
  };

  const handleClienteChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      cliente: { ...prev.cliente, [field]: value }
    }));
  };

  const handleFacturacionChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      facturacion: { ...prev.facturacion, [field]: value }
    }));
  };

  const handleUbicacionChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      ubicacion: { ...prev.ubicacion, [field]: value }
    }));
  };

  const handleProgramacionChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      programacion: { ...prev.programacion, [field]: value }
    }));
  };

  const handleNotaChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      notas: { ...prev.notas, [field]: value }
    }));
  };

  const handleServicioChange = (index, field, value) => {
    const nuevosServicios = [...formData.servicios];
    nuevosServicios[index] = { ...nuevosServicios[index], [field]: value };
    setFormData(prev => ({
      ...prev,
      servicios: nuevosServicios
    }));
  };

  const cargarTipoServicio = (index, tipoId) => {
    const tipoSeleccionado = tiposServicioData.find(t => t.id === tipoId);
    if (tipoSeleccionado) {
      handleServicioChange(index, 'tipo_servicio', tipoSeleccionado.nombre);
      handleServicioChange(index, 'precio_estimado', tipoSeleccionado.valor_base);
      handleServicioChange(index, 'requiere_diagnostico', tipoSeleccionado.requiere_diagnostico);
      handleServicioChange(index, 'requiere_repuestos', tipoSeleccionado.requiere_repuestos);
      
      // Si tiene duración estimada, actualizar también
      if (tipoSeleccionado.duracion_estimada && formData.programacion.requiere_agendamiento) {
        handleProgramacionChange('duracion_estimada', tipoSeleccionado.duracion_estimada);
      }
    }
  };

  const agregarServicio = () => {
    setFormData(prev => ({
      ...prev,
      servicios: [...prev.servicios, {
        tipo_servicio: '',
        equipo_relacionado: '',
        descripcion_problema: '',
        observaciones: '',
        precio_estimado: '',
        requiere_diagnostico: false,
        requiere_repuestos: false,
      }]
    }));
  };

  const eliminarServicio = (index) => {
    if (formData.servicios.length === 1) {
      setErrors({ servicios: 'Debe tener al menos un servicio' });
      return;
    }
    const nuevosServicios = [...formData.servicios];
    nuevosServicios.splice(index, 1);
    setFormData(prev => ({
      ...prev,
      servicios: nuevosServicios
    }));
    setErrors({});
  };

  const validateStep = (step) => {
    const newErrors = {};
    
    if (step === 1) {
      if (!formData.cliente.primer_nombre.trim()) newErrors.primer_nombre = 'El primer nombre es requerido';
      if (!formData.cliente.primer_apellido.trim()) newErrors.primer_apellido = 'El primer apellido es requerido';
      if (!formData.cliente.telefono.trim()) newErrors.telefono = 'El teléfono es requerido';
      if (!formData.facturacion.numero_documento.trim()) newErrors.numero_documento = 'El número de documento es requerido';
    }
    
    if (step === 2) {
      if (!formData.ubicacion.lugar_servicio) newErrors.lugar_servicio = 'El lugar del servicio es requerido';
      if (formData.ubicacion.lugar_servicio === 'fuera' && !formData.ubicacion.direccion.trim()) {
        newErrors.direccion_servicio = 'La dirección es requerida para servicio fuera del local';
      }
      if (!formData.programacion.prioridad) newErrors.prioridad = 'La prioridad es requerida';
    }
    
    if (step === 3) {
      let servicioValido = false;
      formData.servicios.forEach((servicio, idx) => {
        if (!servicio.tipo_servicio.trim()) {
          newErrors[`tipo_servicio_${idx}`] = 'El tipo de servicio es requerido';
        }
        if (!servicio.descripcion_problema.trim()) {
          newErrors[`descripcion_problema_${idx}`] = 'La descripción del problema es requerida';
        }
        if (servicio.tipo_servicio.trim() && servicio.descripcion_problema.trim()) {
          servicioValido = true;
        }
      });
      if (!servicioValido) {
        newErrors.servicios = 'Debe agregar al menos un servicio completo';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep(3)) return;
    
    setLoading(true);
    try {
      // Preparar datos para el backend
      const submitData = {
        cliente: formData.cliente,
        facturacion: formData.facturacion,
        ubicacion: formData.ubicacion,
        programacion: {
          ...formData.programacion,
          fecha_agendada: formData.programacion.requiere_agendamiento ? formData.programacion.fecha_agendada : null,
        },
        servicios: formData.servicios,
        notas: formData.notas,
      };
      
      await onSubmit(submitData);
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error submitting form:', error);
      setErrors({ submit: error.response?.data?.message || 'Error al crear la orden de servicio' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      cliente: { primer_nombre: '', segundo_nombre: '', primer_apellido: '', segundo_apellido: '', telefono: '', email: '', direccion: '', codigo_worldoffice: '' },
      facturacion: { tipo_documento: 'cedula', numero_documento: '', razon_social: '', requiere_factura_electronica: false, medio_pago: '' },
      ubicacion: { lugar_servicio: 'local', direccion: '', ciudad_barrio: '', referencia: '' },
      programacion: { requiere_agendamiento: false, fecha_agendada: '', hora_inicio: '09:00', duracion_estimada: 60, tecnico_id: '', prioridad: 'normal' },
      servicios: [{ tipo_servicio: '', equipo_relacionado: '', descripcion_problema: '', observaciones: '', precio_estimado: '', requiere_diagnostico: false, requiere_repuestos: false }],
      notas: { observaciones_tecnico: '', notas_internas: '' }
    });
    setErrors({});
    setCurrentStep(1);
    setSearchClienteTerm('');
    setClientesEncontrados([]);
    setShowClienteSearch(false);
  };

  if (!isOpen) return null;

  const prioridades = [
    { value: 'baja', label: 'Baja', color: 'bg-green-100 text-green-800' },
    { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-800' },
    { value: 'alta', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
    { value: 'urgente', label: 'Urgente', color: 'bg-red-100 text-red-800' },
  ];

  const tiposServicioList = tiposServicioData.map(t => ({ value: t.id, label: t.nombre }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header con stepper */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Nueva Orden de Servicio
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Complete los campos obligatorios para crear la orden
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Stepper */}
          <div className="flex items-center justify-between max-w-md mx-auto">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    currentStep >= step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                  }`}
                >
                  {step}
                </div>
                {step < 3 && (
                  <div className={`w-16 h-0.5 mx-2 ${
                    currentStep > step ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Datos del Cliente</span>
            <span>Ubicación y Programación</span>
            <span>Servicios</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Error general */}
          {errors.submit && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {errors.submit}
            </div>
          )}

          {/* PASO 1: DATOS DEL CLIENTE Y FACTURACIÓN */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Datos del Cliente */}
              <section className="border-b border-gray-200 dark:border-gray-700 pb-6">
                <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  Datos del Cliente
                  <span className="text-xs text-red-500 font-normal ml-2">* Campos obligatorios</span>
                </h4>
                
                {/* Buscador de cliente existente */}
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Buscar cliente existente
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchClienteTerm}
                        onChange={(e) => setSearchClienteTerm(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && buscarCliente()}
                        placeholder="Nombre, documento o teléfono (mínimo 2 caracteres)..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={buscarCliente}
                      disabled={searchingClient}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {searchingClient ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      Buscar
                    </button>
                  </div>
                  
                  {/* Resultados de búsqueda */}
                  {showClienteSearch && (
                    <div className="mt-3">
                      {clientesEncontrados.length > 0 ? (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                          {clientesEncontrados.map((cliente) => (
                            <button
                              key={cliente.id}
                              type="button"
                              onClick={() => seleccionarCliente(cliente)}
                              className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors"
                            >
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {cliente.tipo_persona === 'juridica' ? cliente.razon_social : `${cliente.primer_nombre || ''} ${cliente.primer_apellido || ''}`}
                              </p>
                              <div className="flex gap-4 mt-1">
                                <p className="text-xs text-gray-500">Tel: {cliente.telefono || 'N/A'}</p>
                                <p className="text-xs text-gray-500">Doc: {cliente.documento || 'N/A'}</p>
                                {cliente.email && <p className="text-xs text-gray-500">Email: {cliente.email}</p>}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                          No se encontraron clientes. Complete los datos para crear uno nuevo.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Primer nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.cliente.primer_nombre}
                      onChange={(e) => handleClienteChange('primer_nombre', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 ${
                        errors.primer_nombre ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                      }`}
                    />
                    {errors.primer_nombre && <p className="mt-1 text-xs text-red-500">{errors.primer_nombre}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Segundo nombre
                    </label>
                    <input
                      type="text"
                      value={formData.cliente.segundo_nombre}
                      onChange={(e) => handleClienteChange('segundo_nombre', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Primer apellido <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.cliente.primer_apellido}
                      onChange={(e) => handleClienteChange('primer_apellido', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${
                        errors.primer_apellido ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                      }`}
                    />
                    {errors.primer_apellido && <p className="mt-1 text-xs text-red-500">{errors.primer_apellido}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Segundo apellido
                    </label>
                    <input
                      type="text"
                      value={formData.cliente.segundo_apellido}
                      onChange={(e) => handleClienteChange('segundo_apellido', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Teléfono <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        value={formData.cliente.telefono}
                        onChange={(e) => handleClienteChange('telefono', e.target.value)}
                        className={`w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${
                          errors.telefono ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                        }`}
                      />
                    </div>
                    {errors.telefono && <p className="mt-1 text-xs text-red-500">{errors.telefono}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={formData.cliente.email}
                        onChange={(e) => handleClienteChange('email', e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Dirección principal
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={formData.cliente.direccion}
                        onChange={(e) => handleClienteChange('direccion', e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Código WorldOffice
                    </label>
                    <input
                      type="text"
                      value={formData.cliente.codigo_worldoffice}
                      onChange={(e) => handleClienteChange('codigo_worldoffice', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      placeholder="WO-12345"
                    />
                  </div>
                </div>
              </section>

              {/* Datos de Facturación */}
              <section className="border-b border-gray-200 dark:border-gray-700 pb-6">
                <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Building className="w-5 h-5 text-blue-600" />
                  Datos de Facturación
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tipo de documento <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.facturacion.tipo_documento}
                      onChange={(e) => handleFacturacionChange('tipo_documento', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value="cedula">Cédula</option>
                      <option value="nit">NIT</option>
                      <option value="rut">RUT</option>
                      <option value="pasaporte">Pasaporte</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Número de documento <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.facturacion.numero_documento}
                      onChange={(e) => handleFacturacionChange('numero_documento', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${
                        errors.numero_documento ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                      }`}
                    />
                    {errors.numero_documento && <p className="mt-1 text-xs text-red-500">{errors.numero_documento}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Razón social / Nombre de facturación
                    </label>
                    <input
                      type="text"
                      value={formData.facturacion.razon_social}
                      onChange={(e) => handleFacturacionChange('razon_social', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Requiere factura electrónica
                    </label>
                    <select
                      value={formData.facturacion.requiere_factura_electronica ? 'si' : 'no'}
                      onChange={(e) => handleFacturacionChange('requiere_factura_electronica', e.target.value === 'si')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value="no">No</option>
                      <option value="si">Sí</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Medio de pago
                    </label>
                    <select
                      value={formData.facturacion.medio_pago}
                      onChange={(e) => handleFacturacionChange('medio_pago', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value="">Seleccionar (opcional)</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia bancaria</option>
                      <option value="tarjeta_credito">Tarjeta de crédito</option>
                      <option value="tarjeta_debito">Tarjeta de débito</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* PASO 2: UBICACIÓN Y PROGRAMACIÓN */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Ubicación del Servicio */}
              <section className="border-b border-gray-200 dark:border-gray-700 pb-6">
                <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Ubicación del Servicio
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Lugar del servicio <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="local"
                          checked={formData.ubicacion.lugar_servicio === 'local'}
                          onChange={(e) => handleUbicacionChange('lugar_servicio', e.target.value)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm">En el local</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="fuera"
                          checked={formData.ubicacion.lugar_servicio === 'fuera'}
                          onChange={(e) => handleUbicacionChange('lugar_servicio', e.target.value)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm">Fuera del local / Domicilio</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="remoto"
                          checked={formData.ubicacion.lugar_servicio === 'remoto'}
                          onChange={(e) => handleUbicacionChange('lugar_servicio', e.target.value)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm">Remoto</span>
                      </label>
                    </div>
                    {errors.lugar_servicio && <p className="mt-1 text-xs text-red-500">{errors.lugar_servicio}</p>}
                  </div>
                  
                  {formData.ubicacion.lugar_servicio === 'fuera' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Dirección del servicio <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.ubicacion.direccion}
                          onChange={(e) => handleUbicacionChange('direccion', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${
                            errors.direccion_servicio ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                          }`}
                        />
                        {errors.direccion_servicio && <p className="mt-1 text-xs text-red-500">{errors.direccion_servicio}</p>}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Ciudad / Barrio
                          </label>
                          <input
                            type="text"
                            value={formData.ubicacion.ciudad_barrio}
                            onChange={(e) => handleUbicacionChange('ciudad_barrio', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Referencia de ubicación
                          </label>
                          <input
                            type="text"
                            value={formData.ubicacion.referencia}
                            onChange={(e) => handleUbicacionChange('referencia', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                            placeholder="Casa azul, segundo piso, etc."
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </section>

              {/* Programación */}
              <section className="border-b border-gray-200 dark:border-gray-700 pb-6">
                <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Programación
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Requiere agendamiento
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={formData.programacion.requiere_agendamiento === true}
                          onChange={() => handleProgramacionChange('requiere_agendamiento', true)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm">Sí</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={formData.programacion.requiere_agendamiento === false}
                          onChange={() => handleProgramacionChange('requiere_agendamiento', false)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm">No</span>
                      </label>
                    </div>
                  </div>
                  
                  {formData.programacion.requiere_agendamiento && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Fecha agendada <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={formData.programacion.fecha_agendada}
                          onChange={(e) => handleProgramacionChange('fecha_agendada', e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${
                            errors.fecha_agendada ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                          }`}
                        />
                        {errors.fecha_agendada && <p className="mt-1 text-xs text-red-500">{errors.fecha_agendada}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Hora de inicio
                        </label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="time"
                            value={formData.programacion.hora_inicio}
                            onChange={(e) => handleProgramacionChange('hora_inicio', e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Duración estimada (minutos)
                        </label>
                        <select
                          value={formData.programacion.duracion_estimada}
                          onChange={(e) => handleProgramacionChange('duracion_estimada', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        >
                          <option value={30}>30 minutos</option>
                          <option value={60}>1 hora</option>
                          <option value={90}>1.5 horas</option>
                          <option value={120}>2 horas</option>
                          <option value={180}>3 horas</option>
                          <option value={240}>4 horas</option>
                        </select>
                      </div>
                    </>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Prioridad <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.programacion.prioridad}
                      onChange={(e) => handleProgramacionChange('prioridad', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${
                        errors.prioridad ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                      }`}
                    >
                      {prioridades.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    {errors.prioridad && <p className="mt-1 text-xs text-red-500">{errors.prioridad}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Técnico asignado (opcional)
                    </label>
                    <select
                      value={formData.programacion.tecnico_id}
                      onChange={(e) => handleProgramacionChange('tecnico_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value="">Sin asignar</option>
                      {tecnicos.map(tecnico => (
                        <option key={tecnico.id} value={tecnico.id}>
                          {tecnico.nombre1} {tecnico.apellidos} - {tecnico.usuario}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              {/* Notas */}
              <section className="pb-4">
                <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Notas
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Observaciones para el técnico
                    </label>
                    <textarea
                      value={formData.notas.observaciones_tecnico}
                      onChange={(e) => handleNotaChange('observaciones_tecnico', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      placeholder="Instrucciones específicas para el técnico..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Notas internas
                    </label>
                    <textarea
                      value={formData.notas.notas_internas}
                      onChange={(e) => handleNotaChange('notas_internas', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      placeholder="Información solo visible para administración..."
                    />
                    <p className="text-xs text-gray-500 mt-1">Estas notas solo las verá el equipo administrativo</p>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* PASO 3: SERVICIOS A REALIZAR */}
          {currentStep === 3 && (
            <section className="pb-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-blue-600" />
                  Servicios a Realizar
                </h4>
                <button
                  type="button"
                  onClick={agregarServicio}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Agregar servicio
                </button>
              </div>
              
              {errors.servicios && <p className="mb-3 text-xs text-red-500">{errors.servicios}</p>}
              
              {formData.servicios.map((servicio, idx) => (
                <div key={idx} className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg relative">
                  <button
                    type="button"
                    onClick={() => eliminarServicio(idx)}
                    className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                    title="Eliminar servicio"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Servicio {idx + 1}</h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Tipo de servicio <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={servicio.tipo_servicio}
                          onChange={(e) => {
                            if (tiposServicioList.some(t => t.label === e.target.value)) {
                              const tipoEncontrado = tiposServicioData.find(t => t.nombre === e.target.value);
                              if (tipoEncontrado) cargarTipoServicio(idx, tipoEncontrado.id);
                            }
                            handleServicioChange(idx, 'tipo_servicio', e.target.value);
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        >
                          <option value="">Seleccionar...</option>
                          {tiposServicioList.map(tipo => (
                            <option key={tipo.value} value={tipo.label}>{tipo.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const tipoId = tiposServicioData.find(t => t.nombre === servicio.tipo_servicio)?.id;
                            if (tipoId) cargarTipoServicio(idx, tipoId);
                          }}
                          className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                          title="Cargar valores del tipo de servicio"
                        >
                          <Tool className="w-4 h-4" />
                        </button>
                      </div>
                      {errors[`tipo_servicio_${idx}`] && <p className="mt-1 text-xs text-red-500">{errors[`tipo_servicio_${idx}`]}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Equipo relacionado
                      </label>
                      <input
                        type="text"
                        value={servicio.equipo_relacionado}
                        onChange={(e) => handleServicioChange(idx, 'equipo_relacionado', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        placeholder="Ej: Aire Samsung AR12TX"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Descripción del problema <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={servicio.descripcion_problema}
                        onChange={(e) => handleServicioChange(idx, 'descripcion_problema', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        placeholder="Describa el problema o trabajo a realizar..."
                      />
                      {errors[`descripcion_problema_${idx}`] && <p className="mt-1 text-xs text-red-500">{errors[`descripcion_problema_${idx}`]}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Observaciones específicas
                      </label>
                      <textarea
                        value={servicio.observaciones}
                        onChange={(e) => handleServicioChange(idx, 'observaciones', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        placeholder="Información adicional sobre este servicio..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Precio estimado
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="number"
                          value={servicio.precio_estimado}
                          onChange={(e) => handleServicioChange(idx, 'precio_estimado', e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="flex gap-4 items-center pt-6">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={servicio.requiere_diagnostico}
                          onChange={(e) => handleServicioChange(idx, 'requiere_diagnostico', e.target.checked)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm">Requiere diagnóstico</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={servicio.requiere_repuestos}
                          onChange={(e) => handleServicioChange(idx, 'requiere_repuestos', e.target.checked)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm">Requiere repuestos</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Botones de navegación */}
          <div className="flex justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                Anterior
              </button>
            )}
            <div className="flex-1"></div>
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Siguiente
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Guardando...' : 'Crear Orden de Servicio'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServicioForm;