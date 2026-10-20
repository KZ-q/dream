#!/usr/bin/env node
/* 冒烟验证：node scripts/smoke.mjs（需先 npm run preview 启动站点）
   用系统 Edge/Chrome 驱动站点，断言 4 页 × 2 语言 × 5 主题关键 DOM，收集控制台错误
   报告输出到 smoke-report.txt */
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { chromium } = await import('playwright-core')

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const CHANNELS = ['msedge', 'chrome']
let browser = null
for (const channel of CHANNELS) {
  try {
    browser = await chromium.launch({ channel, headless: true })
    console.log(`browser: ${channel}`)
    break
  } catch {
    /* try next */
  }
}
if (!browser) {
  console.error('✗ 未找到可用的系统 Edge/Chrome，请安装其一')
  process.exit(1)
}

const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})

const PRESETS = ['aurora', 'cyber', 'gold', 'paper', 'sunset']
const CASES = [
  { path: '/home', expect: () => page.locator('.hero .title').count(), name: 'home hero' },
  { path: '/works', expect: () => page.locator('.cell').count(), min: 1, name: 'works grid' },
  { path: '/videos', expect: () => page.locator('.item .frame').count(), min: 1, name: 'videos frames' },
  { path: '/about', expect: () => page.locator('.timeline li').count(), min: 1, name: 'about timeline' }
]
const t0 = Date.now()
const results = []

async function gotoApp(path, { lang, preset } = {}) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
  if (lang || preset) {
    await page.evaluate(
      ([l, p]) => {
        if (l) localStorage.setItem('site-lang', l)
        if (p) localStorage.setItem('site-preset', p)
      },
      [lang, preset]
    )
    await page.reload({ waitUntil: 'networkidle' })
  }
  try {
    await page.waitForSelector('[data-preset]', { timeout: 8000 })
  } catch {
    const body = (await page.locator('body').innerText().catch(() => '')).slice(0, 300)
    errors.push(`app 未就绪 @${path} body="${body}"`)
  }
}

for (const lang of ['zh', 'en']) {
  for (const preset of PRESETS) {
    for (const c of CASES) {
      await gotoApp(c.path, { lang, preset })
      await page.waitForTimeout(300)
      const got = await c.expect()
      const attr = await page.evaluate(() => document.documentElement.getAttribute('data-preset'))
      const ok = attr === preset && got >= (c.min || 1)
      results.push(`${ok ? '✓' : '✗'} ${c.name} [${lang}/${preset}] preset=${attr} nodes=${got}`)
      if (!ok) errors.push(`FAIL: ${c.name} lang=${lang} preset=${preset} attr=${attr} nodes=${got}`)
    }
  }
}

/* 语言切换实际生效检查 */
await gotoApp('/home', { lang: 'zh' })
const zhTitle = await page.locator('.hero .title').innerText().catch(() => '<missing>')
await gotoApp('/home', { lang: 'en' })
const enTitle = await page.locator('.hero .title').innerText().catch(() => '<missing>')
results.push(`${zhTitle !== enTitle ? '✓' : '✗'} i18n hero title differs (zh="${String(zhTitle).slice(0, 18)}…" en="${String(enTitle).slice(0, 18)}…")`)
if (zhTitle === enTitle) errors.push(`FAIL: i18n title identical (${zhTitle})`)

/* 灯箱交互 */
await gotoApp('/works', { lang: 'zh' })
await page.locator('.cell').first().click()
await page.waitForTimeout(400)
const lbOpen = await page.locator('.lb .body img').count()
results.push(`${lbOpen ? '✓' : '✗'} lightbox opens (${lbOpen})`)
if (!lbOpen) errors.push('FAIL: lightbox did not open')

/* ===== 交互路径测试（真实点击，非状态注入） ===== */

/* 1) 主题下拉：打开 → 选"暗金质感" → attr 变化且菜单自动关闭 */
await gotoApp('/home', { lang: 'zh', preset: 'aurora' })
await page.click('[data-testid="preset-btn"]')
const menuVisible = await page.locator('.theme-menu').count()
await page.click('[data-testid="preset-option"]:has-text("暗金质感")')
await page.waitForTimeout(250)
const presetAfterClick = await page.evaluate(() => document.documentElement.getAttribute('data-preset'))
const menuClosed = (await page.locator('.theme-menu').count()) === 0
const themeOk = menuVisible > 0 && presetAfterClick === 'gold' && menuClosed
results.push(`${themeOk ? '✓' : '✗'} theme dropdown click → gold, menu closes (menu=${menuVisible}, preset=${presetAfterClick}, closed=${menuClosed})`)
if (!themeOk) errors.push(`FAIL: theme dropdown menu=${menuVisible} preset=${presetAfterClick} closed=${menuClosed}`)

/* 2) 语言按钮实时切换（无 reload）：html[lang] + hero 文案同时变化 */
await page.click('.lang [data-lang="en"]')
await page.waitForTimeout(250)
const langAttr = await page.evaluate(() => document.documentElement.lang)
const heroAfterLang = await page.locator('.hero .title').innerText().catch(() => '<missing>')
const langOk = langAttr === 'en' && /painting/i.test(heroAfterLang)
results.push(`${langOk ? '✓' : '✗'} lang button click → live switch (lang=${langAttr})`)
if (!langOk) errors.push(`FAIL: lang click lang=${langAttr} hero="${String(heroAfterLang).slice(0, 30)}"`)

