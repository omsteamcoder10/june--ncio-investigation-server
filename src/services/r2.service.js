const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

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
 * Upload a Buffer to Cloudflare R2.
 *
 * Returns the backend URL stored in PostgreSQL.
 *
 * Example:
 * R2 key:
 * team/member-1.webp
 *
 * DB value:
 * /files/team/member-1.webp
 */
async function uploadToR2(
  buffer,
  filename,
  contentType,
  folder = "misc"
) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error("uploadToR2 requires a Buffer");
  }

  if (!filename) {
    throw new Error("R2 filename is required");
  }

  const safeFilename = String(filename)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, "-");

  const key = `${folder}/${safeFilename}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
    })
  );

  return `/files/${key}`;
}

/**
 * Delete an R2 file using its backend URL.
 *
 * Example:
 * /files/team/member-1.webp
 */
async function deleteFromR2(fileUrl) {
  if (
    !fileUrl ||
    typeof fileUrl !== "string" ||
    !fileUrl.startsWith("/files/")
  ) {
    return;
  }

  const key = fileUrl.replace(/^\/files\//, "");

  try {
    await r2.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
      })
    );
  } catch (err) {
    console.error(
      "Failed to delete R2 object:",
      key,
      err
    );
  }
}

module.exports = {
  uploadToR2,
  deleteFromR2,
  r2,
  BUCKET,
};