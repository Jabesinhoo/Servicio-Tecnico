// backend/src/migrations/20250119000000-add-client-fields.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar columnas existentes
    const checkColumnExists = async (columnName) => {
      const [result] = await queryInterface.sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'clients' AND column_name = '${columnName}'
      `);
      return result.length > 0;
    };

    // Agregar columna con verificación previa
    const addColumnSafe = async (columnName, columnDef) => {
      const exists = await checkColumnExists(columnName);
      if (!exists) {
        await queryInterface.addColumn('clients', columnName, columnDef);
        console.log(`✅ Columna ${columnName} agregada`);
      } else {
        console.log(`⏭️ Columna ${columnName} ya existe`);
      }
    };

    // Tipo de persona
    await addColumnSafe('tipo_persona', {
      type: Sequelize.ENUM('natural', 'juridica'),
      allowNull: false,
      defaultValue: 'natural'
    });

    // Nombres y apellidos
    await addColumnSafe('primer_nombre', { type: Sequelize.STRING(60), allowNull: true });
    await addColumnSafe('segundo_nombre', { type: Sequelize.STRING(60), allowNull: true });
    await addColumnSafe('primer_apellido', { type: Sequelize.STRING(60), allowNull: true });
    await addColumnSafe('segundo_apellido', { type: Sequelize.STRING(60), allowNull: true });

    // Renombrar nombre_razon_social a razon_social si existe
    const hasNombreRazonSocial = await checkColumnExists('nombre_razon_social');
    const hasRazonSocial = await checkColumnExists('razon_social');
    
    if (hasNombreRazonSocial && !hasRazonSocial) {
      await queryInterface.renameColumn('clients', 'nombre_razon_social', 'razon_social');
      console.log('✅ Columna nombre_razon_social renombrada a razon_social');
    } else if (!hasRazonSocial) {
      await addColumnSafe('razon_social', { type: Sequelize.STRING(180), allowNull: true });
    }

    // Documentos
    await addColumnSafe('tipo_documento', {
      type: Sequelize.ENUM('cedula', 'nit', 'rut', 'pasaporte', 'cedula_extranjeria'),
      allowNull: false,
      defaultValue: 'cedula'
    });
    await addColumnSafe('digito_verificacion', { type: Sequelize.STRING(2), allowNull: true });

    // Contacto adicional
    await addColumnSafe('telefono_2', { type: Sequelize.STRING(30), allowNull: true });
    await addColumnSafe('email_2', { type: Sequelize.STRING(150), allowNull: true });

    // Dirección adicional
    await addColumnSafe('direccion_2', { type: Sequelize.STRING(250), allowNull: true });
    await addColumnSafe('codigo_postal', { type: Sequelize.STRING(20), allowNull: true });

    // Configuración fiscal
    await addColumnSafe('responsable_iva', { type: Sequelize.BOOLEAN, defaultValue: true });
    await addColumnSafe('autoretenedor', { type: Sequelize.BOOLEAN, defaultValue: false });
    await addColumnSafe('gran_contribuyente', { type: Sequelize.BOOLEAN, defaultValue: false });
    await addColumnSafe('clasificacion_dian', { type: Sequelize.STRING(50), allowNull: true });
    await addColumnSafe('actividad_economica', { type: Sequelize.STRING(100), allowNull: true });
    await addColumnSafe('codigo_ciiu', { type: Sequelize.STRING(20), allowNull: true });

    // Crédito
    await addColumnSafe('plazo_credito', { type: Sequelize.INTEGER, defaultValue: 0 });
    await addColumnSafe('cupo_credito', { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 });
    await addColumnSafe('fecha_aniversario', { type: Sequelize.DATE, allowNull: true });

    // Comercial
    await addColumnSafe('lista_precios', { type: Sequelize.STRING(50), allowNull: true });
    await addColumnSafe('forma_pago', { type: Sequelize.STRING(50), allowNull: true });

    // Extras
    await addColumnSafe('codigo_worldoffice', { type: Sequelize.STRING(50), allowNull: true });
    await addColumnSafe('observacion', { type: Sequelize.TEXT, allowNull: true });
    await addColumnSafe('notas', { type: Sequelize.TEXT, allowNull: true });
    await addColumnSafe('activo', { type: Sequelize.BOOLEAN, defaultValue: true });
  },

  async down(queryInterface, Sequelize) {
    // Verificar si columna existe antes de eliminar
    const checkColumnExists = async (columnName) => {
      const [result] = await queryInterface.sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'clients' AND column_name = '${columnName}'
      `);
      return result.length > 0;
    };

    const removeColumnSafe = async (columnName) => {
      const exists = await checkColumnExists(columnName);
      if (exists) {
        await queryInterface.removeColumn('clients', columnName);
        console.log(`✅ Columna ${columnName} eliminada`);
      }
    };

    const columnsToRemove = [
      'tipo_persona', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido',
      'tipo_documento', 'digito_verificacion', 'telefono_2', 'email_2', 'direccion_2',
      'codigo_postal', 'responsable_iva', 'autoretenedor', 'gran_contribuyente',
      'clasificacion_dian', 'actividad_economica', 'codigo_ciiu', 'plazo_credito',
      'cupo_credito', 'fecha_aniversario', 'lista_precios', 'forma_pago',
      'codigo_worldoffice', 'observacion', 'notas', 'activo'
    ];

    for (const column of columnsToRemove) {
      await removeColumnSafe(column);
    }

    // Renombrar razon_social de vuelta si existe
    const hasRazonSocial = await checkColumnExists('razon_social');
    const hasNombreRazonSocial = await checkColumnExists('nombre_razon_social');
    
    if (hasRazonSocial && !hasNombreRazonSocial) {
      await queryInterface.renameColumn('clients', 'razon_social', 'nombre_razon_social');
      console.log('✅ Columna razon_social renombrada a nombre_razon_social');
    }
  }
};