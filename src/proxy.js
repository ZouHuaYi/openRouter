const { fetch } = require('undici');

const FORWARD_HEADERS = ['content-type', 'accept', 'accept-encoding'];

function buildTargetUrl(baseUrl, pathname) {
  const base = baseUrl.replace(/\/$/, '');
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${path}`;
}

function buildForwardHeaders(incomingHeaders, apiKey) {
  const out = {};
  for (const name of FORWARD_HEADERS) {
    const v = incomingHeaders[name];
    if (v) out[name] = v;
  }
  if (apiKey) out['authorization'] = `Bearer ${apiKey}`;
  return out;
}

async function forward(baseUrl, pathname, method, body, incomingHeaders, apiKey) {
  const url = buildTargetUrl(baseUrl, pathname);
  const headers = buildForwardHeaders(incomingHeaders, apiKey);
  if (body && !headers['content-type']) headers['content-type'] = 'application/json';
  const res = await fetch(url, {
    method,
    headers,
    body: body || undefined,
  });
  return res;
}

function shouldRetry(status) {
  return status === 429 || (status >= 500 && status < 600);
}

module.exports = { forward, buildTargetUrl, shouldRetry };
