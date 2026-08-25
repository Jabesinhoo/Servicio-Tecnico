// backend/src/controllers/user-location.controller.js
'use strict';

const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const db = require('../models');

const { Usuario, sequelize } = db;
const Role = sequelize.models.Role || db.Role;
const { checkIpReputation } = require('../services/ip-reputation.service');

const readPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : fallback;
};

const MAX_ACCURACY_METERS = readPositiveNumber(
  process.env.LOCATION_TRACKING_MAX_ACCURACY_M,
  80
);

const PRECISE_ACCURACY_METERS = readPositiveNumber(
  process.env.LOCATION_PRECISE_ACCURACY_M,
  25
);

const CURRENT_STALE_SECONDS = readPositiveNumber(
  process.env.LOCATION_STALE_SECONDS,
  90
);

const HISTORY_MIN_SECONDS = readPositiveNumber(
  process.env.LOCATION_HISTORY_MIN_SECONDS,
  60
);

const HISTORY_MIN_DISTANCE_METERS = readPositiveNumber(
  process.env.LOCATION_HISTORY_MIN_DISTANCE_M,
  50
);


// Señales de integridad. Una VPN por sí sola NO cambia navigator.geolocation;
// estas reglas buscan saltos físicamente imposibles, cambios bruscos de red
// y contradicciones de telemetría. Los umbrales son configurables.
const SUSPICIOUS_SPEED_KMH = readPositiveNumber(
  process.env.LOCATION_SUSPICIOUS_SPEED_KMH,
  140
);

const REJECT_SPEED_KMH = readPositiveNumber(
  process.env.LOCATION_REJECT_SPEED_KMH,
  220
);

const RISK_REJECT_SCORE = Math.min(
  100,
  readPositiveNumber(process.env.LOCATION_RISK_REJECT_SCORE, 70)
);

const IP_CHANGE_WINDOW_SECONDS = readPositiveNumber(
  process.env.LOCATION_IP_CHANGE_WINDOW_SECONDS,
  600
);

const TABLE_MISSING_CODE = '42P01';

const isMissingTableError = (error) =>
  error?.original?.code === TABLE_MISSING_CODE ||
  error?.parent?.code === TABLE_MISSING_CODE;

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toOptionalFiniteNumber = (value) => {
  const number = toFiniteNumber(value);
  return number === null ? null : number;
};

const clampString = (value, maxLength) => {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text ? text.slice(0, maxLength) : null;
};

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];

  if (forwarded) {
    return String(forwarded)
      .split(',')[0]
      .trim()
      .slice(0, 64);
  }

  return clampString(
    req.ip || req.socket?.remoteAddress,
    64
  );
};

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

const getClientSignals = (body = {}) => ({
  timezone: clampString(body.client_timezone, 100),
  platform: clampString(body.client_platform, 100),
  language: clampString(body.client_language, 40),
  connectionType: clampString(body.client_connection_type, 40),
});

const getDeviceId = (body = {}) =>
  clampString(body.device_id, 100);

async function resolveDeviceTrust(userId, deviceId, clientSignals, userAgent, transaction) {
  if (!deviceId) return 'unknown';

  const existing = await sequelize.query(
    `SELECT id, trust_status FROM user_location_devices WHERE user_id = :userId AND device_id = :deviceId LIMIT 1`,
    { replacements: { userId, deviceId }, type: QueryTypes.SELECT, transaction }
  );

  if (existing[0]) {
    await sequelize.query(
      `UPDATE user_location_devices SET last_seen_at = NOW(), platform = COALESCE(:platform, platform), user_agent = COALESCE(:userAgent, user_agent) WHERE id = :id`,
      { replacements: { id: existing[0].id, platform: clientSignals.platform, userAgent }, type: QueryTypes.UPDATE, transaction }
    );
    return existing[0].trust_status;
  }

  const trustedCount = await sequelize.query(
    `SELECT COUNT(*)::int AS total FROM user_location_devices WHERE user_id = :userId AND trust_status = 'trusted'`,
    { replacements: { userId }, type: QueryTypes.SELECT, transaction }
  );

  const trustStatus = Number(trustedCount[0]?.total || 0) === 0 ? 'trusted' : 'pending';
  await sequelize.query(
    `INSERT INTO user_location_devices (id, user_id, device_id, trust_status, platform, user_agent, first_seen_at, last_seen_at, approved_at) VALUES (:id, :userId, :deviceId, :trustStatus, :platform, :userAgent, NOW(), NOW(), CASE WHEN :trustStatus = 'trusted' THEN NOW() ELSE NULL END)`,
    { replacements: { id: crypto.randomUUID(), userId, deviceId, trustStatus, platform: clientSignals.platform, userAgent }, type: QueryTypes.INSERT, transaction }
  );
  return trustStatus;
}

