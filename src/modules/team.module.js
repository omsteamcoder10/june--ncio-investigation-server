const {
  getAllTeam,
  getAllTeamAdmin,
  addTeamMember,
  updateTeamMember,
  deleteTeamMember,
} = require('../controllers/team.controller');


async function teamModule(fastify, options) {

  // ==========================================================
  // PUBLIC
  // GET ACTIVE TEAM MEMBERS
  // ==========================================================
  fastify.get(
    '/',
    getAllTeam
  );


  // ==========================================================
  // ADMIN
  // GET ALL TEAM MEMBERS
  // ==========================================================
  fastify.get(
    '/admin/all',
    getAllTeamAdmin
  );


  // ==========================================================
  // ADMIN
  // ADD TEAM MEMBER
  // ==========================================================
  fastify.post(
    '/',
    addTeamMember
  );


  // ==========================================================
  // ADMIN
  // UPDATE TEAM MEMBER
  // ==========================================================
  fastify.put(
    '/:id',
    updateTeamMember
  );


  // ==========================================================
  // ADMIN
  // DELETE TEAM MEMBER
  // ==========================================================
  fastify.delete(
    '/:id',
    deleteTeamMember
  );
}


module.exports = teamModule;