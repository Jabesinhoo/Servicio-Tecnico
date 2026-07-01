'use strict';
module.exports = (sequelize, DataTypes) => {
  const Invoice = sequelize.define('Invoice', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    numero_factura: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    prefijo: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    fecha_emision: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    cliente_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    service_order_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    sales_order_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    tipo_documento: {
      type: DataTypes.ENUM('factura', 'nota_credito', 'nota_debito'),
      allowNull: false,
      defaultValue: 'factura',
    },
    estado: {
      type: DataTypes.ENUM('borrador', 'emitida', 'pagada', 'anulada'),
      allowNull: false,
      defaultValue: 'emitida',
    },
    total_base: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total_iva: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total_retencion: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total_otros_impuestos: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total_general: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    observaciones: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    resolution_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  }, {
    tableName: 'invoices',
    timestamps: true,
  });

  Invoice.associate = (models) => {
    Invoice.belongsTo(models.Client, { foreignKey: 'cliente_id' });
    Invoice.belongsTo(models.ServiceOrder, { foreignKey: 'service_order_id' });
    Invoice.belongsTo(models.SalesOrder, { foreignKey: 'sales_order_id' });
    Invoice.belongsTo(models.Resolution, { foreignKey: 'resolution_id' });
    Invoice.hasMany(models.InvoiceItem, { foreignKey: 'invoice_id' });
  };

  return Invoice;
};