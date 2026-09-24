// scripts/seedTeamMembers.js
//
// One-time script: adds the initial team members (Board of Directors &
// NRI Officers) into the `team_members` table so they appear in the
// Admin → Team page and on the public /team page.
//
// Run:
//   node scripts/seedTeamMembers.js
//
// It is idempotent: a member with the same name + role is skipped, so it
// is safe to run more than once. Photos are left empty (NULL) — they can
// be added later from Admin → Team Members (Add photo per member).

require('dotenv').config();
const pool = require('../src/plugins/db');

const BOARD_DIRECTORS_ROLE = 'Board of Directors (இயக்குநர்கள் குழு)';
const NRI_OFFICERS_ROLE = 'NRI Officers (NRI அதிகாரிகள்)';

/* Role-specific greeting, filled automatically for each new member. */
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

const members = [
  /* ---------------- BOARD OF DIRECTORS ---------------- */
  { name: 'Mr.APV.Vetrikannan', role: BOARD_DIRECTORS_ROLE, display_order: 0 },
  { name: 'Mr.M.Velmurugan', role: BOARD_DIRECTORS_ROLE, display_order: 1 },
  { name: 'Mr.T.Murugan', role: BOARD_DIRECTORS_ROLE, display_order: 2 },
  { name: 'Mr.M.S.Vignesh B.Sc, M.B.A, Ph.D', role: BOARD_DIRECTORS_ROLE, display_order: 3 },
  { name: 'Mr.Lion Dr.A.Mohamed Riaz M.D., R.D.', role: BOARD_DIRECTORS_ROLE, display_order: 4 },
  { name: 'Mrs.M.Kala M.B.A.', role: BOARD_DIRECTORS_ROLE, display_order: 5 },

  /* ---------------- NRI OFFICERS ---------------- */
  { name: 'Mr.Allwin Jose (DIRECTOR)', role: NRI_OFFICERS_ROLE, display_order: 0 },
  { name: 'Mr.S.M.Samsudeen (SECRETARY)', role: NRI_OFFICERS_ROLE, display_order: 1 },
  { name: 'Mr.Saleem Neju (ADMIN DIRECTOR, QATAR)', role: NRI_OFFICERS_ROLE, display_order: 2 },
  { name: 'Mr.T.Simiyon (COORDINATOR)', role: NRI_OFFICERS_ROLE, display_order: 3 },
  { name: 'Mr.Mohamed Ali (ADMINISTRATION PRO)', role: NRI_OFFICERS_ROLE, display_order: 4 },
];

const run = async () => {
  let added = 0;
  let skipped = 0;

  try {
    for (const member of members) {
      const existing = await pool.query(
        'SELECT id FROM team_members WHERE name = $1 AND role = $2',
        [member.name, member.role]
      );

      if (existing.rows[0]) {
        console.log(`SKIP (already exists): ${member.name}`);
        skipped += 1;
        continue;
      }

      const result = await pool.query(
        `INSERT INTO team_members (name, role, district, photo, greeting, display_order, is_active)
         VALUES ($1, $2, '', NULL, $4, $3, true)
         RETURNING id, name, role`,
        [
          member.name,
          member.role,
          member.display_order,
          ROLE_GREETINGS[member.role] || null,
        ]
      );

      console.log(`ADDED: ${result.rows[0].name}  (id=${result.rows[0].id})`);
      added += 1;
    }

    console.log('');
    console.log(`Done. Added: ${added} | Skipped (already present): ${skipped}`);
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    pool.end();
  }
};

run();