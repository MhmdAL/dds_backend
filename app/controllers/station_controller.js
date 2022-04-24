const { stations } = require("../db_models").models;
const fs = require("fs");
const path = require("path");

const createStation = async (req, res) => {
  const station = await stations.create(req.body);

  res.json(station);
};

const getStations = async (req, res) => {
  const response = await stations.findAll()

  res.json({ data: response });
};

const setPath = async (req, res) => {
  const waypoints = req.body.waypoints
  const mappedWaypoints = waypoints.map((w, idx) => {
    return `${w.lat},${w.lng}`
  })
  const pathEntry = mappedWaypoints.join("_")

  let file = `paths.txt`;

  const fpath = path.join(__dirname, "..", "data", file);
  let data = fs.readFileSync(fpath, "utf8");

  const lines = data.split('\n')

  const keys = []
  const values = []

  lines.forEach((s) => {
    const kvp = s.split(':')
    keys.push(kvp[0])
    values.push(kvp[1])
  })

  const index = keys.findIndex(x => x == req.body.key)

  if (index != -1) {
    lines[index] = `${req.body.key}:${pathEntry}`
  } else {
    lines.push(`${req.body.key}:${pathEntry}`)
  }

  data = lines.join('\n')
  fs.writeFileSync(fpath, data)

  res.json("ok")
};

module.exports = { createStation, getStations, setPath };
