const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

function databaseConfig() {
  return {
    host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
    port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT, 10) || 3306,
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'cinex',
    charset: 'utf8mb4',
    multipleStatements: true,
  };
}

async function prepare() {
  const config = databaseConfig();
  const connection = await mysql.createConnection(config);

  try {
    const [rows] = await connection.query(
      'SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
      [config.database, 'users'],
    );

    if (Number(rows[0].count) === 0) {
      console.log(`Initializing empty database "${config.database}"...`);
      const initPath = path.join(__dirname, 'init.sql');
      const initSql = fs.readFileSync(initPath, 'utf8')
        .replace(/^CREATE DATABASE[^;]*;\s*/i, '')
        .replace(/^USE\s+[^;]+;\s*/i, '');
      await connection.query(initSql);
      console.log('Base schema and seed data created.');
    } else {
      console.log('Base schema already exists; initialization skipped.');
    }
  } finally {
    await connection.end();
  }

  // The migration module applies idempotent additions and exits when complete.
  require('./migrate_all.cjs');
}

prepare().catch((error) => {
  console.error('Database preparation failed:', error);
  process.exit(1);
});
