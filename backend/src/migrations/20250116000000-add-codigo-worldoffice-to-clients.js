'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Verificar si la tabla existe antes de modificarla
    const tables = await queryInterface.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clientes'"
    );
    
    if (tables[0].length > 0) {
      // La tabla existe, proceder con la modificación
      const tableInfo = await queryInterface.describeTable('clientes');
      
      if (!tableInfo.codigo_worldoffice) {
        await queryInterface.addColumn('clientes', 'codigo_worldoffice', {
          type: Sequelize.STRING(50),
          allowNull: true,
          comment: 'Código del cliente en World Office',
        });
      }
      
      if (!tableInfo.id_externo) {
        await queryInterface.addColumn('clientes', 'id_externo', {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: 'ID del cliente en World Office',
        });
      }
      
      if (!tableInfo.sincronizado_worldoffice) {
        await queryInterface.addColumn('clientes', 'sincronizado_worldoffice', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          comment: 'Indica si el cliente viene de World Office',
        });
      }
      
      if (!tableInfo.fecha_sincronizacion) {
        await queryInterface.addColumn('clientes', 'fecha_sincronizacion', {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Fecha de última sincronización',
        });
      }
    } else {
      console.log('La tabla clientes no existe, saltando migración...');
    }
  },

  down: async (queryInterface) => {
    const tables = await queryInterface.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clientes'"
    );
    
    if (tables[0].length > 0) {
      const tableInfo = await queryInterface.describeTable('clientes');
      
      if (tableInfo.codigo_worldoffice) {
        await queryInterface.removeColumn('clientes', 'codigo_worldoffice');
      }
      if (tableInfo.id_externo) {
        await queryInterface.removeColumn('clientes', 'id_externo');
      }
      if (tableInfo.sincronizado_worldoffice) {
        await queryInterface.removeColumn('clientes', 'sincronizado_worldoffice');
      }
      if (tableInfo.fecha_sincronizacion) {
        await queryInterface.removeColumn('clientes', 'fecha_sincronizacion');
      }
    }
  }
};