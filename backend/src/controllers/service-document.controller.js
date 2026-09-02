'use strict';

const crypto = require('crypto');
const fsp = require('fs/promises');
const path = require('path');

const pool = require('../db/pool');

const {
  buildServiceDocumentHtml,
} = require('../services/service-document-template.service');

const {
  generatePdfBuffer,
} = require('../services/service-document-pdf.service');

const {
  enqueueNotification,
} = require('../services/service-notification-outbox.service');

const {
  randomUUID,
} = crypto;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DOCUMENT_TYPES =
  new Set([
    'reception_act',
    'technical_closure',
    'final_delivery',
  ]);

const DOCUMENT_LABELS = {
  reception_act:
    'Acta de recepción',
  technical_closure:
    'Acta de cierre técnico',
  final_delivery:
    'Acta de entrega final',
};

const DOCUMENT_DIR =
  path.resolve(
    process.env.SERVICE_DOCUMENT_DIR ||
      path.resolve(
        __dirname,
        '../../uploads/service-documents'
      )
  );

const EVIDENCE_DIR =
  path.resolve(
    process.env.SERVICE_EVIDENCE_DIR ||
      path.resolve(
        __dirname,
        '../../uploads/service-orders'
      )
  );

function role(req) {
  return req.user?.role?.name ||
    req.user?.rol ||
    null;
}

function isAdmin(req) {
  return role(req) === 'admin';
}

function isTechnician(req) {
  return role(req) === 'tecnico';
}

function safeStoredPath(
  root,
  relative
) {
  const absolute =
    path.resolve(
      root,
      relative
    );

  if (
    !absolute.startsWith(
      `${root}${path.sep}`
    )
  ) {
    throw new Error(
      'Ruta de almacenamiento inválida'
    );
  }

  return absolute;
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
  orderId
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
          so.fecha_inicio,
          so.fecha_fin,
          so."createdAt" AS created_at,
          so."updatedAt" AS updated_at,

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
          c.email AS client_email

        FROM service_orders so

        LEFT JOIN clients c
          ON c.id =
            so.client_id

        WHERE so.id = $1
        LIMIT 1
      `,
      [
        orderId,
      ]
    );

  return result.rows[0] ||
    null;
}

async function isTeamMember(
  client,
  orderId,
  userId
) {
  const result =
    await client.query(
      `
        SELECT 1
        FROM service_order_team_members
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
        orderId,
        userId,
      ]
    );

  return Boolean(
    result.rows[0]
  );
}

async function canReadOrder(
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

  return (
    order.tecnico_id ===
      req.user.id ||
    await isTeamMember(
      client,
      order.id,
      req.user.id
    )
  );
}

async function getUserName(
  client,
  userId
) {
  if (!userId) {
    return null;
  }

  const result =
    await client.query(
      `
        SELECT
          CONCAT_WS(
            ' ',
            nombre1,
            nombre2,
            apellidos
          ) AS full_name,
          usuario
        FROM usuarios
        WHERE id = $1
        LIMIT 1
      `,
      [
        userId,
      ]
    );

  return (
    result.rows[0]
      ?.full_name ||
    result.rows[0]
      ?.usuario ||
    null
  );
}

async function fileDataUri(
  relativePath,
  mimeType
) {
  if (!relativePath) {
    return null;
  }

  try {
    const absolute =
      safeStoredPath(
        EVIDENCE_DIR,
        relativePath
      );

    const buffer =
      await fsp.readFile(
        absolute
      );

    return `data:${mimeType || 'image/png'};base64,${buffer.toString(
      'base64'
    )}`;
  } catch (error) {
    console.warn(
      'V16: no fue posible cargar firma:',
      relativePath,
      error?.message
    );

    return null;
  }
}

