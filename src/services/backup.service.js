// server/src/services/backup.service.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const https = require('https');
const http = require('http');
require('dotenv').config();

const TMP_DIR = path.join(__dirname, '..', '..', 'tmp_backup');

function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function dumpDatabase() {
  return new Promise((resolve, reject) => {
    ensureTmpDir();
    const dumpFile = path.join(TMP_DIR, `${process.env.SITE_NAME || 'db'}_${timestamp()}.sql`);

    const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;

    if (!DB_HOST || !DB_USER || !DB_NAME) {
      return reject(new Error('DB env vars missing (DB_HOST, DB_USER, DB_NAME required)'));
    }

    // Pass password via env, not on the command line
    const env = { ...process.env, PGPASSWORD: DB_PASSWORD };

    const cmd = `pg_dump -h ${DB_HOST} -p ${DB_PORT || 5432} -U ${DB_USER} -d ${DB_NAME} -F p -f "${dumpFile}"`;

    exec(cmd, { env }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`pg_dump failed: ${error.message}\n${stderr}`));
      }
      resolve(dumpFile);
    });
  });
}

function zipFile(filePath) {
  const zip = new AdmZip();
  zip.addLocalFile(filePath);
  const zipPath = filePath.replace(/\.sql$/, '.zip');
  zip.writeZip(zipPath);
  return zipPath;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uploadOnce(zipPath, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const url = process.env.BACKUP_API_URL;
    const apiKey = process.env.BACKUP_API_KEY;
    const siteName = process.env.SITE_NAME || 'unknown_site';

    if (!url || !apiKey) {
      return reject(new Error('BACKUP_API_URL or BACKUP_API_KEY missing in .env'));
    }

    const fileData = fs.readFileSync(zipPath);
    const fileName = path.basename(zipPath);

    const boundary = '----BackupBoundary' + Date.now();
    const preamble =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="site"\r\n\r\n${siteName}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: application/zip\r\n\r\n`;
    const closing = `\r\n--${boundary}--\r\n`;

    const body = Buffer.concat([
      Buffer.from(preamble, 'utf8'),
      fileData,
      Buffer.from(closing, 'utf8'),
    ]);

    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'x-api-key': apiKey,
      },
      timeout: timeoutMs,
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: data });
        } else {
          reject(new Error(`Upload failed: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error(`Upload timed out after ${timeoutMs}ms`));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function uploadBackup(zipPath, { maxAttempts = 3, delayMs = 5000 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[backup] 📤 Sending backup to: ${process.env.BACKUP_API_URL}`);
    console.log(`[backup] 🔄 Attempt ${attempt}/${maxAttempts}...`);
    try {
      const result = await uploadOnce(zipPath);
      console.log(`[backup] ✅ Upload succeeded on attempt ${attempt}`);
      return result;
    } catch (err) {
      lastErr = err;
      console.log(`[backup] ❌ Attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxAttempts) {
        await sleep(delayMs);
      }
    }
  }
  throw new Error(`Upload failed after ${maxAttempts} attempts: ${lastErr.message}`);
}

function cleanup(files) {
  files.forEach((f) => {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
    }
  });
}

async function runBackup() {
  console.log(`[backup] Starting backup for site: ${process.env.SITE_NAME}`);
  let dumpFile, zipPath;
  try {
    dumpFile = await dumpDatabase();
    console.log(`[backup] DB dump created: ${dumpFile}`);

    zipPath = zipFile(dumpFile);
    console.log(`[backup] Zipped: ${zipPath}`);

    const result = await uploadBackup(zipPath);
    console.log(`[backup] Uploaded successfully:`, result.statusCode);

    cleanup([dumpFile, zipPath]);
    console.log('[backup] Done, local temp files cleaned up.');
    return { success: true };
  } catch (err) {
    console.error('[backup] FAILED:', err.message);
    if (dumpFile) cleanup([dumpFile, zipPath].filter(Boolean));
    throw err;
  }
}

module.exports = { runBackup };