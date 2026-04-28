const { Pool } = require('pg');

async function runMigrations() {
  const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'tsek_db',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
  });

  try {
    await pool.query('ALTER TABLE instructors ADD COLUMN is_verified BOOLEAN DEFAULT false;');
    console.log('Migration: Added is_verified column');
  } catch (err) {
    if (err.code !== '42701') console.error('Migration error:', err);
  }

  try {
    await pool.query('ALTER TABLE instructors ADD COLUMN verification_token VARCHAR(255);');
    console.log('Migration: Added verification_token column');
  } catch (err) {
    if (err.code !== '42701') console.error('Migration error:', err);
  }

  // Set existing to true so we don't lock out dummy accounts
  await pool.query('UPDATE instructors SET is_verified = true WHERE is_verified = false;');

  try {
    await pool.query('ALTER TABLE exams ADD COLUMN answer_key JSONB;');
    console.log('Migration: Added answer_key column to exams');
  } catch (err) {
    if (err.code !== '42701') console.error('Migration error:', err);
  }

  await pool.end();
}

module.exports = runMigrations;
