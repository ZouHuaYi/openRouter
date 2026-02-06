# 快速启动指南 - 持久化修复版本

## 🎯 修复内容

### 已修复的问题
1. ✅ **后端限流状态持久化** - 设置限流后重启应用状态正确保持
2. ✅ **服务商配置持久化** - 添加/编辑/删除服务商后重启应用配置保持
3. ✅ **后端列表持久化** - 后端顺序和配置重启后保持
4. ✅ **环境变量持久化** - 端口、API Key 等设置重启后保持
5. ✅ **应用启动初始化** - 首次启动自动创建所有必要的配置文件

### 核心修复
所有异步操作现在都正确等待数据写入磁盘后才更新 UI，确保：
- 操作即时生效
- 重启后状态完全恢复
- 不再出现"修改后刷新显示旧数据"的问题

---

## 🚀 启动步骤

### 1. 停止当前运行的应用

如果应用正在运行，请先关闭 Electron 窗口。

### 2. 重新启动应用

```bash
npm run ui
```

这个命令会：
- 重新构建前端界面
- 启动 Electron 应用
- 自动初始化所有配置文件

### 3. 验证持久化功能

按照 `PERSISTENCE_TEST.md` 中的测试步骤验证所有功能。

---

## 📁 持久化文件位置

所有配置文件都保存在项目根目录：

```
e:\aiApi\openRouter\
├── config\
│   ├── providers.json          # 服务商配置和后端列表
│   └── backend-state.json      # 后端限流状态
├── .env                        # 环境变量
└── ...
```

### 文件说明

**config/providers.json** - 存储：
- 服务商配置（ID, baseUrl, apiKey, chatPath）
- 后端列表（provider, model）
- 默认模型 ID

**config/backend-state.json** - 存储：
- 每个后端的限流状态
- 解封时间（北京时间）

**.env** - 存储：
- PORT（服务端口）
- GATEWAY_API_KEY（网关认证密钥）
- 其他自定义环境变量

---

## ✅ 快速测试

### 测试 1：限流状态（30 秒）

1. 启动应用
2. 进入"模型列表"
3. 给任意模型设置"1 天"限流
4. 观察状态变为"限流至 XX"
5. **关闭应用**
6. **重新运行 `npm run ui`**
7. 进入"模型列表"
8. ✅ 限流状态应该仍然显示

### 测试 2：设置持久化（30 秒）

1. 进入"设置"
2. 修改"对外模型 ID"为 `test-model`
3. 点击"保存设置"
4. **关闭应用**
5. **重新运行 `npm run ui`**
6. 进入"设置"
7. ✅ 模型 ID 应该是 `test-model`

---

## 🐛 故障排查

### 问题：修改后重启应用，状态没有保持

**解决方法**：

1. **检查文件是否存在**：
   ```bash
   dir config
   dir .env
   ```

2. **查看文件内容**：
   ```bash
   type config\providers.json
   type config\backend-state.json
   type .env
   ```

3. **检查文件权限**：
   - 确保 `config` 目录和 `.env` 文件可写
   - Windows 下右键 -> 属性 -> 取消"只读"

4. **查看日志**：
   - 在 Electron 应用中按 `Ctrl+Shift+I` 打开开发者工具
   - 查看 Console 中是否有错误

### 问题：文件内容格式错误

如果手动编辑了配置文件导致格式错误：

1. **备份现有文件**
2. **删除损坏的文件**
3. **重启应用** - 会自动创建新的默认配置

---

## 📊 技术细节

### 修改的文件

1. **electron/ui-src/src/views/Backends.vue**
   - 修复所有后端管理操作的异步等待

2. **electron/ui-src/src/views/Providers.vue**
   - 修复服务商管理操作的异步等待

3. **electron/ui-src/src/views/Settings.vue**
   - 修复设置保存操作的异步等待

4. **electron/main.js**
   - 添加 `ensureConfigFiles()` 启动初始化函数

### 关键代码模式

**修复前**（❌ 错误）：
```javascript
function saveData() {
  gateway.save(data)    // 发出保存请求，但不等待
  load()                 // 立即读取，可能读到旧数据
}
```

**修复后**（✅ 正确）：
```javascript
async function saveData() {
  await gateway.save(data)    // 等待保存完成
  await load()                // 然后读取新数据
}
```

---

## 🎉 现在可以使用了！

所有持久化功能已完全修复，现在你可以：

- ✅ 随意修改配置
- ✅ 设置后端限流
- ✅ 调整后端顺序
- ✅ 修改环境变量
- ✅ 随时关闭应用
- ✅ 重启后一切保持原样

**不需要担心数据丢失！**
