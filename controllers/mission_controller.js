const { missions, drones, stations } = require("../db_models").models;
const axios = require("axios");
const mqtt = require("mqtt");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize/dist");

const options = {
  clean: true,
  connectTimeout: 4000,
  clientId: "emqx_test",
  username: "emqx_test",
  password: "emqx_test",
};

const client = mqtt.connect("mqtt://localhost:2883", options);

client.on("connect", function () {
  console.log("Connected");

  client.subscribe("mission-status-update");
  client.subscribe("drone-location-request-ack");
  client.subscribe("drone-landed");
});

client.on("message", async function (topic, message) {
  console.log(message.toString());

  data = JSON.parse(message);

  if (topic == "mission-status-update") {
    console.log(data.status);
    await missions.update(
      {
        mission_status: data.status,
      },
      {
        where: {
          id: data.id,
        },
      }
    );
  } else if (topic == "drone-location-request-ack") {
    onDroneLocationDiscovered(data);
  } else if (topic == "drone-landed") {
    onDroneLanded(data);
  }
});

function getPathBetween(source, dest) {
  // do some pathfinding magic to find movements
  return [{ x: dest.x - source.x, y: dest.y - source.y }];
}

async function generateFlightPlan(fromStationId, toStationId) {
  const toStation = await stations.findByPk(toStationId);

  let file = "plan.txt";

  const fpath = path.join(__dirname, file);
  let data = fs.readFileSync(fpath, "utf8");

  data = data.replace("{lat}", toStation.lat);
  data = data.replace("{lng}", toStation.lng);
  data = data.replace("{alt}", 2);

  console.log(data);

  return data;
}

function publishMissionRequestEvent(flightPlan) {
  client.publish("mission-request", JSON.stringify({ planText: flightPlan }));
}

function publishDroneDiscoveryRequest(mission_id) {
  const data = {
    mission_id: mission_id,
  };

  client.publish("drone-location-request", JSON.stringify(data));
}

async function onDroneLanded(data) {
  console.log("drone landed");
  const mission = await missions.findOne({
    where: { mission_status: { [Op.not]: "completed" } },
  });

  if (mission.mission_status == "heading_source") {
    mission.mission_status = "awaiting_load";
  } else if (mission.mission_status == "heading_dest") {
    mission.mission_status = "awaiting_unload";
  }

  await mission.save();
}

async function onDroneLocationDiscovered(data) {
  const mission = await missions.findOne({
    where: { mission_status: { [Op.not]: "completed" } },
  });

  if (data.station_id == mission.source_station_id) {
    console.log("drone is already at the source. no need to send it there");

    mission.mission_status = "awaiting_load";
    await mission.save();

    return;
  }

  const flightPlan = generateFlightPlan(
    data.station_id,
    mission.source_station_id
  );

  publishMissionRequestEvent(flightPlan);

  mission.mission_status = "heading_source";
  mission.save();
}

const createMission = async (req, res) => {
  const active_mission = await missions.findOne({
    where: { mission_status: { [Op.not]: "completed" } },
  });
  if (active_mission && active_mission != null) {
    console.log("mission already in progress");
    res.send("mission already in progress");
    return;
  }

  // const drone = await drones.findOne();

  const sourceStationId = req.body.source_station_id;
  const destStationId = req.body.dest_station_id;

  const mission = await missions.create({
    source_station_id: sourceStationId,
    dest_station_id: destStationId,
    current_lat: "0",
    current_lng: "0",
    mission_status: "new_mission",
    drone_id: 999,
  });

  publishDroneDiscoveryRequest(mission.id);

  res.json({ id: mission.id });
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
  active_mission = await missions.findOne({
    where: { mission_status: { [Op.not]: "completed" } },
  });

  if (active_mission != null) res.json(active_mission);
  else res.json({})
};

const acknowledgeLoad = async (req, res) => {
  console.log("acking load");

  const mission = await missions.findOne({
    where: { mission_status: { [Op.not]: "completed" } },
  });

  const flightPlan = generateFlightPlan(
    mission.source_station_id,
    mission.dest_station_id
  );

  publishMissionRequestEvent(flightPlan);

  mission.mission_status = "heading_dest";
  mission.save();

  res.json({response: "Ok"});
};

const acknowledgeReceipt = async (req, res) => {
  console.log("acking receive");

  const mission = await missions.findOne({
    where: { mission_status: { [Op.not]: "completed" } },
  });

  mission.mission_status = "completed";
  mission.save();

  res.json({response: "Ok"});
};

const consumeMissionStatusUpdateEvent = async function (msg) {
  const content = msg.content.toString();
  data = JSON.parse(content);
  console.log("mission (%d) status: %s", data.id, data.status);
  if (data.status == "finished") {
    const mission = await missions.findOne({
      where: {
        id: data.id,
      },
    });

    await drones.update(
      {
        is_occupied: false,
      },
      {
        where: {
          id: mission.drone_id,
        },
      }
    );
  }
};

module.exports = {
  createMission,
  updateMission,
  getMission,
  acknowledgeLoad,
  acknowledgeReceipt,
  consumeMissionStatusUpdateEvent,
  generateFlightPlan,
};
