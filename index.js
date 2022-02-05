const express = require("express");
var cors = require("cors");
var amqp = require("amqplib/callback_api");
var {
  drone_controller,
  station_controller,
  mission_controller,
} = require("./controllers/controller");

const app = express();
const port = 3001;

app.use(express.json()); // for parsing application/json
app.use(cors());

amqp.connect("amqp://localhost:5672", function (error0, connection) {
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
      mission_controller.consumeMissionStatusUpdateEvent,
      {
        noAck: true,
      }
    );
  });
});

app.post("/start_mission", mission_controller.createMission);
app.put("/update_mission", mission_controller.updateMission);
app.get("/mission", mission_controller.getMission);
app.post("/ack_package_loaded", mission_controller.acknowledgeLoad);
app.post("/ack_package_received", mission_controller.acknowledgeReceipt);

app.get("/station", station_controller.getStations);
app.post("/station", station_controller.createStation);

app.post("/drone", drone_controller.createDrone);
app.put("/drone", drone_controller.updateDrone);

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
