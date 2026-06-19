const pool = require('../plugins/db');

const getAllUpdates = async (request, reply) => {
  try {
    const result = await pool.query(
      `SELECT * FROM updates WHERE is_active = true ORDER BY display_order ASC, created_at DESC`
    );
    return result.rows;
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

const getAllUpdatesAdmin = async (request, reply) => {
  try {
    const result = await pool.query(
      `SELECT * FROM updates ORDER BY display_order ASC, created_at DESC`
    );
    return result.rows;
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

const addUpdate = async (request, reply) => {
  const { title, description, image, category, display_order } = request.body;
  try {
    const result = await pool.query(
      `INSERT INTO updates (title, description, image, category, display_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, description || null, image || null, category || 'News', display_order || 0]
    );
    return reply.code(201).send(result.rows[0]);
  } catch (err) {
    console.error('UPDATE INSERT ERROR:', err.message);
    reply.code(500).send({ error: err.message });
  }
};

const updateUpdate = async (request, reply) => {
  const { title, description, image, category, display_order, is_active } = request.body;
  try {
    const result = await pool.query(
      `UPDATE updates SET title=$1, description=$2, image=$3, category=$4,
       display_order=$5, is_active=$6 WHERE id=$7 RETURNING *`,
      [title, description || null, image || null, category || 'News', display_order || 0, is_active ?? true, request.params.id]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: 'Update not found' });
    return result.rows[0];
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

const deleteUpdate = async (request, reply) => {
  try {
    await pool.query('DELETE FROM updates WHERE id = $1', [request.params.id]);
    return { message: 'Update deleted' };
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

module.exports = {
  getAllUpdates,
  getAllUpdatesAdmin,
  addUpdate,
  updateUpdate,
  deleteUpdate,
};