<script setup>
/* 内容工坊：左侧编辑 + 右侧 iframe 实时预览（复刻 studio 分屏形式）
   编辑直接 mutate state.content → 防抖 500ms 推送进 iframe（站点端 useContent 监听 wk:content）
   路由/语言/主题经消息双向同步；仅开发模式注册（router + Navbar 同步判断 import.meta.env.DEV） */
import { ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'
import { useContent, PRESETS } from '../composables/useContent'
import SitePanel from '../components/workshop/SitePanel.vue'
import NavFooterPanel from '../components/workshop/NavFooterPanel.vue'
import HomeSectionsPanel from '../components/workshop/HomeSectionsPanel.vue'
import WorksPanel from '../components/workshop/WorksPanel.vue'
import VideosPanel from '../components/workshop/VideosPanel.vue'
import AboutPanel from '../components/workshop/AboutPanel.vue'
import JsonPanel from '../components/workshop/JsonPanel.vue'

const { state, setLang, setPreset } = useContent()

const TABS = [
  { id: 'site', label: '站点', comp: SitePanel },
  { id: 'nav', label: '导航·页脚', comp: NavFooterPanel },
  { id: 'home', label: '首页区块', comp: HomeSectionsPanel },
  { id: 'works', label: '作品', comp: WorksPanel },
  { id: 'videos', label: '视频', comp: VideosPanel },
  { id: 'about', label: '关于', comp: AboutPanel },
  { id: 'json', label: 'JSON 源码', comp: JsonPanel }
]
const active = ref('site')

/* ===== 工具条状态 ===== */
const PAGES = [
  { path: '/', label: '首页' },
  { path: '/works', label: '作品' },
  { path: '/videos', label: '视频' },
  { path: '/about', label: '关于' }
]
const curPath = ref('/')
const siteName = computed(() => {
  const t = state.content?.site?.title
  return typeof t === 'object' ? t.zh || t.en : t || ''
})
const baseline = ref('')
watchEffect(() => {
  if (!baseline.value && state.content) baseline.value = JSON.stringify(state.content)
})
const dirty = computed(() => !!state.content && JSON.stringify(state.content) !== baseline.value)

/* ===== 保存：写回 public/content/content.json（studio/server.mjs dev 中间件提供，仅开发模式存在；写前自动备份上一版） ===== */
const saving = ref(false)
const savedAt = ref('')
async function save() {
  if (!dirty.value || saving.value) return
  saving.value = true
  try {
    const res = await fetch('/api/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: JSON.parse(JSON.stringify(state.content)) })
    })
    const d = await res.json()
    if (d.error) throw new Error(d.error)
    baseline.value = JSON.stringify(state.content)
    savedAt.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    notify(`已保存到 public/content/content.json${d.backedUp ? '（上一版已备份为 content.backup.json）' : ''}`)
  } catch (err) {
    alert('保存失败：' + err.message + '（本地端点不可用？请在 dev server 模式下使用工坊）')
  } finally {
    saving.value = false
  }
}

/* ===== 预览 iframe ===== */
const frameEl = ref(null)
const frameKey = ref(0)
const frameReady = ref(false)
const viewport = ref('desktop')
/* 桌面视口下限 960px：站点导航桌面断点为 900px，预览区窄于该值时保持桌面布局并横向滚动 */
const FRAME_W = { desktop: 'max(100%, 960px)', tablet: '768px', mobile: '375px' }
const frameWidth = computed(() => FRAME_W[viewport.value])

function post(msg) {
  frameEl.value?.contentWindow?.postMessage(msg, '*')
}
/* 推送必须深拷贝：reactive 代理不可跨窗口结构化克隆 */
function pushContent() {
  if (!state.content) return
  post({ type: 'wk:content', content: JSON.parse(JSON.stringify(state.content)) })
}

/* 改动防抖 500ms 推送预览（深层修改与整体替换都会触发） */
let pushTimer = null
watch(
  () => state.content,
  () => {
    if (!frameReady.value) return
    clearTimeout(pushTimer)
    pushTimer = setTimeout(pushContent, 500)
  },
  { deep: true }
)

