import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import api from '../../../services/api';
import {
  DollarSign,
  Users,
  Wrench,
  CheckCircle2,
  Clock3,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

function money(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function hours(minutes) {
  return `${(Number(minutes || 0) / 60).toFixed(1)} h`;
}

function technicianName(item) {
  return [
    item.nombre1,
    item.nombre2,
    item.apellidos,
  ]
    .filter(Boolean)
    .join(' ') || item.usuario || 'Técnico';
}

export default function TechnicalStatisticsPanel({
  fechaInicio,
  fechaFin,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] =
    useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get(
        '/api/service-orders/stats/technical',
        {
          params: {
            from: fechaInicio || undefined,
            to: fechaFin || undefined,
          },
        }
      );

      setData(response.data?.data || null);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'No fue posible cargar las estadísticas técnicas'
      );
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.summary || {};
  const technicians =
    Array.isArray(data?.technicians)
      ? data.technicians
      : [];
  const monthly =
    Array.isArray(data?.monthly)
      ? data.monthly
      : [];

  const maxMonthlyRevenue = useMemo(
    () =>
      Math.max(
        1,
        ...monthly.map(
          (item) => Number(item.revenue || 0)
        )
      ),
    [monthly]
  );

  const maxTechRevenue = useMemo(
    () =>
      Math.max(
        1,
        ...technicians.map(
          (item) =>
            Number(item.confirmed_revenue || 0)
        )
      ),
    [technicians]
  );

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            Estadísticas del Área Técnica
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Ingresos confirmados, productividad y participación por técnico.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="min-h-10 rounded-xl border border-gray-300 dark:border-gray-700 px-3 font-semibold text-sm flex items-center justify-center gap-2"
        >
          <RefreshCw
            className={`w-4 h-4 ${
              loading ? 'animate-spin' : ''
            }`}
          />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          [
            'Ingreso confirmado',
            money(summary.confirmed_revenue),
            DollarSign,
          ],
          [
            'Servicios',
            Number(summary.total_services || 0),
            Wrench,
          ],
          [
            'Completados',
            Number(summary.closed_services || 0),
            CheckCircle2,
          ],
          [
            'En curso',
            Number(summary.active_services || 0),
            Clock3,
          ],
        ].map(([label, value, Icon]) => (
          <div
            key={label}
            className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4"
          >
            <div className="flex items-center gap-2 text-gray-500">
              <Icon className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                {label}
              </span>
            </div>
            <p className="mt-2 text-xl sm:text-2xl font-bold break-words">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 min-w-0">
          <h3 className="font-bold flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Ingreso del área por mes
          </h3>

          <div className="mt-5 overflow-x-auto">
            <div className="min-w-[560px] h-64 flex items-end gap-2">
              {monthly.map((item) => {
                const height =
                  Math.max(
                    4,
                    Math.round(
                      (
                        Number(item.revenue || 0) /
                        maxMonthlyRevenue
                      ) *
                        100
                    )
                  );

                return (
                  <div
                    key={item.month}
                    className="flex-1 min-w-12 h-full flex flex-col justify-end"
                  >
                    <div className="text-[10px] text-center text-gray-500 mb-1 truncate">
                      {money(item.revenue)}
                    </div>
                    <div className="h-48 flex items-end">
                      <div
                        className="w-full rounded-t-lg bg-blue-500/80"
                        style={{
                          height: `${height}%`,
                        }}
                        title={`${item.label}: ${money(item.revenue)}`}
                      />
                    </div>
                    <div className="mt-2 text-xs text-center text-gray-500">
                      {item.month}
                    </div>
                  </div>
                );
              })}

              {monthly.length === 0 && (
                <div className="w-full flex items-center justify-center text-sm text-gray-500">
                  Sin datos en este período.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 min-w-0">
          <h3 className="font-bold flex items-center gap-2">
            <Users className="w-4 h-4" />
            Ingreso gestionado por técnico principal
          </h3>

          <div className="mt-4 space-y-3 max-h-72 overflow-y-auto overscroll-contain">
            {technicians.map((tech) => {
              const revenue =
                Number(
                  tech.confirmed_revenue || 0
                );
              const width =
                Math.max(
                  revenue > 0 ? 3 : 0,
                  Math.round(
                    (revenue / maxTechRevenue) *
                      100
                  )
                );

              return (
                <div key={tech.id}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold truncate">
                      {technicianName(tech)}
                    </span>
                    <span className="shrink-0">
                      {money(revenue)}
                    </span>
                  </div>

                  <div className="mt-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{
                        width: `${width}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="font-bold">
            Tabla de técnicos
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            “Ingreso gestionado” se atribuye al responsable principal de la OS. Los servicios como apoyo se muestran aparte y no duplican el total del área.
          </p>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr>
                {[
                  'Técnico',
                  'Ingreso gestionado',
                  'Principal',
                  'Apoyo',
                  'Completados',
                  'Activos',
                  'Horas registradas',
                ].map((label) => (
                  <th
                    key={label}
                    className="px-4 py-3 text-left text-xs uppercase text-gray-500 whitespace-nowrap"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {technicians.map((tech) => (
                <tr key={tech.id}>
                  <td className="px-4 py-3 text-sm font-semibold whitespace-nowrap">
                    {technicianName(tech)}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {money(tech.confirmed_revenue)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {tech.principal_services}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {tech.support_services}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {tech.closed_services}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {tech.active_services}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {hours(tech.worked_minutes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden p-3 space-y-3">
          {technicians.map((tech) => (
            <article
              key={tech.id}
              className="rounded-xl border border-gray-200 dark:border-gray-800 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-bold min-w-0">
                  {technicianName(tech)}
                </p>
                <span className="text-sm font-semibold shrink-0">
                  {money(tech.confirmed_revenue)}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500">
                    Principal
                  </p>
                  <p className="font-semibold">
                    {tech.principal_services}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">
                    Apoyo
                  </p>
                  <p className="font-semibold">
                    {tech.support_services}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">
                    Completados
                  </p>
                  <p className="font-semibold">
                    {tech.closed_services}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">
                    Horas
                  </p>
                  <p className="font-semibold">
                    {hours(tech.worked_minutes)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        {data?.basis?.note ||
          'Los ingresos mostrados son operativos y no sustituyen la contabilidad oficial.'}
      </p>
    </section>
  );
}
