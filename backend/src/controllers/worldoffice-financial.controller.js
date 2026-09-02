'use strict';

const {
  randomUUID,
} = require('crypto');

const pool =
  require('../db/pool');

const worldOffice =
  require('../services/worldoffice-financial-readonly.service');

const {
  enqueueNotification,
} = require('../services/service-notification-outbox.service');

function role(req) {
  return req.user?.role?.name ||
    req.user?.rol ||
    null;
}

function isAdmin(req) {
  return role(req) ===
    'admin';
}

function clean(
  value,
  max = 5000
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    String(value).trim();

  return text
    ? text.slice(0, max)
    : null;
}

function numeric(
  value,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
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

async function getOrderContext(
  client,
  orderId
) {
  const result =
    await client.query(
      `
        SELECT
          so.id,
          so.codigo_os,
          so.estado::text AS estado,
          so.client_id,

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
          c.codigo_worldoffice AS client_worldoffice_code,

          fc.billing_mode,
          fc.clearance_status,
          fc.invoice_reference,
          fc.payment_reference,
          fc.expected_amount

        FROM service_orders so

        LEFT JOIN clients c
          ON
            c.id =
              so.client_id

        LEFT JOIN service_order_financial_controls fc
          ON
            fc.service_order_id =
              so.id

        WHERE
          so.id = $1

        LIMIT 1
      `,
      [
        orderId,
      ]
    );

  return result.rows[0] ||
    null;
}

async function getActiveMapping(
  client
) {
  const result =
    await client.query(
      `
        SELECT *
        FROM
          worldoffice_financial_mappings
        WHERE
          active = TRUE
        ORDER BY
          updated_at DESC
        LIMIT 1
      `
    );

  return result.rows[0] ||
    null;
}

async function getLatestDiscovery(
  client
) {
  const result =
    await client.query(
      `
        SELECT *
        FROM
          worldoffice_financial_discovery_runs
        ORDER BY
          completed_at DESC
        LIMIT 1
      `
    );

  return result.rows[0] ||
    null;
}

async function logReadEvent(
  client,
  {
    serviceOrderId = null,
    mappingId = null,
    eventType,
    invoiceReference = null,
    matchedRows = 0,
    resultStatus = 'unknown',
    normalizedResult = null,
    userId,
  }
) {
  await client.query(
    `
      INSERT INTO
        worldoffice_financial_read_events (
          id,
          service_order_id,
          mapping_id,
          event_type,
          invoice_reference,
          matched_rows,
          result_status,
          normalized_result,
          performed_by,
          created_at
        )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,NOW()
      )
    `,
    [
      randomUUID(),
      serviceOrderId,
      mappingId,
      eventType,
      invoiceReference,
      Math.max(
        0,
        Number(
          matchedRows
        ) || 0
      ),
      resultStatus,
      JSON.stringify(
        normalizedResult ||
          null
      ),
      userId,
    ]
  );
}

function handleWorldOfficeError(
  res,
  error
) {
  const known = {
    WORLDOFFICE_READONLY_DISABLED:
      409,

    WORLDOFFICE_CONFIG_INCOMPLETE:
      409,

    WORLDOFFICE_OBJECT_NOT_FOUND:
      404,

    WORLDOFFICE_MAPPING_INVALID:
      400,

    WORLDOFFICE_INVOICE_REFERENCE_REQUIRED:
      409,

    INVALID_SQL_IDENTIFIER:
      400,
  };

  const status =
    known[error?.code] ||
    500;

  return res
    .status(status)
    .json({
      success: false,
      code:
        error?.code ||
        'WORLDOFFICE_READ_ERROR',
      message:
        status === 500
          ? 'Error en lectura financiera WorldOffice'
          : error.message,
    });
}

exports.getStatus =
  async (req, res) => {
    if (!isAdmin(req)) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            'Solo administración puede consultar la configuración WorldOffice.',
        });
    }

    const client =
      await pool.connect();

    try {
      const [
        mapping,
        discovery,
      ] = await Promise.all([
        getActiveMapping(
          client
        ),

        getLatestDiscovery(
          client
        ),
      ]);

      return res.json({
        success: true,
        data: {
          config:
            worldOffice.configStatus(),

          active_mapping:
            mapping,

          latest_discovery:
            discovery
              ? {
                  id:
                    discovery.id,
                  status:
                    discovery.status,
                  database_name:
                    discovery.database_name,
                  object_count:
                    discovery.object_count,
                  candidate_count:
                    discovery.candidate_count,
                  completed_at:
                    discovery.completed_at,
                }
              : null,
        },
      });
    } catch (error) {
      console.error(
        'V18 get WorldOffice status:',
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al cargar estado WorldOffice V18',
        });
    } finally {
      client.release();
    }
  };

