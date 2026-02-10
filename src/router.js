const path = require('path');
const fs = require('fs');

let providers = {};
let defaultModel = 'chat';
let backendsList = [];

function resolveConfigDir() {
  if (process.env.CONFIG_DIR && String(process.env.CONFIG_DIR).trim()) return String(process.env.CONFIG_DIR).trim();
  return path.join(process.cwd(), 'config');
}

function resolveConfigPath() {
  return path.join(resolveConfigDir(), 'providers.json');
}

function resolveStatePath() {
  return path.join(resolveConfigDir(), 'backend-state.json');
}

function resolveEnvRef(value) {
  if (typeof value !== 'string') return value;
  const m = value.match(/^\$\{(.+)\}$/);
  if (m) return process.env[m[1].trim()] ?? value;
  return value;
}

function loadConfig(configPath) {
  const p = configPath || resolveConfigPath();
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
      maxTokens: b.maxTokens || null,
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

const statePath = () => resolveStatePath();

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
  let stateChanged = false;

  const filtered = backendsList.filter((b) => {
    const key = `${b.providerId}:${b.backendModel}`;
    const s = state[key];
    if (!s) return true;

    // Check time-based cooldown
    if (s.unblockAt) {
      const at = new Date(s.unblockAt).getTime();
      if (!Number.isNaN(at) && at > now) return false;
      
      // Cooldown expired: reset tokens and unblockAt
      delete s.unblockAt;
      s.usedTokens = 0;
      stateChanged = true;
    }

    // Check token-based limit
    if (b.maxTokens && s.usedTokens >= b.maxTokens) {
      // If we are here, it means we hit token limit but unblockAt wasn't set or expired.
      // This case shouldn't normally happen if we set unblockAt immediately when hitting limit,
      // but as a fallback, we return false.
      return false;
    }

    return true;
  });

  if (stateChanged) writeBackendState(state);
  return filtered;
}

function writeBackendState(state) {
  const p = statePath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf-8');
}

function updateBackendUsage(providerId, model, tokens, computeUnblockAt) {
  const key = `${providerId}:${model}`;
  const state = readBackendState();
  if (!state[key]) state[key] = { usedTokens: 0 };
  if (state[key].usedTokens == null) state[key].usedTokens = 0;
  
  state[key].usedTokens += tokens;

  // Find the backend config to check maxTokens and cooldownRule
  const backend = backendsList.find(b => b.providerId === providerId && b.backendModel === model);
  if (backend && backend.maxTokens && state[key].usedTokens >= backend.maxTokens) {
    if (!state[key].unblockAt) {
      state[key].unblockAt = computeUnblockAt(backend.cooldownRule, null);
    }
  }

  writeBackendState(state);
}

module.exports = { loadConfig, getBackends, getBackendsFiltered, getDefaultModel, readBackendState, writeBackendState, updateBackendUsage, statePath };
