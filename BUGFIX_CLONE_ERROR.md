# Bug 修复：对象克隆错误

## 🐛 问题描述

**错误信息**：
```
Error: An object could not be cloned.
    at P (index-g2sRq8Fu.js:53:50041)
    at Ai (index-g2sRq8Fu.js:13:38)
    ...
```

**触发场景**：
- 点击"编辑后端"并保存时
- 点击"添加/编辑服务商"并保存时
- 点击"保存设置"时

**根本原因**：
Vue 3 的响应式对象（通过 `ref()` 创建）包含 Proxy 和其他内部属性，无法通过 Electron IPC（进程间通信）传递。

---

## 🔧 技术分析

### 问题根源

**Electron IPC 的限制**：
Electron 的主进程和渲染进程之间通过 IPC 传递消息时，使用**结构化克隆算法**（Structured Clone Algorithm）序列化对象。

**不可克隆的对象类型**：
- ❌ Proxy 对象（Vue 响应式对象）
- ❌ 函数
- ❌ DOM 节点
- ❌ Symbol
- ❌ 循环引用

**Vue 3 响应式对象**：
```javascript
const config = ref({ providers: {} })
// config.value 实际上是一个 Proxy 对象
console.log(config.value)  // Proxy { providers: {} }
```

**错误代码示例**：
```javascript
// ❌ 错误：直接传递响应式对象
await gateway.saveConfig(config.value)

// IPC 调用链：
// 渲染进程 → ipcRenderer.invoke('saveConfig', config.value)
// → 结构化克隆算法尝试克隆 → 失败！
// → Error: An object could not be cloned
```

---

## ✅ 解决方案

### 使用 `toRaw()` 函数

Vue 3 提供了 `toRaw()` 函数，可以获取响应式对象的原始数据：

```javascript
import { toRaw } from 'vue'

// ✅ 正确：使用 toRaw 获取原始对象
await gateway.saveConfig(toRaw(config.value))

// toRaw(config.value) 返回纯 JavaScript 对象
// { providers: {} }  // 不是 Proxy
```

### 修复的文件

1. **Backends.vue** - 后端管理
   - `moveUp()` - 调整后端顺序
   - `moveDown()` - 调整后端顺序
   - `saveBackend()` - 保存后端配置
   - `removeBackend()` - 删除后端

2. **Providers.vue** - 服务商管理
   - `saveProvider()` - 保存服务商配置
   - `removeProvider()` - 删除服务商

3. **Settings.vue** - 设置
   - `saveAll()` - 保存所有设置

---

## 📋 修复对比

### 修复前（❌ 错误）

```javascript
// Backends.vue
async function saveBackend() {
  // ...
  await gateway.saveConfig(config.value)  // ❌ Proxy 对象
  // ...
}

// Providers.vue
async function saveProvider() {
  // ...
  await gateway.saveConfig(config.value)  // ❌ Proxy 对象
  // ...
}

// Settings.vue
async function saveAll() {
  // ...
  await gateway.saveConfig(config.value)  // ❌ Proxy 对象
  // ...
}
```

### 修复后（✅ 正确）

```javascript
// 1. 导入 toRaw
import { toRaw } from 'vue'

// Backends.vue
async function saveBackend() {
  // ...
  await gateway.saveConfig(toRaw(config.value))  // ✅ 纯对象
  // ...
}

// Providers.vue
async function saveProvider() {
  // ...
  await gateway.saveConfig(toRaw(config.value))  // ✅ 纯对象
  // ...
}

// Settings.vue
async function saveAll() {
  // ...
  await gateway.saveConfig(toRaw(config.value))  // ✅ 纯对象
  // ...
}
```

---

## 🧪 验证修复

### 1. 重新构建应用

```bash
npm run ui
```

### 2. 测试编辑后端

1. 进入"模型列表"标签页
2. 点击任意后端的"编辑"按钮
3. 修改限流设置
4. 点击"确定"
5. ✅ 应该看到"已更新"提示，不再报错

### 3. 测试添加后端

1. 点击"添加后端"按钮
2. 选择服务商和模型
3. 点击"确定"
4. ✅ 应该看到"已添加"提示，不再报错

### 4. 测试服务商管理

1. 进入"服务商"标签页
2. 点击"编辑"或"添加服务商"
3. 修改配置
4. 点击"确定"
5. ✅ 应该正常保存，不再报错

### 5. 测试设置保存

1. 进入"设置"标签页
2. 修改任意设置
3. 点击"保存设置"
4. ✅ 应该看到"已保存"提示，不再报错

---

## 💡 预防措施

### 通用规则

**在 Electron IPC 调用中传递数据时，始终使用 `toRaw()`**：

```javascript
// ✅ 正确模式
import { toRaw } from 'vue'

// 传递给 IPC
await ipcRenderer.invoke('someMethod', toRaw(reactiveObject))

// 或者使用 JSON 序列化（性能稍差）
await ipcRenderer.invoke('someMethod', JSON.parse(JSON.stringify(reactiveObject)))
```

### 识别响应式对象

```javascript
// 通过 ref() 或 reactive() 创建的都是响应式对象
const config = ref({ ... })        // config.value 是响应式
const state = reactive({ ... })    // state 是响应式

// 访问时需要注意
config.value    // Proxy 对象
toRaw(config.value)  // 纯 JavaScript 对象
```

### 检查方法

在浏览器开发者工具中：
```javascript
console.log(config.value)
// 如果输出 Proxy { ... }，就需要使用 toRaw()
```

---

## 🔍 相关知识

### 结构化克隆算法

MDN 文档：https://developer.mozilla.org/zh-CN/docs/Web/API/structuredClone

**支持的类型**：
- ✅ 原始类型（string, number, boolean, null, undefined）
- ✅ 普通对象和数组
- ✅ Date
- ✅ RegExp
- ✅ Map / Set
- ✅ ArrayBuffer / TypedArray

**不支持的类型**：
- ❌ Function
- ❌ DOM 节点
- ❌ Proxy
- ❌ Symbol（属性）

### Vue 3 响应式系统

Vue 3 使用 Proxy 实现响应式：

```javascript
// Vue 内部实现（简化版）
function reactive(obj) {
  return new Proxy(obj, {
    get(target, key) {
      track(target, key)  // 依赖收集
      return target[key]
    },
    set(target, key, value) {
      target[key] = value
      trigger(target, key)  // 触发更新
      return true
    }
  })
}
```

这就是为什么响应式对象无法通过 IPC 传递。

### toRaw() vs JSON.parse(JSON.stringify())

| 方法 | 优点 | 缺点 |
|------|------|------|
| `toRaw()` | 性能好，保留对象引用 | 需要 Vue 3 |
| `JSON.parse(JSON.stringify())` | 通用，深拷贝 | 性能差，丢失特殊类型（Date、RegExp 等） |

**推荐**：在 Vue 3 项目中优先使用 `toRaw()`。

---

## 🎯 总结

### 问题
Vue 3 响应式对象（Proxy）无法通过 Electron IPC 传递。

### 原因
结构化克隆算法不支持 Proxy 对象。

### 解决
使用 `toRaw()` 获取原始对象后再传递。

### 影响范围
所有通过 IPC 传递响应式对象的地方都需要修复。

### 预防
养成习惯：IPC 调用时总是使用 `toRaw()`。

---

## ✅ 修复完成

所有涉及 IPC 调用的地方都已修复：
- ✅ Backends.vue - 4 处修复
- ✅ Providers.vue - 2 处修复
- ✅ Settings.vue - 1 处修复

**现在可以正常保存所有配置，不会再出现克隆错误！**
