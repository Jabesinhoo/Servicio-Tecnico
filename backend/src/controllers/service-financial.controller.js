'use strict';

const {
  randomUUID,
} = require('crypto');

const pool =
  require('../db/pool');

const BILLING_MODES =
  new Set([
    'unclassified',
    'prepaid',
    'postpaid',
  ]);

const CLEARANCE_STATUSES =
  new Set([
    'pending',
    'cleared',
    'blocked',
    'not_required',
  ]);

const VERIFICATION_SOURCES =
  new Set([
    'intake',
    'manual',
    'worldoffice_mirror',
    'other',
  ]);

const VERIFICATION_KINDS =
  new Set([
    'payment_confirmed',
    'credit_authorized',
    'balance_zero',
    'manual_review',
    'not_required',
    'blocked',
  ]);

function role(req) {
  return req.user?.role?.name ||
    req.user?.rol ||
    null;
}

function isAdmin(req) {
  return role(req) ===
    'admin';
}

function isTechnician(req) {
  return role(req) ===
    'tecnico';
}

function clean(
  value,
  max = 5000
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const text =
    String(value).trim();

  return text
    ? text.slice(
        0,
        max
      )
    : null;
}

function nullableAmount(
  value
) {
  if (
    value === '' ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    const error =
      new Error(
        'El valor financiero debe ser un número mayor o igual a cero.'
      );

    error.code =
      'INVALID_AMOUNT';

    throw error;
  }

  return number;
}

async function rollback(
  client
) {
  try {
    await client.query(
      'ROLLBACK'
    );
  } catch (_) {}
}

async function getOrder(
  client,
  orderId,
  lock = false
) {
  const result =
    await client.query(
      `
        SELECT
          so.id,
          so.codigo_os,
          so.estado::text AS estado,
          so.tecnico_id,
          so.client_id,
          so.origen_id AS intake_reference,

          CASE
            WHEN c.tipo_persona =
              'juridica'
            THEN c.razon_social
            ELSE CONCAT_WS(
              ' ',
              c.primer_nombre,
              c.primer_apellido
            )
          END AS client_name,

          c.documento AS client_document,
          c.telefono AS client_phone,
          c.email AS client_email,
          c.codigo_worldoffice AS client_worldoffice_code

        FROM service_orders so

        LEFT JOIN clients c
          ON c.id =
            so.client_id

        WHERE so.id = $1

        ${
          lock
            ? 'FOR UPDATE OF so'
            : ''
        }
      `,
      [
        orderId,
      ]
    );

  return result.rows[0] ||
    null;
}

async function canRead(
  client,
  req,
  order
) {
  if (isAdmin(req)) {
    return true;
  }

  if (
    !isTechnician(req)
  ) {
    return false;
  }

  if (
    order.tecnico_id ===
    req.user.id
  ) {
    return true;
  }

  const result =
    await client.query(
      `
        SELECT 1
        FROM
          service_order_team_members
        WHERE
          service_order_id =
            $1
          AND
          technician_id =
            $2
          AND
          member_status <>
            'removed'
        LIMIT 1
      `,
      [
        order.id,
        req.user.id,
      ]
    );

  return Boolean(
    result.rows[0]
  );
}

async function getControl(
  client,
  orderId,
  lock = false
) {
  const result =
    await client.query(
      `
        SELECT *
        FROM
          service_order_financial_controls
        WHERE
          service_order_id =
            $1
        ${
          lock
            ? 'FOR UPDATE'
            : ''
        }
      `,
      [
        orderId,
      ]
    );

  return result.rows[0] ||
    null;
}

async function getVerifications(
  client,
  orderId
) {
  const result =
    await client.query(
      `
        SELECT
          v.*,
          CONCAT_WS(
            ' ',
            u.nombre1,
            u.nombre2,
            u.apellidos
          ) AS verified_by_name,
          u.usuario AS verified_by_username
        FROM
          service_order_financial_verifications v
        LEFT JOIN usuarios u
          ON
            u.id =
              v.verified_by
        WHERE
          v.service_order_id =
            $1
        ORDER BY
          v.verified_at DESC,
          v.created_at DESC
      `,
      [
        orderId,
      ]
    );

  return result.rows;
}

