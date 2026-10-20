#!/usr/bin/env node
/* 深链回退（postbuild）—— 双版本构建的后处理
 *
 * 背景：本项目是 History 路由的 Vue SPA。
 *   - 站内点击跳转全靠 JS，不需要服务端配合，所以「能点」一直没问题；
 *   - 但**直接粘贴子地址、或在子页面按刷新**时，浏览器会向服务器要 /about 这类真实文件。
 *   - Cloudflare Pages / 腾讯 EdgeOne / Netlify 会读 dist/_redirects 做回退，所以那边不用管；
 *   - 纯静态托管（WorkBuddy 内置静态服务、python -m http.server 等）**不解析 _redirects**，会直接 404。
 *
 * 做法：为每个静态路由生成 <route>/index.html（内容 = index.html 的副本），
 *      再额外放一份根目录 404.html 兜底。两类托管就都能深链直达了。
 *
 * 双版本（2026-10-20 起）：
 *   node scripts/spa-fallback.mjs                   → 基础版（dist/，不含工坊模块）
 *   node scripts/spa-fallback.mjs --target workshop → 工坊版（dist-workshop/，含 /workshop/edit 编辑器）
 *   基础版会从 dist/workshop/index.html 摘掉顶栏的工坊入口按钮；工坊版保留。
 *
 * ⚠️ 路由表变了就同步改下面的 ROUTES（对应 src/router/index.js）。
 * ⚠️ 千万别把 'workshop' 加进来 —— dist/workshop/ 是作品站自己的真实目录，
 *    覆盖它的 index.html 会把作品站换成 Vue 外壳，作品站就废了。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const argv = process.argv.slice(2)
const tIdx = argv.indexOf('--target')
const TARGET = tIdx >= 0 ? argv[tIdx + 1] : 'basic'
if (TARGET !== 'basic' && TARGET !== 'workshop') {
  console.error(`[spa-fallback] 未知 target: ${TARGET}（可选 basic / workshop）`)
  process.exit(1)
}
const DIST = resolve(process.cwd(), TARGET === 'workshop' ? 'dist-workshop' : 'dist')
const ENTRY = join(DIST, 'index.html')

/* 与 src/router/index.js 的静态路由一一对应。
   两版都含 workshop/edit 的回退文件：
   - 工坊版：深链直达编辑器；
   - 基础版：SPA 启动后由路由重定向回 /workshop（否则浏览器直链接该路径会 404）。 */
const ROUTES = ['home', 'works', 'videos', 'about', 'workshop/edit']

if (!existsSync(ENTRY)) {
  console.error(`[spa-fallback] 找不到 ${ENTRY} —— 请先跑 vite build`)
  process.exit(1)
}

const shell = readFileSync(ENTRY)

for (const route of ROUTES) {
  const dir = join(DIST, route)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), shell)
  console.log(`[spa-fallback] ${route}/index.html`)
}

/* 基础版：摘掉作品站顶栏的工坊入口按钮（工坊版保留，入口才能打开编辑器） */
if (TARGET === 'basic') {
  const wkHtml = join(DIST, 'workshop', 'index.html')
  if (existsSync(wkHtml)) {
    const html = readFileSync(wkHtml, 'utf8')
    const stripped = html.replace(/[ \t]*<a href="edit"[^>]*class="card-nav-workshop"[^>]*>.*?<\/a>\r?\n/, '')
    if (stripped !== html) {
      writeFileSync(wkHtml, stripped)
      console.log('[spa-fallback] 基础版：已移除工坊入口按钮（workshop/index.html）')
    } else {
      console.warn('[spa-fallback] 警告：基础版未匹配到工坊入口按钮，请检查 public/workshop/index.html 结构')
    }
  }
}

/* 404 兜底：有些静态托管会用根目录的 404.html 当错误页 */
writeFileSync(join(DIST, '404.html'), shell)
console.log('[spa-fallback] 404.html（兜底）')
console.log(`[spa-fallback] 完成（${TARGET}），共 ${ROUTES.length + 1} 个回退文件`)
