const pool = require('../plugins/db');

require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function memberRoutes(fastify, options) {

  // GET latest member ID
  fastify.get('/latest-id', async (request, reply) => {
    try {
      const result = await pool.query(
        'SELECT application_id FROM members ORDER BY created_at DESC LIMIT 1'
      );
      const latestId = result.rows[0]?.application_id || 'NCIO0000';
      return { latestId };
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  // GET - Dashboard stats (MUST be before /:id)
  fastify.get('/stats/dashboard', async (request, reply) => {
    try {
      const total = await pool.query('SELECT COUNT(*) FROM members');
      const approved = await pool.query("SELECT COUNT(*) FROM members WHERE status = 'APPROVED'");
      const pending = await pool.query("SELECT COUNT(*) FROM members WHERE status = 'PENDING'");
      const rejected = await pool.query("SELECT COUNT(*) FROM members WHERE status = 'REJECTED'");
      const byMonth = await pool.query(`
        SELECT TO_CHAR(created_at, 'Mon YYYY') as month, COUNT(*) as count
        FROM members GROUP BY month ORDER BY MIN(created_at) DESC LIMIT 6
      `);
      const byDistrict = await pool.query(`
        SELECT district, COUNT(*) as count FROM members GROUP BY district ORDER BY count DESC LIMIT 10
      `);
      const byMembership = await pool.query(`
        SELECT membership_type, COUNT(*) as count FROM members GROUP BY membership_type
      `);

      return {
        total: parseInt(total.rows[0].count),
        approved: parseInt(approved.rows[0].count),
        pending: parseInt(pending.rows[0].count),
        rejected: parseInt(rejected.rows[0].count),
        byMonth: byMonth.rows,
        byDistrict: byDistrict.rows,
        byMembership: byMembership.rows,
      };
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  // GET - Public ID search (MUST be before /:id)
  // GET - Public ID search (MUST be before /:id)
fastify.get('/search/public', async (request, reply) => {
  try {
    const { mobile, dob } = request.query;
    console.log('Search params:', { mobile, dob });

    if (!mobile || !dob) return reply.code(400).send({ error: 'Mobile and DOB required' });

    const result = await pool.query(
      `SELECT full_name, district, zone, membership_type, status, id_card_number, application_id, photo, father_name, approved_at
 FROM members WHERE phone = $1 AND date_of_birth::text = $2`,
      [mobile, dob]
    );

    console.log('Found rows:', result.rows.length);

    if (!result.rows[0]) return reply.code(404).send({ error: 'Member not found' });
    return result.rows[0];
  } catch (err) {
    console.error('SEARCH ERROR:', err.message);
    reply.code(500).send({ error: err.message });
  }
});
  // POST - Submit new member application
  fastify.post('/', async (request, reply) => {
    const {
      applicationId, fullName, dateOfBirth, fatherName, guardianName,
      gender, nationality, doorNo, street, city, district, zone,
      state, pinCode, phone, email, aadharNumber, education,
      qualificationDetails, membershipType, previousMembership,
      photo, signature, declaration,
    } = request.body;

    try {
      const result = await pool.query(
        `INSERT INTO members (
          application_id, full_name, date_of_birth, father_name, guardian_name,
          gender, nationality, door_no, street, city, district, zone,
          state, pin_code, phone, email, aadhar_number, education,
          qualification_details, membership_type, previous_membership,
          photo, signature, declaration, status, created_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
          $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,'PENDING', NOW()
        ) RETURNING *`,
        [
          applicationId, fullName, dateOfBirth, fatherName, guardianName,
          gender, nationality, doorNo, street, city, district, zone,
          state, pinCode, phone, email, aadharNumber, education,
          qualificationDetails, membershipType, previousMembership,
          photo, signature, Boolean(declaration),
        ]
      );
    // Send email to admin
try {
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: process.env.ADMIN_EMAIL,
    subject: `New NCIO Application - ${applicationId}`,
    html: `
      <h2>New Membership Application</h2>
      <p><b>ID:</b> ${applicationId}</p>
      <p><b>Name:</b> ${fullName}</p>
      <p><b>Phone:</b> ${phone}</p>
      <p><b>District:</b> ${district}</p>
      <p><b>Type:</b> ${membershipType}</p>
      // <p>Login to admin panel to review.</p>
    `,
  });
  console.log('✅ Email sent to admin');
} catch (emailErr) {
  console.error('❌ Email error:', emailErr.message);
}
      return reply.code(201).send({
        message: 'Application submitted successfully',
        memberId: result.rows[0].application_id,
      });
    } catch (err) {
      console.error('INSERT ERROR:', err.message);
      reply.code(500).send({ error: err.message });
    }
  });

  // GET all members
  fastify.get('/', async (request, reply) => {
    try {
      const { status, district, zone, membershipType, month } = request.query;
      let query = 'SELECT * FROM members WHERE 1=1';
      const params = [];
      let i = 1;

      if (status) { query += ` AND status = $${i++}`; params.push(status); }
      if (district) { query += ` AND district = $${i++}`; params.push(district); }
      if (zone) { query += ` AND zone = $${i++}`; params.push(zone); }
      if (membershipType) { query += ` AND membership_type = $${i++}`; params.push(membershipType); }
      if (month) { query += ` AND TO_CHAR(created_at, 'YYYY-MM') = $${i++}`; params.push(month); }

      query += ' ORDER BY created_at DESC';
      const result = await pool.query(query, params);
      return result.rows;
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  // GET single member
  fastify.get('/:id', async (request, reply) => {
    try {
      const result = await pool.query(
        'SELECT * FROM members WHERE id = $1', [request.params.id]
      );
      if (!result.rows[0]) return reply.code(404).send({ error: 'Member not found' });
      return result.rows[0];
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  // PATCH - Approve member
  fastify.patch('/:id/approve', async (request, reply) => {
    try {
      const member = await pool.query('SELECT * FROM members WHERE id = $1', [request.params.id]);
      if (!member.rows[0]) return reply.code(404).send({ error: 'Member not found' });

      const m = member.rows[0];
      const month = new Date().toISOString().slice(2, 7).replace('-', '');
      const countResult = await pool.query("SELECT COUNT(*) FROM members WHERE status = 'APPROVED'");
      const count = String(parseInt(countResult.rows[0].count) + 1).padStart(4, '0');
      const zoneCode = m.zone?.substring(0, 2).toUpperCase() || 'Z0';
      const idCardNumber = `TN-${zoneCode}-${month}-${count}`;

      await pool.query(
        `UPDATE members SET status = 'APPROVED', id_card_number = $1, approved_at = NOW() WHERE id = $2`,
        [idCardNumber, request.params.id]
      );
      // Send approval email to member
try {
  console.log('Sending to:', m.email);
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: m.email,
    subject: `🎉 NCIO Membership Approved - ${m.application_id}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;border:2px solid #1a237e;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0d1b5e,#1a237e);padding:24px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:22px;">NCIO</h1>
          <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:12px;">OFFICIAL MEMBER</p>
        </div>
        <div style="padding:24px;">
          <h2 style="color:#1a237e;">Congratulations, ${m.full_name}! 🎉</h2>
          <p style="color:#555;">Your NCIO membership has been <strong style="color:green;">APPROVED</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr style="background:#f8f9ff;">
              <td style="padding:8px 12px;color:#888;font-size:13px;">Application ID</td>
              <td style="padding:8px 12px;font-weight:bold;color:#1a237e;">${m.application_id}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;color:#888;font-size:13px;">ID Card Number</td>
              <td style="padding:8px 12px;font-weight:bold;font-family:monospace;color:#1a237e;">${idCardNumber}</td>
            </tr>
            <tr style="background:#f8f9ff;">
              <td style="padding:8px 12px;color:#888;font-size:13px;">Membership Type</td>
              <td style="padding:8px 12px;font-weight:bold;">${m.membership_type}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;color:#888;font-size:13px;">District</td>
              <td style="padding:8px 12px;font-weight:bold;">${m.district}</td>
            </tr>
          </table>
          <p style="color:#555;font-size:13px;">You can verify your membership at our public search page using your mobile number and date of birth.</p>
        </div>
        <div style="background:#f8f9ff;padding:12px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="color:#888;font-size:11px;margin:0;">© 2026 NCIO. All rights reserved.</p>
        </div>
      </div>
    `,
  });
  console.log('✅ Approval email sent to member');
} catch (emailErr) {
  console.error('❌ Approval email error:', emailErr.message);
}

      return { message: 'Member approved successfully', idCardNumber };
    } catch (err) {
      console.error('APPROVE ERROR:', err.message);
      reply.code(500).send({ error: err.message });
    }
  });

  // PATCH - Reject member
  fastify.patch('/:id/reject', async (request, reply) => {
    try {
      await pool.query(
        `UPDATE members SET status = 'REJECTED', rejected_at = NOW() WHERE id = $1`,
        [request.params.id]
      );
      return { message: 'Member rejected' };
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  // DELETE - Remove a member
  fastify.delete('/:id', async (request, reply) => {
    try {
      const result = await pool.query(
        'DELETE FROM members WHERE id = $1 RETURNING id',
        [request.params.id]
      );
      if (!result.rows[0]) return reply.code(404).send({ error: 'Member not found' });
      return { message: 'Member deleted successfully' };
    } catch (err) {
      console.error('DELETE ERROR:', err.message);
      reply.code(500).send({ error: err.message });
    }
  });
}

module.exports = memberRoutes;