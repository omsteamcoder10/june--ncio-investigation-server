const {
  saveDonation,
  getAllDonations,
  getDonationStats,
} = require('../controllers/donation.controller');

async function donationRoutes(fastify, options) {
  fastify.post('/', saveDonation);
  fastify.get('/', getAllDonations);
  fastify.get('/stats', getDonationStats);
}

module.exports = donationRoutes;