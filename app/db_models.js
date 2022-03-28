const { DataTypes, Model } = require("sequelize");

class missions extends Model {}
class stations extends Model {}
class drones extends Model {}
class users extends Model {}

const init_models = function (sequelize) {
  missions.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      drone_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
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
      sender_id: {
        type: DataTypes.STRING,
        allowNull: false
      },
      recepient_id: {
        type: DataTypes.STRING,
        allowNull: false
      },
      eta: {
        type: DataTypes.DATE,
        allowNull: true
      },
      reached_dest_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      arrived_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      arrival_notif_sent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: "missions",
    }
  );

  stations.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lat: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
      lng: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "stations",
    }
  );

  drones.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      ip: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lat: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
      lng: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
      is_occupied: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "drones",
    }
  );

  users.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      fbid: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      reg_token: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      rfid: {
        type: DataTypes.STRING,
        allowNull: false
      },
      fpid: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: "users",
    }
  )
};

module.exports.init_models = init_models;
module.exports.models = { stations, missions, drones, users };
