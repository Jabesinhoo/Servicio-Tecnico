// backend/src/migrations/20250125000000-add-imagenes-to-products.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si la columna ya existe
    const [result] = await queryInterface.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'imagenes'
    `);
    
    if (result.length === 0) {
      await queryInterface.addColumn('products', 'imagenes', {
        type: Sequelize.JSONB,
        defaultValue: [],
      });
      console.log('✅ Columna imagenes agregada a products');
    } else {
      console.log('⏭️ Columna imagenes ya existe');
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('products', 'imagenes');
  }
};