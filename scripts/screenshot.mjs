#!/usr/bin/env node
/* 截图预览：node scripts/screenshot.mjs
   需要一次性安装: npm i -D playwright && npx playwright install chromium
   输出到 screenshots/ 目录：4 个页面 × 中英双语 × 首个预设 */
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'screenshots')
mkdirSync(outDir, { recursive: true })

let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  console.error('✗ 缺少 playwright。请先执行: npm i -D playwright && npx playwright install chromium')
  process.exit(1)
}

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const PAGES = [
  { path: '/', name: 'home' },
  { path: '/works', name: 'works' },
  { path: '/videos', name: 'videos' },
  { path: '/about', name: 'about' }
]
const LANGS = ['zh', 'en']

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

for (const lang of LANGS) {
  for (const p of PAGES) {
    await page.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle' })
    await page.evaluate((l) => localStorage.setItem('site-lang', l), lang)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: resolve(outDir, `${p.name}-${lang}.png`), fullPage: true })
    console.log(`✓ ${p.name} [${lang}]`)
  }
}

await browser.close()
console.log(`\n截图完成 → ${outDir}`)