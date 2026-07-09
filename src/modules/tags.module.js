const pool = require('../plugins/db');

const VALID_PLACEMENTS = ['header', 'body', 'footer'];

function normalizeKey(key) {
  return String(key || '').trim().toLowerCase().replace(/\s+/g, '-');
}

async function ensureTagsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_tags (
      id SERIAL PRIMARY KEY,
      platform_key VARCHAR(100) NOT NULL UNIQUE,
      display_label VARCHAR(255) NOT NULL,
      placement VARCHAR(20) NOT NULL DEFAULT 'header',
      tag_code TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function tagsModule(fastify, options) {
  // GET /api/tags -> all tags
  fastify.get('/', async (req, reply) => {
    try {
      await ensureTagsTable();
      const result = await pool.query('SELECT * FROM site_tags ORDER BY created_at ASC');
      return reply.send(result.rows);
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch tags' });
    }
  });

  // GET /api/tags/active?placement=header -> only active tags (client uses this)
  fastify.get('/active', async (req, reply) => {
    const { placement } = req.query;

    try {
      await ensureTagsTable();
      const query = placement
        ? 'SELECT * FROM site_tags WHERE is_active = true AND placement = $1 ORDER BY created_at ASC'
        : 'SELECT * FROM site_tags WHERE is_active = true ORDER BY created_at ASC';
      const params = placement ? [placement] : [];

      const result = await pool.query(query, params);
      return reply.send(result.rows);
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch active tags' });
    }
  });

  // POST /api/tags -> create a new tag
  fastify.post('/', async (req, reply) => {
    const { platform_key, display_label, placement, tag_code } = req.body || {};

    const key = normalizeKey(platform_key);

    if (!key || !display_label) {
      return reply.status(400).send({ error: 'platform_key and display_label are required' });
    }

    const finalPlacement = VALID_PLACEMENTS.includes(placement) ? placement : 'header';

    try {
      await ensureTagsTable();

      const existing = await pool.query('SELECT id FROM site_tags WHERE platform_key = $1', [key]);
      if (existing.rows.length > 0) {
        return reply.status(409).send({ error: `A tag with key "${key}" already exists` });
      }

      const result = await pool.query(
        `INSERT INTO site_tags (platform_key, display_label, placement, tag_code)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [key, display_label, finalPlacement, tag_code || '']
      );

      return reply.status(201).send(result.rows[0]);
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to create tag' });
    }
  });

  // PUT /api/tags/:id -> update an existing tag
  fastify.put('/:id', async (req, reply) => {
    const { id } = req.params;
    const { display_label, placement, tag_code, is_active } = req.body || {};

    const finalPlacement = VALID_PLACEMENTS.includes(placement) ? placement : undefined;

    try {
      await ensureTagsTable();

      const result = await pool.query(
        `UPDATE site_tags SET
          display_label = COALESCE($1, display_label),
          placement = COALESCE($2, placement),
          tag_code = COALESCE($3, tag_code),
          is_active = COALESCE($4, is_active),
          updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [display_label, finalPlacement, tag_code, is_active, id]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Tag not found' });
      }

      return reply.send(result.rows[0]);
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to update tag' });
    }
  });

  // DELETE /api/tags/:id -> remove a tag
  fastify.delete('/:id', async (req, reply) => {
    const { id } = req.params;

    try {
      await ensureTagsTable();
      const result = await pool.query('DELETE FROM site_tags WHERE id = $1 RETURNING id', [id]);

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Tag not found' });
      }

      return reply.send({ success: true, id });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to delete tag' });
    }
  });
}

module.exports = tagsModule;