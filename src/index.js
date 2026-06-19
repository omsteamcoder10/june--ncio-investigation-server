const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
require('dotenv').config();

// CORS
fastify.register(cors, {
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
});

// Routes
fastify.register(require('./modules/member.module'), {
  prefix: '/api/members',
});

fastify.register(require('./modules/auth.module'), {
  prefix: '/api/auth',
});

fastify.register(require('./modules/donation.module'), {
  prefix: '/api/donations',
});

fastify.register(require('./modules/team.module'), {
  prefix: '/api/team',
});

fastify.register(require('./modules/updates.module'), {
  prefix: '/api/updates',
});

// Health Check
fastify.get('/', async () => ({
  status: 'NCIO Server Running 🚀',
}));

// Start Server
const start = async () => {
  try {
    await fastify.listen({
      port: process.env.PORT || 5000,
      host: '0.0.0.0',
    });

    console.log(
      `Server running on port ${process.env.PORT || 5000}`
    );
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();