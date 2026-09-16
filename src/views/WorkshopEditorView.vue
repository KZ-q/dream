<script setup>
/* ============================================================
 * 孔诸祺作品站 · 可视化修改工坊（仅 dev 模式可访问 /workshop/edit）
 * 左：表单（文字 / 图片 / 视频外链 / 上传）　右：iframe 实时预览
 * 保存 → PUT /api/workshop/content　还原 → POST /api/workshop/restore
 * 实时预览通过 postMessage({type:'wk:content'}) 推送到作品站页面
 * ============================================================ */
import { ref, reactive, computed, onMounted, watch } from 'vue'
/* GIF 编码器（纯前端：视频/连续图片 → 动图） */
import { GIFEncoder, quantize, applyPalette } from 'gifenc'

const BASE = import.meta.env.BASE_URL
const previewSrc = `${BASE}workshop/index.html?nowelcome=1`
const previewRef = ref(null)
/* 轮播图字段：数组 ↔ 文本框（每行一个路径）互转 */
const heroSlidesText = computed({
  get: () => (form.hero.slides || []).join('\n'),
  set: (v) => { form.hero.slides = v.split('\n').map((s) => s.trim()).filter(Boolean) }
})
const fileInput = ref(null)
const form = reactive(emptyContent())
const msg = ref({ text: '', type: '' })
const saving = ref(false)
let pendingSetter = null
let msgTimer = null
let postTimer = null

function emptyContent() {
  return {
    hero: { badge: '', title1: '', title2: '', subtitle: '', bg: '', slides: [] },
    topics: [],
    about: { p1: '', p2: '' },
    story: { quote: '', by: '', bg: '' },
    works: [],
    movie: { title: '', desc: '', bilibili: '', poster: '' },
    contact: { email: '', douyin: '', wechat: '' },
    backgrounds: {},
    motion: [],
    tracks: []
  }
}

function status(text, isErr = false) {
  msg.value = { text, type: isErr ? 'err' : 'ok' }
  clearTimeout(msgTimer)
  msgTimer = setTimeout(() => (msg.value = { text: '', type: '' }), 2800)
}

/* ---------- 载入当前内容 ---------- */
async function load() {
  try {
    const res = await fetch('/api/workshop/content')
    if (!res.ok) throw new Error('读取失败')
    const d = await res.json()
    Object.assign(form, d.content)
    fillProfileDraft()
    status('已载入当前内容')
  } catch (e) {
    status('载入失败：' + e.message, true)
  }
}

/* ---------- ⑩ 个人简介独立编辑板块（自带保存/取消，保存即写回文件） ---------- */
const BIO_MAX = 600                                  /* 简介字数上限（展示页两栏布局，600 字内观感最佳） */
const profileDraft = reactive({ name: '', role: '', motto: '', bioText: '' })
const profileSaving = ref(false)
/* 字数（按字符计，emoji 不误算）与分段预览 */
const bioLen = computed(() => [...profileDraft.bioText].length)
const bioParas = computed(() => profileDraft.bioText.split('\n').map((s) => s.trim()).filter(Boolean))
/* 草稿 ← 当前已保存的简介（载入 / 取消 / 还原默认后同步） */
function fillProfileDraft() {
  const p = form.profile || {}
  profileDraft.name = p.name || ''
  profileDraft.role = p.role || ''
  profileDraft.motto = p.motto || ''
  profileDraft.bioText = (p.bio || []).join('\n')
  fillTimelineDraft()          /* 载入 / 还原默认时，经历速览草稿同步刷新 */
}
function resetProfileDraft() {
  fillProfileDraft()
  status('已还原为当前保存的简介')
}async function saveProfile() {
  const len = bioLen.value
  if (!bioParas.value.length) {
    status('简介不能为空，至少写一段吧', true)
    return
  }
  if (len > BIO_MAX) {
    status(`简介超出 ${len - BIO_MAX} 字（上限 ${BIO_MAX} 字），请精简后再保存`, true)
    return
  }
  if (!form.profile) form.profile = {}
  form.profile.name = profileDraft.name.trim()
  form.profile.role = profileDraft.role.trim()
  form.profile.motto = profileDraft.motto.trim()
  form.profile.bio = bioParas.value
  profileSaving.value = true
  const ok = await save()                            /* 复用全局保存通道（PUT 写回 content.json） */
  profileSaving.value = false
  if (ok) status('✓ 简介已保存并生效（右侧预览已同步）')
}

/* ---------- ⑬ 经历速览（profile.timeline）独立编辑：草稿 + 校验 + 保存 / 取消 ---------- */
const TL_LIMITS = { period: 20, title: 40, org: 60, desc: 200 }
const TL_LABEL = { period: '时间', title: '名称 / 职位', org: '机构', desc: '描述' }
const TL_MAX_ITEMS = 12
const TL_BAD = /[<>]/                 /* < > 会破坏页面结构（也是注入面），编辑期直接拦下 */
const timelineDraft = ref([])         /* 深拷贝草稿：取消时整体丢弃，不动原数据 */
const timelineSaving = ref(false)
const tlCount = computed(() => timelineDraft.value.length)
function cnt(s) { return [...String(s == null ? '' : s)].length }
/* 清理控制字符 + 首尾空白（< > 交给校验报错，让用户自己看见问题） */
function sanTl(s) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, '').trim()
}
function fillTimelineDraft() {
  const t = (form.profile && form.profile.timeline) || []
  timelineDraft.value = t.map((r) => ({
    period: r.period || '', title: r.title || '', org: r.org || '', desc: r.desc || ''
  }))
}
function resetTimelineDraft() {
  fillTimelineDraft()
  status('已还原为当前保存的经历速览')
}
function addTimelineRow() {
  if (timelineDraft.value.length >= TL_MAX_ITEMS) {
    status(`最多 ${TL_MAX_ITEMS} 条经历，够用啦`, true)
    return
  }
  timelineDraft.value.push({ period: '', title: '', org: '', desc: '' })
}
function removeTimelineRow(i) {
  timelineDraft.value.splice(i, 1)
}
function moveTimelineRow(i, dir) {
  const j = i + dir
  if (j < 0 || j >= timelineDraft.value.length) return
  const [row] = timelineDraft.value.splice(i, 1)
  timelineDraft.value.splice(j, 0, row)
}
/* 校验：非法字符 → 空值 → 长度，逐条给明确提示 */
function validateTimeline() {
  for (const r of timelineDraft.value) {
    for (const k of ['period', 'title', 'org', 'desc']) {
      if (TL_BAD.test(String(r[k] || ''))) {
        return { ok: false, msg: `「${TL_LABEL[k]}」不能包含 < > 等特殊字符（会破坏页面结构，已拦截）`, rows: [] }
      }
    }
  }
  const rows = timelineDraft.value
    .map((r) => ({ period: sanTl(r.period), title: sanTl(r.title), org: sanTl(r.org), desc: sanTl(r.desc) }))
    .filter((r) => r.period || r.title || r.org || r.desc)      /* 整行全空 → 自动忽略 */
  if (!rows.length) return { ok: false, msg: '经历速览不能为空：至少保留一条（时间 + 名称）', rows: [] }
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const no = `第 ${i + 1} 条经历`
    if (!r.period) return { ok: false, msg: `${no}：「时间」不能为空（如 2026 或 2021—2025）`, rows: [] }
    if (!r.title) return { ok: false, msg: `${no}：「名称 / 职位」不能为空`, rows: [] }
    for (const k of ['period', 'title', 'org', 'desc']) {
      if (cnt(r[k]) > TL_LIMITS[k]) {
        return { ok: false, msg: `${no}：「${TL_LABEL[k]}」${cnt(r[k])} 字，超过 ${TL_LIMITS[k]} 字上限，请精简`, rows: [] }
      }
    }
  }
  return { ok: true, msg: '', rows }
}
async function saveTimeline() {
  const v = validateTimeline()
  if (!v.ok) { status('✕ ' + v.msg, true); return }
  if (!form.profile) form.profile = {}
  form.profile.timeline = v.rows                 /* 写入表单 → 预览 iframe 立即刷新 */
  timelineSaving.value = true
  const ok = await save()                        /* 复用全局保存通道（PUT 写回 content.json） */
  timelineSaving.value = false
  if (ok) {
    fillTimelineDraft()                          /* 回填，让草稿与已保存内容逐字一致 */
    status('✓ 经历速览已保存并生效（右侧预览已同步）')
  }
}

/* ---------- 实时预览（postMessage → 作品站 main.js） ---------- */
function postNow() {
  const f = previewRef.value
  if (f && f.contentWindow) {
    f.contentWindow.postMessage({ type: 'wk:content', content: JSON.parse(JSON.stringify(form)) }, '*')
  }
}
function schedulePost() {
  clearTimeout(postTimer)
  postTimer = setTimeout(postNow, 250)
}
watch(form, schedulePost, { deep: true })
function onPreviewLoad() {
  postNow()
}

/* ---------- 保存 / 还原 ---------- */
async function save() {
  saving.value = true
  try {
    /* 清理空背景配置（只展开过卡片但没选类型的条目不写入文件） */
    const payload = JSON.parse(JSON.stringify(form))
    if (payload.backgrounds) {
      Object.keys(payload.backgrounds).forEach((k) => {
        if (!payload.backgrounds[k] || !payload.backgrounds[k].type) delete payload.backgrounds[k]
      })
      if (!Object.keys(payload.backgrounds).length) delete payload.backgrounds
    }
    const res = await fetch('/api/workshop/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: payload })
    })
    const d = await res.json()
    if (!res.ok) throw new Error(d.error || '保存失败')
    status(d.backedUp ? '已保存（已自动备份上一版）' : '已保存')
    return true
  } catch (e) {
    status('保存失败：' + e.message, true)
    return false
  } finally {
    saving.value = false
  }
}
async function restore() {
  if (!confirm('确定还原为默认内容？当前未保存的修改会丢失。')) return
  try {
    const res = await fetch('/api/workshop/restore', { method: 'POST' })
    if (!res.ok) throw new Error('还原失败')
    await load()
    postNow()
    status('已还原为默认内容')
  } catch (e) {
    status('还原失败：' + e.message, true)
  }
}
function refreshPreview() {
  const f = previewRef.value
  if (f) f.contentWindow.location.reload()
}
function openLive() {
  window.open(`${BASE}workshop/index.html`, '_blank')
}

