const { missions, drones, stations } = require("../database");
const axios = require("axios");
var amqp = require("amqplib/callback_api");

async function getDroneControllerUrl(mission_id) {
  const mission = await missions.findOne({
    where: {
      id: mission_id,
    },
  });

  const drone = await drones.findOne({
    where: {
      id: mission.drone_id,
    },
  });

  return `http://${drone.ip}:8000`;
}

const homePosition = { x: 0, y: 0 };

function getPathBetween(source, dest) {
  // do some pathfinding magic to find movements
  return [{ x: dest.x - source.x, y: dest.y - source.y }];
}

function getDroneMovements(home, source, dest) {
  const homeToSource = getPathBetween(home, source);
  const sourceToDest = getPathBetween(source, dest);
  const destToHome = getPathBetween(dest, home);

  return { hts: homeToSource, std: sourceToDest, dth: destToHome };
}

async function generateDroneInstructions(sourceStationId, destStationId) {
  const sourceStation = await stations.findOne({
    where: {
      id: sourceStationId,
    },
  });

  const destStation = await stations.findOne({
    where: {
      id: destStationId,
    },
  });

  return getDroneMovements(
    homePosition,
    { x: sourceStation.lat, y: sourceStation.lng },
    { x: destStation.lat, y: destStation.lng }
  );
}

const createMission = async (req, res) => {
  const suitableDrone = await drones.findOne({
    where: {
      is_occupied: false,
    },
  });

  if (!suitableDrone) {
    return res.json("No drone found; failed to start mission");
  }

  const sourceStationId = req.body.source_station_id;
  const destStationId = req.body.dest_station_id;

  const mission = await missions.create({
    source_station_id: sourceStationId,
    dest_station_id: destStationId,
    current_lat: "0",
    current_lng: "0",
    mission_status: "new_mission",
    drone_id: suitableDrone.id,
  });

  await drones.update(
    {
      is_occupied: true,
    },
    {
      where: {
        id: suitableDrone.id,
      },
    }
  );

  const droneInstructions = await generateDroneInstructions(
    sourceStationId,
    destStationId
  );

  axios({
    method: "post",
    url: `${await getDroneControllerUrl(mission.id)}/start_mission`,
    data: {
      id: mission.id,
      homeToSourceInstructions: droneInstructions.hts,
      sourceToDestInstructions: droneInstructions.std,
      destToHomeInstructions: droneInstructions.dth,
    },
  });

  res.json(mission);
};

const updateMission = (req, res) => {
  console.log(JSON.stringify(req.body));

  missions.update(
    {
      current_lat: req.body.current_lat,
      current_lng: req.body.current_lng,
    },
    {
      where: {
        id: 1,
      },
    }
  );

  res.send("mission updated successfully.");
};

const getMission = async (req, res) => {
  const mission = await missions.findOne({
    where: {
      id: 1,
    },
  });

  res.json({
    current_lat: mission.current_lat,
    current_lng: mission.current_lng,
  });
};

const acknowledgeLoad = async (req, res) => {
  axios({
    method: "post",
    url: `${await getDroneControllerUrl(req.body.mission_id)}/package_loaded`,
  });

  res.send("Ok");
};

const acknowledgeReceipt = async (req, res) => {
  axios({
    method: "post",
    url: `${await getDroneControllerUrl(req.body.mission_id)}/package_received`,
  });

  res.send("Ok");
};

const consumeMissionStatusUpdateEvent = async function(msg) {
  const content = msg.content.toString();
  data = JSON.parse(content);
  console.log("mission (%d) status: %s", data.id, data.status);
  if(data.status == 'finished'){
    const mission = await missions.findOne({
      where: {
        id: data.id
      }
    })

    await drones.update({
      is_occupied: false
    }, {
      where: {
        id: mission.drone_id
      }
    })
  }
};

module.exports = {
  createMission,
  updateMission,
  getMission,
  acknowledgeLoad,
  acknowledgeReceipt,
  consumeMissionStatusUpdateEvent
};