/* 3) 桌面导航真实点击 → /works（先切回 zh，链接文本为中文） */
await page.click('.lang [data-lang="zh"]')
await page.waitForTimeout(250)
await page.click('.links a:has-text("作品")')
await page.waitForURL('**/works', { timeout: 8000 })
await page.waitForTimeout(300)
const navCells = await page.locator('.grid .cell').count()
results.push(`${navCells === 8 ? '✓' : '✗'} nav click → /works (cells=${navCells})`)
if (navCells !== 8) errors.push(`FAIL: nav click cells=${navCells}`)

/* 4) tagbar 真实筛选（第 2 个标签） */
await page.click('[data-testid="tagbar"] button >> nth=1')
await page.waitForTimeout(700)
const filteredN = await page.locator('.grid .cell').count()
const tagOk = filteredN > 0 && filteredN < 8
results.push(`${tagOk ? '✓' : '✗'} tagbar filter click (${filteredN}/8 cells)`)
if (!tagOk) errors.push(`FAIL: tag filter n=${filteredN}`)

/* 5) 灯箱键盘：←→ 切换标题（多项时）、Esc 关闭 */
await page.locator('.grid .cell').first().click()
await page.waitForTimeout(400)
const lbT1 = await page.locator('.lb .meta h3').innerText().catch(() => '')
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(400)
const lbT2 = await page.locator('.lb .meta h3').innerText().catch(() => '')
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
const lbGone = (await page.locator('.lb').count()) === 0
const kbOk = lbGone && (filteredN < 2 ? lbT1 === lbT2 : lbT1 !== lbT2)
results.push(`${kbOk ? '✓' : '✗'} lightbox keyboard (←→ ${filteredN < 2 ? 'n/a(1 item)' : 'switches'}, Esc closes=${lbGone})`)
if (!kbOk) errors.push(`FAIL: lightbox kb t1="${lbT1}" t2="${lbT2}" closed=${lbGone}`)

/* 6) 视频 Facade 真实点击 → bilibili iframe 挂载 */
await page.goto(`${BASE}/videos`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.play', { timeout: 10000 })
await page.locator('.play').first().click()
await page.waitForSelector('.frame iframe', { timeout: 8000 })
const iframeSrc = (await page.locator('.frame iframe').first().getAttribute('src')) || ''
const facadeOk = /player\.bilibili\.com/.test(iframeSrc)
results.push(`${facadeOk ? '✓' : '✗'} facade click → bilibili iframe (${iframeSrc.slice(0, 52)}…)`)
if (!facadeOk) errors.push(`FAIL: facade iframe src=${iframeSrc}`)

/* 7) 直链 /about#contact → 内容加载完成后滚至联系区 */
await page.goto(`${BASE}/about#contact`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#contact', { timeout: 10000 })
await page.waitForTimeout(2200)
const hashY = await page.evaluate(() => window.scrollY)
const hashOk = hashY > 300
results.push(`${hashOk ? '✓' : '✗'} direct /about#contact scrolls (y=${Math.round(hashY)})`)
if (!hashOk) errors.push(`FAIL: hash scroll y=${hashY}`)

/* 8) 未知路由重定向首页 */
await page.goto(`${BASE}/no-such-page`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.hero', { timeout: 10000 })
const redirPath = await page.evaluate(() => location.pathname)
const redirOk = redirPath === '/'
results.push(`${redirOk ? '✓' : '✗'} catchall redirect (path=${redirPath})`)
if (!redirOk) errors.push(`FAIL: catchall path=${redirPath}`)

/* 9) 移动视口：burger 打开 → 点导航项 → 自动关闭 */
await page.setViewportSize({ width: 390, height: 844 })
await page.goto(`${BASE}/home`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.burger', { timeout: 10000 })
await page.click('.burger')
const mobileOpen = await page.locator('.mobile').count()
await page.locator('.mobile a').nth(1).click()
await page.waitForTimeout(700)
const mobileClosed = (await page.locator('.mobile').count()) === 0
const mobPath = await page.evaluate(() => location.pathname)
const mobOk = mobileOpen > 0 && mobileClosed && mobPath === '/works'
results.push(`${mobOk ? '✓' : '✗'} mobile burger menu (open→nav→auto-close, path=${mobPath})`)
if (!mobOk) errors.push(`FAIL: mobile menu open=${mobileOpen} closed=${mobileClosed} path=${mobPath}`)
await page.setViewportSize({ width: 1280, height: 720 })

await browser.close()
const report = results.join('\n')
console.log(report)
writeFileSync(resolve(root, 'smoke-report.txt'), report + '\n\nERRORS:\n' + errors.join('\n'), 'utf8')
if (errors.length) {
  console.error(`\n✗ ${errors.length} 个问题:\n` + errors.map((e) => `  - ${e}`).join('\n'))
  process.exit(1)
}
console.log(`\n✓ 冒烟验证通过（${results.length} 项，${((Date.now() - t0) / 1000).toFixed(1)}s），无控制台错误。`)