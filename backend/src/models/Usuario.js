'use strict';
module.exports = (sequelize, DataTypes) => {
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

  Usuario.associate = (models) => {
    // Relaciones si las hay
  };

  return Usuario;
};