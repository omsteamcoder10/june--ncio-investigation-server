const { getSettings, updateSettings } = require('../controllers/settings.controller');

async function settingsModule(fastify, options) {
  // GET /api/settings
  fastify.get('/', getSettings);

  // PUT /api/settings
  fastify.put('/', updateSettings);
}

module.exports = settingsModule;