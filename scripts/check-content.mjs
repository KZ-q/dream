#!/usr/bin/env node
/* 内容校验：node scripts/check-content.mjs
   检查 content.json 的结构完整性：必需键、i18n 双语、图片引用、路由、BV 号等 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const file = resolve(root, 'public/content/content.json')
const errors = []
const warnings = []

let json
try {
  json = JSON.parse(readFileSync(file, 'utf8'))
} catch (e) {
  console.error(`✗ content.json 解析失败: ${e.message}`)
  process.exit(1)
}

const isI18n = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const dataUrlSizes = []
const assetOk = (src) => {
  const s = String(src || '')
  if (!s) return false
  /* 工坊「上传本地图片」以内嵌 dataURL 存图：直接放行并统计体积 */
  if (s.startsWith('data:image/')) {
    dataUrlSizes.push(s.length - s.indexOf(',') - 1)
    return true
  }
  return existsSync(resolve(root, 'public', s.replace(/^\/+/, '')))
}
function checkI18n(value, path) {
  if (value == null || value === '') return
  if (isI18n(value)) {
    const keys = Object.keys(value)
    /* 形如 {zh, en} 的文案对象：检查双语完整性 */
    if (keys.length && keys.every((k) => k === 'zh' || k === 'en')) {
      if (!value.zh || !value.en) errors.push(`${path}: 双语文案不完整 (zh=${!!value.zh}, en=${!!value.en})`)
      for (const k of keys) {
        if (typeof value[k] === 'string' && value[k].startsWith('__')) errors.push(`${path}.${k}: 疑似未替换的占位符 "${value[k]}"`)
      }
    }
  } else if (typeof value === 'string' && value.startsWith('__')) {
    errors.push(`${path}: 疑似未替换的占位符 "${value}"`)
  }
}
function walk(node, path, visit) {
  visit(node, path)
  if (Array.isArray(node)) node.forEach((n, i) => walk(n, `${path}[${i}]`, visit))
  else if (isI18n(node)) Object.entries(node).forEach(([k, v]) => walk(v, `${path}.${k}`, visit))
}

/* 1. 顶层结构 */
for (const key of ['site', 'theme', 'nav', 'footer', 'home', 'works', 'videos', 'about']) {
  if (!(key in json)) errors.push(`缺少顶层键 "${key}"`)
}

/* 2. site / nav / footer */
if (json.site) {
  checkI18n(json.site.title, 'site.title')
  const langs = json.site.languages || []
  if (!langs.includes(json.site.defaultLang)) errors.push('site.defaultLang 必须在 site.languages 中')
  if (!assetOk(json.site.logo)) errors.push(`site.logo 文件不存在: ${json.site.logo}`)
  for (const [i, s] of (json.site.socials || []).entries()) {
    if (!s.platform) errors.push(`site.socials[${i}] 缺少 platform`)
    if (!/^https?:|mailto:/.test(s.url || '')) errors.push(`site.socials[${i}].url 非法: ${s.url}`)
  }
}
for (const [i, n] of (json.nav || []).entries()) {
  if (!n.to || !n.to.startsWith('/')) errors.push(`nav[${i}].to 必须是站内路由: ${n.to}`)
  checkI18n(n.label, `nav[${i}].label`)
}

/* 3. home.sections：类型与字段 */
const SECTION_TYPES = ['hero', 'works', 'video', 'services', 'stats', 'ctaBanner']
for (const [i, s] of (json.home?.sections || []).entries()) {
  if (!SECTION_TYPES.includes(s.type)) errors.push(`home.sections[${i}] 未知类型 "${s.type}"（合法: ${SECTION_TYPES.join(', ')}）`)
  if (s.image?.src && !assetOk(s.image.src)) errors.push(`home.sections[${i}].image.src 文件不存在: ${s.image.src}`)
  if (s.cover?.src && !assetOk(s.cover.src)) errors.push(`home.sections[${i}].cover.src 文件不存在: ${s.cover.src}`)
  if (s.type === 'video' && !/^BV[0-9A-Za-z]{8,12}$/.test(s.bvid || '')) errors.push(`home.sections[${i}] (video) bvid 格式非法: ${s.bvid}`)
  for (const [j, c] of (s.cta || []).entries()) {
    if (!c.url) errors.push(`home.sections[${i}].cta[${j}] 缺少 url`)
    checkI18n(c.label, `home.sections[${i}].cta[${j}].label`)
  }
}

/* 4. works.items：封面 / 标签 / 描述 */
const routeSet = new Set((json.nav || []).map((n) => n.to))
for (const [i, w] of (json.works?.items || []).entries()) {
  if (!w.id) warnings.push(`works.items[${i}] 缺少 id（用于 key，建议补上）`)
  checkI18n(w.title, `works.items[${i}].title`)
  checkI18n(w.desc, `works.items[${i}].desc`)
  if (!assetOk(w.cover?.src)) errors.push(`works.items[${i}].cover.src 文件不存在: ${w.cover?.src}`)
  if (!Array.isArray(w.tags) || w.tags.length === 0) warnings.push(`works.items[${i}] 没有任何标签，将无法被筛选`)
}

/* 5. videos.items */
for (const [i, v] of (json.videos?.items || []).entries()) {
  if (!/^BV[0-9A-Za-z]{8,12}$/.test(v.bvid || '')) errors.push(`videos.items[${i}].bvid 格式非法: ${v.bvid}`)
  if (v.cover?.src && !assetOk(v.cover.src)) errors.push(`videos.items[${i}].cover.src 文件不存在: ${v.cover.src}`)
  checkI18n(v.title, `videos.items[${i}].title`)
}

/* 6. about */
const about = json.about || {}
if (about.avatar?.src && !assetOk(about.avatar.src)) errors.push(`about.avatar.src 文件不存在: ${about.avatar.src}`)
checkI18n(about.role, 'about.role')
for (const [i, p] of (about.bio || []).entries()) checkI18n(p, `about.bio[${i}]`)
for (const [gi, g] of (about.skills?.groups || []).entries()) {
  for (const [si, s] of (g.items || []).entries()) {
    const lv = s.level
    if (typeof lv !== 'number' || lv < 0 || lv > 100) errors.push(`about.skills.groups[${gi}].items[${si}].level 必须是 0-100 的数字: ${lv}`)
  }
}

/* 7. footer 链接存在性（仅提示） */
for (const [i, l] of (json.footer?.links || []).entries()) {
  const base = (l.to || '').split('#')[0]
  if (base.startsWith('/') && base !== '/' && !routeSet.has(base)) warnings.push(`footer.links[${i}].to "${base}" 不在 nav 路由中（确认页面存在）`)
}

/* 8. 内嵌 dataURL 图片总体积（仅提醒，不计错误） */
const embeddedKB = Math.round((dataUrlSizes.reduce((a, b) => a + b, 0) * 0.75) / 1024)
if (embeddedKB > 3072) {
  warnings.push(`content.json 内嵌图片 dataURL 共约 ${Math.round((embeddedKB / 1024) * 10) / 10} MB，会拖慢首屏加载；建议压缩后改存 public/assets 并填写路径`)
}

/* 汇总 */
walk(json, 'root', checkI18n)
if (warnings.length) {
  console.warn(`⚠ ${warnings.length} 个警告:`)
  warnings.forEach((w) => console.warn(`  - ${w}`))
}
if (errors.length) {
  console.error(`✗ ${errors.length} 个错误:`)
  errors.forEach((e) => console.error(`  - ${e}`))
  process.exit(1)
}
console.log('✓ content.json 校验通过：结构完整、图片与 BV 号均有效。')