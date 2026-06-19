const {
  saveDonation,
  getAllDonations,
  getDonationStats,
} = require('../controllers/donation.controller');

async function donationModule(fastify, options) {
  fastify.post('/', saveDonation);
  fastify.get('/', getAllDonations);
  fastify.get('/stats', getDonationStats);
}

module.exports = donationModule;