exports.probe =
  async (req, res) => {
    if (!isAdmin(req)) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            'Solo administración puede probar la conexión WorldOffice.',
        });
    }

    try {
      const result =
        await worldOffice.health();

      return res.json({
        success: true,
        data: result,
        message:
          'Conexión de solo lectura disponible.',
      });
    } catch (error) {
      console.error(
        'V18 WorldOffice probe:',
        error
      );

      return handleWorldOfficeError(
        res,
        error
      );
    }
  };

exports.discover =
  async (req, res) => {
    if (!isAdmin(req)) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            'Solo administración puede ejecutar el descubrimiento.',
        });
    }

    const client =
      await pool.connect();

    try {
      const snapshot =
        await worldOffice.catalogSnapshot();

      const runId =
        randomUUID();

      await client.query(
        `
          INSERT INTO
            worldoffice_financial_discovery_runs (
              id,
              status,
              database_name,
              object_count,
              candidate_count,
              candidate_snapshot,
              started_by,
              started_at,
              completed_at
            )
          VALUES (
            $1,
            'completed',
            $2,$3,$4,$5::jsonb,$6,NOW(),NOW()
          )
        `,
        [
          runId,
          snapshot.database_name,
          snapshot.object_count,
          snapshot.candidate_count,
          JSON.stringify(
            snapshot.candidates
          ),
          req.user.id,
        ]
      );

      await logReadEvent(
        client,
        {
          eventType:
            'discovery',
          matchedRows:
            snapshot.candidate_count,
          resultStatus:
            'unknown',
          normalizedResult: {
            run_id:
              runId,
            database_name:
              snapshot.database_name,
            object_count:
              snapshot.object_count,
            candidate_count:
              snapshot.candidate_count,
          },
          userId:
            req.user.id,
        }
      );

      return res
        .status(201)
        .json({
          success: true,
          message:
            'Descubrimiento read-only completado.',
          data: {
            run_id:
              runId,
            ...snapshot,
          },
        });
    } catch (error) {
      console.error(
        'V18 WorldOffice discovery:',
        error
      );

      return handleWorldOfficeError(
        res,
        error
      );
    } finally {
      client.release();
    }
  };

exports.getLatestDiscovery =
  async (req, res) => {
    if (!isAdmin(req)) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            'Solo administración puede consultar el descubrimiento.',
        });
    }

    const client =
      await pool.connect();

    try {
      const discovery =
        await getLatestDiscovery(
          client
        );

      return res.json({
        success: true,
        data:
          discovery,
      });
    } catch (error) {
      console.error(
        'V18 latest discovery:',
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al cargar descubrimiento WorldOffice',
        });
    } finally {
      client.release();
    }
  };

exports.preview =
  async (req, res) => {
    if (!isAdmin(req)) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            'Solo administración puede previsualizar estructuras WorldOffice.',
        });
    }

    const schemaName =
      clean(
        req.body
          ?.schema_name,
        128
      );

    const objectName =
      clean(
        req.body
          ?.object_name,
        128
      );

    if (
      !schemaName ||
      !objectName
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            'Selecciona esquema y tabla/vista.',
        });
    }

    const client =
      await pool.connect();

    try {
      const result =
        await worldOffice.previewObject(
          schemaName,
          objectName,
          req.body?.limit
        );

      await logReadEvent(
        client,
        {
          eventType:
            'preview',
          matchedRows:
            result.rows.length,
          resultStatus:
            'unknown',
          normalizedResult: {
            schema_name:
              schemaName,
            object_name:
              objectName,
            preview_columns:
              result.preview_columns,
          },
          userId:
            req.user.id,
        }
      );

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error(
        'V18 preview:',
        error
      );

      return handleWorldOfficeError(
        res,
        error
      );
    } finally {
      client.release();
    }
  };

exports.getMapping =
  async (req, res) => {
    if (!isAdmin(req)) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            'Solo administración puede consultar el mapeo WorldOffice.',
        });
    }

    const client =
      await pool.connect();

    try {
      const result =
        await client.query(
          `
            SELECT *
            FROM
              worldoffice_financial_mappings
            ORDER BY
              active DESC,
              updated_at DESC
          `
        );

      return res.json({
        success: true,
        data:
          result.rows,
      });
    } catch (error) {
      console.error(
        'V18 get mapping:',
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al cargar mapeo WorldOffice',
        });
    } finally {
      client.release();
    }
  };

