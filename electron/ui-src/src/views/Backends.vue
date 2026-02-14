<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, toRaw, defineExpose } from 'vue'
import { useGateway } from '../composables/useGateway'

const gateway = useGateway()
const config = ref({ providers: {}, defaultModel: 'chat', backends: [] })
const backendState = ref({})
const modalOpen = ref(false)
const editIndex = ref(-1)
const form = ref({ 
  provider: '', 
  model: '',
  // 限流设置
  cooldownEnabled: false,
  cooldownType: 'preset', // preset | hours | days
  cooldownPreset: 'day', // day | week | month
  cooldownHours: 1,
  cooldownDays: 1,
  maxTokens: 0,
})

const COOLDOWN_PRESETS = [
  { label: '1 天（0点解封）', value: 'day' },
  { label: '1 周（0点解封）', value: 'week' },
  { label: '1 月（0点解封）', value: 'month' },
]

function backendKey(b) {
  return `${b.provider}:${b.model}`
}

function beijingParts(ms) {
  const dtf = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })
  const parts = dtf.formatToParts(new Date(ms))
  const get = (t) => Number(parts.find((p) => p.type === t)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}
function beijingMidnightTs(parts) {
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0)
  return utc - 8 * 60 * 60 * 1000
}
function nextBeijingMidnight(baseMs) {
  const parts = beijingParts(baseMs)
  const midnight = beijingMidnightTs(parts)
  return baseMs >= midnight ? midnight + 24 * 60 * 60 * 1000 : midnight
}
function addDaysFromNextMidnight(baseMs, days) {
  return nextBeijingMidnight(baseMs) + (days - 1) * 24 * 60 * 60 * 1000
}

function nextBeijingWeekMonday(baseMs) {
  const parts = beijingParts(baseMs)
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0)
  const baseMidnight = utc - 8 * 60 * 60 * 1000
  const day = new Date(baseMidnight).getUTCDay()
  const offset = (8 - day) % 7
  return baseMidnight + offset * 24 * 60 * 60 * 1000
}

function nextBeijingMonthFirst(baseMs) {
  const parts = beijingParts(baseMs)
  const utc = Date.UTC(parts.year, parts.month - 1, 1, 0, 0, 0)
  const monthFirst = utc - 8 * 60 * 60 * 1000
  if (baseMs <= monthFirst) return monthFirst
  const nextUtc = Date.UTC(parts.year, parts.month, 1, 0, 0, 0)
  return nextUtc - 8 * 60 * 60 * 1000
}
function addMonthsFromNextMidnight(baseMs, months) {
  const nm = nextBeijingMidnight(baseMs)
  const p = beijingParts(nm)
  const utc = Date.UTC(p.year, p.month - 1 + months, p.day, 0, 0, 0)
  return utc - 8 * 60 * 60 * 1000
}

// 计算解封时间
function computeUnblockAt(type, value, existingUnblockAt) {
  const now = Date.now()
  const existing = existingUnblockAt ? new Date(existingUnblockAt).getTime() : 0
  const base = Math.max(now, existing || 0)
  
  console.log('[computeUnblockAt] 输入参数:', { type, value, existingUnblockAt, base: new Date(base).toISOString() })
  
  if (type === 'preset') {
    let result
    if (value === 'day') {
      result = new Date(addDaysFromNextMidnight(base, 1)).toISOString()
    } else if (value === 'week') {
      result = new Date(nextBeijingWeekMonday(base)).toISOString()
    } else if (value === 'month') {
      result = new Date(nextBeijingMonthFirst(base)).toISOString()
    } else {
      result = new Date(addDaysFromNextMidnight(base, 1)).toISOString()
    }
    return result
  } else if (type === 'hours') {
    // 按小时：从当前时刻 + 指定小时 + 3分钟延后
    const hours = parseInt(value) || 1
    const ms = now + hours * 60 * 60 * 1000 + 3 * 60 * 1000
    return new Date(ms).toISOString()
  } else if (type === 'days') {
    // 按天数：从当前时刻 + 指定天数
    const days = parseInt(value) || 1
    const ms = now + days * 24 * 60 * 60 * 1000
    return new Date(ms).toISOString()
  }
  
  return new Date(addDaysFromNextMidnight(base, 1)).toISOString()
}

