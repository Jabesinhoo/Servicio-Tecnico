'use strict';

const pool = require('../db/pool');

async function latestAuthorization(client, orderId) {
  const result = await client.query(
    `
      SELECT id, status, request_type, created_at
      FROM service_order_authorizations
      WHERE service_order_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [orderId]
  );

  return result.rows[0] || null;
}

async function orderIdFromMaterialRequest(client, req) {
  if (req.params?.service_order_id) {
    return req.params.service_order_id;
  }

  if (!req.params?.id) {
    return null;
  }

  const result = await client.query(
    `
      SELECT service_order_id
      FROM servicio_materiales
      WHERE id = $1
      LIMIT 1
    `,
    [req.params.id]
  );

  return result.rows[0]?.service_order_id || null;
}

exports.blockResumeWhileClientAuthorization = async (
  req,
  res,
  next
) => {
  const target = req.body?.estado;

  if (target !== 'en_ejecucion') {
    return next();
  }

  const client = await pool.connect();

  try {
    const currentResult = await client.query(
      `
        SELECT estado
        FROM service_orders
        WHERE id = $1
        LIMIT 1
      `,
      [req.params.id]
    );

    if (currentResult.rows[0]?.estado !== 'en_espera') {
      return next();
    }

    const authorization = await latestAuthorization(
      client,
      req.params.id
    );

    if (!authorization) {
      return next();
    }

    if (authorization.status === 'pending') {
      return res.status(409).json({
        success: false,
        code: 'CLIENT_AUTHORIZATION_PENDING',
        message:
          'El servicio tiene una autorización del cliente pendiente. No puede reanudarse todavía.',
      });
    }

    if (authorization.status === 'rejected') {
      return res.status(409).json({
        success: false,
        code: 'CLIENT_AUTHORIZATION_REJECTED',
        message:
          'El cliente rechazó el trabajo adicional. No puede reanudarse bajo esta solicitud.',
      });
    }

    return next();
  } catch (error) {
    console.error(
      'Error validating authorization before resume:',
      error
    );

    if (error?.code === '42P01') {
      return res.status(409).json({
        success: false,
        code: 'V8_TABLES_NOT_INSTALLED',
        message: 'Faltan las tablas V8 de autorizaciones',
      });
    }

    return res.status(500).json({
      success: false,
      message:
        'No fue posible validar la autorización antes de reanudar',
    });
  } finally {
    client.release();
  }
};

exports.requireApprovedClientAuthorizationForMaterials =
  async (req, res, next) => {
    const client = await pool.connect();

    try {
      const orderId = await orderIdFromMaterialRequest(
        client,
        req
      );

      if (!orderId) {
        return next();
      }

      const diagnosisResult = await client.query(
        `
          SELECT
            status,
            work_type,
            solution_available,
            approximate_cost,
            required_components
          FROM service_order_diagnostics
          WHERE service_order_id = $1
          LIMIT 1
        `,
        [orderId]
      );

      const diagnosis = diagnosisResult.rows[0];
      const authorization = await latestAuthorization(
        client,
        orderId
      );

      const hasExplicitAuthorizationFlow =
        Boolean(authorization);

      const diagnosisRequiresApproval =
        diagnosis?.status === 'confirmed' &&
        diagnosis?.work_type === 'diagnostico' &&
        diagnosis?.solution_available === true &&
        (
          Number(diagnosis?.approximate_cost || 0) > 0 ||
          Boolean(
            String(
              diagnosis?.required_components || ''
            ).trim()
          )
        );

      if (
        !hasExplicitAuthorizationFlow &&
        !diagnosisRequiresApproval
      ) {
        return next();
      }

      if (authorization?.status === 'approved') {
        req.clientAuthorization = authorization;
        return next();
      }

      const code =
        authorization?.status === 'pending'
          ? 'CLIENT_AUTHORIZATION_PENDING'
          : authorization?.status === 'rejected'
            ? 'CLIENT_AUTHORIZATION_REJECTED'
            : 'CLIENT_AUTHORIZATION_REQUIRED';

      const message =
        authorization?.status === 'pending'
          ? 'Los materiales de este trabajo adicional están pendientes de autorización del cliente.'
          : authorization?.status === 'rejected'
            ? 'El cliente rechazó el trabajo adicional. Los materiales asociados están bloqueados.'
            : 'Este diagnóstico requiere autorización del cliente antes de solicitar, entregar o consumir materiales adicionales.';

      return res.status(409).json({
        success: false,
        code,
        message,
      });
    } catch (error) {
      console.error(
        'Error validating authorization for materials:',
        error
      );

      if (error?.code === '42P01') {
        return res.status(409).json({
          success: false,
          code: 'V8_TABLES_NOT_INSTALLED',
          message:
            'Faltan las tablas V8 requeridas para validar materiales',
        });
      }

      return res.status(500).json({
        success: false,
        message:
          'No fue posible validar la autorización de materiales',
      });
    } finally {
      client.release();
    }
  };
