const db_models = require("./db_models");
const { Sequelize } = require("sequelize");
const { options } = require("pg/lib/defaults");

const sequelize = new Sequelize(
  "postgres://postgres:postgres@localhost:5432/dds_db"
);

const { missions, stations } = db_models.init_models(sequelize);

try {
  sequelize.authenticate();
  console.log("Connection has been established successfully.");
} catch (error) {
  console.error("Unable to connect to the database:", error);
}

sequelize.sync();

module.exports = { sequelize, missions, stations };
