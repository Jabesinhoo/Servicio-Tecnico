// backend/src/routes/user.routes.js
const express = require('express');
const router = express.Router();
const { authRequired } = require('../middlewares/auth.middleware');
const { allowRoles } = require('../middlewares/role.middleware');
const userController = require('../controllers/user.controller');

router.use(authRequired);

// Rutas para técnicos y admin
router.get('/users', allowRoles('admin'), userController.getAll);
router.get('/users/role', userController.getByRole);
router.get('/users/:id', userController.getById);

// Rutas solo admin
router.post('/users', allowRoles('admin'), userController.create);
router.put('/users/:id', allowRoles('admin'), userController.update);
router.delete('/users/:id', allowRoles('admin'), userController.delete);
router.get('/users/role', userController.getByRole);

module.exports = router;