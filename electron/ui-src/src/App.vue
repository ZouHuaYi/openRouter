<script setup>
import { onMounted, ref, watch } from 'vue'
import { useGateway } from './composables/useGateway'
import Backends from './views/Backends.vue'
import Providers from './views/Providers.vue'
import Settings from './views/Settings.vue'
import Status from './views/Status.vue'

const tab = ref('status')
const statusRef = ref(null)
const providersRef = ref(null)
const backendsRef = ref(null)
const settingsRef = ref(null)
const gateway = useGateway()
const status = ref({ running: false, port: 3333 })

async function refreshStatus() {
  status.value = await gateway.getGatewayStatus()
}

async function handleStart() {
  await statusRef.value?.start?.()
  await refreshStatus()
}

function handleTabClick(tab) {
  if (tab?.props?.name === 'status') statusRef.value?.reload?.()
  if (tab?.props?.name === 'providers') providersRef.value?.reload?.()
  if (tab?.props?.name === 'backends') backendsRef.value?.reload?.()
  if (tab?.props?.name === 'settings') settingsRef.value?.reload?.()
}

async function handleStop() {
  await statusRef.value?.stop?.()
  await refreshStatus()
}

onMounted(() => {
  refreshStatus()
  gateway.onGatewayExit(() => refreshStatus())
})

watch(tab, (name) => {
  if (name === 'status') statusRef.value?.reload?.()
  if (name === 'providers') providersRef.value?.reload?.()
  if (name === 'backends') backendsRef.value?.reload?.()
  if (name === 'settings') settingsRef.value?.reload?.()
})
</script>

<template>
  <el-config-provider :teleported="true">
    <div class="min-h-screen bg-[#FAF5FF] text-slate-900">
      <div class="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.08),transparent_55%)] pointer-events-none" />
      <div class="relative w-full px-6 py-6">
        <div class="mb-5 flex items-center gap-4 rounded-2xl border border-violet-100 bg-white/80 px-4 py-3">
          <div class="h-11 w-11 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold">OR</div>
          <div class="flex-1">
            <div class="text-xl font-semibold">OpenRouter 网关控制台</div>
            <div class="text-sm text-slate-500">本地网关运行状态与模型路由配置</div>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-sm">
              <span class="inline-block h-2 w-2 rounded-full" :class="status.running ? 'bg-emerald-500' : 'bg-slate-400'"></span>
              <span class="text-slate-600">{{ status.running ? '运行中' : '未运行' }}</span>
              <span class="text-slate-400">端口</span>
              <span class="font-semibold text-slate-800">:{{ status.port }}</span>
            </div>
            <div class="flex items-center gap-2">
              <el-button type="primary" :disabled="status.running" @click="handleStart">启动网关</el-button>
              <el-button type="danger" plain :disabled="!status.running" @click="handleStop">停止</el-button>
            </div>
          </div>
        </div>

        <el-card shadow="never" class="rounded-2xl border border-violet-100 bg-white/90">
          <el-tabs v-model="tab" type="card" class="gateway-tabs" @tab-click="handleTabClick">
            <el-tab-pane label="状态" name="status">
              <Status ref="statusRef" @status-change="refreshStatus" />
            </el-tab-pane>
            <el-tab-pane label="服务商" name="providers">
              <Providers ref="providersRef" />
            </el-tab-pane>
            <el-tab-pane label="模型列表" name="backends">
              <Backends ref="backendsRef" />
            </el-tab-pane>
            <el-tab-pane label="设置" name="settings">
              <Settings ref="settingsRef" />
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </div>
    </div>
  </el-config-provider>
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --el-color-primary: #7c3aed;
  --el-color-primary-light-3: #a78bfa;
  --el-color-success: #10b981;
  --el-color-warning: #f59e0b;
  --el-color-danger: #ef4444;
  --el-color-info: #64748b;
  --el-border-radius-base: 10px;
  --el-z-index-popper: 99999;
}

.el-card__body {
  padding: 18px !important;
}

.gateway-tabs {
  --el-tabs-header-height: 48px;
}
.gateway-tabs .el-tabs__header {
  margin-bottom: 16px;
}
.gateway-tabs .el-tabs__nav-wrap::after {
  background-color: #ede9fe;
}
.gateway-tabs .el-tabs__item {
  font-weight: 600;
  color: #475569;
}
.gateway-tabs .el-tabs__item.is-active {
  color: #6d28d9;
}

.el-table th.el-table__cell {
  background-color: #f5f3ff;
  color: #4c1d95;
}
.el-table .el-table__cell {
  border-color: #e9d5ff;
}

/* Ensure popper panels are not clipped inside dialogs */
.el-overlay-dialog .el-dialog {
  overflow: visible;
}
.el-overlay-dialog .el-dialog__body {
  overflow: visible;
}
.el-popper,
.el-select__popper,
.el-picker__popper,
.el-cascader__dropdown {
  z-index: 99999 !important;
}
.dialog-popper {
  z-index: 99999 !important;
}

.el-dialog {
  --el-dialog-margin-top: 10vh;
}

.gateway-dialog {
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}
.gateway-dialog .el-dialog__header,
.gateway-dialog .el-dialog__footer {
  flex: 0 0 auto;
}
.gateway-dialog .el-dialog__body {
  flex: 1 1 auto;
  overflow: auto;
  max-height: none;
}
.gateway-dialog-body {
  overflow: auto;
}

.backend-dialog .el-dialog__body,
.backend-dialog-body {
  max-height: 60vh;
  overflow: auto !important;
}
</style>
