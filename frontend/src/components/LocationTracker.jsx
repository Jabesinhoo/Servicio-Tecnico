// frontend/src/components/LocationTracker.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LocateFixed, MapPin, MapPinOff, RefreshCw, ShieldAlert } from 'lucide-react';
import api from '../services/api';

const PRECISE_ACCURACY_M = 25;
const TRACKING_ACCEPTABLE_ACCURACY_M = 80;
const MIN_SEND_INTERVAL_MS = 8_000;
const STATIONARY_REFRESH_MS = 25_000;
const MIN_MOVEMENT_METERS = 5;
const FAST_FIX_TIMEOUT_MS = 5_000;
const WATCH_TIMEOUT_MS = 10_000;

const haversineMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getDeviceId = () => {
  const key = 'tn_location_device_id_v1';
  let value = localStorage.getItem(key);
  if (value) return value;
  value = window.crypto?.randomUUID?.() || `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(key, value);
  return value;
};

const LocationTracker = () => {
  const [status, setStatus] = useState('idle');
  const [accuracy, setAccuracy] = useState(null);
  const [message, setMessage] = useState('');
  const [precisionTier, setPrecisionTier] = useState(null);

  const watchIdRef = useRef(null);
  const mountedRef = useRef(true);
  const sendingRef = useRef(false);
  const lastSentAtRef = useRef(0);
  const lastSentCoordsRef = useRef(null);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
  }, []);

  const sendPosition = useCallback(async (position) => {
    if (!mountedRef.current) return;

    const coords = position.coords;
    const reportedAccuracy = Number(coords.accuracy);
    setAccuracy(Number.isFinite(reportedAccuracy) ? reportedAccuracy : null);

    if (!Number.isFinite(reportedAccuracy) || reportedAccuracy > TRACKING_ACCEPTABLE_ACCURACY_M) {
      setStatus('requesting');
      setPrecisionTier(null);
      setMessage(
        Number.isFinite(reportedAccuracy)
          ? `Afinando ubicación · ±${Math.round(reportedAccuracy)} m`
          : 'Obteniendo ubicación'
      );
      return;
    }

    const latitude = Number(coords.latitude);
    const longitude = Number(coords.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const tier = reportedAccuracy <= PRECISE_ACCURACY_M ? 'precise' : 'provisional';
    setPrecisionTier(tier);
    setStatus('active');
    setMessage(
      tier === 'precise'
        ? `Ubicación lista · ±${Math.round(reportedAccuracy)} m`
        : `Ubicación obtenida · ±${Math.round(reportedAccuracy)} m · afinando precisión`
    );

    const now = Date.now();
    const elapsed = now - lastSentAtRef.current;
    let movedMeters = Infinity;
    if (lastSentCoordsRef.current) {
      movedMeters = haversineMeters(
        lastSentCoordsRef.current.latitude,
        lastSentCoordsRef.current.longitude,
        latitude,
        longitude
      );
    }

    const shouldSend =
      lastSentAtRef.current === 0 ||
      (elapsed >= MIN_SEND_INTERVAL_MS && movedMeters >= MIN_MOVEMENT_METERS) ||
      elapsed >= STATIONARY_REFRESH_MS ||
      (tier === 'precise' && precisionTier !== 'precise');

    if (!shouldSend || sendingRef.current) return;
    sendingRef.current = true;

    try {
      await api.post('/api/usuarios/me/location', {
        latitude,
        longitude,
        accuracy_m: reportedAccuracy,
        altitude_m: coords.altitude ?? null,
        altitude_accuracy_m: coords.altitudeAccuracy ?? null,
        heading_deg: coords.heading ?? null,
        speed_mps: coords.speed ?? null,
        captured_at: new Date(position.timestamp).toISOString(),
        client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
        client_platform: navigator.userAgentData?.platform || navigator.platform || null,
        client_language: navigator.language || null,
        client_connection_type: navigator.connection?.effectiveType || null,
        device_id: getDeviceId(),
      });

      lastSentAtRef.current = now;
      lastSentCoordsRef.current = { latitude, longitude };
    } catch (error) {
      const code = error.response?.data?.code;
      if (code === 'LOCATION_INTEGRITY_REJECTED') {
        setStatus('server_error');
        setMessage('No fue posible validar esta lectura. Reintentando.');
      } else if (code === 'LOCATION_ACCURACY_TOO_LOW') {
        setStatus('requesting');
        setMessage('Afinando ubicación');
      } else if (code === 'LOCATION_TABLES_NOT_INSTALLED') {
        setStatus('server_error');
        setMessage('Ubicación pendiente de activar en el servidor');
      } else if (error.response?.status === 401) {
        clearWatch();
      } else {
        console.error('Error enviando ubicación:', error.response?.data || error);
        setStatus('server_error');
        setMessage('No fue posible actualizar la ubicación');
      }
    } finally {
      sendingRef.current = false;
    }
  }, [clearWatch, precisionTier]);

  const handleGeoError = useCallback((error) => {
    if (!mountedRef.current) return;
    if (error.code === 1) {
      setStatus('denied');
      setMessage('Ubicación desactivada. Habilítala en el navegador.');
      clearWatch();
    } else if (error.code === 2) {
      setStatus('unavailable');
      setMessage('Ubicación temporalmente no disponible');
    } else if (error.code === 3) {
      setStatus('requesting');
      setMessage('Obteniendo ubicación');
    } else {
      setStatus('unavailable');
      setMessage('Ubicación no disponible');
    }
  }, [clearWatch]);

  const startTracking = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      clearWatch();
      setStatus('idle');
      return;
    }
    if (!window.isSecureContext) {
      setStatus('insecure');
      setMessage('La ubicación precisa requiere HTTPS o localhost');
      return;
    }
    if (!navigator.geolocation) {
      setStatus('unsupported');
      setMessage('Este navegador no soporta geolocalización');
      return;
    }

    clearWatch();
    setStatus('requesting');
    setMessage('Obteniendo ubicación');

    // 1) Intento rápido: permite aprovechar una lectura reciente del SO.
    navigator.geolocation.getCurrentPosition(
      sendPosition,
      () => {},
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: FAST_FIX_TIMEOUT_MS }
    );

    // 2) Seguimiento de alta precisión: continúa refinando sin bloquear la UI.
    watchIdRef.current = navigator.geolocation.watchPosition(
      sendPosition,
      handleGeoError,
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: WATCH_TIMEOUT_MS }
    );
  }, [clearWatch, handleGeoError, sendPosition]);

  useEffect(() => {
    mountedRef.current = true;
    startTracking();
    return () => {
      mountedRef.current = false;
      clearWatch();
    };
  }, [clearWatch, startTracking]);

  const retry = () => {
    lastSentAtRef.current = 0;
    lastSentCoordsRef.current = null;
    startTracking();
  };

  if (status === 'idle') return null;

  const active = status === 'active';
  const requesting = status === 'requesting';
  const denied = status === 'denied';

  return (
    <div
      className={`flex items-center gap-2 px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs max-w-[310px] ${
        active
          ? precisionTier === 'precise'
            ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300'
            : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300'
          : requesting
            ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300'
            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
      }`}
      title={message}
    >
      {active ? <LocateFixed className="w-3.5 h-3.5 shrink-0" /> : requesting ? <MapPin className="w-3.5 h-3.5 shrink-0" /> : denied ? <MapPinOff className="w-3.5 h-3.5 shrink-0" /> : <ShieldAlert className="w-3.5 h-3.5 shrink-0" />}
      <span className="hidden lg:inline truncate">
        {active && accuracy !== null ? `Ubicación ±${Math.round(accuracy)} m${precisionTier === 'provisional' ? ' · afinando' : ''}` : message}
      </span>
      {!active && !requesting && (
        <button type="button" onClick={retry} className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10" title="Reintentar ubicación">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default LocationTracker;
