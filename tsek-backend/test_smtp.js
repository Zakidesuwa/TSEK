require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('Starting SMTP test...');
console.log('User:', process.env.SMTP_USER);

const t = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

console.log('Sending email...');
t.sendMail({
  from: `TSEK App <${process.env.SMTP_USER}>`, // Try matching the authenticated user
  to: process.env.SMTP_USER,
  subject: 'Test',
  text: 'Test message'
})
.then(info => {
  console.log('Sent successfully:', info.response);
  process.exit(0);
})
.catch(err => {
  console.error('Send Error:', err);
  process.exit(1);
});
