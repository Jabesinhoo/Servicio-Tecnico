// frontend/src/pages/Dashboard/usuarios/UsuarioDetailModal.jsx

import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  X,
  RefreshCw,
  UserRound,
  Shield,
  Mail,
  Phone,
  CreditCard,
  Calendar,
  Clock,
  KeyRound,
  LogIn,
  CheckCircle2,
  XCircle,
  Monitor,
  Wifi,
  AlertTriangle,
  MapPin,
  Navigation,
  Gauge,
  ExternalLink,
  LocateFixed,
} from 'lucide-react';

import api from '../../../services/api';

const formatDateTime = (value) => {
  if (!value) {
    return 'Nunca';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const getNombreCompleto = (usuario) =>
  usuario?.nombre_completo ||
  [
    usuario?.nombre1,
    usuario?.nombre2,
    usuario?.apellidos,
  ]
    .filter(Boolean)
    .join(' ')
    .trim() ||
  'Sin nombre';

const getDeviceSummary = (userAgent) => {
  const ua = String(userAgent || '');

  if (!ua) {
    return 'Dispositivo no identificado';
  }

  let browser = 'Navegador';
  let os = 'Sistema';

  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/OPR\//i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua)) browser = 'Safari';

  if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS/iPadOS';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return `${browser} · ${os}`;
};

const formatAge = (seconds) => {
  const value = Number(seconds);

  if (!Number.isFinite(value)) return '—';
  if (value < 10) return 'ahora mismo';
  if (value < 60) return `hace ${Math.floor(value)} s`;
  if (value < 3600) return `hace ${Math.floor(value / 60)} min`;
  return `hace ${Math.floor(value / 3600)} h`;
};

const formatAccuracy = (value) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? `±${Math.round(number)} m`
    : '—';
};

const formatSpeed = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) return '—';

  return `${(number * 3.6).toFixed(1)} km/h`;
};

const buildOsmEmbedUrl = (latitude, longitude, accuracyM = 25) => {
  const lat = Number(latitude);
  const lon = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return '';
  }

  const accuracyDegrees = Math.max(
    Number(accuracyM) || 25,
    10
  ) / 111320;

  const delta = Math.max(0.0015, accuracyDegrees * 8);
  const left = lon - delta;
  const right = lon + delta;
  const bottom = lat - delta;
  const top = lat + delta;

  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lon}`;
};

const buildOsmExternalUrl = (latitude, longitude) => {
  const lat = Number(latitude);
  const lon = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return '';
  }

  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=19/${lat}/${lon}`;
};

const InfoItem = ({
  icon: Icon,
  label,
  value,
}) => (
  <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 bg-gray-50/70 dark:bg-gray-800/30">
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />

      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </p>

        <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5 break-words">
          {value ?? '—'}
        </p>
      </div>
    </div>
  </div>
);