/* ---------- 图片 / 视频上传 ---------- */
function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}
function pickFile(kind, setter) {
  pendingSetter = { kind, setter }
  if (fileInput.value) {
    fileInput.value.accept = kind === 'video' ? 'video/*' : 'image/*'
    fileInput.value.multiple = false
    fileInput.value.click()
  }
}
function pickFiles(accept, kind, handler) {
  pendingSetter = { kind, setter: handler }
  if (fileInput.value) {
    fileInput.value.accept = accept
    fileInput.value.multiple = true
    fileInput.value.click()
  }
}
async function onFilePicked(e) {
  const files = [...(e.target.files || [])]
  e.target.value = ''
  if (!files.length || !pendingSetter) return
  const { kind, setter } = pendingSetter
  pendingSetter = null
  /* 批量上传队列（⑪） */
  if (kind === 'batch') { addFiles(files); return }
  /* 音乐作品音频（⑭） */
  if (kind === 'music') { addMusicFiles(files); return }
  /* GIF 素材（⑫） */
  if (kind === 'gif-video') { pickGifVideo(files); return }
  if (kind === 'gif-images') { pickGifImages(files); return }
  const f = files[0]
  /* 背景视频：上传前先过体检——大小硬限制 24MB，时长软建议 10–30 秒 */
  let warn = ''
  if (kind === 'bgvideo') {
    if (f.size > 24 * 1024 * 1024) {
      status('视频超过 24MB，已拦截：背景视频请压缩后再传（建议 ≤10MB）', true)
      return
    }
    const dur = await videoDuration(f)
    if (dur && dur > 35) warn = `（提示：时长 ${Math.round(dur)}s，建议 10–30 秒）`
    if (f.size > 10 * 1024 * 1024) warn += '（提示：超过 10MB，访客加载会偏慢）'
  }
  status('上传中…')
  try {
    const data = await readAsDataURL(f)
    const res = await fetch('/api/workshop/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: f.name, data, kind: kind === 'bgvideo' ? 'video' : kind })
    })
    const d = await res.json()
    if (!res.ok) throw new Error(d.error || '上传失败')
    setter(d.path)
    status('上传成功：' + d.path + warn, !!warn)
  } catch (err) {
    status('上传失败：' + err.message, true)
  }
}

/* ---------- 数组增删 ---------- */
function addTopic() {
  form.topics.push({ date: '', title: '' })
}
function removeTopic(i) {
  form.topics.splice(i, 1)
}
function addWork() {
  form.works.push({
    no: String(form.works.length + 1).padStart(2, '0'),
    title: '',
    desc: '',
    tags: [],
    cover: '',
    bilibili: '',
    local: ''
  })
}
function removeWork(i) {
  form.works.splice(i, 1)
}

/* ---------- 区块背景（每个版块独立的图片 / 视频 / 纯色 / 渐变背景） ---------- */
/* 与作品站 main.js 的 BG_TARGETS 一一对应 */
const BG_SECTIONS = [
  { id: 'home', name: '主视觉 Hero', hint: '设置后会接管首屏轮播图；移除即恢复轮播' },
  { id: 'topics', name: '创作手记', hint: '' },
  { id: 'about', name: '关于我', hint: '' },
  { id: 'storyBand', name: '引言带', hint: '设置后会接管引言底图；移除即恢复' },
  { id: 'action', name: '我能做什么', hint: '' },
  { id: 'works', name: '精选作品', hint: '' },
  { id: 'movie', name: '最新影片', hint: '' },
  { id: 'profile', name: '个人简介', hint: '' },
  { id: 'contact', name: '联系方式', hint: '' },
  { id: 'footer', name: '页脚', hint: '背景垫在 ASCII 双手之下，双手不受影响' }
]
const openBg = reactive({})                       /* 各版块卡片展开状态 */
function toggleBg(id) { openBg[id] = !openBg[id] }
function bgDefaults() {
  return { type: '', src: '', poster: '', color: '#101215', from: '#0b0c0e', to: '#1c1f24', angle: 160, overlayOn: true, overlayColor: '#0b0c0e', overlay: 45 }
}
/* 展开卡片时才创建该版块的配置草稿（不展开不污染数据） */
function bgDraft(id) {
  if (!form.backgrounds) form.backgrounds = {}
  if (!form.backgrounds[id]) form.backgrounds[id] = bgDefaults()
  return form.backgrounds[id]
}
function bgStateText(id) {
  const t = form.backgrounds?.[id]?.type
  return t ? ({ image: '图片', video: '视频', color: '纯色', gradient: '渐变' })[t] : '默认'
}
function removeBg(id) {
  if (form.backgrounds?.[id]) form.backgrounds[id] = bgDefaults()
}
/* 视频时长探测（不上传，本地读元数据） */
function videoDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration || 0) }
    v.onerror = () => { URL.revokeObjectURL(url); resolve(0) }
    v.src = url
  })
}
/* 背景视频专用选择器：先校验大小 / 时长，再走通用上传 */
function pickBgVideo(setter) {
  pickFiles('video/*', 'bgvideo', setter)
}

/* ============================================================
   ⑪ 碎片实验作品 · 批量上传 + 自动压缩
   ============================================================ */
const VIDEO_EXT = ['mp4', 'webm', 'mov', 'm4v']
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'svg']
const MAX_VIDEO_RAW = 200 * 1024 * 1024      /* 送去压缩的原始视频上限 */
const MAX_VIDEO_UPLOAD = 24 * 1024 * 1024    /* 直传服务器的视频上限（body 64MB / base64 膨胀后的安全线） */
const MAX_IMAGE = 5 * 1024 * 1024            /* 图片上限（与服务器一致） */
const COMPRESS_MAX_SIDE = 1280               /* 压缩后最长边 */
const COMPRESS_BITRATE = 1_500_000           /* 压缩目标码率 ~1.5Mbps */

let uid = 0
const uploadQueue = reactive([])
const autoCompress = ref(true)
const dragOver = ref(false)
const queueBusy = ref(false)

function fmtSize(n) {
  if (!n && n !== 0) return '—'
  return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1024).toFixed(0) + ' KB'
}
function extOf(name) {
  const p = String(name || '').split('.')
  return p.length > 1 ? p.pop().toLowerCase() : ''
}
function kindOf(name) {
  const e = extOf(name)
  if (VIDEO_EXT.includes(e)) return 'video'
  if (IMAGE_EXT.includes(e)) return 'image'
  return ''
}
/* 状态文案（等待中 / 处理中 / 已完成 / 失败） */
const STATUS_TEXT = { wait: '等待中', compress: '压缩中', upload: '上传中', done: '已完成', fail: '失败' }

/* ---------- 压缩：canvas 抽帧 → MediaRecorder 重编码（VP9/webm，含音轨） ---------- */
function compressVideo(file, { maxSide = COMPRESS_MAX_SIDE, bitrate = COMPRESS_BITRATE } = {}, onProgress = () => {}) {
  return new Promise(async (resolve, reject) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.src = url
    v.playsInline = true
    v.preload = 'auto'
    let ac = null
    const cleanup = () => {
      try { v.pause() } catch (_) {}
      URL.revokeObjectURL(url)
      try { ac && ac.close() } catch (_) {}
    }
    v.onerror = () => { cleanup(); reject(new Error('视频无法解析（编码不受支持？）')) }
    await new Promise((res, rej) => {
      v.onloadedmetadata = res
      setTimeout(() => rej(new Error('读取视频元数据超时')), 15000)
    }).catch((e) => { cleanup(); reject(e) })
    if (!v.duration || !isFinite(v.duration)) { cleanup(); reject(new Error('视频时长无效')) }

    /* 等比缩放到最长边 maxSide，宽高取偶（编码器要求） */
    const scale = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight))
    const w = Math.max(2, Math.round((v.videoWidth * scale) / 2) * 2)
    const h = Math.max(2, Math.round((v.videoHeight * scale) / 2) * 2)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    const stream = canvas.captureStream(30)

    /* 音轨：元素音源只接录制器（不接扬声器）→ 无声重编码但保留声音 */
    let hasAudio = false
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      ac = new AC()
      const srcNode = ac.createMediaElementSource(v)
      const dest = ac.createMediaStreamDestination()
      srcNode.connect(dest)
      dest.stream.getAudioTracks().forEach((t) => { stream.addTrack(t); hasAudio = true })
    } catch (_) {
      v.muted = true                       /* 音频链路不可用时静音，避免外放 */
    }

    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || ''
    if (!mime) { cleanup(); reject(new Error('该浏览器不支持视频压缩（请用 Chrome / Edge）')) }
    let rec
    try {
      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate, audioBitsPerSecond: hasAudio ? 96000 : undefined })
    } catch (e) {
      cleanup(); reject(new Error('压缩器初始化失败：' + e.message))
      return
    }
    const chunks = []
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
    const finished = new Promise((res) => { rec.onstop = () => res(new Blob(chunks, { type: 'video/webm' })) })
    let raf = 0
    let stopped = false
    const stopAll = () => {
      if (stopped) return
      stopped = true
      cancelAnimationFrame(raf)
      try { v.pause() } catch (_) {}
      if (rec.state !== 'inactive') rec.stop()
    }
    const draw = () => {
      if (stopped) return
      if (!v.paused && !v.ended) {
        ctx.drawImage(v, 0, 0, w, h)
        onProgress(Math.min(99, Math.round((v.currentTime / v.duration) * 100)))
        raf = requestAnimationFrame(draw)
      }
    }
    v.onended = () => setTimeout(stopAll, 300)     /* 留一点尾巴，确保末尾帧写入 */
    try {
      await v.play()
    } catch (e) {
      cleanup(); reject(new Error('视频播放被拦截，压缩中止'))
      return
    }
    rec.start(1000)
    draw()
    const blob = await finished
    onProgress(100)
    cleanup()
    if (!blob.size) reject(new Error('压缩结果为空'))
    else resolve({ blob, w, h, hasAudio })
  })
}

/* ---------- 缩略图：图片用本体，视频抓第一帧 ---------- */
async function makeThumb(it) {
  try {
    if (it.kind === 'image') { it.thumb = await readAsDataURL(it.file); return }
    const url = URL.createObjectURL(it.file)
    const v = document.createElement('video')
    v.src = url
    v.muted = true
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = rej })
    v.currentTime = Math.min(0.4, (v.duration || 1) / 3)
    await new Promise((res) => { v.onseeked = res; setTimeout(res, 1200) })
    const scale = 180 / Math.max(v.videoWidth || 180, v.videoHeight || 180)
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round((v.videoWidth || 180) * scale))
    c.height = Math.max(1, Math.round((v.videoHeight || 180) * scale))
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height)
    it.thumb = c.toDataURL('image/jpeg', 0.72)
    URL.revokeObjectURL(url)
  } catch (_) { it.thumb = '' }
}

/* ---------- 批量加入队列：前置校验 → 缩略图 → 自动压缩 → 上传 ---------- */
function addFiles(fileList) {
  const files = [...(fileList || [])]
  if (!files.length) return
  files.forEach((f) => {
    const kind = kindOf(f.name)
    const it = reactive({
      id: ++uid, file: f, name: f.name, kind, size: f.size,
      status: 'wait', progress: 0, note: '', err: '', thumb: '',
      outBlob: null, outSize: 0, useCompressed: true, hasAudio: false,
      title: String(f.name).replace(/\.[^.]+$/, ''), desc: '', tags: ''
    })
    if (!kind) it.err = '格式不支持：图片支持 png / jpg / webp / gif，视频支持 mp4 / webm / mov / m4v'
    else if (kind === 'image' && f.size > MAX_IMAGE) it.err = `图片 ${fmtSize(f.size)} 超过 5MB，请先调整尺寸`
    else if (kind === 'video' && f.size > MAX_VIDEO_RAW) it.err = `视频 ${fmtSize(f.size)} 超过 200MB，请先剪辑裁短`
    if (it.err) it.status = 'fail'
    uploadQueue.push(it)
    if (!it.err) {
      makeThumb(it)
      processItem(it)
    }
  })
  status(`已加入 ${files.length} 个文件`)
}
function onDrop(e) {
  dragOver.value = false
  addFiles(e.dataTransfer && e.dataTransfer.files)
}
function pickBatch() {
  pickFiles('image/*,video/*', 'batch', () => {})
}

