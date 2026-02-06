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
      cooldownRule: b.cooldownRule || null,
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

const statePath = () => path.join(process.cwd(), 'config', 'backend-state.json');

function readBackendState() {
  const p = statePath();
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return {};
  }
}

function getBackendsFiltered() {
  const state = readBackendState();
  const now = Date.now();
  return backendsList.filter((b) => {
    const key = `${b.providerId}:${b.backendModel}`;
    const s = state[key];
    if (!s || !s.unblockAt) return true;
    const at = new Date(s.unblockAt).getTime();
    return Number.isNaN(at) || at <= now;
  });
}

function writeBackendState(state) {
  const p = statePath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf-8');
}

module.exports = { loadConfig, getBackends, getBackendsFiltered, getDefaultModel, readBackendState, writeBackendState, statePath };
