// src/pages/Dashboard/servicios/ServicioForm.jsx
import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import {
    X, Save, Search, User, Phone, Mail, MapPin, Building,
    Calendar, Clock, FileText, Wrench, Plus, Trash2, DollarSign,
    Home, Truck, Globe, CheckCircle, AlertCircle, Loader2, Package
} from 'lucide-react';

const ServicioForm = ({ isOpen, onClose, onSubmit }) => {
    const [formData, setFormData] = useState({
        cliente_id: null,
        cliente_nombre: '',
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
            tipo_servicio_id: '',
            tipo_servicio_nombre: '',
            descripcion_problema: '',
            observaciones: '',
            precio_estimado: 0,
            equipo_relacionado: '',
            requiere_diagnostico: false,
            requiere_repuestos: false,
            repuestos_necesarios: '', // Campo para especificar repuestos
        }],
        notas: {
            observaciones_tecnico: '',
            notas_internas: '',
        }
    });

    const [tecnicos, setTecnicos] = useState([]);
    const [tiposServicioData, setTiposServicioData] = useState([]);
    const [loadingTipos, setLoadingTipos] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [searchClienteTerm, setSearchClienteTerm] = useState('');
    const [clientesEncontrados, setClientesEncontrados] = useState([]);
    const [showClienteSearch, setShowClienteSearch] = useState(false);
    const [searchingClient, setSearchingClient] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [clienteSeleccionado, setClienteSeleccionado] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchTecnicos();
            fetchTiposServicio();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            resetForm();
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
        setLoadingTipos(true);
        try {
            const res = await api.get('/api/tipos-servicio/activos');
            console.log('Tipos de servicio cargados:', res.data);
            setTiposServicioData(res.data || []);
        } catch (error) {
            console.error('Error fetching tipos servicio:', error);
        } finally {
            setLoadingTipos(false);
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

    // Modificar la función seleccionarCliente
    const seleccionarCliente = (cliente) => {
        const esJuridica = cliente.tipo_persona === 'juridica';
        const nombreCompleto = esJuridica
            ? cliente.razon_social
            : `${cliente.primer_nombre || ''} ${cliente.primer_apellido || ''}`.trim();

        setClienteSeleccionado(cliente);
        setFormData(prev => ({
            ...prev,
            cliente_id: cliente.id,  // Asegurar que esto se guarda
            cliente_nombre: nombreCompleto,
            ubicacion: {
                ...prev.ubicacion,
                direccion: cliente.direccion || '',
                ciudad_barrio: cliente.ciudad || '',
            }
        }));

        // Limpiar error de cliente inmediatamente
        setErrors(prev => ({ ...prev, cliente: '' }));

        setShowClienteSearch(false);
        setSearchClienteTerm('');
        setClientesEncontrados([]);
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
        console.log('Cargando tipo de servicio con ID:', tipoId);
        const tipoSeleccionado = tiposServicioData.find(t => t.id === tipoId);
        console.log('Tipo encontrado:', tipoSeleccionado);

        if (tipoSeleccionado) {
            // Actualizar todos los campos del servicio
            const nuevosServicios = [...formData.servicios];
            nuevosServicios[index] = {
                ...nuevosServicios[index],
                tipo_servicio_id: tipoSeleccionado.id,
                tipo_servicio_nombre: tipoSeleccionado.nombre,
                precio_estimado: parseFloat(tipoSeleccionado.valor_base) || 0,
                requiere_diagnostico: tipoSeleccionado.requiere_diagnostico || false,
                requiere_repuestos: tipoSeleccionado.requiere_repuestos || false,
            };

            setFormData(prev => ({
                ...prev,
                servicios: nuevosServicios
            }));

            console.log('Servicio actualizado:', nuevosServicios[index]);

            // Si tiene duración estimada, actualizar programación
            if (tipoSeleccionado.duracion_estimada && formData.programacion.requiere_agendamiento) {
                handleProgramacionChange('duracion_estimada', tipoSeleccionado.duracion_estimada);
            }
        } else {
            console.warn('Tipo de servicio no encontrado con ID:', tipoId);
        }
    };

    const agregarServicio = () => {
        setFormData(prev => ({
            ...prev,
            servicios: [...prev.servicios, {
                tipo_servicio_id: '',
                tipo_servicio_nombre: '',
                descripcion_problema: '',
                observaciones: '',
                precio_estimado: 0,
                equipo_relacionado: '',
                requiere_diagnostico: false,
                requiere_repuestos: false,
                repuestos_necesarios: '',
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
            // Usar clienteSeleccionado o formData.cliente_id
            const tieneCliente = clienteSeleccionado !== null || (formData.cliente_id && formData.cliente_id !== '');
            console.log('Validando cliente - tieneCliente:', tieneCliente);
            console.log('clienteSeleccionado:', clienteSeleccionado);
            console.log('formData.cliente_id:', formData.cliente_id);

            if (!tieneCliente) {
                newErrors.cliente = 'Debe seleccionar un cliente';
            }
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
                if (!servicio.tipo_servicio_id) {
                    newErrors[`tipo_servicio_${idx}`] = 'Seleccione un tipo de servicio';
                }
                if (!servicio.descripcion_problema.trim()) {
                    newErrors[`descripcion_problema_${idx}`] = 'La descripción del problema es requerida';
                }
                if (servicio.tipo_servicio_id && servicio.descripcion_problema.trim()) {
                    servicioValido = true;
                }
                // Validar repuestos si requiere
                if (servicio.requiere_repuestos && !servicio.repuestos_necesarios?.trim()) {
                    newErrors[`repuestos_${idx}`] = 'Especifique los repuestos necesarios';
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
    // Asegurar que el cliente_id sea el correcto
    const clienteId = clienteSeleccionado?.id || formData.cliente_id;
    
    if (!clienteId) {
      setErrors({ submit: 'Debe seleccionar un cliente' });
      setLoading(false);
      return;
    }
    
    // Preparar datos para el backend - Formato correcto
    const submitData = {
      client_id: clienteId,  // Nota: el backend espera 'client_id', no 'cliente_id'
      descripcion_inicial: formData.servicios[0]?.descripcion_problema || '',
      origen_tipo: 'tecnico',
      // Datos de ubicación
      ubicacion: formData.ubicacion,
      // Datos de programación
      programacion: {
        requiere_agendamiento: formData.programacion.requiere_agendamiento,
        fecha_agendada: formData.programacion.requiere_agendamiento ? formData.programacion.fecha_agendada : null,
        hora_inicio: formData.programacion.requiere_agendamiento ? formData.programacion.hora_inicio : null,
        duracion_estimada: formData.programacion.duracion_estimada,
        tecnico_id: formData.programacion.tecnico_id || null,
        prioridad: formData.programacion.prioridad,
      },
      // Servicios (el backend espera un array)
      servicios: formData.servicios.map(s => ({
        tipo_servicio_id: s.tipo_servicio_id,
        tipo_servicio_nombre: s.tipo_servicio_nombre,
        descripcion_problema: s.descripcion_problema,
        observaciones: s.observaciones,
        precio_estimado: s.precio_estimado,
        equipo_relacionado: s.equipo_relacionado,
        requiere_diagnostico: s.requiere_diagnostico,
        requiere_repuestos: s.requiere_repuestos,
        repuestos_necesarios: s.repuestos_necesarios,
      })),
      // Notas
      notas: {
        observaciones_tecnico: formData.notas.observaciones_tecnico,
        notas_internas: formData.notas.notas_internas,
      }
    };
    
    console.log('Enviando datos:', submitData);
    
    // Usar el endpoint correcto
    const response = await api.post('/api/service-orders', submitData);
    console.log('Respuesta:', response.data);
    
    await onSubmit(response.data);
    onClose();
    resetForm();
  } catch (error) {
    console.error('Error submitting form:', error);
    console.error('Detalles del error:', error.response?.data);
    setErrors({ submit: error.response?.data?.message || 'Error al crear la orden de servicio' });
  } finally {
    setLoading(false);
  }
};

    const resetForm = () => {
        setFormData({
            cliente_id: null,
            cliente_nombre: '',
            ubicacion: { lugar_servicio: 'local', direccion: '', ciudad_barrio: '', referencia: '' },
            programacion: { requiere_agendamiento: false, fecha_agendada: '', hora_inicio: '09:00', duracion_estimada: 60, tecnico_id: '', prioridad: 'normal' },
            servicios: [{ tipo_servicio_id: '', tipo_servicio_nombre: '', descripcion_problema: '', observaciones: '', precio_estimado: 0, equipo_relacionado: '', requiere_diagnostico: false, requiere_repuestos: false, repuestos_necesarios: '' }],
            notas: { observaciones_tecnico: '', notas_internas: '' }
        });
        setClienteSeleccionado(null);
        setErrors({});
        setCurrentStep(1);
        setSearchClienteTerm('');
        setClientesEncontrados([]);
        setShowClienteSearch(false);
    };

    if (!isOpen) return null;

    const prioridades = [
        { value: 'baja', label: 'Baja' },
        { value: 'normal', label: 'Normal' },
        { value: 'alta', label: 'Alta' },
        { value: 'urgente', label: 'Urgente' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header con stepper */}
                <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
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
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${currentStep >= step
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                                        }`}
                                >
                                    {step}
                                </div>
                                {step < 3 && (
                                    <div className={`w-16 h-0.5 mx-2 ${currentStep > step ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                                        }`} />
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <span>Cliente</span>
                        <span>Ubicación y Programación</span>
                        <span>Servicios</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-4 sm:p-6">
                    {errors.submit && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            {errors.submit}
                        </div>
                    )}

                    {/* PASO 1: CLIENTE */}
                    {currentStep === 1 && (
                        <div>
                            <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <User className="w-5 h-5 text-blue-600" />
                                Seleccionar Cliente
                                <span className="text-xs text-red-500 font-normal ml-2">* Obligatorio</span>
                            </h4>

                            {errors.cliente && (
                                <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm flex items-center gap-2">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors.cliente}
                                </div>
                            )}

                            {clienteSeleccionado && (
                                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-green-800">Cliente seleccionado</p>
                                        <p className="text-sm text-green-700">{formData.cliente_nombre}</p>
                                        <p className="text-xs text-green-600 mt-1">
                                            Tel: {clienteSeleccionado.telefono || 'N/A'} |
                                            Doc: {clienteSeleccionado.documento || 'N/A'} |
                                            Ciudad: {clienteSeleccionado.ciudad || 'N/A'}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setClienteSeleccionado(null);
                                            setFormData(prev => ({ ...prev, cliente_id: null, cliente_nombre: '' }));
                                        }}
                                        className="text-xs text-red-500 hover:text-red-700"
                                    >
                                        Cambiar
                                    </button>
                                </div>
                            )}

                            {!clienteSeleccionado && (
                                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
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
                                                placeholder="Nombre, documento o teléfono..."
                                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={buscarCliente}
                                            disabled={searchingClient}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {searchingClient ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                            Buscar
                                        </button>
                                    </div>

                                    {showClienteSearch && (
                                        <div className="mt-3">
                                            {clientesEncontrados.length > 0 ? (
                                                <div className="border rounded-lg max-h-48 overflow-y-auto">
                                                    {clientesEncontrados.map((cliente) => (
                                                        <button
                                                            key={cliente.id}
                                                            type="button"
                                                            onClick={() => seleccionarCliente(cliente)}
                                                            className="w-full text-left px-4 py-3 hover:bg-gray-100 border-b last:border-0 transition-colors"
                                                        >
                                                            <p className="text-sm font-medium">
                                                                {cliente.tipo_persona === 'juridica'
                                                                    ? cliente.razon_social
                                                                    : `${cliente.primer_nombre || ''} ${cliente.primer_apellido || ''}`}
                                                            </p>
                                                            <div className="flex gap-4 mt-1 text-xs text-gray-500">
                                                                <span>Tel: {cliente.telefono || 'N/A'}</span>
                                                                <span>Doc: {cliente.documento || 'N/A'}</span>
                                                                <span>Ciudad: {cliente.ciudad || 'N/A'}</span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-4 text-gray-500">
                                                    No se encontraron clientes.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* PASO 2: UBICACIÓN Y PROGRAMACIÓN */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-md font-semibold mb-4 flex items-center gap-2">
                                    <MapPin className="w-5 h-5 text-blue-600" />
                                    Ubicación del Servicio
                                </h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Lugar del servicio *</label>
                                        <div className="flex flex-wrap gap-4">
                                            <label className="flex items-center gap-2">
                                                <input type="radio" value="local" checked={formData.ubicacion.lugar_servicio === 'local'} onChange={(e) => handleUbicacionChange('lugar_servicio', e.target.value)} />
                                                <Home className="w-4 h-4" /> En el local
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input type="radio" value="fuera" checked={formData.ubicacion.lugar_servicio === 'fuera'} onChange={(e) => handleUbicacionChange('lugar_servicio', e.target.value)} />
                                                <Truck className="w-4 h-4" /> Fuera del local
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input type="radio" value="remoto" checked={formData.ubicacion.lugar_servicio === 'remoto'} onChange={(e) => handleUbicacionChange('lugar_servicio', e.target.value)} />
                                                <Globe className="w-4 h-4" /> Remoto
                                            </label>
                                        </div>
                                    </div>

                                    {formData.ubicacion.lugar_servicio === 'fuera' && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Dirección *</label>
                                                <input type="text" value={formData.ubicacion.direccion} onChange={(e) => handleUbicacionChange('direccion', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium mb-1">Ciudad / Barrio</label>
                                                    <input type="text" value={formData.ubicacion.ciudad_barrio} onChange={(e) => handleUbicacionChange('ciudad_barrio', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium mb-1">Referencia</label>
                                                    <input type="text" value={formData.ubicacion.referencia} onChange={(e) => handleUbicacionChange('referencia', e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Casa azul, segundo piso..." />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-md font-semibold mb-4 flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-blue-600" />
                                    Programación
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Requiere agendamiento</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2">
                                                <input type="radio" checked={formData.programacion.requiere_agendamiento === true} onChange={() => handleProgramacionChange('requiere_agendamiento', true)} />
                                                Sí
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input type="radio" checked={formData.programacion.requiere_agendamiento === false} onChange={() => handleProgramacionChange('requiere_agendamiento', false)} />
                                                No
                                            </label>
                                        </div>
                                    </div>

                                    {formData.programacion.requiere_agendamiento && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Fecha *</label>
                                                <input type="date" value={formData.programacion.fecha_agendada} onChange={(e) => handleProgramacionChange('fecha_agendada', e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 border rounded-lg" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Hora de inicio</label>
                                                <input type="time" value={formData.programacion.hora_inicio} onChange={(e) => handleProgramacionChange('hora_inicio', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Duración estimada</label>
                                                <select value={formData.programacion.duracion_estimada} onChange={(e) => handleProgramacionChange('duracion_estimada', parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-lg">
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
                                        <label className="block text-sm font-medium mb-1">Prioridad *</label>
                                        <select value={formData.programacion.prioridad} onChange={(e) => handleProgramacionChange('prioridad', e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                                            <option value="">Seleccionar...</option>
                                            {prioridades.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">Técnico asignado</label>
                                        <select value={formData.programacion.tecnico_id} onChange={(e) => handleProgramacionChange('tecnico_id', e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                                            <option value="">Sin asignar</option>
                                            {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre1} {t.apellidos}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-md font-semibold mb-4 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-blue-600" />
                                    Notas
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Para el técnico</label>
                                        <textarea value={formData.notas.observaciones_tecnico} onChange={(e) => handleNotaChange('observaciones_tecnico', e.target.value)} rows={3} className="w-full px-3 py-2 border rounded-lg" placeholder="Instrucciones para el técnico..." />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Notas internas</label>
                                        <textarea value={formData.notas.notas_internas} onChange={(e) => handleNotaChange('notas_internas', e.target.value)} rows={3} className="w-full px-3 py-2 border rounded-lg" placeholder="Solo administración..." />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PASO 3: SERVICIOS */}
                    {currentStep === 3 && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-md font-semibold flex items-center gap-2">
                                    <Wrench className="w-5 h-5 text-blue-600" />
                                    Servicios a Realizar
                                </h4>
                                <button type="button" onClick={agregarServicio} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">
                                    <Plus className="w-4 h-4" /> Agregar servicio
                                </button>
                            </div>

                            {errors.servicios && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm">{errors.servicios}</div>}

                            {loadingTipos && (
                                <div className="text-center py-4">
                                    <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
                                    <p className="text-sm text-gray-500 mt-2">Cargando tipos de servicio...</p>
                                </div>
                            )}

                            {formData.servicios.map((servicio, idx) => (
                                <div key={idx} className="mb-6 p-4 border rounded-lg relative">
                                    <button type="button" onClick={() => eliminarServicio(idx)} className="absolute top-2 right-2 text-red-500 hover:text-red-700">
                                        <Trash2 className="w-4 h-4" />
                                    </button>

                                    <h5 className="text-sm font-medium mb-3">Servicio {idx + 1}</h5>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Tipo de servicio *</label>
                                            <select
                                                value={servicio.tipo_servicio_id}
                                                onChange={(e) => cargarTipoServicio(idx, e.target.value)}
                                                className="w-full px-3 py-2 border rounded-lg"
                                            >
                                                <option value="">Seleccionar...</option>
                                                {tiposServicioData.map(tipo => (
                                                    <option key={tipo.id} value={tipo.id}>
                                                        {tipo.nombre} {tipo.valor_base > 0 ? `- $${Number(tipo.valor_base).toLocaleString()}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            {errors[`tipo_servicio_${idx}`] && <p className="mt-1 text-xs text-red-500">{errors[`tipo_servicio_${idx}`]}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1">Equipo relacionado</label>
                                            <input
                                                type="text"
                                                value={servicio.equipo_relacionado}
                                                onChange={(e) => handleServicioChange(idx, 'equipo_relacionado', e.target.value)}
                                                className="w-full px-3 py-2 border rounded-lg"
                                                placeholder="Ej: "
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium mb-1">Descripción del problema *</label>
                                            <textarea
                                                value={servicio.descripcion_problema}
                                                onChange={(e) => handleServicioChange(idx, 'descripcion_problema', e.target.value)}
                                                rows={2}
                                                className="w-full px-3 py-2 border rounded-lg"
                                                placeholder="Describa el problema o trabajo a realizar..."
                                            />
                                            {errors[`descripcion_problema_${idx}`] && <p className="mt-1 text-xs text-red-500">{errors[`descripcion_problema_${idx}`]}</p>}
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium mb-1">Observaciones</label>
                                            <textarea
                                                value={servicio.observaciones}
                                                onChange={(e) => handleServicioChange(idx, 'observaciones', e.target.value)}
                                                rows={2}
                                                className="w-full px-3 py-2 border rounded-lg"
                                                placeholder="Información adicional..."
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1">Precio estimado</label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <input
                                                    type="number"
                                                    value={servicio.precio_estimado}
                                                    onChange={(e) => handleServicioChange(idx, 'precio_estimado', e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
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

                                        {servicio.requiere_repuestos && (
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                                                    <Package className="w-4 h-4 text-blue-600" />
                                                    Repuestos necesarios *
                                                </label>
                                                <textarea
                                                    value={servicio.repuestos_necesarios}
                                                    onChange={(e) => handleServicioChange(idx, 'repuestos_necesarios', e.target.value)}
                                                    rows={2}
                                                    className="w-full px-3 py-2 border rounded-lg"
                                                    placeholder="Especifique los repuestos necesarios: cable 20m, conector HDMI, fuente de poder, etc."
                                                />
                                                {errors[`repuestos_${idx}`] && <p className="mt-1 text-xs text-red-500">{errors[`repuestos_${idx}`]}</p>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Botones */}
                    <div className="flex justify-between gap-3 pt-4 border-t mt-6">
                        {currentStep > 1 && (
                            <button type="button" onClick={prevStep} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                                Anterior
                            </button>
                        )}
                        <div className="flex-1"></div>
                        {currentStep < 3 ? (
                            <button type="button" onClick={nextStep} className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                                Siguiente
                            </button>
                        ) : (
                            <button type="submit" disabled={loading} className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                                <Save className="w-4 h-4" />
                                {loading ? 'Guardando...' : 'Crear Orden'}
                            </button>
                        )}
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ServicioForm;