/* ---------- 单体流水线：压缩（可选）→ 上传 → 写入 motion ---------- */
async function processItem(it) {
  it.err = ''
  it.progress = 0
  try {
    let blob = it.file
    let name = it.name
    if (it.kind === 'video') {
      if (autoCompress.value && it.size > 900 * 1024) {
        it.status = 'compress'
        const res = await compressVideo(it.file, {}, (p) => { it.progress = p })
        it.outBlob = res.blob
        it.outSize = res.blob.size
        it.hasAudio = res.hasAudio
        const delta = it.size > 0 ? Math.round((1 - res.blob.size / it.size) * 100) : 0
        it.note = `压缩 ${fmtSize(it.size)} → ${fmtSize(res.blob.size)}（${delta >= 0 ? '↓' + delta + '%' : '↑' + Math.abs(delta) + '%'}）${res.hasAudio ? '' : ' · 无音轨'}`
        if (res.blob.size >= it.size) {
          it.useCompressed = false
          it.note += ' · 压缩无收益，已改用原片'
        } else {
          blob = res.blob
          name = it.name.replace(/\.[^.]+$/, '') + '.webm'
        }
      }
    }
    if (blob.size > MAX_VIDEO_UPLOAD) {
      throw new Error(`待上传文件 ${fmtSize(blob.size)} 超过 24MB，请缩短时长或降低分辨率`)
    }
    it.status = 'upload'
    it.progress = 0
    const data = await readAsDataURL(blob)
    const path = await uploadFile(name, data, it.kind)
    it.status = 'done'
    it.progress = 100
    bindToMotion(it, path)
  } catch (e) {
    it.status = 'fail'
    it.err = e.message || '处理失败，请重试'
  }
}
async function uploadFile(name, dataUrl, kind) {
  const res = await fetch('/api/workshop/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, data: dataUrl, kind })
  })
  const d = await res.json()
  if (!res.ok) throw new Error(d.error || '上传失败')
  return d.path
}
/* 上传成功 → 同步进「碎片实验作品」列表（同路径覆盖，避免重复条目） */
function bindToMotion(it, path) {
  if (!form.motion) form.motion = []
  const entry = {
    title: it.title || it.name,
    desc: it.desc || '碎片实验 · 随手一试的灵感切片',
    tags: it.tags ? it.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean) : [],
    src: path
  }
  const idx = form.motion.findIndex((m) => m.src === path)
  if (idx >= 0) form.motion[idx] = entry
  else form.motion.push(entry)
}
function retryItem(it) {
  it.status = 'wait'
  it.progress = 0
  processItem(it)
}
function removeItem(it) {
  const i = uploadQueue.indexOf(it)
  if (i >= 0) uploadQueue.splice(i, 1)
}
function clearDone() {
  for (let i = uploadQueue.length - 1; i >= 0; i--) {
    if (uploadQueue[i].status === 'done') uploadQueue.splice(i, 1)
  }
}
function removeMotion(i) {
  form.motion.splice(i, 1)
}
function moveMotion(i, dir) {
  const j = i + dir
  if (j < 0 || j >= form.motion.length) return
  const [row] = form.motion.splice(i, 1)
  form.motion.splice(j, 0, row)
}

/* ============================================================
   ⑭ AI 音乐创作：上传作品文件（音频）+ 基础信息 + 可选封面
   - 音频不做转码（浏览器里重编码音质损失大且慢）：只做格式 / 体积体检后入库
   - 入库目录 assets/audio/（曲目数据走 content.tracks —— 站点唯一会发声的来源）
   - 写入 form.tracks[]，站点「我能做什么 → AI 音乐创作」板块读取它渲染
   ============================================================ */
const AUD_ACCEPT = '.mp3,.wav,.m4a,.aac,.ogg,.flac,audio/*'
const AUD_EXT_RE = /\.(mp3|wav|m4a|aac|ogg|flac)$/i
const MAX_AUD_UPLOAD = 30 * 1024 * 1024
const musicQueue = ref([])
const musicDragOver = ref(false)
let musicSeq = 0

function pickMusicFiles() {
  pickFiles(AUD_ACCEPT, 'music', () => {})
}
function onMusicDrop(e) {
  musicDragOver.value = false
  addMusicFiles(e.dataTransfer && e.dataTransfer.files)
}
function addMusicFiles(files) {
  const list = [...(files || [])]
  if (!list.length) return
  list.forEach((f) => {
    const it = reactive({
      id: 'mu' + ++musicSeq,
      file: f,
      name: f.name,
      size: f.size,
      title: f.name.replace(/\.[^.]+$/, ''),
      desc: '',
      tags: '',
      status: 'wait',
      progress: 0,
      err: ''
    })
    /* 前置体检：格式白名单 + 体积上限（都给出可读的中文原因） */
    if (!AUD_EXT_RE.test(f.name)) {
      it.status = 'fail'
      it.err = '格式不支持：仅收 mp3 / wav / m4a / aac / ogg / flac'
    } else if (f.size > MAX_AUD_UPLOAD) {
      it.status = 'fail'
      it.err = `文件 ${fmtSize(f.size)} 超过 30MB，请先压缩音频（如导出 192kbps）`
    }
    musicQueue.value.push(it)
    if (it.status === 'wait') processMusicItem(it)
  })
  status(`已加入 ${list.length} 个音频文件`)
}
/* 读出音频时长并写进数据：站点首屏就能显示「3:00」，
   访客不必为了让页面显示时长而先下载音频头。Blob URL 读完立刻 revoke，不占内存。 */
function readAudioDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const a = new Audio()
    const done = (v) => { URL.revokeObjectURL(url); resolve(v) }
    a.addEventListener('loadedmetadata', () => {
      const d = a.duration
      done(d && isFinite(d) && d > 0 ? Math.round(d * 100) / 100 : null)
    }, { once: true })
    a.addEventListener('error', () => done(null), { once: true })
    a.preload = 'metadata'
    a.src = url
  })
}
async function processMusicItem(it) {
  it.err = ''
  it.progress = 0
  try {
    it.status = 'upload'
    /* 测不出时长（异常文件）给 null，不阻断上传 —— 站点会退回显示 --:-- */
    if (it.duration == null) it.duration = await readAudioDuration(it.file)
    const data = await readAsDataURL(it.file)
    const path = await uploadFile(it.name, data, 'audio')
    it.status = 'done'
    it.progress = 100
    bindToTracks(it, path)
  } catch (e) {
    it.status = 'fail'
    it.err = e.message || '上传失败，请重试'
  }
}
function retryMusicItem(it) {
  it.status = 'wait'
  it.progress = 0
  processMusicItem(it)
}
function removeMusicItem(it) {
  const i = musicQueue.value.indexOf(it)
  if (i >= 0) musicQueue.value.splice(i, 1)
}
function clearMusicDone() {
  for (let i = musicQueue.value.length - 1; i >= 0; i--) {
    if (musicQueue.value[i].status === 'done') musicQueue.value.splice(i, 1)
  }
}
/* 上传成功 → 同步进「音乐作品」列表（同路径覆盖，避免重复条目） */
function bindToTracks(it, path) {
  if (!form.tracks) form.tracks = []
  const entry = {
    title: it.title || it.name,
    desc: it.desc || 'AI 生成原创音轨',
    src: path,
    ...(it.duration ? { duration: Math.round(it.duration * 100) / 100 } : {}),
    tags: it.tags ? it.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean) : []
  }
  const idx = form.tracks.findIndex((t) => t.src === path)
  if (idx >= 0) form.tracks[idx] = { ...form.tracks[idx], ...entry }
  else form.tracks.push(entry)
  it.entry = entry
}
/* 封面：走图片上传通道（可选，不传就用站点程序化黑胶封面） */
function pickTrackCover(t) {
  pickFiles('image/*', 'image', (path) => { t.cover = path })
}
function clearTrackCover(t) {
  delete t.cover
}
function removeTrack(i) {
  form.tracks.splice(i, 1)
}
function moveTrack(i, dir) {
  const j = i + dir
  if (j < 0 || j >= form.tracks.length) return
  const [row] = form.tracks.splice(i, 1)
  form.tracks.splice(j, 0, row)
}
function trackName(t) {
  return String(t?.src || '').split('/').pop()
}

/* ============================================================
   ⑫ 动图制作（GIF）：视频片段 / 连续图片 → GIF，可调时长·尺寸·帧率
   ============================================================ */
