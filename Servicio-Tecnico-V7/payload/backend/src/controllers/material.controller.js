'use strict';

const { randomUUID } = require('crypto');
const pool = require('../db/pool');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TERMINAL_STATES = new Set(['cerrada', 'cancelado', 'rechazado']);

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function positiveInt(value, fallback = null) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function safeRollback(client) {
  try {
    await client.query('ROLLBACK');
  } catch (_) {}
}

async function addServiceEvent(client, serviceOrderId, eventType, actorUserId, metadata = {}) {
  try {
    await client.query(
      `INSERT INTO service_order_events (
         id, service_order_id, event_type,
         actor_user_id, metadata, created_at
       )
       VALUES ($1,$2,$3,$4,$5::jsonb,NOW())`,
      [
        randomUUID(),
        serviceOrderId,
        eventType,
        actorUserId || null,
        JSON.stringify(metadata || {}),
      ]
    );
  } catch (error) {
    if (!['42P01', '42703'].includes(error?.code)) throw error;
  }
}

async function getOrderForUpdate(client, orderId) {
  const result = await client.query(
    `SELECT id, codigo_os, estado
     FROM service_orders
     WHERE id = $1
     FOR UPDATE`,
    [orderId]
  );
  return result.rows[0] || null;
}

async function getMaterialForUpdate(client, id) {
  const result = await client.query(
    `SELECT *
     FROM servicio_materiales
     WHERE id = $1
     FOR UPDATE`,
    [id]
  );
  return result.rows[0] || null;
}

exports.getMaterialesByServicio = async (req, res) => {
  try {
    const { service_order_id: orderId } = req.params;

    if (!isUuid(orderId)) {
      return res.status(400).json({ success: false, message: 'Orden no válida' });
    }

    const result = await pool.query(
      `SELECT
         sm.*,
         p.codigo AS producto_codigo,
         p.nombre AS producto_nombre,
         p.tipo AS producto_tipo,
         p.stock_actual,
         p.stock_minimo,
         p.precio_venta,
         p.costo,
         p.proveedor,
         NULLIF(TRIM(CONCAT_WS(' ', su.nombre1, su.nombre2, su.apellidos)), '') AS solicitado_por_nombre,
         NULLIF(TRIM(CONCAT_WS(' ', au.nombre1, au.nombre2, au.apellidos)), '') AS aprobado_por_nombre,
         NULLIF(TRIM(CONCAT_WS(' ', eu.nombre1, eu.nombre2, eu.apellidos)), '') AS entregado_por_nombre,
         NULLIF(TRIM(CONCAT_WS(' ', uu.nombre1, uu.nombre2, uu.apellidos)), '') AS usado_por_nombre
       FROM servicio_materiales sm
       LEFT JOIN products p ON p.id = sm.product_id
       LEFT JOIN usuarios su ON su.id = sm.solicitado_por
       LEFT JOIN usuarios au ON au.id = sm.aprobado_por
       LEFT JOIN usuarios eu ON eu.id = sm.entregado_por
       LEFT JOIN usuarios uu ON uu.id = sm.usado_por
       WHERE sm.service_order_id = $1
       ORDER BY COALESCE(sm.solicitado_at, sm.created_at) DESC`,
      [orderId]
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error loading service materials:', error);
    return res.status(500).json({ success: false, message: 'Error al cargar materiales del servicio' });
  }
};

exports.solicitarMateriales = async (req, res) => {
  const client = await pool.connect();

  try {
    const { service_order_id: orderId } = req.params;
    const { product_id: productId, cantidad, observaciones } = req.body || {};
    const qty = positiveInt(cantidad);

    if (!isUuid(orderId) || !isUuid(productId)) {
      return res.status(400).json({ success: false, message: 'Orden o producto no válido' });
    }

    if (!qty) {
      return res.status(400).json({ success: false, message: 'La cantidad debe ser mayor que cero' });
    }

    await client.query('BEGIN');

    const order = await getOrderForUpdate(client, orderId);
    if (!order) {
      await safeRollback(client);
      return res.status(404).json({ success: false, message: 'Orden de servicio no encontrada' });
    }

    if (TERMINAL_STATES.has(order.estado)) {
      await safeRollback(client);
      return res.status(409).json({ success: false, message: 'No se pueden solicitar materiales para una orden finalizada' });
    }

    const productResult = await client.query(
      `SELECT id, codigo, nombre, tipo, stock_actual, estado
       FROM products
       WHERE id = $1
       LIMIT 1`,
      [productId]
    );

    const product = productResult.rows[0];
    if (!product || product.estado === false) {
      await safeRollback(client);
      return res.status(404).json({ success: false, message: 'Producto no encontrado o inactivo' });
    }

    if (product.tipo === 'servicio') {
      await safeRollback(client);
      return res.status(400).json({ success: false, message: 'Un servicio no puede solicitarse como material' });
    }

    if (Number(product.stock_actual || 0) < qty) {
      await safeRollback(client);
      return res.status(409).json({
        success: false,
        code: 'INSUFFICIENT_STOCK',
        message: `Stock insuficiente. Disponible: ${Number(product.stock_actual || 0)}`,
      });
    }

    const id = randomUUID();
    const result = await client.query(
      `INSERT INTO servicio_materiales (
         id, service_order_id, product_id,
         cantidad_solicitada, cantidad_entregada,
         cantidad_usada, cantidad_devuelta,
         estado, observaciones,
         solicitado_por, solicitado_at,
         created_at, updated_at
       )
       VALUES ($1,$2,$3,$4,0,0,0,'solicitado',$5,$6,NOW(),NOW(),NOW())
       RETURNING *`,
      [
        id,
        orderId,
        productId,
        qty,
        typeof observaciones === 'string' ? observaciones.trim() || null : null,
        req.user?.id || null,
      ]
    );

    await addServiceEvent(client, orderId, 'material_requested', req.user?.id, {
      material_id: id,
      product_id: productId,
      product_code: product.codigo,
      product_name: product.nombre,
      quantity: qty,
    });

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Material solicitado correctamente',
      data: result.rows[0],
    });
  } catch (error) {
    await safeRollback(client);
    console.error('Error requesting material:', error);
    return res.status(500).json({ success: false, message: 'Error al solicitar material' });
  } finally {
    client.release();
  }
};

