var firebaseMessaging = require("firebase-admin/messaging").getMessaging();

function sendNotif(token, title, body) {
    const registrationToken = token;

    const message = {
      android: {
        notification: {
          title: title,
          body: body,
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
}

module.exports = { sendNotif }