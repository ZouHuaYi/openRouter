const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow = null;
let gatewayProcess = null;

function getAppRoot() {
  return app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd();
}

function getConfigPath() {
  return path.join(getAppRoot(), 'config', 'providers.json');
}

function getEnvPath() {
  return path.join(getAppRoot(), '.env');
}

function getBackendStatePath() {
  return path.join(getAppRoot(), 'config', 'backend-state.json');
}

function readBackendState() {
  const p = getBackendStatePath();
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return {};
  }
}

function writeBackendState(state) {
  const p = getBackendStatePath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf-8');
}

function readConfig() {
  const p = getConfigPath();
  if (!fs.existsSync(p)) return { providers: {}, defaultModel: 'chat', backends: [] };
  const raw = fs.readFileSync(p, 'utf-8');
  return JSON.parse(raw);
}

function writeConfig(data) {
  const p = getConfigPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
}

function parseEnv(content) {
  const out = {};
  for (const line of (content || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function readEnv() {
  const p = getEnvPath();
  if (!fs.existsSync(p)) return {};
  return parseEnv(fs.readFileSync(p, 'utf-8'));
}

function writeEnv(obj) {
  const p = getEnvPath();
  const lines = Object.entries(obj).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(p, lines.join('\n') + '\n', 'utf-8');
}

function ensureConfigFiles() {
  const root = getAppRoot();
  const configDir = path.join(root, 'config');
  
  // 确保 config 目录存在
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  // 确保 providers.json 存在
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    writeConfig({ providers: {}, defaultModel: 'chat', backends: [] });
  }
  
  // 确保 backend-state.json 存在
  const statePath = getBackendStatePath();
  if (!fs.existsSync(statePath)) {
    writeBackendState({});
  }
  
  // 确保 .env 存在
  const envPath = getEnvPath();
  if (!fs.existsSync(envPath)) {
    writeEnv({ PORT: '3333', GATEWAY_API_KEY: '' });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 700,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  ensureConfigFiles();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (gatewayProcess) {
    gatewayProcess.kill();
    gatewayProcess = null;
  }
  app.quit();
});

ipcMain.handle('getConfig', () => readConfig());
ipcMain.handle('saveConfig', (_, data) => {
  writeConfig(data);
  return { ok: true };
});

ipcMain.handle('getEnv', () => readEnv());
ipcMain.handle('setEnv', (_, key, value) => {
  const env = readEnv();
  env[key] = value;
  writeEnv(env);
  return { ok: true };
});
ipcMain.handle('setEnvAll', (_, obj) => {
  writeEnv(obj || {});
  return { ok: true };
});

ipcMain.handle('getBackendState', () => readBackendState());
ipcMain.handle('setBackendCooldown', (_, key, unblockAt) => {
  const state = readBackendState();
  if (unblockAt == null || unblockAt === '') {
    delete state[key];
  } else {
    state[key] = { unblockAt: typeof unblockAt === 'string' ? unblockAt : new Date(unblockAt).toISOString() };
  }
  writeBackendState(state);
  return { ok: true };
});

ipcMain.handle('getGatewayStatus', () => ({
  running: gatewayProcess != null && !gatewayProcess.killed,
  port: readEnv().PORT || 3333,
}));

ipcMain.handle('startGateway', async () => {
  if (gatewayProcess && !gatewayProcess.killed) return { ok: false, error: 'Already running' };
  const root = getAppRoot();
  const envPath = getEnvPath();
  const env = { ...process.env };
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    Object.assign(env, parseEnv(content));
  }
  const scriptPath = path.join(root, 'src', 'index.js');
  if (!fs.existsSync(scriptPath)) return { ok: false, error: 'Gateway script not found' };
  gatewayProcess = spawn('node', [scriptPath], { cwd: root, env });
  gatewayProcess.on('error', (err) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('gateway-error', err.message);
  });
  gatewayProcess.on('exit', (code) => {
    gatewayProcess = null;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('gateway-exit', code);
  });
  gatewayProcess.stderr?.on('data', (d) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('gateway-log', d.toString());
  });
  return { ok: true };
});

ipcMain.handle('stopGateway', () => {
  if (!gatewayProcess || gatewayProcess.killed) return { ok: true };
  gatewayProcess.kill();
  gatewayProcess = null;
  return { ok: true };
});
