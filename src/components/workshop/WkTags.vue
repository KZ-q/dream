<script setup>
/* 工坊基础组件：标签列表编辑（[{zh,en}]） */
function add() {
  props.tags.push({ zh: '新标签', en: 'New tag' })
}
function remove(i) {
  props.tags.splice(i, 1)
}
const props = defineProps({ tags: { type: Array, default: () => [] } })
</script>

<template>
  <div class="wk-tags">
    <div v-for="(tag, i) in tags" :key="i" class="wk-tags-item">
      <span class="wk-lang">zh</span>
      <input v-model="tag.zh" class="wk-input" />
      <span class="wk-lang">en</span>
      <input v-model="tag.en" class="wk-input" />
      <button class="wk-btn danger sm" type="button" @click="remove(i)">✕</button>
    </div>
    <button class="wk-btn sm" type="button" @click="add">＋ 添加标签</button>
  </div>
</template>
