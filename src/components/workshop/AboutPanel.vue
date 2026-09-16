<script setup>
/* 工坊面板：关于页（avatar/name/role/bio/location/status/skills/tools/timeline/contact） */
import { useContent } from '../../composables/useContent'
import WkI18n from './WkI18n.vue'
import WkImage from './WkImage.vue'

const { state } = useContent()
const about = state.content.about

function addBio() {
  about.bio.push({ zh: '', en: '' })
}
function addGroup() {
  about.skills.groups.push({ name: { zh: '新分组', en: 'New group' }, items: [] })
}
function addSkill(g) {
  g.items.push({ name: { zh: '新技能', en: 'New skill' }, level: 80 })
}
function addTool() {
  about.tools.push({ zh: '', en: '' })
}
function addTimeline() {
  about.timeline.push({ year: String(new Date().getFullYear()), title: { zh: '新事件', en: 'New event' }, desc: { zh: '', en: '' } })
}
</script>

<template>
  <div class="wk-panel-body">
    <h3 class="wk-h3">个人信息</h3>
    <div class="wk-row"><span class="wk-key">头像</span><WkImage :img="about.avatar" /></div>
    <div class="wk-row"><span class="wk-key">名字</span><WkI18n :field="about.name" /></div>
    <div class="wk-row"><span class="wk-key">头衔</span><WkI18n :field="about.role" /></div>
    <div class="wk-row"><span class="wk-key">坐标</span><WkI18n :field="about.location" /></div>
    <div class="wk-row"><span class="wk-key">状态</span><WkI18n :field="about.status" /></div>

    <h3 class="wk-h3">简介段落</h3>
    <div v-for="(p, i) in about.bio" :key="i" class="wk-row">
      <WkI18n :field="p" multiline :rows="3" />
      <button class="wk-btn danger sm" type="button" @click="about.bio.splice(i, 1)">✕</button>
    </div>
    <button class="wk-btn sm" type="button" @click="addBio">＋ 添加段落</button>

    <h3 class="wk-h3">能力雷达</h3>
    <div class="wk-row"><span class="wk-key">标题</span><WkI18n :field="about.skills.title" /></div>
    <div v-for="(g, i) in about.skills.groups" :key="i" class="wk-card">
      <div class="wk-card-head">
        <WkI18n :field="g.name" />
        <button class="wk-btn danger sm" type="button" @click="about.skills.groups.splice(i, 1)">删除组</button>
      </div>
      <div v-for="(s, j) in g.items" :key="j" class="wk-row">
        <WkI18n :field="s.name" />
        <input v-model.number="s.level" type="number" min="0" max="100" class="wk-input narrow" />
        <button class="wk-btn danger sm" type="button" @click="g.items.splice(j, 1)">✕</button>
      </div>
      <button class="wk-btn sm" type="button" @click="addSkill(g)">＋ 添加技能</button>
    </div>
    <button class="wk-btn sm" type="button" @click="addGroup">＋ 添加分组</button>
    <h3 class="wk-h3">工具链</h3>
    <div class="wk-row"><span class="wk-key">标题</span><WkI18n :field="about.toolsTitle" /></div>
    <div v-for="(tool, i) in about.tools" :key="i" class="wk-row">
      <WkI18n :field="tool" />
      <button class="wk-btn danger sm" type="button" @click="about.tools.splice(i, 1)">✕</button>
    </div>
    <button class="wk-btn sm" type="button" @click="addTool">＋ 添加工具</button>

    <h3 class="wk-h3">创作历程</h3>
    <div class="wk-row"><span class="wk-key">标题</span><WkI18n :field="about.timelineTitle" /></div>
    <div v-for="(t, i) in about.timeline" :key="i" class="wk-card">
      <div class="wk-card-head">
        <span>{{ t.year }}</span>
        <button class="wk-btn danger sm" type="button" @click="about.timeline.splice(i, 1)">删除</button>
      </div>
      <div class="wk-row"><span class="wk-key">年份</span><input v-model="t.year" class="wk-input narrow" /></div>
      <div class="wk-row"><span class="wk-key">标题</span><WkI18n :field="t.title" /></div>
      <div class="wk-row"><span class="wk-key">描述</span><WkI18n :field="t.desc" multiline :rows="2" /></div>
    </div>
    <button class="wk-btn sm" type="button" @click="addTimeline">＋ 添加节点</button>

    <h3 class="wk-h3">联系区块</h3>
    <div class="wk-row"><span class="wk-key">标题</span><WkI18n :field="about.contact.title" /></div>
    <div class="wk-row"><span class="wk-key">描述</span><WkI18n :field="about.contact.desc" multiline :rows="2" /></div>
    <div class="wk-row"><span class="wk-key">按钮文案</span><WkI18n :field="about.contact.cta.label" /></div>
    <div class="wk-row"><span class="wk-key">按钮链接</span><input v-model="about.contact.cta.url" class="wk-input" /></div>

  </div>
</template>
