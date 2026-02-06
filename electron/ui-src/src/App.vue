<script setup>
import { onMounted, ref } from 'vue'
import { useGateway } from './composables/useGateway'
import Backends from './views/Backends.vue'
import Providers from './views/Providers.vue'
import Settings from './views/Settings.vue'
import Status from './views/Status.vue'

const tab = ref('status')
const statusRef = ref(null)
const gateway = useGateway()
const status = ref({ running: false, port: 3333 })

async function refreshStatus() {
  status.value = await gateway.getGatewayStatus()
}

async function handleStart() {
  await statusRef.value?.start?.()
  await refreshStatus()
}
async function handleStop() {
  await statusRef.value?.stop?.()
  await refreshStatus()
}

onMounted(() => {
  refreshStatus()
  gateway.onGatewayExit(() => refreshStatus())
})
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <div class="fixed inset-0 bg-[linear-gradient(rgba(6,182,212,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.05)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
    <div class="fixed inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-transparent pointer-events-none" />
    <div class="relative z-10 w-full px-4 md:px-6 lg:px-10 py-6">
      <el-card shadow="never" class="bg-slate-900 border border-slate-600 w-full">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
          <div class="text-lg font-semibold text-white">OpenAI 聚合网关</div>
          <div class="ml-auto flex items-center gap-2">
            <el-tag :type="status.running ? 'success' : 'info'">
              {{ status.running ? '运行中' : '未运行' }}
            </el-tag>
            <span class="text-slate-300">:{{ status.port }}</span>
            <el-button type="primary" plain :disabled="status.running" @click="handleStart">启动</el-button>
            <el-button type="danger" plain :disabled="!status.running" @click="handleStop">停止</el-button>
          </div>
        </div>

        <el-tabs v-model="tab" type="border-card" class="bg-slate-900 w-full" stretch>
          <el-tab-pane label="状态" name="status">
            <Status ref="statusRef" @status-change="refreshStatus" />
          </el-tab-pane>
          <el-tab-pane label="服务商" name="providers">
            <Providers />
          </el-tab-pane>
          <el-tab-pane label="模型列表" name="backends">
            <Backends />
          </el-tab-pane>
          <el-tab-pane label="设置" name="settings">
            <Settings />
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </div>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.el-card__body {
  overflow-x: hidden;
  padding: 0 !important;
}
</style>
