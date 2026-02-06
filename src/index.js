require('dotenv').config();
const Fastify = require('fastify');
const cors = require('@fastify/cors');
const { loadConfig } = require('./router');
const { gatewayAuth } = require('./middleware/auth');
const chatRoutes = require('./routes/chat');
const embeddingsRoutes = require('./routes/embeddings');
const modelsRoutes = require('./routes/models');

const PORT = Number(process.env.PORT) || 3333;
const GATEWAY_API_KEY = process.env.GATEWAY_API_KEY || '';

loadConfig();

const app = Fastify({ logger: true });

app.register(cors, { origin: true });

if (GATEWAY_API_KEY) {
  app.addHook('preHandler', gatewayAuth(GATEWAY_API_KEY));
}

app.register(chatRoutes);
app.register(embeddingsRoutes);
app.register(modelsRoutes);

app.get('/', async (req, reply) => {
  return reply.send({
    message: 'OpenAI-compatible aggregation gateway',
    docs: 'Use baseURL = http://localhost:' + PORT + '/v1',
  });
});

app.listen({ port: PORT, host: '0.0.0.0' }, (err, addr) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log('Gateway listening at', addr);
});
