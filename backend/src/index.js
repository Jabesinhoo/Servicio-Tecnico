// backend/src/index.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const sequelize = require("./config/database");

const authRoutes = require("./routes/auth.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const catalogRoutes = require("./routes/catalog.routes");
const serviceOrdersRoutes = require("./routes/service-orders.routes");
const clientRoutes = require("./routes/client.routes");
const userRoutes = require("./routes/user.routes");
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

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth", authLimiter);

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "API firme" });
});

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api", catalogRoutes);
app.use("/api", serviceOrdersRoutes);
app.use("/api", clientRoutes);
app.use("/api", userRoutes);
app.use("/api", tipoServicioRoutes);
app.use("/api", productRoutes);
app.use("/api", categoriaProductoRoutes);
app.use("/api", reportRoutes);
app.use("/api", agendaRoutes);
app.use("/api", materialRoutes);
app.use("/api", invoiceRoutes);
app.use("/api", productoSerialRoutes);
app.use("/api", alquilerRoutes);
app.use("/api", notificacionesRoutes);


app.use("/api/sync", syncRoutes);

app.get("/", (req, res) => {
  res.send("Backend firme");
});

sequelize
  .authenticate()
  .then(() => console.log("PostgreSQL conectado"))
  .catch((err) => console.error("Error conexión DB:", err));


if (process.env.NODE_ENV !== 'test') {
  try {
    require('./scheduler');
    console.log("Scheduler de tareas programadas iniciado");
  } catch (error) {
    console.error("Error al iniciar scheduler:", error.message);
  }
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`Backend en http://localhost:${PORT}`)
);