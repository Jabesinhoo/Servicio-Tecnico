const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "API firme" });
});

app.get("/", (req, res) => {
  res.send("Backend firme");
});
 
const PORT =  process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`BACKEND firme en http://localhost:${PORT}`);
});

