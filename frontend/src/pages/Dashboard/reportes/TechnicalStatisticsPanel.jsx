import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../hooks/useAuth';
import {
  DollarSign,
  Users,
  Wrench,
  CheckCircle2,
  Clock3,
  RefreshCw,
  TrendingUp,
  UserRound,
  Star,
} from 'lucide-react';

function money(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function hours(minutes) {
  return `${(
    Number(minutes || 0) / 60
  ).toFixed(1)} h`;
}

function technicianName(item) {
  return [
    item?.nombre1,
    item?.nombre2,
    item?.apellidos,
  ]
    .filter(Boolean)
    .join(' ') ||
    item?.usuario ||
    'Técnico';
}

const Kpi = ({
  label,
  value,
  Icon,
}) => (
  <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 min-w-0">
    <div className="flex items-center gap-2 text-gray-500">
      <Icon className="w-4 h-4 shrink-0" />
      <span className="text-xs font-semibold uppercase tracking-wide truncate">
        {label}
      </span>
    </div>
    <p className="mt-2 text-xl sm:text-2xl font-bold break-words">
      {value}
    </p>
  </div>
);

const Bars = ({
  rows,
  revenueKey = 'revenue',
}) => {
  const maxRevenue = Math.max(
    1,
    ...rows.map(
      (item) =>
        Number(item?.[revenueKey] || 0)
    )
  );

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px] h-64 flex items-end gap-2">
        {rows.map((item) => {
          const revenue =
            Number(
              item?.[revenueKey] || 0
            );

          const height = Math.max(
            revenue > 0 ? 4 : 0,
            Math.round(
              (
                revenue /
                maxRevenue
              ) * 100
            )
          );

          return (
            <div
              key={item.month}
              className="flex-1 min-w-12 h-full flex flex-col justify-end"
            >
              <div className="text-[10px] text-center text-gray-500 mb-1 truncate">
                {money(revenue)}
              </div>
              <div className="h-48 flex items-end">
                <div
                  className="w-full rounded-t-lg bg-blue-500/80"
                  style={{
                    height: `${height}%`,
                  }}
                />
              </div>
              <div className="mt-2 text-xs text-center text-gray-500">
                {item.month}
              </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="w-full flex items-center justify-center text-sm text-gray-500">
            Sin datos en este período.
          </div>
        )}
      </div>
    </div>
  );
};

export default function TechnicalStatisticsPanel({
  fechaInicio,
  fechaFin,
}) {
  const { user } = useAuth();

  const role =
    user?.role?.name ||
    user?.rol ||
    'usuario';

  const isAdmin = role === 'admin';
  const isTechnician =
    role === 'tecnico';

  const [data, setData] =
    useState(null);
  const [loading, setLoading] =
    useState(false);
  const [error, setError] =
    useState('');

  const load = useCallback(
    async () => {
      try {
        setLoading(true);
        setError('');

        const response = await api.get(
          '/api/service-orders/stats/technical',
          {
            params: {
              from:
                fechaInicio ||
                undefined,
              to:
                fechaFin ||
                undefined,
            },
          }
        );

        setData(
          response.data?.data || null
        );
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.message ||
            'No fue posible cargar las estadísticas técnicas'
        );
      } finally {
        setLoading(false);
      }
    },
    [fechaInicio, fechaFin]
  );

  useEffect(() => {
    if (
      isAdmin ||
      isTechnician
    ) {
      load();
    }
  }, [
    load,
    isAdmin,
    isTechnician,
  ]);

  const summary =
    data?.summary || {};

  const technicians =
    Array.isArray(data?.technicians)
      ? data.technicians
      : [];

  const monthly =
    Array.isArray(data?.monthly)
      ? data.monthly
      : [];

  const myStats =
    data?.my_stats || null;

  const myMonthly =
    Array.isArray(data?.my_monthly)
      ? data.my_monthly
      : [];

  const maxTechRevenue =
    useMemo(
      () =>
        Math.max(
          1,
          ...technicians.map(
            (item) =>
              Number(
                item.confirmed_revenue ||
                  0
              )
          )
        ),
      [technicians]
    );

  if (
    !isAdmin &&
    !isTechnician
  ) {
    return null;
  }

  return (
    <section className="min-w-0 space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            {isAdmin
              ? 'Estadísticas del Área Técnica'
              : 'Mis estadísticas técnicas'}
          </h2>

          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isAdmin
              ? 'Ingresos confirmados, productividad y participación por técnico.'
              : 'Tus resultados individuales y los totales generales del área, sin mostrar información individual de otros técnicos.'}
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="w-full sm:w-auto min-h-10 rounded-xl border border-gray-300 dark:border-gray-700 px-3 font-semibold text-sm flex items-center justify-center gap-2"
        >
          <RefreshCw
            className={`w-4 h-4 ${
              loading
                ? 'animate-spin'
                : ''
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

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-blue-600" />
          <h3 className="font-bold">
            Total del área
          </h3>
        </div>

        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          <Kpi
            label="Ingreso confirmado"
            value={money(
              summary.confirmed_revenue
            )}
            Icon={DollarSign}
          />

          <Kpi
            label="Servicios"
            value={Number(
              summary.total_services ||
                0
            )}
            Icon={Wrench}
          />

          <Kpi
            label="Completados"
            value={Number(
              summary.closed_services ||
                0
            )}
            Icon={CheckCircle2}
          />

          <Kpi
            label="En curso"
            value={Number(
              summary.active_services ||
                0
            )}
            Icon={Clock3}
          />

          <Kpi
            label="Satisfacción"
            value={
              Number(
                summary.avg_satisfaction ||
                  0
              ) > 0
                ? `${Number(
                    summary.avg_satisfaction
                  ).toFixed(1)} / 5`
                : 'Sin datos'
            }
            Icon={Star}
          />
        </div>
      </section>

      {isTechnician && (
        <>
          <section className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <UserRound className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold">
                Mi rendimiento
              </h3>
            </div>

            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              <Kpi
                label="Ingreso gestionado"
                value={money(
                  myStats?.confirmed_revenue
                )}
                Icon={DollarSign}
              />
              <Kpi
                label="Como principal"
                value={Number(
                  myStats?.principal_services ||
                    0
                )}
                Icon={Wrench}
              />
              <Kpi
                label="Como apoyo"
                value={Number(
                  myStats?.support_services ||
                    0
                )}
                Icon={Users}
              />
              <Kpi
                label="Horas registradas"
                value={hours(
                  myStats?.worked_minutes
                )}
                Icon={Clock3}
              />

              <Kpi
                label="Mi satisfacción"
                value={
                  Number(
                    myStats?.avg_satisfaction ||
                      0
                  ) > 0
                    ? `${Number(
                        myStats.avg_satisfaction
                      ).toFixed(1)} / 5`
                    : 'Sin datos'
                }
                Icon={Star}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 min-w-0">
            <h3 className="font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Mi ingreso gestionado por mes
            </h3>
            <div className="mt-5">
              <Bars rows={myMonthly} />
            </div>
          </section>

          <p className="text-xs text-gray-500">
            Por privacidad operativa, solo ves tus datos individuales y los totales consolidados del área. No se muestran cifras individuales de tus compañeros.
          </p>
        </>
      )}

      {isAdmin && (
        <>
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
            <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 min-w-0">
              <h3 className="font-bold flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Ingreso del área por mes
              </h3>
              <div className="mt-5">
                <Bars rows={monthly} />
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 min-w-0">
              <h3 className="font-bold flex items-center gap-2">
                <Users className="w-4 h-4" />
                Ingreso gestionado por técnico principal
              </h3>

              <div className="mt-4 space-y-3 max-h-72 overflow-y-auto overscroll-contain">
                {technicians.map(
                  (tech) => {
                    const revenue =
                      Number(
                        tech.confirmed_revenue ||
                          0
                      );

                    const width =
                      Math.max(
                        revenue > 0
                          ? 3
                          : 0,
                        Math.round(
                          (
                            revenue /
                            maxTechRevenue
                          ) * 100
                        )
                      );

                    return (
                      <div key={tech.id}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-semibold truncate">
                            {technicianName(
                              tech
                            )}
                          </span>
                          <span className="shrink-0">
                            {money(
                              revenue
                            )}
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
                  }
                )}
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold">
                Tabla de técnicos
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                El ingreso se atribuye al responsable principal de la OS; los apoyos no duplican el total del área.
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
                      'Horas',
                      'Satisfacción',
                    ].map(
                      (label) => (
                        <th
                          key={label}
                          className="px-4 py-3 text-left text-xs uppercase text-gray-500 whitespace-nowrap"
                        >
                          {label}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {technicians.map(
                    (tech) => (
                      <tr key={tech.id}>
                        <td className="px-4 py-3 text-sm font-semibold whitespace-nowrap">
                          {technicianName(
                            tech
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {money(
                            tech.confirmed_revenue
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {
                            tech.principal_services
                          }
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {
                            tech.support_services
                          }
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {
                            tech.closed_services
                          }
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {
                            tech.active_services
                          }
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {hours(
                            tech.worked_minutes
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {Number(
                            tech.avg_satisfaction ||
                              0
                          ) > 0
                            ? `${Number(
                                tech.avg_satisfaction
                              ).toFixed(1)} / 5`
                            : '—'}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="md:hidden p-3 space-y-3">
              {technicians.map(
                (tech) => (
                  <article
                    key={tech.id}
                    className="rounded-xl border border-gray-200 dark:border-gray-800 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-bold min-w-0">
                        {technicianName(
                          tech
                        )}
                      </p>
                      <span className="text-sm font-semibold shrink-0">
                        {money(
                          tech.confirmed_revenue
                        )}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">
                          Principal
                        </p>
                        <p className="font-semibold">
                          {
                            tech.principal_services
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">
                          Apoyo
                        </p>
                        <p className="font-semibold">
                          {
                            tech.support_services
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">
                          Completados
                        </p>
                        <p className="font-semibold">
                          {
                            tech.closed_services
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">
                          Horas
                        </p>
                        <p className="font-semibold">
                          {hours(
                            tech.worked_minutes
                          )}
                        </p>
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>
          </section>
        </>
      )}

      <p className="text-xs text-gray-500">
        {data?.basis?.note ||
          'Los ingresos mostrados son operativos y no sustituyen la contabilidad oficial.'}
      </p>
    </section>
  );
}
