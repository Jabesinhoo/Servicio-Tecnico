const { Sequelize } = require("sequelize");


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
