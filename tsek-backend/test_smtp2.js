require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('Testing send with noreply@tsek.app');

const t = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

t.sendMail({
  from: '"TSEK App" <noreply@tsek.app>',
  to: process.env.SMTP_USER,
  subject: 'Test with noreply',
  text: 'Test message with noreply'
})
.then(info => {
  console.log('Sent successfully:', info.response);
  process.exit(0);
})
.catch(err => {
  console.error('Send Error:', err.message);
  process.exit(1);
});
