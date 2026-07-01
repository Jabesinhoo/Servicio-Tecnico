const db = require('../models');
const { Op } = require('sequelize');

// Listar facturas
exports.getAll = async (req, res) => {
  try {
    console.log('📋 GET /api/invoices - Iniciando...');
    
    const { estado, fecha_inicio, fecha_fin } = req.query;

    const where = {};
    if (estado) where.estado = estado;
    
    if (fecha_inicio && fecha_fin) {
      where.fecha_emision = {
        [Op.between]: [new Date(fecha_inicio), new Date(fecha_fin)]
      };
    } else if (fecha_inicio) {
      where.fecha_emision = { [Op.gte]: new Date(fecha_inicio) };
    } else if (fecha_fin) {
      where.fecha_emision = { [Op.lte]: new Date(fecha_fin) };
    }

    console.log('📋 Filtros:', where);

    const Invoice = db.Invoice;
    if (!Invoice) {
      console.error('❌ Modelo Invoice no encontrado');
      return res.status(500).json({ message: 'Modelo Invoice no encontrado' });
    }

    const invoices = await Invoice.findAll({
      where,
      order: [['fecha_emision', 'DESC']]
    });

    console.log(`✅ Encontradas ${invoices.length} facturas`);
    res.json(invoices);
  } catch (error) {
    console.error('❌ Error en getAll:', error.message);
    res.status(500).json({ 
      message: 'Error al obtener las facturas',
      error: error.message
    });
  }
};

// Crear factura desde una OS
exports.createFromServiceOrder = async (req, res) => {
  try {
    const { service_order_id } = req.params;
    const { observaciones } = req.body;

    console.log(`📝 Creando factura para OS: ${service_order_id}`);

    const { Invoice, Resolution, ServiceOrder, Client } = db;

    const serviceOrder = await ServiceOrder.findByPk(service_order_id, {
      include: [{ model: Client, as: 'Client' }]
    });

    if (!serviceOrder) {
      return res.status(404).json({ message: 'Orden de servicio no encontrada' });
    }

    if (serviceOrder.facturada) {
      return res.status(400).json({ message: 'Esta OS ya fue facturada' });
    }

    if (serviceOrder.estado !== 'cerrada') {
      return res.status(400).json({ message: 'La OS debe estar cerrada para facturar' });
    }

    const resolution = await Resolution.findOne({
      where: {
        activo: true,
        fecha_vencimiento: { [Op.gte]: new Date() }
      },
      order: [['fecha_emision', 'DESC']]
    });

    if (!resolution) {
      return res.status(400).json({ message: 'No hay una resolución de facturación activa' });
    }

    if (resolution.siguiente_numero > resolution.rango_fin) {
      return res.status(400).json({ message: 'El rango de la resolución se ha agotado' });
    }

    const numeroActual = resolution.siguiente_numero;
    const numeroFactura = `${resolution.prefijo}-${String(numeroActual).padStart(8, '0')}`;

    const totalBase = parseFloat(serviceOrder.total_general || 0);
    const ivaPorcentaje = 19;
    const totalIva = totalBase * (ivaPorcentaje / 100);
    const totalGeneral = totalBase + totalIva;

    const invoice = await Invoice.create({
      numero_factura: numeroFactura,
      prefijo: resolution.prefijo,
      cliente_id: serviceOrder.client_id,
      service_order_id: serviceOrder.id,
      tipo_documento: 'factura',
      estado: 'emitida',
      total_base: totalBase,
      total_iva: totalIva,
      total_retencion: 0,
      total_otros_impuestos: 0,
      total_general: totalGeneral,
      observaciones: observaciones || null,
      resolution_id: resolution.id,
    });

    await resolution.update({
      siguiente_numero: resolution.siguiente_numero + 1
    });

    await serviceOrder.update({ facturada: true });

    console.log(`✅ Factura creada: ${invoice.numero_factura}`);
    res.status(201).json(invoice);
  } catch (error) {
    console.error('❌ Error al crear factura:', error.message);
    res.status(500).json({ 
      message: 'Error al crear la factura',
      error: error.message
    });
  }
};

// Obtener factura por ID - VERSIÓN SIMPLIFICADA (sin Product)
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const { Invoice, Client, ServiceOrder, Resolution, InvoiceItem } = db;

    const invoice = await Invoice.findByPk(id, {
      include: [
        { model: Client, as: 'Client' },
        { model: ServiceOrder, as: 'ServiceOrder' },
        { model: Resolution, as: 'Resolution' },
        { model: InvoiceItem, as: 'InvoiceItems' }  // Sin Product por ahora
      ]
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Factura no encontrada' });
    }

    res.json(invoice);
  } catch (error) {
    console.error('❌ Error al obtener factura:', error.message);
    res.status(500).json({ 
      message: 'Error al obtener la factura',
      error: error.message
    });
  }
};

// Anular factura
exports.cancel = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const { Invoice } = db;

    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({ message: 'Factura no encontrada' });
    }

    if (invoice.estado === 'anulada') {
      return res.status(400).json({ message: 'La factura ya está anulada' });
    }

    if (invoice.estado === 'pagada') {
      return res.status(400).json({ message: 'No se puede anular una factura pagada' });
    }

    await invoice.update({
      estado: 'anulada',
      observaciones: motivo ? `${invoice.observaciones || ''}\nMotivo anulación: ${motivo}` : invoice.observaciones
    });

    res.json(invoice);
  } catch (error) {
    console.error('❌ Error al anular factura:', error.message);
    res.status(500).json({ 
      message: 'Error al anular la factura',
      error: error.message
    });
  }
};

// Marcar como pagada
exports.markAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { Invoice } = db;

    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({ message: 'Factura no encontrada' });
    }

    if (invoice.estado === 'pagada') {
      return res.status(400).json({ message: 'La factura ya está pagada' });
    }

    if (invoice.estado === 'anulada') {
      return res.status(400).json({ message: 'No se puede pagar una factura anulada' });
    }

    await invoice.update({ estado: 'pagada' });

    res.json(invoice);
  } catch (error) {
    console.error('❌ Error al marcar factura como pagada:', error.message);
    res.status(500).json({ 
      message: 'Error al marcar la factura como pagada',
      error: error.message
    });
  }
};