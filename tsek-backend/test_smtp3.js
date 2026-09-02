require('dotenv').config();
const nodemailer = require('nodemailer');

const t = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

t.sendMail({
  from: `"TSEK App" <${process.env.SMTP_USER}>`,
  to: '202312278@gordoncollege.edu.ph',
  subject: 'Test Direct Send',
  text: 'Test message'
})
.then(info => {
  console.log('Sent successfully:', info.response);
  process.exit(0);
})
.catch(err => {
  console.error('Send Error:', err.message);
  process.exit(1);
});
