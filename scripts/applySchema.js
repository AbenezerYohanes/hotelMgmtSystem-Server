const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { pool } = require('../database/config');

async function createDatabaseIfNeeded() {
  const dbName = process.env.DB_NAME;
  if (!dbName) return;
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || ''
    });
    await conn.query('CREATE DATABASE IF NOT EXISTS ??', [dbName]);
    console.log(`✅ Database "${dbName}" created or already exists.`);
    await conn.end();
  } catch (err) {
    console.error('Error creating database:', err.message || err);
    throw err;
  }
}

async function runChapaUpdates() {
  // SQL statements previously in updateschema.js
  const statements = [
    `ALTER TABLE payments 
      ADD COLUMN IF NOT EXISTS chapa_payment_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS chapa_checkout_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS chapa_response JSON,
      ADD COLUMN IF NOT EXISTS webhook_data JSON,
      ADD COLUMN IF NOT EXISTS verification_data JSON,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,

    `CREATE TABLE IF NOT EXISTS chapa_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        payment_id INT,
        tx_ref VARCHAR(100) UNIQUE NOT NULL,
        chapa_payment_id VARCHAR(100),
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'ETB',
        status VARCHAR(20) DEFAULT 'pending',
        customer_email VARCHAR(100),
        customer_first_name VARCHAR(50),
        customer_last_name VARCHAR(50),
        customer_phone VARCHAR(20),
        checkout_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
      )`
  ];

  const conn = await pool.getConnection();
  try {
    for (const st of statements) {
      try {
        await conn.query(st);
        console.log('Executed Chapa statement');
      } catch (err) {
        console.warn('Chapa update warning:', err.message || err);
      }
    }
  } finally {
    conn.release();
  }
}

async function run() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const createDb = args.includes('--create-db');
  const chapa = args.includes('--chapa');
  const fileArgIndex = args.indexOf('--file');
  const schemaPath = fileArgIndex !== -1 && args[fileArgIndex + 1]
    ? path.resolve(process.cwd(), args[fileArgIndex + 1])
    : path.resolve(__dirname, '../database/schema.sql');

  if (createDb) {
    await createDatabaseIfNeeded();
  }

  if (!fs.existsSync(schemaPath)) {
    console.error('Schema file not found:', schemaPath);
    process.exit(2);
  }

  const content = fs.readFileSync(schemaPath, 'utf8');

  // Remove SQL comments and split statements by semicolon
  const cleaned = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('--'))
    .join(' ');

  const statements = cleaned.split(/;\s*/).map(s => s.trim()).filter(s => s.length > 0);

  console.log(`Found ${statements.length} SQL statements in ${schemaPath}`);
  if (dryRun) {
    console.log('Dry run mode - printing statements:');
    statements.forEach((st, i) => {
      console.log(`-- Statement ${i + 1} --`);
      console.log(st + ';\n');
    });
    process.exit(0);
  }

  const connection = await pool.getConnection();
  try {
    for (let i = 0; i < statements.length; i++) {
      const st = statements[i];
      try {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        await connection.query(st);
      } catch (e) {
        console.error(`Error executing statement ${i + 1}:`, e.message);
      }
    }
    console.log('Schema apply completed.');

    if (chapa) {
      console.log('Running Chapa-related schema updates...');
      await runChapaUpdates();
      console.log('Chapa updates completed.');
    }
  } finally {
    connection.release();
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Migration script error:', err);
  process.exit(1);
});
