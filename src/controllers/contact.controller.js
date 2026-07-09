const pool = require('../plugins/db');
const transporter = require('../plugins/mailer');

const ensureContactSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_submissions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      email VARCHAR(150) NOT NULL,
      subject VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE contact_submissions
    ADD COLUMN IF NOT EXISTS is_replied BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS reply_message TEXT
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id SERIAL PRIMARY KEY,
      submission_id INTEGER NOT NULL REFERENCES contact_submissions(id) ON DELETE CASCADE,
      sender VARCHAR(10) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
};

// POST submit contact form
// POST submit contact form
const submitContact = async (request, reply) => {
  const { name, phone, email, subject, message } = request.body;

  if (!name || !phone || !email || !subject || !message) {
    return reply.code(400).send({ error: 'All fields are required.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO contact_submissions (name, phone, email, subject, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, phone, email, subject, message]
    );

    const submission = result.rows[0];

    // Add this first message to the conversation thread
    await pool.query(
      `INSERT INTO contact_messages (submission_id, sender, message)
       VALUES ($1, 'member', $2)`,
      [submission.id, message]
    );

    return reply.code(201).send({
      message: 'Message sent successfully',
      submission,
    });
  } catch (err) {
    console.error('CONTACT SUBMIT ERROR:', err.message);
    reply.code(500).send({ error: err.message });
  }
};
// GET all contact submissions (admin)
const getAllContacts = async (request, reply) => {
  try {
    const result = await pool.query(
      `SELECT * FROM contact_submissions ORDER BY created_at DESC`
    );
    return result.rows;
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

// GET single contact submission
const getContact = async (request, reply) => {
  try {
    const result = await pool.query(
      `SELECT * FROM contact_submissions WHERE id = $1`,
      [request.params.id]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: 'Submission not found' });
    return result.rows[0];
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

// PATCH mark as read
const markAsRead = async (request, reply) => {
  try {
    const result = await pool.query(
      `UPDATE contact_submissions SET is_read = true WHERE id = $1 RETURNING *`,
      [request.params.id]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: 'Submission not found' });
    return { message: 'Marked as read', submission: result.rows[0] };
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

// DELETE contact submission
const deleteContact = async (request, reply) => {
  try {
    const result = await pool.query(
      `DELETE FROM contact_submissions WHERE id = $1 RETURNING id`,
      [request.params.id]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: 'Submission not found' });
    return { message: 'Submission deleted successfully' };
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

// POST send reply to a contact submission
// POST send reply to a contact submission
const sendReply = async (request, reply) => {
  const { message } = request.body;
  const { id } = request.params;

  if (!message || !message.trim()) {
    return reply.code(400).send({ error: 'Reply message is required.' });
  }

  try {
    const existing = await pool.query(
      `SELECT * FROM contact_submissions WHERE id = $1`,
      [id]
    );

    if (!existing.rows[0]) {
      return reply.code(404).send({ error: 'Submission not found' });
    }

    const submission = existing.rows[0];

    // Send the email to the member
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: submission.email,
      subject: `Re: ${submission.subject}`,
      text: message,
    });

    // Save the reply status on the submission
    const result = await pool.query(
      `UPDATE contact_submissions
       SET is_replied = true, replied_at = NOW(), reply_message = $1
       WHERE id = $2 RETURNING *`,
      [message, id]
    );

    // Add this reply to the conversation thread
    await pool.query(
      `INSERT INTO contact_messages (submission_id, sender, message)
       VALUES ($1, 'admin', $2)`,
      [id, message]
    );

    return {
      message: 'Reply sent successfully',
      submission: result.rows[0],
    };
  } catch (err) {
    console.error('SEND REPLY ERROR:', err.message);
    reply.code(500).send({ error: err.message });
  }
};

// GET conversation thread for a submission
const getMessages = async (request, reply) => {
  try {
    const result = await pool.query(
      `SELECT * FROM contact_messages WHERE submission_id = $1 ORDER BY created_at ASC`,
      [request.params.id]
    );
    return result.rows;
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};
module.exports = {
  ensureContactSchema,
  submitContact,
  getAllContacts,
  getContact,
  markAsRead,
  deleteContact,
  sendReply,
  getMessages,
};