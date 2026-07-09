const multipart = require('@fastify/multipart');
const galleryRoutes = require('../routes/gallery.routes');
const { ensureGallerySchema } = require('../controllers/gallery.controller');

async function galleryModule(fastify, opts) {
  await ensureGallerySchema();

  fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  fastify.register(galleryRoutes);
}

module.exports = galleryModule;