async function getIntake(
  client,
  orderId
) {
  const result =
    await client.query(
      `
        SELECT
          id,
          billing_mode,
          invoice_reference,
          payment_status,
          payment_method,
          payment_reference,
          payment_verified_by,
          payment_verified_at,
          postpaid_reason,
          base_value,
          service_order_id
        FROM
          service_order_intakes
        WHERE
          service_order_id =
            $1
        LIMIT 1
      `,
      [
        orderId,
      ]
    );

  return result.rows[0] ||
    null;
}

async function ensureControl(
  client,
  order
) {
  const existing =
    await getControl(
      client,
      order.id
    );

  if (existing) {
    return existing;
  }

  const intake =
    await getIntake(
      client,
      order.id
    );

  const billingMode =
    BILLING_MODES.has(
      intake?.billing_mode
    )
      ? intake.billing_mode
      : 'unclassified';

  let status =
    'pending';

  if (
    billingMode ===
      'prepaid' &&
    intake?.payment_status ===
      'verified'
  ) {
    status =
      'cleared';
  } else if (
    intake?.payment_status ===
    'not_required'
  ) {
    status =
      'not_required';
  }

  const result =
    await client.query(
      `
        INSERT INTO
          service_order_financial_controls (
            service_order_id,
            intake_id,
            billing_mode,
            verification_required,
            clearance_status,
            invoice_reference,
            payment_reference,
            expected_amount,
            last_verified_at,
            last_verified_by,
            note,
            created_at,
            updated_at
          )
        VALUES (
          $1,$2,$3,TRUE,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()
        )
        ON CONFLICT (
          service_order_id
        )
        DO UPDATE SET
          updated_at =
            service_order_financial_controls.updated_at
        RETURNING *
      `,
      [
        order.id,
        intake?.id ||
          null,
        billingMode,
        status,
        intake?.invoice_reference ||
          null,
        intake?.payment_reference ||
          null,
        intake?.base_value ??
          null,
        intake?.payment_verified_at ||
          null,
        intake?.payment_verified_by ||
          null,
        intake
          ? 'Control financiero inicializado desde la solicitud de servicio.'
          : 'Orden histórica sin intake: requiere revisión financiera.',
      ]
    );

  return result.rows[0];
}

async function addEvent(
  client,
  {
    orderId,
    eventType,
    actorUserId,
    metadata = {},
  }
) {
  await client.query(
    `
      INSERT INTO
        service_order_financial_events (
          id,
          service_order_id,
          event_type,
          actor_user_id,
          metadata,
          created_at
        )
      VALUES (
        $1,$2,$3,$4,$5::jsonb,NOW()
      )
    `,
    [
      randomUUID(),
      orderId,
      eventType,
      actorUserId ||
        null,
      JSON.stringify(
        metadata || {}
      ),
    ]
  );
}

exports.getFinancialOverview =
  async (req, res) => {
    try {
      if (
        !isAdmin(req) &&
        !isTechnician(req)
      ) {
        return res
          .status(403)
          .json({
            success: false,
            message:
              'No autorizado',
          });
      }

      const result =
        await pool.query(
          `
            SELECT
              fc.service_order_id,
              fc.billing_mode,
              fc.verification_required,
              fc.clearance_status,
              fc.invoice_reference,
              fc.last_verified_at
            FROM
              service_order_financial_controls fc
            JOIN service_orders so
              ON
                so.id =
                  fc.service_order_id
            WHERE
              (
                $1::uuid IS NULL
                OR
                so.tecnico_id =
                  $1
                OR EXISTS (
                  SELECT 1
                  FROM
                    service_order_team_members tm
                  WHERE
                    tm.service_order_id =
                      so.id
                    AND
                    tm.technician_id =
                      $1
                    AND
                    tm.member_status <>
                      'removed'
                )
              )
          `,
          [
            isTechnician(req)
              ? req.user.id
              : null,
          ]
        );

      return res.json({
        success: true,
        data:
          result.rows,
      });
    } catch (error) {
      console.error(
        'V17 financial overview:',
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al cargar resumen financiero',
        });
    }
  };

