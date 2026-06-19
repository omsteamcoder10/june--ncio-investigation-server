const pool = require('../plugins/db');

const getAllTeam = async (request, reply) => {
  try {
    const result = await pool.query(
      `SELECT * FROM team_members WHERE is_active = true ORDER BY display_order ASC, created_at ASC`
    );
    return result.rows;
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

const getAllTeamAdmin = async (request, reply) => {
  try {
    const result = await pool.query(
      `SELECT * FROM team_members ORDER BY display_order ASC, created_at ASC`
    );
    return result.rows;
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

const addTeamMember = async (request, reply) => {
  const { name, role, district, photo, greeting, display_order } = request.body;
  try {
    const result = await pool.query(
      `INSERT INTO team_members (name, role, district, photo, greeting, display_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, role, district, photo || null, greeting || null, display_order || 0]
    );
    return reply.code(201).send(result.rows[0]);
  } catch (err) {
    console.error('TEAM INSERT ERROR:', err.message);
    reply.code(500).send({ error: err.message });
  }
};

const updateTeamMember = async (request, reply) => {
  const { name, role, district, photo, greeting, display_order, is_active } = request.body;
  try {
    const result = await pool.query(
      `UPDATE team_members SET name=$1, role=$2, district=$3, photo=$4, greeting=$5,
       display_order=$6, is_active=$7 WHERE id=$8 RETURNING *`,
      [name, role, district, photo || null, greeting || null, display_order || 0, is_active ?? true, request.params.id]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: 'Member not found' });
    return result.rows[0];
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

const deleteTeamMember = async (request, reply) => {
  try {
    await pool.query('DELETE FROM team_members WHERE id = $1', [request.params.id]);
    return { message: 'Team member deleted' };
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

module.exports = {
  getAllTeam,
  getAllTeamAdmin,
  addTeamMember,
  updateTeamMember,
  deleteTeamMember,
};