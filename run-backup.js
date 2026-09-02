// server/run-backup.js
// Standalone script so `npm run backup` can trigger the same service
// used by the admin route.
const { runBackup } = require('./src/services/backup.service');

runBackup()
  .then(() => {
    console.log('[run-backup] Backup finished successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[run-backup] Backup failed:', err.message);
    process.exit(1);
  });