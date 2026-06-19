const { login } = require('../controllers/auth.controller');

async function authModule(fastify, options) {
  fastify.post('/login', login);
}

module.exports = authModule;