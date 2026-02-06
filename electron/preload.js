const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gateway', {
  getConfig: () => ipcRenderer.invoke('getConfig'),
  saveConfig: (data) => ipcRenderer.invoke('saveConfig', data),
  getEnv: () => ipcRenderer.invoke('getEnv'),
  setEnv: (key, value) => ipcRenderer.invoke('setEnv', key, value),
  setEnvAll: (obj) => ipcRenderer.invoke('setEnvAll', obj),
  getBackendState: () => ipcRenderer.invoke('getBackendState'),
  setBackendCooldown: (key, unblockAt) => ipcRenderer.invoke('setBackendCooldown', key, unblockAt),
  getGatewayStatus: () => ipcRenderer.invoke('getGatewayStatus'),
  startGateway: () => ipcRenderer.invoke('startGateway'),
  stopGateway: () => ipcRenderer.invoke('stopGateway'),
  onGatewayLog: (cb) => { ipcRenderer.on('gateway-log', (_, msg) => cb(msg)); },
  onGatewayExit: (cb) => { ipcRenderer.on('gateway-exit', (_, code) => cb(code)); },
  onGatewayError: (cb) => { ipcRenderer.on('gateway-error', (_, msg) => cb(msg)); },
});
