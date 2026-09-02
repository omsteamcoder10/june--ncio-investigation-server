// server/src/routes/backup.routes.js
const { runBackup } = require('../services/backup.service');

async function backupRoutes(fastify, options) {
  // POST /api/admin/backup/run
  // Protected — only logged-in admin (JWT) can trigger this
  fastify.post(
    '/api/admin/backup/run',
    { preHandler: [fastify.authenticate] }, // assumes fastify.authenticate = your existing JWT verify decorator
    async (request, reply) => {
      try {
        await runBackup();
        return reply.code(200).send({
          success: true,
          message: 'Backup completed and uploaded successfully.',
        });
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({
          success: false,
          message: 'Backup failed.',
          error: err.message,
        });
      }
    }
  );
}

module.exports = backupRoutes;