const evaluateLocationIntegrity = ({
  previous,
  location,
  ipAddress,
  userAgent,
}) => {
  const flags = [];
  let score = 0;
  let movementSpeedKmh = null;
  let networkChanged = false;

  // Precisión de 0-1 m en un teléfono convencional no prueba fraude,
  // pero es una señal débil que conviene auditar.
  if (location.accuracy_m < 1) {
    score += 8;
    flags.push('unusually_high_reported_accuracy');
  }

  if (previous) {
    const previousCaptured = new Date(previous.captured_at);
    const elapsedSeconds =
      (location.captured_at.getTime() - previousCaptured.getTime()) / 1000;

    if (elapsedSeconds > 0) {
      const distanceMeters = haversineMeters(
        Number(previous.latitude),
        Number(previous.longitude),
        location.latitude,
        location.longitude
      );

      movementSpeedKmh = (distanceMeters / elapsedSeconds) * 3.6;

      if (movementSpeedKmh > REJECT_SPEED_KMH) {
        score = 100;
        flags.push('physically_impossible_travel');
      } else if (movementSpeedKmh > SUSPICIOUS_SPEED_KMH) {
        score += 45;
        flags.push('implausible_travel_speed');
      }

      const browserSpeedKmh =
        location.speed_mps === null ? null : location.speed_mps * 3.6;

      if (
        browserSpeedKmh !== null &&
        browserSpeedKmh > 25 &&
        movementSpeedKmh < 3
      ) {
        score += 15;
        flags.push('speed_coordinate_mismatch');
      }

      if (
        previous.ip_address &&
        ipAddress &&
        previous.ip_address !== ipAddress &&
        elapsedSeconds <= IP_CHANGE_WINDOW_SECONDS
      ) {
        networkChanged = true;
        score += 10;
        flags.push('network_ip_changed');
      }
    }

    if (
      previous.user_agent &&
      userAgent &&
      previous.user_agent !== userAgent
    ) {
      score += 15;
      flags.push('user_agent_changed');
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const status =
    score >= RISK_REJECT_SCORE
      ? 'rejected'
      : score >= 35
        ? 'suspicious'
        : 'trusted';

  return {
    status,
    score,
    flags,
    movementSpeedKmh:
      movementSpeedKmh === null
        ? null
        : Math.round(movementSpeedKmh * 10) / 10,
    networkChanged,
  };
};

const getAdmin = async (userId) => {
  if (!userId) {
    return null;
  }

  return Usuario.findByPk(userId, {
    include: [
      {
        model: Role,
        as: 'role',
        attributes: ['id', 'name', 'active'],
      },
    ],
    attributes: ['id', 'rol', 'role_id', 'activo'],
  });
};

const ensureAdmin = async (req, res) => {
  const admin = await getAdmin(req.user?.id);

  const roleName = String(
    admin?.role?.name || admin?.rol || ''
  )
    .trim()
    .toLowerCase();

  if (!admin || admin.activo === false || roleName !== 'admin') {
    res.status(403).json({
      success: false,
      message:
        'Solo un administrador puede consultar ubicaciones de usuarios',
    });

    return null;
  }

  return admin;
};

const parseCapturedAt = (value) => {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const validateLocationPayload = (body) => {
  const latitude = toFiniteNumber(body.latitude);
  const longitude = toFiniteNumber(body.longitude);
  const accuracy = toFiniteNumber(
    body.accuracy_m ?? body.accuracy
  );

  if (
    latitude === null ||
    latitude < -90 ||
    latitude > 90
  ) {
    return {
      error: 'La latitud no es válida',
    };
  }

  if (
    longitude === null ||
    longitude < -180 ||
    longitude > 180
  ) {
    return {
      error: 'La longitud no es válida',
    };
  }

  if (accuracy === null || accuracy < 0) {
    return {
      error: 'La precisión de la ubicación es requerida',
    };
  }

  if (accuracy > MAX_ACCURACY_METERS) {
    return {
      error:
        'La ubicación todavía no tiene la precisión mínima requerida',
      code: 'LOCATION_ACCURACY_TOO_LOW',
      reported_accuracy_m: accuracy,
      max_accuracy_m: MAX_ACCURACY_METERS,
    };
  }

  const capturedAt = parseCapturedAt(body.captured_at);

  if (!capturedAt) {
    return {
      error: 'La fecha de captura de la ubicación no es válida',
    };
  }

  const now = Date.now();
  const ageMs = now - capturedAt.getTime();

  // No aceptamos posiciones excesivamente viejas ni fechas futuras.
  if (ageMs > 5 * 60 * 1000 || ageMs < -60 * 1000) {
    return {
      error:
        'La ubicación recibida está desactualizada o tiene una fecha inválida',
      code: 'LOCATION_TIMESTAMP_INVALID',
    };
  }

  const heading = toOptionalFiniteNumber(body.heading_deg ?? body.heading);
  const speed = toOptionalFiniteNumber(body.speed_mps ?? body.speed);
  const altitude = toOptionalFiniteNumber(body.altitude_m ?? body.altitude);
  const altitudeAccuracy = toOptionalFiniteNumber(
    body.altitude_accuracy_m ?? body.altitudeAccuracy
  );

  return {
    data: {
      latitude,
      longitude,
      accuracy_m: accuracy,
      altitude_m: altitude,
      altitude_accuracy_m: altitudeAccuracy,
      heading_deg:
        heading === null
          ? null
          : Math.max(0, Math.min(360, heading)),
      speed_mps:
        speed === null
          ? null
          : Math.max(0, speed),
      captured_at: capturedAt,
    },
  };
};

// ============================================================
// GUARDAR UBICACIÓN PROPIA DE ALTA PRECISIÓN
// ============================================================
const updateOwnLocation = async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Usuario no autenticado',
    });
  }

  const validation = validateLocationPayload(req.body || {});

  if (validation.error) {
    return res.status(
      validation.code === 'LOCATION_ACCURACY_TOO_LOW'
        ? 422
        : 400
    ).json({
      success: false,
      message: validation.error,
      code: validation.code,
      reported_accuracy_m:
        validation.reported_accuracy_m,
      max_accuracy_m:
        validation.max_accuracy_m,
    });
  }

  const location = validation.data;
  const receivedAt = new Date();
  const ipAddress = getClientIp(req);
  const userAgent = clampString(
    req.headers['user-agent'],
    1000
  );
  const clientSignals = getClientSignals(req.body || {});
  const deviceId = getDeviceId(req.body || {});
  const precisionTier =
    location.accuracy_m <= PRECISE_ACCURACY_METERS
      ? 'precise'
      : 'provisional';

  const networkReputation = await checkIpReputation(ipAddress, {
    userAgent,
    language: clientSignals.language,
  });

  const transaction = await sequelize.transaction();

  try {
    const deviceTrustStatus = await resolveDeviceTrust(
      userId, deviceId, clientSignals, userAgent, transaction
    );

    // Rechazamos silenciosamente una posición más antigua que la actual.
    const currentRows = await sequelize.query(
      `
        SELECT
          user_id,
          latitude,
          longitude,
          accuracy_m,
          ip_address,
          user_agent,
          integrity_status,
          integrity_score,
          captured_at,
          received_at
        FROM user_current_locations
        WHERE user_id = :userId
        LIMIT 1
      `,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    const current = currentRows[0] || null;

    if (
      current &&
      new Date(current.captured_at).getTime() >
        location.captured_at.getTime()
    ) {
      await transaction.commit();

      return res.json({
        success: true,
        ignored_as_stale: true,
        message:
          'La ubicación recibida era anterior a la posición actual',
      });
    }

    const integrity = evaluateLocationIntegrity({
      previous: current,
      location,
      ipAddress,
      userAgent,
    });

    if (integrity.status === 'rejected') {
      await sequelize.query(
        `
          INSERT INTO user_location_integrity_events (
            id, user_id, event_type, risk_score, flags,
            latitude, longitude, accuracy_m, movement_speed_kmh,
            ip_address, user_agent, captured_at, created_at
          ) VALUES (
            :id, :userId, 'location_rejected', :riskScore,
            CAST(:flags AS jsonb), :latitude, :longitude, :accuracyM,
            :movementSpeedKmh, :ipAddress, :userAgent, :capturedAt, :createdAt
          )
        `,
        {
          replacements: {
            id: crypto.randomUUID(),
            userId,
            riskScore: integrity.score,
            flags: JSON.stringify(integrity.flags),
            latitude: location.latitude,
            longitude: location.longitude,
            accuracyM: location.accuracy_m,
            movementSpeedKmh: integrity.movementSpeedKmh,
            ipAddress,
            userAgent,
            integrityStatus: integrity.status,
            integrityScore: integrity.score,
            integrityFlags: JSON.stringify(integrity.flags),
            movementSpeedKmh: integrity.movementSpeedKmh,
            networkChanged: integrity.networkChanged,
            clientTimezone: clientSignals.timezone,
            clientPlatform: clientSignals.platform,
            clientLanguage: clientSignals.language,
            clientConnectionType: clientSignals.connectionType,
            precisionTier,
            networkTrustStatus: networkReputation.status,
            networkProvider: networkReputation.provider,
            networkProxy: Boolean(networkReputation.proxy),
            networkVpn: Boolean(networkReputation.vpn),
            networkTor: Boolean(networkReputation.tor),
            networkHosting: Boolean(networkReputation.hosting),
            networkFraudScore: networkReputation.fraudScore,
            deviceId,
            deviceTrustStatus,
            capturedAt: location.captured_at,
            createdAt: receivedAt,
          },
          type: QueryTypes.INSERT,
          transaction,
        }
      );

      await transaction.commit();

      return res.status(422).json({
        success: false,
        code: 'LOCATION_INTEGRITY_REJECTED',
        message: 'No fue posible validar la integridad de esta lectura de ubicación',
      });
    }

    if (networkReputation.block) {
      await sequelize.query(
        `INSERT INTO user_location_integrity_events (id, user_id, event_type, risk_score, flags, latitude, longitude, accuracy_m, ip_address, user_agent, captured_at, created_at) VALUES (:id, :userId, 'network_anonymizer_detected', :riskScore, CAST(:flags AS jsonb), :latitude, :longitude, :accuracyM, :ipAddress, :userAgent, :capturedAt, NOW())`,
        { replacements: { id: crypto.randomUUID(), userId, riskScore: Math.max(70, Number(networkReputation.fraudScore || 70)), flags: JSON.stringify([networkReputation.vpn ? 'vpn' : null, networkReputation.proxy ? 'proxy' : null, networkReputation.tor ? 'tor' : null].filter(Boolean)), latitude: location.latitude, longitude: location.longitude, accuracyM: location.accuracy_m, ipAddress, userAgent, capturedAt: location.captured_at }, type: QueryTypes.INSERT, transaction }
      );
    }

    await sequelize.query(
      `
        INSERT INTO user_current_locations (
          user_id,
          latitude,
          longitude,
          accuracy_m,
          altitude_m,
          altitude_accuracy_m,
          heading_deg,
          speed_mps,
          source,
          ip_address,
          user_agent,
          integrity_status,
          integrity_score,
          integrity_flags,
          movement_speed_kmh,
          network_changed,
          client_timezone,
          client_platform,
          client_language,
          client_connection_type,
          precision_tier, network_trust_status, network_provider,
          network_proxy, network_vpn, network_tor, network_hosting, network_fraud_score,
          device_id, device_trust_status,
          captured_at,
          received_at
        )
        VALUES (
          :userId,
          :latitude,
          :longitude,
          :accuracyM,
          :altitudeM,
          :altitudeAccuracyM,
          :headingDeg,
          :speedMps,
          'browser_geolocation',
          :ipAddress,
          :userAgent,
          :integrityStatus,
          :integrityScore,
          CAST(:integrityFlags AS jsonb),
          :movementSpeedKmh,
          :networkChanged,
          :clientTimezone,
          :clientPlatform,
          :clientLanguage,
          :clientConnectionType,
          :precisionTier, :networkTrustStatus, :networkProvider,
          :networkProxy, :networkVpn, :networkTor, :networkHosting, :networkFraudScore,
          :deviceId, :deviceTrustStatus,
          :capturedAt,
          :receivedAt
        )
        ON CONFLICT (user_id)
        DO UPDATE SET
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          accuracy_m = EXCLUDED.accuracy_m,
          altitude_m = EXCLUDED.altitude_m,
          altitude_accuracy_m = EXCLUDED.altitude_accuracy_m,
          heading_deg = EXCLUDED.heading_deg,
          speed_mps = EXCLUDED.speed_mps,
          source = EXCLUDED.source,
          ip_address = EXCLUDED.ip_address,
          user_agent = EXCLUDED.user_agent,
          integrity_status = EXCLUDED.integrity_status,
          integrity_score = EXCLUDED.integrity_score,
          integrity_flags = EXCLUDED.integrity_flags,
          movement_speed_kmh = EXCLUDED.movement_speed_kmh,
          network_changed = EXCLUDED.network_changed,
          client_timezone = EXCLUDED.client_timezone,
          client_platform = EXCLUDED.client_platform,
          client_language = EXCLUDED.client_language,
          client_connection_type = EXCLUDED.client_connection_type,
          precision_tier = EXCLUDED.precision_tier,
          network_trust_status = EXCLUDED.network_trust_status,
          network_provider = EXCLUDED.network_provider,
          network_proxy = EXCLUDED.network_proxy,
          network_vpn = EXCLUDED.network_vpn,
          network_tor = EXCLUDED.network_tor,
          network_hosting = EXCLUDED.network_hosting,
          network_fraud_score = EXCLUDED.network_fraud_score,
          device_id = EXCLUDED.device_id,
          device_trust_status = EXCLUDED.device_trust_status,
          captured_at = EXCLUDED.captured_at,
          received_at = EXCLUDED.received_at
        WHERE
          EXCLUDED.captured_at >=
          user_current_locations.captured_at
      `,
      {
        replacements: {
          userId,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracyM: location.accuracy_m,
          altitudeM: location.altitude_m,
          altitudeAccuracyM:
            location.altitude_accuracy_m,
          headingDeg: location.heading_deg,
          speedMps: location.speed_mps,
          ipAddress,
          userAgent,
          integrityStatus: integrity.status,
          integrityScore: integrity.score,
          integrityFlags: JSON.stringify(integrity.flags),
          movementSpeedKmh: integrity.movementSpeedKmh,
          networkChanged: integrity.networkChanged,
          clientTimezone: clientSignals.timezone,
          clientPlatform: clientSignals.platform,
          clientLanguage: clientSignals.language,
          clientConnectionType: clientSignals.connectionType,
          precisionTier,
          networkTrustStatus: networkReputation.status,
          networkProvider: networkReputation.provider,
          networkProxy: Boolean(networkReputation.proxy),
          networkVpn: Boolean(networkReputation.vpn),
          networkTor: Boolean(networkReputation.tor),
          networkHosting: Boolean(networkReputation.hosting),
          networkFraudScore: networkReputation.fraudScore,
          deviceId,
          deviceTrustStatus,
          capturedAt: location.captured_at,
          receivedAt,
        },
        type: QueryTypes.INSERT,
        transaction,
      }
    );

    // Historial con control de volumen: máximo aproximadamente un punto
    // por minuto si el usuario no se mueve, o antes si cambia >= 50 m.
    const historyRows = await sequelize.query(
      `
        SELECT
          latitude,
          longitude,
          captured_at
        FROM user_location_history
        WHERE user_id = :userId
        ORDER BY captured_at DESC
        LIMIT 1
      `,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    const previousHistory = historyRows[0] || null;
    let shouldSaveHistory = !previousHistory;
    let distanceFromLastHistory = null;

    if (previousHistory) {
      const elapsedSeconds =
        (location.captured_at.getTime() -
          new Date(previousHistory.captured_at).getTime()) /
        1000;

      distanceFromLastHistory = haversineMeters(
        Number(previousHistory.latitude),
        Number(previousHistory.longitude),
        location.latitude,
        location.longitude
      );

      shouldSaveHistory =
        elapsedSeconds >= HISTORY_MIN_SECONDS ||
        distanceFromLastHistory >=
          HISTORY_MIN_DISTANCE_METERS;
    }

    if (shouldSaveHistory) {
      await sequelize.query(
        `
          INSERT INTO user_location_history (
            id,
            user_id,
            latitude,
            longitude,
            accuracy_m,
            altitude_m,
            altitude_accuracy_m,
            heading_deg,
            speed_mps,
            source,
            ip_address,
            user_agent,
            integrity_status,
            integrity_score,
            integrity_flags,
            movement_speed_kmh,
            network_changed,
            client_timezone,
            client_platform,
            client_language,
            client_connection_type,
            precision_tier,
            network_trust_status,
            network_provider,
            network_proxy,
            network_vpn,
            network_tor,
            network_hosting,
            network_fraud_score,
            device_id,
            device_trust_status,
            captured_at,
            created_at
          )
          VALUES (
            :id,
            :userId,
            :latitude,
            :longitude,
            :accuracyM,
            :altitudeM,
            :altitudeAccuracyM,
            :headingDeg,
            :speedMps,
            'browser_geolocation',
            :ipAddress,
            :userAgent,
            :integrityStatus,
            :integrityScore,
            CAST(:integrityFlags AS jsonb),
            :movementSpeedKmh,
            :networkChanged,
            :clientTimezone,
            :clientPlatform,
            :clientLanguage,
            :clientConnectionType,
            :precisionTier,
            :networkTrustStatus,
            :networkProvider,
            :networkProxy,
            :networkVpn,
            :networkTor,
            :networkHosting,
            :networkFraudScore,
            :deviceId,
            :deviceTrustStatus,
            :capturedAt,
            :createdAt
          )
        `,
        {
          replacements: {
            id: crypto.randomUUID(),
            userId,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracyM: location.accuracy_m,
            altitudeM: location.altitude_m,
            altitudeAccuracyM:
              location.altitude_accuracy_m,
            headingDeg: location.heading_deg,
            speedMps: location.speed_mps,
            ipAddress,
            userAgent,
            integrityStatus: integrity.status,
            integrityScore: integrity.score,
            integrityFlags: JSON.stringify(integrity.flags),
            movementSpeedKmh: integrity.movementSpeedKmh,
            networkChanged: integrity.networkChanged,
            clientTimezone: clientSignals.timezone,
            clientPlatform: clientSignals.platform,
            clientLanguage: clientSignals.language,
            clientConnectionType: clientSignals.connectionType,
            precisionTier,
            networkTrustStatus: networkReputation.status,
            networkProvider: networkReputation.provider,
            networkProxy: Boolean(networkReputation.proxy),
            networkVpn: Boolean(networkReputation.vpn),
            networkTor: Boolean(networkReputation.tor),
            networkHosting: Boolean(networkReputation.hosting),
            networkFraudScore: networkReputation.fraudScore,
            deviceId,
            deviceTrustStatus,
            capturedAt: location.captured_at,
            createdAt: receivedAt,
          },
          type: QueryTypes.INSERT,
          transaction,
        }
      );
    }

    await transaction.commit();

    return res.json({
      success: true,
      data: {
        user_id: userId,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy_m: location.accuracy_m,
        captured_at: location.captured_at,
        received_at: receivedAt,
        history_saved: shouldSaveHistory,
        integrity_status: integrity.status,
        integrity_score: integrity.score,
        movement_speed_kmh: integrity.movementSpeedKmh,
        network_changed: integrity.networkChanged,
        precision_tier: precisionTier,
        precise_for_critical_actions: precisionTier === 'precise',
        network_trust_status: networkReputation.status,
        network_provider: networkReputation.provider,
        device_trust_status: deviceTrustStatus,
        distance_from_last_history_m:
          distanceFromLastHistory === null
            ? null
            : Math.round(distanceFromLastHistory * 10) / 10,
      },
      message: 'Ubicación actualizada',
    });
  } catch (error) {
    await transaction.rollback();

    if (isMissingTableError(error)) {
      return res.status(503).json({
        success: false,
        code: 'LOCATION_TABLES_NOT_INSTALLED',
        message:
          'Las tablas de ubicación todavía no están instaladas. Ejecuta backend/sql/20260821-user-location.sql',
      });
    }

    console.error('Error actualizando ubicación:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al actualizar la ubicación',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : undefined,
    });
  }
};

