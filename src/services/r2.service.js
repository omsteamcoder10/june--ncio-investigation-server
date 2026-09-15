const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;

/**
 * Uploads a buffer to R2 under a specific folder and returns the
 * backend proxy URL used to serve it.
 * @param {Buffer} buffer
 * @param {string} filename
 * @param {string} contentType
 * @param {string} folder - e.g. "gallery", "members", "misc"
 */
async function uploadToR2(buffer, filename, contentType, folder = "misc") {
  const key = `${folder}/${filename}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  // Bucket public access is disabled, so files are served through our
  // own backend route (see routes/files.routes.js).
  return `/files/${key}`;
}

/**
 * Deletes a file from R2 given its stored URL (e.g. "/files/gallery/xxx.webp").
 */
async function deleteFromR2(fileUrl) {
  if (!fileUrl || !fileUrl.startsWith("/files/")) return;

  const key = fileUrl.replace(/^\/files\//, "");

  try {
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    console.error("Failed to delete R2 object:", key, err);
  }
}

module.exports = { uploadToR2, deleteFromR2, r2, BUCKET };
