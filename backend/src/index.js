// 🔥 SIEMPRE PRIMERO
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const sequelize = require("./config/database");

const authRoutes = require("./routes/auth.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const catalogRoutes = require("./routes/catalog.routes");

const app = express();

// ✅ Headers de seguridad
app.use(helmet());

// ✅ CORS (frontend Vite)
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// ✅ Body limit
app.use(express.json({ limit: "10kb" }));

// ✅ Rate limit para auth
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth", authLimiter);

// ✅ Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "API firme" });
});

// ✅ Rutas
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api", catalogRoutes);

// ✅ Root
app.get("/", (req, res) => {
  res.send("Backend firme");
});

// ✅ DB connect
sequelize
  .authenticate()
  .then(() => console.log("✅ PostgreSQL conectado (Sequelize)"))
  .catch((err) => console.error("❌ Error conexión DB:", err));

// ✅ Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🚀 BACKEND firme en http://localhost:${PORT}`)
);
