const pool = require('../plugins/db');

const saveDonation = async (request, reply) => {
  const { paymentId, donorName, email, phone, amount } = request.body;
  try {
    const result = await pool.query(
      `INSERT INTO donations (payment_id, donor_name, email, phone, amount, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'SUCCESS', NOW()) RETURNING *`,
      [paymentId, donorName, email, phone, amount]
    );
    return reply.code(201).send({ message: 'Donation saved', donation: result.rows[0] });
  } catch (err) {
    console.error('DONATION ERROR:', err.message);
    reply.code(500).send({ error: err.message });
  }
};

const getAllDonations = async (request, reply) => {
  try {
    const result = await pool.query('SELECT * FROM donations ORDER BY created_at DESC');
    return result.rows;
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

const getDonationStats = async (request, reply) => {
  try {
    const total = await pool.query('SELECT COUNT(*) FROM donations');
    const totalAmount = await pool.query('SELECT SUM(amount) FROM donations');
    const today = await pool.query(
      `SELECT COUNT(*), SUM(amount) FROM donations WHERE DATE(created_at) = CURRENT_DATE`
    );
    const byMonth = await pool.query(`
      SELECT TO_CHAR(created_at, 'Mon YYYY') as month, 
             COUNT(*) as count, SUM(amount) as total
      FROM donations GROUP BY month ORDER BY MIN(created_at) DESC LIMIT 6
    `);
    return {
      totalDonations: parseInt(total.rows[0].count),
      totalAmount: parseInt(totalAmount.rows[0].sum) || 0,
      todayCount: parseInt(today.rows[0].count),
      todayAmount: parseInt(today.rows[0].sum) || 0,
      byMonth: byMonth.rows,
    };
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
};

module.exports = { saveDonation, getAllDonations, getDonationStats };