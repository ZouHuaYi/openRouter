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
  <el-card shadow="never">
    <el-scrollbar height="320px">
      <pre
        ref="logEl"
        class="text-sm whitespace-pre-wrap break-all"
      >{{ log || '等待日志...' }}</pre>
    </el-scrollbar>
  </el-card>
</template>
