const express = require("express");
var cors = require("cors");
var amqp = require("amqplib/callback_api");
var {
  drone_controller,
  station_controller,
  mission_controller,
  user_controller,
} = require("./controllers/controller");
var serviceAccount = require("./service-account.json");
var admin = require("firebase-admin");
fb_app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
var firebaseAuth = require("firebase-admin/auth").getAuth();
const authMiddleWare = require("firebase-auth-express-middleware");

const db = require("./database.js");
db.init()

const app = express();
const port = 3001;

app.use(express.json()); // for parsing application/json
app.use(cors());

// amqp.connect("amqp://localhost:5672", function (error0, connection) {
//   if (error0) {
//     throw error0;
//   }
//   connection.createChannel(function (error1, channel) {
//     if (error1) {
//       throw error1;
//     }
//     var queue = "mission-status-update-queue";

//     channel.assertQueue(queue, {
//       durable: false,
//     });

//     channel.consume(queue, mission_controller.consumeMissionStatusUpdateEvent, {
//       noAck: true,
//     });
//   });
// });

// Misson Controller
app.post("/start_mission", authMiddleWare.authn(firebaseAuth), mission_controller.createMission);
app.put("/update_mission", mission_controller.updateMission);
app.get("/mission", mission_controller.getMission);
app.post("/ack_package_loaded", mission_controller.acknowledgeLoad);
app.post("/ack_package_received", mission_controller.acknowledgeReceipt);

// Station Controller
app.get("/station", station_controller.getStations);
app.post("/station", station_controller.createStation);

// Drone Controller
app.post("/drone", drone_controller.createDrone);
app.put("/drone", drone_controller.updateDrone);

// User Controller
app.post("/user", user_controller.createUser);

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
