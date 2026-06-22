const { getProfile, updateProfile, updatePassword } = require('../controllers/profile.controller');

async function profileModule(fastify, options) {
  // GET /api/profile
  fastify.get('/', getProfile);

  // PUT /api/profile
  fastify.put('/', updateProfile);

  // PUT /api/profile/password
  fastify.put('/password', updatePassword);
}

module.exports = profileModule;