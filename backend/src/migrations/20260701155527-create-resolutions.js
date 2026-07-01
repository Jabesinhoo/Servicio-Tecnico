module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('resolutions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      numero_resolucion: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      prefijo: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      rango_inicio: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      rango_fin: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      siguiente_numero: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      fecha_emision: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      fecha_vencimiento: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      activo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('resolutions');
  },
};