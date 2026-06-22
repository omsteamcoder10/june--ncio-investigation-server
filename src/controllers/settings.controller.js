const pool = require('../plugins/db');

// Maps frontend (camelCase, grouped by tab) <-> DB columns (snake_case, flat)
const FIELD_MAP = {
  general: {
    siteName: 'site_name',
    fullName: 'full_name',
    email: 'email',
    phone: 'phone',
    address: 'address',
    website: 'website',
  },
  smtp: {
    host: 'smtp_host',
    port: 'smtp_port',
    user: 'smtp_user',
    pass: 'smtp_pass',
    adminEmail: 'smtp_admin_email',
  },
  notifications: {
    newMember: 'notify_new_member',
    memberApproved: 'notify_member_approved',
    memberRejected: 'notify_member_rejected',
    newDonation: 'notify_new_donation',
  },
  security: {
    sessionTimeout: 'session_timeout',
    maxLoginAttempts: 'max_login_attempts',
  },
  payment: {
    razorpayKeyId: 'razorpay_key_id',
    razorpayKeySecret: 'razorpay_key_secret',
    currency: 'payment_currency',
    testMode: 'payment_test_mode',
  },
};

// Converts a flat DB row into the grouped shape the frontend expects
const rowToGrouped = (row) => {
  const grouped = {};
  for (const [tab, fields] of Object.entries(FIELD_MAP)) {
    grouped[tab] = {};
    for (const [frontendKey, dbColumn] of Object.entries(fields)) {
      grouped[tab][frontendKey] = row[dbColumn];
    }
  }
  return grouped;
};

// GET /api/settings
const getSettings = async (request, reply) => {
  try {
    const result = await pool.query('SELECT * FROM settings WHERE id = 1');
    if (!result.rows[0]) {
      return reply.code(404).send({ error: 'Settings not found. Run the settings migration first.' });
    }
    return rowToGrouped(result.rows[0]);
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

// PUT /api/settings — accepts { general, smtp, notifications, security, payment }
// Any subset of tabs can be sent; only provided fields are updated.
const updateSettings = async (request, reply) => {
  try {
    const body = request.body || {};
    const setClauses = [];
    const params = [];
    let i = 1;

    for (const [tab, fields] of Object.entries(FIELD_MAP)) {
      const tabData = body[tab];
      if (!tabData || typeof tabData !== 'object') continue;

      for (const [frontendKey, dbColumn] of Object.entries(fields)) {
        if (Object.prototype.hasOwnProperty.call(tabData, frontendKey)) {
          setClauses.push(`${dbColumn} = $${i++}`);
          params.push(tabData[frontendKey]);
        }
      }
    }

    if (setClauses.length === 0) {
      return reply.code(400).send({ error: 'No valid settings fields provided' });
    }

    setClauses.push('updated_at = NOW()');

    const query = `UPDATE settings SET ${setClauses.join(', ')} WHERE id = 1 RETURNING *`;
    const result = await pool.query(query, params);

    if (!result.rows[0]) {
      return reply.code(404).send({ error: 'Settings row not found. Run the settings migration first.' });
    }

    return {
      message: 'Settings updated successfully',
      settings: rowToGrouped(result.rows[0]),
    };
  } catch (err) {
    console.error('SETTINGS UPDATE ERROR:', err.message);
    reply.code(500).send({ error: err.message });
  }
};

module.exports = {
  getSettings,
  updateSettings,
};