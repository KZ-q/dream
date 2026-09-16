<script setup>
/* 工坊基础组件：双语字段编辑器（直接 mutate 传入的响应式对象） */
const props = defineProps({
  field: { type: [Object, String], default: null },
  multiline: { type: Boolean, default: false },
  rows: { type: Number, default: 3 }
})
function set(lang, e) {
  if (props.field && typeof props.field === 'object') props.field[lang] = e.target.value
}
</script>

<template>
  <div v-if="field && typeof field === 'object'" class="wk-i18n">
    <template v-if="multiline">
      <span class="wk-lang">zh</span>
      <textarea class="wk-input" :rows="rows" :value="field.zh ?? ''" @input="set('zh', $event)" />
      <span class="wk-lang">en</span>
      <textarea class="wk-input" :rows="rows" :value="field.en ?? ''" @input="set('en', $event)" />
    </template>
    <template v-else>
      <span class="wk-lang">zh</span>
      <input class="wk-input" :value="field.zh ?? ''" @input="set('zh', $event)" />
      <span class="wk-lang">en</span>
      <input class="wk-input" :value="field.en ?? ''" @input="set('en', $event)" />
    </template>
  </div>
  <p v-else class="wk-hint">（纯字符串字段：{{ field }}）</p>
</template>
