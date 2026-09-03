const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getTransporter, sendGmail } = require('../config/mailer');

// ✅ In-memory store for login attempts
const loginAttempts = {};
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 minutes

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
          error: `Too many failed attempts. Account locked for 10 minutes.`,
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

// Helper: Generate 6-digit numeric OTP code
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Register (Stage 1: Store in pending_registrations & send OTP email)
router.post('/api/register', async (req, res) => {
  const { prefix, full_name, email, password, recaptcha_token } = req.body;
  try {
    if (!email || !full_name || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    // Google reCAPTCHA Verification
    if (!recaptcha_token) {
      return res.status(400).json({ error: 'reCAPTCHA token is missing.' });
    }

    try {
      const googleResponse = await fetch(
        `https://www.google.com/recaptcha/api/siteverify?secret=${encodeURIComponent(process.env.RECAPTCHA_SECRET_KEY)}&response=${encodeURIComponent(recaptcha_token)}`,
        { method: 'POST' }
      );
      const googleData = await googleResponse.json();

      if (!googleData.success) {
        return res.status(400).json({ error: 'reCAPTCHA verification failed. Please try again.' });
      }
    } catch (verifyErr) {
      console.error('reCAPTCHA verification system error:', verifyErr.message);
      return res.status(500).json({ error: 'Failed to verify reCAPTCHA. Please try again later.' });
    }

    const emailLower = email.toLowerCase().trim();
    if (!emailLower.endsWith('.edu') && !emailLower.endsWith('.edu.ph')) {
      return res.status(400).json({ error: 'You must use a valid school email address (.edu or .edu.ph).' });
    }

    const existing = await db.query('SELECT id FROM instructors WHERE school_email = $1', [emailLower]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const otpCode = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.query(`
      INSERT INTO pending_registrations (email, prefix, full_name, password_hash, otp_code, otp_expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET
        prefix = EXCLUDED.prefix,
        full_name = EXCLUDED.full_name,
        password_hash = EXCLUDED.password_hash,
        otp_code = EXCLUDED.otp_code,
        otp_expires_at = EXCLUDED.otp_expires_at,
        created_at = NOW()
    `, [emailLower, prefix, full_name.trim(), passwordHash, otpCode, otpExpiresAt]);

    const transporter = getTransporter();
    if (transporter) {
      try {
        const res = await sendGmail(
          emailLower,
          "TSEK - Email Verification Code",
          `Hello ${full_name},\n\nYour TSEK verification code is: ${otpCode}\n\nThis code will expire in 10 minutes.`,
          `<p>Hello <strong>${full_name}</strong>,</p>
                 <p>Your verification code for TSEK is:</p>
                 <h2 style="font-size: 28px; letter-spacing: 6px; color: #2563eb; font-family: monospace;">${otpCode}</h2>
                 <p>This code will expire in 10 minutes.</p>`
        );
        
        console.log(`Verification email sent to ${emailLower} with Gmail ID: ${res.data.id}`);
      } catch (emailErr) {
        console.error('Email failed to send:', emailErr);
        return res.status(500).json({ error: 'Failed to send verification email. Please check your email configuration.' });
      }
    }

    res.status(200).json({
      message: 'Verification code sent to your email address.',
      email: emailLower
    });
  } catch (err) {
    console.error('Register error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Verify OTP (Stage 2: Validate OTP and create instructor account)
router.post('/api/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  try {
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    const emailLower = email.toLowerCase().trim();
    const cleanOtp = otp.toString().trim();

    const pendingResult = await db.query('SELECT * FROM pending_registrations WHERE email = $1', [emailLower]);
    if (pendingResult.rows.length === 0) {
      return res.status(400).json({ error: 'No pending registration found for this email. Please register again.' });
    }

    const pending = pendingResult.rows[0];

    if (new Date() > new Date(pending.otp_expires_at)) {
      return res.status(400).json({ error: 'Verification code has expired. Please click "Resend Code".' });
    }

    if (pending.otp_code !== cleanOtp) {
      return res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });
    }

    // OTP is valid! Create official instructor account
    const insertResult = await db.query(`
      INSERT INTO instructors (prefix, full_name, school_email, password_hash, is_verified)
      VALUES ($1, $2, $3, $4, true)
      RETURNING id, prefix, full_name, school_email
    `, [pending.prefix, pending.full_name, pending.email, pending.password_hash]);

    // Clean up pending registration
    await db.query('DELETE FROM pending_registrations WHERE email = $1', [emailLower]);

    const instructor = insertResult.rows[0];

    res.status(201).json({
      message: 'Email verified and account created successfully!',
      user: { id: instructor.id, prefix: instructor.prefix, name: instructor.full_name, email: instructor.school_email }
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resend OTP
router.post('/api/resend-otp', async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const emailLower = email.toLowerCase().trim();

    const existing = await db.query('SELECT id FROM instructors WHERE school_email = $1', [emailLower]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'This email is already registered and verified. Please log in.' });
    }

    const pendingResult = await db.query('SELECT * FROM pending_registrations WHERE email = $1', [emailLower]);
    if (pendingResult.rows.length === 0) {
      return res.status(400).json({ error: 'No pending registration found for this email. Please register.' });
    }

    const pending = pendingResult.rows[0];
    const newOtp = generateOTP();
    const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.query('UPDATE pending_registrations SET otp_code = $1, otp_expires_at = $2 WHERE email = $3', [
      newOtp,
      newExpiresAt,
      emailLower
    ]);

    const transporter = getTransporter();
    if (transporter) {
      try {
        const res = await sendGmail(
          emailLower,
          "TSEK - New Email Verification Code",
          `Hello ${pending.full_name},\n\nYour new TSEK verification code is: ${newOtp}\n\nThis code will expire in 10 minutes.`,
          `<p>Hello <strong>${pending.full_name}</strong>,</p>
                 <p>Your new verification code for TSEK is:</p>
                 <h2 style="font-size: 28px; letter-spacing: 6px; color: #2563eb; font-family: monospace;">${newOtp}</h2>
                 <p>This code will expire in 10 minutes.</p>`
        );
        
        console.log(`New verification email sent to ${emailLower} with Gmail ID: ${res.data.id}`);
      } catch (emailErr) {
        console.error('Email failed to send:', emailErr);
        return res.status(500).json({ error: 'Failed to send verification email. Please check your email configuration.' });
      }
    }

    res.json({ message: 'A new verification code has been sent to your email address.' });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Legacy Verify Email Link endpoint
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

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  }
  
  if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return res.status(400).json({ error: 'New password must contain at least one uppercase letter, one lowercase letter, and one number.' });
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

// Debug mailer
router.get('/api/debug-mailer', (req, res) => {
  const { getTransporter } = require('../config/mailer');
  res.json({
    transporterExists: !!getTransporter(),
    gmailClientIdExists: !!process.env.GMAIL_CLIENT_ID,
    gmailClientSecretExists: !!process.env.GMAIL_CLIENT_SECRET,
    gmailRefreshTokenExists: !!process.env.GMAIL_REFRESH_TOKEN,
  });
});

module.exports = router;