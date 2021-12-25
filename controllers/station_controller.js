const { stations } = require("../database");

const createStation = async (req, res) => {
  const station = await stations.create({
    lat: req.body.lat,
    lng: req.body.lng,
  });

  res.json(station);
};

module.exports = { createStation };
