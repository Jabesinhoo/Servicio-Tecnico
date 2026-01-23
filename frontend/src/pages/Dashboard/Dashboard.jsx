import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import api from "../../services/api";
import {
  Activity,
  AlertTriangle,
  Clock,
  Package,
  ShoppingCart,
  Wrench,
} from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [stats, setStats] = useState({
    totalVentas: 0,
    totalServicios: 0,
    serviciosPendientes: 0,
    stockBajo: 0,
  });

  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const welcomeName = useMemo(() => {
    // Ajusta esto según tu user real
    return user?.nombres || user?.usuario || user?.email || "Usuario";
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError("");

      // ✅ importante: tus rutas reales son /api/dashboard/...
      const [statsRes, activitiesRes] = await Promise.all([
        api.get("/api/dashboard/stats"),
        api.get("/api/dashboard/recent-activities"),
      ]);

      setStats(statsRes.data);
      setRecentActivities(activitiesRes.data);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);

      // Si el backend responde 401/403, mandamos a login
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
        return;
      }

      setError("No se pudo cargar la información del dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  const StatCard = ({ title, value, icon: Icon, accent = "sky" }) => {
    const accentStyles =
      accent === "emerald"
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
        : accent === "amber"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
        : accent === "rose"
        ? "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300"
        : "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300";

    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden">
        <div className="p-5">
          <div className="flex items-center gap-4">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center ${accentStyles}`}
            >
              <Icon className="w-5 h-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 truncate">
                {title}
              </p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
                {value}
              </p>
            </div>
          </div>
        </div>

        <div className="h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500" />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500" />
          <span className="font-semibold">Cargando dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500" />
        <div className="p-6 sm:p-7 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {getWelcomeMessage()}, {welcomeName}!
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Aquí tienes un resumen general del sistema técnico.
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <Activity className="w-4 h-4 text-slate-500 dark:text-slate-300" />
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Panel de control
            </span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Ventas Totales"
          value={stats.totalVentas}
          icon={ShoppingCart}
          accent="emerald"
        />

        <StatCard
          title="Servicios Activos"
          value={stats.totalServicios}
          icon={Wrench}
          accent="sky"
        />

        <StatCard
          title="Pendientes"
          value={stats.serviciosPendientes}
          icon={Clock}
          accent="amber"
        />

        <StatCard
          title="Stock Bajo"
          value={stats.stockBajo}
          icon={Package}
          accent="rose"
        />
      </div>

      {/* Recent Activities */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500" />

        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Actividad Reciente
            </h3>
          </div>

          <button
            onClick={fetchDashboardData}
            className="text-sm font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 transition"
          >
            Actualizar
          </button>
        </div>

        <div className="p-6">
          {recentActivities?.length > 0 ? (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {recentActivities.map((activity, index) => (
                <li key={index} className="py-4">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-slate-500 dark:text-slate-300" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                          {activity.title || "Actividad"}
                        </h4>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {activity.time || ""}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {activity.description || "Sin descripción"}
                      </p>

                      {activity.user && (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Por: <span className="font-semibold">{activity.user}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-10">
              <p className="text-slate-500 dark:text-slate-400 font-semibold">
                No hay actividades recientes
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
