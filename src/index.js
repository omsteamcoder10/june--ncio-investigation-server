const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
require('dotenv').config();

// Register CORS
fastify.register(cors, {
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
});

// Routes
fastify.register(require('./routes/members'), { prefix: '/api/members' });
fastify.register(require('./routes/auth'), { prefix: '/api/auth' });

// Health check
fastify.get('/', async () => ({ status: 'NCIO Server Running 🚀' }));

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 5000, host: '0.0.0.0' });
    console.log(`Server running on port ${process.env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();