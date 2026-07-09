const {
  submitContact,
  getAllContacts,
  getContact,
  markAsRead,
  deleteContact,
  sendReply,
} = require('../controllers/contact.controller');

async function contactRoutes(fastify, options) {
  fastify.post('/', submitContact);
  fastify.get('/', getAllContacts);
  fastify.get('/:id', getContact);
  fastify.patch('/:id/read', markAsRead);
  fastify.delete('/:id', deleteContact);
  fastify.post('/:id/reply', sendReply);
}

module.exports = contactRoutes;