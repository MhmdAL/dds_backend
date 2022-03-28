const { users } = require("../db_models.js").models;

const createUser = async (req, res) => {
  let user = await users.findOne({ where: { fbid: req.authenticatedUser.uid } })

  if(user != null) {
    user.reg_token = req.body.registrationToken;
  }else {
    user = await users.create({
      name: req.body.name || "Unknown",
      fbid: req.authenticatedUser.uid,
      reg_token: req.body.registrationToken,
      rfid: "123",
      fpid: 0
    });
  }

  await user.save()

  res.json(user);
};

module.exports = { createUser };
