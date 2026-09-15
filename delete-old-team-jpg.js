const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

const BUCKET = process.env.R2_BUCKET_NAME;

const keys = [
  "team/team-member-26-1789453630584.jpg",
  "team/team-member-27-1789453631502.jpg",
  "team/team-member-28-1789453632045.jpg",
  "team/team-member-29-1789453632595.jpg",
  "team/team-member-30-1789453633129.jpg",
  "team/team-member-31-1789453633757.jpg"
];

async function main() {
  for (const Key of keys) {
    await client.send(new DeleteObjectCommand({
      Bucket: BUCKET,
      Key
    }));
    console.log("DELETED:", Key);
  }

  console.log("OLD JPG FILES REMOVED FROM R2.");
}

main().catch(error => {
  console.error("R2 DELETE ERROR:", error.message);
  process.exit(1);
});
