const contentRoutes = require('../routes/content.routes');

async function contentModule(fastify, options) {
  fastify.register(contentRoutes);
}

module.exports = contentModule;