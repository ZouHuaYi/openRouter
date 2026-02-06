<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, ref, toRaw } from 'vue'
import { useGateway } from '../composables/useGateway'

const gateway = useGateway()
const config = ref({ defaultModel: 'chat' })
const env = ref({ PORT: '3333', GATEWAY_API_KEY: '' })
const envExtra = ref([])
const modalOpen = ref(false)
const newEnvKey = ref('')
const newEnvValue = ref('')

const skipKeys = { PORT: true, GATEWAY_API_KEY: true }

async function load() {
  config.value = await gateway.getConfig()
  const e = await gateway.getEnv()
  env.value = { PORT: e.PORT || '3333', GATEWAY_API_KEY: e.GATEWAY_API_KEY || '', ...e }
  envExtra.value = Object.entries(env.value)
    .filter(([k]) => !skipKeys[k])
    .map(([key, value]) => ({ key, value }))
}

function openAddEnv() {
  newEnvKey.value = ''
  newEnvValue.value = ''
  modalOpen.value = true
}
function closeModal() {
  modalOpen.value = false
}
async function addEnv() {
  const k = newEnvKey.value?.trim()
  if (!k) return
  envExtra.value.push({ key: k, value: newEnvValue.value?.trim() || '' })
  closeModal()
  await saveEnv()
}
async function removeEnv(index) {
  const row = envExtra.value[index]
  const label = row?.key ? `变量 ${row.key}` : '该变量'
  try {
    await ElMessageBox.confirm(`确定删除 ${label}？`, '二次确认', { type: 'warning' })
  } catch {
    return
  }
  envExtra.value.splice(index, 1)
  await saveEnv()
  ElMessage.success('已删除')
}
async function saveEnv() {
  const full = {
    PORT: env.value.PORT || '3333',
    GATEWAY_API_KEY: env.value.GATEWAY_API_KEY || '',
  }
  envExtra.value.forEach(({ key, value }) => { full[key] = value })
  await gateway.setEnvAll(full)
  env.value = full
}
async function saveAll() {
  config.value.defaultModel = config.value.defaultModel?.trim() || 'chat'
  env.value.PORT = env.value.PORT?.trim() || '3333'
  env.value.GATEWAY_API_KEY = env.value.GATEWAY_API_KEY?.trim() || ''
  await saveEnv()
  await gateway.saveConfig(toRaw(config.value))
  await load()
  ElMessage.success('已保存')
}

onMounted(load)
</script>

<template>
  <div>
    <el-form label-width="160px" label-position="top" class="form-container-top">
      <el-form-item label="对外模型 ID (defaultModel)">
        <el-input v-model="config.defaultModel" placeholder="chat" />
      </el-form-item>
      <el-form-item label="端口 (PORT)">
        <el-input v-model="env.PORT" type="number" />
      </el-form-item>
      <el-form-item label="网关 Key (GATEWAY_API_KEY)">
        <el-input v-model="env.GATEWAY_API_KEY" type="password" />
      </el-form-item>
    </el-form>

    <div class="mb-2">
      <el-button type="success" @click="openAddEnv">+ 添加环境变量</el-button>
    </div>
    <el-table :data="envExtra" border stripe size="small">
      <el-table-column label="KEY" width="220">
        <template #default="scope">
          <el-input v-model="scope.row.key" />
        </template>
      </el-table-column>
      <el-table-column label="VALUE" min-width="240">
        <template #default="scope">
          <el-input v-model="scope.row.value" type="password" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" align="center">
        <template #default="scope">
          <el-button size="small" type="danger" @click="removeEnv(scope.$index)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="mt-3">
      <el-button type="primary" @click="saveAll">保存设置</el-button>
    </div>

    <el-dialog append-to-body v-model="modalOpen" title="添加环境变量" width="520px" align-center>
      <el-form label-width="100px">
        <el-form-item label="变量名">
          <el-input v-model="newEnvKey" placeholder="如 DOUBAO_API_KEY" />
        </el-form-item>
        <el-form-item label="值">
          <el-input v-model="newEnvValue" type="password" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeModal">取消</el-button>
        <el-button type="primary" @click="addEnv">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.form-container-top {
  :deep(.el-form-item__label) {
    font-weight: 500 !important;
    color: #ffffff !important;
  }
}
</style>
