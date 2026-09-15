const pool = require('../plugins/db');

const getAllTeam = async (request, reply) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM team_members
       WHERE is_active = true
       ORDER BY display_order ASC, created_at ASC`
    );

    return result.rows;
  } catch (err) {
    console.error('GET TEAM ERROR:', err);

    return reply.code(500).send({
      error: err.message,
    });
  }
};

const getAllTeamAdmin = async (request, reply) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM team_members
       ORDER BY display_order ASC, created_at ASC`
    );

    return result.rows;
  } catch (err) {
    console.error(
      'GET ADMIN TEAM ERROR:',
      err
    );

    return reply.code(500).send({
      error: err.message,
    });
  }
};

const addTeamMember = async (request, reply) => {
  const {
    name,
    role,
    district,
    photo,
    greeting,
    display_order,
  } = request.body || {};

  try {
    const result = await pool.query(
      `INSERT INTO team_members
        (
          name,
          role,
          district,
          photo,
          greeting,
          display_order
        )
       VALUES
        ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        typeof name === 'string'
          ? name.trim()
          : '',

        typeof role === 'string'
          ? role.trim()
          : '',

        typeof district === 'string'
          ? district.trim()
          : '',

        typeof photo === 'string' &&
        photo.trim()
          ? photo.trim()
          : null,

        typeof greeting === 'string' &&
        greeting.trim()
          ? greeting.trim()
          : null,

        Number.isFinite(
          Number(display_order)
        )
          ? Number(display_order)
          : 0,
      ]
    );

    return reply
      .code(201)
      .send(result.rows[0]);
  } catch (err) {
    console.error(
      'TEAM INSERT ERROR:',
      err
    );

    return reply.code(500).send({
      error: err.message,
    });
  }
};

const updateTeamMember = async (
  request,
  reply
) => {
  const {
    name,
    role,
    district,
    photo,
    greeting,
    display_order,
    is_active,
  } = request.body || {};

  try {
    const result = await pool.query(
      `UPDATE team_members
       SET
         name = $1,
         role = $2,
         district = $3,
         photo = $4,
         greeting = $5,
         display_order = $6,
         is_active = $7
       WHERE id = $8
       RETURNING *`,
      [
        typeof name === 'string'
          ? name.trim()
          : '',

        typeof role === 'string'
          ? role.trim()
          : '',

        typeof district === 'string'
          ? district.trim()
          : '',

        typeof photo === 'string' &&
        photo.trim()
          ? photo.trim()
          : null,

        typeof greeting === 'string' &&
        greeting.trim()
          ? greeting.trim()
          : null,

        Number.isFinite(
          Number(display_order)
        )
          ? Number(display_order)
          : 0,

        is_active ?? true,

        request.params.id,
      ]
    );

    if (!result.rows[0]) {
      return reply.code(404).send({
        error: 'Member not found',
      });
    }

    return result.rows[0];
  } catch (err) {
    console.error(
      'TEAM UPDATE ERROR:',
      err
    );

    return reply.code(500).send({
      error: err.message,
    });
  }
};

const deleteTeamMember = async (
  request,
  reply
) => {
  try {
    const result = await pool.query(
      `DELETE FROM team_members
       WHERE id = $1
       RETURNING id`,
      [request.params.id]
    );

    if (!result.rows[0]) {
      return reply.code(404).send({
        error: 'Member not found',
      });
    }

    return {
      message: 'Team member deleted',
    };
  } catch (err) {
    console.error(
      'DELETE TEAM ERROR:',
      err
    );

    return reply.code(500).send({
      error: err.message,
    });
  }
};

module.exports = {
  getAllTeam,
  getAllTeamAdmin,
  addTeamMember,
  updateTeamMember,
  deleteTeamMember,
};