// backend/src/migrations/20250117000000-update-clients-complete.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Función auxiliar para agregar columna si no existe
    const addColumnIfNotExists = async (tableName, columnName, columnDefinition) => {
      try {
        const [results] = await queryInterface.sequelize.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = '${tableName}' AND column_name = '${columnName}'
        `);
        
        if (results.length === 0) {
          await queryInterface.addColumn(tableName, columnName, columnDefinition);
          console.log(`Columna ${columnName} agregada correctamente`);
        } else {
          console.log(`Columna ${columnName} ya existe, omitiendo...`);
        }
      } catch (error) {
        console.log(`Error al agregar ${columnName}:`, error.message);
      }
    };

    // 1. Agregar tipo_persona
    await addColumnIfNotExists('clients', 'tipo_persona', {
      type: Sequelize.ENUM('natural', 'juridica'),
      allowNull: false,
      defaultValue: 'natural'
    });

    // 2. Agregar campos de persona natural
    await addColumnIfNotExists('clients', 'primer_nombre', {
      type: Sequelize.STRING(60),
      allowNull: true
    });

    await addColumnIfNotExists('clients', 'segundo_nombre', {
      type: Sequelize.STRING(60),
      allowNull: true
    });

    await addColumnIfNotExists('clients', 'primer_apellido', {
      type: Sequelize.STRING(60),
      allowNull: true
    });

    await addColumnIfNotExists('clients', 'segundo_apellido', {
      type: Sequelize.STRING(60),
      allowNull: true
    });

    // 3. Renombrar nombre_razon_social a razon_social si existe
    try {
      const [results] = await queryInterface.sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'clients' AND column_name = 'nombre_razon_social'
      `);
      
      if (results.length > 0) {
        await queryInterface.renameColumn('clients', 'nombre_razon_social', 'razon_social');
        console.log('Columna nombre_razon_social renombrada a razon_social');
      }
    } catch (error) {
      console.log('Error al renombrar nombre_razon_social:', error.message);
    }

    // 4. Agregar campos de documento
    await addColumnIfNotExists('clients', 'tipo_documento', {
      type: Sequelize.ENUM('cedula', 'nit', 'rut', 'pasaporte', 'cedula_extranjeria'),
      allowNull: false,
      defaultValue: 'cedula'
    });

    await addColumnIfNotExists('clients', 'digito_verificacion', {
      type: Sequelize.STRING(2),
      allowNull: true
    });

    // 5. Agregar campos de contacto adicionales
    await addColumnIfNotExists('clients', 'telefono_2', {
      type: Sequelize.STRING(30),
      allowNull: true
    });

    await addColumnIfNotExists('clients', 'email_2', {
      type: Sequelize.STRING(150),
      allowNull: true
    });

    // 6. Agregar campos de dirección adicionales
    await addColumnIfNotExists('clients', 'direccion_2', {
      type: Sequelize.STRING(250),
      allowNull: true
    });

    await addColumnIfNotExists('clients', 'codigo_postal', {
      type: Sequelize.STRING(20),
      allowNull: true
    });

    // 7. Agregar campos de configuración fiscal
    await addColumnIfNotExists('clients', 'responsable_iva', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    });

    await addColumnIfNotExists('clients', 'autoretenedor', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });

    await addColumnIfNotExists('clients', 'gran_contribuyente', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    });

    await addColumnIfNotExists('clients', 'clasificacion_dian', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    await addColumnIfNotExists('clients', 'actividad_economica', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    await addColumnIfNotExists('clients', 'codigo_ciiu', {
      type: Sequelize.STRING(20),
      allowNull: true
    });

    // 8. Agregar campos de crédito
    await addColumnIfNotExists('clients', 'plazo_credito', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    });

    await addColumnIfNotExists('clients', 'cupo_credito', {
      type: Sequelize.DECIMAL(15, 2),
      defaultValue: 0
    });

    await addColumnIfNotExists('clients', 'fecha_aniversario', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // 9. Agregar campos comerciales
    await addColumnIfNotExists('clients', 'lista_precios', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    await addColumnIfNotExists('clients', 'forma_pago', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    // 10. Agregar campos extras
    await addColumnIfNotExists('clients', 'codigo_worldoffice', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    await addColumnIfNotExists('clients', 'observacion', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await addColumnIfNotExists('clients', 'activo', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    });

    await addColumnIfNotExists('clients', 'notas', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    // Lista de columnas a eliminar (solo las que agregamos)
    const columnsToRemove = [
      'tipo_persona', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido',
      'tipo_documento', 'digito_verificacion', 'telefono_2', 'email_2', 'direccion_2',
      'codigo_postal', 'responsable_iva', 'autoretenedor', 'gran_contribuyente',
      'clasificacion_dian', 'actividad_economica', 'codigo_ciiu', 'plazo_credito',
      'cupo_credito', 'fecha_aniversario', 'lista_precios', 'forma_pago',
      'codigo_worldoffice', 'observacion', 'activo', 'notas'
    ];

    for (const column of columnsToRemove) {
      try {
        await queryInterface.removeColumn('clients', column);
        console.log(`Columna ${column} eliminada`);
      } catch (error) {
        console.log(`Error al eliminar ${column}:`, error.message);
      }
    }

    // Renombrar razon_social de vuelta a nombre_razon_social si existe
    try {
      const [results] = await queryInterface.sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'clients' AND column_name = 'razon_social'
      `);
      
      if (results.length > 0) {
        await queryInterface.renameColumn('clients', 'razon_social', 'nombre_razon_social');
        console.log('Columna razon_social renombrada a nombre_razon_social');
      }
    } catch (error) {
      console.log('Error al renombrar razon_social:', error.message);
    }
  }
};