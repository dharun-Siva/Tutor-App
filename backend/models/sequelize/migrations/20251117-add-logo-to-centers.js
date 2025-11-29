// Migration to add logoUrl field to centers table
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('centers', 'logo_url', {
      type: Sequelize.STRING,
      allowNull: true,
      validate: {
        isUrl: true
      }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('centers', 'logo_url');
  }
};