// ============================================================
// UBICACIÓN ACTUAL DE UN USUARIO - SOLO ADMIN
// ============================================================
const getUserCurrentLocation = async (req, res) => {
  try {
    const admin = await ensureAdmin(req, res);

    if (!admin) {
      return;
    }

    const { id: userId } = req.params;

    const targetUser = await Usuario.findByPk(userId, {
      attributes: [
        'id',
        'nombre1',
        'nombre2',
        'apellidos',
        'usuario',
        'rol',
        'role_id',
        'activo',
      ],
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    let rows;

    try {
      rows = await sequelize.query(
        `
          SELECT
            user_id,
            latitude,
            longitude,
            accuracy_m,
            altitude_m,
            altitude_accuracy_m,
            heading_deg,
            speed_mps,
            source,
            integrity_status,
            integrity_score,
            integrity_flags,
            movement_speed_kmh,
            network_changed,
            captured_at,
            received_at
          FROM user_current_locations
          WHERE user_id = :userId
          LIMIT 1
        `,
        {
          replacements: { userId },
          type: QueryTypes.SELECT,
        }
      );
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(503).json({
          success: false,
          code: 'LOCATION_TABLES_NOT_INSTALLED',
          message:
            'Las tablas de ubicación todavía no están instaladas. Ejecuta backend/sql/20260821-user-location.sql',
        });
      }

      throw error;
    }

    const current = rows[0] || null;

    if (!current) {
      return res.json({
        success: true,
        data: null,
        message:
          'El usuario todavía no ha compartido una ubicación válida',
      });
    }

    const ageSeconds = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(current.received_at).getTime()) /
          1000
      )
    );

    return res.json({
      success: true,
      data: {
        ...current,
        latitude: Number(current.latitude),
        longitude: Number(current.longitude),
        accuracy_m: Number(current.accuracy_m),
        altitude_m:
          current.altitude_m === null
            ? null
            : Number(current.altitude_m),
        altitude_accuracy_m:
          current.altitude_accuracy_m === null
            ? null
            : Number(current.altitude_accuracy_m),
        heading_deg:
          current.heading_deg === null
            ? null
            : Number(current.heading_deg),
        speed_mps:
          current.speed_mps === null
            ? null
            : Number(current.speed_mps),
        integrity_score: Number(current.integrity_score || 0),
        movement_speed_kmh:
          current.movement_speed_kmh === null
            ? null
            : Number(current.movement_speed_kmh),
        age_seconds: ageSeconds,
        is_stale: ageSeconds > CURRENT_STALE_SECONDS,
        stale_after_seconds: CURRENT_STALE_SECONDS,
      },
    });
  } catch (error) {
    console.error('Error obteniendo ubicación actual:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener la ubicación actual',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : undefined,
    });
  }
};

