// frontend/src/components/LocationTracker.jsx
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  LocateFixed,
  MapPin,
  MapPinOff,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

import api from '../services/api';

const MAX_ACCEPTABLE_ACCURACY_M = 25;
const MIN_SEND_INTERVAL_MS = 10_000;
const STATIONARY_REFRESH_MS = 30_000;
const MIN_MOVEMENT_METERS = 5;

const haversineMeters = (lat1, lon1, lat2, lon2) => {
  const earthRadius = 6371000;
  const toRadians = (degrees) =>
    (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(
    Math.sqrt(a),
    Math.sqrt(1 - a)
  );

  return earthRadius * c;
};

const LocationTracker = () => {
  const [status, setStatus] = useState('idle');
  const [accuracy, setAccuracy] = useState(null);
  const [message, setMessage] = useState('');

  const watchIdRef = useRef(null);
  const mountedRef = useRef(true);
  const sendingRef = useRef(false);
  const lastSentAtRef = useRef(0);
  const lastSentCoordsRef = useRef(null);

  const clearWatch = useCallback(() => {
    if (
      watchIdRef.current !== null &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(
        watchIdRef.current
      );
    }

    watchIdRef.current = null;
  }, []);

  const sendPosition = useCallback(async (position) => {
    if (!mountedRef.current) return;

    const coords = position.coords;
    const reportedAccuracy = Number(coords.accuracy);

    if (
      !Number.isFinite(reportedAccuracy) ||
      reportedAccuracy > MAX_ACCEPTABLE_ACCURACY_M
    ) {
      setAccuracy(
        Number.isFinite(reportedAccuracy)
          ? reportedAccuracy
          : null
      );
      setStatus('low_accuracy');
      setMessage(
        Number.isFinite(reportedAccuracy)
          ? `Buscando mayor precisión (±${Math.round(reportedAccuracy)} m)`
          : 'Buscando una ubicación de alta precisión'
      );
      return;
    }

    const latitude = Number(coords.latitude);
    const longitude = Number(coords.longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return;
    }

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

    const movedEnough =
      movedMeters >= MIN_MOVEMENT_METERS;

    const shouldSend =
      lastSentAtRef.current === 0 ||
      (elapsed >= MIN_SEND_INTERVAL_MS && movedEnough) ||
      elapsed >= STATIONARY_REFRESH_MS;

    setAccuracy(reportedAccuracy);
    setStatus('active');
    setMessage(
      `Compartiendo ubicación · ±${Math.round(reportedAccuracy)} m`
    );

    if (!shouldSend || sendingRef.current) {
      return;
    }

    sendingRef.current = true;

    try {
      await api.post(
        '/api/usuarios/me/location',
        {
          latitude,
          longitude,
          accuracy_m: reportedAccuracy,
          altitude_m:
            coords.altitude ?? null,
          altitude_accuracy_m:
            coords.altitudeAccuracy ?? null,
          heading_deg:
            coords.heading ?? null,
          speed_mps:
            coords.speed ?? null,
          captured_at: new Date(
            position.timestamp
          ).toISOString(),
        }
      );

      lastSentAtRef.current = now;
      lastSentCoordsRef.current = {
        latitude,
        longitude,
      };
    } catch (error) {
      const code =
        error.response?.data?.code;

      if (
        code ===
        'LOCATION_ACCURACY_TOO_LOW'
      ) {
        setStatus('low_accuracy');
        setMessage(
          'Esperando una ubicación con mejor precisión'
        );
      } else if (
        code ===
        'LOCATION_TABLES_NOT_INSTALLED'
      ) {
        setStatus('server_error');
        setMessage(
          'Ubicación pendiente de activar en el servidor'
        );
      } else if (
        error.response?.status === 401
      ) {
        clearWatch();
      } else {
        console.error(
          'Error enviando ubicación:',
          error.response?.data || error
        );

        setStatus('server_error');
        setMessage(
          'No fue posible actualizar la ubicación'
        );
      }
    } finally {
      sendingRef.current = false;
    }
  }, [clearWatch]);

  const handleGeoError = useCallback((error) => {
    if (!mountedRef.current) return;

    if (error.code === 1) {
      setStatus('denied');
      setMessage(
        'Ubicación desactivada. Habilítala en el navegador.'
      );
      clearWatch();
      return;
    }

    if (error.code === 2) {
      setStatus('unavailable');
      setMessage(
        'El dispositivo no pudo obtener una ubicación precisa'
      );
      return;
    }

    if (error.code === 3) {
      setStatus('requesting');
      setMessage(
        'Buscando señal de ubicación...'
      );
      return;
    }

    setStatus('unavailable');
    setMessage('Ubicación no disponible');
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
      setMessage(
        'La ubicación precisa requiere HTTPS o localhost'
      );
      return;
    }

    if (!navigator.geolocation) {
      setStatus('unsupported');
      setMessage(
        'Este navegador no soporta geolocalización'
      );
      return;
    }

    clearWatch();
    setStatus('requesting');
    setMessage(
      'Solicitando ubicación precisa...'
    );

    watchIdRef.current =
      navigator.geolocation.watchPosition(
        sendPosition,
        handleGeoError,
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 20_000,
        }
      );
  }, [
    clearWatch,
    handleGeoError,
    sendPosition,
  ]);

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

  if (status === 'idle') {
    return null;
  }

  const active = status === 'active';
  const requesting =
    status === 'requesting' ||
    status === 'low_accuracy';
  const denied = status === 'denied';

  return (
    <div
      className={`flex items-center gap-2 px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs max-w-[290px] ${
        active
          ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300'
          : requesting
            ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300'
            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
      }`}
      title={message}
    >
      {active ? (
        <LocateFixed className="w-3.5 h-3.5 shrink-0" />
      ) : requesting ? (
        <MapPin className="w-3.5 h-3.5 shrink-0" />
      ) : denied ? (
        <MapPinOff className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
      )}

      <span className="hidden lg:inline truncate">
        {active && accuracy !== null
          ? `Ubicación ±${Math.round(accuracy)} m`
          : message}
      </span>

      {!active && !requesting && (
        <button
          type="button"
          onClick={retry}
          className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
          title="Reintentar ubicación"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default LocationTracker;
