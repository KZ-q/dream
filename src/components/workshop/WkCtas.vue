<script setup>
/* 工坊基础组件：按钮组编辑（[{label:{zh,en}, url, style}]） */
import WkI18n from './WkI18n.vue'
const props = defineProps({ list: { type: Array, default: () => [] } })
function add() {
  props.list.push({ label: { zh: '按钮', en: 'Button' }, url: '/', style: 'primary' })
}
function remove(i) {
  props.list.splice(i, 1)
}
</script>

<template>
  <div class="wk-ctas">
    <div v-for="(c, i) in list" :key="i" class="wk-card">
      <div class="wk-card-head">
        <span>按钮 {{ i + 1 }}</span>
        <button class="wk-btn danger sm" type="button" @click="remove(i)">删除</button>
      </div>
      <div class="wk-row"><span class="wk-key">label</span><WkI18n :field="c.label" /></div>
      <div class="wk-row"><span class="wk-key">url</span><input v-model="c.url" class="wk-input" /></div>
      <div class="wk-row">
        <span class="wk-key">style</span>
        <select v-model="c.style" class="wk-input">
          <option value="primary">primary</option>
          <option value="ghost">ghost</option>
        </select>
      </div>
    </div>
    <button class="wk-btn sm" type="button" @click="add">＋ 添加按钮</button>
  </div>
</template>
