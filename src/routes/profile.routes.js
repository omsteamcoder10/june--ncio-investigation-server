const { getProfile, updateProfile, updatePassword } = require('../controllers/profile.controller');

async function profileRoutes(fastify, options) {
  // GET /profile
  fastify.get('/profile', getProfile);

  // PUT /profile
  fastify.put('/profile', updateProfile);

  // PUT /profile/password
  fastify.put('/profile/password', updatePassword);
}

module.exports = profileRoutes;