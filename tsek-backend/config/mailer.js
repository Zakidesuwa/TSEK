const { google } = require('googleapis');

let gmailClient;

async function initMailer() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    try {
      const oAuth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'https://developers.google.com/oauthplayground'
      );
      
      oAuth2Client.setCredentials({ refresh_token: refreshToken });
      
      gmailClient = google.gmail({ version: 'v1', auth: oAuth2Client });
      console.log('Gmail REST API configured successfully.');
    } catch (err) {
      console.error('Failed to configure Gmail API:', err);
      gmailClient = null;
    }
  } else {
    console.log('No GMAIL credentials found. Email sending is disabled.');
    gmailClient = null;
  }
}

function getTransporter() {
  return gmailClient;
}

async function sendGmail(to, subject, text, html) {
  if (!gmailClient) throw new Error("Gmail client not initialized.");
  
  const from = `"TSEK App" <${process.env.SMTP_USER}>`;
  
  const str = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html || text
  ].join('\n');
  
  const encodedMail = Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
    
  const res = await gmailClient.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMail
    }
  });
  
  return res;
}

module.exports = { initMailer, getTransporter, sendGmail };
