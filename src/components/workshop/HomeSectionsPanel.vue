<script setup>
/* 工坊面板：首页区块（hero/works/video/services/stats/ctaBanner 六种类型） */
import { useContent } from '../../composables/useContent'
import WkI18n from './WkI18n.vue'
import WkImage from './WkImage.vue'
import WkCtas from './WkCtas.vue'

const { state } = useContent()
const sections = state.content.home.sections

const TYPE_LABEL = {
  hero: 'Hero 主视觉',
  works: '精选作品',
  video: '视频展示',
  services: '服务列表',
  stats: '数据统计',
  ctaBanner: 'CTA 横幅'
}
const NEW_SECTION = {
  hero: () => ({
    type: 'hero',
    image: { src: '/assets/images/hero.svg', alt: { zh: '主视觉插画', en: 'Hero illustration' }, objectPosition: 'center' },
    badge: { text: { zh: '接受合作委托', en: 'Open for commissions' } },
    title: { zh: '新标题', en: 'New title' },
    subtitle: { zh: '副标题文案', en: 'Subtitle copy' },
    cta: [{ label: { zh: '查看作品', en: 'View works' }, url: '/works', style: 'primary' }]
  }),
  works: () => ({ type: 'works', title: { zh: '精选作品', en: 'Featured Works' }, count: 6, more: '/works' }),
  video: () => ({
    type: 'video',
    title: { zh: '最新视频', en: 'Latest video' },
    bvid: 'BV1xx411c7mD',
    page: 1,
    cover: { src: '/assets/images/video-1.svg', alt: { zh: '视频封面', en: 'Video cover' } },
    altLinks: []
  }),
  services: () => ({
    type: 'services',
    title: { zh: '我能做什么', en: 'What I Do' },
    items: [{ icon: 'image', title: { zh: '新服务', en: 'New service' }, desc: { zh: '描述', en: 'Description' } }]
  }),
  stats: () => ({ type: 'stats', items: [{ value: 10, suffix: '+', label: { zh: '新数据', en: 'New stat' } }] }),
  ctaBanner: () => ({
    type: 'ctaBanner',
    title: { zh: '一起创作吧', en: "Let's create" },
    desc: { zh: '描述文案', en: 'Description' },
    image: { src: '/assets/images/cta.svg' },
    cta: [{ label: { zh: '发起合作', en: 'Start a project' }, url: '/about#contact', style: 'primary' }]
  })
}
const SERVICE_ICONS = ['image', 'video', 'wand', 'message', 'code', 'star']

function addSection(type) {
  sections.push(NEW_SECTION[type]())
}
function move(i, d) {
  const j = i + d
  if (j < 0 || j >= sections.length) return
  const [s] = sections.splice(i, 1)
  sections.splice(j, 0, s)
}
function addService(sec) {
  sec.items.push({ icon: 'image', title: { zh: '新服务', en: 'New service' }, desc: { zh: '', en: '' } })
}
function addAltLink(sec) {
  sec.altLinks.push({ label: { zh: '新链接', en: 'New link' }, url: 'https://' })
}
function addStat(sec) {
  sec.items.push({ value: 10, suffix: '+', label: { zh: '新数据', en: 'New stat' } })
}
</script>

