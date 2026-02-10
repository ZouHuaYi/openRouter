<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, toRaw, defineExpose } from 'vue'
import { useGateway } from '../composables/useGateway'

const gateway = useGateway()
const config = ref({ providers: {}, defaultModel: 'chat', backends: [] })
const modalOpen = ref(false)
const modalIsNew = ref(true)
const editId = ref('')
const form = ref({
  id: '',
  baseUrl: '',
  apiKey: '${API_KEY}',
  chatPath: '',
})

const rows = computed(() => {
  const out = []
  for (const [id, p] of Object.entries(config.value.providers || {})) {
    out.push({ id, ...p })
  }
  return out
})

async function load() {
  config.value = await gateway.getConfig()
  if (!config.value.providers) config.value.providers = {}
}

function openAdd() {
  modalIsNew.value = true
  editId.value = ''
  form.value = { id: '', baseUrl: '', apiKey: '${API_KEY}', chatPath: '' }
  modalOpen.value = true
}
function openEdit(id) {
  modalIsNew.value = false
  editId.value = id
  const p = config.value.providers[id] || {}
  form.value = {
    id,
    baseUrl: p.baseUrl || '',
    apiKey: p.apiKey || '',
    chatPath: (p.chatPath && p.chatPath !== '/v1/chat/completions') ? p.chatPath : '',
  }
  modalOpen.value = true
}
function closeModal() {
  modalOpen.value = false
}
async function saveProvider() {
  const nid = form.value.id?.trim() || editId.value
  if (!nid) return
  config.value.providers[nid] = {
    baseUrl: form.value.baseUrl?.trim() || '',
    apiKey: form.value.apiKey?.trim() || '${API_KEY}',
    chatPath: form.value.chatPath?.trim() || '/v1/chat/completions',
  }
  if (modalIsNew.value && editId.value && editId.value !== nid) delete config.value.providers[editId.value]
  closeModal()
  await gateway.saveConfig(toRaw(config.value))
  await load()
}
async function removeProvider(id) {
  try {
    await ElMessageBox.confirm(`确定删除服务商 "${id}"？此操作会同步删除相关后端。`, '二次确认', { type: 'warning' })
  } catch {
    return
  }
  delete config.value.providers[id]
  config.value.backends = (config.value.backends || []).filter((b) => b.provider !== id)
  await gateway.saveConfig(toRaw(config.value))
  await load()
  ElMessage.success('已删除')
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

onMounted(load)

defineExpose({ reload: load })
</script>

<template>
  <div>
    <div class="mb-3 flex items-center gap-2">
      <el-button type="primary" @click="openAdd">添加服务商</el-button>
      <el-button @click="handleExport">导出配置</el-button>
      <el-button @click="handleImport">导入配置</el-button>
    </div>
    <el-table :data="rows" border stripe size="small">
      <el-table-column prop="id" label="ID" width="160" />
      <el-table-column prop="baseUrl" label="baseUrl" min-width="240" />
      <el-table-column prop="chatPath" label="chatPath" width="200" />
      <el-table-column label="操作" width="120" align="center">
        <template #default="scope">
          <el-button-group>
            <el-button size="small" @click="openEdit(scope.row.id)">编辑</el-button>
            <el-button size="small" type="danger" @click="removeProvider(scope.row.id)">删除</el-button>
          </el-button-group>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog append-to-body v-model="modalOpen" :title="modalIsNew ? '添加服务商' : '编辑服务商'" width="520px" align-center>
      <el-form label-width="110px">
        <el-form-item label="ID（英文）">
          <el-input v-model="form.id" :readonly="!modalIsNew" placeholder="如 doubao" />
        </el-form-item>
        <el-form-item label="baseUrl">
          <el-input v-model="form.baseUrl" placeholder="https://api.example.com/v1" />
        </el-form-item>
        <el-form-item label="apiKey">
          <el-input v-model="form.apiKey" placeholder="${'${DOUBAO_API_KEY}'}" />
        </el-form-item>
        <el-form-item label="chatPath">
          <el-input v-model="form.chatPath" placeholder="留空即 /v1/chat/completions" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeModal">取消</el-button>
        <el-button type="primary" @click="saveProvider">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
