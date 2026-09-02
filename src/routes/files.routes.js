const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { r2, BUCKET } = require("../services/r2.service");

const ALLOWED_FOLDERS = ["gallery", "members", "misc"];

async function filesRoutes(fastify, options) {
  // GET /files/*  — streams the file from R2, supports nested paths
  // e.g. /files/gallery/images/xxx.webp -> key: gallery/images/xxx.webp
  fastify.get("/files/*", async (request, reply) => {
    const key = request.params["*"];

    if (!key) {
      return reply.code(400).send({ error: "Missing file path" });
    }

    const topFolder = key.split("/")[0];
    if (!ALLOWED_FOLDERS.includes(topFolder)) {
      return reply.code(400).send({ error: "Invalid folder" });
    }

    try {
      const result = await r2.send(
        new GetObjectCommand({ Bucket: BUCKET, Key: key })
      );

      if (result.ContentType) {
        reply.header("content-type", result.ContentType);
      }
      reply.header("cache-control", "public, max-age=86400");

      return reply.send(result.Body);
    } catch (err) {
      request.log.error({ err, key }, "Failed to fetch file from R2");
      return reply.code(404).send({ error: "File not found" });
    }
  });
}

module.exports = filesRoutes;