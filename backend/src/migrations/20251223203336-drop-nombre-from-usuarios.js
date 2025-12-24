"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1) Si existe 'nombre', copiarla a nombre1 si nombre1 está vacío (por si tienes data vieja)
    // (si tu tabla es nueva/vacía, no pasa nada)
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='usuarios' AND column_name='nombre'
        ) THEN
          UPDATE usuarios
          SET nombre1 = COALESCE(NULLIF(nombre1, ''), nombre)
          WHERE (nombre1 IS NULL OR nombre1 = '') AND nombre IS NOT NULL;
        END IF;
      END $$;
    `);

    // 2) Quitar la columna vieja 'nombre'
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='usuarios' AND column_name='nombre'
        ) THEN
          ALTER TABLE usuarios DROP COLUMN nombre;
        END IF;
      END $$;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Si haces rollback, recrea 'nombre'
    await queryInterface.addColumn("usuarios", "nombre", {
      type: Sequelize.STRING(100),
      allowNull: false,
      defaultValue: "",
    });
  },
};
