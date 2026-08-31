'use strict';

const pool = require('../db/pool');
const {
  scheduleOrderAutomatically,
} = require('../services/service-scheduling.service');

exports.autoSchedule = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const schedule =
      await scheduleOrderAutomatically(
        client,
        {
          orderId: req.params.id,
          actorUserId: req.user?.id || null,
          replaceExisting: true,
        }
      );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Agenda recalculada automáticamente',
      data: schedule,
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}

    console.error(
      'Error auto scheduling service:',
      error
    );

    if (
      [
        'NO_COMMON_SLOT',
        'TEAM_REQUIRED_FOR_SCHEDULE',
        'ORDER_NOT_FOUND',
      ].includes(error?.code)
    ) {
      return res.status(409).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        'No fue posible agendar automáticamente el servicio',
    });
  } finally {
    client.release();
  }
};
