const mysql = require('mysql2/promise');
const { logger } = require('../middleware/logger');
require('dotenv').config({ path: __dirname + '/../.env' });

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || '91.204.209.21',
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'hotel-management',
  user: process.env.DB_USER || 'hotel-manager',
  password: process.env.DB_PASSWORD || 'hotel-manager',
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 20,
  // Add SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test the connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    logger.info('✅ Connected to MySQL database successfully', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user
    });
    connection.release();
  } catch (err) {
    logger.error('❌ Error connecting to MySQL database:', {
      error: err.message,
      code: err.code,
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database
    });
    // Don't exit in production, let the app continue and retry
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
};

// Initialize connection test
testConnection();

// Enhanced query function with better error handling
const query = async (text, params = []) => {
  try {
    // Translate Postgres-style placeholders ($1, $2, ...) to MySQL-style (?)
    let sql = text;
    const hasDollarPlaceholders = /\$[0-9]+/.test(sql);
    if (hasDollarPlaceholders) {
      sql = sql.replace(/\$[0-9]+/g, '?');
    }

    // Detect RETURNING clause (Postgres). We'll emulate common cases for INSERT/UPDATE.
    const returningMatch = sql.match(/\sRETURNING\s+(.+)$/i);
    let returningCols = null;
    if (returningMatch) {
      returningCols = returningMatch[1].trim();
      // strip RETURNING from SQL
      sql = sql.replace(/\sRETURNING\s+(.+)$/i, '');
    }

    const execResult = await pool.execute(sql, params);
    // execResult is usually [rows, fields]
    const rows = Array.isArray(execResult) ? execResult[0] : execResult;
    const fields = Array.isArray(execResult) ? execResult[1] : undefined;

    // Build a backward-compatible return value:
    // - allow indexing like result[0] (rows)
    // - provide `.rows` and `.rowCount` properties
    const ret = [];
    ret[0] = rows;
    if (fields !== undefined) ret[1] = fields;
    Object.defineProperty(ret, 'rows', { value: rows, enumerable: false, writable: true });
    Object.defineProperty(ret, 'rowCount', { value: Array.isArray(rows) ? rows.length : 0, enumerable: false, writable: true });
    // Also expose common packet properties directly for convenience
    if (rows && typeof rows === 'object' && !Array.isArray(rows)) {
      // e.g., insertId, affectedRows
      Object.keys(rows).forEach(k => {
        try { ret[k] = rows[k]; } catch (e) { /* ignore */ }
      });
    }

    return ret;
  } catch (error) {
    logger.error('Database query error:', {
      query: text,
      params: params,
      error: error.message,
      code: error.code
    });
    throw error;
  }
};

// Transaction helper
const transaction = async (callback) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Health check function
const healthCheck = async () => {
  try {
    const connection = await pool.getConnection();
    await connection.execute('SELECT 1');
    connection.release();
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Closing database connections...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Closing database connections...');
  await pool.end();
  process.exit(0);
});

module.exports = {
  query,
  transaction,
  healthCheck,
  pool
};