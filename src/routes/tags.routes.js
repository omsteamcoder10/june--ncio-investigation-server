const {
  getAllTags,
  getActiveTags,
  createTag,
  updateTag,
  deleteTag
} = require('../controllers/tags.controller');

async function tagsRoutes(fastify, options) {
  fastify.get('/', getAllTags);
  fastify.get('/active', getActiveTags);
  fastify.post('/', createTag);
  fastify.put('/:id', updateTag);
  fastify.delete('/:id', deleteTag);
}

module.exports = tagsRoutes;