exports.aprobarMaterial = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const requestedApproval = positiveInt(req.body?.cantidad);

    if (!isUuid(id)) {
      return res.status(400).json({ success: false, message: 'Material no válido' });
    }

    await client.query('BEGIN');
    const material = await getMaterialForUpdate(client, id);

    if (!material) {
      await safeRollback(client);
      return res.status(404).json({ success: false, message: 'Solicitud de material no encontrada' });
    }

    if (material.estado !== 'solicitado') {
      await safeRollback(client);
      return res.status(409).json({ success: false, message: `El material está en estado ${material.estado}` });
    }

    const approved = requestedApproval || Number(material.cantidad_solicitada || 0);
    if (approved < 1 || approved > Number(material.cantidad_solicitada || 0)) {
      await safeRollback(client);
      return res.status(400).json({ success: false, message: 'La cantidad aprobada no es válida' });
    }

    const result = await client.query(
      `UPDATE servicio_materiales
       SET estado = 'aprobado',
           cantidad_aprobada = $1,
           aprobado_por = $2,
           aprobado_at = NOW(),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [approved, req.user?.id || null, id]
    );

    await addServiceEvent(client, material.service_order_id, 'material_approved', req.user?.id, {
      material_id: id,
      product_id: material.product_id,
      quantity: approved,
    });

    await client.query('COMMIT');
    return res.json({ success: true, message: 'Material aprobado', data: result.rows[0] });
  } catch (error) {
    await safeRollback(client);
    console.error('Error approving material:', error);
    return res.status(500).json({ success: false, message: 'Error al aprobar material' });
  } finally {
    client.release();
  }
};

exports.rechazarMaterial = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const reason = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';

    if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Material no válido' });
    if (reason.length < 3) return res.status(400).json({ success: false, message: 'Indica el motivo del rechazo' });

    await client.query('BEGIN');
    const material = await getMaterialForUpdate(client, id);

    if (!material) {
      await safeRollback(client);
      return res.status(404).json({ success: false, message: 'Solicitud de material no encontrada' });
    }

    if (!['solicitado', 'aprobado'].includes(material.estado)) {
      await safeRollback(client);
      return res.status(409).json({ success: false, message: `No se puede rechazar un material en estado ${material.estado}` });
    }

    const result = await client.query(
      `UPDATE servicio_materiales
       SET estado = 'rechazado',
           motivo_rechazo = $1,
           aprobado_por = $2,
           aprobado_at = NOW(),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [reason, req.user?.id || null, id]
    );

    await addServiceEvent(client, material.service_order_id, 'material_rejected', req.user?.id, {
      material_id: id,
      product_id: material.product_id,
      reason,
    });

    await client.query('COMMIT');
    return res.json({ success: true, message: 'Solicitud de material rechazada', data: result.rows[0] });
  } catch (error) {
    await safeRollback(client);
    console.error('Error rejecting material:', error);
    return res.status(500).json({ success: false, message: 'Error al rechazar material' });
  } finally {
    client.release();
  }
};

