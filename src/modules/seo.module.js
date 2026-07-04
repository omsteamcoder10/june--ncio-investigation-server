const {
  getSeoSettings,
  getSeoBySlug,
  updateSeoSettings,
} = require('../controllers/seo.controller');

async function seoModule(fastify, options) {
  fastify.get('/', getSeoSettings);
  fastify.get('/slug/:slug', getSeoBySlug);
  fastify.get('/:slug', getSeoBySlug);
  fastify.put('/:id', updateSeoSettings);
}

module.exports = seoModule;
