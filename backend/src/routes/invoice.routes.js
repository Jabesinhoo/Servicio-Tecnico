const express = require('express');
const router = express.Router();
const { authRequired } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');
const invoiceController = require('../controllers/invoice.controller');

router.use(authRequired);

// Crear factura desde OS
router.post(
  '/invoices/service-order/:service_order_id',
  allowRoles('admin', 'facturacion'),
  invoiceController.createFromServiceOrder
);

// Listar facturas
router.get(
  '/invoices',
  allowRoles('admin', 'facturacion'),
  invoiceController.getAll
);

router.get('/invoices/linked-services/excel', allowRoles('admin', 'facturacion'), invoiceController.exportLinkedServices);
router.get('/invoices/linked-services', allowRoles('admin', 'facturacion'), invoiceController.getLinkedServices);

// Obtener factura por ID
router.get(
  '/invoices/:id',
  allowRoles('admin', 'facturacion'),
  invoiceController.getById
);

// Anular factura
router.patch(
  '/invoices/:id/cancel',
  allowRoles('admin', 'facturacion'),
  invoiceController.cancel
);

// Marcar como pagada
router.patch(
  '/invoices/:id/paid',
  allowRoles('admin', 'facturacion'),
  invoiceController.markAsPaid
);

module.exports = router;