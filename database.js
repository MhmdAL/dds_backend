const db_models = require("./db_models");
const { Sequelize } = require("sequelize");

let sequelize = new Sequelize(
  "postgres://postgres:postgres@localhost:5432/postgres"
);

async function init() {
  try {
    await sequelize.query("CREATE DATABASE dds_db;");
  } catch (e) {
    console.log(`Failed to create db: ${e}`);
  }

  sequelize = new Sequelize(
    "postgres://postgres:postgres@localhost:5432/dds_db"
  );

  try {
    sequelize.authenticate();
    console.log("Connection has been established successfully.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }

  db_models.init_models(sequelize);

  sequelize.sync();

  return sequelize;
}

module.exports = { init };
