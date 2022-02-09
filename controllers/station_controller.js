const { stations } = require("../db_models").models;

const createStation = async (req, res) => {
  const station = await stations.create(req.body);

  res.json(station);
};

const getStations = async (req, res) => {
  const response = await stations.findAll()
  console.log(response)

  res.json({ data: response } );
};

module.exports = { createStation, getStations };
