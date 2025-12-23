const { initDb } = require('../config/database');

const occupancy = async (req, res) => {
  const sequelize = await initDb();
  const { Room, Booking } = require('../models')(sequelize);

  const totalRooms = await Room.count();
  const occupied = await Room.count({ where: { status: 'occupied' } });

  // simple booking counts
  const totalBookings = await Booking.count();

  res.json({ totalRooms, occupied, totalBookings });
};

const revenue = async (req, res) => {
  const sequelize = await initDb();
  const { Payment } = require('../models')(sequelize);

  // sum total paid payments
  const [results] = await sequelize.query("SELECT SUM(amount) as totalRevenue FROM Payments WHERE status = 'paid'");
  const totalRevenue = results[0]?.totalRevenue || 0;
  res.json({ totalRevenue });
};

module.exports = { occupancy, revenue };
