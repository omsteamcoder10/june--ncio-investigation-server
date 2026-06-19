const {
  getAllUpdates,
  getAllUpdatesAdmin,
  addUpdate,
  updateUpdate,
  deleteUpdate,
} = require('../controllers/updates.controller');

async function updatesModule(fastify, options) {
  fastify.get('/', getAllUpdates);
  fastify.get('/admin/all', getAllUpdatesAdmin);
  fastify.post('/', addUpdate);
  fastify.put('/:id', updateUpdate);
  fastify.delete('/:id', deleteUpdate);
}

module.exports = updatesModule;