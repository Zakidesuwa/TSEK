require('dotenv').config();
const { Resend } = require('resend');

if (!process.env.RESEND_API_KEY) {
  console.error("❌ ERROR: RESEND_API_KEY is not set in your .env file.");
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);

async function testResend() {
  console.log("⏳ Testing Resend API...");
  try {
    const { data, error } = await resend.emails.send({
      from: 'TSEK App <noreply@tsek.app>', // Change this if you haven't verified tsek.app
      to: '202312278@gordoncollege.edu.ph', // Change to an email address you own
      subject: 'Test Email from Resend',
      html: '<p>This is a test email sent using the Resend API.</p>'
    });

    if (error) {
      console.error("❌ ERROR sending email:", error);
    } else {
      console.log("✅ Email sent successfully! Data:", data);
    }
  } catch (err) {
    console.error("❌ CRITICAL ERROR:", err);
  }
}

testResend();
