require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'tsek_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

(async () => {
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
})();

// Database query wrapper
const express = require('express');
const cors = require('cors');
const db = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const authMiddleware = require('./authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Set up Real or Ethereal Email transporter
let transporter;
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log('Real SMTP configured successfully.');
} else {
  nodemailer.createTestAccount().then(account => {
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: account.user, pass: account.pass },
    });
    console.log('Ethereal SMTP fallback configured.');
  });
}

// Test Database Connection Route
app.get('/api/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ 
      status: 'success', 
      message: 'Connected to PostgreSQL successfully!',
      timestamp: result.rows[0].now
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

// --- Authentication Endpoints ---
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // Check if user exists
    const result = await db.query('SELECT * FROM instructors WHERE school_email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const instructor = result.rows[0];

    // Check if verified
    if (!instructor.is_verified) {
      return res.status(403).json({ error: 'Please verify your email address before logging in.' });
    }

    // Verify passwords
    const isValid = await bcrypt.compare(password, instructor.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 3. Generate JWT
    const token = jwt.sign(
      { id: instructor.id, email: instructor.school_email, name: `${instructor.prefix || ''} ${instructor.full_name}`.trim() },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '8h' }
    );

    res.json({ 
      message: 'Login successful', 
      token, 
      user: { id: instructor.id, prefix: instructor.prefix, name: instructor.full_name, email: instructor.school_email } 
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/register', async (req, res) => {
  const { prefix, full_name, email, password } = req.body;
  try {
    // 0. Validate school email domain
    const emailLower = email.toLowerCase();
    if (!emailLower.endsWith('.edu') && !emailLower.endsWith('.edu.ph')) {
      return res.status(400).json({ error: 'You must use a valid school email address (.edu or .edu.ph).' });
    }

    // 1. Check if email exists
    const existing = await db.query('SELECT id FROM instructors WHERE school_email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // 2. Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 3. Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // 4. Insert user
    const result = await db.query(`
      INSERT INTO instructors (prefix, full_name, school_email, password_hash, is_verified, verification_token)
      VALUES ($1, $2, $3, $4, false, $5)
      RETURNING id, prefix, full_name, school_email
    `, [prefix, full_name, email, passwordHash, verificationToken]);

    const instructor = result.rows[0];

    // 5. Send verification email
    if (transporter) {
      const verificationLink = `http://localhost:4200/verify-email?token=${verificationToken}`;
      const info = await transporter.sendMail({
        from: '"TSEK App" <noreply@tsek.app>',
        to: email,
        subject: "Verify your TSEK Account",
        text: `Please click this link to verify your account: ${verificationLink}`,
        html: `<p>Hello ${full_name},</p><p>Please <a href="${verificationLink}">click here</a> to verify your account.</p>`,
      });
      console.log(process.env.SMTP_USER ? "Real verification email sent!" : "Ethereal verification email sent! Preview URL: %s", nodemailer.getTestMessageUrl(info));
    }

    res.status(201).json({
      message: 'Registration successful! Please check your email to verify your account.',
      user: { id: instructor.id, prefix: instructor.prefix, name: instructor.full_name, email: instructor.school_email }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/verify-email', async (req, res) => {
  const { token } = req.query;
  try {
    const result = await db.query('SELECT id FROM instructors WHERE verification_token = $1', [token]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    const instructorId = result.rows[0].id;
    await db.query('UPDATE instructors SET is_verified = true, verification_token = NULL WHERE id = $1', [instructorId]);
    
    res.json({ message: 'Email successfully verified' });
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Dashboard Endpoints ---
app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  const instructorId = req.user.id;
  try {
    const statsRes = await db.query(`
      SELECT 
        COUNT(er.id) as total_sheets,
        COALESCE(SUM(er.score)::float / NULLIF(SUM(e.total_items), 0) * 100, 0) as accuracy
      FROM exam_results er
      JOIN exams e ON er.exam_id = e.id
      JOIN classes c ON e.class_id = c.id
      WHERE c.instructor_id = $1
    `, [instructorId]);
    
    const examsRes = await db.query(`
      SELECT COUNT(e.id) FROM exams e
      JOIN classes c ON e.class_id = c.id
      WHERE c.instructor_id = $1
    `, [instructorId]);
    
    const classesRes = await db.query('SELECT COUNT(*) FROM classes WHERE instructor_id = $1', [instructorId]);
    
    const accuracyNum = parseFloat(statsRes.rows[0].accuracy);
    const accuracyStr = accuracyNum > 0 ? accuracyNum.toFixed(1) + '%' : '0.0%';

    res.json({
      totalSheets: parseInt(statsRes.rows[0].total_sheets, 10),
      accuracy: accuracyStr,
      activeExams: parseInt(examsRes.rows[0].count, 10),
      classesCount: parseInt(classesRes.rows[0].count, 10)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/api/dashboard/recent-exams', authMiddleware, async (req, res) => {
  const instructorId = req.user.id;
  try {
    const result = await db.query(`
      SELECT 
        e.id, 
        e.exam_title as name, 
        c.class_name as subject, 
        e.total_items as volume,
        'COMPLETED' as status,
        100 as progress
      FROM exams e
      JOIN classes c ON e.class_id = c.id
      WHERE c.instructor_id = $1
      ORDER BY e.id DESC
      LIMIT 5
    `, [instructorId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch recent exams' });
  }
});

app.get('/api/dashboard/classes', authMiddleware, async (req, res) => {
  const instructorId = req.user.id;
  try {
    const result = await db.query(`
      SELECT 
        c.section_code as block, 
        COUNT(ce.student_id) as students
      FROM classes c
      LEFT JOIN class_enrollments ce ON c.id = ce.class_id
      WHERE c.instructor_id = $1
      GROUP BY c.id, c.section_code
    `, [instructorId]);
    // Convert count string to number
    const formatted = result.rows.map(r => ({ block: r.block, students: parseInt(r.students, 10) }));
    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch class blocks' });
  }
});

// --- Classes Page Endpoints ---
app.get('/api/classes', authMiddleware, async (req, res) => {
  const instructorId = req.user.id;
  try {
    const result = await db.query(`
      SELECT 
        c.id,
        c.class_name as subject, 
        c.section_code as section,
        COUNT(ce.student_id) as students,
        'Oct 20' as "nextQuiz"
      FROM classes c
      LEFT JOIN class_enrollments ce ON c.id = ce.class_id
      WHERE c.instructor_id = $1
      GROUP BY c.id, c.class_name, c.section_code
    `, [instructorId]);
    const formatted = result.rows.map(r => ({
      ...r,
      students: parseInt(r.students, 10)
    }));
    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

app.post('/api/classes', authMiddleware, async (req, res) => {
  const instructorId = req.user.id;
  const { class_name, section_code } = req.body;
  try {
    const result = await db.query(`
      INSERT INTO classes (instructor_id, class_name, section_code)
      VALUES ($1, $2, $3)
      RETURNING id, class_name as subject, section_code as section
    `, [instructorId, class_name, section_code]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create class' });
  }
});

app.get('/api/exams', authMiddleware, async (req, res) => {
  const instructorId = req.user.id;
  try {
    const result = await db.query(`
      SELECT 
        e.id,
        c.class_name as subject,
        e.exam_title as name,
        e.total_items,
        e.created_at as date,
        'Multiple Choice' as types,
        'ACTIVE' as status
      FROM exams e
      JOIN classes c ON e.class_id = c.id
      WHERE c.instructor_id = $1
      ORDER BY e.created_at DESC
    `, [instructorId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch exams' });
  }
});

app.get('/api/classes/:id/students', authMiddleware, async (req, res) => {
  try {
    const classId = req.params.id;
    
    // 1. Fetch all exams for this class
    const examsRes = await db.query('SELECT id, exam_title, total_items FROM exams WHERE class_id = $1 ORDER BY created_at ASC', [classId]);
    const classExams = examsRes.rows;
    const examNames = classExams.map(e => e.exam_title);

    // 2. Fetch all students enrolled in this class
    const studentsRes = await db.query(`
      SELECT 
        s.id,
        s.full_name as name,
        s.student_id_number as number
      FROM students s
      JOIN class_enrollments ce ON s.id = ce.student_id
      WHERE ce.class_id = $1
      ORDER BY s.full_name ASC
    `, [classId]);
    
    // 3. For each student, find their scores for the respective exams
    const students = await Promise.all(studentsRes.rows.map(async (student) => {
      const scores = [];
      for (const exam of classExams) {
        const resultRes = await db.query(`
          SELECT score FROM exam_results WHERE exam_id = $1 AND student_id = $2
        `, [exam.id, student.id]);
        
        if (resultRes.rows.length > 0) {
          scores.push(`${resultRes.rows[0].score}/${exam.total_items}`);
        } else {
          scores.push(`--/${exam.total_items}`);
        }
      }
      return {
        name: student.name,
        number: student.number,
        scores: scores
      };
    }));
    
    res.json({ exams: examNames, students });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

app.post('/api/exams', authMiddleware, async (req, res) => {
  const { class_id, exam_title, total_items, config } = req.body;
  try {
    const result = await db.query(`
      INSERT INTO exams (class_id, exam_title, total_items, config)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [class_id, exam_title, total_items, JSON.stringify(config)]);
    
    res.json({ success: true, exam_id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save exam' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
