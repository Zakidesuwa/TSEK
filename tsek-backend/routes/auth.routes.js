const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { getTransporter } = require('../config/mailer');

// Login
router.post('/api/login', async (req, res) => {
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

// Register
router.post('/api/register', async (req, res) => {
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
    const transporter = getTransporter();
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