/* iframe 每次加载：先按 load 兜底；站点 fetch 完成会发 wk:hello，收到后立即全量推送 */
let helloTimer = null
function onFrameLoad() {
  clearTimeout(helloTimer)
  helloTimer = setTimeout(() => {
    frameReady.value = true
    pushContent()
  }, 700)
}
function reloadFrame() {
  frameReady.value = false
  curPath.value = '/'
  frameKey.value++
}
function onMessage(e) {
  const d = e.data
  if (!d || typeof d !== 'object') return
  if (d.type === 'wk:hello') {
    frameReady.value = true
    clearTimeout(helloTimer)
    pushContent()
    post({ type: 'wk:lang', lang: state.lang })
    post({ type: 'wk:preset', preset: state.preset })
  }
  if (d.type === 'wk:route' && typeof d.path === 'string') curPath.value = d.path
  if (d.type === 'wk:state') {
    /* 预览内手动切换语言/主题 → 工具条回显（直接赋值，不回推消息，避免循环） */
    if (d.lang && d.lang !== state.lang) state.lang = d.lang
    if (d.preset && d.preset !== state.preset) state.preset = d.preset
  }
}
onMounted(() => window.addEventListener('message', onMessage))
onUnmounted(() => {
  window.removeEventListener('message', onMessage)
  clearTimeout(pushTimer)
  clearTimeout(helloTimer)
})

function goPage(p) {
  curPath.value = p
  if (frameReady.value) post({ type: 'wk:nav', path: p })
}
function onLang(e) {
  setLang(e.target.value)
  post({ type: 'wk:lang', lang: state.lang })
}
function onPreset(e) {
  setPreset(e.target.value)
  post({ type: 'wk:preset', preset: state.preset })
}

/* ===== 左栏宽度可拖拽（复刻 studio：360–760px） ===== */
const editorW = ref(480)
let resizing = false
let resizeStartX = 0
let resizeStartW = 0
function startResize(e) {
  resizing = true
  resizeStartX = e.clientX
  resizeStartW = editorW.value
  window.addEventListener('mousemove', onResize)
  window.addEventListener('mouseup', stopResize)
}
function onResize(e) {
  if (!resizing) return
  editorW.value = Math.min(760, Math.max(360, resizeStartW + (e.clientX - resizeStartX)))
}
function stopResize() {
  resizing = false
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', stopResize)
}

/* ===== 下载 / 导入 / 重置 ===== */
const fileInput = ref(null)
const flash = ref('')

function notify(msg) {
  flash.value = msg
  setTimeout(() => (flash.value = ''), 2600)
}

