// src/pages/Dashboard/Reportes.jsx
import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import TechnicalStatisticsPanel from './reportes/TechnicalStatisticsPanel';
import QualityDashboardPanel from './reportes/QualityDashboardPanel';
import { exportToExcel, exportToPDF, formatCurrency, formatDate } from '../../services/exportService';
import {
  FileText,
  TrendingUp,
  Users,
  Package,
  
  DollarSign,
  Calendar,
  Download,
  Printer,
  BarChart3,
  ShoppingCart,
  Wrench,
  AlertTriangle,
  Loader2
} from 'lucide-react';

const Reportes = () => {
  const { user } = useAuth();
  const [selectedReporte, setSelectedReporte] = useState(null);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [loading, setLoading] = useState(false);
  const [reporteData, setReporteData] = useState(null);
  const [error, setError] = useState('');

  const userRole =
    user?.role?.name ||
    user?.rol ||
    'usuario';

  const isAdmin =
    userRole === 'admin';

  const isTechnician =
    userRole === 'tecnico';

  const reportesConfig = {
    // Ventas
    'ventas-diarias': {
      nombre: 'Ventas Diarias',
      endpoint: '/api/reportes/ventas/diarias',
      columns: [
        { key: 'fecha', label: 'Fecha' },
        { key: 'cantidad', label: 'Cantidad de Ventas' },
        { key: 'total', label: 'Total' }
      ],
      formatData: (data) => data.map(item => ({
        fecha: formatDate(item.fecha),
        cantidad: item.cantidad,
        total: formatCurrency(item.total)
      }))
    },
    'ventas-mensuales': {
      nombre: 'Ventas Mensuales',
      endpoint: '/api/reportes/ventas/mensuales',
      columns: [
        { key: 'mes', label: 'Mes' },
        { key: 'cantidad', label: 'Cantidad de Ventas' },
        { key: 'total', label: 'Total' }
      ],
      formatData: (data) => data.map(item => ({
        mes: item.mes,
        cantidad: item.cantidad,
        total: formatCurrency(item.total)
      }))
    },
    'productos-vendidos': {
      nombre: 'Productos Más Vendidos',
      endpoint: '/api/reportes/ventas/productos-mas-vendidos',
      columns: [
        { key: 'codigo', label: 'Código' },
        { key: 'nombre', label: 'Producto' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'cantidad_vendida', label: 'Cantidad Vendida' },
        { key: 'total_ventas', label: 'Total Ventas' }
      ],
      formatData: (data) => data.map(item => ({
        codigo: item.codigo,
        nombre: item.nombre,
        tipo: item.tipo === 'producto_venta' ? 'Venta' : item.tipo === 'repuesto' ? 'Repuesto' : item.tipo,
        cantidad_vendida: item.cantidad_vendida,
        total_ventas: formatCurrency(item.total_ventas)
      }))
    },
    'ventas-por-vendedor': {
      nombre: 'Ventas por Vendedor',
      endpoint: '/api/reportes/ventas/por-vendedor',
      columns: [
        { key: 'nombre', label: 'Vendedor' },
        { key: 'usuario', label: 'Usuario' },
        { key: 'cantidad_ventas', label: 'Cantidad de Ventas' },
        { key: 'total_ventas', label: 'Total Ventas' }
      ],
      formatData: (data) => data.map(item => ({
        nombre: `${item.nombre1 || ''} ${item.apellidos || ''}`,
        usuario: item.usuario,
        cantidad_ventas: item.cantidad_ventas,
        total_ventas: formatCurrency(item.total_ventas)
      }))
    },
    // Servicios
    'servicios-estado': {
      nombre: 'Servicios por Estado',
      endpoint: '/api/reportes/servicios/por-estado',
      columns: [
        { key: 'estado', label: 'Estado' },
        { key: 'cantidad', label: 'Cantidad' }
      ],
      formatData: (data) => data
    },
    'servicios-tecnico': {
      nombre: 'Servicios por Técnico',
      endpoint: '/api/reportes/servicios/por-tecnico',
      columns: [
        { key: 'nombre', label: 'Técnico' },
        { key: 'total_servicios', label: 'Total Servicios' },
        { key: 'completados', label: 'Completados' },
        { key: 'pendientes', label: 'Pendientes' },
        { key: 'en_ejecucion', label: 'En Ejecución' }
      ],
      formatData: (data) => data.map(item => ({
        nombre: `${item.nombre1 || ''} ${item.apellidos || ''}`,
        total_servicios: item.total_servicios,
        completados: item.completados,
        pendientes: item.pendientes,
        en_ejecucion: item.en_ejecucion
      }))
    },
    'repuestos-usados': {
      nombre: 'Repuestos Más Usados',
      endpoint: '/api/reportes/servicios/repuestos-usados',
      columns: [
        { key: 'codigo', label: 'Código' },
        { key: 'nombre', label: 'Repuesto' },
        { key: 'cantidad_usada', label: 'Cantidad Usada' }
      ],
      formatData: (data) => data
    },
    // Inventarios
    'stock-actual': {
      nombre: 'Stock Actual',
      endpoint: '/api/reportes/inventario/stock-actual',
      columns: [
        { key: 'codigo', label: 'Código' },
        { key: 'nombre', label: 'Producto' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'stock_actual', label: 'Stock Actual' },
        { key: 'stock_minimo', label: 'Stock Mínimo' },
        { key: 'precio_venta', label: 'Precio Venta' },
        { key: 'valor_inventario', label: 'Valor Inventario' }
      ],
      formatData: (data) => data.map(item => ({
        codigo: item.codigo,
        nombre: item.nombre,
        tipo: item.tipo === 'producto_venta' ? 'Venta' : item.tipo === 'repuesto' ? 'Repuesto' : item.tipo,
        stock_actual: item.stock_actual,
        stock_minimo: item.stock_minimo,
        precio_venta: formatCurrency(item.precio_venta),
        valor_inventario: formatCurrency(item.valor_inventario)
      }))
    },
    'stock-bajo': {
      nombre: 'Productos con Stock Bajo',
      endpoint: '/api/reportes/inventario/stock-bajo',
      columns: [
        { key: 'codigo', label: 'Código' },
        { key: 'nombre', label: 'Producto' },
        { key: 'stock_actual', label: 'Stock Actual' },
        { key: 'stock_minimo', label: 'Stock Mínimo' },
        { key: 'faltante', label: 'Faltante' }
      ],
      formatData: (data) => data
    },
    // Clientes
    'clientes-frecuentes': {
      nombre: 'Clientes Frecuentes',
      endpoint: '/api/reportes/clientes/frecuentes',
      columns: [
        { key: 'nombre', label: 'Cliente' },
        { key: 'documento', label: 'Documento' },
        { key: 'telefono', label: 'Teléfono' },
        { key: 'total_servicios', label: 'Servicios' },
        { key: 'total_ventas', label: 'Ventas' },
        { key: 'total_gastado', label: 'Total Gastado' }
      ],
      formatData: (data) => data.map(item => ({
        nombre: item.nombre,
        documento: item.documento,
        telefono: item.telefono,
        total_servicios: item.total_servicios,
        total_ventas: item.total_ventas,
        total_gastado: formatCurrency(item.total_gastado)
      }))
    },
    // Financieros
    'ingresos-gastos': {
      nombre: 'Ingresos Mensuales',
      endpoint: '/api/reportes/financieros/ingresos-gastos',
      columns: [
        { key: 'mes', label: 'Mes' },
        { key: 'ingresos', label: 'Ingresos' }
      ],
      formatData: (data) => data.map(item => ({
        mes: item.mes,
        ingresos: formatCurrency(item.ingresos)
      }))
    },
    // Rendimiento
    'rendimiento-tecnicos': {
      nombre: 'Rendimiento de Técnicos',
      endpoint: '/api/reportes/rendimiento/tecnicos',
      columns: [
        { key: 'nombre', label: 'Técnico' },
        { key: 'total_servicios', label: 'Total Servicios' },
        { key: 'completados', label: 'Completados' },
        { key: 'tasa_exito', label: 'Tasa de Éxito (%)' },
        { key: 'horas_promedio', label: 'Horas Promedio' }
      ],
      formatData: (data) => data.map(item => ({
        nombre: `${item.nombre1 || ''} ${item.apellidos || ''}`,
        total_servicios: item.total_servicios,
        completados: item.completados,
        tasa_exito: item.tasa_exito || 0,
        horas_promedio: item.horas_promedio ? item.horas_promedio.toFixed(1) : '—'
      }))
    }
  };

  const categorias = [
    {
      nombre: 'Ventas',
      icon: ShoppingCart,
      reportes: [
        { id: 'ventas-diarias', nombre: 'Ventas Diarias', descripcion: 'Resumen de ventas por día', roles: ['admin', 'ventas'] },
        { id: 'ventas-mensuales', nombre: 'Ventas Mensuales', descripcion: 'Resumen de ventas por mes', roles: ['admin', 'ventas'] },
        { id: 'productos-vendidos', nombre: 'Productos Más Vendidos', descripcion: 'Top de productos más vendidos', roles: ['admin', 'ventas', 'inventario'] },
        { id: 'ventas-por-vendedor', nombre: 'Ventas por Vendedor', descripcion: 'Rendimiento de ventas por vendedor', roles: ['admin'] },
      ]
    },
    {
      nombre: 'Servicios Técnicos',
      icon: Wrench,
      reportes: [
        { id: 'servicios-estado', nombre: 'Servicios por Estado', descripcion: 'Distribución de servicios por estado', roles: ['admin', 'tecnico'] },
        { id: 'servicios-tecnico', nombre: 'Servicios por Técnico', descripcion: 'Carga de trabajo por técnico', roles: ['admin'] },
        { id: 'repuestos-usados', nombre: 'Repuestos Más Usados', descripcion: 'Top de repuestos utilizados', roles: ['admin', 'inventario'] },
      ]
    },
    {
      nombre: 'Inventarios',
      icon: Package,
      reportes: [
        { id: 'stock-actual', nombre: 'Stock Actual', descripcion: 'Inventario actual de productos', roles: ['admin', 'inventario'] },
        { id: 'stock-bajo', nombre: 'Productos con Stock Bajo', descripcion: 'Alertas de stock bajo', roles: ['admin', 'inventario'] },
      ]
    },
    {
      nombre: 'Clientes',
      icon: Users,
      reportes: [
        { id: 'clientes-frecuentes', nombre: 'Clientes Frecuentes', descripcion: 'Top clientes con más servicios/ventas', roles: ['admin', 'ventas'] },
      ]
    },
    {
      nombre: 'Financieros',
      icon: DollarSign,
      reportes: [
        { id: 'ingresos-gastos', nombre: 'Ingresos Mensuales', descripcion: 'Resumen de ingresos por mes', roles: ['admin'] },
      ]
    },
    {
      nombre: 'Rendimiento',
      icon: TrendingUp,
      reportes: [
        { id: 'rendimiento-tecnicos', nombre: 'Rendimiento de Técnicos', descripcion: 'Métricas de productividad', roles: ['admin'] },
      ]
    }
  ];

  const handleGenerarReporte = async (reporteId) => {
    const config = reportesConfig[reporteId];
    if (!config) return;

    setLoading(true);
    setError('');
    setSelectedReporte(reporteId);

    try {
      const params = new URLSearchParams();
      if (fechaInicio) params.append('fechaInicio', fechaInicio);
      if (fechaFin) params.append('fechaFin', fechaFin);
      if (reporteId === 'ventas-mensuales' || reporteId === 'ingresos-gastos') {
        params.append('year', new Date().getFullYear());
      }

      const url = `${config.endpoint}${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await api.get(url);
      
      const formattedData = config.formatData(res.data);
      setReporteData({
        data: formattedData,
        columns: config.columns,
        nombre: config.nombre
      });
    } catch (error) {
      console.error('Error:', error);
      setError('Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const handleExportar = (formato) => {
    if (!reporteData) return;

    if (formato === 'excel') {
      exportToExcel(reporteData.data, reporteData.nombre, reporteData.nombre);
    } else if (formato === 'pdf') {
      exportToPDF(
        reporteData.data,
        reporteData.nombre,
        reporteData.columns,
        reporteData.nombre
      );
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="responsive-page min-w-0 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reportes</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Visualiza y exporta reportes del sistema</p>
      </div>

      {/* Selector de fechas */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-end">
          <div className="min-w-0">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full min-h-11 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full min-h-11 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {(isAdmin || isTechnician) && (
        <>
          <TechnicalStatisticsPanel
            fechaInicio={fechaInicio}
            fechaFin={fechaFin}
          />

          <QualityDashboardPanel
            fechaInicio={fechaInicio}
            fechaFin={fechaFin}
          />
        </>
      )}

      {/* Grid de reportes */}
      <div className="space-y-8">
        {categorias.map((categoria) => {
          const IconCategoria = categoria.icon;
          const reportesFiltrados = categoria.reportes.filter(r => 
            r.roles.includes(userRole) || isAdmin
          );
          
          if (reportesFiltrados.length === 0) return null;
          
          return (
            <div key={categoria.nombre}>
              <div className="flex items-center gap-2 mb-4">
                <IconCategoria className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {categoria.nombre}
                </h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {reportesFiltrados.map((reporte) => (
                  <button
                    key={reporte.id}
                    onClick={() => handleGenerarReporte(reporte.id)}
                    disabled={loading && selectedReporte === reporte.id}
                    className={`text-left p-4 rounded-lg border transition-all ${
                      selectedReporte === reporte.id
                        ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700'
                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                          {reporte.nombre}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {reporte.descripcion}
                        </p>
                      </div>
                      {loading && selectedReporte === reporte.id && (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Vista previa del reporte */}
      {reporteData && reporteData.data && reporteData.data.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {reporteData.nombre}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => handleExportar('excel')}
                className="px-3 py-1.5 text-sm text-green-600 border border-green-300 rounded-lg hover:bg-green-50 transition-colors flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                Excel
              </button>
              <button
                onClick={() => handleExportar('pdf')}
                className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
              >
                <FileText className="w-3 h-3" />
                PDF
              </button>
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1"
              >
                <Printer className="w-3 h-3" />
                Imprimir
              </button>
            </div>
          </div>
          
          <div className="p-3 sm:p-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {reporteData.columns.map((col) => (
                    <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {reporteData.data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    {reporteData.columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="mt-4 text-sm text-gray-500 text-right">
              Total registros: {reporteData.data.length}
            </div>
          </div>
        </div>
      )}

      {reporteData && reporteData.data && reporteData.data.length === 0 && !loading && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-center">
          <p className="text-yellow-700 dark:text-yellow-300">No hay datos para el período seleccionado</p>
        </div>
      )}
    </div>
  );
};

export default Reportes;