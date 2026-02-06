const { getBackends, getDefaultModel } = require('../router');
const { forward, shouldRetry } = require('../proxy');

async function embeddingsRoutes(fastify) {
  fastify.post('/v1/embeddings', async (req, reply) => {
    const body = req.body || {};
    const backends = getBackends();
    const defaultModelId = getDefaultModel();
    if (!backends.length) {
      return reply.status(503).send({
        error: { message: 'No backends configured', type: 'server_error' },
      });
    }
    let lastStatus = null;
    let lastHeaders = null;
    let lastBody = null;
    for (const backend of backends) {
      const payload = { ...body, model: backend.backendModel };
      const bodyStr = JSON.stringify(payload);
      const res = await forward(
        backend.baseUrl,
        '/v1/embeddings',
        'POST',
        bodyStr,
        req.headers,
        backend.apiKey
      );
      if (res.ok) {
        const text = await res.text();
        let out = text;
        try {
          const data = JSON.parse(text);
          if (data && typeof data.model === 'string') data.model = defaultModelId;
          if (Array.isArray(data?.data)) {
            data.data.forEach((d) => { if (d && typeof d.model === 'string') d.model = defaultModelId; });
          }
          out = JSON.stringify(data);
        } catch (_) {}
        const ct = res.headers.get('content-type');
        if (ct) reply.header('content-type', ct);
        return reply.status(res.status).send(out);
      }
      const text = await res.text();
      if (shouldRetry(res.status)) {
        lastStatus = res.status;
        lastHeaders = res.headers;
        lastBody = text;
        continue;
      }
      const ct = res.headers.get('content-type');
      if (ct) reply.header('content-type', ct);
      return reply.status(res.status).send(text);
    }
    if (lastStatus != null) {
      const ct = lastHeaders?.get?.('content-type');
      if (ct) reply.header('content-type', ct);
      return reply.status(lastStatus).send(lastBody);
    }
    return reply.status(503).send({
      error: { message: 'Service unavailable', type: 'server_error' },
    });
  });
}

module.exports = embeddingsRoutes;
