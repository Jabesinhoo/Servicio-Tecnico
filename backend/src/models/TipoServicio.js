// backend/src/models/TipoServicio.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TipoServicio = sequelize.define('TipoServicio', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  valor_base: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  duracion_estimada: {
    type: DataTypes.INTEGER,
    defaultValue: 60,
  },
  requiere_diagnostico: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  requiere_repuestos: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  requiere_aprobacion: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  categoria: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'tipos_servicio',
  timestamps: true,
});

module.exports = TipoServicio;