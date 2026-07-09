const {
  getLatestId,
  getDashboardStats,
  publicSearch,
  submitApplication,
  getAllMembers,
  getMember,
  approveMember,
  rejectMember,
  sendIdCardEmail,
  deleteMember,
} = require('../controllers/member.controller');

async function memberRoutes(fastify, options) {
  fastify.get('/latest-id', getLatestId);
  fastify.get('/stats/dashboard', getDashboardStats);
  fastify.get('/search/public', publicSearch);
  fastify.post('/', submitApplication);
  fastify.get('/', getAllMembers);
  fastify.get('/:id', getMember);
  fastify.patch('/:id/approve', approveMember);
  fastify.patch('/:id/reject', rejectMember);
  fastify.post('/:id/send-id-card', sendIdCardEmail);
  fastify.delete('/:id', deleteMember);
}

module.exports = memberRoutes;