// src/pages/Dashboard/hooks/useDashboardData.js
import { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';

export const useDashboardData = () => {
  const [stats, setStats] = useState({
    totalVentas: 0,
    totalServicios: 0,
    serviciosPendientes: 0,
    serviciosEnEjecucion: 0,
    serviciosCompletados: 0,
    stockBajo: 0,
    productosTotales: 0,
    clientesActivos: 0,
    tecnicosActivos: 0,
    ingresosMes: 0,
    ingresosTotales: 0,
  });
  
  const [recentActivities, setRecentActivities] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [chartData, setChartData] = useState({
    labels: [],
    servicios: [],
    ventas: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // Intentar cada endpoint individualmente para no fallar todos si uno falla
      let statsData = {};
      let activitiesData = [];
      let salesData = [];
      let productsData = [];
      let chartDataResult = { labels: [], ventas: [], servicios: [] };

      try {
        const statsRes = await api.get('/api/dashboard/stats');
        statsData = statsRes.data;
      } catch (err) {
        console.warn('Error fetching stats:', err);
      }

      try {
        const activitiesRes = await api.get('/api/dashboard/recent-activities');
        activitiesData = activitiesRes.data;
      } catch (err) {
        console.warn('Error fetching activities:', err);
      }

      try {
        const salesRes = await api.get('/api/dashboard/recent-sales');
        salesData = salesRes.data;
      } catch (err) {
        console.warn('Error fetching recent sales:', err);
      }

      try {
        const productsRes = await api.get('/api/dashboard/top-products');
        productsData = productsRes.data;
      } catch (err) {
        console.warn('Error fetching top products:', err);
      }

      try {
        const chartRes = await api.get('/api/dashboard/chart-data');
        chartDataResult = chartRes.data;
      } catch (err) {
        console.warn('Error fetching chart data:', err);
      }

      setStats(prev => ({ ...prev, ...statsData }));
      setRecentActivities(activitiesData);
      setRecentSales(salesData);
      setTopProducts(productsData);
      setChartData(chartDataResult);
      
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError('No se pudo cargar la información del dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    stats,
    recentActivities,
    recentSales,
    topProducts,
    chartData,
    loading,
    error,
    refreshData: fetchDashboardData,
  };
};