// backend/src/migrations/20250122000000-ensure-client-columns.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar y agregar columnas faltantes
    const [existingColumns] = await queryInterface.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clients'
    `);
    
    const existingColumnNames = existingColumns.map(c => c.column_name);
    
    const columnsToAdd = [
      { name: 'tipo_persona', def: { type: Sequelize.ENUM('natural', 'juridica'), allowNull: false, defaultValue: 'natural' } },
      { name: 'primer_nombre', def: { type: Sequelize.STRING(60), allowNull: true } },
      { name: 'segundo_nombre', def: { type: Sequelize.STRING(60), allowNull: true } },
      { name: 'primer_apellido', def: { type: Sequelize.STRING(60), allowNull: true } },
      { name: 'segundo_apellido', def: { type: Sequelize.STRING(60), allowNull: true } },
      { name: 'tipo_documento', def: { type: Sequelize.ENUM('cedula', 'nit', 'rut', 'pasaporte', 'cedula_extranjeria'), allowNull: false, defaultValue: 'cedula' } },
      { name: 'digito_verificacion', def: { type: Sequelize.STRING(2), allowNull: true } },
      { name: 'telefono_2', def: { type: Sequelize.STRING(30), allowNull: true } },
      { name: 'email_2', def: { type: Sequelize.STRING(150), allowNull: true } },
      { name: 'direccion_2', def: { type: Sequelize.STRING(250), allowNull: true } },
      { name: 'codigo_postal', def: { type: Sequelize.STRING(20), allowNull: true } },
      { name: 'responsable_iva', def: { type: Sequelize.BOOLEAN, defaultValue: true } },
      { name: 'autoretenedor', def: { type: Sequelize.BOOLEAN, defaultValue: false } },
      { name: 'gran_contribuyente', def: { type: Sequelize.BOOLEAN, defaultValue: false } },
      { name: 'clasificacion_dian', def: { type: Sequelize.STRING(50), allowNull: true } },
      { name: 'actividad_economica', def: { type: Sequelize.STRING(100), allowNull: true } },
      { name: 'codigo_ciiu', def: { type: Sequelize.STRING(20), allowNull: true } },
      { name: 'plazo_credito', def: { type: Sequelize.INTEGER, defaultValue: 0 } },
      { name: 'cupo_credito', def: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 } },
      { name: 'fecha_aniversario', def: { type: Sequelize.DATE, allowNull: true } },
      { name: 'lista_precios', def: { type: Sequelize.STRING(50), allowNull: true } },
      { name: 'forma_pago', def: { type: Sequelize.STRING(50), allowNull: true } },
      { name: 'codigo_worldoffice', def: { type: Sequelize.STRING(50), allowNull: true } },
      { name: 'observacion', def: { type: Sequelize.TEXT, allowNull: true } },
      { name: 'activo', def: { type: Sequelize.BOOLEAN, defaultValue: true } },
    ];
    
    for (const column of columnsToAdd) {
      if (!existingColumnNames.includes(column.name)) {
        await queryInterface.addColumn('clients', column.name, column.def);
        console.log(`✅ Columna ${column.name} agregada`);
      } else {
        console.log(`⏭️ Columna ${column.name} ya existe`);
      }
    }
    
    // Renombrar nombre_razon_social a razon_social si existe
    if (existingColumnNames.includes('nombre_razon_social') && !existingColumnNames.includes('razon_social')) {
      await queryInterface.renameColumn('clients', 'nombre_razon_social', 'razon_social');
      console.log('✅ Columna nombre_razon_social renombrada a razon_social');
    }
  },

  async down(queryInterface, Sequelize) {
    // No implementamos down para no perder datos
    console.log('No se implementa rollback para no perder datos');
  }
};