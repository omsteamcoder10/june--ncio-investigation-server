const pool = require('../plugins/db');
const bcrypt = require('bcrypt');

// This system currently issues a static token (not a real JWT), so we can't
// decode the logged-in admin's id from it. The frontend should store the
// `id` returned at login and send it as `adminId`. Until multi-admin support
// exists, we fall back to id 1 (the seeded admin).
const resolveAdminId = (request) => {
  return request.body?.adminId || request.query?.adminId || 1;
};

// GET /api/profile
const getProfile = async (request, reply) => {
  try {
    const adminId = resolveAdminId(request);
    const result = await pool.query(
      'SELECT id, username, name, email, phone, role FROM admins WHERE id = $1',
      [adminId]
    );
    if (!result.rows[0]) {
      return reply.code(404).send({ error: 'Admin not found' });
    }
    return result.rows[0];
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

// PUT /api/profile — body: { adminId, name, email, phone }
const updateProfile = async (request, reply) => {
  try {
    const adminId = resolveAdminId(request);
    const { name, email, phone } = request.body || {};

    const result = await pool.query(
      `UPDATE admins
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, username, name, email, phone, role`,
      [name, email, phone, adminId]
    );

    if (!result.rows[0]) {
      return reply.code(404).send({ error: 'Admin not found' });
    }

    return { message: 'Profile updated successfully', profile: result.rows[0] };
  } catch (err) {
    console.error('PROFILE UPDATE ERROR:', err.message);
    reply.code(500).send({ error: err.message });
  }
};

// PUT /api/profile/password — body: { adminId, currentPassword, newPassword }
const updatePassword = async (request, reply) => {
  try {
    const adminId = resolveAdminId(request);
    const { currentPassword, newPassword } = request.body || {};

    if (!currentPassword || !newPassword) {
      return reply.code(400).send({ error: 'currentPassword and newPassword are required' });
    }

    const result = await pool.query('SELECT * FROM admins WHERE id = $1', [adminId]);
    const admin = result.rows[0];

    if (!admin) {
      return reply.code(404).send({ error: 'Admin not found' });
    }

    const matches = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!matches) {
      return reply.code(401).send({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE admins SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, adminId]
    );

    return { message: 'Password changed successfully' };
  } catch (err) {
    console.error('PASSWORD UPDATE ERROR:', err.message);
    reply.code(500).send({ error: err.message });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updatePassword,
};