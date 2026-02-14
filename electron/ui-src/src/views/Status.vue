<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useGateway } from '../composables/useGateway'

const emit = defineEmits(['status-change'])
const gateway = useGateway()
const log = ref('')
const logEl = ref(null)

function append(msg) {
  log.value += msg
  nextTick(() => {
    if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
  })
}

async function start() {
  const r = await gateway.startGateway()
  if (r.ok) append('[已启动]\n')
  else append('[错误] ' + (r.error || '') + '\n')
  emit('status-change')
}
async function stop() {
  await gateway.stopGateway()
  append('[已停止]\n')
  emit('status-change')
}

onMounted(() => {
  gateway.onGatewayLog((msg) => append(msg))
  gateway.onGatewayExit((code) => {
    append('[进程退出 ' + code + ']\n')
    emit('status-change')
  })
  gateway.onGatewayError((msg) => append('[错误] ' + msg + '\n'))
})

defineExpose({ start, stop })
</script>

<template>
  <div class="space-y-4">
    <div>
      <div class="text-base font-semibold text-slate-800">运行日志</div>
      <div class="text-sm text-slate-500">实时查看网关运行输出与错误提示</div>
    </div>

    <el-card shadow="never" class="rounded-xl border border-slate-200 bg-white">
      <el-scrollbar height="360px">
        <pre
          ref="logEl"
          class="text-sm whitespace-pre-wrap break-all bg-slate-950 text-slate-100 rounded-lg p-4 min-h-[240px]"
        >{{ log || '等待日志...' }}</pre>
      </el-scrollbar>
    </el-card>
  </div>
</template>
