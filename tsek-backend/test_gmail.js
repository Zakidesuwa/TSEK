require('dotenv').config();
const { initMailer, getTransporter, sendGmail } = require('./config/mailer');

async function testGmail() {
  console.log("⏳ Initializing Mailer...");
  await initMailer();

  const client = getTransporter();
  if (!client) {
    console.error("❌ ERROR: Gmail client failed to initialize. Check your credentials.");
    process.exit(1);
  }

  console.log("✅ Gmail client initialized.");
  console.log("⏳ Sending test email...");

  try {
    const res = await sendGmail(
      '202312278@gordoncollege.edu.ph', // Fallback to their email
      'Test Email via Gmail API (OAuth2)',
      'This is a test email sent using the official Gmail REST API.',
      '<strong>This is a test email sent using the official Gmail REST API.</strong>'
    );
    console.log("✅ Email sent successfully!");
    console.log("Response:", res.data);
    process.exit(0);
  } catch (err) {
    console.error("❌ ERROR sending email:", err);
    process.exit(1);
  }
}

testGmail();
