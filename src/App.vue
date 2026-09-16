<script setup>
import { computed, watchEffect, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useContent, PRESETS } from './composables/useContent'
import Navbar from './components/Navbar.vue'
import FooterBar from './components/FooterBar.vue'
import Splash from './components/Splash.vue'

const route = useRoute()
const router = useRouter()
const { state, load } = useContent()
load()
/* 内容工坊(/studio) 与 孔诸祺作品站(/workshop) 均为独立全屏页：隐藏站点 Navbar/Footer，避免相互遮挡 */
const isWorkshop = computed(() => route.name === 'studio' || route.name === 'workshop' || route.name === 'workshop-edit')

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
  <Splash v-if="state.status === 'loading'" />
  <div v-else-if="state.status === 'ready'" class="app">
    <Navbar v-if="!isWorkshop" :presets="PRESETS" />
    <main>
      <router-view />
    </main>
    <FooterBar v-if="!isWorkshop" />
  </div>
  <div v-else class="boot-error container">
    <h1 class="display">内容加载失败 · Content failed to load</h1>
    <p class="err">{{ state.error?.message }}</p>
    <button class="btn btn-primary" @click="() => location.reload()">重试 Retry</button>
  </div>
</template>

<style scoped>
.boot-error {
  padding-block: 30vh;
  text-align: center;
  display: grid;
  justify-items: center;
  gap: 14px;
}
.err {
  color: var(--c-muted);
  font-size: 13px;
}
</style>