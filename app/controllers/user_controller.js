const { users } = require("../db_models.js").models;

const createUser = async (req, res) => {
  const user = await users.create(req.body);

  res.json(user);
};

module.exports = { createUser };