function backendStatus(b) {
  const key = backendKey(b)
  const s = backendState.value[key]
  if (!s?.unblockAt) return { status: 'active', unblockAt: null }
  const at = new Date(s.unblockAt).getTime()
  if (Number.isNaN(at) || at <= Date.now()) return { status: 'active', unblockAt: null }
  return { status: 'cooldown', unblockAt: s.unblockAt }
}

function formatUnblock(at) {
  if (!at) return ''
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    day: '2-digit'
  })
}

const providerIds = () => Object.keys(config.value.providers || {})

const rows = computed(() => (config.value.backends || []).map((b, i) => {
  const key = backendKey(b)
  const state = backendState.value[key] || {}
  return {
    index: i,
    provider: b.provider,
    model: b.model,
    key,
    status: backendStatus(b),
    hasRule: !!b.cooldownRule,
    rule: b.cooldownRule,
    maxTokens: b.maxTokens || 0,
    usedTokens: state.usedTokens || 0,
  }
}))

async function load() {
  config.value = await gateway.getConfig()
  backendState.value = await gateway.getBackendState()
  if (!config.value.backends) config.value.backends = []
}

async function moveUp(index) {
  if (index <= 0) return
  const arr = [...config.value.backends]
  ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
  config.value.backends = arr
  await gateway.saveConfig(toRaw(config.value))
  await load()
}
async function moveDown(index) {
  if (index >= config.value.backends.length - 1) return
  const arr = [...config.value.backends]
  ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
  config.value.backends = arr
  await gateway.saveConfig(toRaw(config.value))
  await load()
}

function openAdd() {
  editIndex.value = -1
  form.value = { 
    provider: providerIds()[0] || '', 
    model: '',
    cooldownEnabled: false,
    cooldownType: 'preset',
    cooldownPreset: 'day',
    cooldownHours: 1,
    cooldownDays: 1,
    maxTokens: 0,
  }
  modalOpen.value = true
}
function openEdit(index) {
  editIndex.value = index
  const b = config.value.backends[index] || {}
  
  // 从后端配置中读取限流规则
  const rule = b.cooldownRule || {}
  const hasRule = !!rule.type
  
  form.value = { 
    provider: b.provider || providerIds()[0] || '', 
    model: b.model || '',
    cooldownEnabled: hasRule,
    cooldownType: rule.type || 'preset',
    cooldownPreset: rule.type === 'preset' ? rule.value : 'day',
    cooldownHours: rule.type === 'hours' ? rule.value : 1,
    cooldownDays: rule.type === 'days' ? rule.value : 1,
    maxTokens: b.maxTokens || 0,
  }
  modalOpen.value = true
}
function closeModal() {
  modalOpen.value = false
}
async function saveBackend() {
  const provider = form.value.provider
  const model = form.value.model?.trim()
  if (!provider || !model) return
  
  // 构建后端条目，包含限流规则
  const entry = { provider, model, maxTokens: form.value.maxTokens || 0 }
  
  // 保存限流规则（规则不会立即触发限流）
  if (form.value.cooldownEnabled) {
    let ruleValue = form.value.cooldownPreset
    if (form.value.cooldownType === 'hours') {
      ruleValue = form.value.cooldownHours
    } else if (form.value.cooldownType === 'days') {
      ruleValue = form.value.cooldownDays
    }
    
    entry.cooldownRule = {
      type: form.value.cooldownType,
      value: ruleValue
    }
  }
  
  // 保存后端配置（包含规则）
  if (editIndex.value >= 0) config.value.backends[editIndex.value] = entry
  else config.value.backends.push(entry)
  
  await gateway.saveConfig(toRaw(config.value))
  
  closeModal()
  await load()
  ElMessage.success(editIndex.value >= 0 ? '已更新' : '已添加')
}
async function removeBackend(index) {
  const b = config.value.backends[index]
  const label = b ? `${b.provider} / ${b.model}` : '该后端'
  try {
    await ElMessageBox.confirm(`确定删除 ${label}？`, '二次确认', { type: 'warning' })
  } catch {
    return
  }
  config.value.backends.splice(index, 1)
  await gateway.saveConfig(toRaw(config.value))
  await load()
  ElMessage.success('已删除')
}

