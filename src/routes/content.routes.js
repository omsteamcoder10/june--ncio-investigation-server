const { getContent, updateContent } = require('../controllers/content.controller');

async function contentRoutes(fastify, options) {
  // GET /api/content?page=home&section=hero
  fastify.get('/', getContent);

  // PUT /api/content
  fastify.put('/', updateContent);
}

module.exports = contentRoutes;