exports.saveMapping =
  async (req, res) => {
    if (!isAdmin(req)) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            'Solo administración puede configurar el mapeo WorldOffice.',
        });
    }

    const profileName =
      clean(
        req.body
          ?.profile_name,
        120
      ) ||
      'WorldOffice financiero';

    const sourceSchema =
      clean(
        req.body
          ?.source_schema,
        128
      );

    const sourceObject =
      clean(
        req.body
          ?.source_object,
        128
      );

    if (
      !sourceSchema ||
      !sourceObject
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            'Selecciona la tabla/vista origen.',
        });
    }

    const tolerance =
      Math.max(
        0,
        numeric(
          req.body
            ?.balance_tolerance,
          0
        )
      );

    const requested = {
      source_schema:
        sourceSchema,
      source_object:
        sourceObject,

      invoice_reference_column:
        clean(
          req.body
            ?.invoice_reference_column,
          128
        ),

      client_document_column:
        clean(
          req.body
            ?.client_document_column,
          128
        ),

      client_external_id_column:
        clean(
          req.body
            ?.client_external_id_column,
          128
        ),

      total_amount_column:
        clean(
          req.body
            ?.total_amount_column,
          128
        ),

      paid_amount_column:
        clean(
          req.body
            ?.paid_amount_column,
          128
        ),

      balance_amount_column:
        clean(
          req.body
            ?.balance_amount_column,
          128
        ),

      status_column:
        clean(
          req.body
            ?.status_column,
          128
        ),

      due_date_column:
        clean(
          req.body
            ?.due_date_column,
          128
        ),

      currency_column:
        clean(
          req.body
            ?.currency_column,
          128
        ),
    };

    let validated;

    try {
      validated =
        await worldOffice.validateMapping(
          requested
        );
    } catch (error) {
      console.error(
        'V18 validate mapping:',
        error
      );

      return handleWorldOfficeError(
        res,
        error
      );
    }

    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      const activate =
        req.body?.active !==
        false;

      if (activate) {
        await client.query(
          `
            UPDATE
              worldoffice_financial_mappings
            SET
              active = FALSE,
              updated_by = $1,
              updated_at = NOW()
            WHERE
              active = TRUE
          `,
          [
            req.user.id,
          ]
        );
      }

      const existing =
        await client.query(
          `
            SELECT id
            FROM
              worldoffice_financial_mappings
            WHERE
              LOWER(profile_name) =
                LOWER($1)
            LIMIT 1
          `,
          [
            profileName,
          ]
        );

      const id =
        existing.rows[0]
          ?.id ||
        randomUUID();

      const result =
        existing.rows[0]
          ? await client.query(
              `
                UPDATE
                  worldoffice_financial_mappings
                SET
                  source_schema =
                    $1,
                  source_object =
                    $2,
                  source_object_type =
                    $3,
                  invoice_reference_column =
                    $4,
                  client_document_column =
                    $5,
                  client_external_id_column =
                    $6,
                  total_amount_column =
                    $7,
                  paid_amount_column =
                    $8,
                  balance_amount_column =
                    $9,
                  status_column =
                    $10,
                  due_date_column =
                    $11,
                  currency_column =
                    $12,
                  balance_tolerance =
                    $13,
                  active =
                    $14,
                  observation_only =
                    TRUE,
                  note =
                    $15,
                  updated_by =
                    $16,
                  updated_at =
                    NOW()
                WHERE
                  id = $17
                RETURNING *
              `,
              [
                validated.mapping
                  .source_schema,
                validated.mapping
                  .source_object,
                validated.mapping
                  .source_object_type,
                validated.mapping
                  .invoice_reference_column,
                validated.mapping
                  .client_document_column,
                validated.mapping
                  .client_external_id_column,
                validated.mapping
                  .total_amount_column,
                validated.mapping
                  .paid_amount_column,
                validated.mapping
                  .balance_amount_column,
                validated.mapping
                  .status_column,
                validated.mapping
                  .due_date_column,
                validated.mapping
                  .currency_column,
                tolerance,
                activate,
                clean(
                  req.body?.note,
                  5000
                ),
                req.user.id,
                id,
              ]
            )
          : await client.query(
              `
                INSERT INTO
                  worldoffice_financial_mappings (
                    id,
                    profile_name,
                    source_schema,
                    source_object,
                    source_object_type,
                    invoice_reference_column,
                    client_document_column,
                    client_external_id_column,
                    total_amount_column,
                    paid_amount_column,
                    balance_amount_column,
                    status_column,
                    due_date_column,
                    currency_column,
                    balance_tolerance,
                    active,
                    observation_only,
                    note,
                    created_by,
                    updated_by,
                    created_at,
                    updated_at
                  )
                VALUES (
                  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,TRUE,$17,$18,$18,NOW(),NOW()
                )
                RETURNING *
              `,
              [
                id,
                profileName,
                validated.mapping
                  .source_schema,
                validated.mapping
                  .source_object,
                validated.mapping
                  .source_object_type,
                validated.mapping
                  .invoice_reference_column,
                validated.mapping
                  .client_document_column,
                validated.mapping
                  .client_external_id_column,
                validated.mapping
                  .total_amount_column,
                validated.mapping
                  .paid_amount_column,
                validated.mapping
                  .balance_amount_column,
                validated.mapping
                  .status_column,
                validated.mapping
                  .due_date_column,
                validated.mapping
                  .currency_column,
                tolerance,
                activate,
                clean(
                  req.body?.note,
                  5000
                ),
                req.user.id,
              ]
            );

      await client.query(
        'COMMIT'
      );

      return res.json({
        success: true,
        message:
          'Mapeo WorldOffice validado y guardado.',
        data:
          result.rows[0],
      });
    } catch (error) {
      await rollback(
        client
      );

      console.error(
        'V18 save mapping:',
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al guardar mapeo WorldOffice',
        });
    } finally {
      client.release();
    }
  };

