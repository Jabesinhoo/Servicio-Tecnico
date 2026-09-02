'use strict';

const pool =
  require('../db/pool');

const CHANNELS =
  new Set([
    'whatsapp',
    'email',
    'sms',
    'webhook',
  ]);

function clean(
  value,
  max = 10000
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

exports.listTemplates =
  async (_req, res) => {
    try {
      const result =
        await pool.query(
          `
            SELECT
              id,
              template_key,
              event_type,
              channel,
              name,
              subject_template,
              body_template,
              active,
              version,
              updated_by,
              updated_at
            FROM
              service_notification_templates
            ORDER BY
              event_type ASC,
              channel ASC,
              template_key ASC
          `
        );

      return res.json({
        success: true,
        data:
          result.rows,
      });
    } catch (error) {
      console.error(
        'Error listing notification templates:',
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al cargar plantillas de notificacion',
        });
    }
  };

exports.updateTemplate =
  async (req, res) => {
    try {
      const templateId =
        String(
          req.params
            .templateId ||
            ''
        ).trim();

      const current =
        await pool.query(
          `
            SELECT *
            FROM
              service_notification_templates
            WHERE
              id = $1
            LIMIT 1
          `,
          [
            templateId,
          ]
        );

      if (
        !current.rows[0]
      ) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              'Plantilla no encontrada',
          });
      }

      const channel =
        clean(
          req.body?.channel,
          30
        ) ||
        current.rows[0]
          .channel;

      if (
        !CHANNELS.has(
          channel
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              'Canal de plantilla no valido',
          });
      }

      const name =
        clean(
          req.body?.name,
          180
        ) ||
        current.rows[0]
          .name;

      const subject =
        req.body
          ?.subject_template ===
        undefined
          ? current.rows[0]
              .subject_template
          : clean(
              req.body
                ?.subject_template,
              5000
            );

      const body =
        req.body
          ?.body_template ===
        undefined
          ? current.rows[0]
              .body_template
          : clean(
              req.body
                ?.body_template,
              12000
            );

      if (!body) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              'El cuerpo de la plantilla es obligatorio',
          });
      }

      const active =
        req.body?.active ===
        undefined
          ? current.rows[0]
              .active
          : Boolean(
              req.body?.active
            );

      const result =
        await pool.query(
          `
            UPDATE
              service_notification_templates
            SET
              channel = $1,
              name = $2,
              subject_template = $3,
              body_template = $4,
              active = $5,
              version =
                version + 1,
              updated_by = $6,
              updated_at = NOW()
            WHERE
              id = $7
            RETURNING *
          `,
          [
            channel,
            name,
            subject,
            body,
            active,
            req.user.id,
            templateId,
          ]
        );

      return res.json({
        success: true,
        message:
          'Plantilla actualizada',
        data:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        'Error updating notification template:',
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            'Error al actualizar plantilla',
        });
    }
  };
