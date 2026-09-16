import { reactive } from 'vue'

/* 五套主题预设（导航栏切换器数据源） */
export const PRESETS = [
  { id: 'aurora', label: { en: 'Aurora', zh: '极光霓虹' }, colors: ['#8b7cff', '#4cc9f0'] },
  { id: 'cyber', label: { en: 'Cyber', zh: '赛博网格' }, colors: ['#00e5ff', '#5cffd6'] },
  { id: 'gold', label: { en: 'Gold', zh: '暗金质感' }, colors: ['#d4af37', '#f0d68a'] },
  { id: 'paper', label: { en: 'Paper', zh: '极简纸白' }, colors: ['#191a1e', '#c8452c'] },
  { id: 'sunset', label: { en: 'Sunset', zh: '落日渐变' }, colors: ['#ff8a5c', '#ff5c8a'] }
]
const PRESET_IDS = PRESETS.map((p) => p.id)

export const state = reactive({
  content: null,
  lang: null,
  preset: null,
  status: 'loading', // loading | ready | error
  error: null
})

let started = false

export async function load() {
  if (started) return
  started = true
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}content/content.json`, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    applyContent(await res.json())
    /* 内容工坊实时预览握手：iframe 内加载完成后向工坊"报到"，
       工坊收到 wk:hello 会立即推送当前编辑内容（防 fetch 完成覆盖编辑态的竞态） */
    if (import.meta.env.DEV && window.parent !== window) {
      window.parent.postMessage({ type: 'wk:hello' }, '*')
    }
  } catch (e) {
    state.error = e
    state.status = 'error'
  }
}

export function applyContent(json) {
  state.content = json
  const langs = json.site?.languages || ['zh']
  const saved = localStorage.getItem('site-lang')
  state.lang = saved && langs.includes(saved) ? saved : json.site?.defaultLang || langs[0] || 'zh'
  const savedPreset = localStorage.getItem('site-preset')
  state.preset =
    savedPreset && PRESET_IDS.includes(savedPreset) ? savedPreset : json.theme?.preset || 'aurora'
  state.status = 'ready'
}

/* 取值：i18n 对象 → 当前语言（回退 defaultLang → en → 第一个值）；原始值原样返回 */
export function t(field) {
  if (field == null) return ''
  if (typeof field !== 'object') return String(field)
  const dl = state.content?.site?.defaultLang
  return field[state.lang] ?? (dl ? field[dl] : undefined) ?? field.en ?? Object.values(field)[0] ?? ''
}

export function setLang(lang) {
  state.lang = lang
  localStorage.setItem('site-lang', lang)
}

export function setPreset(p) {
  if (!PRESET_IDS.includes(p)) return
  state.preset = p
  localStorage.setItem('site-preset', p)
}

/* 内容工坊实时预览：接收工坊推送的消息（仅 dev；独立访问站点时无消息往来，零副作用）
   - wk:content 整包替换内容；与 applyContent 的差异：不重置已初始化的语言/主题（由工坊工具条驱动） */
if (import.meta.env.DEV) {
  window.addEventListener('message', (e) => {
    const d = e.data
    if (!d || typeof d !== 'object') return
    if (d.type === 'wk:content' && d.content?.site) {
      state.content = d.content
      const langs = d.content.site?.languages || ['zh']
      if (!state.lang || !langs.includes(state.lang)) {
        state.lang = d.content.site?.defaultLang || langs[0] || 'zh'
      }
      if (state.status !== 'ready') {
        const savedPreset = localStorage.getItem('site-preset')
        state.preset =
          savedPreset && PRESET_IDS.includes(savedPreset)
            ? savedPreset
            : d.content.theme?.preset || 'aurora'
        state.status = 'ready'
        state.error = null
      }
    }
    if (d.type === 'wk:lang' && d.lang) setLang(d.lang)
    if (d.type === 'wk:preset' && d.preset) setPreset(d.preset)
  })
}

export function useContent() {
  return { state, t, setLang, setPreset, load }
}