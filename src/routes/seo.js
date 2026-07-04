const {
  getSeoSettings,
  getSeoBySlug,
  updateSeoSettings,
} = require('../controllers/seo.controller');

async function seoRoutes(fastify, options) {
  fastify.get('/api/seo', getSeoSettings);
  fastify.get('/api/seo/slug/:slug', getSeoBySlug);
  fastify.get('/api/seo/:slug', getSeoBySlug);
  fastify.put('/api/seo/:id', updateSeoSettings);
}

module.exports = seoRoutes;
