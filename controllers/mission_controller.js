const { missions, drones, stations } = require("../database");
const axios = require("axios");
var amqp = require("amqplib/callback_api");
const { response } = require("express");
const mqtt = require("mqtt");

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

  client.subscribe("mission-status-update");
});

client.on("message", async function (topic, message) {
  console.log(message.toString());

  data = JSON.parse(message)

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
  }
});

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

function publishMissionRequestEvent(
  mission,
  drone_instructions,
  src_station_id
) {
  var data = {
    id: mission.id,
    src_station_id: src_station_id,
    homeToSourceInstructions: drone_instructions.hts,
    sourceToDestInstructions: drone_instructions.std,
    destToHomeInstructions: drone_instructions.dth,
  };

  client.publish("mission-request", JSON.stringify(data));
  // amqp.connect("amqp://localhost:5672", function (error0, connection) {
  //   if (error0) {
  //     throw error0;
  //   }
  //   connection.createChannel(function (error1, channel) {
  //     if (error1) {
  //       throw error1;
  //     }
  //     var queue = `mission-request-queue-${mission.drone_id}`;

  //     var data = {
  //       id: mission.id,
  //       homeToSourceInstructions: drone_instructions.hts,
  //       sourceToDestInstructions: drone_instructions.std,
  //       destToHomeInstructions: drone_instructions.dth,
  //     };

  //     channel.sendToQueue(queue, Buffer.from(JSON.stringify(data)));
  //   });
  // });
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

  const droneInstructions = await generateDroneInstructions(
    sourceStationId,
    destStationId
  );

  publishMissionRequestEvent(mission, droneInstructions, sourceStationId);

  res.send("ok");

  // const response = await axios({
  //   method: "post",
  //   url: `${await getDroneControllerUrl(mission.id)}/start_mission`,
  //   data: {
  //     id: mission.id,
  //     homeToSourceInstructions: droneInstructions.hts,
  //     sourceToDestInstructions: droneInstructions.std,
  //     destToHomeInstructions: droneInstructions.dth,
  //   },
  // });

  // data = JSON.parse(response.data);

  // if (data.success === true) {
  //   await drones.update(
  //     {
  //       is_occupied: true,
  //     },
  //     {
  //       where: {
  //         id: suitableDrone.id,
  //       },
  //     }
  //   );

  //   res.json(mission);
  // } else {
  //   res.send("Failed to start mission");
  // }
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
  // axios({
  //   method: "post",
  //   url: `${await getDroneControllerUrl(req.body.mission_id)}/package_loaded`,
  // });
  console.log("acking load");
  // client.publish("package-load-ack", JSON.stringify('ok'));

  console.log(req.body.dest_station_id);
  client.publish(
    "mission-continue",
    JSON.stringify({ dest_station_id: req.body.dest_station_id })
  );

  res.send("Ok");
};

const acknowledgeReceipt = async (req, res) => {
  // axios({
  //   method: "post",
  //   url: `${await getDroneControllerUrl(req.body.mission_id)}/package_received`,
  // });

  console.log("acking receive");
  client.publish("package-receive-ack", JSON.stringify("ok"));

  res.send("Ok");
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
};