exports.getFinancialControl =
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const order =
        await getOrder(
          client,
          req.params.id
        );

      if (!order) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              'Orden no encontrada',
          });
      }

      if (
        !(await canRead(
          client,
          req,
          order
        ))
      ) {
        return res
          .status(403)
          .json({
            success: false,
            message:
              'No autorizado para consultar el control financiero',
          });
      }

      const control =
        await ensureControl(
          client,
          order
        );

      const [
        verifications,
        intake,
        deliveryResult,
      ] = await Promise.all([
        getVerifications(
          client,
          order.id
        ),

        getIntake(
          client,
          order.id
        ),

        client.query(
          `
            SELECT
              status,
              financial_clearance,
              financial_note,
              delivered_at
            FROM
              service_order_deliveries
            WHERE
              service_order_id =
                $1
            LIMIT 1
          `,
          [
            order.id,
          ]
        ),
      ]);

      return res.json({
        success: true,
        data: {
          order,
          control,
          verifications,
          intake,
          delivery:
            deliveryResult.rows[0] ||
            null,
          ready_for_delivery:
            control.verification_required ===
              false ||
            [
              'cleared',
              'not_required',
            ].includes(
              control.clearance_status
            ),
        },
      });
    } catch (error) {
      console.error(
        'V17 get financial control:',
        error
      );

      if (
        error?.code ===
        '42P01'
      ) {
        return res
          .status(409)
          .json({
            success: false,
            code:
              'V17_TABLES_NOT_INSTALLED',
            message:
              'Faltan las tablas V17 de control financiero.',
          });
      }

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al cargar control financiero',
        });
    } finally {
      client.release();
    }
  };

exports.updateFinancialControl =
  async (req, res) => {
    if (!isAdmin(req)) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            'Solo administración puede configurar el control financiero',
        });
    }

    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      const order =
        await getOrder(
          client,
          req.params.id,
          true
        );

      if (!order) {
        await rollback(
          client
        );

        return res
          .status(404)
          .json({
            success: false,
            message:
              'Orden no encontrada',
          });
      }

      await ensureControl(
        client,
        order
      );

      const current =
        await getControl(
          client,
          order.id,
          true
        );

      const billingMode =
        clean(
          req.body
            ?.billing_mode,
          20
        ) ||
        current.billing_mode;

      if (
        !BILLING_MODES.has(
          billingMode
        )
      ) {
        await rollback(
          client
        );

        return res
          .status(400)
          .json({
            success: false,
            message:
              'Modalidad financiera no válida',
          });
      }

      const expectedAmount =
        req.body
          ?.expected_amount ===
        undefined
          ? current.expected_amount
          : nullableAmount(
              req.body
                ?.expected_amount
            );

      const verificationRequired =
        req.body
          ?.verification_required ===
        undefined
          ? current.verification_required
          : Boolean(
              req.body
                ?.verification_required
            );

      const nextInvoiceReference =
        clean(
          req.body
            ?.invoice_reference,
          180
        ) ??
        current.invoice_reference;

      const nextPaymentReference =
        clean(
          req.body
            ?.payment_reference,
          220
        ) ??
        current.payment_reference;

      const nextExternalSystem =
        clean(
          req.body
            ?.external_system,
          40
        ) ??
        current.external_system;

      const nextExternalClientId =
        clean(
          req.body
            ?.external_client_id,
          120
        ) ??
        current.external_client_id;

      const nextExternalInvoiceId =
        clean(
          req.body
            ?.external_invoice_id,
          180
        ) ??
        current.external_invoice_id;

      let status =
        current.clearance_status;

      if (
        !verificationRequired
      ) {
        status =
          'not_required';
      } else if (
        status ===
        'not_required' ||
        billingMode !==
          current.billing_mode ||
        nextInvoiceReference !==
          current.invoice_reference ||
        nextExternalInvoiceId !==
          current.external_invoice_id
      ) {
        status =
          'pending';
      }

      const result =
        await client.query(
          `
            UPDATE
              service_order_financial_controls
            SET
              billing_mode =
                $1,
              verification_required =
                $2,
              clearance_status =
                $3,
              invoice_reference =
                $4,
              payment_reference =
                $5,
              external_system =
                $6,
              external_client_id =
                $7,
              external_invoice_id =
                $8,
              expected_amount =
                $9,
              note =
                $10,
              updated_at =
                NOW()
            WHERE
              service_order_id =
                $11
            RETURNING *
          `,
          [
            billingMode,
            verificationRequired,
            status,
            nextInvoiceReference,
            nextPaymentReference,
            nextExternalSystem,
            nextExternalClientId,
            nextExternalInvoiceId,
            expectedAmount,
            clean(
              req.body?.note,
              5000
            ) ??
              current.note,
            order.id,
          ]
        );

      await addEvent(
        client,
        {
          orderId:
            order.id,
          eventType:
            'financial_control_updated',
          actorUserId:
            req.user.id,
          metadata: {
            billing_mode:
              billingMode,
            verification_required:
              verificationRequired,
            invoice_reference:
              result.rows[0]
                .invoice_reference,
            external_system:
              result.rows[0]
                .external_system,
          },
        }
      );

      await client.query(
        'COMMIT'
      );

      return res.json({
        success: true,
        message:
          'Control financiero actualizado',
        data:
          result.rows[0],
      });
    } catch (error) {
      await rollback(
        client
      );

      console.error(
        'V17 update financial control:',
        error
      );

      if (
        error?.code ===
        'INVALID_AMOUNT'
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              error.message,
          });
      }

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al actualizar control financiero',
        });
    } finally {
      client.release();
    }
  };

