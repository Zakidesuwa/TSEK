const nodemailer = require('nodemailer');

let transporter;

async function initMailer() {
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
    // Skip Ethereal in production — it hangs on cloud servers
    console.log('No SMTP credentials found. Email sending is disabled.');
    transporter = null;
  }
}

function getTransporter() {
  return transporter;
}

module.exports = { initMailer, getTransporter };