<template>
  <div class="wk-panel-body">
    <div class="wk-add-bar">
      <span class="wk-hint">区块按此顺序渲染到首页</span>
      <select class="wk-input narrow" @change="addSection($event.target.value); $event.target.selectedIndex = 0">
        <option value="" disabled selected>＋ 添加区块…</option>
        <option v-for="(label, type) in TYPE_LABEL" :key="type" :value="type">{{ label }}</option>
      </select>
    </div>

    <div v-for="(sec, i) in sections" :key="i" class="wk-card section">
      <div class="wk-card-head">
        <strong>{{ TYPE_LABEL[sec.type] || sec.type }}</strong>
        <span class="wk-head-actions">
          <button class="wk-btn sm" type="button" :disabled="i === 0" @click="move(i, -1)">↑</button>
          <button class="wk-btn sm" type="button" :disabled="i === sections.length - 1" @click="move(i, 1)">↓</button>
          <button class="wk-btn danger sm" type="button" @click="sections.splice(i, 1)">删除</button>
        </span>
      </div>

      <template v-if="sec.type === 'hero'">
        <div class="wk-row"><span class="wk-key">主视觉图</span><WkImage :img="sec.image" /></div>
        <div class="wk-row"><span class="wk-key">徽章</span><WkI18n :field="sec.badge?.text" /></div>
        <div class="wk-row"><span class="wk-key">主标题</span><WkI18n :field="sec.title" multiline :rows="2" /></div>
        <div class="wk-row"><span class="wk-key">副标题</span><WkI18n :field="sec.subtitle" multiline :rows="3" /></div>
        <div class="wk-row"><span class="wk-key">按钮</span><WkCtas :list="sec.cta" /></div>
      </template>

      <template v-else-if="sec.type === 'works'">
        <div class="wk-row"><span class="wk-key">标题</span><WkI18n :field="sec.title" /></div>
        <div class="wk-row"><span class="wk-key">数量</span><input v-model.number="sec.count" type="number" min="1" max="8" class="wk-input narrow" /></div>
        <div class="wk-row"><span class="wk-key">更多链接</span><input v-model="sec.more" class="wk-input" /></div>
      </template>
      <template v-else-if="sec.type === 'video'">
        <div class="wk-row"><span class="wk-key">标题</span><WkI18n :field="sec.title" /></div>
        <div class="wk-row"><span class="wk-key">BV 号</span><input v-model="sec.bvid" class="wk-input" placeholder="BV1xx411c7mD" /></div>
        <div class="wk-row"><span class="wk-key">分 P</span><input v-model.number="sec.page" type="number" min="1" class="wk-input narrow" /></div>
        <div class="wk-row"><span class="wk-key">封面</span><WkImage :img="sec.cover" /></div>
        <div v-for="(l, j) in sec.altLinks || []" :key="j" class="wk-row">
          <span class="wk-key">外链{{ j + 1 }}</span>
          <input v-model="l.url" class="wk-input" />
          <button class="wk-btn danger sm" type="button" @click="sec.altLinks.splice(j, 1)">✕</button>
        </div>
        <button class="wk-btn sm" type="button" @click="addAltLink(sec)">＋ 添加外链</button>
      </template>

      <template v-else-if="sec.type === 'services'">
        <div class="wk-row"><span class="wk-key">标题</span><WkI18n :field="sec.title" /></div>
        <div v-for="(it, j) in sec.items" :key="j" class="wk-card">
          <div class="wk-card-head">
            <select v-model="it.icon" class="wk-input narrow">
              <option v-for="ic in SERVICE_ICONS" :key="ic" :value="ic">{{ ic }}</option>
            </select>
            <button class="wk-btn danger sm" type="button" @click="sec.items.splice(j, 1)">删除</button>
          </div>
          <div class="wk-row"><span class="wk-key">标题</span><WkI18n :field="it.title" /></div>
          <div class="wk-row"><span class="wk-key">描述</span><WkI18n :field="it.desc" multiline :rows="2" /></div>
        </div>
        <button class="wk-btn sm" type="button" @click="addService(sec)">＋ 添加服务</button>
      </template>

      <template v-else-if="sec.type === 'stats'">
        <div v-for="(it, j) in sec.items" :key="j" class="wk-row">
          <input v-model.number="it.value" type="number" class="wk-input narrow" />
          <input v-model="it.suffix" class="wk-input narrow" placeholder="后缀" />
          <WkI18n :field="it.label" />
          <button class="wk-btn danger sm" type="button" @click="sec.items.splice(j, 1)">✕</button>
        </div>
        <button class="wk-btn sm" type="button" @click="addStat(sec)">＋ 添加数据</button>
      </template>

      <template v-else-if="sec.type === 'ctaBanner'">
        <div class="wk-row"><span class="wk-key">标题</span><WkI18n :field="sec.title" /></div>
        <div class="wk-row"><span class="wk-key">描述</span><WkI18n :field="sec.desc" multiline :rows="2" /></div>
        <div class="wk-row"><span class="wk-key">背景图</span><WkImage :img="sec.image" /></div>
        <div class="wk-row"><span class="wk-key">按钮</span><WkCtas :list="sec.cta" /></div>
      </template>

    </div>
  </div>
</template>
