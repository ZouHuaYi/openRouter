const path = require('path');
const fs = require('fs');

let providers = {};
let defaultModel = 'chat';
let backendsList = [];

function resolveEnvRef(value) {
  if (typeof value !== 'string') return value;
  const m = value.match(/^\$\{(.+)\}$/);
  if (m) return process.env[m[1].trim()] ?? value;
  return value;
}

function loadConfig(configPath) {
  const p = configPath || path.join(process.cwd(), 'config', 'providers.json');
  const raw = fs.readFileSync(p, 'utf-8');
  const data = JSON.parse(raw);
  const normPath = (p) => (p && String(p).trim()) ? '/' + String(p).trim().replace(/^\//, '') : '/v1/chat/completions';
  providers = {};
  for (const [id, cfg] of Object.entries(data.providers || {})) {
    providers[id] = {
      baseUrl: (cfg.baseUrl || '').replace(/\/$/, ''),
      apiKey: resolveEnvRef(cfg.apiKey),
      chatPath: normPath(cfg.chatPath),
    };
  }
  defaultModel = data.defaultModel || 'chat';
  backendsList = (data.backends || []).map((b) => {
    const provider = providers[b.provider];
    if (!provider) return null;
    return {
      providerId: b.provider,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      chatPath: (b.chatPath != null && String(b.chatPath).trim()) ? normPath(b.chatPath) : provider.chatPath,
      backendModel: b.model || defaultModel,
    };
  }).filter(Boolean);
  return { providers, defaultModel, backends: backendsList };
}

function getBackends() {
  return backendsList;
}

function getDefaultModel() {
  return defaultModel;
}

module.exports = { loadConfig, getBackends, getDefaultModel };
