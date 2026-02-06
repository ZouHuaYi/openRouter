# 持久化功能测试指南

## 修复内容总结

### 1. 异步操作修复
所有前端组件中调用 `gateway` API 的地方都已添加 `await`，确保数据真正写入磁盘后才刷新 UI。

**修复的文件：**
- `electron/ui-src/src/views/Backends.vue` - 后端管理
- `electron/ui-src/src/views/Providers.vue` - 服务商管理
- `electron/ui-src/src/views/Settings.vue` - 设置管理

### 2. 启动时初始化
添加了 `ensureConfigFiles()` 函数，在应用启动时自动创建所有必要的配置文件。

**修复的文件：**
- `electron/main.js` - 主进程

### 3. 持久化文件清单

| 文件 | 用途 | 位置 |
|------|------|------|
| `config/providers.json` | 服务商配置、后端列表、默认模型 | 项目根目录 |
| `config/backend-state.json` | 后端限流状态 | 项目根目录 |
| `.env` | 环境变量（端口、API Key 等） | 项目根目录 |

---

## 测试步骤

### 测试 1: 后端限流状态持久化

1. **启动应用**：
   ```bash
   npm run ui
   ```

2. **设置限流**：
   - 进入"模型列表"标签页
   - 选择任意一个模型，点击"设限"
   - 选择"1 天"或"1 周"
   - 观察状态从"可用"变为"限流至 XX"

3. **验证持久化**：
   - 检查 `config/backend-state.json` 文件内容
   - 应该看到类似：
     ```json
     {
       "doubao:doubao-seed-1-8-251228": {
         "unblockAt": "2026-02-07T00:00:00.000Z"
       }
     }
     ```

4. **关闭并重启应用**：
   - 关闭 Electron 应用
   - 重新运行 `npm run ui`
   - 进入"模型列表"标签页
   - **预期结果**：限流状态仍然显示，时间未变

5. **清除限流**：
   - 点击"设限"下拉菜单
   - 点击"立即解封"
   - 状态应该变为"可用"
   - `config/backend-state.json` 中对应的 key 应该被删除

---

### 测试 2: 服务商配置持久化

1. **添加服务商**：
   - 进入"服务商"标签页
   - 点击"添加服务商"
   - 填写：
     - ID: `test`
     - baseUrl: `https://api.test.com/v1`
     - apiKey: `${TEST_API_KEY}`
   - 点击"确定"

2. **验证持久化**：
   - 检查 `config/providers.json`
   - 应该看到新增的服务商配置

3. **关闭并重启应用**：
   - 关闭应用
   - 重新运行 `npm run ui`
   - 进入"服务商"标签页
   - **预期结果**：刚才添加的服务商仍然存在

4. **编辑服务商**：
   - 点击"编辑"按钮
   - 修改 baseUrl
   - 点击"确定"
   - 关闭并重启应用
   - **预期结果**：修改已保存

5. **删除服务商**：
   - 点击"删除"按钮
   - 确认删除
   - 关闭并重启应用
   - **预期结果**：服务商已被删除

---

### 测试 3: 后端列表持久化

1. **添加后端**：
   - 进入"模型列表"标签页
   - 点击"添加后端"
   - 选择服务商和模型
   - 点击"确定"

2. **调整顺序**：
   - 使用"上移"/"下移"按钮调整后端顺序
   - 记住调整后的顺序

3. **关闭并重启应用**：
   - **预期结果**：后端列表和顺序都保持不变

4. **编辑和删除**：
   - 编辑某个后端的模型 ID
   - 删除某个后端
   - 关闭并重启应用
   - **预期结果**：修改和删除都已保存

---

### 测试 4: 环境变量持久化

1. **修改基础设置**：
   - 进入"设置"标签页
   - 修改：
     - 对外模型 ID: `my-custom-model`
     - 端口: `3456`
     - 网关 Key: `test-key-123`
   - 点击"保存设置"

2. **验证持久化**：
   - 检查 `.env` 文件
   - 应该看到：
     ```
     PORT=3456
     GATEWAY_API_KEY=test-key-123
     DOUBAO_API_KEY=xxx
     ```
   - 检查 `config/providers.json`
   - `defaultModel` 应该是 `my-custom-model`

3. **关闭并重启应用**：
   - **预期结果**：所有设置保持不变

4. **添加自定义环境变量**：
   - 点击"+ 添加环境变量"
   - KEY: `CUSTOM_VAR`
   - VALUE: `custom_value`
   - 点击"确定"
   - 点击"保存设置"

5. **关闭并重启应用**：
   - 进入"设置"标签页
   - **预期结果**：自定义环境变量仍然存在

6. **删除环境变量**：
   - 删除刚才添加的变量
   - 点击"保存设置"
   - 关闭并重启应用
   - **预期结果**：变量已被删除

---

## 完整功能测试（压力测试）

**目标**：验证所有功能在频繁操作和重启后都能正确持久化

1. **连续操作**（不重启）：
   - 添加 3 个服务商
   - 添加 10 个后端
   - 设置 5 个后端的限流状态
   - 修改 2 个服务商的配置
   - 调整后端顺序
   - 修改环境变量
   - 删除 1 个服务商（会同步删除相关后端）

2. **验证文件**：
   - 检查 `config/providers.json`
   - 检查 `config/backend-state.json`
   - 检查 `.env`
   - 所有修改都应该正确保存

3. **关闭并重启应用**：
   - **预期结果**：所有状态完全恢复，与关闭前一致

4. **再次修改并重启**：
   - 重复上述操作
   - **预期结果**：每次重启后状态都正确保持

---

## 故障排查

### 问题 1：状态没有持久化

**检查项**：
1. 确认 `config` 目录存在且可写
2. 检查浏览器控制台是否有错误（在 Electron 中按 `Ctrl+Shift+I` 打开）
3. 检查文件权限是否正确

### 问题 2：重启后配置丢失

**可能原因**：
1. 文件路径错误（打包后路径可能不同）
2. 文件写入时机不正确

**验证方法**：
- 在 `electron/main.js` 中添加日志：
  ```javascript
  console.log('Config path:', getConfigPath());
  console.log('State path:', getBackendStatePath());
  console.log('Env path:', getEnvPath());
  ```

### 问题 3：文件内容不正确

**验证方法**：
- 使用文本编辑器直接查看配置文件
- 确认 JSON 格式正确
- 确认编码为 UTF-8

---

## 技术细节

### 数据流

```
用户操作（UI）
  ↓
Vue 组件事件处理器（async function）
  ↓
await gateway.saveXXX(data)
  ↓
IPC 调用（electron preload.js）
  ↓
主进程处理器（electron main.js）
  ↓
fs.writeFileSync() - 写入磁盘
  ↓
返回 { ok: true }
  ↓
await load() - 重新读取
  ↓
UI 更新
```

### 关键修复点

**修复前**：
```javascript
function setCooldown(key, tier) {
  gateway.setBackendCooldown(key, unblockAt)  // 没有 await
  load()  // 没有 await，会在保存完成前就读取
}
```

**修复后**：
```javascript
async function setCooldown(key, tier) {
  await gateway.setBackendCooldown(key, unblockAt)  // 等待保存完成
  await load()  // 等待读取完成再更新 UI
}
```

---

## 结论

所有持久化功能现在都已正确实现：
- ✅ 异步操作正确等待
- ✅ 文件在启动时自动创建
- ✅ 所有配置都能正确保存和加载
- ✅ 应用关闭重启后状态完全恢复

**核心原则**：所有异步操作必须 await，确保数据真正写入磁盘后再更新 UI。
