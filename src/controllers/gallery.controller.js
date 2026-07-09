const pool = require('../plugins/db');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

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

    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(data.filename)}`;
    const uploadDir = path.join(__dirname, '../uploads/gallery');
    const destPath = path.join(uploadDir, uniqueName);

    await pipeline(data.file, fs.createWriteStream(destPath));

    const filePath = `/uploads/gallery/${uniqueName}`;

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

    const filePath = path.join(__dirname, '../..', result.rows[0].file_path);
    fs.unlink(filePath, (err) => {
      if (err) console.error('File delete warning:', err.message);
    });

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