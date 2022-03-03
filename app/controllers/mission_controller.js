const { missions, drones, stations, users } = require("../db_models").models;
const axios = require("axios");
const mqtt = require("mqtt");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize/dist");
const dds_config = require("../../dds_config.json")

const options = {
  clean: true,
  connectTimeout: 4000,
  clientId: "emqx_test",
  username: "emqx_test",
  password: "emqx_test",
};

const client = mqtt.connect("mqtt://broker.emqx.io:1883", options);

client.on("connect", function () {
  console.log("Connected");

  client.subscribe("drone-location-request-ack-event");
  client.subscribe("drone-landed-event");
  client.subscribe("flight-mission-completed-event");
});

client.on("message", async function (topic, message) {
  console.log(message.toString());

  data = JSON.parse(message);

  if (topic == "drone-location-request-ack-event") {
    onDroneLocationDiscovered(data);
  } else if (topic == "drone-landed-event") {
    onDroneLanded(data);
  } else if (topic == "flight-mission-completed-event") {
    onFlightMissionFinished(data)
  }
});

async function findActiveMission() {
  return await missions.findOne({
    where: { mission_status: { [Op.not]: "completed" } },
  });
}

function getPathBetween(source, dest) {
  // do some pathfinding magic to find movements
  return [{ x: dest.x - source.x, y: dest.y - source.y }];
}

async function generateFlightPlan(fromStationId, toStationId, type) {
  const toStation = await stations.findByPk(toStationId);

  let file = `plan_${type}.txt`;

  const fpath = path.join(__dirname, file);
  let data = fs.readFileSync(fpath, "utf8");

  data = data.replace("{lat}", toStation.lat);
  data = data.replace("{lng}", toStation.lng);
  data = data.replace("{alt}", dds_config.drone_altitude_in_meters);

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

function publishLandRequest() {
  client.publish("land-request", "{}");
}

async function updateStations(data) {
  const senderUser = await users.findByPk(data.sender_id)
  const recipientUser = await users.findByPk(data.recipient_id)

  client.publish(`station-update-${data.source_station_id}`, JSON.stringify({ expectedRfid: senderUser.rfid, stationType: 0 }))
  client.publish(`station-update-${data.dest_station_id}`, JSON.stringify({ expectedRfid: recipientUser.rfid, stationType: 1 }))
}

async function onFlightMissionFinished(data) {
  console.log("flight mission completed");
  const mission = await findActiveMission()

  if (data.station_id == mission.dest_station_id && mission.mission_status == "heading_dest") {
    mission.mission_status = "awaiting_recipient";
  }

  await mission.save()
}

async function onDroneLanded(data) {
  console.log("drone landed");
  const mission = await findActiveMission()

  if (data.station_id == mission.source_station_id && mission.mission_status == "heading_source") {
    mission.mission_status = "awaiting_load";
  } else if (data.station_id == mission.dest_station_id && mission.mission_status == "awaiting_recipient") {
    mission.mission_status = "awaiting_unload";

    this.recipientUnloadTimer = setTimeout(() => { 
      const mission = await findActiveMission()

      mission.mission_status = "completed"
      mission.save()
    }, dds_config.recipient_unload_timeout_in_minutes)
  }

  await mission.save();
}

async function onDroneLocationDiscovered(data) {
  const mission = await findActiveMission()

  await updateStations(mission)

  console.log('drone found!!')

  if (data.station_id == mission.source_station_id) {
    console.log("drone is already at the source. no need to send it there");

    mission.mission_status = "awaiting_load";
    await mission.save();

    return;
  }

  const flightPlan = await generateFlightPlan(
    data.station_id,
    mission.source_station_id,
    "current2source"
  );

  publishMissionRequestEvent(flightPlan);

  mission.mission_status = "heading_source";
  mission.save();
}

const createMission = async (req, res) => {
  const user = await users.findOne({ where: { fb_id: req.authenticatedUser.uid } })

  const active_mission = await findActiveMission()
  if (active_mission && active_mission != null) {
    console.log("mission already in progress");
    res.send("mission already in progress");
    return;
  }

  const sourceStationId = req.body.source_station_id;
  const destStationId = req.body.dest_station_id;
  const senderId = user.id;
  const recepientId = req.body.recepient_id;

  const mission = await missions.create({
    source_station_id: sourceStationId,
    dest_station_id: destStationId,
    current_lat: "0",
    current_lng: "0",
    mission_status: "new_mission",
    sender_id: senderId,
    recepient_id: recepientId,
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

const getActiveMission = async (req, res) => {
  active_mission = await findActiveMission()

  if (active_mission != null) res.json(active_mission);
  else res.json({});
};

const acknowledgeLoad = async (req, res) => {
  console.log("acking load");

  const mission = await findActiveMission()

  const flightPlan = await generateFlightPlan(
    mission.source_station_id,
    mission.dest_station_id,
    "source2dest"
  );

  publishMissionRequestEvent(flightPlan);

  mission.mission_status = "heading_dest";
  mission.save();

  res.json({ response: "Ok" });
};

const acknowledgeRecipientArrived = async (req, res) => {
  console.log("acking recipient");

  publishLandRequest();

  res.json({ response: "Ok" });
};

const acknowledgeReceipt = async (req, res) => {
  console.log("acking receive");

  const mission = await findActiveMission()

  if(this.recipientUnloadTimer)
    clearTimeout(this.recipientUnloadTimer);
    
  mission.mission_status = "completed";
  mission.save();

  res.json({ response: "Ok" });
};

module.exports = {
  createMission,
  updateMission,
  getMission: getActiveMission,
  acknowledgeLoad,
  acknowledgeRecipientArrived,
  acknowledgeReceipt,
  generateFlightPlan,
};