const GIF_W = [240, 320, 400, 480, 640]
const GIF_FPS = [8, 10, 12, 16, 20]
const MAX_GIF_FRAMES = 120          /* 帧数上限：GIF 体积随帧数线性增长，超了会很难看 */
const gif = reactive({
  mode: 'video',
  videoFile: null, videoUrl: '', videoName: '', videoDur: 0, videoEl: null,
  images: [],                 /* { name, url } */
  start: 0, len: 2.5, width: 320, fps: 10,   /* 默认保守：320px / 10fps / 2.5s ≈ 25 帧，体积友好 */
  busy: false, progress: 0, note: '', err: '',
  outUrl: '', outSize: 0, outBlob: null, outW: 0, outH: 0,
  title: '', desc: '', tags: 'GIF, 碎片实验',
  uploading: false
})
/* 全局调色板：跨帧抽样拼样本 → 一次量化 255 色（留 1 格给透明色，用于帧间差分） */
function buildGlobalPalette(frames) {
  const TARGET = 24000
  const per = Math.max(200, Math.floor(TARGET / frames.length))
  const buf = new Uint8ClampedArray(per * frames.length * 4)
  let o = 0
  for (const c of frames) {
    const { data } = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height)
    const step = Math.max(1, Math.floor((c.width * c.height) / per))
    for (let p = 0; p < per; p++) {
      const i = Math.min(data.length - 4, p * step * 4)
      buf[o++] = data[i]
      buf[o++] = data[i + 1]
      buf[o++] = data[i + 2]
      buf[o++] = 255
    }
  }
  const pal = quantize(buf.subarray(0, o), 255)
  pal.push([12, 13, 15])          /* 第 256 格：透明占位（颜色值不参与显示） */
  return pal
}
const TRANSPARENT_INDEX = 255
/* 预计帧数 / 体积（GIF 体量经验值 ≈ 帧数 × 面积 × 0.32 B） */
const gifFrames = computed(() => {
  if (gif.mode === 'images') return gif.images.length
  return Math.max(1, Math.round(Number(gif.len) * Number(gif.fps)))
})
const gifEstimate = computed(() => {
  const w = Number(gif.width) || 400
  return gifFrames.value * w * (w * 0.75) * 0.32
})
function seekTo(v, t) {
  return new Promise((res) => {
    let done = false
    const h = () => { if (done) return; done = true; v.removeEventListener('seeked', h); res() }
    v.addEventListener('seeked', h)
    v.currentTime = t
    setTimeout(h, 1200)
  })
}
function loadImage(url) {
  return new Promise((res, rej) => {
    const im = new Image()
    im.onload = () => res(im)
    im.onerror = () => rej(new Error('图片读取失败'))
    im.src = url
  })
}
async function pickGifVideo(files) {
  const f = (files && files[0]) || null
  if (!f) return
  const e = extOf(f.name)
  if (!VIDEO_EXT.includes(e)) { gif.err = '请选择 mp4 / webm / mov / m4v 视频'; return }
  if (f.size > MAX_VIDEO_RAW) { gif.err = `视频 ${fmtSize(f.size)} 超过 200MB，请先裁短再制作`; return }
  gif.err = ''
  if (gif.videoUrl) URL.revokeObjectURL(gif.videoUrl)
  gif.videoFile = f
  gif.videoName = f.name
  gif.videoUrl = URL.createObjectURL(f)
  gif.mode = 'video'
  gif.outUrl && URL.revokeObjectURL(gif.outUrl)
  gif.outUrl = ''
  gif.outBlob = null
  /* 读时长，给出合理的默认片段 */
  const v = document.createElement('video')
  v.src = gif.videoUrl
  await new Promise((res) => { v.onloadedmetadata = res; setTimeout(res, 4000) })
  gif.videoDur = v.duration || 0
  gif.start = 0
  gif.len = Math.min(2.5, Math.max(1, Math.round((gif.videoDur || 2.5) * 10) / 10))
}
async function pickGifImages(files) {
  const list = [...(files || [])].filter((f) => IMAGE_EXT.includes(extOf(f.name)))
  if (!list.length) { gif.err = '请选择图片文件（png / jpg / webp / gif）'; return }
  gif.err = ''
  gif.mode = 'images'
  gif.images.forEach((im) => URL.revokeObjectURL(im.url))
  gif.images = list
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    .map((f) => ({ name: f.name, url: URL.createObjectURL(f) }))
  gif.outUrl && URL.revokeObjectURL(gif.outUrl)
  gif.outUrl = ''
  gif.outBlob = null
}
function useCurrentAsStart() {
  const v = gifVideoRef.value
  if (!v) return
  gif.start = Math.max(0, Math.round(v.currentTime * 10) / 10)
  status(`起点已设为 ${gif.start}s`)
}
/* 省流预设：GIF 最重的三个参数一次压低 */
function presetSmall() {
  gif.width = 240
  gif.fps = 8
  if (gif.mode === 'video') gif.len = Math.min(2, gif.videoDur || 2)
  status('已切换省流预设：240px · 8fps' + (gif.mode === 'video' ? ' · 2s' : ''))
}
/* 素材拖入：有视频走视频模式，否则按图片批量处理 */
function onGifDrop(e) {
  gifDragOver.value = false
  const files = [...((e.dataTransfer && e.dataTransfer.files) || [])]
  if (!files.length) return
  const vids = files.filter((f) => VIDEO_EXT.includes(extOf(f.name)))
  const imgs = files.filter((f) => IMAGE_EXT.includes(extOf(f.name)))
  if (vids.length) pickGifVideo(vids)
  else if (imgs.length) pickGifImages(imgs)
  else gif.err = '拖入的文件格式不支持（视频 mp4/webm/mov/m4v，图片 png/jpg/webp/gif）'
}
const gifDragOver = ref(false)
const gifVideoRef = ref(null)
/* 生成 GIF：逐帧采样 → 调色板量化 → 写入编码器 */
async function makeGif() {
  if (gif.busy) return
  gif.busy = true
  gif.err = ''
  gif.progress = 0
  gif.note = ''
  try {
    const enc = GIFEncoder()
    const delay = Math.round(1000 / Number(gif.fps))
    let outW = 0
    let outH = 0
    /* 第一遍：抽帧到 canvas（统一尺寸） */
    const frames = []
    if (gif.mode === 'video') {
      if (!gif.videoFile) throw new Error('请先选择视频')
      const v = document.createElement('video')
      v.src = gif.videoUrl
      v.muted = true
      v.playsInline = true
      await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('视频无法解析')); setTimeout(() => rej(new Error('读取视频超时')), 15000) })
      const total = Math.min(MAX_GIF_FRAMES, Math.max(1, Math.round(Number(gif.len) * Number(gif.fps))))
      const startT = Math.max(0, Math.min(Number(gif.start), Math.max(0, (v.duration || 0) - 0.1)))
      const step = 1 / Number(gif.fps)
      for (let i = 0; i < total; i++) {
        const t = Math.min(startT + i * step, Math.max(0, (v.duration || gif.len) - 0.04))
        await seekTo(v, t)
        const scale = Number(gif.width) / v.videoWidth
        const w = Math.max(2, Math.round(Number(gif.width) / 2) * 2)
        const h = Math.max(2, Math.round((v.videoHeight * scale) / 2) * 2)
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        c.getContext('2d', { willReadFrequently: true }).drawImage(v, 0, 0, w, h)
        frames.push(c)
        outW = w
        outH = h
        gif.progress = Math.round(((i + 1) / total) * 45)          /* 抽帧占前 45% */
        await new Promise((r) => setTimeout(r, 0))
      }
    } else {
      if (gif.images.length < 2) throw new Error('连续图片至少 2 张')
      const total = Math.min(MAX_GIF_FRAMES, gif.images.length)
      for (let i = 0; i < total; i++) {
        const im = await loadImage(gif.images[i].url)
        const scale = Number(gif.width) / im.width
        const w = Math.max(2, Math.round(Number(gif.width) / 2) * 2)
        const h = Math.max(2, Math.round((im.height * scale) / 2) * 2)
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        c.getContext('2d', { willReadFrequently: true }).drawImage(im, 0, 0, w, h)
        frames.push(c)
        outW = w
        outH = h
        gif.progress = Math.round(((i + 1) / total) * 45)
        await new Promise((r) => setTimeout(r, 0))
      }
    }
    if (!frames.length) throw new Error('没有可用的帧')
    /* 第二遍：全局调色板 + 帧间差分（与上一帧相同的像素置透明 → 体积大减）+ 逐帧写入 */
    const palette = buildGlobalPalette(frames)
    let prevRaw = null
    for (let i = 0; i < frames.length; i++) {
      const c = frames[i]
      const { data } = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height)
      const raw = applyPalette(data, palette)
      let out = raw
      if (prevRaw && prevRaw.length === raw.length) {
        out = Uint8Array.from(raw)                       /* 拷贝后再改，raw 留给下一帧比对 */
        for (let p = 0; p < out.length; p++) {
          if (out[p] === prevRaw[p]) out[p] = TRANSPARENT_INDEX
        }
      }
      prevRaw = raw
      enc.writeFrame(out, c.width, c.height, {
        palette,
        delay,
        transparent: i > 0,
        transparentIndex: TRANSPARENT_INDEX,
        dispose: 1
      })
      gif.progress = 45 + Math.round(((i + 1) / frames.length) * 55)
      await new Promise((r) => setTimeout(r, 0))
    }
    enc.finish()
    const blob = new Blob([enc.bytesView()], { type: 'image/gif' })
    if (gif.outUrl) URL.revokeObjectURL(gif.outUrl)
    gif.outBlob = blob
    gif.outUrl = URL.createObjectURL(blob)
    gif.outSize = blob.size
    gif.outW = outW
    gif.outH = outH
    gif.note = `${outW}×${outH} · ${gif.mode === 'video' ? gifFrames.value + ' 帧' : gif.images.length + ' 帧'} · ${fmtSize(blob.size)}${blob.size > 2 * 1024 * 1024 ? '（偏大，可降帧率或尺寸）' : ''}`
  } catch (e) {
    gif.err = e.message || '生成失败'
  } finally {
    gif.busy = false
  }
}
function downloadGif() {
  if (!gif.outUrl) return
  const a = document.createElement('a')
  a.href = gif.outUrl
  a.download = (gif.uploadName || 'motion') + '.gif'
  a.click()
}
/* 生成名：视频名/time 或 frames/time */
const gifUploadName = computed(() => {
  const base = gif.mode === 'video' ? String(gif.videoName || 'clip').replace(/\.[^.]+$/, '') : 'frames'
  return (base || 'motion') + '-' + Date.now()
})
async function uploadGif() {
  if (!gif.outBlob) return
  gif.uploading = true
  try {
    if (gif.outSize > MAX_IMAGE) throw new Error(`GIF ${fmtSize(gif.outSize)} 超过 5MB 上限，请降低帧率或尺寸`)
    const data = await readAsDataURL(gif.outBlob)
    const path = await uploadFile(gifUploadName.value + '.gif', data, 'image')
    if (!form.motion) form.motion = []
    form.motion.push({
      title: gif.title || '动图 · 碎片实验',
      desc: gif.desc || `GIF · ${gif.outW}×${gif.outH} · ${gif.mode === 'video' ? gifFrames.value : gif.images.length} 帧`,
      tags: gif.tags ? gif.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean) : [],
      src: path
    })
    status('✓ 动图已加入「碎片实验作品」列表，点④号区保存后上线')
  } catch (e) {
    status('上传失败：' + e.message, true)
  } finally {
    gif.uploading = false
  }
}

onMounted(load)
</script>

