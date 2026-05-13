// src/pages/Dashboard/clientes/ClienteForm.jsx
import React, { useState, useEffect } from 'react';
import { X, Save, User, Building, Phone, Mail, MapPin, FileText, CreditCard, Calendar, DollarSign } from 'lucide-react';

const ClienteForm = ({ isOpen, onClose, onSubmit, initialData }) => {
  const [tipoPersona, setTipoPersona] = useState('natural');
  const [formData, setFormData] = useState({
    // Tipo de persona
    tipo_persona: 'natural',
    // Persona natural
    primer_nombre: '',
    segundo_nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    // Persona jurídica
    razon_social: '',
    // Documentos
    tipo_documento: 'cedula',
    documento: '',
    digito_verificacion: '',
    // Contacto
    telefono: '',
    telefono_2: '',
    email: '',
    email_2: '',
    // Dirección
    direccion: '',
    direccion_2: '',
    ciudad: '',
    codigo_postal: '',
    // Configuración fiscal
    responsable_iva: true,
    autoretenedor: false,
    gran_contribuyente: false,
    clasificacion_dian: 'normal',
    actividad_economica: '',
    codigo_ciiu: '',
    // Crédito
    plazo_credito: 0,
    cupo_credito: 0,
    fecha_aniversario: '',
    // Configuración comercial
    lista_precios: '',
    forma_pago: '',
    codigo_worldoffice: '',
    observacion: '',
    notas: '',
    activo: true,
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTipoPersona(initialData.tipo_persona || 'natural');
      setFormData({
        tipo_persona: initialData.tipo_persona || 'natural',
        primer_nombre: initialData.primer_nombre || '',
        segundo_nombre: initialData.segundo_nombre || '',
        primer_apellido: initialData.primer_apellido || '',
        segundo_apellido: initialData.segundo_apellido || '',
        razon_social: initialData.razon_social || '',
        tipo_documento: initialData.tipo_documento || 'cedula',
        documento: initialData.documento || '',
        digito_verificacion: initialData.digito_verificacion || '',
        telefono: initialData.telefono || '',
        telefono_2: initialData.telefono_2 || '',
        email: initialData.email || '',
        email_2: initialData.email_2 || '',
        direccion: initialData.direccion || '',
        direccion_2: initialData.direccion_2 || '',
        ciudad: initialData.ciudad || '',
        codigo_postal: initialData.codigo_postal || '',
        responsable_iva: initialData.responsable_iva !== false,
        autoretenedor: initialData.autoretenedor || false,
        gran_contribuyente: initialData.gran_contribuyente || false,
        clasificacion_dian: initialData.clasificacion_dian || 'normal',
        actividad_economica: initialData.actividad_economica || '',
        codigo_ciiu: initialData.codigo_ciiu || '',
        plazo_credito: initialData.plazo_credito || 0,
        cupo_credito: initialData.cupo_credito || 0,
        fecha_aniversario: initialData.fecha_aniversario || '',
        lista_precios: initialData.lista_precios || '',
        forma_pago: initialData.forma_pago || '',
        codigo_worldoffice: initialData.codigo_worldoffice || '',
        observacion: initialData.observacion || '',
        notas: initialData.notas || '',
        activo: initialData.activo !== false,
      });
    } else {
      resetForm();
    }
    setErrors({});
  }, [initialData, isOpen]);

  const resetForm = () => {
    setTipoPersona('natural');
    setFormData({
      tipo_persona: 'natural',
      primer_nombre: '',
      segundo_nombre: '',
      primer_apellido: '',
      segundo_apellido: '',
      razon_social: '',
      tipo_documento: 'cedula',
      documento: '',
      digito_verificacion: '',
      telefono: '',
      telefono_2: '',
      email: '',
      email_2: '',
      direccion: '',
      direccion_2: '',
      ciudad: '',
      codigo_postal: '',
      responsable_iva: true,
      autoretenedor: false,
      gran_contribuyente: false,
      clasificacion_dian: 'normal',
      actividad_economica: '',
      codigo_ciiu: '',
      plazo_credito: 0,
      cupo_credito: 0,
      fecha_aniversario: '',
      lista_precios: '',
      forma_pago: '',
      codigo_worldoffice: '',
      observacion: '',
      notas: '',
      activo: true,
    });
  };

  const validate = () => {
    const newErrors = {};
    
    if (tipoPersona === 'natural') {
      if (!formData.primer_nombre.trim()) newErrors.primer_nombre = 'El primer nombre es requerido';
      if (!formData.primer_apellido.trim()) newErrors.primer_apellido = 'El primer apellido es requerido';
    } else {
      if (!formData.razon_social.trim()) newErrors.razon_social = 'La razón social es requerida';
    }
    
    if (!formData.documento.trim()) newErrors.documento = 'El número de documento es requerido';
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    
    setLoading(true);
    try {
      const submitData = { ...formData, tipo_persona: tipoPersona };
      await onSubmit(submitData);
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  if (!isOpen) return null;

  const clasificacionesDIAN = ['normal', 'gran_contribuyente', 'autorretenedor', 'exportador', 'zona_franca'];
  const tiposDocumento = [
    { value: 'cedula', label: 'Cédula' },
    { value: 'nit', label: 'NIT' },
    { value: 'rut', label: 'RUT' },
    { value: 'pasaporte', label: 'Pasaporte' },
    { value: 'cedula_extranjeria', label: 'Cédula de Extranjería' },
  ];
  const formasPago = ['Contado', 'Crédito', 'Tarjeta', 'Transferencia', 'Cheque'];
  const listasPrecios = ['General', 'Mayorista', 'Distribuidor', 'VIP'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {initialData ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Tipo de Persona */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Tipo de Persona
            </label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="natural"
                  checked={tipoPersona === 'natural'}
                  onChange={(e) => setTipoPersona(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <User className="w-4 h-4" />
                <span>Persona Natural</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="juridica"
                  checked={tipoPersona === 'juridica'}
                  onChange={(e) => setTipoPersona(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <Building className="w-4 h-4" />
                <span>Persona Jurídica / Empresa</span>
              </label>
            </div>
          </div>

          {/* Datos según tipo de persona */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {tipoPersona === 'natural' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Primer Nombre *
                  </label>
                  <input
                    type="text"
                    name="primer_nombre"
                    value={formData.primer_nombre}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${
                      errors.primer_nombre ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                    }`}
                  />
                  {errors.primer_nombre && <p className="mt-1 text-xs text-red-500">{errors.primer_nombre}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Segundo Nombre
                  </label>
                  <input
                    type="text"
                    name="segundo_nombre"
                    value={formData.segundo_nombre}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Primer Apellido *
                  </label>
                  <input
                    type="text"
                    name="primer_apellido"
                    value={formData.primer_apellido}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${
                      errors.primer_apellido ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                    }`}
                  />
                  {errors.primer_apellido && <p className="mt-1 text-xs text-red-500">{errors.primer_apellido}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Segundo Apellido
                  </label>
                  <input
                    type="text"
                    name="segundo_apellido"
                    value={formData.segundo_apellido}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                  />
                </div>
              </>
            ) : (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Razón Social *
                </label>
                <input
                  type="text"
                  name="razon_social"
                  value={formData.razon_social}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${
                    errors.razon_social ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                  }`}
                />
                {errors.razon_social && <p className="mt-1 text-xs text-red-500">{errors.razon_social}</p>}
              </div>
            )}
          </div>

          {/* Documentos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de Documento *
              </label>
              <select
                name="tipo_documento"
                value={formData.tipo_documento}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
              >
                {tiposDocumento.map(td => (
                  <option key={td.value} value={td.value}>{td.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Número de Documento *
              </label>
              <input
                type="text"
                name="documento"
                value={formData.documento}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${
                  errors.documento ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                }`}
              />
              {errors.documento && <p className="mt-1 text-xs text-red-500">{errors.documento}</p>}
            </div>
            {formData.tipo_documento === 'nit' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Dígito Verificación
                </label>
                <input
                  type="text"
                  name="digito_verificacion"
                  value={formData.digito_verificacion}
                  onChange={handleChange}
                  maxLength={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                  placeholder="DV"
                />
              </div>
            )}
          </div>

          {/* Contacto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Teléfono
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Teléfono 2
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  name="telefono_2"
                  value={formData.telefono_2}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-900 ${
                    errors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                  }`}
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email 2
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  name="email_2"
                  value={formData.email_2}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                />
              </div>
            </div>
          </div>

          {/* Dirección */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Dirección Principal
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  name="direccion"
                  value={formData.direccion}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Dirección 2
              </label>
              <input
                type="text"
                name="direccion_2"
                value={formData.direccion_2}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ciudad
              </label>
              <input
                type="text"
                name="ciudad"
                value={formData.ciudad}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Código Postal
              </label>
              <input
                type="text"
                name="codigo_postal"
                value={formData.codigo_postal}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
              />
            </div>
          </div>

          {/* Configuración Fiscal */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Configuración Fiscal
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="responsable_iva"
                  checked={formData.responsable_iva}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">Responsable de IVA</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="autoretenedor"
                  checked={formData.autoretenedor}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">Autoretenedor</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="gran_contribuyente"
                  checked={formData.gran_contribuyente}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">Gran Contribuyente</span>
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Clasificación DIAN
                </label>
                <select
                  name="clasificacion_dian"
                  value={formData.clasificacion_dian}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                >
                  {clasificacionesDIAN.map(c => (
                    <option key={c} value={c}>{c.replace('_', ' ').toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Actividad Económica
                </label>
                <input
                  type="text"
                  name="actividad_economica"
                  value={formData.actividad_economica}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Código CIIU
                </label>
                <input
                  type="text"
                  name="codigo_ciiu"
                  value={formData.codigo_ciiu}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                />
              </div>
            </div>
          </div>

          {/* Crédito y Comercial */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Crédito y Comercial
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Plazo de Crédito (días)
                </label>
                <input
                  type="number"
                  name="plazo_credito"
                  value={formData.plazo_credito}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cupo de Crédito
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    name="cupo_credito"
                    value={formData.cupo_credito}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Lista de Precios
                </label>
                <select
                  name="lista_precios"
                  value={formData.lista_precios}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                >
                  <option value="">Seleccionar...</option>
                  {listasPrecios.map(lp => (
                    <option key={lp} value={lp}>{lp}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Forma de Pago
                </label>
                <select
                  name="forma_pago"
                  value={formData.forma_pago}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                >
                  <option value="">Seleccionar...</option>
                  {formasPago.map(fp => (
                    <option key={fp} value={fp}>{fp}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Fecha Aniversario
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    name="fecha_aniversario"
                    value={formData.fecha_aniversario?.split('T')[0] || ''}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Código WorldOffice
                </label>
                <input
                  type="text"
                  name="codigo_worldoffice"
                  value={formData.codigo_worldoffice}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                  placeholder="WO-12345"
                />
              </div>
            </div>
          </div>

          {/* Observaciones y Notas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Observación
              </label>
              <textarea
                name="observacion"
                value={formData.observacion}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                placeholder="Información adicional del cliente..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notas Internas
              </label>
              <textarea
                name="notas"
                value={formData.notas}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                placeholder="Notas solo visibles para administración..."
              />
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Guardando...' : (initialData ? 'Actualizar Cliente' : 'Crear Cliente')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClienteForm;