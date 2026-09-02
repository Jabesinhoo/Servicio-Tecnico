import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Clock3,
  RefreshCw,
  Send,
  ShieldCheck,
  Star,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../hooks/useAuth';

const number = (value, digits = 0) =>
  Number(value || 0).toLocaleString(
    'es-CO',
    {
      maximumFractionDigits:
        digits,
      minimumFractionDigits:
        digits,
    }
  );

const techName = (item) =>
  [
    item?.nombre1,
    item?.nombre2,
    item?.apellidos,
  ]
    .filter(Boolean)
    .join(' ') ||
  item?.usuario ||
  'Técnico';

const alertLabels = {
  sla_breached:
    'SLA vencido',
  sla_warning:
    'SLA próximo a vencer',
  rework_required:
    'Reproceso requerido',
  client_notification_pending:
    'Cliente pendiente de notificación',
  delivery_pending:
    'Entrega final pendiente',
  satisfaction_pending:
    'Satisfacción pendiente',
};

const priorityLabels = {
  urgente: 'Urgente',
  alta: 'Alta',
  normal: 'Normal',
  baja: 'Baja',
};

const Kpi = ({
  label,
  value,
  hint,
  Icon,
}) => (
  <div className="min-w-0 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
    <div className="flex items-center gap-2 text-gray-500">
      <Icon className="w-4 h-4 shrink-0" />
      <span className="text-xs font-semibold uppercase tracking-wide truncate">
        {label}
      </span>
    </div>

    <p className="mt-2 text-xl sm:text-2xl font-bold break-words">
      {value}
    </p>

    {hint && (
      <p className="mt-1 text-xs text-gray-500">
        {hint}
      </p>
    )}
  </div>
);