<template>
  <div class="wk">
    <!-- 顶部工具条 -->
    <header class="wk-bar">
      <div class="wk-bar-left">
        <span class="wk-logo">🎬 作品站 · 可视化工坊</span>
        <span class="wk-hint">改左侧 → 右侧实时预览 → 点「保存」写回文件</span>
      </div>
      <div class="wk-bar-right">
        <span v-if="msg.text" class="wk-toast" :class="msg.type">{{ msg.text }}</span>
        <button class="wk-btn" @click="refreshPreview">↻ 刷新预览</button>
        <button class="wk-btn" @click="openLive">↗ 看线上页</button>
        <button class="wk-btn ghost" @click="restore">⟲ 还原默认</button>
        <button class="wk-btn primary" :disabled="saving" @click="save">
          {{ saving ? '保存中…' : '💾 保存' }}
        </button>
      </div>
    </header>

    <div class="wk-body">
      <!-- 左：表单 -->
      <aside class="wk-panel">
        <section class="wk-sec">
          <h3>① 主视觉 Hero</h3>
          <div class="field">
            <label>角标文字</label>
            <input v-model="form.hero.badge" placeholder="OPEN FOR COMMISSIONS" />
          </div>
          <div class="field two">
            <div><label>主标题 · 上</label><input v-model="form.hero.title1" placeholder="以 AI 为笔" /></div>
            <div><label>主标题 · 下</label><input v-model="form.hero.title2" placeholder="光影为墨" /></div>
          </div>
          <div class="field">
            <label>副标题（换行用回车）</label>
            <textarea v-model="form.hero.subtitle" rows="3"></textarea>
          </div>
          <div class="field">
            <label>背景图</label>
            <div class="row">
              <input v-model="form.hero.bg" placeholder="assets/images/cover-dongri.jpg" />
              <button class="up" @click="pickFile('image', (p) => (form.hero.bg = p))">上传</button>
            </div>
          </div>
          <div class="field">
            <label>轮播图（每行一个图片路径，首屏大图自动轮播）</label>
            <textarea v-model="heroSlidesText" rows="3" placeholder="assets/images/cover-dongri.jpg"></textarea>
          </div>
        </section>

        <section class="wk-sec">
          <h3>② 创作手记 Topics</h3>
          <div v-for="(t, i) in form.topics" :key="'t' + i" class="card">
            <div class="card-head">
              <span>手记 {{ i + 1 }}</span>
              <button class="del" @click="removeTopic(i)">✕</button>
            </div>
            <div class="field"><label>日期</label><input v-model="t.date" placeholder="2026.09.07" /></div>
            <div class="field"><label>标题</label><input v-model="t.title" placeholder="《冬日恋曲》上线…" /></div>
          </div>
          <button class="add" @click="addTopic">＋ 添加手记</button>
        </section>

        <section class="wk-sec">
          <h3>③ 关于我 About</h3>
          <div class="field"><label>段落一</label><textarea v-model="form.about.p1" rows="3"></textarea></div>
          <div class="field"><label>段落二</label><textarea v-model="form.about.p2" rows="2"></textarea></div>
        </section>

        <section class="wk-sec">
          <h3>④ 引言带 Story</h3>
          <div class="field"><label>引言（换行用回车）</label><textarea v-model="form.story.quote" rows="3"></textarea></div>
          <div class="field"><label>署名</label><input v-model="form.story.by" placeholder="— 孔诸祺 · 创作手记" /></div>
          <div class="field">
            <label>背景图</label>
            <div class="row">
              <input v-model="form.story.bg" placeholder="assets/images/cover-waimai.jpg" />
              <button class="up" @click="pickFile('image', (p) => (form.story.bg = p))">上传</button>
            </div>
          </div>
        </section>

        <section class="wk-sec">
          <h3>⑤ 精选作品 Works</h3>
          <p class="tip">视频优先用 B站外链；填了 B站链接就用 B站播放，否则用本地视频。</p>
          <div v-for="(w, i) in form.works" :key="'w' + i" class="card">
            <div class="card-head">
              <span>作品 {{ w.no || i + 1 }}</span>
              <button class="del" @click="removeWork(i)">✕</button>
            </div>
            <div class="field two">
              <div><label>编号</label><input v-model="w.no" placeholder="01" /></div>
              <div><label>标题</label><input v-model="w.title" placeholder="冬日恋曲" /></div>
            </div>
            <div class="field"><label>简介</label><input v-model="w.desc" placeholder="AI 生成爱情短片…" /></div>
            <div class="field"><label>标签（逗号分隔）</label>
              <input :value="(w.tags || []).join(', ')" @input="(e) => (w.tags = e.target.value.split(',').map((s) => s.trim()).filter(Boolean))" />
            </div>
            <div class="field">
              <label>封面图</label>
              <div class="row">
                <input v-model="w.cover" placeholder="assets/images/cover-dongri.jpg" />
                <button class="up" @click="pickFile('image', (p) => (w.cover = p))">上传</button>
              </div>
            </div>
            <div class="field"><label>B站链接 / BV号</label>
              <input v-model="w.bilibili" placeholder="https://www.bilibili.com/video/BV1xx… 或纯 BV1xx" />
            </div>
            <div class="field">
              <label>本地视频（可选）</label>
              <div class="row">
                <input v-model="w.local" placeholder="assets/videos/xxx.mp4" />
                <button class="up" @click="pickFile('video', (p) => (w.local = p))">上传</button>
              </div>
            </div>
          </div>
          <button class="add" @click="addWork">＋ 添加作品</button>
        </section>

        <section class="wk-sec">
          <h3>⑥ 最新影片 Movie</h3>
          <div class="field"><label>标题</label><input v-model="form.movie.title" placeholder="外卖侠" /></div>
          <div class="field"><label>简介</label><textarea v-model="form.movie.desc" rows="2"></textarea></div>
          <div class="field"><label>B站链接 / BV号</label><input v-model="form.movie.bilibili" placeholder="https://www.bilibili.com/video/BV1xx…" /></div>
          <div class="field">
            <label>海报图</label>
            <div class="row">
              <input v-model="form.movie.poster" placeholder="assets/images/cover-waimai.jpg" />
              <button class="up" @click="pickFile('image', (p) => (form.movie.poster = p))">上传</button>
            </div>
          </div>
        </section>

        <section class="wk-sec">
          <h3>⑦ 联系方式 Contact</h3>
          <div class="field"><label>邮箱</label><input v-model="form.contact.email" placeholder="hello@kongzhuqi.studio" /></div>
          <div class="field"><label>抖音</label><input v-model="form.contact.douyin" placeholder="@孔诸祺的 AI 片场" /></div>
          <div class="field"><label>微信（左侧菜单点击复制）</label><input v-model="form.contact.wechat" placeholder="kongzhuqi_studio" /></div>
        </section>

        <!-- ⑧ 背景音乐面板已整体移除：BGM 与 ♪ 播放开关按主人要求去掉（2026-09-16）。
             需要放音频请用下方「⑭ AI 音乐创作」—— 那是站点唯一会发声的来源。 -->

        <section class="wk-sec">
          <h3>⑨ 区块背景 Background</h3>
          <p class="tip">给每个版块单独换背景：图片 / 循环视频 / 纯色 / 渐变。右侧实时预览，所见即所得；不想要了点「移除背景」。视频背景在手机 / 弱网下会自动降级成封面图。</p>
          <div v-for="s in BG_SECTIONS" :key="s.id" class="bg-card">
            <button class="bg-head" type="button" @click="toggleBg(s.id)">
              <span class="bg-name">{{ s.name }}</span>
              <span class="bg-state" :class="{ on: form.backgrounds && form.backgrounds[s.id] && form.backgrounds[s.id].type }">{{ bgStateText(s.id) }}</span>
              <span class="bg-arrow">{{ openBg[s.id] ? '▾' : '▸' }}</span>
            </button>
            <div v-if="openBg[s.id]" class="bg-body">
              <p v-if="s.hint" class="tip">{{ s.hint }}</p>
              <div class="field">
                <label>背景类型</label>
                <select v-model="bgDraft(s.id).type">
                  <option value="">默认（无背景）</option>
                  <option value="image">静态图片</option>
                  <option value="video">循环视频（静音自动播放）</option>
                  <option value="color">纯色</option>
                  <option value="gradient">渐变</option>
                </select>
              </div>

              <div v-if="bgDraft(s.id).type === 'image'" class="field">
                <label>图片路径 / 外链</label>
                <div class="row">
                  <input v-model="bgDraft(s.id).src" placeholder="assets/images/xxx.jpg 或 https://…" />
                  <button class="up" type="button" @click="pickFile('image', (p) => (bgDraft(s.id).src = p))">上传</button>
                </div>
              </div>

              <template v-else-if="bgDraft(s.id).type === 'video'">
                <div class="field">
                  <label>视频路径 / 外链（建议 10–30 秒、≤10MB）</label>
                  <div class="row">
                    <input v-model="bgDraft(s.id).src" placeholder="assets/videos/xxx.mp4 或 https://…" />
                    <button class="up" type="button" @click="pickBgVideo((p) => (bgDraft(s.id).src = p))">上传</button>
                  </div>
                </div>
                <div class="field">
                  <label>封面图（视频加载前显示；手机 / 弱网自动降级为这张图）</label>
                  <div class="row">
                    <input v-model="bgDraft(s.id).poster" placeholder="assets/images/xxx.jpg" />
                    <button class="up" type="button" @click="pickFile('image', (p) => (bgDraft(s.id).poster = p))">上传</button>
                  </div>
                </div>
              </template>

              <div v-else-if="bgDraft(s.id).type === 'color'" class="field">
                <label>背景色</label>
                <input v-model="bgDraft(s.id).color" type="color" class="colorin" />
              </div>

              <template v-else-if="bgDraft(s.id).type === 'gradient'">
                <div class="field two">
                  <div><label>起色</label><input v-model="bgDraft(s.id).from" type="color" class="colorin" /></div>
                  <div><label>止色</label><input v-model="bgDraft(s.id).to" type="color" class="colorin" /></div>
                </div>
                <div class="field">
                  <label>渐变角度：{{ bgDraft(s.id).angle }}°</label>
                  <input v-model.number="bgDraft(s.id).angle" type="range" min="0" max="360" step="5" />
                </div>
              </template>

              <template v-if="bgDraft(s.id).type === 'image' || bgDraft(s.id).type === 'video'">
                <div class="field two">
                  <div>
                    <label>覆盖层（压暗背景，文字更清晰）</label>
                    <select v-model="bgDraft(s.id).overlayOn">
                      <option :value="true">开启</option>
                      <option :value="false">关闭</option>
                    </select>
                  </div>
                  <div>
                    <label>覆盖层颜色</label>
                    <input v-model="bgDraft(s.id).overlayColor" type="color" class="colorin" :disabled="!bgDraft(s.id).overlayOn" />
                  </div>
                </div>
                <div v-if="bgDraft(s.id).overlayOn" class="field">
                  <label>不透明度：{{ bgDraft(s.id).overlay }}%</label>
                  <input v-model.number="bgDraft(s.id).overlay" type="range" min="0" max="80" step="5" />
                </div>
              </template>

              <button v-if="bgDraft(s.id).type" class="bg-remove" type="button" @click="removeBg(s.id)">✕ 移除背景，恢复默认</button>
            </div>
          </div>
        </section>

        <section class="wk-sec profile-editor">
          <h3>⑩ 个人简介 Profile <span class="sec-badge">独立保存</span></h3>
          <p class="tip">这里的「保存简介」会直接写回文件，不用再点右上角的总保存；「取消修改」则还原成当前已保存的内容。</p>
          <div class="field two">
            <div><label>姓名</label><input v-model="profileDraft.name" placeholder="孔诸祺" /></div>
            <div><label>身份行</label><input v-model="profileDraft.role" placeholder="AIGC 影像创作者 / 内容运营" /></div>
          </div>
          <div class="field">
            <label>座右铭（可选，一句话）</label>
            <input v-model="profileDraft.motto" placeholder="以 AI 为笔，光影为墨" />
          </div>
          <div class="field">
            <label>简介文字稿（换行分段，{{ BIO_MAX }} 字以内）</label>
            <textarea v-model="profileDraft.bioText" rows="7" placeholder="一段一行，写下你的经历、方向与故事……"></textarea>
            <div class="char-count" :class="{ warn: bioLen > BIO_MAX * 0.85 && bioLen <= BIO_MAX, over: bioLen > BIO_MAX }">
              {{ bioLen }} / {{ BIO_MAX }} 字
            </div>
          </div>
          <!-- 当前简介预览（随输入实时更新） -->
          <label class="pp-label">预览</label>
          <div class="profile-preview">
            <div class="pp-head">
              <span class="pp-mono">{{ (profileDraft.name || '祺').slice(-1) }}</span>
              <div class="pp-head-text">
                <div class="pp-name">{{ profileDraft.name || '（姓名）' }}</div>
                <div class="pp-role">{{ profileDraft.role || '（身份行）' }}</div>
              </div>
            </div>
            <div class="pp-body">
              <p v-for="(para, i) in bioParas" :key="'pp' + i">{{ para }}</p>
              <p v-if="!bioParas.length" class="pp-empty">（暂无简介内容）</p>
            </div>
          </div>
          <div class="row">
            <button class="save-profile" type="button" :disabled="profileSaving" @click="saveProfile">
              {{ profileSaving ? '保存中…' : '✓ 保存简介' }}
            </button>
            <button class="cancel-profile" type="button" :disabled="profileSaving" @click="resetProfileDraft">↩ 取消修改</button>
          </div>
        </section>

        <section class="wk-sec">
          <h3>⑪ 碎片实验作品 · 上传与编辑 <span class="sec-badge">自动压缩</span></h3>
          <p class="tip">拖拽或批量选择图片 / 视频：视频会自动压缩（保画质、减体积），完成即写入下方列表，最后点①处保存上线。</p>
          <!-- 拖拽区 -->
          <div
            class="dropzone"
            :class="{ over: dragOver }"
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="onDrop">
            <div class="dz-icon">⬆</div>
            <div class="dz-main">把文件拖到这里</div>
            <div class="dz-sub">或 <button class="dz-btn" type="button" @click="pickBatch">点击批量选择</button></div>
            <div class="dz-hint">图片 png / jpg / webp / gif（≤5MB）· 视频 mp4 / webm / mov / m4v（≤200MB，可压缩）</div>
          </div>
          <div class="field two">
            <div>
              <label>上传前自动压缩视频</label>
              <select v-model="autoCompress">
                <option :value="true">开启（推荐，保画质减体积）</option>
                <option :value="false">关闭（直接上传原片）</option>
              </select>
            </div>
            <div>
              <label>队列操作</label>
              <button class="mini-btn" type="button" @click="clearDone">清空已完成</button>
            </div>
          </div>

          <!-- 上传队列 -->
          <div v-for="it in uploadQueue" :key="it.id" class="up-item">
            <div class="up-row">
              <img v-if="it.thumb" :src="it.thumb" class="up-thumb" alt="" />
              <div v-else class="up-thumb up-thumb-empty">{{ it.kind === 'video' ? '▶' : '▢' }}</div>
              <div class="up-meta">
                <div class="up-name" :title="it.name">{{ it.name }}</div>
                <div class="up-size">
                  原始 {{ fmtSize(it.size) }}
                  <template v-if="it.outSize"> · 压缩后 {{ fmtSize(it.outSize) }}</template>
                </div>
              </div>
              <span class="up-status" :class="'st-' + it.status">{{ STATUS_TEXT[it.status] }}</span>
              <button class="del" type="button" title="从队列移除" @click="removeItem(it)">✕</button>
            </div>
            <div v-if="it.status === 'compress' || it.status === 'upload'" class="up-bar">
              <div class="up-bar-fill" :style="{ width: it.progress + '%' }"></div>
            </div>
            <div v-if="it.note" class="up-note">{{ it.note }}</div>
            <div v-if="it.err" class="up-err">
              ✕ {{ it.err }}
              <button class="mini-btn retry" type="button" @click="retryItem(it)">↻ 重新上传</button>
            </div>
            <div v-if="it.status === 'wait' || it.status === 'done'" class="field two up-fields">
              <div><label>标题</label><input v-model="it.title" placeholder="作品标题" /></div>
              <div><label>标签（逗号分隔）</label><input v-model="it.tags" placeholder="GIF, 实验" /></div>
            </div>
            <div v-if="it.status === 'wait' || it.status === 'done'" class="field">
              <label>简介</label>
              <input v-model="it.desc" placeholder="一句话说明这个碎片实验" />
            </div>
          </div>

          <!-- 已加入的碎片实验作品（直接编辑上线内容） -->
          <div class="sub-head">已加入：碎片实验作品 <span>{{ (form.motion || []).length }} 条</span></div>
          <p class="tip">这里就是网站「动图 · 碎片实验」板块的内容；改完记得保存。</p>
          <div v-for="(m, i) in form.motion || []" :key="'mo' + i" class="card">
            <div class="card-head">
              <span>{{ i + 1 }}. {{ m.title || '未命名' }}</span>
              <span class="card-head-ops">
                <button class="mini-btn" type="button" title="上移" @click="moveMotion(i, -1)">↑</button>
                <button class="mini-btn" type="button" title="下移" @click="moveMotion(i, 1)">↓</button>
                <button class="del" type="button" @click="removeMotion(i)">✕</button>
              </span>
            </div>
            <div class="mo-preview">
              <img v-if="/\.(gif|png|jpe?g|webp)$/i.test(m.src || '')" :src="m.src" alt="" />
              <video v-else-if="m.src" :src="m.src" muted loop playsinline></video>
              <span v-else class="mo-empty">无素材</span>
            </div>
            <div class="field"><label>标题</label><input v-model="m.title" /></div>
            <div class="field"><label>简介</label><input v-model="m.desc" /></div>
            <div class="field">
              <label>标签（逗号分隔）</label>
              <input
                :value="(m.tags || []).join(', ')"
                @input="(e) => (m.tags = e.target.value.split(',').map((s) => s.trim()).filter(Boolean))" />
            </div>
          </div>
          <button class="save-profile" type="button" :disabled="saving" @click="save()">
            {{ saving ? '保存中…' : '💾 保存到网站' }}
          </button>
        </section>

        <section class="wk-sec">
          <h3>⑫ 动图制作 GIF <span class="sec-badge">视频 / 连续图片</span></h3>
          <p class="tip">把视频片段或一组连续图片转成 GIF 动图：可调时长、尺寸、帧率，生成后可预览、下载，或直接加入碎片实验。</p>
          <div class="field">
            <label>素材来源</label>
            <div class="seg">
              <button type="button" :class="{ on: gif.mode === 'video' }" @click="gif.mode = 'video'">视频片段</button>
              <button type="button" :class="{ on: gif.mode === 'images' }" @click="gif.mode = 'images'">连续图片</button>
            </div>
          </div>
          <!-- 素材拖拽区：视频 → 视频模式；图片（可多张）→ 连续图片模式 -->
          <div
            class="dropzone slim"
            :class="{ over: gifDragOver }"
            @dragover.prevent="gifDragOver = true"
            @dragleave.prevent="gifDragOver = false"
            @drop.prevent="onGifDrop">
            <div class="dz-main">拖入视频或连续图片</div>
            <div class="dz-hint">视频取片段转 GIF；多张图片按文件名顺序逐帧合成</div>
          </div>

          <!-- 视频素材 -->
          <template v-if="gif.mode === 'video'">
            <div class="field">
              <label>视频文件</label>
              <div class="row">
                <button class="up" type="button" @click="pickFiles('video/*', 'gif-video', () => {})">选择视频</button>
                <span class="file-name">{{ gif.videoName || '未选择' }}<template v-if="gif.videoDur"> · {{ gif.videoDur.toFixed(1) }}s</template></span>
              </div>
            </div>
            <video v-if="gif.videoUrl" ref="gifVideoRef" class="gif-video" :src="gif.videoUrl" controls muted playsinline></video>
            <div v-if="gif.videoUrl" class="field">
              <button class="mini-btn" type="button" @click="useCurrentAsStart">⏱ 以当前播放位置为起点</button>
            </div>
          </template>

          <!-- 图片素材 -->
          <template v-else>
            <div class="field">
              <label>连续图片（按文件名排序为帧序）</label>
              <div class="row">
                <button class="up" type="button" @click="pickFiles('image/*', 'gif-images', () => {})">选择图片（可多选）</button>
                <span class="file-name">{{ gif.images.length }} 张</span>
              </div>
            </div>
            <div v-if="gif.images.length" class="strip">
              <img v-for="(im, i) in gif.images.slice(0, 12)" :key="'gi' + i" :src="im.url" :title="im.name" alt="" />
              <span v-if="gif.images.length > 12" class="strip-more">+{{ gif.images.length - 12 }}</span>
            </div>
          </template>

          <!-- 参数 -->
          <div class="field two">
            <div v-if="gif.mode === 'video'">
              <label>起始时间（秒）</label>
              <input v-model.number="gif.start" type="number" min="0" step="0.1" />
            </div>
            <div v-if="gif.mode === 'video'">
              <label>时长（秒，建议 ≤5）</label>
              <input v-model.number="gif.len" type="number" min="0.5" max="10" step="0.5" />
            </div>
          </div>
          <div class="field two">
            <div>
              <label>宽度（像素）</label>
              <select v-model.number="gif.width">
                <option v-for="w in GIF_W" :key="'w' + w" :value="w">{{ w }} px</option>
              </select>
            </div>
            <div>
              <label>帧率（fps）</label>
              <select v-model.number="gif.fps">
                <option v-for="f in GIF_FPS" :key="'f' + f" :value="f">{{ f }} fps</option>
              </select>
            </div>
          </div>
          <div class="field">
            <button class="mini-btn" type="button" @click="presetSmall">⚡ 省流预设（240px · 8fps · 2s）</button>
          </div>
          <p class="tip">预计 {{ gifFrames }} 帧 · 约 {{ fmtSize(gifEstimate) }} —— GIF 天然偏大，建议「时长 ≤3 秒 · 宽度 ≤320px · 帧率 ≤10」；上传上限 5MB。同类素材想更小，直接用「碎片实验」传视频（体积通常只有 GIF 的 1/3）。</p>

          <button class="save-profile" type="button" :disabled="gif.busy || (gif.mode === 'video' ? !gif.videoFile : gif.images.length < 2)" @click="makeGif">
            {{ gif.busy ? '生成中… ' + gif.progress + '%' : '✨ 生成 GIF' }}
          </button>
          <div v-if="gif.busy" class="up-bar"><div class="up-bar-fill" :style="{ width: gif.progress + '%' }"></div></div>
          <div v-if="gif.err" class="up-err">✕ {{ gif.err }}</div>

          <!-- 结果预览 -->
          <template v-if="gif.outUrl">
            <div class="sub-head">生成结果</div>
            <div class="gif-result">
              <img :src="gif.outUrl" alt="GIF 预览" />
              <div class="gif-result-meta">{{ gif.note }}</div>
            </div>
            <div class="field two">
              <div><label>标题</label><input v-model="gif.title" placeholder="动图 · 碎片实验" /></div>
              <div><label>标签（逗号分隔）</label><input v-model="gif.tags" /></div>
            </div>
            <div class="field"><label>简介</label><input v-model="gif.desc" placeholder="一句话说明" /></div>
            <div class="row">
              <button class="save-profile" type="button" :disabled="gif.uploading" @click="uploadGif">
                {{ gif.uploading ? '上传中…' : '⬆ 加入碎片实验作品' }}
              </button>
              <button class="cancel-profile" type="button" @click="downloadGif">⬇ 下载 GIF</button>
            </div>
          </template>
        </section>

        <section class="wk-sec">
          <h3>⑬ 经历速览 Experience <span class="sec-badge">独立保存</span></h3>
          <p class="tip">对应网站「个人简介」里的「经历速览 · EXPERIENCE」时间线。改完点「保存经历」立即写回文件并同步右侧预览；「取消修改」丢弃改动、恢复原内容。</p>
          <div v-for="(row, i) in timelineDraft" :key="'tl' + i" class="card">
            <div class="card-head">
              <span>第 {{ i + 1 }} 条 <em class="tl-hint">{{ row.title || '未命名' }}</em></span>
              <span class="card-head-ops">
                <button class="mini-btn" type="button" title="上移" @click="moveTimelineRow(i, -1)">↑</button>
                <button class="mini-btn" type="button" title="下移" @click="moveTimelineRow(i, 1)">↓</button>
                <button class="del" type="button" title="删除这一条" @click="removeTimelineRow(i)">✕</button>
              </span>
            </div>
            <div class="field two">
              <div>
                <label>时间 <b class="req">*</b> <span class="cc" :class="{ over: cnt(row.period) > TL_LIMITS.period }">{{ cnt(row.period) }}/{{ TL_LIMITS.period }}</span></label>
                <input v-model="row.period" placeholder="2021—2025" />
              </div>
              <div>
                <label>名称 / 职位 <b class="req">*</b> <span class="cc" :class="{ over: cnt(row.title) > TL_LIMITS.title }">{{ cnt(row.title) }}/{{ TL_LIMITS.title }}</span></label>
                <input v-model="row.title" placeholder="临床医学（专科）" />
              </div>
            </div>
            <div class="field">
              <label>机构 <span class="cc" :class="{ over: cnt(row.org) > TL_LIMITS.org }">{{ cnt(row.org) }}/{{ TL_LIMITS.org }}</span></label>
              <input v-model="row.org" placeholder="苏州卫生职业技术学院" />
            </div>
            <div class="field">
              <label>描述 <span class="cc" :class="{ over: cnt(row.desc) > TL_LIMITS.desc }">{{ cnt(row.desc) }}/{{ TL_LIMITS.desc }}</span></label>
              <textarea v-model="row.desc" rows="2" placeholder="一句话说明这段经历"></textarea>
            </div>
          </div>
          <button class="add" type="button" @click="addTimelineRow">＋ 添加一段经历</button>
          <p class="tip">共 {{ tlCount }} 条（上限 {{ TL_MAX_ITEMS }} 条）· 带 <b class="req">*</b> 为必填 · 不支持 &lt; &gt; 特殊字符 · 整行留空会自动忽略</p>
          <div class="row">
            <button class="save-profile" type="button" :disabled="timelineSaving" @click="saveTimeline">
              {{ timelineSaving ? '保存中…' : '✓ 保存经历' }}
            </button>
            <button class="cancel-profile" type="button" :disabled="timelineSaving" @click="resetTimelineDraft">↩ 取消修改</button>
          </div>
        </section>

        <section class="wk-sec">
          <h3>⑭ AI 音乐创作 · 上传与编辑 <span class="sec-badge">音频</span></h3>
          <p class="tip">
            上传音乐作品文件（不做转码，音质原样入库），填好标题、简介、标签即可上线；
            站点「我能做什么 → AI 音乐创作」板块会按这里的顺序展示，点卡片即可试听。
          </p>

          <!-- 音频拖拽区 -->
          <div
            class="dropzone"
            :class="{ over: musicDragOver }"
            @dragover.prevent="musicDragOver = true"
            @dragleave.prevent="musicDragOver = false"
            @drop.prevent="onMusicDrop">
            <div class="dz-icon">♪</div>
            <div class="dz-main">把音频文件拖到这里</div>
            <div class="dz-sub">或 <button class="dz-btn" type="button" @click="pickMusicFiles">点击选择（可多选）</button></div>
            <div class="dz-hint">支持 mp3 / wav / m4a / aac / ogg / flac（单个 ≤30MB，建议 192kbps 导出）</div>
          </div>

          <!-- 上传队列 -->
          <div v-for="it in musicQueue" :key="it.id" class="up-item">
            <div class="up-row">
              <div class="up-thumb up-thumb-empty">♪</div>
              <div class="up-meta">
                <div class="up-name" :title="it.name">{{ it.name }}</div>
                <div class="up-size">原始 {{ fmtSize(it.size) }}</div>
              </div>
              <span class="up-status" :class="'st-' + it.status">{{ STATUS_TEXT[it.status] }}</span>
              <button class="del" type="button" title="从队列移除" @click="removeMusicItem(it)">✕</button>
            </div>
            <div v-if="it.status === 'upload'" class="up-bar">
              <div class="up-bar-fill" :style="{ width: it.progress + '%' }"></div>
            </div>
            <div v-if="it.err" class="up-err">
              ✕ {{ it.err }}
              <button class="mini-btn retry" type="button" @click="retryMusicItem(it)">↻ 重新上传</button>
            </div>
            <div v-if="it.status === 'wait' || it.status === 'done'" class="field two up-fields">
              <div><label>标题</label><input v-model="it.title" placeholder="作品标题" /></div>
              <div><label>标签（逗号分隔）</label><input v-model="it.tags" placeholder="配乐, 氛围" /></div>
            </div>
            <div v-if="it.status === 'wait' || it.status === 'done'" class="field">
              <label>简介</label>
              <input v-model="it.desc" placeholder="一句话说明这段音乐（用途 / 情绪 / 乐器）" />
            </div>
          </div>
          <div v-if="musicQueue.length" class="field">
            <label>队列操作</label>
            <button class="mini-btn" type="button" @click="clearMusicDone">清空已完成</button>
          </div>

          <!-- 已加入的音乐作品（直接编辑上线内容） -->
          <div class="sub-head">已加入：音乐作品 <span>{{ (form.tracks || []).length }} 首</span></div>
          <p class="tip">这里就是网站「AI 音乐创作」板块的内容；每首都能试听，改完记得保存。</p>
          <div v-for="(t, i) in form.tracks || []" :key="'tk' + i" class="card">
            <div class="card-head">
              <span>{{ i + 1 }}. {{ t.title || '未命名音轨' }}</span>
              <span class="card-head-ops">
                <button class="mini-btn" type="button" title="上移" @click="moveTrack(i, -1)">↑</button>
                <button class="mini-btn" type="button" title="下移" @click="moveTrack(i, 1)">↓</button>
                <button class="del" type="button" @click="removeTrack(i)">✕</button>
              </span>
            </div>
            <!-- 试听：原生控件，播放 / 暂停 / 拖动进度都能用 -->
            <audio v-if="t.src" class="tk-audio" controls preload="none" :src="t.src"></audio>
            <div class="up-size tk-src">{{ trackName(t) }}</div>
            <div class="field"><label>标题</label><input v-model="t.title" /></div>
            <div class="field"><label>简介</label><input v-model="t.desc" /></div>
            <div class="field">
              <label>标签（逗号分隔）</label>
              <input
                :value="(t.tags || []).join(', ')"
                @input="(e) => (t.tags = e.target.value.split(',').map((s) => s.trim()).filter(Boolean))" />
            </div>
            <div class="field">
              <label>封面（可选，不传则用站点自带的黑胶封面）</label>
              <div class="row">
                <button class="up" type="button" @click="pickTrackCover(t)">选择图片</button>
                <span class="file-name">{{ t.cover ? trackName(t.cover) : '未设置' }}</span>
                <button v-if="t.cover" class="mini-btn" type="button" @click="clearTrackCover(t)">清除</button>
              </div>
              <img v-if="t.cover" class="tk-cover" :src="t.cover" alt="" />
            </div>
          </div>
          <div v-if="!(form.tracks || []).length" class="tk-empty">
            还没有音乐作品：拖入音频文件即可出现在「AI 音乐创作」板块。
          </div>
          <button class="save-profile" type="button" :disabled="saving" @click="save()">
            {{ saving ? '保存中…' : '💾 保存到网站' }}
          </button>
        </section>

      </aside>

      <!-- 右：实时预览 -->
      <main class="wk-preview">
        <iframe ref="previewRef" :src="previewSrc" @load="onPreviewLoad" title="实时预览"></iframe>
      </main>
    </div>

    <!-- 隐藏的文件选择器（图片 / 视频共用） -->
    <input ref="fileInput" type="file" hidden @change="onFilePicked" />
  </div>
