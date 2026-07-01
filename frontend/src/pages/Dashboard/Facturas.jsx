// src/pages/Dashboard/Facturas.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import ConfirmModal from '../../components/ui/ConfirmModal';
import FacturaTable from './facturas/components/FacturaTable';
import FacturaFilters from './facturas/components/FacturaFilters';
import FacturarModal from './facturas/FacturarModal';
import FacturaDetail from './facturas/FacturaDetail';
import { RefreshCw, Plus, FileText } from 'lucide-react';

const Facturas = () => {
  const { user } = useAuth();
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ estado: '', fecha_inicio: '', fecha_fin: '' });
  const [showFacturarModal, setShowFacturarModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedFactura, setSelectedFactura] = useState(null);
  const [selectedFacturaId, setSelectedFacturaId] = useState(null);

  const fetchFacturas = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.estado) params.append('estado', filters.estado);
      if (filters.fecha_inicio) params.append('fecha_inicio', filters.fecha_inicio);
      if (filters.fecha_fin) params.append('fecha_fin', filters.fecha_fin);
      
      const res = await api.get(`/api/invoices?${params.toString()}`);
      setFacturas(res.data || []);
    } catch (error) {
      console.error('Error fetching facturas:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchFacturas();
  }, [fetchFacturas]);

  const handleViewDetail = (id) => {
    setSelectedFacturaId(id);
    setShowDetailModal(true);
  };

  const handleCancel = (factura) => {
    setSelectedFactura(factura);
    setShowConfirmModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedFactura) return;
    try {
      await api.patch(`/api/invoices/${selectedFactura.id}/cancel`);
      await fetchFacturas();
      setShowConfirmModal(false);
      setSelectedFactura(null);
    } catch (error) {
      console.error('Error canceling factura:', error);
    }
  };

  const handleMarkPaid = async (id) => {
    try {
      await api.patch(`/api/invoices/${id}/paid`);
      await fetchFacturas();
    } catch (error) {
      console.error('Error marking as paid:', error);
    }
  };

  const userRole = user?.rol || 'usuario';
  const canEdit = userRole === 'admin' || userRole === 'facturacion';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Facturas</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gestiona las facturas emitidas</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchFacturas}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
          {canEdit && (
            <button
              onClick={() => setShowFacturarModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nueva Factura
            </button>
          )}
        </div>
      </div>

      <FacturaFilters
        filters={filters}
        onFilterChange={setFilters}
        onClearFilters={() => setFilters({ estado: '', fecha_inicio: '', fecha_fin: '' })}
        onSearch={fetchFacturas}
      />

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <FacturaTable
          facturas={facturas}
          loading={loading}
          onViewDetail={handleViewDetail}
          onCancel={handleCancel}
          onMarkPaid={handleMarkPaid}
          canEdit={canEdit}
        />
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setSelectedFactura(null);
        }}
        onConfirm={handleConfirmCancel}
        title="Anular Factura"
        message={`¿Estás seguro de anular la factura "${selectedFactura?.numero_factura}"? Esta acción no se puede deshacer.`}
        confirmText="Anular"
        cancelText="Cancelar"
        variant="danger"
      />

      <FacturarModal
        isOpen={showFacturarModal}
        onClose={() => setShowFacturarModal(false)}
        onSuccess={fetchFacturas}
      />

      <FacturaDetail
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedFacturaId(null);
        }}
        facturaId={selectedFacturaId}
        onRefresh={fetchFacturas}
      />
    </div>
  );
};

export default Facturas;