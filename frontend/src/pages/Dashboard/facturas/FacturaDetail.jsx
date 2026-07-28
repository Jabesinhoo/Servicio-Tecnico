// src/pages/Dashboard/facturas/FacturaDetail.jsx
import React, { useState, useEffect } from 'react';
import { X, FileText, DollarSign, Calendar, User, Building, Phone, Mail, MapPin, Printer, Download } from 'lucide-react';
import api from '../../../services/api';
import { exportToPDF } from '../../../services/exportService';

const FacturaDetail = ({ isOpen, onClose, facturaId, onRefresh }) => {
    const [factura, setFactura] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && facturaId) {
            fetchFactura();
        }
    }, [isOpen, facturaId]);

    const fetchFactura = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/api/invoices/${facturaId}`);
            setFactura(res.data);
        } catch (error) {
            console.error('Error fetching factura:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExportPDF = async () => {
  if (!factura) return;

  const cliente = factura.Client || {};
  const clienteNombre = cliente.razon_social || 
    `${cliente.primer_nombre || ''} ${cliente.primer_apellido || ''}`.trim() || '—';

  const servicio = factura.ServiceOrder || {};

  const facturaData = {
    numero_factura: factura.numero_factura,
    cliente: {
      nombre: clienteNombre,
      documento: cliente.documento || '—',
      telefono: cliente.telefono || '—',
      email: cliente.email || '—',
      direccion: cliente.direccion || '—',
      ciudad: cliente.ciudad || '—',
    },
    servicio: {
      codigo_os: servicio.codigo_os || '—',
      descripcion: servicio.descripcion_inicial || '—',
      tecnico: servicio.tecnico_nombre || 'Técnico Externo',
      fecha_servicio: servicio.fecha_servicio ? new Date(servicio.fecha_servicio).toLocaleDateString('es-CO') : new Date().toLocaleDateString('es-CO'),
      duracion: servicio.duracion_estimada ? `${servicio.duracion_estimada} minutos` : '—',
    },
    items: factura.InvoiceItems || [],
    total_base: factura.total_base,
    total_iva: factura.total_iva,
    total_retencion: factura.total_retencion,
    total_general: factura.total_general,
    estado: factura.estado,
    fecha_emision: factura.fecha_emision,
    terminos_pago: 'Según condiciones acordadas con el cliente.',
    garantia_mano_obra: 'Según tipo de servicio realizado.',
    garantia_repuestos: 'Según fabricante y tipo de repuesto.',
  };

  await exportToPDF(
    [],
    factura.numero_factura,
    [],
    `factura_${factura.numero_factura}`,
    facturaData
  );
};

    if (!isOpen) return null;

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full p-8">
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!factura) return null;

    const clienteNombre = factura.Client?.razon_social ||
        `${factura.Client?.primer_nombre || ''} ${factura.Client?.primer_apellido || ''}`.trim() || '—';

    const estadoColors = {
        borrador: 'bg-gray-100 text-gray-800',
        emitida: 'bg-blue-100 text-blue-800',
        pagada: 'bg-green-100 text-green-800',
        anulada: 'bg-red-100 text-red-800',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FileText className="w-6 h-6 text-blue-600" />
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Factura {factura.numero_factura}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Emitida: {new Date(factura.fecha_emision).toLocaleString()}
                                </p>
                            </div>
                            <span className={`inline-flex px-2 py-1 text-xs rounded-full ${estadoColors[factura.estado]}`}>
                                {factura.estado.toUpperCase()}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleExportPDF}
                                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                title="Exportar PDF"
                            >
                                <Download className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handlePrint}
                                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                title="Imprimir"
                            >
                                <Printer className="w-5 h-5" />
                            </button>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-4 sm:p-6 space-y-6">
                    {/* Información del Cliente */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <User className="w-4 h-4 text-blue-600" />
                            Cliente
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-gray-500">Nombre</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {clienteNombre}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Documento</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {factura.Client?.documento || '—'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Teléfono</p>
                                <div className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-gray-400" />
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {factura.Client?.telefono || '—'}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Email</p>
                                <div className="flex items-center gap-1">
                                    <Mail className="w-3 h-3 text-gray-400" />
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {factura.Client?.email || '—'}
                                    </p>
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <p className="text-xs text-gray-500">Dirección</p>
                                <div className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-gray-400" />
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {factura.Client?.direccion || '—'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Totales */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            Resumen de la Factura
                        </h4>
                        <div className="flex flex-col items-end space-y-2">
                            <div className="flex justify-between w-full sm:w-64">
                                <span className="text-sm text-gray-500">Base</span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    ${Number(factura.total_base).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between w-full sm:w-64">
                                <span className="text-sm text-gray-500">IVA (19%)</span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    ${Number(factura.total_iva).toLocaleString()}
                                </span>
                            </div>
                            {factura.total_retencion > 0 && (
                                <div className="flex justify-between w-full sm:w-64">
                                    <span className="text-sm text-gray-500">Retención</span>
                                    <span className="text-sm font-medium text-red-600">
                                        -${Number(factura.total_retencion).toLocaleString()}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between w-full sm:w-64 pt-2 border-t border-gray-200 dark:border-gray-700">
                                <span className="text-base font-bold text-gray-900 dark:text-white">Total</span>
                                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                    ${Number(factura.total_general).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {factura.observaciones && (
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Observaciones</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{factura.observaciones}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FacturaDetail;