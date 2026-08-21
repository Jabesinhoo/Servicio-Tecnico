// backend/src/controllers/user-location.controller.js
'use strict';

const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const db = require('../models');

const { Usuario, sequelize } = db;
const Role = sequelize.models.Role || db.Role;

const readPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : fallback;
};

const MAX_ACCURACY_METERS = readPositiveNumber(
  process.env.LOCATION_MAX_ACCURACY_M,
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

  const transaction = await sequelize.transaction();

  try {
    // Rechazamos silenciosamente una posición más antigua que la actual.
    const currentRows = await sequelize.query(
      `
        SELECT
          user_id,
          latitude,
          longitude,
          accuracy_m,
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