exports.addFinancialVerification =
  async (req, res) => {
    if (!isAdmin(req)) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            'Solo administración puede registrar verificaciones financieras',
        });
    }

    const source =
      clean(
        req.body
          ?.verification_source,
        40
      ) ||
      'manual';

    const kind =
      clean(
        req.body
          ?.verification_kind,
        40
      );

    let resultStatus =
      clean(
        req.body
          ?.result_status,
        20
      );

    if (
      !VERIFICATION_SOURCES.has(
        source
      )
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            'Fuente de verificación no válida',
        });
    }

    if (
      !VERIFICATION_KINDS.has(
        kind
      )
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            'Tipo de verificación no válido',
        });
    }

    if (
      kind ===
      'not_required'
    ) {
      resultStatus =
        'not_required';
    }

    if (
      kind ===
      'blocked'
    ) {
      resultStatus =
        'blocked';
    }

    if (
      !CLEARANCE_STATUSES.has(
        resultStatus
      )
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            'Resultado financiero no válido',
        });
    }

    const evidenceNote =
      clean(
        req.body
          ?.evidence_note,
        6000
      );

    const invoiceReference =
      clean(
        req.body
          ?.invoice_reference,
        180
      );

    const paymentReference =
      clean(
        req.body
          ?.payment_reference,
        220
      );

    const externalReference =
      clean(
        req.body
          ?.external_reference,
        220
      );

    let balanceAmount;
    let paidAmount;

    try {
      balanceAmount =
        nullableAmount(
          req.body
            ?.balance_amount
        );

      paidAmount =
        nullableAmount(
          req.body
            ?.paid_amount
        );
    } catch (error) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            error.message,
        });
    }

    if (
      kind ===
        'balance_zero' &&
      balanceAmount !==
        null &&
      balanceAmount !== 0
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            'Una verificación "saldo cero" debe registrar saldo 0.',
        });
    }

    if (
      kind ===
        'payment_confirmed' &&
      !paymentReference &&
      !externalReference &&
      !evidenceNote
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            'Registra una referencia o nota que sustente el pago.',
        });
    }

    if (
      [
        'credit_authorized',
        'manual_review',
        'blocked',
      ].includes(
        kind
      ) &&
      !evidenceNote
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            'Registra la observación o evidencia de la decisión financiera.',
        });
    }

    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      const order =
        await getOrder(
          client,
          req.params.id,
          true
        );

      if (!order) {
        await rollback(
          client
        );

        return res
          .status(404)
          .json({
            success: false,
            message:
              'Orden no encontrada',
          });
      }

      await ensureControl(
        client,
        order
      );

      const control =
        await getControl(
          client,
          order.id,
          true
        );

      const verificationId =
        randomUUID();

      const verification =
        await client.query(
          `
            INSERT INTO
              service_order_financial_verifications (
                id,
                service_order_id,
                verification_source,
                verification_kind,
                result_status,
                invoice_reference,
                payment_reference,
                external_reference,
                balance_amount,
                paid_amount,
                evidence_note,
                source_snapshot,
                verified_by,
                verified_at,
                created_at
              )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,NOW(),NOW()
            )
            RETURNING *
          `,
          [
            verificationId,
            order.id,
            source,
            kind,
            resultStatus,
            invoiceReference ||
              control.invoice_reference,
            paymentReference ||
              control.payment_reference,
            externalReference,
            balanceAmount,
            paidAmount,
            evidenceNote,
            JSON.stringify(
              req.body
                ?.source_snapshot ||
                {}
            ),
            req.user.id,
          ]
        );

      const updated =
        await client.query(
          `
            UPDATE
              service_order_financial_controls
            SET
              clearance_status =
                $1,
              invoice_reference =
                COALESCE(
                  $2,
                  invoice_reference
                ),
              payment_reference =
                COALESCE(
                  $3,
                  payment_reference
                ),
              last_verified_at =
                NOW(),
              last_verified_by =
                $4,
              updated_at =
                NOW()
            WHERE
              service_order_id =
                $5
            RETURNING *
          `,
          [
            resultStatus,
            invoiceReference,
            paymentReference,
            req.user.id,
            order.id,
          ]
        );

      await addEvent(
        client,
        {
          orderId:
            order.id,
          eventType:
            'financial_verification_recorded',
          actorUserId:
            req.user.id,
          metadata: {
            verification_id:
              verificationId,
            verification_source:
              source,
            verification_kind:
              kind,
            result_status:
              resultStatus,
            balance_amount:
              balanceAmount,
            paid_amount:
              paidAmount,
            invoice_reference:
              invoiceReference ||
              control.invoice_reference,
          },
        }
      );

      await client.query(
        'COMMIT'
      );

      return res
        .status(201)
        .json({
          success: true,
          message:
            resultStatus ===
              'cleared'
              ? 'Liberación financiera registrada.'
              : resultStatus ===
                  'not_required'
                ? 'Control financiero marcado como no requerido.'
                : resultStatus ===
                    'blocked'
                  ? 'Entrega bloqueada por control financiero.'
                  : 'Verificación financiera registrada.',
          data: {
            control:
              updated.rows[0],
            verification:
              verification.rows[0],
          },
        });
    } catch (error) {
      await rollback(
        client
      );

      console.error(
        'V17 add financial verification:',
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al registrar verificación financiera',
        });
    } finally {
      client.release();
    }
  };

