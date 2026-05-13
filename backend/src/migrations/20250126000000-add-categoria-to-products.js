// backend/src/migrations/20250126000000-add-categoria-to-products.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si la columna ya existe
    const [result] = await queryInterface.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'categoria_id'
    `);
    
    if (result.length === 0) {
      await queryInterface.addColumn('products', 'categoria_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'categorias_productos',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
      console.log('✅ Columna categoria_id agregada a products');
    } else {
      console.log('⏭️ Columna categoria_id ya existe');
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('products', 'categoria_id');
  }
};