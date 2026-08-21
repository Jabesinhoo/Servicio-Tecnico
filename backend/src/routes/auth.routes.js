// backend/src/routes/auth.routes.js
'use strict';

const express = require('express');
const router = express.Router();

const {
  register,
  login,
} = require('../controllers/auth.controller');

const loginAudit = require('../middlewares/login-audit.middleware');

// Se conserva la ruta existente de registro para no alterar en este
// bloque el comportamiento actual del proyecto.
router.post('/register', register);

// El middleware registra el resultado del acceso y actualiza last_login
// sin almacenar nunca la contraseña.
router.post(
  '/login',
  loginAudit,
  login
);

module.exports = router;