async function loadSnapshot(
  client,
  order
) {
  const [
    teamResult,
    receptionActResult,
    receptionChecklistResult,
    receptionEvidenceResult,
    diagnosisResult,
    closureResult,
    finalEvidenceResult,
    deliveryResult,
    thirdPartyEvidenceResult,
    satisfactionResult,
    notificationsResult,
  ] = await Promise.all([
    client.query(
      `
        SELECT
          tm.technician_id,
          tm.member_role,
          tm.member_status,
          CONCAT_WS(
            ' ',
            u.nombre1,
            u.nombre2,
            u.apellidos
          ) AS technician_name,
          u.usuario
        FROM
          service_order_team_members tm
        LEFT JOIN usuarios u
          ON
            u.id =
              tm.technician_id
        WHERE
          tm.service_order_id =
            $1
          AND
          tm.member_status <>
            'removed'
        ORDER BY
          CASE
            WHEN tm.member_role =
              'primary'
            THEN 0
            ELSE 1
          END,
          tm.added_at ASC
      `,
      [order.id]
    ),

    client.query(
      `
        SELECT *
        FROM
          service_order_reception_acts
        WHERE
          service_order_id =
            $1
        LIMIT 1
      `,
      [order.id]
    ),

    client.query(
      `
        SELECT *
        FROM
          service_order_reception_checklists
        WHERE
          service_order_id =
            $1
        LIMIT 1
      `,
      [order.id]
    ),

    client.query(
      `
        SELECT
          original_name,
          category,
          note,
          captured_at,
          created_at
        FROM
          service_order_evidences
        WHERE
          service_order_id =
            $1
          AND
          stage =
            'reception'
          AND
          deleted_at
            IS NULL
        ORDER BY
          created_at ASC
      `,
      [order.id]
    ),

    client.query(
      `
        SELECT *
        FROM
          service_order_diagnostics
        WHERE
          service_order_id =
            $1
        LIMIT 1
      `,
      [order.id]
    ),

    client.query(
      `
        SELECT *
        FROM
          service_order_closures
        WHERE
          service_order_id =
            $1
        LIMIT 1
      `,
      [order.id]
    ),

    client.query(
      `
        SELECT
          original_name,
          note,
          created_at
        FROM
          service_order_final_evidences
        WHERE
          service_order_id =
            $1
        ORDER BY
          created_at ASC
      `,
      [order.id]
    ),

    client.query(
      `
        SELECT *
        FROM
          service_order_deliveries
        WHERE
          service_order_id =
            $1
        LIMIT 1
      `,
      [order.id]
    ),

    client.query(
      `
        SELECT
          original_name,
          category,
          note,
          created_at
        FROM
          service_order_delivery_evidences
        WHERE
          service_order_id =
            $1
          AND
          category =
            'third_party_authorization'
        ORDER BY
          created_at ASC
      `,
      [order.id]
    ),

    client.query(
      `
        SELECT *
        FROM
          service_order_satisfaction
        WHERE
          service_order_id =
            $1
        LIMIT 1
      `,
      [order.id]
    ),

    client.query(
      `
        SELECT
          channel,
          recipient_name,
          recipient_contact,
          reference,
          note,
          notified_at
        FROM
          service_order_client_notifications
        WHERE
          service_order_id =
            $1
        ORDER BY
          notified_at ASC
      `,
      [order.id]
    ),
  ]);

  const team =
    teamResult.rows;

  const primary =
    team.find(
      (item) =>
        item.member_role ===
        'primary'
    );

  const receptionAct =
    receptionActResult.rows[0] ||
    null;

  const delivery =
    deliveryResult.rows[0] ||
    null;

  const [
    receptionSignature,
    deliverySignature,
    deliveredByName,
  ] = await Promise.all([
    receptionAct
      ? fileDataUri(
          receptionAct.signature_storage_path ||
            receptionAct.signature_path,
          receptionAct.signature_mime_type ||
            'image/png'
        )
      : Promise.resolve(
          null
        ),

    delivery
      ? fileDataUri(
          delivery.signature_storage_path,
          delivery.signature_mime_type ||
            'image/png'
        )
      : Promise.resolve(
          null
        ),

    getUserName(
      client,
      delivery?.delivered_by
    ),
  ]);

  return {
    order,
    team,
    primary_technician_id:
      primary?.technician_id ||
      order.tecnico_id ||
      null,

    primary_technician_name:
      primary?.technician_name ||
      primary?.usuario ||
      await getUserName(
        client,
        order.tecnico_id
      ),

    reception_act:
      receptionAct,

    reception_checklist:
      receptionChecklistResult
        .rows[0] ||
      null,

    reception_evidences:
      receptionEvidenceResult.rows,

    reception_signature_data_uri:
      receptionSignature,

    diagnosis:
      diagnosisResult.rows[0] ||
      null,

    closure:
      closureResult.rows[0] ||
      null,

    final_evidences:
      finalEvidenceResult.rows,

    delivery,

    third_party_evidences:
      thirdPartyEvidenceResult.rows,

    delivery_signature_data_uri:
      deliverySignature,

    delivered_by_name:
      deliveredByName,

    satisfaction:
      satisfactionResult.rows[0] ||
      null,

    notifications:
      notificationsResult.rows,
  };
}

