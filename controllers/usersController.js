const { initDb } = require('../config/database');

const listUsers = async (req, res) => {
  const sequelize = await initDb();
  const { User } = require('../models')(sequelize);
  const users = await User.findAll({ attributes: ['id','email','name','role','createdAt'] });
  res.json(users);
};

const getUser = async (req, res) => {
  const sequelize = await initDb();
  const { User } = require('../models')(sequelize);
  const user = await User.findByPk(req.params.id, { attributes: ['id','email','name','role','meta'] });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
};

const createUser = async (req, res) => {
  const sequelize = await initDb();
  const { User } = require('../models')(sequelize);
  const { email, password, name, role } = req.body;
  const exists = await User.findOne({ where: { email } });
  if (exists) return res.status(400).json({ error: 'User exists' });
  const u = await User.create({ email, password, name, role });
  res.json({ id: u.id, email: u.email, role: u.role });
};

const updateUser = async (req, res) => {
  const sequelize = await initDb();
  const { User } = require('../models')(sequelize);
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  await user.update(req.body);
  res.json({ ok: true });
};

const deleteUser = async (req, res) => {
  const sequelize = await initDb();
  const { User } = require('../models')(sequelize);
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  await user.destroy();
  res.json({ ok: true });
};

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser };
