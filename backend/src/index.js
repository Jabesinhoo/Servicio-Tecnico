const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const authRoutes = require("./routes/auth.routes");

const app = express();

// ✅ Headers de seguridad
app.use(helmet());

// ✅ CORS estricto (solo tu frontend)
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));

// ✅ Límite de body para evitar abuso
app.use(express.json({ limit: "10kb" }));

// ✅ Rate limit básico para endpoints de auth
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 30, // 30 requests por ventana por IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth", authLimiter);

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "API firme" });
});

app.use("/api/auth", authRoutes);
// Agrega esta ruta
app.use('/api/dashboard', require('./routes/dashboard.routes'));

app.get("/", (req, res) => {
  res.send("Backend firme");
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`BACKEND firme en http://localhost:${PORT}`));