function assertPrerequisites(
  req,
  documentType,
  snapshot
) {
  if (
    documentType ===
    'reception_act'
  ) {
    if (
      !snapshot.reception_act
        ?.signed_at
    ) {
      const error =
        new Error(
          'El acta de recepción debe estar firmada antes de generar el PDF formal.'
        );

      error.code =
        'RECEPTION_ACT_NOT_SIGNED';

      throw error;
    }

    return;
  }

  if (
    documentType ===
    'technical_closure'
  ) {
    const allowed =
      new Set([
        'technical_closed',
        'handed_to_direction',
        'direction_received',
        'validated',
      ]);

    if (
      !allowed.has(
        snapshot.closure
          ?.status
      )
    ) {
      const error =
        new Error(
          'Primero debe existir un cierre técnico confirmado.'
        );

      error.code =
        'TECHNICAL_CLOSURE_REQUIRED';

      throw error;
    }

    return;
  }

  if (
    documentType ===
    'final_delivery'
  ) {
    if (!isAdmin(req)) {
      const error =
        new Error(
          'Solo administración puede generar el acta formal de entrega final.'
        );

      error.code =
        'ADMIN_REQUIRED';

      throw error;
    }

    if (
      snapshot.delivery
        ?.status !==
      'delivered'
    ) {
      const error =
        new Error(
          'La entrega final debe estar confirmada antes de generar el acta.'
        );

      error.code =
        'FINAL_DELIVERY_REQUIRED';

      throw error;
    }
  }
}

exports.listDocuments =
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
        !(await canReadOrder(
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
              'No autorizado para consultar documentos de esta orden',
          });
      }

      const result =
        await client.query(
          `
            SELECT
              id,
              service_order_id,
              document_type,
              version,
              status,
              original_name,
              mime_type,
              size_bytes,
              sha256,
              generated_by,
              generated_at
            FROM
              service_order_documents
            WHERE
              service_order_id =
                $1
            ORDER BY
              document_type ASC,
              version DESC
          `,
          [
            order.id,
          ]
        );

      return res.json({
        success: true,
        data: {
          order,
          documents:
            result.rows,
          available_types:
            Array.from(
              DOCUMENT_TYPES
            ).map(
              (key) => ({
                key,
                label:
                  DOCUMENT_LABELS[
                    key
                  ],
              })
            ),
        },
      });
    } catch (error) {
      console.error(
        'V16 list documents:',
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
              'V16_TABLES_NOT_INSTALLED',
            message:
              'Faltan las tablas V16 de documentos formales.',
          });
      }

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al cargar documentos formales',
        });
    } finally {
      client.release();
    }
  };

