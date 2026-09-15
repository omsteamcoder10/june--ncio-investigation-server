const bcrypt = require('bcrypt');
const pool = require('../plugins/db');

const login = async (request, reply) => {
  const { username, password } = request.body || {};

  if (!username || !password) {
    return reply.code(400).send({
      success: false,
      error: 'Username and password are required',
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, username, name, email, password_hash, role
       FROM admins
       WHERE username = $1
       LIMIT 1`,
      [username]
    );

    const admin = result.rows[0];

    if (!admin || admin.role !== 'ADMIN') {
      return reply.code(401).send({
        success: false,
        error: 'Invalid credentials',
      });
    }

    const passwordValid = await bcrypt.compare(
      password,
      admin.password_hash
    );

    if (!passwordValid) {
      return reply.code(401).send({
        success: false,
        error: 'Invalid credentials',
      });
    }

    return {
      success: true,
      token: `ncio-admin-${admin.id}-${Date.now()}`,
      user: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    };
  } catch (err) {
    request.log.error(err);

    return reply.code(500).send({
      success: false,
      error: 'Login failed',
    });
  }
};

module.exports = { login };
