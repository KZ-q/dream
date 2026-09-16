<script setup>
/* 工坊面板：导航 + 页脚 */
import { useContent } from '../../composables/useContent'
import WkI18n from './WkI18n.vue'

const { state } = useContent()
const nav = state.content.nav
const footer = state.content.footer

function addNavItem() {
  nav.push({ to: '/', label: { zh: '新导航', en: 'New item' } })
}
function addFootLink() {
  footer.links.push({ to: '/', label: { zh: '新链接', en: 'New link' } })
}
</script>

<template>
  <div class="wk-panel-body">
    <h3 class="wk-h3">导航</h3>
    <div v-for="(item, i) in nav" :key="i" class="wk-card">
      <div class="wk-card-head">
        <span>导航 {{ i + 1 }}</span>
        <button class="wk-btn danger sm" type="button" @click="nav.splice(i, 1)">删除</button>
      </div>
      <div class="wk-row"><span class="wk-key">to</span><input v-model="item.to" class="wk-input" /></div>
      <div class="wk-row"><span class="wk-key">label</span><WkI18n :field="item.label" /></div>
    </div>
    <button class="wk-btn sm" type="button" @click="addNavItem">＋ 添加导航项</button>

    <h3 class="wk-h3">页脚</h3>
    <div class="wk-row"><span class="wk-key">署名</span><WkI18n :field="footer.owner" /></div>
    <div class="wk-row"><span class="wk-key">AI 声明</span><WkI18n :field="footer.aiDisclosure" multiline :rows="2" /></div>
    <div class="wk-row"><span class="wk-key">备注</span><WkI18n :field="footer.note" /></div>

    <div class="wk-card">
      <div class="wk-card-head"><span>备案信息</span></div>
      <div class="wk-row"><span class="wk-key">text</span><input v-model="footer.beian.text" class="wk-input" /></div>
      <div class="wk-row"><span class="wk-key">url</span><input v-model="footer.beian.url" class="wk-input" /></div>
    </div>

    <h3 class="wk-h3">页脚链接</h3>
    <div v-for="(item, i) in footer.links" :key="i" class="wk-card">
      <div class="wk-card-head">
        <span>链接 {{ i + 1 }}</span>
        <button class="wk-btn danger sm" type="button" @click="footer.links.splice(i, 1)">删除</button>
      </div>
      <div class="wk-row"><span class="wk-key">to</span><input v-model="item.to" class="wk-input" /></div>
      <div class="wk-row"><span class="wk-key">label</span><WkI18n :field="item.label" /></div>
    </div>
    <button class="wk-btn sm" type="button" @click="addFootLink">＋ 添加页脚链接</button>
  </div>
</template>