async function triggerCooldown(row) {
  console.log('===== 触发限流开始 =====')
  console.log('row:', row)
  
  if (!row.hasRule) {
    ElMessage.warning('该后端未配置限流规则')
    return
  }
  
  // 重新加载配置确保使用最新规则
  await load()
  
  // 重新获取规则（使用最新配置）
  const backend = config.value.backends[row.index]
  console.log('backend:', backend)
  
  const rule = backend?.cooldownRule
  console.log('rule:', rule)
  
  if (!rule) {
    ElMessage.warning('该后端未配置限流规则')
    return
  }
  
  const current = backendState.value[row.key]?.unblockAt
  const unblockAt = computeUnblockAt(rule.type, rule.value, current)
  
  console.log('触发限流完整信息:', { 
    backend: `${backend.provider}:${backend.model}`,
    rule: rule,
    current: current,
    unblockAt: unblockAt,
    unblockAtBJ: new Date(unblockAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  })
  
  await gateway.setBackendCooldown(row.key, unblockAt)
  await load()
  
  const displayTime = formatUnblock(unblockAt)
  console.log('===== 触发限流结束 =====')
  ElMessage.success(`已触发限流，解封时间：${displayTime}`)
}

async function clearCooldown(key) {
  await gateway.setBackendCooldown(key, null)
  await load()
  ElMessage.success('已解封')
}

async function refreshStatus() {
  await load()
  ElMessage.success('已刷新')
}

async function handleExport() {
  const res = await gateway.exportConfig()
  if (res.ok) ElMessage.success('配置导出成功')
  else if (res.error !== 'Canceled') ElMessage.error('导出失败: ' + res.error)
}

async function handleImport() {
  const res = await gateway.importConfig()
  if (res.ok) {
    ElMessage.success('配置导入成功')
    await load()
  } else if (res.error !== 'Canceled') ElMessage.error('导入失败: ' + res.error)
}

function formatRule(rule) {
  if (!rule) return '未设置'
  if (rule.type === 'preset') {
    const map = { day: '1天', week: '1周', month: '1月' }
    return `预设：${map[rule.value] || rule.value}`
  } else if (rule.type === 'hours') {
    return `${rule.value}小时`
  } else if (rule.type === 'days') {
    return `${rule.value}天`
  }
  return '未知'
}

onMounted(load)

defineExpose({ reload: load })
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <div class="text-base font-semibold text-slate-800">模型路由与限流</div>
        <div class="text-sm text-slate-500">管理后端模型、限流规则与运行状态</div>
      </div>
      <div class="flex items-center gap-2">
        <el-button type="success" @click="refreshStatus" size="small">
          <span class="i-ep-refresh mr-1"></span>
          刷新状态
        </el-button>
        <el-button type="primary" @click="openAdd" size="small">添加后端</el-button>
        <el-button @click="handleExport" size="small">导出配置</el-button>
        <el-button @click="handleImport" size="small">导入配置</el-button>
      </div>
    </div>

    <el-alert
      title="限流规则不会立即生效。模型被限流时，请点击“触发限流”按钮应用规则。"
      type="info"
      :closable="false"
      show-icon
    />

    <el-card shadow="never" class="rounded-xl border border-slate-200 bg-white">
      <el-empty v-if="rows.length === 0" description="暂无后端，先添加一个吧" />
      <el-table v-else :data="rows" border stripe size="small">
        <el-table-column prop="provider" label="服务商" width="120" />
        <el-table-column prop="model" label="模型" min-width="180" />
        <el-table-column label="限流规则" width="130" align="center">
          <template #default="scope">
            <el-tag v-if="scope.row.hasRule" type="info" size="small">
              {{ formatRule(scope.row.rule) }}
            </el-tag>
            <span v-else class="text-slate-400 text-xs">未设置</span>
          </template>
        </el-table-column>
        <el-table-column label="Token 统计" width="140" align="center">
          <template #default="scope">
            <div v-if="scope.row.maxTokens > 0" class="flex flex-col items-center">
              <el-progress 
                :percentage="Math.min(100, Math.round((scope.row.usedTokens / scope.row.maxTokens) * 100))" 
                :status="scope.row.usedTokens >= scope.row.maxTokens ? 'exception' : ''"
                :stroke-width="12"
                class="w-full mb-1"
              />
              <span class="text-[10px] text-slate-400">{{ scope.row.usedTokens }} / {{ scope.row.maxTokens }}</span>
            </div>
            <span v-else class="text-slate-400 text-xs">-</span>
          </template>
        </el-table-column>
        <el-table-column label="当前状态" width="180" align="center">
          <template #default="scope">
            <el-tag v-if="scope.row.status.status === 'active'" type="success">可用</el-tag>
            <el-tag v-else type="warning">限流至 {{ formatUnblock(scope.row.status.unblockAt) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="快速操作" width="140" align="center">
          <template #default="scope">
            <el-button-group v-if="scope.row.status.status === 'cooldown'">
              <el-button size="small" type="success" @click="clearCooldown(scope.row.key)">
                解封
              </el-button>
            </el-button-group>
            <el-button-group v-else>
              <el-button 
                size="small" 
                type="warning"
                :disabled="!scope.row.hasRule"
                @click="triggerCooldown(scope.row)"
              >
                触发限流
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
        <el-table-column label="排序" width="100" align="center">
          <template #default="scope">
            <el-button-group>
              <el-button size="small" @click="moveUp(scope.row.index)">↑</el-button>
              <el-button size="small" @click="moveDown(scope.row.index)">↓</el-button>
            </el-button-group>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="center">
          <template #default="scope">
            <el-button-group>
              <el-button size="small" @click="openEdit(scope.row.index)">编辑</el-button>
              <el-button size="small" type="danger" @click="removeBackend(scope.row.index)">删</el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog  :z-index="3000" v-model="modalOpen" :title="editIndex >= 0 ? '编辑后端' : '添加后端'" width="600px" align-center append-to-body class="gateway-dialog backend-dialog" body-class="gateway-dialog-body backend-dialog-body">
      <el-form label-width="120px">
        <el-form-item label="服务商">
          <el-select v-model="form.provider" append-to="body" placeholder="选择服务商" :disabled="editIndex >= 0">
            <el-option v-for="pid in providerIds()" :key="pid" :label="pid" :value="pid" />
          </el-select>
        </el-form-item>
        <el-form-item label="模型">
          <el-input v-model="form.model" placeholder="模型 ID" :disabled="editIndex >= 0" />
        </el-form-item>
        
        <el-divider content-position="left">限流规则配置</el-divider>
        
        <el-alert
          title="说明：这里配置的是限流规则，不会立即生效。当模型被限流时，点击『触发限流』按钮应用规则。"
          type="info"
          :closable="false"
          show-icon
          class="mb-3"
        />
        
        <el-form-item label="启用限流规则">
          <el-switch v-model="form.cooldownEnabled" />
        </el-form-item>
        
        <template v-if="form.cooldownEnabled">
          <el-form-item label="限流类型">
            <el-radio-group v-model="form.cooldownType">
              <el-radio value="preset">预设（0点解封）</el-radio>
              <el-radio value="hours">按小时（+3分钟）</el-radio>
              <el-radio value="days">按天数</el-radio>
            </el-radio-group>
          </el-form-item>
          
          <el-form-item v-if="form.cooldownType === 'preset'" label="预设时长">
            <el-select v-model="form.cooldownPreset" 
            append-to="body">
              <el-option v-for="p in COOLDOWN_PRESETS" :key="p.value" :label="p.label" :value="p.value" />
            </el-select>
          </el-form-item>
          
          <el-form-item v-if="form.cooldownType === 'hours'" label="小时数">
            <el-input-number v-model="form.cooldownHours" :min="1" :max="168" />
            <span class="ml-2 text-slate-400 text-xs">解封时间 = 当前时刻 + {{ form.cooldownHours }} 小时 + 3 分钟</span>
          </el-form-item>
          
          <el-form-item v-if="form.cooldownType === 'days'" label="天数">
            <el-input-number v-model="form.cooldownDays" :min="1" :max="90" />
            <span class="ml-2 text-slate-400 text-xs">解封时间 = 当前时刻 + {{ form.cooldownDays }} 天</span>
          </el-form-item>

          <el-form-item label="最大 Token">
            <el-input-number v-model="form.maxTokens" :min="0" :step="1000" />
            <span class="ml-2 text-slate-400 text-xs">设为 0 表示不限制。超额将自动触发限流。</span>
          </el-form-item>
          
          <div v-if="form.cooldownType === 'preset'" class="text-slate-400 text-xs ml-2">
            预设模式按北京时间 00:00 解封，适合日/周/月限额场景
          </div>
          <div v-if="form.cooldownType === 'hours'" class="text-amber-400 text-xs ml-2">
            小时模式自动延后 3 分钟，避免服务器延迟导致的过早解封
          </div>
          <div v-if="form.cooldownType === 'days'" class="text-slate-400 text-xs ml-2">
            天数模式从当前时刻精确计算，适合固定天数限制场景
          </div>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="closeModal">取消</el-button>
        <el-button type="primary" @click="saveBackend">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