async function executeOrderLiveCheck(
  client,
  order,
  mapping
) {
  if (!order.invoice_reference) {
    const error =
      new Error(
        'Guarda primero la referencia de factura en Control financiero.'
      );

    error.code =
      'WORLDOFFICE_INVOICE_REFERENCE_REQUIRED';

    throw error;
  }

  const queryResult =
    await worldOffice.queryMappedInvoice({
      mapping,
      invoiceReference:
        order.invoice_reference,
      clientDocument:
        order.client_document,
      clientExternalId:
        order.client_worldoffice_code,
    });

  const summary =
    worldOffice.summarizeLiveResult(
      queryResult,
      mapping.balance_tolerance
    );

  return {
    ...summary,
    invoice_reference:
      order.invoice_reference,
    mapping: {
      id:
        mapping.id,
      profile_name:
        mapping.profile_name,
      source_schema:
        mapping.source_schema,
      source_object:
        mapping.source_object,
      source_object_type:
        mapping.source_object_type,
      observation_only:
        mapping.observation_only,
      balance_tolerance:
        mapping.balance_tolerance,
    },
  };
}

exports.liveCheck =
  async (req, res) => {
    if (!isAdmin(req)) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            'Solo administración puede consultar datos financieros en WorldOffice.',
        });
    }

    const client =
      await pool.connect();

    try {
      const order =
        await getOrderContext(
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

      const mapping =
        await getActiveMapping(
          client
        );

      if (!mapping) {
        return res
          .status(409)
          .json({
            success: false,
            code:
              'WORLDOFFICE_MAPPING_REQUIRED',
            message:
              'Configura y activa primero un mapeo financiero WorldOffice.',
          });
      }

      const summary =
        await executeOrderLiveCheck(
          client,
          order,
          mapping
        );

      await logReadEvent(
        client,
        {
          serviceOrderId:
            order.id,
          mappingId:
            mapping.id,
          eventType:
            'live_check',
          invoiceReference:
            order.invoice_reference,
          matchedRows:
            summary.matched_rows,
          resultStatus:
            summary.result_status,
          normalizedResult: {
            record:
              summary.record,
            eligible_zero_balance:
              summary.eligible_zero_balance,
            message:
              summary.message,
          },
          userId:
            req.user.id,
        }
      );

      return res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error(
        'V18 live check:',
        error
      );

      return handleWorldOfficeError(
        res,
        error
      );
    } finally {
      client.release();
    }
  };

