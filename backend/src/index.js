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

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "10kb" }));

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

app.get("/", (req, res) => {
  res.send("Backend firme");
});

sequelize
  .authenticate()
  .then(() => console.log("PostgreSQL conectado"))
  .catch((err) => console.error("Error conexión DB:", err));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`Backend en http://localhost:${PORT}`)
);