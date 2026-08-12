'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Primero verificar si la columna ya existe
    const tableInfo = await queryInterface.describeTable('usuarios');
    
    if (!tableInfo.role_id) {
      await queryInterface.addColumn('usuarios', 'role_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'roles',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('usuarios', 'role_id');
  }
};