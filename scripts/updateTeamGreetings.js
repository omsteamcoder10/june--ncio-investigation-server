// scripts/updateTeamGreetings.js
//
// One-time script: fills in the role-specific greeting (quote) for every
// team member whose greeting is currently empty.
//
// Run:
//   node scripts/updateTeamGreetings.js
//
// Safe to run more than once. Members that already have a custom greeting
// are never overwritten.

require('dotenv').config();
const pool = require('../src/plugins/db');

const ROLE_GREETINGS = {
  'Board of Directors (இயக்குநர்கள் குழு)':
    'Guiding growth with vision and integrity',
  'NRI Officers (NRI அதிகாரிகள்)':
    'Serving our roots from every corner of the world',
  'State Chairman (மாநில தலைவர்)':
    'Unity is our strength, progress is our goal',
  'State Deputy Chairman (மாநில துணைத் தலைவர்)':
    'Supporting leadership, strengthening service',
  'State General Secretary (மாநில பொதுச் செயலாளர்)':
    'Organization is the foundation of our success',
  'Deputy General Secretary (துணைப் பொதுச் செயலாளர்)':
    'Committed to service through effective administration',
  'Chief Advisors (தலைமை ஆலோசகர்கள்)':
    'Guidance shaped by experience and wisdom',
  'Chief Legal Advisors (High Court) (தலைமை சட்ட ஆலோசகர்கள் - உயர் நீதிமன்றம்)':
    'Justice is our duty, law is our guide',
  'Chief Advisors (RTI) (தலைமை ஆலோசகர்கள் - RTI)':
    'Transparency is our right',
  'Coordinator (Organisation) (ஒருங்கிணைப்பாளர் - அமைப்பு)':
    'Coordination is the backbone of the organization',
  'Administration PRO (நிர்வாக பொது தொடர்பு அதிகாரி)':
    'Precision in administration, integrity in service',
  'State Secretary (மாநில செயலாளர்)':
    'Dedicated to serving the organization',
};

const run = async () => {
  let updated = 0;

  try {
    for (const [role, greeting] of Object.entries(ROLE_GREETINGS)) {
      if (!role || !greeting) continue;

      const result = await pool.query(
        `UPDATE team_members
         SET greeting = $2
         WHERE role = $1
           AND (greeting IS NULL OR greeting = '')`,
        [role, greeting]
      );

      console.log(`• ${result.rowCount} member(s) ← ${greeting}`);
      updated += result.rowCount;
    }

    console.log('');
    console.log(`Done. Greetings filled for ${updated} member(s).`);
    process.exit(0);
  } catch (err) {
    console.error('Update failed:', err.message);
    process.exit(1);
  } finally {
    pool.end();
  }
};

run();