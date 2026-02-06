const { Readable } = require('stream');
const { getBackendsFiltered, getDefaultModel, readBackendState, writeBackendState } = require('../router');
const { forward, shouldRetry } = require('../proxy');

function beijingParts(ms) {
  const dtf = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = dtf.formatToParts(new Date(ms));
  const get = (t) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function beijingMidnightTs(parts) {
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);
  return utc - 8 * 60 * 60 * 1000;
}

function nextBeijingMidnight(baseMs) {
  const parts = beijingParts(baseMs);
  const midnight = beijingMidnightTs(parts);
  return baseMs >= midnight ? midnight + 24 * 60 * 60 * 1000 : midnight;
}

function addDaysFromNextMidnight(baseMs, days) {
  return nextBeijingMidnight(baseMs) + (days - 1) * 24 * 60 * 60 * 1000;
}

function nextBeijingWeekMonday(baseMs) {
  const parts = beijingParts(baseMs);
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);
  const baseMidnight = utc - 8 * 60 * 60 * 1000;
  const day = new Date(baseMidnight).getUTCDay();
  const offset = (8 - day) % 7;
  return baseMidnight + offset * 24 * 60 * 60 * 1000;
}

function nextBeijingMonthFirst(baseMs) {
  const parts = beijingParts(baseMs);
  const utc = Date.UTC(parts.year, parts.month - 1, 1, 0, 0, 0);
  const monthFirst = utc - 8 * 60 * 60 * 1000;
  if (baseMs <= monthFirst) return monthFirst;
  const nextUtc = Date.UTC(parts.year, parts.month, 1, 0, 0, 0);
  return nextUtc - 8 * 60 * 60 * 1000;
}

function addMonthsFromNextMidnight(baseMs, months) {
  const nm = nextBeijingMidnight(baseMs);
  const p = beijingParts(nm);
  const utc = Date.UTC(p.year, p.month - 1 + months, p.day, 0, 0, 0);
  return utc - 8 * 60 * 60 * 1000;
}

function computeUnblockAt(rule, existingUnblockAt) {
  const now = Date.now();
  const existing = existingUnblockAt ? new Date(existingUnblockAt).getTime() : 0;
  const base = Math.max(now, existing || 0);

  if (!rule || !rule.type) {
    return new Date(addDaysFromNextMidnight(base, 1)).toISOString();
  }

  if (rule.type === 'preset') {
    const raw = typeof rule.value === 'string' ? rule.value.trim() : rule.value;
    const str = String(raw || '').toLowerCase();
    if (str === 'day' || str.includes('?')) {
      return new Date(addDaysFromNextMidnight(base, 1)).toISOString();
    }
    if (str === 'week' || str.includes('?')) {
      return new Date(nextBeijingWeekMonday(base)).toISOString();
    }
    if (str === 'month' || str.includes('?')) {
      return new Date(nextBeijingMonthFirst(base)).toISOString();
    }
    return new Date(addDaysFromNextMidnight(base, 1)).toISOString();
  }

  if (rule.type === 'hours') {
    const hours = parseInt(rule.value) || 1;
    const ms = now + hours * 60 * 60 * 1000 + 3 * 60 * 1000;
    return new Date(ms).toISOString();
  }

  if (rule.type === 'days') {
    const days = parseInt(rule.value) || 1;
    const ms = now + days * 24 * 60 * 60 * 1000;
    return new Date(ms).toISOString();
  }

  return new Date(addDaysFromNextMidnight(base, 1)).toISOString();
}


async function chatRoutes(fastify) {
  fastify.post('/v1/chat/completions', async (req, reply) => {
    const body = req.body || {};
    const backends = getBackendsFiltered();
    const defaultModelId = getDefaultModel();
    if (!backends.length) {
      return reply.status(503).send({
        error: { message: 'No backends configured', type: 'server_error' },
      });
    }
    const stream = body.stream === true;

    let lastStatus = null;
    let lastHeaders = null;
    let lastBody = null;
    for (const backend of backends) {
      const payload = { ...body, model: backend.backendModel };
      const bodyStr = JSON.stringify(payload);
      const res = await forward(
        backend.baseUrl,
        backend.chatPath || '/v1/chat/completions',
        'POST',
        bodyStr,
        req.headers,
        backend.apiKey
      );
      if (res.ok) {
        if (stream) {
          reply.raw.writeHead(res.status, {
            'content-type': res.headers.get('content-type') || 'text/event-stream',
            'cache-control': 'no-cache',
            connection: 'keep-alive',
          });
          Readable.fromWeb(res.body).pipe(reply.raw);
          return;
        }
        const text = await res.text();
        let out = text;
        try {
          const data = JSON.parse(text);
          if (data && typeof data.model === 'string') data.model = defaultModelId;
          out = JSON.stringify(data);
        } catch (_) {}
        const ct = res.headers.get('content-type');
        if (ct) reply.header('content-type', ct);
        return reply.status(res.status).send(out);
      }
      const text = await res.text();
      if (res.status === 429) {
        const key = `${backend.providerId}:${backend.backendModel}`;
        const state = readBackendState();
        const existing = state[key]?.unblockAt;
        state[key] = { unblockAt: computeUnblockAt(backend.cooldownRule, existing) };
        writeBackendState(state);
      }
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

module.exports = chatRoutes;
