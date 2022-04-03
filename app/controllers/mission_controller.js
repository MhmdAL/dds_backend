const { missions, drones, stations, users } = require("../db_models").models;
const mqtt = require("mqtt");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize/dist");
const dds_config = require("../../dds_config.json")
const notification_service = require('../services/notification_service')

const options = {
  clean: true,
  connectTimeout: 4000,
  clientId: "emqx_test",
  username: "emqx_test",
  password: "emqx_test",
};

const client = mqtt.connect(`mqtt://${dds_config.broker_url}`, options);

client.on("connect", function () {
  console.log("Connected");

  client.subscribe("drone-location-request-ack-event");
  client.subscribe("drone-landed-event");
  client.subscribe("flight-mission-completed-event");
  client.subscribe("acknowledge-recipient-event");
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
  } else if (topic == "acknowledge-recipient-event") {
    ackRecipientArrived()
  }
});

async function findActiveMission() {
  return await missions.findOne({
    where: { mission_status: { [Op.notIn]: ["completed", "failed"] } },
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
  console.log('Publishing mission start request')

  client.publish("start-mission-request", JSON.stringify({ planText: flightPlan }));
}

function publishDroneDiscoveryRequest(mission_id) {
  const data = {
    mission_id: mission_id,
  };

  console.log('Publishing drone discovery request')

  client.publish("drone-location-request", JSON.stringify(data));
}

function publishLandRequest() {
  client.publish("land-request", "{}");
}

async function updateStations(data) {
  const senderUser = await users.findByPk(data.sender_id)
  const recipientUser = await users.findByPk(data.recepient_id)

  client.publish(`station-update-${data.source_station_id}-request`, JSON.stringify({ expected_rfid: senderUser.rfid, expected_fpid: senderUser.fpid, stationType: 0 }))
  client.publish(`station-update-${data.dest_station_id}-request`, JSON.stringify({ expected_rfid: recipientUser.rfid, expected_fpid: recipientUser.fpid, stationType: 1 }))
}

async function handleRecipientTimeout(mission) {
  const flightPlan = await generateFlightPlan(
    mission.dest_station_id,
    mission.source_station_id,
    "dest2source"
  );

  publishMissionRequestEvent(flightPlan)

  mission.mission_status = "missing_recipient_heading_source"
  mission.save()
}

async function onFlightMissionFinished(data) {
  console.log("Received drone reached destination event");

  let mission = await findActiveMission()

  if (data.station_id == mission.dest_station_id && mission.mission_status == "heading_dest") {
    mission.mission_status = "awaiting_recipient";
    mission.reached_dest_at = Date()
  }

  await mission.save()
}

async function onDroneLanded(data) {
  console.log("Received drone landed event");

  const mission = await findActiveMission()

  if (data.station_id == mission.source_station_id && mission.mission_status == "heading_source") {
    mission.mission_status = "awaiting_load";
  } else if (data.station_id == mission.dest_station_id && mission.mission_status == "awaiting_recipient") {
    mission.mission_status = "awaiting_unload";
  } else if (data.station_id == mission.source_station_id && mission.mission_status == "missing_recipient_heading_source") {
    mission.mission_status = "failed"

    console.log('\n== Mission Failed! ==\n')
  }

  await mission.save();
}

async function onDroneLocationDiscovered(data) {
  console.log('Received drone location ack event')

  const mission = await findActiveMission()

  await updateStations(mission)

  if (data.station_id == mission.source_station_id) {
    console.log("Drone is already at the source station; no need to send it there");

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
  const user = await users.findOne({ where: { fbid: req.authenticatedUser.uid } })

  const active_mission = await findActiveMission()
  if (active_mission && active_mission != null) {
    console.log("A mission is already in progress; can't start a new mission.");
    res.send("A mission is already in progress");
    return;
  }

  console.log('\n== Mission Starting ==\n')

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

function calculateDistance(src, dest) {
  // Haversine formula

  const R = 6371e3;
  const lat1Rad = src.lat * Math.PI / 180;
  const lat2Rad = dest.lat * Math.PI / 180;
  const deltaLat = (dest.lat - src.lat) * Math.PI / 180;
  const deltaLon = (dest.lng - src.lng) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

async function calculateETA(fromStationId, toStationId) {
  const fromStation = await stations.findByPk(fromStationId)
  const toStation = await stations.findByPk(toStationId)

  const distanceInMeters = calculateDistance({ lat: fromStation.lat, lng: fromStation.lng }, { lat: toStation.lat, lng: toStation.lng })

  console.log(`Distance (m) between station ${fromStationId} and ${toStationId} is ${distanceInMeters}`)

  return distanceInMeters / dds_config.drone_speed_in_meters_per_sec + 2 * dds_config.takeoff_time_in_seconds
}

const acknowledgeLoad = async (req, res) => {
  console.log("acking load");

  const mission = await findActiveMission()

  const flightPlan = await generateFlightPlan(
    mission.source_station_id,
    mission.dest_station_id,
    "source2dest"
  );

  const etaInSeconds = await calculateETA(mission.source_station_id, mission.dest_station_id)

  var date = new Date();
  console.log('Mission ETA: ' + etaInSeconds)
  date.setSeconds(date.getSeconds() + etaInSeconds)

  mission.eta = date
  
  publishMissionRequestEvent(flightPlan);

  mission.mission_status = "heading_dest";
  await mission.save();

  res.json({ response: "Ok" });
};

async function ackRecipientArrived() {
  console.log('Received ack recipient message')

  const mission = await findActiveMission()

  if (mission.mission_status == 'awaiting_recipient') {
    mission.mission_status = 'awaiting_unload'

    mission.arrived_at = Date()

    await mission.save()

    publishLandRequest();
  }
}

const acknowledgeRecipientArrived = async (req, res) => {
  console.log("acking recipient");

  await ackRecipientArrived()

  res.json({ response: "Ok" });
};

const acknowledgeReceipt = async (req, res) => {
  console.log("acking receive");

  const mission = await findActiveMission()

  mission.mission_status = "completed";
  mission.save();

  console.log('\n== Mission Complete ==\n')

  res.json({ response: "Ok" });
};

async function handleSendingNotification(mission) {
  const recipient = await users.findByPk(mission.recepient_id)

  console.log(`Sending notification to user ${recipient.id}`)

  notification_service.sendNotif(recipient.reg_token, 'Package arriving', 'Your package will arrive soon.')

  mission.arrival_notif_sent = true

  await mission.save()
}

async function notifyRecipientsAlmostThere() {
  console.log('Running job to notify recipients that drone almost arrived')

  const targetMissions = await missions.findAll({ where: { mission_status: "heading_dest" } })

  targetMissions.forEach(async function (mission) {
    const timeDiffInSeconds = (Date.parse(mission.eta) - Date.now()) / 1000

    if (!mission.arrival_notif_sent && timeDiffInSeconds <= dds_config.recipient_eta_notification_time) {
      handleSendingNotification(mission)
    }
  })

}

async function returnTimedOutRecipientAwaitingDrones() {
  console.log('Running job to return hovering drones')

  const targetMissions = await missions.findAll({ where: { mission_status: "awaiting_recipient" } })

  targetMissions.forEach(async function (mission) {
    const timeDiffInMinutes = (Date.now() - Date.parse(mission.reached_dest_at)) / 60000

    if (timeDiffInMinutes >= dds_config.recipient_arrival_timeout_in_minutes) {
      handleRecipientTimeout(mission)
    }
  })
}

async function updateAwaitingUnloadMissions() {
  console.log('Running job to update awaiting_unload to completed')

  const targetMissions = await missions.findAll({ where: { mission_status: "awaiting_unload" } })

  targetMissions.forEach(async function (mission) {
    const timeDiffInMinutes = (Date.now() - Date.parse(mission.arrived_at)) / 60000

    if (timeDiffInMinutes >= dds_config.recipient_unload_timeout_in_minutes) {
      console.log('\n== Mission Complete ==\n')

      mission.mission_status = "completed"
      await mission.save()
    }
  })
}

module.exports = {
  createMission,
  updateMission,
  getMission: getActiveMission,
  acknowledgeLoad,
  acknowledgeRecipientArrived,
  acknowledgeReceipt,
  generateFlightPlan,
  returnTimedOutRecipientAwaitingDrones,
  updateAwaitingUnloadMissions,
  notifyRecipientsAlmostThere
};
