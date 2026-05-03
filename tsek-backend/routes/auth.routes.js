const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { getTransporter } = require('../config/mailer');

// ✅ In-memory store for login attempts
const loginAttempts = {};
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 15 minutes

// ✅ Helper: check if account is locked
function isLocked(email) {
  const record = loginAttempts[email];
  if (!record) return false;
  if (record.count >= MAX_ATTEMPTS) {
    const elapsed = Date.now() - record.lastAttempt;
    if (elapsed < LOCKOUT_DURATION_MS) return true;
    delete loginAttempts[email]; // lockout expired, reset
  }
  return false;
}

// ✅ Helper: get remaining lockout time in seconds
function getRemainingLockout(email) {
  const record = loginAttempts[email];
  if (!record) return 0;
  const elapsed = Date.now() - record.lastAttempt;
  return Math.ceil((LOCKOUT_DURATION_MS - elapsed) / 1000);
}

// ✅ Helper: record a failed attempt
function recordFailedAttempt(email) {
  if (!loginAttempts[email]) {
    loginAttempts[email] = { count: 0, lastAttempt: null };
  }
  loginAttempts[email].count += 1;
  loginAttempts[email].lastAttempt = Date.now();
}

// ✅ Helper: reset attempts on success
function resetAttempts(email) {
  delete loginAttempts[email];
}

// Login
router.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {

    // ✅ 1. Check if account is locked out
    if (isLocked(email)) {
      const remaining = getRemainingLockout(email);
      return res.status(429).json({
        error: `Too many failed attempts. Try again in ${Math.ceil(remaining / 60)} minute(s).`,
        remainingSeconds: remaining
      });
    }

    // 2. Check if user exists
    const result = await db.query('SELECT * FROM instructors WHERE school_email = $1', [email]);
    if (result.rows.length === 0) {
      recordFailedAttempt(email); // ✅ count attempt
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const instructor = result.rows[0];

    // 3. Check if verified
    if (!instructor.is_verified) {
      return res.status(403).json({ error: 'Please verify your email address before logging in.' });
    }

    // 4. Verify password
    const isValid = await bcrypt.compare(password, instructor.password_hash);
    if (!isValid) {
      recordFailedAttempt(email); // ✅ count attempt

      const attemptsLeft = MAX_ATTEMPTS - loginAttempts[email].count;
      if (attemptsLeft <= 0) {
        return res.status(429).json({
          error: `Too many failed attempts. Account locked for 15 minutes.`,
          remainingSeconds: LOCKOUT_DURATION_MS / 1000
        });
      }

      return res.status(401).json({
        error: `Invalid email or password. ${attemptsLeft} attempt(s) left.`,
        attemptsLeft
      });
    }

    // ✅ 5. Success — reset attempts
    resetAttempts(email);

    // 6. Generate JWT
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

// Register
router.post('/api/register', async (req, res) => {
  const { prefix, full_name, email, password } = req.body;
  try {
    const emailLower = email.toLowerCase();
    if (!emailLower.endsWith('.edu') && !emailLower.endsWith('.edu.ph')) {
      return res.status(400).json({ error: 'You must use a valid school email address (.edu or .edu.ph).' });
    }

    const existing = await db.query('SELECT id FROM instructors WHERE school_email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const result = await db.query(`
      INSERT INTO instructors (prefix, full_name, school_email, password_hash, is_verified, verification_token)
      VALUES ($1, $2, $3, $4, true, $5)
      RETURNING id, prefix, full_name, school_email
    `, [prefix, full_name, email, passwordHash, verificationToken]);

    const instructor = result.rows[0];

    res.status(201).json({
      message: 'Registration successful!',
      user: { id: instructor.id, prefix: instructor.prefix, name: instructor.full_name, email: instructor.school_email }
    });

    const transporter = getTransporter();
    if (transporter) {
      transporter.sendMail({
        from: '"TSEK App" <noreply@tsek.app>',
        to: email,
        subject: "Welcome to TSEK",
        text: `Account created successfully! You can now log in.`,
        html: `<p>Hello ${full_name},</p><p>Your account has been created and verified. You can now log in to TSEK.</p>`,
      }).catch(err => console.log('Background email failed (Expected on Render):', err.message));
    }
  } catch (err) {
    console.error('Register error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Verify Email
router.get('/api/verify-email', async (req, res) => {
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

// Change Password
const authMiddleware = require('../authMiddleware');
router.post('/api/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  try {
    const result = await db.query('SELECT password_hash FROM instructors WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE instructors SET password_hash = $1 WHERE id = $2', [newHash, userId]);

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

module.exports = router;