function download() {
  const blob = new Blob([JSON.stringify(state.content, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'content.json'
  a.click()
  URL.revokeObjectURL(a.href)
  notify('已下载 content.json — 替换 public/content/content.json 后 npm run build 生效')
}

async function onImport(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  try {
    const parsed = JSON.parse(await file.text())
    if (!parsed?.site || !parsed?.home) throw new Error('缺少 site 或 home 顶层字段')
    state.content = parsed
    baseline.value = JSON.stringify(parsed)
    notify('导入成功，预览已更新')
  } catch (err) {
    alert('导入失败：' + err.message)
  }
}

async function reset() {
  if (!confirm('放弃当前所有编辑，回到磁盘上的 content.json？')) return
  const res = await fetch(`${import.meta.env.BASE_URL}content/content.json`, { cache: 'no-cache' })
  const json = await res.json()
  state.content = json
  baseline.value = JSON.stringify(json)
  notify('已重置为磁盘版本')
}
</script>

<template>
  <div class="wk">
    <header class="wk-bar">
      <div class="wk-brand">
        <span class="mark">🛠</span>
        <strong>内容工坊</strong>
        <span v-if="siteName" class="wk-sitename">{{ siteName }}</span>
        <span class="wk-dot" :class="{ dirty }" :title="dirty ? '有未保存改动' : '与磁盘版本一致'" />
        <span v-if="savedAt" class="wk-saved">已保存 {{ savedAt }}</span>
      </div>
      <div class="wk-bar-actions">
        <nav class="wk-pages" aria-label="预览页面">
          <button
            v-for="p in PAGES"
            :key="p.path"
            type="button"
            class="wk-page"
            :class="{ on: curPath === p.path }"
            @click="goPage(p.path)"
          >
            {{ p.label }}
          </button>
        </nav>
        <span class="wk-sep" />
        <select :value="state.lang" class="wk-input narrow" @change="onLang">
          <option value="zh">中文</option>
          <option value="en">English</option>
        </select>
        <select :value="state.preset" class="wk-input narrow" @change="onPreset">
          <option v-for="p in PRESETS" :key="p.id" :value="p.id">{{ p.label.zh }}</option>
        </select>
        <button class="wk-btn sm" type="button" @click="reset">重置</button>
        <button class="wk-btn sm" type="button" @click="fileInput.click()">导入</button>
        <button class="wk-btn sm" type="button" @click="download">下载 content.json</button>
        <button class="wk-btn primary sm" type="button" :disabled="saving || !dirty" @click="save">
          {{ saving ? '保存中…' : '保存' }}
        </button>
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onImport" />
      </div>
    </header>
    <Transition name="wk-flash">
      <p v-if="flash" class="wk-flashbar">{{ flash }}</p>
    </Transition>

    <div class="wk-body" :style="{ '--editor-w': editorW + 'px' }">
      <!-- 左：编辑区 -->
      <aside class="wk-editor">
        <nav class="wk-tabs" aria-label="编辑面板">
          <button
            v-for="t in TABS"
            :key="t.id"
            type="button"
            class="wk-tab"
            :class="{ on: active === t.id }"
            @click="active = t.id"
          >
            {{ t.label }}
          </button>
        </nav>
        <div class="wk-scroll">
          <template v-if="state.content">
            <component :is="TABS.find((t) => t.id === active).comp" />
            <p class="wk-save-note">
              提示：「保存」直接写回 <code>public/content/content.json</code>（上一版自动备份为
              <code>content.backup.json</code>）；「下载 content.json」可离线导出。
            </p>
          </template>
          <p v-else class="wk-hint">内容加载中…（content.json 尚未就绪）</p>
        </div>
      </aside>

      <!-- 分隔条：拖拽调整编辑区宽度 -->
      <div class="wk-divider" title="拖拽调整编辑区宽度" @mousedown.prevent="startResize" />

      <!-- 右：实时预览 -->
      <section class="wk-preview">
        <div class="pv-bar">
          <div class="vps">
            <button type="button" :class="{ on: viewport === 'desktop' }" @click="viewport = 'desktop'">🖥 桌面</button>
            <button type="button" :class="{ on: viewport === 'tablet' }" @click="viewport = 'tablet'">▭ 平板</button>
            <button type="button" :class="{ on: viewport === 'mobile' }" @click="viewport = 'mobile'">▯ 手机</button>
          </div>
          <span class="grow" />
          <a class="pv-lnk" href="/" target="_blank" rel="noopener">新窗口打开 ↗</a>
          <button class="pv-lnk" type="button" @click="reloadFrame">刷新</button>
        </div>
        <div class="pv-stage">
          <iframe
            :key="frameKey"
            ref="frameEl"
            class="pv-frame"
            :style="{ width: frameWidth }"
            src="/"
            title="站点实时预览"
            @load="onFrameLoad"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style>
/* ===== 工坊通用样式（中性配色，不影响站点主题） ===== */
.wk {
  --wkb: #12131a;
  --wks: #1c1e28;
  --wkl: #2c2f3d;
  --wkt: #e8e9f0;
  --wkm: #9aa0b5;
  --wkp: #8b7cff;
  --wkd: #ff6b81;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--wkb);
  color: var(--wkt);
  font-family: var(--font-body, system-ui, sans-serif);
  font-size: 13px;
}
.wk-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 10px 20px;
  background: rgba(18, 19, 26, 0.96);
  border-bottom: 1px solid var(--wkl);
}
.wk-brand { display: flex; align-items: center; gap: 10px; }
.wk-brand strong { font-size: 15px; }
.wk-brand .mark { font-size: 16px; }
.wk-sitename {
  color: var(--wkm);
  font-weight: 400;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wk-dot { width: 8px; height: 8px; border-radius: 50%; background: #57d99a; flex: 0 0 auto; }
.wk-dot.dirty { background: #ffb454; }
.wk-saved { color: var(--wkm); font-size: 12px; }
.wk-bar-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.wk-pages { display: flex; gap: 4px; }
.wk-page {
  padding: 6px 10px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--wkt);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.wk-page:hover { background: var(--wks); color: var(--wkp); }
.wk-page.on { background: var(--wks); color: var(--wkp); }
.wk-sep { width: 1px; height: 20px; background: var(--wkl); margin-inline: 4px; }
.wk-flashbar {
  margin: 0;
  padding: 8px 24px;
  background: #22303c;
  color: #9fe8ff;
  font-size: 12px;
  border-bottom: 1px solid var(--wkl);
  flex: 0 0 auto;
}
.wk-flash-enter-active, .wk-flash-leave-active { transition: opacity 200ms; }
.wk-flash-enter-from, .wk-flash-leave-to { opacity: 0; }

/* ===== 分屏：左编辑（可拖宽） + 右 iframe 实时预览 ===== */
.wk-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: var(--editor-w, 480px) 6px 1fr;
}
.wk-editor {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  border-right: 1px solid var(--wkl);
  background: rgba(28, 30, 40, 0.35);
}
.wk-tabs {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--wkl);
}
.wk-tab {
  padding: 7px 11px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--wkm);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.wk-tab:hover { background: var(--wks); color: var(--wkt); }
.wk-tab.on { background: var(--wks); color: var(--wkp); }
.wk-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 18px 60px; }

.wk-divider { cursor: col-resize; background: transparent; transition: background 120ms ease; }
.wk-divider:hover { background: color-mix(in srgb, var(--wkp) 45%, transparent); }

.wk-preview { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.pv-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 14px;
  border-bottom: 1px solid var(--wkl);
}
.vps { display: flex; gap: 6px; }
.vps button,
.pv-lnk {
  padding: 5px 11px;
  font: inherit;
  font-size: 12px;
  border: 1px solid var(--wkl);
  border-radius: 7px;
  background: none;
  color: var(--wkm);
  cursor: pointer;
  text-decoration: none;
}
.vps button.on { color: var(--wkt); border-color: var(--wkp); }
.pv-lnk:hover { color: var(--wkt); border-color: var(--wkp); }
.grow { flex: 1; }
.pv-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  justify-content: safe center;
  padding: 12px;
  overflow: auto;
  background: repeating-conic-gradient(#14171d 0% 25%, #101318 0% 50%) 0 0 / 22px 22px;
}
.pv-frame {
  height: 100%;
  border: 1px solid var(--wkl);
  border-radius: 10px;
  background: #000;
  flex: 0 0 auto;
}
.wk-panel-body { display: grid; gap: 12px; align-content: start; }
.wk-h3 { margin: 14px 0 2px; font-size: 14px; color: var(--wkt); border-bottom: 1px solid var(--wkl); padding-bottom: 6px; }
.wk-hint { color: var(--wkm); font-size: 12px; }
.wk-error { color: var(--wkd); font-size: 12px; font-weight: 600; }
.wk-row { display: flex; align-items: flex-start; gap: 8px; }
.wk-row > .wk-i18n { flex: 1; }
.wk-key { flex: 0 0 62px; color: var(--wkm); font-size: 12px; line-height: 32px; }
.wk-add-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.wk-head-actions { display: flex; gap: 6px; align-items: center; }
.wk-input {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  border: 1px solid var(--wkl);
  border-radius: 8px;
  background: var(--wks);
  color: var(--wkt);
  font: inherit;
  line-height: 1.5;
}
.wk-input:focus { outline: none; border-color: var(--wkp); }
.wk-input.narrow { flex: 0 0 auto; width: auto; min-width: 110px; }
.wk-json { font-family: Consolas, monospace; font-size: 12px; white-space: pre; }
.wk-i18n { display: grid; grid-template-columns: 26px 1fr 26px 1fr; gap: 6px; align-items: center; }
.wk-lang { color: var(--wkm); font-size: 11px; font-weight: 700; text-transform: uppercase; }
.wk-card {
  border: 1px solid var(--wkl);
  border-radius: 10px;
  padding: 12px;
  display: grid;
  gap: 10px;
  background: rgba(28, 30, 40, 0.5);
}
.wk-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--wkm); font-size: 12px; font-weight: 700; }
.wk-card-head .wk-i18n { flex: 1; }
.wk-btn {
  padding: 8px 14px;
  border: 1px solid var(--wkl);
  border-radius: 8px;
  background: var(--wks);
  color: var(--wkt);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.wk-btn:hover { border-color: var(--wkp); }
.wk-btn.primary { background: var(--wkp); border-color: var(--wkp); color: #fff; }
.wk-btn.danger { color: var(--wkd); border-color: color-mix(in srgb, var(--wkd) 45%, transparent); }
.wk-btn.danger:hover { background: color-mix(in srgb, var(--wkd) 18%, transparent); border-color: var(--wkd); }
.wk-btn.sm { padding: 4px 10px; font-size: 12px; }
.wk-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.wk-save-note { margin-top: 26px; color: var(--wkm); font-size: 12px; border-top: 1px dashed var(--wkl); padding-top: 12px; }
.wk-save-note code { color: #9fe8ff; }
@media (max-width: 900px) {
  .wk-body { grid-template-columns: 1fr; grid-template-rows: minmax(0, 45%) minmax(0, 55%); }
  .wk-divider { display: none; }
  .wk-preview { border-top: 1px solid var(--wkl); }
}
</style>
