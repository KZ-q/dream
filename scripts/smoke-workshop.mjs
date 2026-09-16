#!/usr/bin/env node
/* 内容工坊冒烟验证（分屏版）：node scripts/smoke-workshop.mjs
   自动启动 vite dev（5199 端口）→ Edge/Chrome 驱动 /workshop：
   分屏结构 / iframe 预览渲染 / 实时联动（站名·JSON·hero·语言·主题·视口·页签双向）/ 本地图片上传入库+透明度调节 / 下载 / 导入 / 重置 / 保存写盘
   报告输出到 workshop-report.txt（gitignored） */
import { spawn, execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync, readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 5199
const BASE = `http://localhost:${PORT}`
const contentPath = resolve(root, 'public', 'content', 'content.json')
const backupPath = resolve(root, 'public', 'content', 'content.backup.json')
const uploadPath = resolve(root, 'public', 'assets', 'images', 'local.png')
const diskBackup = readFileSync(contentPath, 'utf8') /* 测试前磁盘快照：T13 保存写盘后还原，防测试污染源文件 */
const { chromium } = await import('playwright-core')

/* 1) 启动 dev server（直接以 node 运行 vite 入口，避免 Windows 上 spawn .cmd 的 EINVAL 限制） */
const vite = spawn(
  process.execPath,
  [resolve(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'],
  { cwd: root, stdio: 'ignore' }
)
let up = false
for (let i = 0; i < 30 && !up; i++) {
  await new Promise((r) => setTimeout(r, 500))
  up = await fetch(BASE).then((r) => r.ok).catch(() => false)
}
if (!up) {
  console.error('✗ dev server 未能在 15s 内就绪')
  try { execSync(`taskkill /PID ${vite.pid} /T /F`) } catch {}
  process.exit(1)
}

/* 2) 启动浏览器 */
let browser = null
for (const channel of ['msedge', 'chrome']) {
  try {
    browser = await chromium.launch({ channel, headless: true })
    break
  } catch {}
}
if (!browser) {
  console.error('✗ 未找到可用的系统 Edge/Chrome')
  execSync(`taskkill /PID ${vite.pid} /T /F`)
  process.exit(1)
}

const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})

const results = []
function check(name, ok, detail = '') {
  results.push(`${ok ? '✓' : '✗'} ${name}${detail ? ` (${detail})` : ''}`)
  if (!ok) errors.push(`FAIL: ${name} ${detail}`)
}
const tabBtn = (label) => page.locator(`.wk-tab:has-text("${label}")`)
const frame = page.frameLocator('.pv-frame')
/* 等待防抖推送（500ms）+ 渲染生效后断言的辅助 */
const waitLive = () => page.waitForTimeout(900)

try {
  /* T1 分屏结构：7 tab + 预览 iframe + 可拖拽分隔条 */
  await page.goto(`${BASE}/workshop`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.wk-bar', { timeout: 10000 })
  const tabCount = await page.locator('.wk-tab').count()
  check('workshop opens with 7 tabs', tabCount === 7, `tabs=${tabCount}`)
  check('split view: preview iframe present', (await page.locator('.pv-frame').count()) === 1)
  check('split view: resizable divider present', (await page.locator('.wk-divider').count()) === 1)
  const navHidden = (await page.locator('.app > .nav').count()) === 0
  check('workshop page hides site navbar', navHidden)

  /* T2 iframe 预览渲染完整站点（站点端 fetch + wk:hello 握手 + 工坊推送） */
  await frame.locator('.brand-name').first().waitFor({ timeout: 15000 })
  const heroText = await frame.locator('.hero .title').first().innerText()
  check('iframe preview renders home hero', heroText.trim().length > 0, `hero="${heroText.slice(0, 16)}"`)
  const frameNav = await frame.locator('.nav .nav-link').count()
  check('iframe shows full site navbar', frameNav > 0, `links=${frameNav}`)

  /* T3 下载 content.json（真实下载 + JSON 解析） */
  const tmp = mkdtempSync(resolve(tmpdir(), 'wk-'))
  const dlPath = resolve(tmp, 'content.json')
  const dlPromise = page.waitForEvent('download', { timeout: 5000 })
  await page.click('button:has-text("下载 content.json")')
  const dl = await dlPromise
  await dl.saveAs(dlPath)
  const onDisk = JSON.parse(readFileSync(dlPath, 'utf8'))
  check('download content.json is valid', !!onDisk?.site && !!onDisk?.home, `name=${dl.suggestedFilename()}`)

  /* T4 站点面板改 site.title.zh → iframe 品牌实时联动（防抖 500ms 推送） */
  await page.locator('.wk-panel-body .wk-row:has-text("标题") .wk-i18n input').first().fill('工坊测试站')
  await frame.locator('.brand-name', { hasText: '工坊测试站' }).first().waitFor({ timeout: 5000 })
  check('site title edit → live iframe brand', true)

  /* T5 JSON 面板：非法拒绝 + 合法应用后 iframe 联动 */
  await tabBtn('JSON 源码').click()
  await page.locator('.wk-json').fill('{ bad json')
  await page.click('.wk-add-bar button:has-text("应用")')
  await page.waitForTimeout(150)
  check('json panel rejects invalid', (await page.locator('.wk-error').count()) > 0)
  const edited = JSON.parse(JSON.stringify(onDisk))
  edited.site.title.zh = 'JSON测试站'
  await page.locator('.wk-json').fill(JSON.stringify(edited, null, 2))
  await page.click('.wk-add-bar button:has-text("应用")')
  await frame.locator('.brand-name', { hasText: 'JSON测试站' }).first().waitFor({ timeout: 5000 })
  check('json panel applies → live iframe brand', true)

  /* T6 首页区块改 hero 主标题 → iframe hero 联动 */
  await tabBtn('首页区块').click()
  await page.locator('.wk-card.section').first().locator('.wk-row:has-text("主标题") textarea').first().fill('工坊改的标题')
  await frame.locator('.hero .title', { hasText: '工坊改的标题' }).first().waitFor({ timeout: 5000 })
  check('hero edit → live iframe hero', true)

  /* T6b 图片本地上传：hero 主视觉图选本地 PNG → /api/upload 入库 public/assets/images/ → iframe hero 实时换图（src 填路径而非 dataURL） */
  const PNG1PX = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  )
  await page.locator('.wk-card.section').first().locator('input.wk-file').setInputFiles({
    name: 'local.png',
    mimeType: 'image/png',
    buffer: PNG1PX
  })
  await frame.locator('.hero .bg img[src="/assets/images/local.png"]').first().waitFor({ timeout: 5000 })
  check('local image upload → stored to assets & iframe hero swaps', existsSync(uploadPath), `fileOnDisk=${existsSync(uploadPath)}`)

  /* T6c 显示调整：不透明度滑块拖到 0.4 → iframe hero 图片 opacity 实时联动 */
  await page
    .locator('.wk-card.section')
    .first()
    .locator('.wk-adj input[type=range]')
    .first()
    .evaluate((el) => {
      el.value = '0.4'
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })
  await waitLive()
  const heroOp = await frame.locator('.hero .bg img').first().evaluate((el) => getComputedStyle(el).opacity)
  check('hero image opacity slider → iframe applied', Math.abs(parseFloat(heroOp) - 0.4) < 0.02, `opacity=${heroOp}`)

  /* T7 语言切换 → iframe html lang 实时联动（zh-CN ↔ en） */
  await page.selectOption('.wk-bar-actions select >> nth=0', 'en')
  await frame.locator('html[lang="en"]').first().waitFor({ timeout: 5000 })
  check('workshop lang → iframe switches to en', true)
  await page.selectOption('.wk-bar-actions select >> nth=0', 'zh')
  await frame.locator('html[lang="zh-CN"]').first().waitFor({ timeout: 5000 })
  check('workshop lang → back to zh', true)

  /* T8 预设切换 → iframe data-preset 实时联动 */
  await page.selectOption('.wk-bar-actions select >> nth=1', 'gold')
  await frame.locator('html[data-preset="gold"]').first().waitFor({ timeout: 5000 })
  check('workshop preset → iframe switches to gold', true)
  await page.selectOption('.wk-bar-actions select >> nth=1', 'aurora')
  await waitLive()

  /* T9 视口切换：手机 375px（iframe 仅改宽度，不重载） */
  await page.click('.vps button:has-text("手机")')
  await page.waitForTimeout(300)
  const box = await page.locator('.pv-frame').boundingBox()
  check('mobile viewport → 375px frame', !!box && Math.abs(box.width - 375) < 4, `w=${box?.width}`)

  /* T9b 回归：iframe 内窄视口汉堡菜单不得出现「工坊」入口（防嵌套；曾只判 isDev 漏了 inFrame） */
  await frame.locator('.burger').click()
  await page.waitForTimeout(300)
  const wkInMenu = await frame.locator('.mobile a:has-text("工坊")').count()
  const menuLinks = await frame.locator('.mobile a').count()
  check('iframe mobile burger menu has no workshop entry', wkInMenu === 0, `工坊项=${wkInMenu} 菜单项=${menuLinks}`)
  await frame.locator('.burger').click()
  /* 切回桌面，便于 T10 操作 iframe 内的桌面端导航 */
  await page.click('.vps button:has-text("桌面")')
  await page.waitForTimeout(300)

  /* T10 页签 → iframe SPA 路由；iframe 内点站点导航 → 工具条高亮回显（wk:route） */
  await page.click('.wk-pages .wk-page:has-text("作品")')
  await page.waitForTimeout(600)
  const child = page.frames().find((f) => f !== page.mainFrame() && f.url().includes('localhost'))
  const childUrl = child ? child.url() : ''
  check('page tab navigates iframe to /works', /\/works/.test(childUrl), `url=${childUrl}`)
  await frame.locator('.nav .nav-link', { hasText: '首页' }).first().click()
  await page.waitForTimeout(500)
  check('iframe nav click → toolbar tab highlight sync', (await page.locator('.wk-page.on:has-text("首页")').count()) === 1)

  /* T11 导入 JSON 文件 → 提示 + iframe 联动 */
  const importJson = resolve(tmp, 'import.json')
  const imported = JSON.parse(JSON.stringify(onDisk))
  imported.site.title.zh = '导入测试站'
  writeFileSync(importJson, JSON.stringify(imported, null, 2))
  await page.setInputFiles('.wk-bar-actions input[type=file]', importJson)
  await frame.locator('.brand-name', { hasText: '导入测试站' }).first().waitFor({ timeout: 5000 })
  const flash = await page.locator('.wk-flashbar').innerText().catch(() => '')
  check('import json applies → live iframe brand', /导入成功/.test(flash), `flash="${flash.slice(0, 12)}"`)

  /* T12 重置 → confirm → iframe 恢复磁盘版本 */
  page.once('dialog', (d) => d.accept())
  await page.click('button:has-text("重置")')
  await frame.locator('.brand-name', { hasText: '祺士' }).first().waitFor({ timeout: 5000 })
  check('reset restores disk content in preview', true)

  /* T13 保存：PUT /api/content 写回磁盘（studio/server.mjs dev 中间件）+ 写前自动备份上一版 */
  await tabBtn('站点').click()
  await page.locator('.wk-panel-body .wk-row:has-text("标题") .wk-i18n input').first().fill('保存测试站')
  await page.waitForTimeout(700) /* 越过防抖推送，dirty 生效、保存按钮解禁 */
  const [putRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/content') && r.request().method() === 'PUT', { timeout: 5000 }),
    page.locator('.wk-bar-actions button:has-text("保存")').click()
  ])
  const putBody = await putRes.json()
  check('save API responds ok', putBody?.ok === true, `backedUp=${putBody?.backedUp}`)
  check('save writes editor content to disk', readFileSync(contentPath, 'utf8').includes('保存测试站'))
  check('save auto-backs up previous version', existsSync(backupPath))
  await page.waitForTimeout(150)
  check('dirty dot clears after save', (await page.locator('.wk-dot.dirty').count()) === 0)
  check('saved-at indicator shows', /已保存/.test(await page.locator('.wk-saved').innerText().catch(() => '')))
  /* 还原磁盘现场（防测试污染源文件与仓库） */
  writeFileSync(contentPath, diskBackup)
  rmSync(backupPath, { force: true })

  rmSync(tmp, { recursive: true, force: true })

} catch (e) {
  errors.push(`EXCEPTION: ${e.message}`)
} finally {
  /* 兜底还原磁盘现场：content.json / 保存备份 / 测试上传的图片（T13 失败中断时也不留痕） */
  try { writeFileSync(contentPath, diskBackup) } catch {}
  try { rmSync(backupPath, { force: true }) } catch {}
  try { rmSync(uploadPath, { force: true }) } catch {}
  const report = [
    `# Workshop Smoke Report — ${new Date().toISOString()}`,
    '',
    ...results,
    '',
    `RESULT: ${results.filter((r) => r.startsWith('✓')).length}/${results.length} passed`,
    `ERRORS: ${errors.length === 0 ? 'none' : ''}`,
    ...errors.map((e) => `  - ${e}`),
    ''
  ].join('\n')
  writeFileSync(resolve(root, 'workshop-report.txt'), report)
  console.log(report)
  await browser.close().catch(() => {})
  try { execSync(`taskkill /PID ${vite.pid} /T /F`) } catch {}
  process.exit(errors.length ? 1 : 0)
}

