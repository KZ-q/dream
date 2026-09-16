<script setup>
/* 工坊面板：作品集（title/desc + items 增删改） */
import { useContent } from '../../composables/useContent'
import WkI18n from './WkI18n.vue'
import WkImage from './WkImage.vue'
import WkTags from './WkTags.vue'

const { state } = useContent()
const works = state.content.works

function addItem() {
  works.items.push({
    id: `work-${Date.now().toString(36)}`,
    title: { zh: '新作品', en: 'New work' },
    year: new Date().getFullYear(),
    tags: [{ zh: '待定', en: 'TBD' }],
    cover: { src: '/assets/images/work-1.svg', alt: { zh: '作品封面', en: 'Work cover' } },
    desc: { zh: '', en: '' }
  })
}
</script>

<template>
  <div class="wk-panel-body">
    <h3 class="wk-h3">作品集页</h3>
    <div class="wk-row"><span class="wk-key">标题</span><WkI18n :field="works.title" /></div>
    <div class="wk-row"><span class="wk-key">描述</span><WkI18n :field="works.desc" multiline :rows="2" /></div>

    <h3 class="wk-h3">作品列表（{{ works.items.length }}）</h3>
    <div v-for="(w, i) in works.items" :key="w.id || i" class="wk-card item">
      <div class="wk-card-head">
        <span>#{{ i + 1 }} · {{ w.title?.zh || w.id }}</span>
        <button class="wk-btn danger sm" type="button" @click="works.items.splice(i, 1)">删除</button>
      </div>
      <div class="wk-row"><span class="wk-key">id</span><input v-model="w.id" class="wk-input" /></div>
      <div class="wk-row"><span class="wk-key">标题</span><WkI18n :field="w.title" /></div>
      <div class="wk-row"><span class="wk-key">年份</span><input v-model.number="w.year" type="number" class="wk-input narrow" /></div>
      <div class="wk-row"><span class="wk-key">标签</span><WkTags :tags="w.tags" /></div>
      <div class="wk-row"><span class="wk-key">封面</span><WkImage :img="w.cover" /></div>
      <div class="wk-row"><span class="wk-key">描述</span><WkI18n :field="w.desc" multiline :rows="2" /></div>
      <div class="wk-row"><span class="wk-key">外链</span><input v-model="w.link" class="wk-input" placeholder="https://（可选）" /></div>
    </div>
    <button class="wk-btn sm" type="button" @click="addItem">＋ 添加作品</button>
  </div>
</template>
