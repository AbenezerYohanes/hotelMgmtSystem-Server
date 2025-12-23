const { initDb } = require('../config/database');

const listBookings = async (req, res) => {
  const sequelize = await initDb();
  const { Booking } = require('../models')(sequelize);
  const bookings = await Booking.findAll();
  res.json(bookings);
};

const createBooking = async (req, res) => {
  const sequelize = await initDb();
  const { Booking, Room, Notification } = require('../models')(sequelize);
  const data = req.body;
  // basic availability check
  const room = await Room.findByPk(data.roomId);
  if (!room) return res.status(400).json({ error: 'Invalid room' });
  const booking = await Booking.create(data);

  // Emit notification to user via socket if available
  const io = req.app && req.app.get('io');
  if (io) io.emit('booking:created', { booking });

  // save notification
  if (data.guestId && Notification) {
    await Notification.create({ userId: data.guestId, type: 'booking', title: 'Booking Confirmed', body: `Booking ${booking.id} created` });
  }

  res.json(booking);
};

const getBooking = async (req, res) => {
  const sequelize = await initDb();
  const { Booking } = require('../models')(sequelize);
  const b = await Booking.findByPk(req.params.id);
  if (!b) return res.status(404).json({ error: 'Not found' });
  res.json(b);
};

const updateBooking = async (req, res) => {
  const sequelize = await initDb();
  const { Booking } = require('../models')(sequelize);
  const b = await Booking.findByPk(req.params.id);
  if (!b) return res.status(404).json({ error: 'Not found' });
  await b.update(req.body);
  const io = req.app && req.app.get('io');
  if (io) io.emit('booking:updated', { booking: b });
  res.json(b);
};

module.exports = { listBookings, createBooking, getBooking, updateBooking };
