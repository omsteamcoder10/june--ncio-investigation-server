// scripts/seedAdmin.js
//
// One-time script: creates the first admin row in the `admins` table,
// using the credentials currently in .env (or the hardcoded fallback
// that auth.controller.js used before).
//
// Run this ONCE:
//   node scripts/seedAdmin.js
//
// After this runs successfully, login will check the DB instead of .env.

require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../src/plugins/db');

const run = async () => {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const plainPassword = process.env.ADMIN_PASSWORD || 'ncio@admin123';
  const email = process.env.ADMIN_EMAIL || 'admin@ncio.com';

  try {
    const existing = await pool.query('SELECT id FROM admins WHERE username = $1', [username]);
    if (existing.rows[0]) {
      console.log(`Admin "${username}" already exists (id=${existing.rows[0].id}). Nothing to do.`);
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const result = await pool.query(
      `INSERT INTO admins (username, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'ADMIN')
       RETURNING id, username, email`,
      [username, 'Admin', email, passwordHash]
    );

    console.log('✅ Admin created:', result.rows[0]);
    console.log(`   Login with username: "${username}" and your existing password.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
};

run();