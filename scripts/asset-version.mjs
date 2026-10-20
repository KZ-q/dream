/**
 * 给 public/workshop 下的静态资源引用加内容哈希版本号（?v=xxxxxxxx）。
 *
 * 为什么要做：workshop/index.html 里是 <link href="css/style.css">、<script src="js/main.js">
 * 这类「文件名固定」的引用。Vite 只给 src/ 下的产物加 hash，public/ 是原样拷贝的，
 * 所以改完样式后浏览器可能继续用本地缓存的旧 style.css —— 表现为「线上已更新，用户端看不到」。
 * 给引用加上随文件内容变化的 ?v= 后，内容一变 URL 就变，缓存自动失效。
 *
 * 必须在 spa-fallback.mjs 之前运行：spa-fallback 会把 index.html 当 shell 复制到各路由目录，
 * 先打版本号才能复制到所有副本上。
 *
 * 用法：node scripts/asset-version.mjs [--target basic|workshop]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { createHash } from 'node:crypto'

const args = process.argv.slice(2)
const argTarget = args[args.indexOf('--target') + 1]
const TARGET = argTarget === 'workshop' ? 'workshop' : 'basic'
const DIST = TARGET === 'workshop' ? 'dist-workshop' : 'dist'

/** 需要处理的文件（相对 DIST） */
const PAGES = ['workshop/index.html']

/* 只处理站内相对引用的 css / js，https?:// 与 // 开头的外链不动 */
const REF_RE = /(href|src)="((?:css|js|vendor)\/[^"]+\.(?:css|js))"/g

function hashOf(absPath) {
  return createHash('md5').update(readFileSync(absPath)).digest('hex').slice(0, 8)
}

let total = 0

for (const page of PAGES) {
  const pagePath = join(DIST, page)
  if (!existsSync(pagePath)) {
    console.warn(`[asset-version] 跳过（不存在）：${pagePath}`)
    continue
  }

  const baseDir = dirname(pagePath)
  const html = readFileSync(pagePath, 'utf8')

  /* 幂等：先把上一轮加的 ?v= 剥掉，避免叠加成 ?v=a?v=b */
  const cleaned = html.replace(REF_RE, (m, attr, url) => {
    const pure = url.split('?')[0]
    return `${attr}="${pure}"`
  })

  const out = cleaned.replace(REF_RE, (m, attr, url) => {
    const abs = join(baseDir, url)
    if (!existsSync(abs)) {
      console.warn(`[asset-version] 引用文件缺失，保持原样：${url}`)
      return m
    }
    total += 1
    return `${attr}="${url}?v=${hashOf(abs)}"`
  })

  if (out !== html) {
    writeFileSync(pagePath, out)
    console.log(`[asset-version] ${page} → 已加版本号`)
  } else {
    console.log(`[asset-version] ${page} → 无变化`)
  }
}

console.log(`[asset-version] 完成（${TARGET}），共 ${total} 个资源引用`)
