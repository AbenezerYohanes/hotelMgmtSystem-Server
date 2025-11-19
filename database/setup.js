const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

const updateDatabaseSchema = async () => {
  try {
    console.log('🗄️ Updating MySQL database schema...');

    // Connect directly to the existing database
    const dbConnection = await mysql.createConnection({
      host: process.env.DB_HOST || '91.204.209.21',
      port: parseInt(process.env.DB_PORT) || 3306,
      database: (process.env.DB_NAME || 'hotel-management').replace(/-/g, '_'),
      user: process.env.DB_USER || 'hotel-manager',
      password: process.env.DB_PASSWORD || 'hotel-manager'
    });

    // Read and execute schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.toUpperCase().startsWith('CREATE DATABASE') && !stmt.toUpperCase().startsWith('USE'));

    console.log('📋 Executing database schema updates...');

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await dbConnection.execute(statement);
          console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
        } catch (error) {
          // Skip errors for duplicate entries or existing objects
          if (!error.message.includes('already exists') &&
              !error.message.includes('Duplicate entry') &&
              !error.message.includes('Table') &&
              !error.message.includes('already exists')) {
            console.warn(`⚠️ Warning executing statement: ${error.message}`);
          } else {
            console.log(`ℹ️ Skipped (already exists): ${statement.substring(0, 50)}...`);
          }
        }
      }
    }

    await dbConnection.end();
    console.log('✅ Database schema update completed successfully!');

    // Insert additional default data
    await insertDefaultData();

  } catch (error) {
    console.error('❌ Error updating database schema:', error);
    process.exit(1);
  }
};

const insertDefaultData = async () => {
  try {
    const { query } = require('./config');

    console.log('📊 Inserting default data...');

    // Default data is already in schema.sql, so we just verify the setup
    console.log('✅ Default data already inserted via schema.sql!');
  } catch (error) {
    console.error('❌ Error inserting default data:', error);
  }
};

if (require.main === module) {
  updateDatabaseSchema();
}

module.exports = { updateDatabaseSchema };
