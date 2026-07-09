const seoModel = require('../models/seo.module');

const DEFAULT_OG_TYPE = 'website';

async function getAllSeo(req, reply) {
  try {
    const rows = await seoModel.findAll();
    return reply.send(rows);
  } catch (err) {
    req.log?.error(err);
    return reply.status(500).send({ error: 'Failed to fetch SEO data' });
  }
}

async function getSeoByPage(req, reply) {
  const { page } = req.params;

  if (!page) {
    return reply.status(400).send({ error: 'page is required' });
  }

  try {
    const row = await seoModel.findByPage(page);

    if (!row) {
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

    return reply.send(row);
  } catch (err) {
    req.log?.error(err);
    return reply.status(500).send({ error: 'Failed to fetch SEO data' });
  }
}

async function upsertSeo(req, reply) {
  const { page } = req.params;
  const fields = req.body;

  if (!page || !fields || typeof fields !== 'object') {
    return reply.status(400).send({ error: 'page and fields are required' });
  }

  try {
    const result = await seoModel.upsert(page, fields);
    return reply.send({ success: true, ...result });
  } catch (err) {
    req.log?.error(err);
    return reply.status(400).send({ error: err.message || 'Failed to save SEO data' });
  }
}

module.exports = {
  getAllSeo,
  getSeoByPage,
  upsertSeo
};