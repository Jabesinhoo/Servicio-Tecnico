"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("sales_order_items", "sku", {
      type: Sequelize.STRING(60),
      allowNull: false,
    });

    await queryInterface.addColumn("sales_order_items", "nombre_producto", {
      type: Sequelize.STRING(180),
      allowNull: false,
    });

    await queryInterface.addColumn("sales_order_items", "stock_disponible", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // Si tenías product_id, puedes dejarlo nullable o borrarlo luego
    // await queryInterface.removeColumn("sales_order_items", "product_id");
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("sales_order_items", "sku");
    await queryInterface.removeColumn("sales_order_items", "nombre_producto");
    await queryInterface.removeColumn("sales_order_items", "stock_disponible");
  },
};
