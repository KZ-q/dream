<script setup>
/* 工坊面板：视频（title/desc + items 增删改） */
import { useContent } from '../../composables/useContent'
import WkI18n from './WkI18n.vue'
import WkImage from './WkImage.vue'
import WkTags from './WkTags.vue'

const { state } = useContent()
const videos = state.content.videos

function addItem() {
  videos.items.push({
    id: `video-${Date.now().toString(36)}`,
    bvid: 'BV1xx411c7mD',
    page: 1,
    title: { zh: '新视频', en: 'New video' },
    desc: { zh: '', en: '' },
    tags: [{ zh: '教程', en: 'Tutorial' }],
    cover: { src: '/assets/images/video-1.svg', alt: { zh: '视频封面', en: 'Video cover' } }
  })
}
</script>

<template>
  <div class="wk-panel-body">
    <h3 class="wk-h3">视频页</h3>
    <div class="wk-row"><span class="wk-key">标题</span><WkI18n :field="videos.title" /></div>
    <div class="wk-row"><span class="wk-key">描述</span><WkI18n :field="videos.desc" multiline :rows="2" /></div>

    <h3 class="wk-h3">视频列表（{{ videos.items.length }}）</h3>
    <div v-for="(v, i) in videos.items" :key="v.id || i" class="wk-card item">
      <div class="wk-card-head">
        <span>#{{ i + 1 }} · {{ v.title?.zh || v.id }}</span>
        <button class="wk-btn danger sm" type="button" @click="videos.items.splice(i, 1)">删除</button>
      </div>
      <div class="wk-row"><span class="wk-key">BV 号</span><input v-model="v.bvid" class="wk-input" placeholder="BV1xx411c7mD" /></div>
      <div class="wk-row"><span class="wk-key">分 P</span><input v-model.number="v.page" type="number" min="1" class="wk-input narrow" /></div>
      <div class="wk-row"><span class="wk-key">标题</span><WkI18n :field="v.title" /></div>
      <div class="wk-row"><span class="wk-key">描述</span><WkI18n :field="v.desc" multiline :rows="2" /></div>
      <div class="wk-row"><span class="wk-key">标签</span><WkTags :tags="v.tags" /></div>
      <div class="wk-row"><span class="wk-key">封面</span><WkImage :img="v.cover" /></div>
    </div>
    <button class="wk-btn sm" type="button" @click="addItem">＋ 添加视频</button>
  </div>
</template>