exports.generateDocument =
  async (req, res) => {
    const documentType =
      String(
        req.params
          .documentType ||
          ''
      ).trim();

    if (
      !DOCUMENT_TYPES.has(
        documentType
      )
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            'Tipo de documento no válido',
        });
    }

    const client =
      await pool.connect();

    let absolutePath =
      null;

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
        !(await canReadOrder(
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
              'No autorizado para generar documentos de esta orden',
          });
      }

      const snapshot =
        await loadSnapshot(
          client,
          order
        );

      assertPrerequisites(
        req,
        documentType,
        snapshot
      );

      const html =
        buildServiceDocumentHtml(
          documentType,
          snapshot
        );

      const pdfBuffer =
        await generatePdfBuffer(
          html
        );

      const sha256 =
        crypto
          .createHash(
            'sha256'
          )
          .update(pdfBuffer)
          .digest('hex');

      await client.query(
        'BEGIN'
      );

      await client.query(
        `
          SELECT
            pg_advisory_xact_lock(
              hashtext(
                $1
              )
            )
        `,
        [
          `${order.id}:${documentType}`,
        ]
      );

      const versionResult =
        await client.query(
          `
            SELECT
              COALESCE(
                MAX(version),
                0
              ) + 1
                AS next_version
            FROM
              service_order_documents
            WHERE
              service_order_id =
                $1
              AND
              document_type =
                $2
          `,
          [
            order.id,
            documentType,
          ]
        );

      const version =
        Number(
          versionResult.rows[0]
            ?.next_version ||
            1
        );

      const documentId =
        randomUUID();

      const fileName =
        `${order.codigo_os || 'OS'}-${documentType}-v${version}.pdf`
          .replace(
            /[^a-zA-Z0-9._-]/g,
            '_'
          );

      const relativePath =
        path.join(
          order.id,
          documentType,
          `v${version}-${documentId}.pdf`
        );

      absolutePath =
        safeStoredPath(
          DOCUMENT_DIR,
          relativePath
        );

      await fsp.mkdir(
        path.dirname(
          absolutePath
        ),
        {
          recursive: true,
        }
      );

      await fsp.writeFile(
        absolutePath,
        pdfBuffer,
        {
          flag: 'wx',
        }
      );

      await client.query(
        `
          UPDATE
            service_order_documents
          SET
            status =
              'superseded'
          WHERE
            service_order_id =
              $1
            AND
            document_type =
              $2
            AND
            status =
              'generated'
        `,
        [
          order.id,
          documentType,
        ]
      );

      const result =
        await client.query(
          `
            INSERT INTO
              service_order_documents (
                id,
                service_order_id,
                document_type,
                version,
                status,
                original_name,
                mime_type,
                size_bytes,
                sha256,
                storage_path,
                snapshot,
                generated_by,
                generated_at,
                created_at
              )
            VALUES (
              $1,$2,$3,$4,
              'generated',
              $5,
              'application/pdf',
              $6,$7,$8,
              $9::jsonb,
              $10,
              NOW(),
              NOW()
            )
            RETURNING
              id,
              service_order_id,
              document_type,
              version,
              status,
              original_name,
              mime_type,
              size_bytes,
              sha256,
              generated_by,
              generated_at
          `,
          [
            documentId,
            order.id,
            documentType,
            version,
            fileName,
            pdfBuffer.length,
            sha256,
            relativePath,
            JSON.stringify(
              snapshot
            ),
            req.user.id,
          ]
        );

      await client.query(
        `
          INSERT INTO
            service_order_document_events (
              id,
              service_order_id,
              document_id,
              event_type,
              actor_user_id,
              metadata,
              created_at
            )
          VALUES (
            $1,$2,$3,
            'document_generated',
            $4,
            $5::jsonb,
            NOW()
          )
        `,
        [
          randomUUID(),
          order.id,
          documentId,
          req.user.id,
          JSON.stringify({
            document_type:
              documentType,
            version,
            sha256,
            size_bytes:
              pdfBuffer.length,
          }),
        ]
      );

      await enqueueNotification(
        client,
        {
          serviceOrderId:
            order.id,
          eventType:
            'formal_document_generated',
          idempotencyKey:
            `${order.id}:formal_document_generated:${documentId}`,
          payload: {
            codigo_os:
              order.codigo_os,
            document_id:
              documentId,
            document_type:
              documentType,
            document_label:
              DOCUMENT_LABELS[
                documentType
              ],
            version,
            sha256,
            size_bytes:
              pdfBuffer.length,
            file_name:
              fileName,
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
            `${DOCUMENT_LABELS[documentType]} generada correctamente.`,
          data:
            result.rows[0],
        });
    } catch (error) {
      await rollback(
        client
      );

      if (absolutePath) {
        try {
          await fsp.unlink(
            absolutePath
          );
        } catch (_) {}
      }

      console.error(
        'V16 generate document:',
        error
      );

      if (
        [
          'RECEPTION_ACT_NOT_SIGNED',
          'TECHNICAL_CLOSURE_REQUIRED',
          'FINAL_DELIVERY_REQUIRED',
        ].includes(
          error?.code
        )
      ) {
        return res
          .status(409)
          .json({
            success: false,
            code:
              error.code,
            message:
              error.message,
          });
      }

      if (
        error?.code ===
        'ADMIN_REQUIRED'
      ) {
        return res
          .status(403)
          .json({
            success: false,
            code:
              error.code,
            message:
              error.message,
          });
      }

      if (
        [
          'PUPPETEER_NOT_INSTALLED',
          'BROWSER_NOT_FOUND',
        ].includes(
          error?.code
        )
      ) {
        return res
          .status(503)
          .json({
            success: false,
            code:
              error.code,
            message:
              error.message,
          });
      }

      if (
        error?.code ===
        'PDF_QUEUE_FULL'
      ) {
        return res
          .status(429)
          .json({
            success: false,
            code:
              error.code,
            message:
              error.message,
          });
      }

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al generar documento PDF formal',
        });
    } finally {
      client.release();
    }
  };

exports.getDocumentFile =
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      if (
        !UUID_RE.test(
          String(
            req.params
              .documentId ||
              ''
          )
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              'ID de documento no válido',
          });
      }

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
        !(await canReadOrder(
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
              'No autorizado para descargar este documento',
          });
      }

      const result =
        await client.query(
          `
            SELECT
              original_name,
              mime_type,
              storage_path
            FROM
              service_order_documents
            WHERE
              id = $1
              AND
              service_order_id =
                $2
            LIMIT 1
          `,
          [
            req.params
              .documentId,
            order.id,
          ]
        );

      const document =
        result.rows[0];

      if (!document) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              'Documento no encontrado',
          });
      }

      const absolutePath =
        safeStoredPath(
          DOCUMENT_DIR,
          document.storage_path
        );

      await fsp.access(
        absolutePath
      );

      res.setHeader(
        'Content-Type',
        document.mime_type ||
          'application/pdf'
      );

      res.setHeader(
        'Content-Disposition',
        `inline; filename="${String(
          document.original_name ||
            'documento.pdf'
        ).replaceAll('"', '')}"`
      );

      return res.sendFile(
        absolutePath
      );
    } catch (error) {
      console.error(
        'V16 get document:',
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al abrir documento formal',
        });
    } finally {
      client.release();
    }
  };
