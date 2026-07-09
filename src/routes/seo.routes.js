const {
  getAllSeo,
  getSeoByPage,
  upsertSeo
} = require('../controllers/seo.controller');

async function seoRoutes(fastify, options) {
  fastify.get('/seo', getAllSeo);
  fastify.get('/seo/:page', getSeoByPage);
  fastify.put('/seo/:page', upsertSeo);
}

module.exports = seoRoutes;