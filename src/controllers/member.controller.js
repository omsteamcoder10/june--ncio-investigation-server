const pool = require('../plugins/db');
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_EMAIL = `"NCIO Official" <${process.env.SMTP_USER}>`;

const resolveAdminIdentifier = (request) => {
  const authHeader = request.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (token === 'ncio-admin-token') {
    return process.env.ADMIN_USERNAME || 'admin';
  }

  return process.env.ADMIN_USERNAME || 'admin';
};

const maskEmail = (email = '') => {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;

  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}***@${domain}`;
};

const ensureMemberVerificationSchema = async () => {
  await pool.query(`
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS email_verified_by VARCHAR(255)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_verification_otps (
      id SERIAL PRIMARY KEY,
      member_id INTEGER REFERENCES members(id),
      channel VARCHAR(10) NOT NULL,
      code VARCHAR(6) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      verified BOOLEAN DEFAULT false,
      triggered_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
};

// ✅ Logo base64 - puppeteer render-la use agum
const getLogoBase64 = () => {
  try {
    const logoPath = path.join(__dirname, '../../../client/public/logo/1.png');
    const logoBuffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch (err) {
    console.error('Logo read error:', err.message);
    return null;
  }
};

const generateIDCardPDF = async (member, idCardNumber) => {
  const isState = member.membership_type?.toUpperCase() === 'STATE';
  const isZonal = member.membership_type?.toUpperCase() === 'ZONAL';
  const primary = isState ? '#7f0000' : isZonal ? '#4a148c' : '#0d1b5e';
  const secondary = isState ? '#b71c1c' : isZonal ? '#7b1fa2' : '#1a237e';
  const label = isState ? 'STATE' : isZonal ? 'ZONAL' : 'DISTRICT';
  const approvedDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const dob = member.date_of_birth
    ? new Date(member.date_of_birth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '-';

  const logoBase64 = getLogoBase64();
  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" style="width:100%;height:100%;object-fit:cover;" />`
    : `<div style="color:${primary};font-weight:900;font-size:18px;">N</div>`;

  const photoHtml = member.photo
    ? `<img src="${member.photo}" style="width:92px;height:92px;border-radius:50%;object-fit:cover;border:3px solid ${primary};margin-top:14px;box-shadow:0 3px 10px rgba(0,0,0,0.18);background:#fff;" />`
    : `<div style="width:92px;height:92px;border-radius:50%;background:#f3f4f6;border:3px solid ${primary};margin-top:14px;display:flex;align-items:center;justify-content:center;color:#d1d5db;font-size:30px;">?</div>`;

  const html = `<!DOCTYPE html>
  <html><head><meta charset="UTF-8">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { width:260px; font-family:Arial,sans-serif; }
    .card {
      width:260px; min-height:400px; border-radius:10px; overflow:hidden; position:relative;
      background:#fff; border:2px solid ${primary};
      display:flex; flex-direction:column;
    }
    .header {
      background:linear-gradient(135deg, ${primary} 0%, ${secondary} 100%);
      padding:14px 10px 12px; text-align:center; position:relative;
    }
    .logo-circle {
      width:46px; height:46px; border-radius:50%; margin:0 auto 6px;
      background:white; border:2px solid rgba(255,255,255,0.7);
      display:flex; align-items:center; justify-content:center; overflow:hidden;
    }
    .org-line { color:white; font-weight:900; font-size:13px; letter-spacing:1px; line-height:1.25; }
    .badge {
      margin-top:4px; display:inline-block;
      background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.4);
      border-radius:4px; padding:2px 10px; color:white; font-size:8px; font-weight:700; letter-spacing:1.5px;
    }
    .photo-wrap { display:flex; justify-content:center; margin-top:-2px; }
    .name {
      text-align:center; font-weight:900; font-size:16px; color:${primary};
      margin-top:10px; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px; padding:0 10px;
    }
    .divider {
      height:2px; width:70%; margin:2px auto 12px;
      background:linear-gradient(90deg, transparent, ${secondary}, transparent);
    }
    .details { flex:1; padding:0 18px 16px; display:flex; flex-direction:column; gap:8px; }
    .info-row { display:flex; font-size:10.5px; }
    .info-label { width:90px; color:#374151; font-weight:700; }
    .info-colon { margin-right:6px; color:#374151; font-weight:700; }
    .info-value { flex:1; color:#111827; font-weight:500; overflow-wrap:anywhere; }
    .footer {
      background:linear-gradient(90deg, ${primary} 0%, ${secondary} 100%);
      padding:6px 14px; display:flex; justify-content:space-between; align-items:center;
    }
    .card-no { font-family:monospace; font-size:9px; color:white; font-weight:700; letter-spacing:0.5px; }
    .valid { font-size:8px; color:rgba(255,255,255,0.75); }
  </style></head>
  <body>
    <div class="card">
      <div class="header">
        <div class="logo-circle">${logoHtml}</div>
        <div class="org-line">NATIONAL CRIME</div>
        <div class="org-line">INVESTIGATES ORG.</div>
        <div class="badge">${label} MEMBER</div>
      </div>

      <div class="photo-wrap">${photoHtml}</div>

      <div class="name">${member.full_name}</div>
      <div class="divider"></div>

      <div class="details">
        <div class="info-row">
          <span class="info-label">Father Name</span>
          <span class="info-colon">:</span>
          <span class="info-value">${member.father_name || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Date of Birth</span>
          <span class="info-colon">:</span>
          <span class="info-value">${dob}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Mobile No.</span>
          <span class="info-colon">:</span>
          <span class="info-value">${member.phone || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Zone</span>
          <span class="info-colon">:</span>
          <span class="info-value">${member.zone || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">District</span>
          <span class="info-colon">:</span>
          <span class="info-value">${member.district || '-'}</span>
        </div>
      </div>

      <div class="footer">
        <div class="card-no">${idCardNumber}</div>
        <div class="valid">Valid: ${approvedDate}</div>
      </div>
    </div>
  </body></html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 260, height: 420 });
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const cardElement = await page.$('.card');
  const boundingBox = await cardElement.boundingBox();

  const pdfBuffer = await page.pdf({
    width: `${Math.ceil(boundingBox.width)}px`,
    height: `${Math.ceil(boundingBox.height)}px`,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await browser.close();
  return pdfBuffer;
};
// GET latest member ID
const getLatestId = async (request, reply) => {
  try {
    const month = new Date().toISOString().slice(2, 7).replace('-', '');
    const prefix = `NCIO-${month}-`;
    const result = await pool.query(
      `SELECT application_id
       FROM members
       WHERE application_id LIKE $1
       ORDER BY application_id DESC
       LIMIT 1`,
      [`${prefix}%`]
    );
    const latestId = result.rows[0]?.application_id || `${prefix}0000`;
    return { latestId };
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

// GET dashboard stats
const getDashboardStats = async (request, reply) => {
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
};

// GET public search
const publicSearch = async (request, reply) => {
  try {
    const { aadhar, dob } = request.query;
    if (!aadhar || !dob) return reply.code(400).send({ error: 'Aadhar number and DOB required' });
    const result = await pool.query(
      `SELECT full_name, district, zone, membership_type, status, id_card_number, application_id, photo, father_name, approved_at, created_at
       FROM members WHERE aadhar_number = $1 AND date_of_birth::text = $2`,
      [aadhar, dob]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: 'Member not found' });
    return result.rows[0];
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

// POST submit application
const submitApplication = async (request, reply) => {
  const {
    applicationId, fullName, dateOfBirth, fatherName, guardianName,
    gender, nationality, doorNo, street, city, district, zone,
    state, pinCode, phone, email, aadharNumber, education,
    qualificationDetails, membershipType, previousMembership,
    photo, signature, declaration,
  } = request.body;

  try {
    const existing = await pool.query(
      'SELECT application_id, status FROM members WHERE aadhar_number = $1 LIMIT 1',
      [aadharNumber]
    );

    if (existing.rows[0]) {
      return reply.code(409).send({
        error: 'An application already exists with this Aadhar number.',
        existingApplicationId: existing.rows[0].application_id,
        existingStatus: existing.rows[0].status,
      });
    }

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

    try {
      await transporter.sendMail({
        from: FROM_EMAIL,
        to: process.env.ADMIN_EMAIL,
        subject: `New NCIO Application - ${applicationId}`,
        html: `
          <h2>New Membership Application</h2>
          <p><b>ID:</b> ${applicationId}</p>
          <p><b>Name:</b> ${fullName}</p>
          <p><b>Phone:</b> ${phone}</p>
          <p><b>District:</b> ${district}</p>
          <p><b>Type:</b> ${membershipType}</p>
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
};

// GET all members
const getAllMembers = async (request, reply) => {
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
};

// GET single member
const getMember = async (request, reply) => {
  try {
    const result = await pool.query(
      'SELECT * FROM members WHERE id = $1', [request.params.id]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: 'Member not found' });
    return result.rows[0];
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

// PATCH approve member
const approveMember = async (request, reply) => {
  try {
    const member = await pool.query('SELECT * FROM members WHERE id = $1', [request.params.id]);
    if (!member.rows[0]) return reply.code(404).send({ error: 'Member not found' });

    const m = member.rows[0];
    const month = new Date().toISOString().slice(2, 7).replace('-', '');

    // ✅ FIXED: Use MAX to avoid duplicate ID card numbers
    const zoneCode = m.zone?.substring(0, 2).toUpperCase() || 'Z0';
    const prefix = `TN-${zoneCode}-${month}-`;
    const maxResult = await pool.query(
      `SELECT id_card_number FROM members WHERE id_card_number LIKE $1 ORDER BY id_card_number DESC LIMIT 1`,
      [`${prefix}%`]
    );
    let nextNum = 1;
    if (maxResult.rows[0]) {
      nextNum = parseInt(maxResult.rows[0].id_card_number.split('-').pop()) + 1;
    }
    const idCardNumber = `${prefix}${String(nextNum).padStart(4, '0')}`;

    await pool.query(
      `UPDATE members SET status = 'APPROVED', id_card_number = $1, approved_at = NOW() WHERE id = $2`,
      [idCardNumber, request.params.id]
    );

    return { message: 'Member approved successfully', idCardNumber };
  } catch (err) {
    console.error('APPROVE ERROR:', err.message);
    reply.code(500).send({ error: err.message });
  }
};

// PATCH reject member
const rejectMember = async (request, reply) => {
  try {
    await pool.query(
      `UPDATE members SET status = 'REJECTED', rejected_at = NOW() WHERE id = $1`,
      [request.params.id]
    );
    return { message: 'Member rejected' };
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

// POST send ID card email (admin-triggered)
const sendIdCardEmail = async (request, reply) => {
  try {
    const member = await pool.query('SELECT * FROM members WHERE id = $1', [request.params.id]);
    if (!member.rows[0]) return reply.code(404).send({ error: 'Member not found' });

    const m = member.rows[0];
    if (m.status !== 'APPROVED') {
      return reply.code(400).send({ error: 'Member is not approved yet.' });
    }
    if (!m.id_card_number) {
      return reply.code(400).send({ error: 'No ID card number found for this member.' });
    }

    const pdfBuffer = await generateIDCardPDF(m, m.id_card_number);
    const logoPath = path.join(__dirname, '../../../client/public/logo/1.png');

    await transporter.sendMail({
      from: FROM_EMAIL,
      to: m.email,
      subject: `🎉 NCIO Membership Approved - ${m.application_id}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;border:2px solid #1a237e;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#0d1b5e,#1a237e);padding:24px;text-align:center;">
            <img src="cid:ncio_logo" alt="NCIO Logo"
              style="width:60px;height:60px;border-radius:50%;border:3px solid rgba(255,255,255,0.5);object-fit:cover;display:block;margin:0 auto 12px;" />
            <h1 style="color:white;margin:0;font-size:22px;letter-spacing:2px;">NCIO</h1>
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
                <td style="padding:8px 12px;font-weight:bold;font-family:monospace;color:#1a237e;">${m.id_card_number}</td>
              </tr>
              <tr style="background:#f8f9ff;">
                <td style="padding:8px 12px;color:#888;font-size:13px;">Membership Type</td>
                <td style="padding:8px 12px;font-weight:bold;">${m.membership_type}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;color:#888;font-size:13px;">District</td>
                <td style="padding:8px 12px;font-weight:bold;">${m.district || '-'}</td>
              </tr>
            </table>
            <p style="color:#555;font-size:13px;">Your ID card is attached to this email. Please download and keep it safe.</p>
          </div>
          <div style="background:#f8f9ff;padding:12px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="color:#888;font-size:11px;margin:0;">© 2026 NCIO. All rights reserved.</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `NCIO_${m.application_id}_IDCard.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
        {
          filename: '1.png',
          path: logoPath,
          cid: 'ncio_logo',
        },
      ],
    });

    return { success: true, message: 'ID card emailed successfully.' };
  } catch (err) {
    console.error('SEND ID CARD EMAIL ERROR:', err.message);
    reply.code(500).send({ error: 'Failed to send email: ' + err.message });
  }
};
// POST send admin-triggered email verification OTP
const sendVerificationOtp = async (request, reply) => {
  try {
    const { channel } = request.body || {};
    if (channel !== 'email') {
      return reply.code(400).send({ error: 'Only email verification is supported.' });
    }

    const member = await pool.query(
      'SELECT id, full_name, email FROM members WHERE id = $1',
      [request.params.id]
    );
    if (!member.rows[0]) return reply.code(404).send({ error: 'Member not found' });

    const m = member.rows[0];
    if (!m.email) return reply.code(400).send({ error: 'Member email is missing.' });

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const triggeredBy = resolveAdminIdentifier(request);

    await pool.query(
      `INSERT INTO admin_verification_otps
       (member_id, channel, code, expires_at, triggered_by)
       VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes', $4)`,
      [m.id, channel, code, triggeredBy]
    );

    await transporter.sendMail({
      from: FROM_EMAIL,
      to: m.email,
      subject: 'NCIO Application Verification Code',
      text: `Your NCIO application verification code is ${code}. Enter this code in the NCIO portal to verify your application. This code expires in 10 minutes. If you did not request this, please ignore this email.`,
    });

    return { success: true, sentTo: maskEmail(m.email) };
  } catch (err) {
    console.error('SEND VERIFICATION OTP ERROR:', err.message);
    reply.code(500).send({ error: err.message });
  }
};

// POST verify admin-triggered OTP
const verifyOtp = async (request, reply) => {
  try {
    const { channel, code } = request.body || {};
    if (channel !== 'email') {
      return reply.code(400).send({ error: 'Only email verification is supported.' });
    }

    const normalizedCode = String(code || '').trim();
    if (!/^\d{6}$/.test(normalizedCode)) {
      return reply.code(400).send({ error: 'Invalid or expired code' });
    }

    const otp = await pool.query(
      `SELECT id
       FROM admin_verification_otps
       WHERE member_id = $1
         AND channel = $2
         AND verified = false
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [request.params.id, channel]
    );

    if (!otp.rows[0]) {
      return reply.code(400).send({ error: 'Invalid or expired code' });
    }

    const match = await pool.query(
      `UPDATE admin_verification_otps
       SET verified = true
       WHERE id = $1 AND code = $2
       RETURNING id`,
      [otp.rows[0].id, normalizedCode]
    );

    if (!match.rows[0]) {
      return reply.code(400).send({ error: 'Invalid or expired code' });
    }

    const verifiedBy = resolveAdminIdentifier(request);
    const member = await pool.query(
      `UPDATE members
       SET email_verified_at = NOW(), email_verified_by = $1
       WHERE id = $2
       RETURNING email_verified_at, email_verified_by`,
      [verifiedBy, request.params.id]
    );

    if (!member.rows[0]) return reply.code(404).send({ error: 'Member not found' });

    return { success: true, member: member.rows[0] };
  } catch (err) {
    console.error('VERIFY OTP ERROR:', err.message);
    reply.code(500).send({ error: err.message });
  }
};

// DELETE member
const deleteMember = async (request, reply) => {
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
};

module.exports = {
  ensureMemberVerificationSchema,
  getLatestId,
  getDashboardStats,
  publicSearch,
  submitApplication,
  getAllMembers,
  getMember,
  approveMember,
  rejectMember,
  sendIdCardEmail,
  sendVerificationOtp,
  verifyOtp,
  deleteMember,
};