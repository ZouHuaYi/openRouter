const { getDefaultModel } = require('../router');

async function modelsRoutes(fastify) {
  fastify.get('/v1/models', async (req, reply) => {
    const id = getDefaultModel();
    const data = [
      { id, object: 'model', created: Math.floor(Date.now() / 1000), owned_by: 'gateway' },
    ];
    reply.send({ object: 'list', data });
  });
}

module.exports = modelsRoutes;
