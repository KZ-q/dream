<script setup>
import { computed, watchEffect, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useContent, PRESETS } from './composables/useContent'
import Navbar from './components/Navbar.vue'
import FooterBar from './components/FooterBar.vue'

const route = useRoute()
const router = useRouter()
const { state, load } = useContent()
load()

function retry() {
  load()
}
/* 内容工坊(/studio) 与 孔诸祺作品站(/workshop) 均为独立全屏页：隐藏站点 Navbar/Footer，避免相互遮挡 */
const isWorkshop = computed(() =>
  ['studio', 'workshop', 'workshop-edit', 'root-workshop'].includes(route.name)
)

/* === 内容工坊（仅 dev）：iframe 实时预览双向同步 === */
if (import.meta.env.DEV) {
  const inFrame = () => window.parent !== window
  /* 工坊 → 预览：页签跳转（router.push，不重载 iframe 以保留推送的编辑内容） */
  window.addEventListener('message', (e) => {
    const d = e.data
    if (d?.type === 'wk:nav' && typeof d.path === 'string') router.push(d.path).catch(() => {})
  })
  /* 预览 → 工坊：路由回显（工具条页签高亮） */
  watch(
    () => route.path,
    (p) => {
      if (inFrame()) window.parent.postMessage({ type: 'wk:route', path: p }, '*')
    },
    { immediate: true }
  )
  /* 预览 → 工坊：在预览里手动切语言/主题时，工坊工具条同步显示 */
  watchEffect(() => {
    if (inFrame() && state.lang && state.preset) {
      window.parent.postMessage({ type: 'wk:state', lang: state.lang, preset: state.preset }, '*')
    }
  })
}

const PRESET_TEXTURE = {
  aurora: 'aurora',
  cyber: 'cyber',
  gold: 'gold',
  paper: 'paper',
  sunset: 'sunset'
}

watchEffect(() => {
  const c = state.content
  if (!c) return
  const title = c.site?.title
  document.title = typeof title === 'object' ? title[state.lang] || title.en : title || 'Portfolio'
  document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en'

  const theme = c.theme || {}
  const root = document.documentElement
  const preset = state.preset || theme.preset || 'aurora'
  root.dataset.preset = preset
  root.dataset.texture = theme.texture || PRESET_TEXTURE[preset] || 'aurora'
  for (const [k, v] of Object.entries(theme.colors || {})) {
    if (v) root.style.setProperty(`--c-${k}`, v)
  }
  if (theme.fonts?.heading) root.style.setProperty('--font-display', theme.fonts.heading)
  if (theme.fonts?.body) root.style.setProperty('--font-body', theme.fonts.body)
  if (theme.layout?.sectionGap) root.style.setProperty('--section-gap', theme.layout.sectionGap)
  if (theme.layout?.maxWidth) root.style.setProperty('--max-width', theme.layout.maxWidth)
})
</script>

<template>
  <div v-if="state.status !== 'error'" class="app">
    <Navbar v-if="!isWorkshop" :presets="PRESETS" />
    <main>
      <router-view />
    </main>
    <FooterBar v-if="!isWorkshop" />
  </div>
  <div v-else class="boot-error">
    <h1 class="display">内容加载失败 · Content failed to load</h1>
    <p class="err">{{ state.error?.message || '网络暂时不可用' }}</p>
    <button class="btn btn-primary" @click="retry">重试 Retry</button>
    <p class="hint">已自动重试 3 次；你也可以稍后再试。</p>
  </div>
</template>

<style scoped>
.boot-error {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 24px;
  background: #F7F8FA;
  color: #202935;
  text-align: center;
  font-family: system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.boot-error .display {
  font-family: 'Playfair Display', Georgia, 'Songti SC', serif;
  font-size: clamp(22px, 4vw, 34px);
  font-weight: 600;
  line-height: 1.35;
  color: #202935;
  max-width: 760px;
}
.err {
  color: #718096;
  font-size: 13px;
}
.hint {
  color: #718096;
  font-size: 12px;
}
.boot-error .btn-primary {
  margin-top: 8px;
  background: linear-gradient(180deg, #E3A05E, #D48C48);
  color: #1E2A3A;
  border: 0;
  box-shadow: 0 10px 24px rgba(212, 140, 72, 0.25);
}
.boot-error .btn-primary:hover {
  background: linear-gradient(180deg, #EDAE6F, #DE9A56);
}
</style>