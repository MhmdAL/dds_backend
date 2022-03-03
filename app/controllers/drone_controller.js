const { drones } = require("../db_models.js").models;

const createDrone = async (req, res) => {
  const drone = await drones.create(req.body);

  res.json(drone);
};

const updateDrone = async (req, res) => {
  const drone = await drones.update(
    {
      ip: req.body.ip,
    },
    {
      where: {
        id: req.body.id,
      },
    }
  );

  res.json(drone);
};

module.exports = { createDrone, updateDrone };