export default function QualityDashboardPanel({
  fechaInicio,
  fechaFin,
}) {
  const { user } = useAuth();

  const role =
    user?.role?.name ||
    user?.rol ||
    'usuario';

  const isAdmin =
    role === 'admin';

  const isTechnician =
    role === 'tecnico';

  const [data, setData] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const [policies, setPolicies] =
    useState([]);

  const [templates, setTemplates] =
    useState([]);

  const [workerStatus, setWorkerStatus] =
    useState(null);

  const [slaHistory, setSlaHistory] =
    useState([]);

  const load = useCallback(
    async () => {
      if (
        !isAdmin &&
        !isTechnician
      ) {
        return;
      }

      try {
        setLoading(true);
        setError('');

        const requests = [
          api.get(
            '/api/service-orders/quality/dashboard',
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
          ),
          api.get(
            '/api/service-orders/quality/sla-history'
          ),
        ];

        if (isAdmin) {
          requests.push(
            api.get(
              '/api/service-orders/integrations/templates'
            ),
            api.get(
              '/api/service-orders/integrations/worker-status'
            )
          );
        }

        const responses =
          await Promise.all(
            requests
          );

        const payload =
          responses[0]?.data?.data ||
          null;

        setData(payload);

        setSlaHistory(
          Array.isArray(
            responses[1]?.data?.data
          )
            ? responses[1].data.data
            : []
        );

        if (isAdmin) {
          setTemplates(
            Array.isArray(
              responses[2]?.data?.data
            )
              ? responses[2].data.data
              : []
          );

          setWorkerStatus(
            responses[3]?.data?.data ||
              null
          );
        }

        setPolicies(
          Array.isArray(
            payload?.sla_policies
          )
            ? payload.sla_policies.map(
                (item) => ({
                  ...item,
                  target_hours:
                    item.target_hours ??
                    '',
                })
              )
            : []
        );
      } catch (requestError) {
        setError(
          requestError.response
            ?.data?.message ||
            'No fue posible cargar calidad y SLA'
        );
      } finally {
        setLoading(false);
      }
    },
    [
      fechaInicio,
      fechaFin,
      isAdmin,
      isTechnician,
    ]
  );

  useEffect(() => {
    load();
  }, [load]);

  const summary =
    data?.summary || {};

  const myQuality =
    data?.my_quality || null;

  const technicians =
    Array.isArray(
      data?.technicians
    )
      ? data.technicians
      : [];

  const alerts =
    Array.isArray(data?.alerts)
      ? data.alerts
      : [];

  const maxRework =
    useMemo(
      () =>
        Math.max(
          1,
          ...technicians.map(
            (item) =>
              Number(
                item.rework_rate_pct ||
                  0
              )
          )
        ),
      [technicians]
    );

  const savePolicies =
    async () => {
      try {
        setSaving(true);
        setError('');

        await api.put(
          '/api/service-orders/quality/sla-policies',
          {
            policies:
              policies.map(
                (item) => ({
                  priority:
                    item.priority,
                  target_hours:
                    item.target_hours ===
                    ''
                      ? null
                      : Number(
                          item.target_hours
                        ),
                  warning_percent:
                    Number(
                      item.warning_percent ||
                        80
                    ),
                  active:
                    Boolean(
                      item.active
                    ),
                })
              ),
          }
        );

        await load();
      } catch (requestError) {
        setError(
          requestError.response
            ?.data?.message ||
            'No fue posible guardar las políticas SLA'
        );
      } finally {
        setSaving(false);
      }
    };

  const saveTemplate =
    async (template) => {
      try {
        setSaving(true);
        setError('');

        await api.put(
          `/api/service-orders/integrations/templates/${template.id}`,
          {
            channel:
              template.channel,
            name:
              template.name,
            subject_template:
              template.subject_template,
            body_template:
              template.body_template,
            active:
              Boolean(
                template.active
              ),
          }
        );

        await load();
      } catch (requestError) {
        setError(
          requestError.response
            ?.data?.message ||
            'No fue posible guardar la plantilla'
        );
      } finally {
        setSaving(false);
      }
    };

  const processOutbox =
    async () => {
      try {
        setSaving(true);
        setError('');

        const response =
          await api.post(
            '/api/service-orders/integrations/outbox/process',
            {
              limit: 20,
            }
          );

        const result =
          response.data?.data;

        if (
          result &&
          result.configured ===
            false
        ) {
          setError(
            result.message
          );
        }

        await load();
      } catch (requestError) {
        setError(
          requestError.response
            ?.data?.message ||
            'No fue posible procesar la cola'
        );
      } finally {
        setSaving(false);
      }
    };

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
          <h2 className="text-lg sm:text-xl font-bold">
            Calidad, SLA y alertas
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {isAdmin
              ? 'Reprocesos, satisfacción, tiempos y alertas operativas del área.'
              : 'Tu calidad individual y los totales consolidados del área.'}
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
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300">
          {error}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold">
            Total del área
          </h3>
        </div>

        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6 gap-3">
          <Kpi
            label="Servicios cerrados"
            value={number(
              summary.closed_services
            )}
            Icon={Wrench}
          />

          <Kpi
            label="Órdenes con reproceso"
            value={number(
              summary.reworked_orders
            )}
            hint={`${number(
              summary.rework_rate_pct,
              1
            )}% del período`}
            Icon={RefreshCw}
          />

          <Kpi
            label="Ciclos de reproceso"
            value={number(
              summary.rework_cycles
            )}
            Icon={RefreshCw}
          />

          <Kpi
            label="Satisfacción"
            value={
              Number(
                summary.avg_satisfaction ||
                  0
              ) > 0
                ? `${number(
                    summary.avg_satisfaction,
                    1
                  )} / 5`
                : 'Sin datos'
            }
            Icon={Star}
          />

          <Kpi
            label="Tiempo promedio"
            value={`${number(
              summary.avg_turnaround_hours,
              1
            )} h`}
            hint="Creación → entrega"
            Icon={Clock3}
          />

          <Kpi
            label="SLA vencidos"
            value={number(
              summary.sla_breached
            )}
            hint={
              Number(
                summary.sla_eligible ||
                  0
              ) > 0
                ? `${number(
                    summary.sla_eligible
                  )} OS con SLA`
                : 'SLA aún no activado'
            }
            Icon={TriangleAlert}
          />
        </div>
      </section>

      {isTechnician && (
        <section className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 sm:p-5">
          <h3 className="font-bold">
            Mi calidad
          </h3>

          <div className="mt-3 grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-3">
            <Kpi
              label="Servicios principales"
              value={number(
                myQuality
                  ?.principal_services
              )}
              Icon={Wrench}
            />

            <Kpi
              label="Mis reprocesos"
              value={number(
                myQuality
                  ?.reworked_orders
              )}
              hint={`${number(
                myQuality
                  ?.rework_rate_pct,
                1
              )}%`}
              Icon={RefreshCw}
            />

            <Kpi
              label="Mi satisfacción"
              value={
                Number(
                  myQuality
                    ?.avg_satisfaction ||
                    0
                ) > 0
                  ? `${number(
                      myQuality
                        ?.avg_satisfaction,
                      1
                    )} / 5`
                  : 'Sin datos'
              }
              Icon={Star}
            />

            <Kpi
              label="SLA vencidos"
              value={number(
                myQuality
                  ?.sla_breached
              )}
              Icon={TriangleAlert}
            />
          </div>

          <p className="mt-3 text-xs text-gray-500">
            No se muestran indicadores individuales de otros técnicos.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">
              Alertas operativas
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {isAdmin
                ? 'Órdenes que requieren atención.'
                : 'Solo alertas de órdenes donde participas.'}
            </p>
          </div>

          <span className="rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-3 py-1 text-xs font-bold">
            {alerts.length}
          </span>
        </div>

        <div className="p-3 sm:p-4 space-y-2 max-h-[420px] overflow-y-auto overscroll-contain">
          {alerts.map(
            (item) => (
              <article
                key={`${item.id}-${item.alert_type}`}
                className={`rounded-xl border p-3 ${
                  Number(
                    item.severity_rank
                  ) === 1
                    ? 'border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20'
                    : Number(
                        item.severity_rank
                      ) === 2
                      ? 'border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20'
                      : 'border-gray-200 dark:border-gray-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold">
                      {item.codigo_os}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                      {alertLabels[
                        item.alert_type
                      ] ||
                        item.alert_type}
                    </p>
                  </div>

                  <div className="text-xs text-gray-500">
                    {priorityLabels[
                      item.priority
                    ] ||
                      item.priority}
                    {' · '}
                    {number(
                      item.elapsed_hours,
                      1
                    )}{' '}
                    h
                  </div>
                </div>

                {item.target_hours && (
                  <p className="mt-2 text-xs text-gray-500">
                    SLA objetivo:{' '}
                    {item.target_hours} h
                  </p>
                )}
              </article>
            )
          )}

          {alerts.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-6 text-center text-sm text-gray-500">
              No hay alertas para este período.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="font-bold">
            Historial SLA
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Eventos persistentes generados por el worker V15.
          </p>
        </div>

        <div className="p-3 sm:p-4 space-y-2 max-h-80 overflow-y-auto overscroll-contain">
          {slaHistory.map(
            (item) => (
              <article
                key={item.id}
                className={`rounded-xl border p-3 ${
                  item.alert_type ===
                  'breached'
                    ? 'border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20'
                    : 'border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-bold">
                      {item.codigo_os}
                    </p>
                    <p className="text-sm mt-0.5">
                      {item.alert_type ===
                      'breached'
                        ? 'SLA vencido'
                        : 'Alerta preventiva SLA'}
                    </p>
                  </div>

                  <span className="text-xs text-gray-500">
                    {new Date(
                      item.created_at
                    ).toLocaleString(
                      'es-CO'
                    )}
                  </span>
                </div>

                <p className="mt-2 text-xs text-gray-500">
                  {priorityLabels[
                    item.priority
                  ] ||
                    item.priority}
                  {' · '}
                  {number(
                    item.elapsed_hours,
                    1
                  )}{' '}
                  h / objetivo{' '}
                  {item.target_hours} h
                </p>
              </article>
            )
          )}

          {slaHistory.length ===
            0 && (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-5 text-center text-sm text-gray-500">
              Todavía no hay eventos SLA generados por el worker.
            </div>
          )}
        </div>
      </section>

      {isAdmin && (
        <>
          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5">
            <div>
              <h3 className="font-bold">
                Políticas SLA
              </h3>

              <p className="mt-1 text-xs text-gray-500">
                V14 no activa tiempos arbitrarios. Define las horas objetivo y luego activa cada prioridad.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-3">
              {policies.map(
                (policy) => (
                  <div
                    key={
                      policy.priority
                    }
                    className="rounded-xl border border-gray-200 dark:border-gray-800 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong>
                        {priorityLabels[
                          policy.priority
                        ] ||
                          policy.priority}
                      </strong>

                      <label className="flex items-center gap-2 text-xs font-semibold">
                        <input
                          type="checkbox"
                          checked={Boolean(
                            policy.active
                          )}
                          onChange={(
                            event
                          ) =>
                            setPolicies(
                              (
                                current
                              ) =>
                                current.map(
                                  (
                                    item
                                  ) =>
                                    item.priority ===
                                    policy.priority
                                      ? {
                                          ...item,
                                          active:
                                            event
                                              .target
                                              .checked,
                                        }
                                      : item
                                )
                            )
                          }
                          className="w-5 h-5"
                        />
                        Activo
                      </label>
                    </div>

                    <label className="mt-3 block">
                      <span className="text-xs font-semibold text-gray-500">
                        Horas objetivo
                      </span>

                      <input
                        type="number"
                        min="1"
                        max="8760"
                        value={
                          policy.target_hours
                        }
                        onChange={(
                          event
                        ) =>
                          setPolicies(
                            (
                              current
                            ) =>
                              current.map(
                                (
                                  item
                                ) =>
                                  item.priority ===
                                  policy.priority
                                    ? {
                                        ...item,
                                        target_hours:
                                          event
                                            .target
                                            .value,
                                      }
                                    : item
                              )
                          )
                        }
                        className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                      />
                    </label>

                    <label className="mt-3 block">
                      <span className="text-xs font-semibold text-gray-500">
                        Alertar al %
                      </span>

                      <input
                        type="number"
                        min="50"
                        max="100"
                        value={
                          policy.warning_percent
                        }
                        onChange={(
                          event
                        ) =>
                          setPolicies(
                            (
                              current
                            ) =>
                              current.map(
                                (
                                  item
                                ) =>
                                  item.priority ===
                                  policy.priority
                                    ? {
                                        ...item,
                                        warning_percent:
                                          event
                                            .target
                                            .value,
                                      }
                                    : item
                              )
                          )
                        }
                        className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                      />
                    </label>
                  </div>
                )
              )}
            </div>

            <button
              type="button"
              onClick={savePolicies}
              disabled={saving}
              className="mt-4 w-full sm:w-auto min-h-11 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 font-semibold"
            >
              Guardar políticas SLA
            </button>
          </section>

          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold">
                Calidad por técnico principal
              </h3>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/60">
                  <tr>
                    {[
                      'Técnico',
                      'Servicios',
                      'Reprocesos',
                      '% reproceso',
                      'Satisfacción',
                      'SLA vencidos',
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
                          {techName(
                            tech
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {tech.principal_services}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {tech.reworked_orders}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {number(
                            tech.rework_rate_pct,
                            1
                          )}
                          %
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {Number(
                            tech.avg_satisfaction ||
                              0
                          ) > 0
                            ? `${number(
                                tech.avg_satisfaction,
                                1
                              )} / 5`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {tech.sla_breached}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="md:hidden p-3 space-y-3">
              {technicians.map(
                (tech) => {
                  const rework =
                    Number(
                      tech.rework_rate_pct ||
                        0
                    );

                  const width =
                    Math.round(
                      (
                        rework /
                        maxRework
                      ) * 100
                    );

                  return (
                    <article
                      key={tech.id}
                      className="rounded-xl border border-gray-200 dark:border-gray-800 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <strong className="min-w-0">
                          {techName(
                            tech
                          )}
                        </strong>

                        <span className="text-sm shrink-0">
                          {Number(
                            tech.avg_satisfaction ||
                              0
                          ) > 0
                            ? `${number(
                                tech.avg_satisfaction,
                                1
                              )}/5`
                            : '—'}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">
                            Servicios
                          </p>
                          <p className="font-semibold">
                            {tech.principal_services}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">
                            Reprocesos
                          </p>
                          <p className="font-semibold">
                            {tech.reworked_orders}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">
                            % reproceso
                          </p>
                          <p className="font-semibold">
                            {number(
                              rework,
                              1
                            )}
                            %
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">
                            SLA vencidos
                          </p>
                          <p className="font-semibold">
                            {tech.sla_breached}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-rose-500"
                          style={{
                            width: `${width}%`,
                          }}
                        />
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
              <div>
                <h3 className="font-bold">
                  Worker V15
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Proceso separado del backend HTTP. Controla SLA y procesa la outbox sin bloquear las solicitudes del sistema.
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  workerStatus?.online
                    ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                }`}
              >
                {workerStatus?.online
                  ? 'EN LÍNEA'
                  : 'FUERA DE LÍNEA'}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
              <div className="rounded-xl bg-gray-50 dark:bg-gray-950/50 p-3">
                <p className="text-xs text-gray-500">
                  Heartbeat
                </p>
                <p className="font-semibold mt-1 text-sm break-words">
                  {workerStatus?.worker
                    ?.heartbeat_at
                    ? new Date(
                        workerStatus.worker.heartbeat_at
                      ).toLocaleString(
                        'es-CO'
                      )
                    : 'Nunca iniciado'}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 dark:bg-gray-950/50 p-3">
                <p className="text-xs text-gray-500">
                  Último estado
                </p>
                <p className="font-semibold mt-1">
                  {workerStatus?.worker
                    ?.last_status ||
                    '—'}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 dark:bg-gray-950/50 p-3">
                <p className="text-xs text-gray-500">
                  Host
                </p>
                <p className="font-semibold mt-1 text-sm break-all">
                  {workerStatus?.worker
                    ?.host_name ||
                    '—'}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 dark:bg-gray-950/50 p-3">
                <p className="text-xs text-gray-500">
                  PID
                </p>
                <p className="font-semibold mt-1">
                  {workerStatus?.worker
                    ?.process_id ||
                    '—'}
                </p>
              </div>
            </div>

            {!workerStatus?.online && (
              <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300">
                Inicia el worker en otra terminal con: node src/workers/service-notification.worker.js
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold">
                Plantillas de notificación
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Están desactivadas por defecto. Activa únicamente los canales que realmente conectarás en n8n.
              </p>
            </div>

            <div className="p-3 sm:p-4 space-y-3">
              {templates.map(
                (template) => (
                  <article
                    key={template.id}
                    className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 sm:p-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold">
                          {template.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 break-all">
                          {template.event_type}
                          {' · '}
                          {template.channel}
                          {' · v'}
                          {template.version}
                        </p>
                      </div>

                      <label className="flex items-center gap-2 text-sm font-semibold shrink-0">
                        <input
                          type="checkbox"
                          checked={Boolean(
                            template.active
                          )}
                          onChange={(
                            event
                          ) =>
                            setTemplates(
                              (
                                current
                              ) =>
                                current.map(
                                  (
                                    item
                                  ) =>
                                    item.id ===
                                    template.id
                                      ? {
                                          ...item,
                                          active:
                                            event.target.checked,
                                        }
                                      : item
                                )
                            )
                          }
                          className="w-5 h-5"
                        />
                        Activa
                      </label>
                    </div>

                    {template.channel ===
                      'email' && (
                      <label className="mt-3 block">
                        <span className="text-xs font-semibold text-gray-500">
                          Asunto
                        </span>
                        <input
                          value={
                            template.subject_template ||
                            ''
                          }
                          onChange={(
                            event
                          ) =>
                            setTemplates(
                              (
                                current
                              ) =>
                                current.map(
                                  (
                                    item
                                  ) =>
                                    item.id ===
                                    template.id
                                      ? {
                                          ...item,
                                          subject_template:
                                            event.target.value,
                                        }
                                      : item
                                )
                            )
                          }
                          className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                        />
                      </label>
                    )}

                    <label className="mt-3 block">
                      <span className="text-xs font-semibold text-gray-500">
                        Mensaje
                      </span>
                      <textarea
                        rows={4}
                        value={
                          template.body_template ||
                          ''
                        }
                        onChange={(
                          event
                        ) =>
                          setTemplates(
                            (
                              current
                            ) =>
                              current.map(
                                (
                                  item
                                ) =>
                                  item.id ===
                                  template.id
                                    ? {
                                        ...item,
                                        body_template:
                                          event.target.value,
                                      }
                                    : item
                              )
                          )
                        }
                        className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2"
                      />
                    </label>

                    <p className="mt-2 text-[11px] text-gray-500">
                      Variables: {'{{codigo_os}}'}, {'{{client_name}}'}, {'{{client_phone}}'}, {'{{client_email}}'}, {'{{receiver_name}}'}, {'{{priority}}'}, {'{{target_hours}}'}.
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        saveTemplate(
                          template
                        )
                      }
                      disabled={saving}
                      className="mt-3 w-full sm:w-auto min-h-10 rounded-xl border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 px-4 font-semibold"
                    >
                      Guardar plantilla
                    </button>
                  </article>
                )
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <h3 className="font-bold">
                  Cola de integración / n8n
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  Los eventos quedan en una outbox durable. Solo se envían cuando configures SERVICE_NOTIFICATIONS_WEBHOOK_URL.
                </p>
              </div>

              <button
                type="button"
                onClick={processOutbox}
                disabled={saving}
                className="w-full lg:w-auto min-h-11 rounded-xl border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 px-4 font-semibold flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Procesar cola
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 lg:grid-cols-5 gap-2">
              {[
                [
                  'Configurado',
                  data?.outbox
                    ?.configured
                    ? 'Sí'
                    : 'No',
                ],
                [
                  'Pendientes',
                  data?.outbox
                    ?.pending ||
                    0,
                ],
                [
                  'Fallidos',
                  data?.outbox
                    ?.failed ||
                    0,
                ],
                [
                  'En proceso',
                  data?.outbox
                    ?.processing ||
                    0,
                ],
                [
                  'Enviados',
                  data?.outbox
                    ?.sent ||
                    0,
                ],
              ].map(
                ([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl bg-gray-50 dark:bg-gray-950/50 p-3"
                  >
                    <p className="text-xs text-gray-500">
                      {label}
                    </p>
                    <p className="font-bold mt-1">
                      {value}
                    </p>
                  </div>
                )
              )}
            </div>
          </section>
        </>
      )}

      <p className="text-xs text-gray-500">
        {data?.definitions?.sla ||
          'SLA configurable por prioridad.'}
      </p>
    </section>
  );
}
