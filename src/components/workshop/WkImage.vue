<script setup>
/* 工坊基础组件：图片字段（缩略图预览 + 本地上传入库 + 图库点选 + 双语 alt
   + 显示调整：不透明度/位置/缩放/偏移，直接 mutate 传入的响应式对象，
   对应渲染端 ConfigImage 的 --img-* CSS 变量体系）
   上传管线：SVG/GIF/≤400KB 原样，其余位图 canvas 压缩（最长边 1920、q0.85）；
   dev 端点（studio/server.mjs /api/upload）可用时入库 public/assets/images/ 填路径，
   不可用时回退 dataURL 内嵌 content.json */
import { ref, computed } from 'vue'
import { resolveSrc } from '../../utils/image'
import WkI18n from './WkI18n.vue'

const props = defineProps({ img: { type: Object, default: null } })
const fileEl = ref(null)
const sizeNote = ref('')

/* 图库：列出 public/assets/images/ 已入库图片，点选即填路径 */
const lib = ref([])
const showLib = ref(false)
async function toggleLib() {
  showLib.value = !showLib.value
  if (!showLib.value) return
  try {
    const r = await fetch('/api/images')
    const d = await r.json()
    lib.value = d.images || []
  } catch {
    lib.value = []
  }
}

const previewSrc = computed(() => resolveSrc(props.img?.src || ''))
const tooBig = computed(() => String(props.img?.src || '').startsWith('data:') && props.img.src.length > 2_000_000)

/* 数值/枚举绑定辅助：未设置时回落默认值，拖动即写入（写入后始终显示实际值） */
const numOf = (k, d) => (typeof props.img?.[k] === 'number' ? props.img[k] : d)
const setNum = (k, e) => (props.img[k] = +e.target.value)
const posOptions = ['center', 'top', 'bottom', 'left', 'right']
const setPos = (e) => (props.img.objectPosition = e.target.value)
const ADJ_KEYS = ['opacity', 'objectPosition', 'scale', 'offsetX', 'offsetY', 'position']
const resetAdj = () => ADJ_KEYS.forEach((k) => delete props.img[k])

/* 本地上传：压缩后优先经 /api/upload 入库（src 填路径，不撑大 content.json）；
   端点不可用时回退 dataURL 直存 */
async function onFile(e) {
  const file = e.target.files?.[0]
  e.target.value = '' /* 清空以允许重复选择同一文件 */
  if (!file || !file.type.startsWith('image/')) return
  sizeNote.value = '读取中…'
  try {
    const raw = await new Promise((ok, err) => {
      const r = new FileReader()
      r.onload = () => ok(r.result)
      r.onerror = err
      r.readAsDataURL(file)
    })
    const passthrough = /^(image\/svg|image\/gif)/.test(file.type) || file.size <= 409_600
    const out = passthrough ? raw : await compress(raw, file.type)
    const kb = Math.round(((out.length - out.indexOf(',') - 1) * 0.75) / 1024)
    try {
      const r = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, data: out })
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      props.img.src = d.path
      sizeNote.value = `已入库 ${d.path} · ${Math.max(1, Math.round(d.size / 1024))} KB${out !== raw ? '（已压缩）' : ''}`
    } catch {
      props.img.src = out
      sizeNote.value = `已内嵌 dataURL · 约 ${kb} KB（本地端点不可用）`
    }
  } catch {
    sizeNote.value = '读取失败，请重试'
  }
}
function compress(dataUrl, type) {
  return new Promise((ok, no) => {
    const im = new Image()
    im.onload = () => {
      const MAX = 1920
      const k = Math.min(1, MAX / Math.max(im.width, im.height))
      const cv = document.createElement('canvas')
      cv.width = Math.max(1, Math.round(im.width * k))
      cv.height = Math.max(1, Math.round(im.height * k))
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height)
      const fmt = type === 'image/png' ? 'image/png' : type === 'image/webp' ? 'image/webp' : 'image/jpeg'
      try {
        ok(cv.toDataURL(fmt, 0.85))
      } catch {
        ok(dataUrl)
      }
    }
    im.onerror = no
    im.src = dataUrl
  })
}
</script>