</template>

<style scoped>
.wk {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #f3efe6;
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  color: #2c2a26;
}
/* 工具条 */
.wk-bar {
  height: 54px;
  flex: 0 0 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #2f3b2c;
  color: #f3efe6;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
  z-index: 5;
}
.wk-bar-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}
.wk-logo {
  font-weight: 700;
  font-size: 15px;
  white-space: nowrap;
}
.wk-hint {
  font-size: 12px;
  opacity: 0.7;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wk-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}
.wk-toast {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  white-space: nowrap;
}
.wk-toast.err {
  background: #b4452f;
  color: #fff;
}
.wk-btn {
  border: 0;
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 13px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.16);
  color: #f3efe6;
  transition: background 0.15s;
  white-space: nowrap;
}
.wk-btn:hover {
  background: rgba(255, 255, 255, 0.28);
}
.wk-btn.primary {
  background: #b8903c;
  color: #2c2410;
  font-weight: 700;
}
.wk-btn.primary:disabled {
  opacity: 0.6;
  cursor: default;
}
.wk-btn.ghost {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.4);
}
/* 主体 */
.wk-body {
  flex: 1;
  display: flex;
  min-height: 0;
}
.wk-panel {
  width: 400px;
  flex: 0 0 400px;
  overflow-y: auto;
  padding: 16px;
  background: #faf7ef;
  border-right: 1px solid #e2dccb;
}
.wk-preview {
  flex: 1;
  min-width: 0;
  background: #1a1a18;
}
.wk-preview iframe {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
/* 分区 */
.wk-sec {
  background: #fff;
  border: 1px solid #ece6d6;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 14px;
}
.wk-sec h3 {
  margin: 0 0 10px;
  font-size: 14px;
  color: #4c7a53;
}
.tip {
  font-size: 12px;
  color: #8a8472;
  margin: 0 0 10px;
}
.field {
  margin-bottom: 10px;
}
.field.two {
  display: flex;
  gap: 10px;
}
.field.two > div {
  flex: 1;
  min-width: 0;
}
.field label {
  display: block;
  font-size: 12px;
  color: #6b6456;
  margin-bottom: 4px;
}
.field input,
.field textarea,
.field select {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #ddd6c4;
  border-radius: 8px;
  padding: 7px 9px;
  font-size: 13px;
  font-family: inherit;
  background: #fcfbf7;
  color: #2c2a26;
  resize: vertical;
}
.field input:focus,
.field textarea:focus,
.field select:focus {
  outline: none;
  border-color: #b8903c;
  background: #fff;
}
.row {
  display: flex;
  gap: 8px;
}
.row input {
  flex: 1;
  min-width: 0;
}
.up {
  flex: 0 0 auto;
  border: 0;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 12px;
  cursor: pointer;
  background: #4c7a53;
  color: #fff;
}
.up:hover {
  background: #3d6344;
}
/* 卡片（数组项） */
.card {
  border: 1px dashed #d8d0bc;
  border-radius: 10px;
  padding: 10px;
  margin-bottom: 10px;
  background: #fcfbf7;
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  color: #6b6456;
  margin-bottom: 8px;
}
.del {
  border: 0;
  background: #f1e3e0;
  color: #b4452f;
  border-radius: 6px;
  width: 22px;
  height: 22px;
  cursor: pointer;
  font-size: 12px;
}
.add {
  width: 100%;
  border: 1px dashed #b8903c;
  background: #fff;
  color: #9a7320;
  border-radius: 8px;
  padding: 8px;
  font-size: 13px;
  cursor: pointer;
}
.add:hover {
  background: #fdf6e7;
}
/* ---------- 区块背景面板（与工坊米纸风一致） ---------- */
.bg-card {
  border: 1px solid #ece6d6;
  border-radius: 10px;
  margin-bottom: 8px;
  background: #fcfbf7;
  overflow: hidden;
}
.bg-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 13px;
  color: #2c2a26;
  text-align: left;
}
.bg-head:hover {
  background: #f6f1e3;
}
.bg-name {
  flex: 1;
  min-width: 0;
  font-weight: 700;
  color: #6b6456;
}
.bg-state {
  flex: 0 0 auto;
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 999px;
  background: #eee9da;
  color: #8a8472;
}
.bg-state.on {
  background: #4c7a53;
  color: #fff;
}
.bg-arrow {
  flex: 0 0 auto;
  color: #b8903c;
  font-size: 12px;
}
.bg-body {
  padding: 4px 12px 12px;
  border-top: 1px dashed #ece6d6;
}
.bg-body .tip {
  margin: 8px 0 4px;
}
.colorin {
  width: 100%;
  height: 34px;
  padding: 2px;
  border: 1px solid #ddd6c4;
  border-radius: 8px;
  background: #fcfbf7;
  cursor: pointer;
}
.bg-body input[type='range'] {
  width: 100%;
  accent-color: #b8903c;
  cursor: pointer;
}
.bg-remove {
  width: 100%;
  border: 1px solid #e4c9c2;
  background: #f9efec;
  color: #b4452f;
  border-radius: 8px;
  padding: 7px;
  font-size: 12px;
  cursor: pointer;
  margin-top: 4px;
}
.bg-remove:hover {
  background: #f3e3de;
}
/* ---------- ⑩ 个人简介独立编辑板块（预览卡 / 字数统计 / 保存取消） ---------- */
.sec-badge {
  font-size: 10px;
  background: #4c7a53;
  color: #fff;
  border-radius: 999px;
  padding: 2px 9px;
  margin-left: 6px;
  vertical-align: 2px;
  font-weight: 400;
}
.char-count {
  text-align: right;
  font-size: 11px;
  color: #8a8472;
  margin-top: 4px;
}
.char-count.warn { color: #b8903c; font-weight: 700; }
.char-count.over { color: #b4452f; font-weight: 700; }
.pp-label {
  display: block;
  font-size: 12px;
  color: #6b6456;
  margin-bottom: 4px;
}
.profile-preview {
  border: 1px dashed #d8d0bc;
  border-radius: 10px;
  background: #f6f1e3;
  padding: 12px 14px;
  margin-bottom: 12px;
}
.pp-head { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; }
.pp-mono {
  width: 34px; height: 34px; flex: 0 0 34px; border-radius: 9px;
  background: #2f3b2c; color: #f3efe6;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 16px;
}
.pp-name { font-weight: 700; font-size: 14px; color: #2c2a26; }
.pp-role { font-size: 11px; color: #4c7a53; margin-top: 1px; }
.pp-body p { font-size: 12.5px; line-height: 1.8; color: #4a463c; margin: 0 0 8px; }
.pp-body p:last-child { margin-bottom: 0; }
.pp-empty { color: #a39c88; font-style: italic; }
.save-profile {
  flex: 1;
  border: 0;
  border-radius: 8px;
  padding: 9px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  background: #4c7a53;
  color: #fff;
}
.save-profile:hover { background: #3d6344; }
.save-profile:disabled { opacity: 0.6; cursor: default; }
.cancel-profile {
  flex: 0 0 auto;
  border: 1px solid #ddd6c4;
  background: #fff;
  color: #6b6456;
  border-radius: 8px;
  padding: 9px 14px;
  font-size: 13px;
  cursor: pointer;
}
.cancel-profile:hover { background: #f6f1e3; }
.cancel-profile:disabled { opacity: 0.6; cursor: default; }

/* ---------- ⑪ 上传与压缩模块 ---------- */
.dropzone {
  border: 2px dashed #d8d0bc;
  border-radius: 12px;
  background: #fcfbf7;
  padding: 20px 14px;
  text-align: center;
  margin-bottom: 12px;
  transition: border-color 0.25s, background 0.25s, transform 0.25s;
}
.dropzone.over { border-color: #4c7a53; background: #f2f7f2; transform: scale(1.01); }
.dropzone.slim { padding: 12px; margin-bottom: 10px; }
.dropzone.slim .dz-main { margin-top: 0; font-size: 13px; }
.dz-icon { font-size: 22px; color: #4c7a53; line-height: 1; }
.dz-main { font-size: 14px; font-weight: 700; color: #4a463c; margin-top: 8px; }
.dz-sub { font-size: 12px; color: #8a8472; margin-top: 4px; }
.dz-btn {
  border: 0; background: #4c7a53; color: #fff; border-radius: 6px;
  padding: 3px 10px; font-size: 12px; cursor: pointer;
}
.dz-btn:hover { background: #3d6344; }
.dz-hint { font-size: 11px; color: #a39c88; margin-top: 8px; line-height: 1.6; }

.up-item { border: 1px solid #ece6d6; border-radius: 10px; padding: 10px; margin-bottom: 10px; background: #fcfbf7; }
.up-row { display: flex; align-items: center; gap: 10px; }
.up-thumb { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; background: #eee9da; flex: 0 0 44px; }
.up-thumb-empty { display: flex; align-items: center; justify-content: center; color: #a39c88; font-size: 16px; }
.up-meta { flex: 1; min-width: 0; }
.up-name { font-size: 13px; color: #2c2a26; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.up-size { font-size: 11px; color: #8a8472; margin-top: 2px; }
.up-status {
  flex: 0 0 auto; font-size: 11px; padding: 3px 10px; border-radius: 999px;
  background: #eee9da; color: #8a8472; white-space: nowrap;
}
.up-status.st-compress, .up-status.st-upload { background: #fdf0d8; color: #9a7320; }
.up-status.st-done { background: #4c7a53; color: #fff; }
.up-status.st-fail { background: #f6e2de; color: #b4452f; }
.up-bar { height: 6px; border-radius: 999px; background: #eee9da; overflow: hidden; margin: 8px 0 0; }
.up-bar-fill { height: 100%; background: linear-gradient(90deg, #6f9a76, #4c7a53); transition: width 0.2s linear; }
.up-note { font-size: 11.5px; color: #4c7a53; margin-top: 6px; }
.up-err {
  font-size: 12px; color: #b4452f; margin-top: 6px;
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.up-fields { margin-top: 8px; }
.mini-btn {
  border: 1px solid #ddd6c4; background: #fff; color: #6b6456;
  border-radius: 7px; padding: 4px 9px; font-size: 11.5px; cursor: pointer;
}
.mini-btn:hover { background: #f6f1e3; }
.mini-btn.retry { border-color: #e4c9c2; color: #b4452f; background: #f9efec; }
.sub-head {
  font-size: 12px; font-weight: 700; color: #4c7a53;
  margin: 14px 0 4px; display: flex; justify-content: space-between; align-items: baseline;
}
.sub-head span { font-weight: 400; color: #8a8472; font-size: 11px; }
.card-head-ops { display: flex; align-items: center; gap: 5px; }
.mo-preview { margin-bottom: 8px; }
.mo-preview img, .mo-preview video {
  width: 100%; max-height: 120px; object-fit: cover; border-radius: 8px;
  background: #eee9da; display: block;
}
.mo-empty { font-size: 11px; color: #a39c88; }

/* ---------- ⑫ 动图制作 ---------- */
.seg { display: flex; gap: 6px; }
.seg button {
  flex: 1; border: 1px solid #ddd6c4; background: #fff; color: #6b6456;
  border-radius: 8px; padding: 7px; font-size: 12.5px; cursor: pointer;
}
.seg button.on { background: #2f3b2c; border-color: #2f3b2c; color: #f3efe6; font-weight: 700; }
.file-name { font-size: 11.5px; color: #8a8472; align-self: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gif-video { width: 100%; border-radius: 10px; background: #000; margin-bottom: 10px; display: block; }
.strip { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.strip img { width: 46px; height: 46px; object-fit: cover; border-radius: 7px; border: 1px solid #ece6d6; }
.strip-more { display: flex; align-items: center; font-size: 11px; color: #8a8472; }
.gif-result { text-align: center; margin-bottom: 10px; }
.gif-result img {
  max-width: 100%; max-height: 240px; border-radius: 10px;
  border: 1px solid #ece6d6; background:
    linear-gradient(45deg, #f0ece0 25%, transparent 25%, transparent 75%, #f0ece0 75%) 0 0 / 16px 16px,
    linear-gradient(45deg, #f0ece0 25%, transparent 25%, transparent 75%, #f0ece0 75%) 8px 8px / 16px 16px,
    #fff;
}
.gif-result-meta { font-size: 11.5px; color: #4c7a53; margin-top: 6px; }

/* ---------- ⑬ 经历速览 ---------- */
.req { color: #b4452f; font-weight: 700; }
.cc { float: right; font-weight: 400; color: #a39c88; font-size: 11px; }

/* ---------- ⑭ AI 音乐创作 ---------- */
.tk-audio { width: 100%; height: 34px; margin-bottom: 6px; display: block; }
.tk-src { margin-bottom: 8px; word-break: break-all; }
.tk-cover {
  display: block; width: 84px; height: 84px; object-fit: cover;
  border-radius: 8px; border: 1px solid #ece6d6; margin-top: 8px;
}
.tk-empty {
  border: 1px dashed #ddd6c4; border-radius: 10px; padding: 16px;
  text-align: center; font-size: 12px; color: #8a8472; margin-bottom: 12px;
}
.cc.over { color: #b4452f; font-weight: 700; }
.tl-hint { font-style: normal; font-weight: 400; color: #a39c88; font-size: 11px; margin-left: 4px; }
</style>
