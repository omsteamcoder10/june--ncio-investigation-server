const pool = require('../plugins/db');

const DEFAULT_OG_TYPE = 'website';

const ALLOWED_COLUMNS = [
  'meta_title',
  'meta_description',
  'meta_keywords',
  'canonical_url',
  'og_title',
  'og_description',
  'og_image',
  'og_type',
  'twitter_title',
  'twitter_description',
  'twitter_image',
  'robots_index',
  'robots_follow',
  'schema_json'
];

async function ensureSeoTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS seo_meta (
      id SERIAL PRIMARY KEY,
      page VARCHAR(100) NOT NULL UNIQUE,
      meta_title VARCHAR(255),
      meta_description TEXT,
      meta_keywords TEXT,
      canonical_url VARCHAR(255),
      og_title VARCHAR(255),
      og_description TEXT,
      og_image VARCHAR(255),
      og_type VARCHAR(50) DEFAULT '${DEFAULT_OG_TYPE}',
      twitter_title VARCHAR(255),
      twitter_description TEXT,
      twitter_image VARCHAR(255),
      robots_index BOOLEAN DEFAULT true,
      robots_follow BOOLEAN DEFAULT true,
      schema_json TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function seoModule(fastify, options) {
  fastify.get('/', async (req, reply) => {
    try {
      await ensureSeoTable();
      const result = await pool.query('SELECT * FROM seo_meta ORDER BY page ASC');
      return reply.send(result.rows);
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch SEO data' });
    }
  });

  fastify.get('/*', async (req, reply) => {
    const page = req.params['*'];

    if (!page) {
      return reply.status(400).send({ error: 'page is required' });
    }

    try {
      await ensureSeoTable();
      const result = await pool.query('SELECT * FROM seo_meta WHERE page = $1', [page]);

      if (result.rows.length === 0) {
        return reply.send({
          page,
          meta_title: '',
          meta_description: '',
          meta_keywords: '',
          canonical_url: '',
          og_title: '',
          og_description: '',
          og_image: '',
          og_type: DEFAULT_OG_TYPE,
          twitter_title: '',
          twitter_description: '',
          twitter_image: '',
          robots_index: true,
          robots_follow: true,
          schema_json: ''
        });
      }

      return reply.send(result.rows[0]);
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch SEO data' });
    }
  });

  fastify.put('/*', async (req, reply) => {
    const page = req.params['*'];
    const fields = req.body;

    if (!page || !fields || typeof fields !== 'object') {
      return reply.status(400).send({ error: 'page and fields are required' });
    }

    const columns = Object.keys(fields).filter((key) => ALLOWED_COLUMNS.includes(key));

    if (columns.length === 0) {
      return reply.status(400).send({ error: 'No valid SEO fields provided' });
    }

    const values = columns.map((col) => fields[col]);

    try {
      await ensureSeoTable();

      const insertPlaceholders = columns.map((_, i) => `$${i + 2}`).join(', ');
      const updateSet = columns.map((col, i) => `${col} = $${i + 2}`).join(', ');

      const query = `
        INSERT INTO seo_meta (page, ${columns.join(', ')}, updated_at)
        VALUES ($1, ${insertPlaceholders}, NOW())
        ON CONFLICT (page) DO UPDATE SET
          ${updateSet},
          updated_at = NOW()
      `;

      await pool.query(query, [page, ...values]);

      return reply.send({ success: true, page });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to save SEO data' });
    }
  });
}

module.exports = seoModule;