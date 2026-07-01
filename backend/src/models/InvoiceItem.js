'use strict';
module.exports = (sequelize, DataTypes) => {
  const InvoiceItem = sequelize.define('InvoiceItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    invoice_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    product_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    descripcion: {
      type: DataTypes.STRING(250),
      allowNull: false,
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    precio_unitario: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    porcentaje_iva: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 19,
    },
    valor_iva: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    tableName: 'invoice_items',
    timestamps: true,
  });

  InvoiceItem.associate = (models) => {
    InvoiceItem.belongsTo(models.Invoice, { foreignKey: 'invoice_id' });
    InvoiceItem.belongsTo(models.Product, { foreignKey: 'product_id' });
  };

  return InvoiceItem;
};