exports.registerZeroBalance =
  async (req, res) => {
    if (!isAdmin(req)) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            'Solo administración puede registrar una verificación WorldOffice.',
        });
    }

    const client =
      await pool.connect();

    try {
      const order =
        await getOrderContext(
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

      const mapping =
        await getActiveMapping(
          client
        );

      if (!mapping) {
        return res
          .status(409)
          .json({
            success: false,
            code:
              'WORLDOFFICE_MAPPING_REQUIRED',
            message:
              'No existe un mapeo financiero WorldOffice activo.',
          });
      }

      const summary =
        await executeOrderLiveCheck(
          client,
          order,
          mapping
        );

      if (
        !summary
          .eligible_zero_balance
      ) {
        await logReadEvent(
          client,
          {
            serviceOrderId:
              order.id,
            mappingId:
              mapping.id,
            eventType:
              'live_check',
            invoiceReference:
              order.invoice_reference,
            matchedRows:
              summary.matched_rows,
            resultStatus:
              summary.result_status,
            normalizedResult: {
              record:
                summary.record,
              eligible_zero_balance:
                false,
              message:
                summary.message,
            },
            userId:
              req.user.id,
          }
        );

        return res
          .status(409)
          .json({
            success: false,
            code:
              'WORLDOFFICE_ZERO_BALANCE_NOT_VERIFIED',
            message:
              summary.message,
            data: summary,
          });
      }

      await client.query(
        'BEGIN'
      );

      const verificationId =
        randomUUID();

      const externalReference =
        `WO:${mapping.source_schema}.${mapping.source_object}:${order.invoice_reference}`;

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
            $1,$2,
            'worldoffice_live',
            'balance_zero',
            'cleared',
            $3,$4,$5,$6,$7,$8,$9::jsonb,$10,NOW(),NOW()
          )
        `,
        [
          verificationId,
          order.id,
          order.invoice_reference,
          order.payment_reference,
          externalReference,
          summary.record
            ?.balance_amount ??
            0,
          summary.record
            ?.paid_amount ??
            null,
          'Saldo cero verificado mediante lectura directa de WorldOffice V18. WorldOffice no fue modificado.',
          JSON.stringify({
            mapping_id:
              mapping.id,
            profile_name:
              mapping.profile_name,
            source_schema:
              mapping.source_schema,
            source_object:
              mapping.source_object,
            invoice_reference:
              order.invoice_reference,
            record:
              summary.record,
            tolerance:
              mapping.balance_tolerance,
            verification_mode:
              'read_only',
          }),
          req.user.id,
        ]
      );

      await client.query(
        `
          UPDATE
            service_order_financial_controls
          SET
            clearance_status =
              'cleared',
            external_system =
              'WorldOffice',
            external_invoice_id =
              COALESCE(
                external_invoice_id,
                $1
              ),
            last_verified_at =
              NOW(),
            last_verified_by =
              $2,
            updated_at =
              NOW()
          WHERE
            service_order_id =
              $3
        `,
        [
          order.invoice_reference,
          req.user.id,
          order.id,
        ]
      );

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
            $1,$2,
            'worldoffice_balance_zero_verified',
            $3,$4::jsonb,NOW()
          )
        `,
        [
          randomUUID(),
          order.id,
          req.user.id,
          JSON.stringify({
            verification_id:
              verificationId,
            invoice_reference:
              order.invoice_reference,
            balance_amount:
              summary.record
                ?.balance_amount ??
              0,
            source_object:
              `${mapping.source_schema}.${mapping.source_object}`,
            mode:
              'read_only',
          }),
        ]
      );

      await logReadEvent(
        client,
        {
          serviceOrderId:
            order.id,
          mappingId:
            mapping.id,
          eventType:
            'balance_zero_registered',
          invoiceReference:
            order.invoice_reference,
          matchedRows:
            summary.matched_rows,
          resultStatus:
            'registered',
          normalizedResult: {
            verification_id:
              verificationId,
            record:
              summary.record,
          },
          userId:
            req.user.id,
        }
      );

      await enqueueNotification(
        client,
        {
          serviceOrderId:
            order.id,
          eventType:
            'worldoffice_balance_verified',
          idempotencyKey:
            `${order.id}:worldoffice_balance_verified:${verificationId}`,
          payload: {
            codigo_os:
              order.codigo_os,
            invoice_reference:
              order.invoice_reference,
            balance_amount:
              summary.record
                ?.balance_amount ??
              0,
            verification_id:
              verificationId,
            source:
              'worldoffice_live',
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
            'Saldo cero registrado desde WorldOffice. La OS quedó financieramente liberada.',
          data: {
            verification_id:
              verificationId,
            summary,
          },
        });
    } catch (error) {
      await rollback(
        client
      );

      console.error(
        'V18 register zero balance:',
        error
      );

      return handleWorldOfficeError(
        res,
        error
      );
    } finally {
      client.release();
    }
  };
