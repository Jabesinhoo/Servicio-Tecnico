// backend/src/migrations/20250118000000-add-missing-columns-to-clients.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Obtener columnas existentes
    const [existingColumns] = await queryInterface.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clients'
    `);
    
    const existingColumnNames = existingColumns.map(c => c.column_name);
    
    console.log('Columnas existentes:', existingColumnNames);
    
    // Función para agregar columna solo si no existe
    const addColumnIfNotExists = async (columnName, columnDefinition) => {
      if (!existingColumnNames.includes(columnName)) {
        await queryInterface.addColumn('clients', columnName, columnDefinition);
        console.log(`✅ Columna ${columnName} agregada`);
      } else {
        console.log(`⏭️ Columna ${columnName} ya existe, omitiendo`);
      }
    };

    // 1. Tipo de persona
    await addColumnIfNotExists('tipo_persona', {
      type: Sequelize.ENUM('natural', 'juridica'),
      allowNull: false,
      defaultValue: 'natural'
    });

    // 2. Campos de persona natural
    await addColumnIfNotExists('primer_nombre', {
      type: Sequelize.STRING(60),
      allowNull: true
    });

    await addColumnIfNotExists('segundo_nombre', {
      type: Sequelize.STRING(60),
      allowNull: true
    });

    await addColumnIfNotExists('primer_apellido', {
      type: Sequelize.STRING(60),
      allowNull: true
    });

    await addColumnIfNotExists('segundo_apellido', {
      type: Sequelize.STRING(60),
      allowNull: true
    });

    // 3. Renombrar nombre_razon_social a razon_social si existe
    if (existingColumnNames.includes('nombre_razon_social') && !existingColumnNames.includes('razon_social')) {
      await queryInterface.renameColumn('clients', 'nombre_razon_social', 'razon_social');
      console.log('✅ Columna nombre_razon_social renombrada a razon_social');
    } else {
      console.log('⏭️ nombre_razon_social no existe o razon_social ya existe');
    }

    // 4. Si razon_social no existe y nombre_razon_social tampoco, crearla
    if (!existingColumnNames.includes('razon_social') && !existingColumnNames.includes('nombre_razon_social')) {
      await addColumnIfNotExists('razon_social', {
        type: Sequelize.STRING(180),
        allowNull: true
      });
    }

    // 5. Campos de documento
    await addColumnIfNotExists('tipo_documento', {
      type: Sequelize.ENUM('cedula', 'nit', 'rut', 'pasaporte', 'cedula_extranjeria'),
      allowNull: false,
      defaultValue: 'cedula'
    });

    await addColumnIfNotExists('digito_verificacion', {
      type: Sequelize.STRING(2),
      allowNull: true
    });

    // 6. Contacto adicional
    await addColumnIfNotExists('telefono_2', {
      type: Sequelize.STRING(30),
      allowNull: true
    });

    await addColumnIfNotExists('email_2', {
      type: Sequelize.STRING(150),
      allowNull: true
    });

    // 7. Dirección adicional
    await addColumnIfNotExists('direccion_2', {
      type: Sequelize.STRING(250),
      allowNull: true
    });

    await addColumnIfNotExists('codigo_postal', {
      type: Sequelize.STRING(20),
      allowNull: true
    });

    // 8. Configuración fiscal
    await addColumnIfNotExists('responsable_iva', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    });

    await addColumnIfNotExists('autoretenedor', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });

    await addColumnIfNotExists('gran_contribuyente', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });

    await addColumnIfNotExists('clasificacion_dian', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    await addColumnIfNotExists('actividad_economica', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    await addColumnIfNotExists('codigo_ciiu', {
      type: Sequelize.STRING(20),
      allowNull: true
    });

    // 9. Crédito
    await addColumnIfNotExists('plazo_credito', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    });

    await addColumnIfNotExists('cupo_credito', {
      type: Sequelize.DECIMAL(15, 2),
      defaultValue: 0
    });

    await addColumnIfNotExists('fecha_aniversario', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // 10. Comercial
    await addColumnIfNotExists('lista_precios', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    await addColumnIfNotExists('forma_pago', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    // 11. Extras
    await addColumnIfNotExists('codigo_worldoffice', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    await addColumnIfNotExists('observacion', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await addColumnIfNotExists('activo', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    });

    await addColumnIfNotExists('notas', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    console.log('✅ Migración completada');
  },

  async down(queryInterface, Sequelize) {
    // Obtener columnas existentes
    const [existingColumns] = await queryInterface.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clients'
    `);
    
    const existingColumnNames = existingColumns.map(c => c.column_name);
    
    // Columnas a eliminar (solo las que existen)
    const columnsToRemove = [
      'tipo_persona', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido',
      'tipo_documento', 'digito_verificacion', 'telefono_2', 'email_2', 'direccion_2',
      'codigo_postal', 'responsable_iva', 'autoretenedor', 'gran_contribuyente',
      'clasificacion_dian', 'actividad_economica', 'codigo_ciiu', 'plazo_credito',
      'cupo_credito', 'fecha_aniversario', 'lista_precios', 'forma_pago',
      'codigo_worldoffice', 'observacion', 'activo', 'notas'
    ];

    for (const column of columnsToRemove) {
      if (existingColumnNames.includes(column)) {
        await queryInterface.removeColumn('clients', column);
        console.log(`✅ Columna ${column} eliminada`);
      } else {
        console.log(`⏭️ Columna ${column} no existe, omitiendo`);
      }
    }

    // Renombrar razon_social de vuelta a nombre_razon_social si existe
    if (existingColumnNames.includes('razon_social') && !existingColumnNames.includes('nombre_razon_social')) {
      await queryInterface.renameColumn('clients', 'razon_social', 'nombre_razon_social');
      console.log('✅ Columna razon_social renombrada a nombre_razon_social');
    }
  }
};