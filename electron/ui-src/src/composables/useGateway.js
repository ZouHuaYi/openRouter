export function useGateway() {
  const g = typeof window !== 'undefined' && window.gateway
  const safeClone = (data) => {
    if (data == null) return data
    try {
      return JSON.parse(JSON.stringify(data))
    } catch {
      return data
    }
  }
  if (!g) {
    return {
      getConfig: () => Promise.resolve({ providers: {}, defaultModel: 'chat', backends: [] }),
      saveConfig: () => Promise.resolve({ ok: true }),
      getEnv: () => Promise.resolve({}),
      setEnv: () => Promise.resolve({ ok: true }),
      setEnvAll: () => Promise.resolve({ ok: true }),
      getBackendState: () => Promise.resolve({}),
      setBackendCooldown: () => Promise.resolve({ ok: true }),
      getGatewayStatus: () => Promise.resolve({ running: false, port: 3333 }),
      startGateway: () => Promise.resolve({ ok: false }),
      stopGateway: () => Promise.resolve({ ok: true }),
      onGatewayLog: () => {},
      onGatewayExit: () => {},
      onGatewayError: () => {},
    }
  }
  return {
    ...g,
    saveConfig: (data) => g.saveConfig(safeClone(data)),
    setEnvAll: (obj) => g.setEnvAll(safeClone(obj)),
  }
}
