require("dotenv").config();
const { extname } = require("path");
const {
  S3Client,
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");
const { Pool } = require("pg");

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

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm"];

async function moveFile(oldKey, newKey) {
  await r2.send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: `${BUCKET}/${oldKey}`,
      Key: newKey,
    })
  );
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: oldKey }));
}

async function reorganize() {
  // List everything directly under "gallery/" (not gallery/images/ or gallery/videos/)
  const result = await r2.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "gallery/" })
  );

  const flatFiles = (result.Contents || []).filter((obj) => {
    const rest = obj.Key.replace(/^gallery\//, "");
    return !rest.includes("/"); // only files directly in gallery/, not subfolders
  });

  console.log(`Found ${flatFiles.length} files directly in gallery/ to reorganize.\n`);

  let moved = 0;
  let failed = 0;

  for (const obj of flatFiles) {
    const filename = obj.Key.replace(/^gallery\//, "");
    const ext = extname(filename).toLowerCase();
    const subfolder = VIDEO_EXTENSIONS.includes(ext) ? "videos" : "images";
    const newKey = `gallery/${subfolder}/${filename}`;

    try {
      await moveFile(obj.Key, newKey);
      console.log(`✅ Moved: ${filename} -> gallery/${subfolder}/`);
      moved++;

      // Update the DB row that references this old path
      const oldUrl = `/files/${obj.Key}`;
      const newUrl = `/files/${newKey}`;
      await pool.query(
        `UPDATE gallery_items SET file_path = $1 WHERE file_path = $2`,
        [newUrl, oldUrl]
      );
    } catch (err) {
      console.error(`❌ Failed: ${filename}`, err.message);
      failed++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Moved: ${moved}, Failed: ${failed}`);

  await pool.end();
  console.log(`\nReorganization complete.`);
}

reorganize().catch((err) => {
  console.error("Reorganization failed:", err);
  process.exit(1);
});