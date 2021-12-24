const express = require("express");
var cors = require("cors");
const axios = require("axios");
var amqp = require("amqplib/callback_api");
const { missions, stations } = require("./database");

const app = express();
const port = 3001;

app.use(express.json()); // for parsing application/json
app.use(cors());

amqp.connect("amqp://localhost", function (error0, connection) {
  if (error0) {
    throw error0;
  }
  connection.createChannel(function (error1, channel) {
    if (error1) {
      throw error1;
    }
    var queue = "mission-status-update-queue";

    channel.assertQueue(queue, {
      durable: false,
    });

    channel.consume(
      queue,
      function (msg) {
        const content = msg.content.toString();
        console.log(content);
        data = JSON.parse(content);
        console.log("mission status: %s", data.status);
      },
      {
        noAck: true,
      }
    );
  });
});

function getDroneControllerUrl() {
  return "http://localhost:8000";
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

app.post("/start_mission", async (req, res) => {
  console.log(JSON.stringify(req.body));

  const sourceStationId = req.body.source_station_id;
  const destStationId = req.body.dest_station_id;

  const mission = await missions.create({
    source_station_id: sourceStationId,
    dest_station_id: destStationId,
    current_lat: "0",
    current_lng: "0",
    mission_status: "new_mission",
  });

  const droneInstructions = await generateDroneInstructions(
    sourceStationId,
    destStationId
  );

  axios({
    method: "post",
    url: `${getDroneControllerUrl()}/start_mission`,
    data: {
      id: mission.id,
      homeToSourceInstructions: droneInstructions.hts,
      sourceToDestInstructions: droneInstructions.std,
      destToHomeInstructions: droneInstructions.dth,
    },
  });

  res.json(mission);
});

app.put("/update_mission", (req, res) => {
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
});

app.get("/mission", async (req, res) => {
  const mission = await missions.findOne({
    where: {
      id: 1,
    },
  });

  res.json({
    current_lat: mission.current_lat,
    current_lng: mission.current_lng,
  });
});

app.post("/ack_package_loaded", async (req, res) => {
  axios({
    method: "post",
    url: `${getDroneControllerUrl()}/package_loaded`
  });

  res.send('Ok');
});

app.post("/ack_package_received", async (req, res) => {
  axios({
    method: "post",
    url: `${getDroneControllerUrl()}/package_received`
  });

  res.send('Ok');
});

app.post("/add_station", async (req, res) => {
  const station = await stations.create({
    lat: req.body.lat,
    lng: req.body.lng,
  });

  res.json(station);
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
