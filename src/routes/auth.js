const { login } = require('../controllers/auth.controller');

async function authRoutes(fastify, options) {
  fastify.post('/login', login);
}

module.exports = authRoutes;