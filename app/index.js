const express = require("express");
const cron = require('node-cron');
var cors = require("cors");
var {
  drone_controller,
  station_controller,
  mission_controller,
  user_controller,
} = require("./controllers/controller");

var serviceAccount = require("../service-account.json");
var admin = require("firebase-admin");
fb_app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
var firebaseAuth = require("firebase-admin/auth").getAuth();
var firebaseMessaging = require("firebase-admin/messaging").getMessaging();
const authMiddleWare = require("firebase-auth-express-middleware");

const db = require("./database.js");
db.init()

const app = express();
const port = 3001;

cron.schedule("* * * * *", mission_controller.returnTimedOutRecipientAwaitingDrones)
cron.schedule("* * * * *", mission_controller.updateAwaitingUnloadMissions)

app.use(express.json()); // for parsing application/json
app.use(cors());

app.post("/test_notif", async (req, res) => {
  const registrationToken = 'fcDMPd-5St6tyEGJU-Eja5:APA91bE5e0VB3FIkFsBYpOb4ULOgTDpECjyFqY5I2CCh1UDnVDiu4ZLQd2OO1vNSCZrqJTCJI2u591iaLrz3S2-egYjOrrM0wlnEvtTnhv-3bIvzxRGZrxd9iRH_ylkUqAVLkgJgAZvy';

  const message = {
    android: {
      notification: {
        title: 'My Title',
        body: 'TEST',
        notification_priority: 'PRIORITY_HIGH',
        color: '#FF0000'
      },
    },
  
    token: registrationToken
  };

  // Send a message to the device corresponding to the provided
  // registration token.
  firebaseMessaging.send(message)
    .then((response) => {
      // Response is a message ID string.
      console.log('Successfully sent message:', response);
    })
    .catch((error) => {
      console.log('Error sending message:', error);
    });

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
app.post("/user", user_controller.createUser);

app.listen(port, () => {
  console.log(`DDS_BE listening at http://localhost:${port}`);
});
