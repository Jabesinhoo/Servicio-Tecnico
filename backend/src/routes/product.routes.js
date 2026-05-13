// backend/src/routes/product.routes.js
const express = require('express');
const router = express.Router();
const { authRequired } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');
const productController = require('../controllers/product.controller');

router.use(authRequired);

// Rutas públicas (para todos los roles autenticados)
router.get('/products', productController.getAll);
router.get('/products/low-stock', productController.getLowStock);
router.get('/products/:id', productController.getById);

// Rutas solo para admin e inventario
router.post('/products', allowRoles('admin', 'inventario'), productController.create);
router.put('/products/:id', allowRoles('admin', 'inventario'), productController.update);
router.delete('/products/:id', allowRoles('admin', 'inventario'), productController.delete);

module.exports = router;