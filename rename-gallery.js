require("dotenv").config();

const {
  S3Client,
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");

const { Client } = require("pg");

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const Bucket = process.env.R2_BUCKET_NAME;

const pg = new Client({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: process.env.DB_PASSWORD,
  database: "ncio_master",
});

function targetName(item, photoNo, videoNo, updateNo) {
  if (item.type === "photo") {
    return `gallery${photoNo}.webp`;
  }

  if (item.type === "video") {
    return `galleryvideo${videoNo}.mp4`;
  }

  return `update${updateNo}.webp`;
}

(async () => {
  try {
    await pg.connect();

    const result = await pg.query(
      "SELECT id, type, file_path FROM gallery_items ORDER BY id"
    );

    const items = result.rows;

    console.log("");
    console.log("========================================");
    console.log(" NCIO GALLERY RENAME");
    console.log("========================================");
    console.log("DB ROWS:", items.length);
    console.log("");

    let photoNo = 0;
    let videoNo = 0;
    let updateNo = 0;

    for (const item of items) {
      if (item.type === "photo") photoNo++;
      if (item.type === "video") videoNo++;
      if (item.type === "update") updateNo++;

      const filename = targetName(
        item,
        photoNo,
        videoNo,
        updateNo
      );

      const folder =
        item.type === "video"
          ? "gallery/videos"
          : "gallery/images";

      const newKey = `${folder}/${filename}`;
      const newPath = `/files/${newKey}`;

      const oldKey = item.file_path.replace(/^\/files\//, "");

      console.log("----------------------------------------");
      console.log(`ID ${item.id} | ${item.type}`);
      console.log("OLD:", oldKey);
      console.log("NEW:", newKey);

      if (item.file_path === newPath) {
        console.log("ALREADY DONE - DB:", newPath);
        continue;
      }

      let targetExists = false;

      try {
        await r2.send(
          new HeadObjectCommand({
            Bucket,
            Key: newKey,
          })
        );

        targetExists = true;
        console.log("TARGET ALREADY EXISTS IN R2");
      } catch (err) {
        targetExists = false;
      }

      if (!targetExists) {
        console.log("COPYING...");

        await r2.send(
          new CopyObjectCommand({
            Bucket,
            CopySource: encodeURIComponent(`${Bucket}/${oldKey}`),
            Key: newKey,
          })
        );

        console.log("COPY COMPLETE");

        await r2.send(
          new HeadObjectCommand({
            Bucket,
            Key: newKey,
          })
        );

        console.log("NEW R2 OBJECT VERIFIED");
      }

      if (oldKey !== newKey) {
        console.log("DELETING OLD R2 OBJECT...");

        await r2.send(
          new DeleteObjectCommand({
            Bucket,
            Key: oldKey,
          })
        );

        console.log("OLD R2 OBJECT DELETED");
      }

      await pg.query(
        "UPDATE gallery_items SET file_path = $1 WHERE id = $2",
        [newPath, item.id]
      );

      console.log("DB UPDATED:", newPath);
    }

    console.log("");
    console.log("========================================");
    console.log(" RENAME COMPLETE");
    console.log("========================================");
    console.log("");

    await pg.end();
  } catch (err) {
    console.error("");
    console.error("========================================");
    console.error(" RENAME FAILED");
    console.error("========================================");
    console.error(err.message);
    console.error("");

    try {
      await pg.end();
    } catch {}

    process.exit(1);
  }
})();
