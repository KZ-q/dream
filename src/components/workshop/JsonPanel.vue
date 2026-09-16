<script setup>
/* 工坊面板：JSON 源码直接编辑（带解析校验） */
import { ref, watch } from 'vue'
import { state } from '../../composables/useContent'

const text = ref(JSON.stringify(state.content, null, 2))
const err = ref('')
const applied = ref(false)

watch(
  () => state.content,
  () => {
    if (!applied.value) text.value = JSON.stringify(state.content, null, 2)
  },
  { deep: false }
)

function apply() {
  try {
    const parsed = JSON.parse(text.value)
    if (!parsed?.site || !parsed?.home) throw new Error('缺少 site 或 home 顶层字段')
    state.content = parsed
    err.value = ''
    applied.value = true
    setTimeout(() => (applied.value = false), 1500)
  } catch (e) {
    err.value = e.message
  }
}
function reload() {
  text.value = JSON.stringify(state.content, null, 2)
  err.value = ''
}
</script>

<template>
  <div class="wk-panel-body">
    <div class="wk-add-bar">
      <span v-if="err" class="wk-error">✗ {{ err }}</span>
      <span v-else-if="applied" class="wk-hint">✓ 已应用到预览</span>
      <span v-else class="wk-hint">直接编辑 JSON 源码，应用后立即在预览中生效</span>
      <span class="wk-head-actions">
        <button class="wk-btn sm" type="button" @click="reload">重新载入</button>
        <button class="wk-btn primary sm" type="button" @click="apply">应用</button>
      </span>
    </div>
    <textarea v-model="text" class="wk-input wk-json" rows="24" spellcheck="false" />
  </div>
</template>
