<script setup>
/* 工坊面板：站点信息（标题/描述/logo/邮箱/默认语言/社交列表） */
import { useContent } from '../../composables/useContent'
import WkI18n from './WkI18n.vue'

const { state } = useContent()
const site = state.content.site

const PLATFORMS = ['bilibili', 'xiaohongshu', 'douyin', 'x', 'github', 'mail', 'website']

function addSocial() {
  site.socials.push({ platform: 'website', url: 'https://', label: { zh: '新平台', en: 'New platform' } })
}
function removeSocial(i) {
  site.socials.splice(i, 1)
}
</script>

<template>
  <div class="wk-panel-body">
    <h3 class="wk-h3">站点信息</h3>
    <div class="wk-row"><span class="wk-key">标题</span><WkI18n :field="site.title" /></div>
    <div class="wk-row"><span class="wk-key">描述</span><WkI18n :field="site.description" multiline :rows="2" /></div>
    <div class="wk-row"><span class="wk-key">Logo</span><input v-model="site.logo" class="wk-input" /></div>
    <div class="wk-row"><span class="wk-key">联系邮箱</span><input v-model="site.contactEmail" class="wk-input" /></div>
    <div class="wk-row">
      <span class="wk-key">默认语言</span>
      <select v-model="site.defaultLang" class="wk-input narrow">
        <option v-for="l in site.languages" :key="l" :value="l">{{ l }}</option>
      </select>
    </div>

    <h3 class="wk-h3">社交链接</h3>
    <div v-for="(s, i) in site.socials" :key="i" class="wk-card">
      <div class="wk-card-head">
        <select v-model="s.platform" class="wk-input narrow">
          <option v-for="p in PLATFORMS" :key="p" :value="p">{{ p }}</option>
        </select>
        <button class="wk-btn danger sm" type="button" @click="removeSocial(i)">删除</button>
      </div>
      <div class="wk-row"><span class="wk-key">url</span><input v-model="s.url" class="wk-input" /></div>
      <div class="wk-row"><span class="wk-key">label</span><WkI18n :field="s.label" /></div>
    </div>
    <button class="wk-btn sm" type="button" @click="addSocial">＋ 添加社交链接</button>
  </div>
</template>
