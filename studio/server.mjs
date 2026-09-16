import fs from 'node:fs'
import path from 'node:path'

/* ============================================================
 * 内容工坊本地端点（Vite 中间件，apply:'serve' 仅 dev 挂载，构建零残留）
 *   GET  /api/content  读取 public/content/content.json
 *   PUT  /api/content  校验后写回；写前自动备份上一版 → content.backup.json
 *   POST /api/upload   图片入库 public/assets/images/（同名覆盖即替换）
 *   GET  /api/images   图库列表（按修改时间倒序）
 * 仅绑定 localhost（由 Vite dev server 保证）；上传文件名白名单防目录穿越。
 * ============================================================ */

const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg'])
const MAX_IMG = 5 * 1024 * 1024

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > 64 * 1024 * 1024) {   /* 背景视频上传走 base64（体积 +1/3），16MB 会误伤 ~12MB 的视频 → 放宽到 64MB */
        reject(new Error('payload too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function json(res, code, obj) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(obj))
}

export function workshopServer() {
  const root = process.cwd()
  const contentFile = path.join(root, 'public', 'content', 'content.json')
  const backupFile = path.join(root, 'public', 'content', 'content.backup.json')
  const imagesDir = path.join(root, 'public', 'assets', 'images')

  return {
    name: 'workshop-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next()
        const pathname = req.url.split('?')[0]

        ;(async () => {
          try {
            /* ---- GET /api/content ---- */
            if (pathname === '/api/content' && req.method === 'GET') {
              if (!fs.existsSync(contentFile)) return json(res, 404, { error: 'content.json not found' })
              const content = JSON.parse(fs.readFileSync(contentFile, 'utf8'))
              return json(res, 200, { content })
            }

            /* ---- PUT /api/content ---- */
            if (pathname === '/api/content' && req.method === 'PUT') {
              const body = JSON.parse(await readBody(req))
              const c = body?.content
              if (!c || typeof c !== 'object' || !c.site || !c.home) {
                return json(res, 400, { error: 'Invalid content structure (site/home required)' })
              }
              let backedUp = false
              if (fs.existsSync(contentFile)) {
                fs.copyFileSync(contentFile, backupFile)
                backedUp = true
              }
              fs.writeFileSync(contentFile, JSON.stringify(c, null, 2) + '\n', 'utf8')
              return json(res, 200, { ok: true, backedUp })
            }

            /* ---- POST /api/upload ---- */
            if (pathname === '/api/upload' && req.method === 'POST') {
              const body = JSON.parse(await readBody(req))
              const raw = String(body?.name || '')
              const base = path.basename(raw)
              const name = base.replace(/[^\w.\-\u4e00-\u9fa5 ]/g, '_').trim()
              const ext = path.extname(name).toLowerCase()
              if (!name || !IMG_EXT.has(ext)) {
                return json(res, 400, { error: '仅支持 png / jpg / webp / gif / avif / svg 图片' })
              }
              const buf = Buffer.from(String(body?.data || '').split(',').pop() || '', 'base64')
              if (!buf.length) return json(res, 400, { error: '空文件' })
              if (buf.length > MAX_IMG) return json(res, 400, { error: '图片超过 5MB，请先压缩' })
              fs.mkdirSync(imagesDir, { recursive: true })
              fs.writeFileSync(path.join(imagesDir, name), buf)
              return json(res, 200, { ok: true, path: `/assets/images/${name}`, size: buf.length, overwritten: true })
            }

            /* ---- GET /api/images ---- */
            if (pathname === '/api/images' && req.method === 'GET') {
              fs.mkdirSync(imagesDir, { recursive: true })
              const images = fs
                .readdirSync(imagesDir)
                .filter((f) => IMG_EXT.has(path.extname(f).toLowerCase()))
                .map((f) => {
                  const st = fs.statSync(path.join(imagesDir, f))
                  return { name: f, path: `/assets/images/${f}`, size: st.size, mtime: st.mtimeMs }
                })
                .sort((a, b) => b.mtime - a.mtime)
              return json(res, 200, { images })
            }

            /* ---- 孔诸祺作品站（/workshop）独立内容端点 ---- */
            const wsContent = path.join(root, 'public', 'workshop', 'content.json')
            const wsDefault = path.join(root, 'public', 'workshop', 'content.default.json')
            const wsBackup = path.join(root, 'public', 'workshop', 'content.backup.json')
            const wsImgs = path.join(root, 'public', 'workshop', 'assets', 'images')
            const wsVids = path.join(root, 'public', 'workshop', 'assets', 'videos')
            const wsAuds = path.join(root, 'public', 'workshop', 'assets', 'audio')
            const VID_EXT = new Set(['.mp4', '.webm', '.mov', '.m4v'])
            const MAX_VID = 200 * 1024 * 1024
            const AUD_EXT = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'])
            const MAX_AUD = 30 * 1024 * 1024

            /* GET /api/workshop/content */
            if (pathname === '/api/workshop/content' && req.method === 'GET') {
              if (!fs.existsSync(wsContent)) return json(res, 404, { error: 'workshop content.json not found' })
              return json(res, 200, { content: JSON.parse(fs.readFileSync(wsContent, 'utf8')) })
            }
            /* PUT /api/workshop/content（写前自动备份上一版） */
            if (pathname === '/api/workshop/content' && req.method === 'PUT') {
              const body = JSON.parse(await readBody(req))
              const c = body?.content
              if (!c || typeof c !== 'object' || !c.hero || !c.works || !c.contact) {
                return json(res, 400, { error: 'Invalid workshop content (hero/works/contact required)' })
              }
              let backedUp = false
              if (fs.existsSync(wsContent)) { fs.copyFileSync(wsContent, wsBackup); backedUp = true }
              fs.writeFileSync(wsContent, JSON.stringify(c, null, 2) + '\n', 'utf8')
              return json(res, 200, { ok: true, backedUp })
            }
            /* POST /api/workshop/restore（从 content.default.json 还原） */
            if (pathname === '/api/workshop/restore' && req.method === 'POST') {
              if (!fs.existsSync(wsDefault)) return json(res, 404, { error: 'default not found' })
              fs.copyFileSync(wsDefault, wsContent)
              return json(res, 200, { ok: true })
            }
            /* POST /api/workshop/upload  { name, data(base64), kind:'image'|'video'|'audio' } */
            if (pathname === '/api/workshop/upload' && req.method === 'POST') {
              const body = JSON.parse(await readBody(req))
              const kind = body?.kind === 'video' ? 'video' : body?.kind === 'audio' ? 'audio' : 'image'
              const extSet = kind === 'video' ? VID_EXT : kind === 'audio' ? AUD_EXT : IMG_EXT
              const max = kind === 'video' ? MAX_VID : kind === 'audio' ? MAX_AUD : MAX_IMG
              const dir = kind === 'video' ? wsVids : kind === 'audio' ? wsAuds : wsImgs
              const base = path.basename(String(body?.name || ''))
              const name = base.replace(/[^\w.\-\u4e00-\u9fa5 ]/g, '_').trim()
              const ext = path.extname(name).toLowerCase()
              if (!name || !extSet.has(ext)) {
                const hint = kind === 'video' ? '仅支持 mp4 / webm / mov / m4v 视频'
                  : kind === 'audio' ? '仅支持 mp3 / wav / m4a / aac / ogg / flac 音频'
                  : '仅支持 png / jpg / webp / gif / avif / svg 图片'
                return json(res, 400, { error: hint })
              }
              const buf = Buffer.from(String(body?.data || '').split(',').pop() || '', 'base64')
              if (!buf.length) return json(res, 400, { error: '空文件' })
              const sizeHint = kind === 'video' ? '视频超过 200MB' : kind === 'audio' ? '音频超过 30MB' : '图片超过 5MB'
              if (buf.length > max) return json(res, 400, { error: sizeHint + '，请先压缩' })
              fs.mkdirSync(dir, { recursive: true })
              fs.writeFileSync(path.join(dir, name), buf)
              const rel = kind === 'video' ? `assets/videos/${name}` : kind === 'audio' ? `assets/audio/${name}` : `assets/images/${name}`
              return json(res, 200, { ok: true, path: rel, size: buf.length })
            }

            return json(res, 404, { error: 'Not found' })
          } catch (err) {
            return json(res, 500, { error: String(err?.message || err) })
          }
        })()
      })
    }
  }
}
