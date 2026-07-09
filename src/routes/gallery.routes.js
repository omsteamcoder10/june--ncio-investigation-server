const {
  getGalleryItems,
  uploadGalleryItem,
  deleteGalleryItem,
} = require('../controllers/gallery.controller');

async function galleryRoutes(fastify, opts) {
  fastify.get('/', getGalleryItems);
  fastify.post('/upload', uploadGalleryItem);
  fastify.delete('/:id', deleteGalleryItem);
}

module.exports = galleryRoutes;