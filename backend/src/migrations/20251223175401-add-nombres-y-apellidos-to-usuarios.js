"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("usuarios", "nombre1", {
      type: Sequelize.STRING(60),
      allowNull: false,
      defaultValue: "",
    });

    await queryInterface.addColumn("usuarios", "nombre2", {
      type: Sequelize.STRING(60),
      allowNull: true,
    });

    await queryInterface.addColumn("usuarios", "apellidos", {
      type: Sequelize.STRING(120),
      allowNull: false,
      defaultValue: "",
    });

    // Si ya existía columna "nombre", opcional: copiarla a nombre1
    // (esto no falla si no existe, pero en algunos setups sí; si te da error, lo quitamos)
    try {
      await queryInterface.sequelize.query(`
        UPDATE usuarios
        SET nombre1 = COALESCE(NULLIF(nombre1,''), nombre)
        WHERE nombre1 = '' OR nombre1 IS NULL
      `);
    } catch (_) {}

    // Si quieres borrar "nombre" (solo si existe), lo ideal es hacerlo en otra migración
    // cuando estés seguro de que ya no se usa en ningún lado.
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("usuarios", "apellidos");
    await queryInterface.removeColumn("usuarios", "nombre2");
    await queryInterface.removeColumn("usuarios", "nombre1");
  },
};
