const pool = require('../plugins/db');

// GET /api/content?page=home&section=hero
// Returns all keys for a page+section as a flat object: { heading_line1: '...', ... }
const getContent = async (request, reply) => {
  try {
    const { page, section } = request.query;
    if (!page) return reply.code(400).send({ error: 'page query param required' });

    let query = 'SELECT page, section, key, value FROM site_content WHERE page = $1';
    const params = [page];

    if (section) {
      query += ' AND section = $2';
      params.push(section);
    }

    const result = await pool.query(query, params);

    // Group by section → { hero: { heading_line1: '...', ... }, mission: { ... } }
    const grouped = {};
    for (const row of result.rows) {
      if (!grouped[row.section]) grouped[row.section] = {};
      grouped[row.section][row.key] = row.value;
    }

    // If section specified, return flat object
    if (section) return grouped[section] || {};
    return grouped;
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

// PUT /api/content
// Body: { page, section, fields: { key: value, ... } }
const updateContent = async (request, reply) => {
  try {
    const { page, section, fields } = request.body || {};

    if (!page || !section || !fields || typeof fields !== 'object') {
      return reply.code(400).send({ error: 'page, section, and fields are required' });
    }

    const entries = Object.entries(fields);
    if (entries.length === 0) {
      return reply.code(400).send({ error: 'fields object is empty' });
    }

    // Upsert each field
    for (const [key, value] of entries) {
      await pool.query(
        `INSERT INTO site_content (page, section, key, value, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (page, section, key)
         DO UPDATE SET value = $4, updated_at = NOW()`,
        [page, section, key, value]
      );
    }

    // Return updated section
    const result = await pool.query(
      'SELECT key, value FROM site_content WHERE page = $1 AND section = $2',
      [page, section]
    );
    const updated = {};
    for (const row of result.rows) updated[row.key] = row.value;

    return { message: 'Content updated successfully', content: updated };
  } catch (err) {
    console.error('CONTENT UPDATE ERROR:', err.message);
    reply.code(500).send({ error: err.message });
  }
};

module.exports = { getContent, updateContent };