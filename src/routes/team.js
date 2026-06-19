const {
  getAllTeam,
  getAllTeamAdmin,
  addTeamMember,
  updateTeamMember,
  deleteTeamMember,
} = require('../controllers/team.controller');

async function teamRoutes(fastify, options) {
  fastify.get('/', getAllTeam);
  fastify.get('/admin/all', getAllTeamAdmin);
  fastify.post('/', addTeamMember);
  fastify.put('/:id', updateTeamMember);
  fastify.delete('/:id', deleteTeamMember);
}

module.exports = teamRoutes;