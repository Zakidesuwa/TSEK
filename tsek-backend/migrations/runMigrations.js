const { Pool } = require('pg');

async function runMigrations() {
  const pool = process.env.DATABASE_URL 
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    : new Pool({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'tsek_db',
        password: process.env.DB_PASSWORD || 'password',
        port: process.env.DB_PORT || 5432,
      });

  try {
    // 1. Core Tables (Base Schema)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS instructors (
        id SERIAL PRIMARY KEY,
        prefix VARCHAR(20),
        full_name VARCHAR(255) NOT NULL,
        school_email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        instructor_id INTEGER REFERENCES instructors(id) ON DELETE CASCADE,
        class_name VARCHAR(255) NOT NULL,
        section_code VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS exams (
        id SERIAL PRIMARY KEY,
        class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
        exam_title VARCHAR(255) NOT NULL,
        total_items INTEGER NOT NULL,
        config JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Migration: Core tables initialized');
  } catch (err) {
    console.error('Migration error (core tables):', err);
  }

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

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        student_id_number VARCHAR(50) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Migration: Ensured students table exists');
  } catch (err) {
    console.error('Migration error (students):', err);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS class_enrollments (
        id SERIAL PRIMARY KEY,
        class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(class_id, student_id)
      );
    `);
    console.log('Migration: Ensured class_enrollments table exists');
  } catch (err) {
    console.error('Migration error (class_enrollments):', err);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exam_results (
        id SERIAL PRIMARY KEY,
        exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        score NUMERIC NOT NULL DEFAULT 0,
        scanned_image_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(exam_id, student_id)
      );
    `);
    console.log('Migration: Ensured exam_results table exists');
  } catch (err) {
    console.error('Migration error (exam_results):', err);
  }

  try {
    await pool.query('ALTER TABLE exam_results ADD CONSTRAINT unique_exam_student UNIQUE(exam_id, student_id);');
    console.log('Migration: Added unique constraint to exam_results');
  } catch (err) {
    if (err.code !== '42710' && err.code !== '23505') {
        // 23505 might be thrown if there are already duplicate rows, we should handle that too
        console.error('Migration error (unique constraint):', err);
    }
  }

  try {
    await pool.query('ALTER TABLE exam_results ADD COLUMN graded_items JSONB;');
    console.log('Migration: Added graded_items column to exam_results');
  } catch (err) {
    if (err.code !== '42701') console.error('Migration error:', err);
  }

  await pool.end();
}

module.exports = runMigrations;
