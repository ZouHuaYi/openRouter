<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useGateway } from '../composables/useGateway'

const gateway = useGateway()
const config = ref({ providers: {}, defaultModel: 'chat', backends: [] })
const backendState = ref({})
const modalOpen = ref(false)
const editIndex = ref(-1)
const form = ref({ provider: '', model: '' })

const COOLDOWN_PRESETS = [
  { label: '1 天', tier: 'day' },
  { label: '1 周', tier: 'week' },
  { label: '1 月', tier: 'month' },
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
function addMonthsFromNextMidnight(baseMs, months) {
  const nm = nextBeijingMidnight(baseMs)
  const p = beijingParts(nm)
  const utc = Date.UTC(p.year, p.month - 1 + months, p.day, 0, 0, 0)
  return utc - 8 * 60 * 60 * 1000
}

function computeUnblockAt(tier, existingUnblockAt) {
  const now = Date.now()
  const existing = existingUnblockAt ? new Date(existingUnblockAt).getTime() : 0
  const base = Math.max(now, existing || 0)
  if (tier === 'day') return new Date(addDaysFromNextMidnight(base, 1)).toISOString()
  if (tier === 'week') return new Date(addDaysFromNextMidnight(base, 7)).toISOString()
  if (tier === 'month') return new Date(addMonthsFromNextMidnight(base, 1)).toISOString()
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
  const d = new Date(at)
  return d.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit' })
}

const providerIds = () => Object.keys(config.value.providers || {})

const rows = computed(() => (config.value.backends || []).map((b, i) => ({
  index: i,
  provider: b.provider,
  model: b.model,
  key: backendKey(b),
  status: backendStatus(b),
})))

async function load() {
  config.value = await gateway.getConfig()
  backendState.value = await gateway.getBackendState()
  if (!config.value.backends) config.value.backends = []
}

function moveUp(index) {
  if (index <= 0) return
  const arr = [...config.value.backends]
  ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
  config.value.backends = arr
  gateway.saveConfig(config.value)
  load()
}
function moveDown(index) {
  if (index >= config.value.backends.length - 1) return
  const arr = [...config.value.backends]
  ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
  config.value.backends = arr
  gateway.saveConfig(config.value)
  load()
}

function openAdd() {
  editIndex.value = -1
  form.value = { provider: providerIds()[0] || '', model: '' }
  modalOpen.value = true
}
function openEdit(index) {
  editIndex.value = index
  const b = config.value.backends[index] || {}
  form.value = { provider: b.provider || providerIds()[0] || '', model: b.model || '' }
  modalOpen.value = true
}
function closeModal() {
  modalOpen.value = false
}
function saveBackend() {
  const provider = form.value.provider
  const model = form.value.model?.trim()
  if (!provider || !model) return
  const entry = { provider, model }
  if (editIndex.value >= 0) config.value.backends[editIndex.value] = entry
  else config.value.backends.push(entry)
  closeModal()
  gateway.saveConfig(config.value)
  load()
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
  gateway.saveConfig(config.value)
  load()
  ElMessage.success('已删除')
}

function setCooldown(key, tier) {
  const current = backendState.value[key]?.unblockAt
  const unblockAt = computeUnblockAt(tier, current)
  gateway.setBackendCooldown(key, unblockAt)
  load()
}
function clearCooldown(key) {
  gateway.setBackendCooldown(key, null)
  load()
}

onMounted(load)
</script>

<template>
  <div>
    <div class="mb-3 text-slate-300 text-sm">限流规则：天/周/月按北京时间 00:00 解封。</div>
    <el-table :data="rows" border stripe size="small">
      <el-table-column prop="provider" label="服务商" />
      <el-table-column prop="model" label="模型"  />
      <el-table-column label="状态" width="180" align="center">
        <template #default="scope">
          <el-tag v-if="scope.row.status.status === 'active'" type="success">可用</el-tag>
          <el-tag v-else type="warning">限流至 {{ formatUnblock(scope.row.status.unblockAt) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="限流设置" width="80" align="center">
        <template #default="scope">
          <el-dropdown trigger="click">
            <el-button size="small">设限</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="p in COOLDOWN_PRESETS" :key="p.tier" @click="setCooldown(scope.row.key, p.tier)">
                  {{ p.label }}
                </el-dropdown-item>
                <el-dropdown-item divided v-if="scope.row.status.status === 'cooldown'" @click="clearCooldown(scope.row.key)">
                  立即解封
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-table-column>
      <el-table-column label="排序" width="120" align="center">
        <template #default="scope">
          <el-button-group>
            <el-button size="small" @click="moveUp(scope.row.index)">上移</el-button>
            <el-button size="small" @click="moveDown(scope.row.index)">下移</el-button>
          </el-button-group>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" align="center">
        <template #default="scope">
          <el-button-group>
            <el-button size="small" @click="openEdit(scope.row.index)">编辑</el-button>
            <el-button size="small" type="danger" @click="removeBackend(scope.row.index)">删除</el-button>
          </el-button-group>
        </template>
      </el-table-column>
    </el-table>

    <div class="mt-3">
      <el-button type="primary" @click="openAdd">添加后端</el-button>
    </div>

    <el-dialog v-model="modalOpen" :title="editIndex >= 0 ? '编辑后端' : '添加后端'" width="520px" align-center>
      <el-form label-width="110px">
        <el-form-item label="服务商">
          <el-select v-model="form.provider" placeholder="选择服务商">
            <el-option v-for="pid in providerIds()" :key="pid" :label="pid" :value="pid" />
          </el-select>
        </el-form-item>
        <el-form-item label="模型">
          <el-input v-model="form.model" placeholder="模型 ID" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeModal">取消</el-button>
        <el-button type="primary" @click="saveBackend">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
