// backend/src/migrations/20250101-add-roles-to-enum.js (cambia la fecha)
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si el tipo ya existe y eliminarlo si es necesario
    await queryInterface.sequelize.query(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_usuarios_rol_new') THEN
          DROP TYPE "enum_usuarios_rol_new" CASCADE;
        END IF;
      END $$;
    `);
    
    // Eliminar valor por defecto
    await queryInterface.sequelize.query(`
      ALTER TABLE usuarios ALTER COLUMN rol DROP DEFAULT;
    `);
    
    // Crear nuevo tipo ENUM con todos los roles
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_usuarios_rol_new" AS ENUM ('admin', 'tecnico', 'usuario', 'ventas', 'inventario', 'facturacion');
    `);
    
    // Convertir columna al nuevo tipo
    await queryInterface.sequelize.query(`
      ALTER TABLE usuarios ALTER COLUMN rol TYPE "enum_usuarios_rol_new" USING (rol::text::"enum_usuarios_rol_new");
    `);
    
    // Eliminar tipo viejo
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_usuarios_rol" CASCADE;
    `);
    
    // Renombrar nuevo tipo
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_usuarios_rol_new" RENAME TO "enum_usuarios_rol";
    `);
    
    // Restaurar valor por defecto
    await queryInterface.sequelize.query(`
      ALTER TABLE usuarios ALTER COLUMN rol SET DEFAULT 'usuario';
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_usuarios_rol_old') THEN
          DROP TYPE "enum_usuarios_rol_old" CASCADE;
        END IF;
      END $$;
    `);
    
    await queryInterface.sequelize.query(`
      ALTER TABLE usuarios ALTER COLUMN rol DROP DEFAULT;
    `);
    
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_usuarios_rol_old" AS ENUM ('admin', 'tecnico', 'usuario');
    `);
    
    await queryInterface.sequelize.query(`
      ALTER TABLE usuarios ALTER COLUMN rol TYPE "enum_usuarios_rol_old" USING 
        CASE 
          WHEN rol::text IN ('ventas', 'inventario', 'facturacion') THEN 'usuario'
          ELSE rol::text
        END::"enum_usuarios_rol_old";
    `);
    
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_usuarios_rol" CASCADE;
    `);
    
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_usuarios_rol_old" RENAME TO "enum_usuarios_rol";
    `);
    
    await queryInterface.sequelize.query(`
      ALTER TABLE usuarios ALTER COLUMN rol SET DEFAULT 'usuario';
    `);
  }
};