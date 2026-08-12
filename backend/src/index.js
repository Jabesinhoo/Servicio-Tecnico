// backend/src/index.js
'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const sequelize = require('./config/database');
const {
  syncPermissionsToDatabase,
} = require('./services/permissionsRegistry');
// ============================================================
// RUTAS
// ============================================================

const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const catalogRoutes = require('./routes/catalog.routes');
const serviceOrdersRoutes = require('./routes/service-orders.routes');
const clientRoutes = require('./routes/client.routes');
const userRoutes = require('./routes/user.routes');
const tipoServicioRoutes = require('./routes/tipo-servicio.routes');
const productRoutes = require('./routes/product.routes');
const categoriaProductoRoutes = require('./routes/categoria-producto.routes');
const reportRoutes = require('./routes/report.routes');
const agendaRoutes = require('./routes/agenda.routes');
const materialRoutes = require('./routes/material.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const productoSerialRoutes = require('./routes/producto-serial.routes');
const alquilerRoutes = require('./routes/alquiler.routes');
const syncRoutes = require('./routes/sync.routes');
const notificacionesRoutes = require('./routes/notificaciones.routes');
const iaRoutes = require('./routes/ia.routes');
const rolesRoutes = require('./routes/roles');

const app = express();

// El backend está detrás de Nginx.
app.set('trust proxy', 1);

// ============================================================
// SEGURIDAD
// ============================================================

app.use(helmet());

// ============================================================
// CORS
// ============================================================

const allowedOrigins = (
  process.env.CORS_ORIGIN ||
  'http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Permitir peticiones sin encabezado Origin:
    // curl, healthchecks y comunicación interna.
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`Origen rechazado por CORS: ${origin}`);

    const error = new Error(
      `Origen no permitido por CORS: ${origin}`
    );

    error.status = 403;

    return callback(error);
  },

  credentials: true,

  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
  ],

  exposedHeaders: [
    'Content-Length',
  ],

  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// ============================================================
// PARSEO DE SOLICITUDES
// ============================================================

app.use(
  express.json({
    limit: '10mb',
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  })
);

// ============================================================
// RATE LIMIT
// ============================================================

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message:
      'Demasiados intentos. Intenta nuevamente más tarde.',
  },
});

app.use('/api/auth', authLimiter);

// ============================================================
// HEALTHCHECK
// ============================================================

app.get('/api/health', (req, res) => {
  res.status(200).json({
    ok: true,
    message: 'API firme',
    environment:
      process.env.NODE_ENV || 'development',
  });
});

// ============================================================
// RUTAS
// ============================================================

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use('/api', catalogRoutes);
app.use('/api', serviceOrdersRoutes);
app.use('/api', clientRoutes);
app.use('/api', userRoutes);
app.use('/api', tipoServicioRoutes);
app.use('/api', productRoutes);
app.use('/api', categoriaProductoRoutes);
app.use('/api', reportRoutes);
app.use('/api', agendaRoutes);
app.use('/api', materialRoutes);
app.use('/api', invoiceRoutes);
app.use('/api', productoSerialRoutes);
app.use('/api', alquilerRoutes);
app.use('/api', notificacionesRoutes);
app.use('/api', iaRoutes);

// Rutas con prefijo propio
app.use('/api/roles', rolesRoutes);
app.use('/api/sync', syncRoutes);

// ============================================================
// RUTA PRINCIPAL
// ============================================================

app.get('/', (req, res) => {
  res.status(200).send('Backend firme');
});

// ============================================================
// RUTA NO ENCONTRADA
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message:
      `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
});

// ============================================================
// MANEJADOR GLOBAL DE ERRORES
// ============================================================

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  console.error('Error global del backend:', {
    message: error.message,
    method: req.method,
    url: req.originalUrl,
    stack:
      process.env.NODE_ENV === 'development'
        ? error.stack
        : undefined,
  });

  const status =
    Number.isInteger(error.status)
      ? error.status
      : 500;

  res.status(status).json({
    success: false,
    message:
      status === 500
        ? 'Error interno del servidor'
        : error.message,
  });
});

// ============================================================
// CONEXIÓN A POSTGRESQL
// ============================================================

sequelize
  .authenticate()
  .then(async () => {
    console.log('PostgreSQL conectado');

    try {
      await syncPermissionsToDatabase();
    } catch (error) {
      console.error(
        '❌ Error sincronizando permisos:',
        error
      );
    }
  })
  .catch((error) => {
    console.error(
      'Error de conexión a PostgreSQL:',
      error
    );
  });

// ============================================================
// SCHEDULER
// ============================================================

if (process.env.NODE_ENV !== 'test') {
  try {
    require('./scheduler');

    console.log(
      'Scheduler de tareas programadas iniciado'
    );
  } catch (error) {
    console.error(
      'Error al iniciar scheduler:',
      error.message
    );
  }
}

// ============================================================
// INICIAR SERVIDOR
// ============================================================

const PORT = Number(
  process.env.PORT || 3001
);

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `Backend iniciado en el puerto ${PORT}`
  );

  console.log(
    `Orígenes CORS permitidos: ${allowedOrigins.join(', ')}`
  );
});