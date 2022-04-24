const fs = require("fs");
const path = require("path");

function getPathBetween(fromStation, toStation) {
  const key = `${fromStation.id}->${toStation.id}`

  const pathsFilePath = path.join(__dirname, "..", "data", "paths.txt");
  const pathsString = fs.readFileSync(pathsFilePath, "utf8");

  const paths = pathsString.split('\n')
  const index = paths.findIndex(x => x.startsWith(key))

  if (index == -1) {
    return [[toStation.lat, toStation.lng]]
  } else {
    const path = paths[index].split(':')[1]
    const waypointsString = path.split('_')

    const waypointsCoords = waypointsString.map((s) => {
      return s.split(',')
    })

    return waypointsCoords
  }
}

module.exports.getPathBetween = getPathBetween