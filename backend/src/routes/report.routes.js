// backend/src/routes/report.routes.js
const express = require('express');
const router = express.Router();
const { authRequired } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');
const reportController = require('../controllers/report.controller');

router.use(authRequired);

// Reportes de Ventas
router.get('/reportes/ventas/diarias', allowRoles('admin', 'ventas'), reportController.getVentasDiarias);
router.get('/reportes/ventas/mensuales', allowRoles('admin', 'ventas'), reportController.getVentasMensuales);
router.get('/reportes/ventas/productos-mas-vendidos', allowRoles('admin', 'ventas', 'inventario'), reportController.getProductosMasVendidos);
router.get('/reportes/ventas/por-vendedor', allowRoles('admin'), reportController.getVentasPorVendedor);

// Reportes de Servicios
router.get('/reportes/servicios/por-estado', allowRoles('admin', 'tecnico'), reportController.getServiciosPorEstado);
router.get('/reportes/servicios/por-tecnico', allowRoles('admin'), reportController.getServiciosPorTecnico);
router.get('/reportes/servicios/tiempos', allowRoles('admin'), reportController.getTiemposServicio);
router.get('/reportes/servicios/repuestos-usados', allowRoles('admin', 'inventario'), reportController.getRepuestosMasUsados);

// Reportes de Inventario
router.get('/reportes/inventario/stock-actual', allowRoles('admin', 'inventario'), reportController.getStockActual);
router.get('/reportes/inventario/stock-bajo', allowRoles('admin', 'inventario'), reportController.getStockBajo);
router.get('/reportes/inventario/movimientos', allowRoles('admin', 'inventario'), reportController.getMovimientosStock);
router.get('/reportes/inventario/valor', allowRoles('admin', 'inventario'), reportController.getValorInventario);

// Reportes de Clientes
router.get('/reportes/clientes/frecuentes', allowRoles('admin', 'ventas'), reportController.getClientesFrecuentes);

// Reportes Financieros
router.get('/reportes/financieros/ingresos-gastos', allowRoles('admin'), reportController.getIngresosGastos);

// Reportes de Rendimiento
router.get('/reportes/rendimiento/tecnicos', allowRoles('admin'), reportController.getRendimientoTecnicos);

module.exports = router;