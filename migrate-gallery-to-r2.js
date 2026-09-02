require("dotenv").config();
const { readdir, readFile } = require("fs/promises");
const { join, extname } = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { Pool } = require("pg");

const UPLOADS_DIR = join(__dirname, "src", "uploads", "gallery");

const MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function migrate() {
  const files = await readdir(UPLOADS_DIR);
  console.log(`Found ${files.length} files in local uploads/gallery folder.\n`);

  let uploaded = 0;
  let failed = 0;

  for (const filename of files) {
    const ext = extname(filename).toLowerCase();
    const contentType = MIME_TYPES[ext];

    if (!contentType) {
      console.log(`⏭  Skipping unknown file type: ${filename}`);
      continue;
    }

    const filePath = join(UPLOADS_DIR, filename);

    try {
      const buffer = await readFile(filePath);

      if (buffer.length === 0) {
        console.log(`⏭  Skipping empty file: ${filename}`);
        continue;
      }

      const key = `gallery/${filename}`;

      await r2.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );

      console.log(`✅ Uploaded: ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
      uploaded++;
    } catch (err) {
      console.error(`❌ Failed: ${filename}`, err.message);
      failed++;
    }
  }

  console.log(`\n--- Upload Summary ---`);
  console.log(`Uploaded: ${uploaded}, Failed: ${failed}`);

  // Update database: /uploads/gallery/xxx -> /files/gallery/xxx
  console.log(`\n--- Updating database URLs ---`);
  try {
    const result = await pool.query(
      `UPDATE gallery_items
       SET file_path = REPLACE(file_path, '/uploads/gallery/', '/files/gallery/')
       WHERE file_path LIKE '/uploads/gallery/%'`
    );
    console.log(`Updated ${result.rowCount} rows in gallery_items.file_path`);
  } catch (err) {
    console.error("Error updating gallery_items:", err.message);
  }

  await pool.end();
  console.log(`\nMigration complete.`);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});