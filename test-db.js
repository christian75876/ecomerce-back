require('dotenv').config();
const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
console.log('DATABASE_URL set:', !!url);
console.log('Host:', url ? new URL(url).hostname : 'N/A');

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

pool.query('SELECT 1 AS ok', (err, result) => {
  if (err) {
    console.error('CONNECTION FAILED:', err.message);
  } else {
    console.log('CONNECTION OK:', result.rows);
  }
  pool.end();
});
