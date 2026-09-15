const { Client } = require("pg");
const {
  S3Client,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");

const db = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;

function parseBase64Image(dataUrl) {
  const match = dataUrl.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
  );

  if (!match) {
    throw new Error("Invalid Base64 image format");
  }

  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");

  const extensionMap = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
  };

  const extension = extensionMap[contentType] || "webp";

  return {
    buffer,
    contentType,
    extension,
  };
}

function safeName(name) {
  return String(name || "team-member")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

async function main() {
  await db.connect();

  const result = await db.query(`
    SELECT id, name, photo
    FROM team_members
    WHERE photo LIKE 'data:image/%'
    ORDER BY id
  `);

  console.log("TEAM BASE64 RECORDS:", result.rows.length);

  for (const member of result.rows) {
    try {
      const parsed = parseBase64Image(member.photo);

      const filename =
        `${safeName(member.name)}-${member.id}-${Date.now()}.${parsed.extension}`;

      const key = `team/${filename}`;

      console.log(`Uploading ID ${member.id}: ${key}`);

      await r2.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: parsed.buffer,
          ContentType: parsed.contentType,
        })
      );

      const dbPath = `/files/${key}`;

      await db.query(
        `UPDATE team_members SET photo = $1 WHERE id = $2`,
        [dbPath, member.id]
      );

      console.log(`SUCCESS ID ${member.id}: ${dbPath}`);
    } catch (error) {
      console.error(`FAILED ID ${member.id}:`, error.message);
    }
  }

  await db.end();

  console.log("Migration completed.");
}

main().catch((error) => {
  console.error("MIGRATION ERROR:", error);
  process.exit(1);
});