exports.getWorldOfficeCorrelation =
  async (req, res) => {
    if (!isAdmin(req)) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            'Solo administración puede consultar la correlación WorldOffice',
        });
    }

    const client =
      await pool.connect();

    try {
      const order =
        await getOrder(
          client,
          req.params.id
        );

      if (!order) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              'Orden no encontrada',
          });
      }

      const tableResult =
        await client.query(
          `
            SELECT
              to_regclass(
                'public.sync_clientes'
              ) AS table_name
          `
        );

      if (
        !tableResult.rows[0]
          ?.table_name
      ) {
        return res.json({
          success: true,
          data: {
            mirror_available:
              false,
            correlated:
              false,
            message:
              'El espejo sync_clientes no está disponible.',
            payment_verified:
              false,
            scope:
              'correlation_only',
          },
        });
      }

      const externalCode =
        clean(
          order.client_worldoffice_code,
          120
        );

      const document =
        clean(
          order.client_document,
          120
        );

      const result =
        await client.query(
          `
            SELECT
              id_externo,
              documento,
              razon_social,
              primer_nombre,
              segundo_nombre,
              primer_apellido,
              segundo_apellido,
              activo
            FROM
              sync_clientes
            WHERE
              (
                $1::text IS NOT NULL
                AND
                id_externo::text =
                  $1
              )
              OR
              (
                $2::text IS NOT NULL
                AND
                documento =
                  $2
              )
            ORDER BY
              CASE
                WHEN
                  $1::text IS NOT NULL
                  AND
                  id_externo::text =
                    $1
                THEN 0
                ELSE 1
              END
            LIMIT 5
          `,
          [
            externalCode,
            document,
          ]
        );

      return res.json({
        success: true,
        data: {
          mirror_available:
            true,
          correlated:
            result.rows.length >
            0,
          client: {
            local_client_id:
              order.client_id,
            local_document:
              order.client_document,
            local_name:
              order.client_name,
            configured_worldoffice_code:
              order.client_worldoffice_code,
          },
          matches:
            result.rows,
          payment_verified:
            false,
          balance_verified:
            false,
          scope:
            'correlation_only',
          message:
            result.rows.length >
            0
              ? 'Cliente correlacionado con el espejo de WorldOffice. V17 no interpreta esto como pago ni saldo verificado.'
              : 'No se encontró correlación en el espejo de WorldOffice.',
        },
      });
    } catch (error) {
      console.error(
        'V17 WorldOffice correlation:',
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al consultar correlación WorldOffice',
        });
    } finally {
      client.release();
    }
  };