const UsuarioDetailModal = ({
  isOpen,
  userId,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);

  const loadActivity = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await api.get(
        `/api/usuarios/${userId}/activity?limit=50`
      );

      setData(response.data?.data || null);
    } catch (requestError) {
      console.error(
        'Error cargando ficha del usuario:',
        requestError.response?.data || requestError
      );

      setData(null);
      setError(
        requestError.response?.data?.message ||
          'No fue posible cargar la ficha del usuario.'
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadCurrentLocation = useCallback(async ({ silent = false } = {}) => {
    if (!userId) return;

    try {
      if (!silent) setLocationLoading(true);
      setLocationError('');

      const response = await api.get(
        `/api/usuarios/${userId}/location`
      );

      setCurrentLocation(response.data?.data || null);
    } catch (requestError) {
      const code = requestError.response?.data?.code;

      if (code === 'LOCATION_TABLES_NOT_INSTALLED') {
        setLocationError(
          'La base de datos de ubicación todavía no está activada.'
        );
      } else {
        setLocationError(
          requestError.response?.data?.message ||
            'No fue posible consultar la ubicación actual.'
        );
      }
    } finally {
      if (!silent) setLocationLoading(false);
    }
  }, [userId]);

  const loadLocationHistory = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await api.get(
        `/api/usuarios/${userId}/location/history?limit=25`
      );

      setLocationHistory(
        Array.isArray(response.data?.data)
          ? response.data.data
          : []
      );
    } catch (requestError) {
      const code = requestError.response?.data?.code;

      if (code !== 'LOCATION_TABLES_NOT_INSTALLED') {
        console.error(
          'Error cargando historial de ubicación:',
          requestError.response?.data || requestError
        );
      }

      setLocationHistory([]);
    }
  }, [userId]);

  const refreshAll = useCallback(() => {
    loadActivity();
    loadCurrentLocation();
    loadLocationHistory();
  }, [loadActivity, loadCurrentLocation, loadLocationHistory]);

  useEffect(() => {
    if (!isOpen || !userId) {
      return;
    }

    loadActivity();
    loadCurrentLocation();
    loadLocationHistory();
    const intervalId = window.setInterval(() => {
      loadCurrentLocation({ silent: true });
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    isOpen,
    userId,
    loadActivity,
    loadCurrentLocation,
    loadLocationHistory,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousBodyOverflow = document.body.style.overflow;

    // Evita que el documento del fondo se desplace mientras
    // el modal está abierto. El scroll queda dentro del panel.
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const usuario = data?.user;
  const events = Array.isArray(data?.login_events)
    ? data.login_events
    : [];

  const active =
    usuario?.activo === true ||
    usuario?.activo === 1 ||
    usuario?.activo === '1' ||
    String(usuario?.activo).toLowerCase() === 'true';

  const locked =
    usuario?.locked_until &&
    new Date(usuario.locked_until).getTime() > Date.now();

  const mapUrl = currentLocation
    ? buildOsmEmbedUrl(
        currentLocation.latitude,
        currentLocation.longitude,
        currentLocation.accuracy_m
      )
    : '';

  const externalMapUrl = currentLocation
    ? buildOsmExternalUrl(
        currentLocation.latitude,
        currentLocation.longitude
      )
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center overflow-hidden p-0 sm:p-5 bg-black/55"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-none sm:rounded-xl shadow-2xl w-full max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[calc(100dvh-2.5rem)] overflow-hidden flex flex-col">
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between gap-3 sm:gap-4 shrink-0 bg-white dark:bg-gray-900">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <UserRound className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>

            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Ficha del usuario
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                {usuario
                  ? getNombreCompleto(usuario)
                  : 'Cargando información...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshAll}
              disabled={loading}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
              title="Actualizar ficha"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  loading ? 'animate-spin' : ''
                }`}
              />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6" style={{ WebkitOverflowScrolling: 'touch' }}>
          {error && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300 flex gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && !usuario ? (
            <div className="h-56 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : usuario ? (
            <>
              <section className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                      {getNombreCompleto(usuario)}
                    </h4>

                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      @{usuario.usuario || 'sin-usuario'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                      <Shield className="w-3.5 h-3.5" />
                      {usuario.role?.name || usuario.rol || 'Sin rol'}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        active
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      }`}
                    >
                      {active ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      {active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <InfoItem
                    icon={Mail}
                    label="Correo"
                    value={usuario.email || '—'}
                  />

                  <InfoItem
                    icon={Phone}
                    label="Celular"
                    value={usuario.celular || '—'}
                  />

                  <InfoItem
                    icon={CreditCard}
                    label="Cédula"
                    value={usuario.cedula || '—'}
                  />

                  <InfoItem
                    icon={Calendar}
                    label="Cuenta creada"
                    value={formatDateTime(usuario.created_at)}
                  />
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                  Seguridad y actividad
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <InfoItem
                    icon={LogIn}
                    label="Último acceso"
                    value={formatDateTime(usuario.last_login)}
                  />

                  <InfoItem
                    icon={KeyRound}
                    label="Último cambio de clave"
                    value={formatDateTime(usuario.password_changed_at)}
                  />

                  <InfoItem
                    icon={AlertTriangle}
                    label="Intentos fallidos"
                    value={String(usuario.failed_attempts ?? 0)}
                  />

                  <InfoItem
                    icon={Clock}
                    label="Bloqueo"
                    value={
                      locked
                        ? `Hasta ${formatDateTime(usuario.locked_until)}`
                        : 'Sin bloqueo activo'
                    }
                  />
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                      <LocateFixed className="w-4 h-4 text-blue-500" />
                      Ubicación de alta precisión
                    </h4>

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Se actualiza cada pocos segundos mientras el usuario mantiene la aplicación abierta y concede permiso de ubicación.
                    </p>
                  </div>

                  {currentLocation && (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        currentLocation.is_stale
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {currentLocation.is_stale
                        ? `Última posición ${formatAge(currentLocation.age_seconds)}`
                        : `En vivo · ${formatAge(currentLocation.age_seconds)}`}
                    </span>
                  )}
                </div>

                {locationError && (
                  <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 text-sm text-amber-700 dark:text-amber-300">
                    {locationError}
                  </div>
                )}

                {locationLoading && !currentLocation ? (
                  <div className="h-32 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800">
                    <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" />
                  </div>
                ) : currentLocation ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <InfoItem
                        icon={Gauge}
                        label="Precisión reportada"
                        value={formatAccuracy(currentLocation.accuracy_m)}
                      />

                      <InfoItem
                        icon={Clock}
                        label="Última actualización"
                        value={formatAge(currentLocation.age_seconds)}
                      />

                      <InfoItem
                        icon={Navigation}
                        label="Velocidad"
                        value={formatSpeed(currentLocation.speed_mps)}
                      />

                      <InfoItem
                        icon={MapPin}
                        label="Coordenadas"
                        value={`${Number(currentLocation.latitude).toFixed(7)}, ${Number(currentLocation.longitude).toFixed(7)}`}
                      />
                    </div>

                    {mapUrl && (
                      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800">
                        <iframe
                          key={`${currentLocation.latitude}-${currentLocation.longitude}-${currentLocation.received_at}`}
                          title={`Ubicación de ${getNombreCompleto(usuario)}`}
                          src={mapUrl}
                          className="w-full h-[260px] sm:h-[380px] border-0 pointer-events-none sm:pointer-events-auto"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Capturada: {formatDateTime(currentLocation.captured_at)} · Recibida: {formatDateTime(currentLocation.received_at)}
                      </p>

                      {externalMapUrl && (
                        <a
                          href={externalMapUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Abrir mapa
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-5 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-center">
                    <MapPin className="w-7 h-7 mx-auto text-gray-400" />
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-2">
                      Esperando datos para mostrar la ubicación
                    </p>

                  </div>
                )}

                {locationHistory.length > 0 && (
                  <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        Historial reciente de ubicación
                      </p>
                    </div>

                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                        <thead className="bg-white dark:bg-gray-900 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Fecha</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Coordenadas</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Precisión</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Velocidad</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                          {locationHistory.map((point) => (
                            <tr key={point.id}>
                              <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                {formatDateTime(point.captured_at)}
                              </td>
                              <td className="px-4 py-2 text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {Number(point.latitude).toFixed(6)}, {Number(point.longitude).toFixed(6)}
                              </td>
                              <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                {formatAccuracy(point.accuracy_m)}
                              </td>
                              <td className="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                {formatSpeed(point.speed_mps)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                      Historial de accesos
                    </h4>

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Últimos {events.length} eventos registrados para esta cuenta.
                    </p>
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                      <thead className="bg-gray-50 dark:bg-gray-800/60">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Fecha
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Resultado
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Dispositivo
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            IP
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Detalle
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {events.length === 0 ? (
                          <tr>
                            <td
                              colSpan="5"
                              className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
                            >
                              Aún no hay eventos de acceso registrados.
                            </td>
                          </tr>
                        ) : (
                          events.map((event) => (
                            <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                              <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                {formatDateTime(event.created_at)}
                              </td>

                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                                    event.success
                                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                  }`}
                                >
                                  {event.success ? (
                                    <CheckCircle2 className="w-3 h-3" />
                                  ) : (
                                    <XCircle className="w-3 h-3" />
                                  )}
                                  {event.success ? 'Correcto' : 'Fallido'}
                                </span>
                              </td>

                              <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 min-w-[180px]">
                                <div className="flex items-center gap-2" title={event.user_agent || ''}>
                                  <Monitor className="w-4 h-4 text-gray-400 shrink-0" />
                                  {getDeviceSummary(event.user_agent)}
                                </div>
                              </td>

                              <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <Wifi className="w-4 h-4 text-gray-400 shrink-0" />
                                  {event.ip_address || '—'}
                                </div>
                              </td>

                              <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 min-w-[180px]">
                                {event.success
                                  ? 'Inicio de sesión'
                                  : event.failure_reason || 'Acceso rechazado'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default UsuarioDetailModal;
