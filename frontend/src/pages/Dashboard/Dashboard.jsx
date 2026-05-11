// src/pages/Dashboard/Dashboard.jsx
import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useDashboardData } from './hooks/useDashboardData';
import StatCard from './components/StatCard';
import ActivityItem from './components/ActivityItem';
import ChartCard from './components/ChartCard';
import RecentOrdersTable from './components/RecentOrdersTable';
import TopProductsChart from './components/TopProductsChart';
import {
  ShoppingCart,
  Wrench,
  Clock,
  Package,
  Users,
  TrendingUp,
  DollarSign,
  CheckCircle,
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const {
    stats,
    recentActivities,
    recentSales,
    topProducts,
    chartData,
    loading,
    error,
    refreshData,
  } = useDashboardData();

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const displayName = user?.nombre1 || user?.usuario || user?.email || 'Usuario';
  const userRole = user?.rol || 'usuario';

  // Función para determinar si el trend es positivo o negativo
  const getTrendType = (value) => {
    if (value > 0) return 'up';
    if (value < 0) return 'down';
    return null;
  };

  // Estadísticas según el rol - TODOS los valores vienen del backend
  const getStatsToShow = () => {
    const baseStats = {
      admin: [
        { title: 'Ventas Totales', value: stats.totalVentas, icon: ShoppingCart, trend: getTrendType(stats.trendVentas), trendValue: Math.abs(stats.trendVentas) },
        { title: 'Servicios Activos', value: stats.totalServicios, icon: Wrench, trend: getTrendType(stats.trendServicios), trendValue: Math.abs(stats.trendServicios) },
        { title: 'Pendientes', value: stats.serviciosPendientes, icon: Clock },
        { title: 'Ingresos del Mes', value: `$${stats.ingresosMes?.toLocaleString()}`, icon: DollarSign, trend: getTrendType(stats.trendIngresos), trendValue: Math.abs(stats.trendIngresos) },
        { title: 'Clientes Activos', value: stats.clientesActivos, icon: Users },
        { title: 'Stock Bajo', value: stats.stockBajo, icon: Package },
        { title: 'Productos Totales', value: stats.productosTotales, icon: Package },
        { title: 'Servicios Completados', value: stats.serviciosCompletados, icon: CheckCircle },
      ],
      tecnico: [
        { title: 'Mis Servicios', value: stats.totalServicios, icon: Wrench },
        { title: 'Pendientes', value: stats.serviciosPendientes, icon: Clock },
        { title: 'En Ejecución', value: stats.serviciosEnEjecucion, icon: TrendingUp },
        { title: 'Completados', value: stats.serviciosCompletados, icon: CheckCircle },
      ],
      default: [
        { title: 'Servicios', value: stats.totalServicios, icon: Wrench },
        { title: 'Pendientes', value: stats.serviciosPendientes, icon: Clock },
      ],
    };
    return baseStats[userRole] || baseStats.default;
  };

  const statsToShow = getStatsToShow();

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {getWelcomeMessage()}, {displayName}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {userRole === 'admin' && 'Panel de administración - Visión general del sistema'}
          {userRole === 'tecnico' && 'Panel del técnico - Tus servicios asignados'}
          {userRole === 'ventas' && 'Panel de ventas - Tus métricas'}
          {userRole === 'inventario' && 'Panel de inventarios - Control de stock'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statsToShow.slice(0, 4).map((stat, index) => (
          <StatCard
            key={index}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            trend={stat.trend}
            trendValue={stat.trendValue}
            loading={loading}
          />
        ))}
      </div>

      {/* Resto del dashboard igual... */}
      {userRole === 'admin' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {statsToShow.slice(4).map((stat, index) => (
              <StatCard
                key={index}
                title={stat.title}
                value={stat.value}
                icon={stat.icon}
                loading={loading}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Ventas vs Servicios (Últimos 6 meses)" onRefresh={refreshData}>
              <div className="h-64 flex items-center justify-center">
                {chartData.labels?.length > 0 ? (
                  <div className="w-full">
                    <div className="space-y-2">
                      {chartData.labels.map((label, i) => (
                        <div key={label} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>{label}</span>
                            <span>Ventas: {chartData.ventas?.[i] || 0} | Servicios: {chartData.servicios?.[i] || 0}</span>
                          </div>
                          <div className="flex gap-1">
                            <div 
                              className="bg-blue-600 h-4 rounded"
                              style={{ width: `${((chartData.ventas?.[i] || 0) / Math.max(...(chartData.ventas || [1]), 1)) * 100}%` }}
                            />
                            <div 
                              className="bg-green-600 h-4 rounded"
                              style={{ width: `${((chartData.servicios?.[i] || 0) / Math.max(...(chartData.servicios || [1]), 1)) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">Sin datos para mostrar</p>
                )}
              </div>
            </ChartCard>

            <ChartCard title="Productos Más Vendidos" onRefresh={refreshData}>
              <TopProductsChart products={topProducts} loading={loading} />
            </ChartCard>
          </div>
        </>
      )}

      {userRole === 'admin' && (
        <ChartCard title="Órdenes de Venta Recientes" onRefresh={refreshData}>
          <RecentOrdersTable orders={recentSales} loading={loading} onViewOrder={(id) => console.log('Ver orden:', id)} />
        </ChartCard>
      )}

      <ChartCard title="Actividad Reciente" onRefresh={refreshData}>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-4">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : recentActivities?.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No hay actividad reciente</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {recentActivities.map((activity, index) => (
              <ActivityItem key={index} activity={activity} />
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
};

export default Dashboard;