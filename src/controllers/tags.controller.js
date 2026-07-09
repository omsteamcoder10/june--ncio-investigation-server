const tagsModel = require('../models/tags.model');

async function getAllTags(req, reply) {
  try {
    const rows = await tagsModel.findAll();
    return reply.send(rows);
  } catch (err) {
    req.log?.error(err);
    return reply.status(500).send({ error: 'Failed to fetch tags' });
  }
}

async function getActiveTags(req, reply) {
  const { placement } = req.query;
  try {
    const rows = await tagsModel.findActive(placement);
    return reply.send(rows);
  } catch (err) {
    req.log?.error(err);
    return reply.status(500).send({ error: 'Failed to fetch active tags' });
  }
}

async function createTag(req, reply) {
  const { platform_key, display_label, placement, tag_code } = req.body || {};

  if (!platform_key || !display_label) {
    return reply.status(400).send({ error: 'platform_key and display_label are required' });
  }

  try {
    const tag = await tagsModel.create({ platform_key, display_label, placement, tag_code });
    return reply.status(201).send(tag);
  } catch (err) {
    if (err.code === 'DUPLICATE_KEY') {
      return reply.status(409).send({ error: err.message });
    }
    req.log?.error(err);
    return reply.status(500).send({ error: 'Failed to create tag' });
  }
}

async function updateTag(req, reply) {
  const { id } = req.params;
  const { display_label, placement, tag_code, is_active } = req.body || {};

  try {
    const tag = await tagsModel.update(id, { display_label, placement, tag_code, is_active });
    if (!tag) {
      return reply.status(404).send({ error: 'Tag not found' });
    }
    return reply.send(tag);
  } catch (err) {
    req.log?.error(err);
    return reply.status(500).send({ error: 'Failed to update tag' });
  }
}

async function deleteTag(req, reply) {
  const { id } = req.params;
  try {
    const deleted = await tagsModel.remove(id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Tag not found' });
    }
    return reply.send({ success: true, id });
  } catch (err) {
    req.log?.error(err);
    return reply.status(500).send({ error: 'Failed to delete tag' });
  }
}

module.exports = {
  getAllTags,
  getActiveTags,
  createTag,
  updateTag,
  deleteTag
};