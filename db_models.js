const { DataTypes, Model } = require("sequelize");

const init_models = function (sequelize) {
  class missions extends Model {}
  missions.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      source_station_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      dest_station_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      current_lat: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
      current_lng: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
      mission_status: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "missions",
    }
  );

  class stations extends Model {}
  stations.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      lat: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
      lng: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      }
    },
    {
      sequelize,
      modelName: "stations",
    }
  );

  return { missions, stations }
};

exports.init_models = init_models