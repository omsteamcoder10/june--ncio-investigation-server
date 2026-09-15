const { Client } = require("pg");
const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const sharp = require("sharp");

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

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function main() {
  await db.connect();

  const result = await db.query(`
    SELECT id, photo
    FROM team_members
    WHERE photo LIKE '/files/team/%.jpg'
    ORDER BY id
  `);

  console.log("TEAM JPG RECORDS:", result.rows.length);

  for (const member of result.rows) {
    try {
      const oldKey = member.photo.replace("/files/", "");

      const object = await r2.send(
        new GetObjectCommand({
          Bucket: BUCKET,
          Key: oldKey,
        })
      );

      const originalBuffer = await streamToBuffer(object.Body);

      const webpBuffer = await sharp(originalBuffer)
        .webp({ quality: 82 })
        .toBuffer();

      const newKey = oldKey.replace(/\.jpg$/i, ".webp");

      await r2.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: newKey,
          Body: webpBuffer,
          ContentType: "image/webp",
        })
      );

      console.log(
        `ID ${member.id}: ${oldKey} -> ${newKey} | ${originalBuffer.length} -> ${webpBuffer.length} bytes`
      );
    } catch (error) {
      console.error(`FAILED ID ${member.id}:`, error.message);
    }
  }

  await db.end();

  console.log("WEBP CONVERSION COMPLETED.");
}

main().catch((error) => {
  console.error("ERROR:", error);
  process.exit(1);
});
