const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const pool = require('./plugins/db');

const config = {
  imap: {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASS,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    authTimeout: 10000,
    tlsOptions: { rejectUnauthorized: false },
  },
};

// Extracts only the new reply text, removing quoted "On ... wrote:" history
function extractReplyText(text) {
  if (!text) return '';
  const markers = [
    /On .* wrote:/i,
    /-----Original Message-----/i,
    /From:.*Sent:.*To:.*Subject:/is,
  ];
  let cleanText = text;
  for (const marker of markers) {
    const match = cleanText.match(marker);
    if (match) {
      cleanText = cleanText.slice(0, match.index);
      break;
    }
  }
  return cleanText.trim();
}

async function checkMail() {
  try {
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    const searchCriteria = ['UNSEEN'];
    const fetchOptions = { bodies: [''], markSeen: true };

    const messages = await connection.search(searchCriteria, fetchOptions);

    for (const item of messages) {
      const raw = item.parts.find(part => part.which === '').body;
      const parsed = await simpleParser(raw);

      const fromEmail = parsed.from?.value?.[0]?.address?.toLowerCase();
      if (!fromEmail) continue;

      // Skip if this looks like our own sent mail
      if (fromEmail === process.env.EMAIL_USER.toLowerCase()) continue;

      const replyText = extractReplyText(parsed.text);
      if (!replyText) continue;

      // Find the most recent submission from this email address
      const submissionResult = await pool.query(
        `SELECT id FROM contact_submissions WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
        [fromEmail]
      );

      if (submissionResult.rows[0]) {
        const submissionId = submissionResult.rows[0].id;

        await pool.query(
          `INSERT INTO contact_messages (submission_id, sender, message) VALUES ($1, 'member', $2)`,
          [submissionId, replyText]
        );

        console.log(`New member reply saved for submission ${submissionId}`);
      }
    }

    connection.end();
  } catch (err) {
    console.error('MAIL LISTENER ERROR:', err.message);
  }
}

function startMailListener() {
  checkMail();
  setInterval(checkMail, 60 * 1000); // check every 60 seconds
}

module.exports = startMailListener;