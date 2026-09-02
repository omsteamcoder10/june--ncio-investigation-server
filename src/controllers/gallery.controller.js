const pool = require('../plugins/db');
const path = require('path');
const { randomUUID } = require('crypto');
const { uploadToR2, deleteFromR2 } = require('../services/r2.service');

const ensureGallerySchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gallery_items (
      id SERIAL PRIMARY KEY,
      type VARCHAR(10) NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      original_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
};

const getGalleryItems = async (request, reply) => {
  try {
    const { type } = request.query;
    let query = 'SELECT * FROM gallery_items';
    const params = [];

    if (type) {
      query += ' WHERE type = $1';
      params.push(type);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

const uploadGalleryItem = async (request, reply) => {
  try {
    const data = await request.file();

    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded.' });
    }

    const typeField = data.fields?.type?.value;
    if (!typeField || !['photo', 'video', 'update'].includes(typeField)) {
      return reply.code(400).send({ error: 'Invalid type. Must be photo, video, or update.' });
    }

    const ext = path.extname(data.filename);
    const uniqueName = `${randomUUID()}${ext}`;

    // Read the incoming file stream into a buffer
    const chunks = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Upload directly to Cloudflare R2 instead of local disk
    // Keep new uploads in the same gallery/images or gallery/videos
    // subfolder structure that existing items already use.
    const subFolder = typeField === 'video' ? 'gallery/videos' : 'gallery/images';
    const filePath = await uploadToR2(buffer, uniqueName, data.mimetype, subFolder);

    const result = await pool.query(
      `INSERT INTO gallery_items (type, file_path, original_name)
       VALUES ($1, $2, $3) RETURNING *`,
      [typeField, filePath, data.filename]
    );

    return reply.code(201).send({
      message: 'Uploaded successfully',
      item: result.rows[0],
    });
  } catch (err) {
    console.error('GALLERY UPLOAD ERROR:', err.message);
    reply.code(500).send({ error: err.message });
  }
};

const deleteGalleryItem = async (request, reply) => {
  try {
    const result = await pool.query(
      `DELETE FROM gallery_items WHERE id = $1 RETURNING file_path`,
      [request.params.id]
    );

    if (!result.rows[0]) {
      return reply.code(404).send({ error: 'Item not found' });
    }

    // Actually delete the file from R2 storage
    await deleteFromR2(result.rows[0].file_path);

    return { message: 'Deleted successfully' };
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

module.exports = {
  ensureGallerySchema,
  getGalleryItems,
  uploadGalleryItem,
  deleteGalleryItem,
};