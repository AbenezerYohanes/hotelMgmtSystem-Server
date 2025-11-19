const mongoose = require('mongoose');
const { logger } = require('../middleware/logger');
require('dotenv').config({ path: __dirname + '/../.env' });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/hotel_management';

const connect = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info('✅ Connected to MongoDB', { uri: MONGO_URI });
  } catch (err) {
    logger.error('❌ MongoDB connection error', { error: err.message });
    // In development we don't exit, let app retry
    if (process.env.NODE_ENV !== 'production') {
      // do not exit to allow debugging; application will still run but DB operations will fail until connected
    }
  }
};

module.exports = { connect, mongoose };
