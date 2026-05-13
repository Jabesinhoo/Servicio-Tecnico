// backend/src/migrations/20250115000000-update-clients-table.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Agregar nuevas columnas usando queryInterface
    await queryInterface.addColumn('clients', 'tipo_persona', {
      type: Sequelize.ENUM('natural', 'juridica'),
      allowNull: false,
      defaultValue: 'natural'
    }).catch(e => console.log('tipo_persona ya existe'));

    await queryInterface.addColumn('clients', 'primer_nombre', {
      type: Sequelize.STRING(60),
      allowNull: true
    }).catch(e => console.log('primer_nombre ya existe'));

    await queryInterface.addColumn('clients', 'segundo_nombre', {
      type: Sequelize.STRING(60),
      allowNull: true
    }).catch(e => console.log('segundo_nombre ya existe'));

    await queryInterface.addColumn('clients', 'primer_apellido', {
      type: Sequelize.STRING(60),
      allowNull: true
    }).catch(e => console.log('primer_apellido ya existe'));

    await queryInterface.addColumn('clients', 'segundo_apellido', {
      type: Sequelize.STRING(60),
      allowNull: true
    }).catch(e => console.log('segundo_apellido ya existe'));

    await queryInterface.addColumn('clients', 'tipo_documento', {
      type: Sequelize.ENUM('cedula', 'nit', 'rut', 'pasaporte', 'cedula_extranjeria'),
      allowNull: false,
      defaultValue: 'cedula'
    }).catch(e => console.log('tipo_documento ya existe'));

    await queryInterface.addColumn('clients', 'digito_verificacion', {
      type: Sequelize.STRING(2),
      allowNull: true
    }).catch(e => console.log('digito_verificacion ya existe'));

    await queryInterface.addColumn('clients', 'telefono_2', {
      type: Sequelize.STRING(30),
      allowNull: true
    }).catch(e => console.log('telefono_2 ya existe'));

    await queryInterface.addColumn('clients', 'email_2', {
      type: Sequelize.STRING(150),
      allowNull: true
    }).catch(e => console.log('email_2 ya existe'));

    await queryInterface.addColumn('clients', 'direccion_2', {
      type: Sequelize.STRING(250),
      allowNull: true
    }).catch(e => console.log('direccion_2 ya existe'));

    await queryInterface.addColumn('clients', 'codigo_postal', {
      type: Sequelize.STRING(20),
      allowNull: true
    }).catch(e => console.log('codigo_postal ya existe'));

    await queryInterface.addColumn('clients', 'responsable_iva', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    }).catch(e => console.log('responsable_iva ya existe'));

    await queryInterface.addColumn('clients', 'autoretenedor', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    }).catch(e => console.log('autoretenedor ya existe'));

    await queryInterface.addColumn('clients', 'gran_contribuyente', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    }).catch(e => console.log('gran_contribuyente ya existe'));

    await queryInterface.addColumn('clients', 'clasificacion_dian', {
      type: Sequelize.STRING(50),
      allowNull: true
    }).catch(e => console.log('clasificacion_dian ya existe'));

    await queryInterface.addColumn('clients', 'actividad_economica', {
      type: Sequelize.STRING(100),
      allowNull: true
    }).catch(e => console.log('actividad_economica ya existe'));

    await queryInterface.addColumn('clients', 'codigo_ciiu', {
      type: Sequelize.STRING(20),
      allowNull: true
    }).catch(e => console.log('codigo_ciiu ya existe'));

    await queryInterface.addColumn('clients', 'plazo_credito', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    }).catch(e => console.log('plazo_credito ya existe'));

    await queryInterface.addColumn('clients', 'cupo_credito', {
      type: Sequelize.DECIMAL(15, 2),
      defaultValue: 0
    }).catch(e => console.log('cupo_credito ya existe'));

    await queryInterface.addColumn('clients', 'fecha_aniversario', {
      type: Sequelize.DATE,
      allowNull: true
    }).catch(e => console.log('fecha_aniversario ya existe'));

    await queryInterface.addColumn('clients', 'lista_precios', {
      type: Sequelize.STRING(50),
      allowNull: true
    }).catch(e => console.log('lista_precios ya existe'));

    await queryInterface.addColumn('clients', 'forma_pago', {
      type: Sequelize.STRING(50),
      allowNull: true
    }).catch(e => console.log('forma_pago ya existe'));

    await queryInterface.addColumn('clients', 'activo', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    }).catch(e => console.log('activo ya existe'));

    // Renombrar columna nombre_razon_social a razon_social
    try {
      await queryInterface.renameColumn('clients', 'nombre_razon_social', 'razon_social');
    } catch(e) {
      console.log('nombre_razon_social ya fue renombrada o no existe');
    }
  },

  async down(queryInterface, Sequelize) {
    // Eliminar columnas en orden inverso
    const columns = [
      'activo', 'forma_pago', 'lista_precios', 'fecha_aniversario', 'cupo_credito',
      'plazo_credito', 'codigo_ciiu', 'actividad_economica', 'clasificacion_dian',
      'gran_contribuyente', 'autoretenedor', 'responsable_iva', 'codigo_postal',
      'direccion_2', 'email_2', 'telefono_2', 'digito_verificacion', 'tipo_documento',
      'segundo_apellido', 'primer_apellido', 'segundo_nombre', 'primer_nombre', 'tipo_persona'
    ];
    
    for (const column of columns) {
      await queryInterface.removeColumn('clients', column).catch(e => console.log(`${column} no existe`));
    }
    
    // Renombrar razon_social de vuelta
    try {
      await queryInterface.renameColumn('clients', 'razon_social', 'nombre_razon_social');
    } catch(e) {
      console.log('razon_social no existe');
    }
  }
};