// ============================================================
// HISTORIAL DE UBICACIÓN - SOLO ADMIN
// ============================================================
const getUserLocationHistory = async (req, res) => {
  try {
    const admin = await ensureAdmin(req, res);

    if (!admin) {
      return;
    }

    const { id: userId } = req.params;
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 250)
      : 50;

    const targetUser = await Usuario.findByPk(userId, {
      attributes: ['id'],
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    let rows;

    try {
      rows = await sequelize.query(
        `
          SELECT
            id,
            user_id,
            latitude,
            longitude,
            accuracy_m,
            altitude_m,
            heading_deg,
            speed_mps,
            source,
            integrity_status,
            integrity_score,
            integrity_flags,
            movement_speed_kmh,
            network_changed,
            captured_at,
            created_at
          FROM user_location_history
          WHERE user_id = :userId
          ORDER BY captured_at DESC
          LIMIT :limit
        `,
        {
          replacements: {
            userId,
            limit,
          },
          type: QueryTypes.SELECT,
        }
      );
    } catch (error) {
      if (isMissingTableError(error)) {
        return res.status(503).json({
          success: false,
          code: 'LOCATION_TABLES_NOT_INSTALLED',
          message:
            'Las tablas de ubicación todavía no están instaladas. Ejecuta backend/sql/20260821-user-location.sql',
        });
      }

      throw error;
    }

    return res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        accuracy_m: Number(row.accuracy_m),
        altitude_m:
          row.altitude_m === null
            ? null
            : Number(row.altitude_m),
        heading_deg:
          row.heading_deg === null
            ? null
            : Number(row.heading_deg),
        speed_mps:
          row.speed_mps === null
            ? null
            : Number(row.speed_mps),
        integrity_score: Number(row.integrity_score || 0),
        movement_speed_kmh:
          row.movement_speed_kmh === null
            ? null
            : Number(row.movement_speed_kmh),
      })),
      total_returned: rows.length,
    });
  } catch (error) {
    console.error('Error obteniendo historial de ubicación:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener el historial de ubicación',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : undefined,
    });
  }
};

module.exports = {
  updateOwnLocation,
  getUserCurrentLocation,
  getUserLocationHistory,
};
