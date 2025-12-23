const { initDb } = require('../config/database');

const listRooms = async (req, res) => {
  const sequelize = await initDb();
  const { Room } = require('../models')(sequelize);
  const rooms = await Room.findAll();
  res.json(rooms);
};

const getRoom = async (req, res) => {
  const sequelize = await initDb();
  const { Room } = require('../models')(sequelize);
  const room = await Room.findByPk(req.params.id);
  if (!room) return res.status(404).json({ error: 'Not found' });
  res.json(room);
};

const createRoom = async (req, res) => {
  const sequelize = await initDb();
  const { Room } = require('../models')(sequelize);
  const r = await Room.create(req.body);
  res.json(r);
};

const updateRoom = async (req, res) => {
  const sequelize = await initDb();
  const { Room } = require('../models')(sequelize);
  const room = await Room.findByPk(req.params.id);
  if (!room) return res.status(404).json({ error: 'Not found' });
  await room.update(req.body);
  res.json(room);
};

const deleteRoom = async (req, res) => {
  const sequelize = await initDb();
  const { Room } = require('../models')(sequelize);
  const room = await Room.findByPk(req.params.id);
  if (!room) return res.status(404).json({ error: 'Not found' });
  await room.destroy();
  res.json({ ok: true });
};

module.exports = { listRooms, getRoom, createRoom, updateRoom, deleteRoom };