exports.entregarMateriales = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const requestedQty = positiveInt(req.body?.cantidad);

    if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Material no válido' });

    await client.query('BEGIN');
    const material = await getMaterialForUpdate(client, id);

    if (!material) {
      await safeRollback(client);
      return res.status(404).json({ success: false, message: 'Solicitud de material no encontrada' });
    }

    if (!['aprobado', 'entrega_parcial'].includes(material.estado)) {
      await safeRollback(client);
      return res.status(409).json({ success: false, message: 'El material debe estar aprobado antes de entregarse' });
    }

    const approved = Number(material.cantidad_aprobada || material.cantidad_solicitada || 0);
    const delivered = Number(material.cantidad_entregada || 0);
    const pending = Math.max(0, approved - delivered);
    const qty = requestedQty || pending;

    if (!qty || qty > pending) {
      await safeRollback(client);
      return res.status(400).json({ success: false, message: `Cantidad inválida. Pendiente por entregar: ${pending}` });
    }

    const productResult = await client.query(
      `SELECT id, codigo, nombre, stock_actual
       FROM products
       WHERE id = $1
       FOR UPDATE`,
      [material.product_id]
    );
    const product = productResult.rows[0];

    if (!product) {
      await safeRollback(client);
      return res.status(404).json({ success: false, message: 'Producto de inventario no encontrado' });
    }

    if (Number(product.stock_actual || 0) < qty) {
      await safeRollback(client);
      return res.status(409).json({
        success: false,
        code: 'INSUFFICIENT_STOCK',
        message: `Stock insuficiente. Disponible: ${Number(product.stock_actual || 0)}`,
      });
    }

    await client.query(
      `UPDATE products
       SET stock_actual = stock_actual - $1,
           "updatedAt" = NOW()
       WHERE id = $2`,
      [qty, material.product_id]
    );

    const newDelivered = delivered + qty;
    const nextState = newDelivered >= approved ? 'entregado' : 'entrega_parcial';

    const result = await client.query(
      `UPDATE servicio_materiales
       SET cantidad_entregada = $1,
           estado = $2,
           entregado_por = $3,
           entregado_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [newDelivered, nextState, req.user?.id || null, id]
    );

    await client.query(
      `INSERT INTO inventory_movements (
         id, product_id, tipo_movimiento, origen_tipo,
         origen_id, cantidad, usuario_id, observaciones,
         fecha, "createdAt", "updatedAt"
       )
       VALUES ($1,$2,'salida','servicio',$3,$4,$5,$6,NOW(),NOW(),NOW())`,
      [
        randomUUID(),
        material.product_id,
        material.service_order_id,
        qty,
        req.user?.id || null,
        `Entrega de material para orden de servicio (${id})`,
      ]
    );

    await addServiceEvent(client, material.service_order_id, 'material_delivered', req.user?.id, {
      material_id: id,
      product_id: material.product_id,
      product_code: product.codigo,
      product_name: product.nombre,
      quantity: qty,
      delivered_total: newDelivered,
    });

    await client.query('COMMIT');
    return res.json({ success: true, message: 'Material entregado y descontado del inventario', data: result.rows[0] });
  } catch (error) {
    await safeRollback(client);
    console.error('Error delivering material:', error);
    return res.status(500).json({ success: false, message: 'Error al entregar material' });
  } finally {
    client.release();
  }
};

exports.reportarUso = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const qty = positiveInt(req.body?.cantidad, 1);

    if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Material no válido' });

    await client.query('BEGIN');
    const material = await getMaterialForUpdate(client, id);

    if (!material) {
      await safeRollback(client);
      return res.status(404).json({ success: false, message: 'Material no encontrado' });
    }

    if (!['entregado', 'en_uso'].includes(material.estado)) {
      await safeRollback(client);
      return res.status(409).json({ success: false, message: 'El material debe haber sido entregado antes de registrar su uso' });
    }

    const delivered = Number(material.cantidad_entregada || 0);
    const used = Number(material.cantidad_usada || 0);
    const returned = Number(material.cantidad_devuelta || 0);
    const available = delivered - used - returned;

    if (qty > available) {
      await safeRollback(client);
      return res.status(400).json({ success: false, message: `Solo hay ${available} unidad(es) entregadas sin consumir` });
    }

    const newUsed = used + qty;
    const remaining = delivered - newUsed - returned;
    const nextState = remaining === 0 ? 'consumido' : 'en_uso';

    const result = await client.query(
      `UPDATE servicio_materiales
       SET cantidad_usada = $1,
           estado = $2,
           usado_por = $3,
           usado_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [newUsed, nextState, req.user?.id || null, id]
    );

    await addServiceEvent(client, material.service_order_id, 'material_consumed', req.user?.id, {
      material_id: id,
      product_id: material.product_id,
      quantity: qty,
      used_total: newUsed,
    });

    await client.query('COMMIT');
    return res.json({ success: true, message: 'Uso del material registrado', data: result.rows[0] });
  } catch (error) {
    await safeRollback(client);
    console.error('Error reporting material use:', error);
    return res.status(500).json({ success: false, message: 'Error al registrar uso del material' });
  } finally {
    client.release();
  }
};

