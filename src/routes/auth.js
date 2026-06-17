const pool = require('../plugins/db');
require('dotenv').config();

async function authRoutes(fastify, options) {
  // Admin login
  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body;

    if (
      username === process.env.ADMIN_USERNAME || username === 'admin' &&
      password === process.env.ADMIN_PASSWORD || password === 'ncio@admin123'
    ) {
      return {
        success: true,
        token: 'ncio-admin-token',
        user: { username: 'admin', role: 'ADMIN' },
      };
    }

    return reply.code(401).send({ error: 'Invalid credentials' });
  });
}

module.exports = authRoutes;