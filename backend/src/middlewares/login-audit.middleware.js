// backend/src/middlewares/login-audit.middleware.js
'use strict';

const crypto = require('crypto');
const { Op, QueryTypes } = require('sequelize');
const db = require('../models');

const { Usuario, sequelize } = db;

const normalizeIdentifier = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 255);

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];

  if (forwarded) {
    return String(forwarded)
      .split(',')[0]
      .trim()
      .slice(0, 64);
  }

  return String(
    req.ip ||
      req.socket?.remoteAddress ||
      ''
  ).slice(0, 64) || null;
};

const getFailureReason = (statusCode, responseBody) => {
  const explicitMessage = String(
    responseBody?.message ||
      responseBody?.error ||
      ''
  )
    .trim()
    .slice(0, 120);

  if (explicitMessage) {
    return explicitMessage;
  }

  if (statusCode === 400) return 'Solicitud de login inválida';
  if (statusCode === 401) return 'Credenciales inválidas';
  if (statusCode === 403) return 'Cuenta sin acceso';

  return `Login rechazado (${statusCode})`;
};

const findUserByIdentifier = async (identifier) => {
  if (!identifier) {
    return null;
  }

  return Usuario.findOne({
    where: {
      [Op.or]: [
        { usuario: identifier },
        { email: identifier },
      ],
    },
    attributes: [
      'id',
      'usuario',
      'email',
    ],
  });
};

const insertLoginEvent = async ({
  userId,
  identifier,
  success,
  ipAddress,
  userAgent,
  failureReason,
  createdAt,
}) => {
  try {
    await sequelize.query(
      `
        INSERT INTO user_login_events (
          id,
          user_id,
          identifier,
          success,
          ip_address,
          user_agent,
          failure_reason,
          created_at
        )
        VALUES (
          :id,
          :userId,
          :identifier,
          :success,
          :ipAddress,
          :userAgent,
          :failureReason,
          :createdAt
        )
      `,
      {
        replacements: {
          id: crypto.randomUUID(),
          userId: userId || null,
          identifier: identifier || null,
          success: Boolean(success),
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          failureReason: failureReason || null,
          createdAt,
        },
        type: QueryTypes.INSERT,
      }
    );
  } catch (error) {
    // No se permite que un fallo del sistema de auditoría rompa el login.
    if (
      error?.original?.code === '42P01' ||
      error?.parent?.code === '42P01'
    ) {
      console.warn(
        'Auditoría de login omitida: user_login_events aún no existe.'
      );
      return;
    }

    console.error(
      'Error registrando evento de login:',
      error
    );
  }
};

const loginAudit = (req, res, next) => {
  const identifier = normalizeIdentifier(
    req.body?.identifier
  );

  const ipAddress = getClientIp(req);
  const userAgent = String(
    req.headers['user-agent'] || ''
  ).slice(0, 1000) || null;

  const originalJson = res.json.bind(res);
  let auditExecuted = false;

  res.json = async (body) => {
    if (auditExecuted) {
      return originalJson(body);
    }

    auditExecuted = true;

    const statusCode = res.statusCode || 200;
    const successfulLogin =
      statusCode >= 200 &&
      statusCode < 300 &&
      Boolean(body?.token) &&
      Boolean(body?.user);

    const now = new Date();

    try {
      let targetUserId =
        body?.user?.id || null;

      if (!targetUserId && identifier) {
        const matchedUser =
          await findUserByIdentifier(
            identifier
          );

        targetUserId =
          matchedUser?.id || null;
      }

      if (successfulLogin && targetUserId) {
        await Usuario.update(
          {
            last_login: now,
            failed_attempts: 0,
            locked_until: null,
          },
          {
            where: {
              id: targetUserId,
            },
          }
        );
      }

      await insertLoginEvent({
        userId: targetUserId,
        identifier,
        success: successfulLogin,
        ipAddress,
        userAgent,
        failureReason: successfulLogin
          ? null
          : getFailureReason(
              statusCode,
              body
            ),
        createdAt: now,
      });
    } catch (error) {
      console.error(
        'Error en middleware de auditoría de login:',
        error
      );
    }

    return originalJson(body);
  };

  next();
};

module.exports = loginAudit;
