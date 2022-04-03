const express = require("express");
const cron = require('node-cron');
var cors = require("cors");

var serviceAccount = require("../service-account.json");
var admin = require("firebase-admin");
fb_app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
var firebaseAuth = require("firebase-admin/auth").getAuth();
const authMiddleWare = require("firebase-auth-express-middleware");

var {
  drone_controller,
  station_controller,
  mission_controller,
  user_controller,
} = require("./controllers/controller");

const db = require("./database.js");
db.init()

const app = express();
const port = 3001;

cron.schedule("*/15 * * * * *", mission_controller.returnTimedOutRecipientAwaitingDrones)
cron.schedule("*/15 * * * * *", mission_controller.updateAwaitingUnloadMissions)
cron.schedule("*/5 * * * * *", mission_controller.notifyRecipientsAlmostThere)

app.use(express.json()); // for parsing application/json
app.use(cors());


app.post("/test_notif", async (req, res) => {
  // notif.sendNotif()

  res.send('ok')
})

// Misson Controller
app.post("/start_mission", authMiddleWare.authn(firebaseAuth), mission_controller.createMission);
// app.put("/update_mission", mission_controller.updateMission);
app.get("/mission", mission_controller.getMission);
app.post("/ack_package_loaded", mission_controller.acknowledgeLoad);
app.post("/ack_recipient_arrived", mission_controller.acknowledgeRecipientArrived);
app.post("/ack_package_received", mission_controller.acknowledgeReceipt);

// Station Controller
app.get("/station", station_controller.getStations);
app.post("/station", station_controller.createStation);

// Drone Controller
app.post("/drone", drone_controller.createDrone);
app.put("/drone", drone_controller.updateDrone);

// User Controller
app.post("/user", authMiddleWare.authn(firebaseAuth), user_controller.createUser);

app.listen(port, () => {
  console.log(`DDS_BE listening at http://localhost:${port}`);
});
