// backend/src/routes/categoria-producto.routes.js
const express = require('express');
const router = express.Router();
const { authRequired } = require('../middlewares/auth.middleware');
const categoriaController = require('../controllers/categoria-producto.controller');

router.use(authRequired);

router.get('/categorias-productos', categoriaController.getAll);
router.post('/categorias-productos', categoriaController.create);
router.put('/categorias-productos/:id', categoriaController.update);
router.delete('/categorias-productos/:id', categoriaController.delete);

module.exports = router;