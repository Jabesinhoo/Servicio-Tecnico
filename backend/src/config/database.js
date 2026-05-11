const { Sequelize } = require("sequelize");

// 🔎 DEBUG DURO
console.log("ENV CHECK →", {
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME,
  TYPE_PASSWORD: typeof process.env.DB_PASSWORD,
});

// ⚠️ FUERZA string (blindaje)
const sequelize = new Sequelize(
  String(process.env.DB_NAME),
  String(process.env.DB_USER),
  String(process.env.DB_PASSWORD),
  {
    host: String(process.env.DB_HOST),
    port: Number(process.env.DB_PORT),
    dialect: "postgres",
    logging: false,
  }
);

module.exports = sequelize;
