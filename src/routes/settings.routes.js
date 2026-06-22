const { getSettings, updateSettings } = require('../controllers/settings.controller');

async function settingsRoutes(fastify, options) {
  // GET /settings
  fastify.get('/settings', getSettings);

  // PUT /settings
  fastify.put('/settings', updateSettings);
}

module.exports = settingsRoutes;