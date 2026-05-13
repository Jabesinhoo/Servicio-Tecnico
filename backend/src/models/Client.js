// backend/src/models/Client.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Client = sequelize.define('Client', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tipo_persona: {
    type: DataTypes.ENUM('natural', 'juridica'),
    allowNull: false,
    defaultValue: 'natural'
  },
  // Para persona natural
  primer_nombre: {
    type: DataTypes.STRING(60),
    allowNull: true
  },
  segundo_nombre: {
    type: DataTypes.STRING(60),
    allowNull: true
  },
  primer_apellido: {
    type: DataTypes.STRING(60),
    allowNull: true
  },
  segundo_apellido: {
    type: DataTypes.STRING(60),
    allowNull: true
  },
  // Para persona jurídica
  razon_social: {
    type: DataTypes.STRING(180),
    allowNull: true
  },
  // Documentos
  tipo_documento: {
    type: DataTypes.ENUM('cedula', 'nit', 'rut', 'pasaporte', 'cedula_extranjeria'),
    allowNull: false,
    defaultValue: 'cedula'
  },
  documento: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true
  },
  digito_verificacion: {
    type: DataTypes.STRING(2),
    allowNull: true
  },
  // Contacto
  telefono: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  telefono_2: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  email_2: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  // Dirección
  direccion: {
    type: DataTypes.STRING(250),
    allowNull: true
  },
  direccion_2: {
    type: DataTypes.STRING(250),
    allowNull: true
  },
  ciudad: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  codigo_postal: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  // Configuración fiscal
  responsable_iva: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  autoretenedor: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  gran_contribuyente: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  clasificacion_dian: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  actividad_economica: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  codigo_ciiu: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  // Crédito
  plazo_credito: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  cupo_credito: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  fecha_aniversario: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Configuración comercial
  lista_precios: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  forma_pago: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  // Extras
  codigo_worldoffice: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  observacion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  notas: {
    type: DataTypes.TEXT,
    allowNull: true
  },
}, {
  tableName: 'clients',
  timestamps: true,
});

// Método para obtener el nombre completo
Client.prototype.getNombreCompleto = function() {
  if (this.tipo_persona === 'juridica') {
    return this.razon_social;
  }
  return `${this.primer_nombre || ''} ${this.segundo_nombre || ''} ${this.primer_apellido || ''} ${this.segundo_apellido || ''}`.trim();
};

// Método para obtener el documento formateado
Client.prototype.getDocumentoFormateado = function() {
  if (this.tipo_documento === 'nit') {
    return `${this.documento}-${this.digito_verificacion || '0'}`;
  }
  return this.documento;
};

module.exports = Client;