exports.devolverMaterial = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const qty = positiveInt(req.body?.cantidad, 1);

    if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Material no válido' });

    await client.query('BEGIN');
    const material = await getMaterialForUpdate(client, id);

    if (!material) {
      await safeRollback(client);
      return res.status(404).json({ success: false, message: 'Material no encontrado' });
    }

    if (!['entregado', 'en_uso'].includes(material.estado)) {
      await safeRollback(client);
      return res.status(409).json({ success: false, message: 'Solo puede devolverse material previamente entregado' });
    }

    const delivered = Number(material.cantidad_entregada || 0);
    const used = Number(material.cantidad_usada || 0);
    const returned = Number(material.cantidad_devuelta || 0);
    const available = delivered - used - returned;

    if (qty > available) {
      await safeRollback(client);
      return res.status(400).json({ success: false, message: `Solo hay ${available} unidad(es) disponibles para devolución` });
    }

    await client.query(
      `UPDATE products
       SET stock_actual = stock_actual + $1,
           "updatedAt" = NOW()
       WHERE id = $2`,
      [qty, material.product_id]
    );

    const newReturned = returned + qty;
    const remaining = delivered - used - newReturned;
    let nextState = 'en_uso';
    if (remaining === 0) nextState = used > 0 ? 'consumido' : 'devuelto';

    const result = await client.query(
      `UPDATE servicio_materiales
       SET cantidad_devuelta = $1,
           estado = $2,
           devuelto_por = $3,
           devuelto_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [newReturned, nextState, req.user?.id || null, id]
    );

    await client.query(
      `INSERT INTO inventory_movements (
         id, product_id, tipo_movimiento, origen_tipo,
         origen_id, cantidad, usuario_id, observaciones,
         fecha, "createdAt", "updatedAt"
       )
       VALUES ($1,$2,'entrada','servicio',$3,$4,$5,$6,NOW(),NOW(),NOW())`,
      [
        randomUUID(),
        material.product_id,
        material.service_order_id,
        qty,
        req.user?.id || null,
        `Devolución de material no consumido (${id})`,
      ]
    );

    await addServiceEvent(client, material.service_order_id, 'material_returned', req.user?.id, {
      material_id: id,
      product_id: material.product_id,
      quantity: qty,
      returned_total: newReturned,
    });

    await client.query('COMMIT');
    return res.json({ success: true, message: 'Material devuelto al inventario', data: result.rows[0] });
  } catch (error) {
    await safeRollback(client);
    console.error('Error returning material:', error);
    return res.status(500).json({ success: false, message: 'Error al devolver material' });
  } finally {
    client.release();
  }
};

exports.getConsumoTecnico = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         sm.solicitado_por AS tecnico_id,
         NULLIF(TRIM(CONCAT_WS(' ', u.nombre1, u.nombre2, u.apellidos)), '') AS tecnico_nombre,
         sm.product_id,
         p.codigo AS producto_codigo,
         p.nombre AS producto_nombre,
         SUM(COALESCE(sm.cantidad_usada,0))::int AS cantidad_usada
       FROM servicio_materiales sm
       LEFT JOIN usuarios u ON u.id = sm.solicitado_por
       LEFT JOIN products p ON p.id = sm.product_id
       WHERE COALESCE(sm.cantidad_usada,0) > 0
       GROUP BY sm.solicitado_por, u.nombre1, u.nombre2, u.apellidos,
                sm.product_id, p.codigo, p.nombre
       ORDER BY cantidad_usada DESC, tecnico_nombre ASC`
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error loading technician material consumption:', error);
    return res.status(500).json({ success: false, message: 'Error al consultar consumo de materiales' });
  }
};
