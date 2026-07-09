const {
  ensureMemberVerificationSchema,
  getLatestId,
  getDashboardStats,
  publicSearch,
  submitApplication,
  getAllMembers,
  getMember,
  approveMember,
  rejectMember,
  sendIdCardEmail,
  sendVerificationOtp,
  verifyOtp,
  deleteMember,
} = require('../controllers/member.controller');

async function memberModule(fastify, options) {
  await ensureMemberVerificationSchema();

  fastify.get('/latest-id', getLatestId);
  fastify.get('/stats/dashboard', getDashboardStats);
  fastify.get('/search/public', publicSearch);
  fastify.post('/', submitApplication);
  fastify.get('/', getAllMembers);
  fastify.get('/:id', getMember);
  fastify.patch('/:id/approve', approveMember);
  fastify.patch('/:id/reject', rejectMember);
  fastify.post('/:id/send-id-card', sendIdCardEmail);
  fastify.post('/:id/send-verification-otp', sendVerificationOtp);
  fastify.post('/:id/verify-otp', verifyOtp);
  fastify.delete('/:id', deleteMember);
}

module.exports = memberModule;