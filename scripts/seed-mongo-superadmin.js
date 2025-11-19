/**
 * Non-destructive seed script: ensures a super_admin user exists in MongoDB
 * Usage: node scripts/seed-mongo-superadmin.js
 */
const bcrypt = require('bcryptjs');
const { connect, mongoose } = require('../database/mongo');
const User = require('../models/User');
require('dotenv').config({ path: __dirname + '/../.env' });

const run = async () => {
  await connect();
  const email = process.env.SUPERADMIN_EMAIL || 'superadmin@hotel.com';
  const username = process.env.SUPERADMIN_USERNAME || 'superadmin';
  const password = process.env.SUPERADMIN_PASSWORD || 'password123';

  const existing = await User.findOne({ $or: [{ email }, { username }] }).lean();
  if (existing) {
    console.log('Superadmin already exists with id:', existing._id);
    process.exit(0);
  }

  const hash = await bcrypt.hash(password, 10);
  const u = new User({ username, email, password_hash: hash, first_name: 'Super', last_name: 'Admin', role: 'super_admin', privileges: { manage_hotels: true, manage_admins: true, manage_rooms: true, manage_hr: true, process_refunds: true }, is_active: true });
  const saved = await u.save();
  console.log('Created superadmin with id:', saved._id);
  process.exit(0);
};

run().catch(err => { console.error(err); process.exit(1); });
