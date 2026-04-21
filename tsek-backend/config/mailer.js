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
    const account = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: account.user, pass: account.pass },
    });
    console.log('Ethereal SMTP fallback configured.');
  }
}

function getTransporter() {
  return transporter;
}

module.exports = { initMailer, getTransporter };