<template>
  <div v-if="img" class="wk-img">
    <div class="wk-img-top">
      <img class="wk-thumb" :src="previewSrc" alt="" loading="lazy" />
      <div class="wk-img-main">
        <div class="wk-row">
          <span class="wk-key">src</span>
          <input v-model="img.src" class="wk-input" placeholder="/assets/images/xxx.svg 或 https://…" />
        </div>
        <div class="wk-row">
          <button class="wk-btn sm" type="button" @click="fileEl.click()">⬆ 上传本地图片</button>
          <button class="wk-btn sm" type="button" @click="toggleLib">🖼 图库</button>
          <span v-if="sizeNote" class="wk-size">{{ sizeNote }}</span>
          <input ref="fileEl" class="wk-file" type="file" accept="image/*" hidden @change="onFile" />
        </div>
        <div v-if="showLib" class="wk-lib">
          <button
            v-for="im in lib"
            :key="im.path"
            type="button"
            class="wk-lib-item"
            :title="`${im.path}（${Math.max(1, Math.round(im.size / 1024))}KB）`"
            @click="img.src = im.path; showLib = false"
          >
            <img :src="im.path" alt="" loading="lazy" />
          </button>
          <p v-if="!lib.length" class="wk-size">图库为空（public/assets/images/），先上传图片</p>
        </div>
      </div>
    </div>

    <details class="wk-adj">
      <summary>调整显示（不透明度 / 位置 / 缩放 / 偏移）</summary>
      <label class="wk-adj-row">不透明度
        <input type="range" min="0" max="1" step="0.05" :value="numOf('opacity', 1)" @input="setNum('opacity', $event)" />
        <b>{{ numOf('opacity', 1) }}</b>
      </label>
      <label class="wk-adj-row">位置
        <select class="wk-input narrow" :value="img.objectPosition || 'center'" @change="setPos">
          <option v-for="p in posOptions" :key="p" :value="p">{{ p }}</option>
        </select>
      </label>
      <label class="wk-adj-row">缩放
        <input type="range" min="1" max="2" step="0.05" :value="numOf('scale', 1)" @input="setNum('scale', $event)" />
        <b>{{ numOf('scale', 1) }}</b>
      </label>
      <label class="wk-adj-row">偏移 X
        <input type="range" min="-200" max="200" step="5" :value="numOf('offsetX', 0)" @input="setNum('offsetX', $event)" />
        <b>{{ numOf('offsetX', 0) }}px</b>
      </label>
      <label class="wk-adj-row">偏移 Y
        <input type="range" min="-200" max="200" step="5" :value="numOf('offsetY', 0)" @input="setNum('offsetY', $event)" />
        <b>{{ numOf('offsetY', 0) }}px</b>
      </label>
      <button class="wk-btn sm" type="button" @click="resetAdj">恢复默认显示</button>
    </details>

    <div v-if="'alt' in img" class="wk-row">
      <span class="wk-key">alt</span>
      <WkI18n :field="img.alt" />
    </div>
    <p v-if="tooBig" class="wk-size warn">
      ⚠ 嵌入图片较大（约 {{ Math.round((img.src.length * 0.75) / 1048576 * 10) / 10 }} MB），会显著增大 content.json
      并拖慢首屏，正式部署前建议压缩后改存 public/assets 并填写路径。
    </p>
  </div>
</template>

<style scoped>
.wk-img-top { display: flex; gap: 10px; align-items: stretch; }
.wk-thumb { width: 64px; height: 64px; flex: 0 0 auto; object-fit: cover; border-radius: 8px; border: 1px solid var(--wkl); background: #0d0e14; }
.wk-img-main { flex: 1; min-width: 0; display: grid; gap: 6px; align-content: center; }
.wk-size { font-size: 11px; color: var(--wkm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wk-lib { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 6px; border: 1px dashed var(--wkl); border-radius: 8px; padding: 8px; max-height: 200px; overflow: auto; }
.wk-lib-item { padding: 0; border: 1px solid var(--wkl); border-radius: 6px; overflow: hidden; background: none; cursor: pointer; }
.wk-lib-item:hover { border-color: var(--wkp); }
.wk-lib-item img { display: block; width: 100%; height: 42px; object-fit: cover; }
.wk-size.warn { color: #ffb454; white-space: normal; }
.wk-adj { margin: 8px 0 2px; border: 1px dashed var(--wkl); border-radius: 8px; padding: 6px 10px 8px; }
.wk-adj summary { cursor: pointer; color: var(--wkm); font-size: 12px; user-select: none; }
.wk-adj-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--wkm); margin-top: 8px; }
.wk-adj-row input[type='range'] { flex: 1; accent-color: var(--wkp); }
.wk-adj-row b { min-width: 48px; text-align: right; color: var(--wkt); font-weight: 500; font-variant-numeric: tabular-nums; }
.wk-adj > button { margin-top: 10px; }
</style>
