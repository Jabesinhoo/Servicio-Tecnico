// scripts/create-admin.js
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { Sequelize, DataTypes } = require("sequelize");

// Configuración de la DB (ajústala según tu conexión)
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    dialect: "postgres",
    logging: false,
  }
);

// Definir modelo Usuario (sin importar el archivo para evitar dependencias)
const Usuario = sequelize.define(
  "Usuario",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nombre1: { type: DataTypes.STRING(60), allowNull: false },
    nombre2: { type: DataTypes.STRING(60), allowNull: true },
    apellidos: { type: DataTypes.STRING(120), allowNull: false },
    usuario: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    cedula: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    celular: { type: DataTypes.STRING(20), allowNull: true },
    password: { type: DataTypes.STRING, allowNull: false },
    rol: {
      type: DataTypes.ENUM("admin", "tecnico", "usuario"),
      allowNull: false,
      defaultValue: "usuario",
    },
    activo: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    tableName: "usuarios",
    timestamps: true,
  }
);

async function createAdmin() {
  try {
    await sequelize.authenticate();
    console.log("✅ Conectado a la base de datos");

    // Datos del admin
    const adminData = {
      nombre1: "Admin",
      nombre2: "",
      apellidos: "Sistema",
      usuario: "admin",
      cedula: "0000000000",
      email: "admin@sistema.com",
      celular: "3000000000",
      password: await bcrypt.hash("Admin123!", 10),
      rol: "admin",
      activo: true,
    };

    // Verificar si ya existe
    const existing = await Usuario.findOne({
      where: {
        [Sequelize.Op.or]: [
          { usuario: adminData.usuario },
          { email: adminData.email },
        ],
      },
    });

    if (existing) {
      console.log("⚠️ Ya existe un usuario admin. Actualizando...");
      await Usuario.update(
        {
          password: adminData.password,
          rol: "admin",
          activo: true,
        },
        { where: { usuario: adminData.usuario } }
      );
      console.log("✅ Admin actualizado correctamente");
    } else {
      await Usuario.create(adminData);
      console.log("✅ Admin creado correctamente");
    }

    console.log("\n📋 Credenciales del Admin:");
    console.log(`   Usuario: ${adminData.usuario}`);
    console.log(`   Email: ${adminData.email}`);
    console.log(`   Contraseña: Admin123!`);
    console.log(`   Rol: admin`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

createAdmin();