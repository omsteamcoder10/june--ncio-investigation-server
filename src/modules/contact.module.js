const {
  ensureContactSchema,
  submitContact,
  getAllContacts,
  getContact,
  markAsRead,
  deleteContact,
  sendReply,
  getMessages,
} = require('../controllers/contact.controller');

async function contactModule(fastify, options) {
  await ensureContactSchema();

  fastify.post('/', submitContact);
  fastify.get('/', getAllContacts);
  fastify.get('/:id', getContact);
  fastify.patch('/:id/read', markAsRead);
  fastify.delete('/:id', deleteContact);
  fastify.post('/:id/reply', sendReply);
  fastify.get('/:id/messages', getMessages);
}

module.exports = contactModule;