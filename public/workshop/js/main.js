/* ============================================================
   孔诸祺 · AIGC 影像创作 — 交互脚本（数据驱动版）
   功能：
   1) 启动画面（Splash）2) 滚动进度条 3) 分层视差 4) 滚动淡入
   5) 导航高亮 6) 视频弹窗（本地视频 / B站外链）
   7) 内容绑定：从 content.json 渲染，并支持工坊实时预览（postMessage）
   8) Animated Footer：Lenis 平滑滚动 + GSAP SplitText + ASCII 双手
   9) MagicBento 粒子边框：能力卡边框辉光 + 悬停微粒（react-bits 克制版移植）
  10) AI 音乐创作：音频作品卡试听（视觉与「碎片实验」同族）
   ============================================================ */

/* ---------- 0) Lenis 平滑滚动 + GSAP/ScrollTrigger（Animated Footer 基座） ---------- */
/* 防御：vendor 库缺失时全站其余功能照常（footer 增强自动跳过） */
const hasFooterLibs = (typeof gsap !== 'undefined') && (typeof ScrollTrigger !== 'undefined') && (typeof Lenis !== 'undefined')
let lenis = null
if (hasFooterLibs) {
  gsap.registerPlugin(ScrollTrigger)
  lenis = new Lenis({ lerp: 0.09 })
  lenis.on('scroll', ScrollTrigger.update)
  /* 守卫：prefers-reduced-motion 下（§11.6）lenis 会被 destroy 并置 null，
     但 ticker 回调仍在每帧执行 —— 不加守卫会 60fps 刷 "Cannot read properties of null (reading 'raf')" */
  gsap.ticker.add((t) => { if (lenis) lenis.raf(t * 1000) })
  gsap.ticker.lagSmoothing(0)
}
/* 锚点跳转交给 Lenis（原生锚跳与平滑滚动会打架）；href="#" 的空链接放行 */
document.addEventListener('click', (e) => {
  if (!lenis) return
  const a = e.target.closest('a[href^="#"]')
  if (!a) return
  const id = a.getAttribute('href')
  if (!id || id.length < 2) return
  const el = document.querySelector(id)
  if (el) { e.preventDefault(); lenis.scrollTo(el) }
})

/* 取嵌套字段：get(obj,'hero.title1') */
function get(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)
}
/* \n 转 <br>（保留换行可读） */
function nl2br(s) { return String(s == null ? '' : s).replace(/\n/g, '<br>') }

/* 从用户输入（可能是一整条 B站链接）中取出 BV 号 */
function extractBvid(s) {
  if (!s) return ''
  const str = String(s)
  /* BV 号长度固定 = BV + 10 位。先精确匹配，避免标题前缀里恰好含 "BVxxx" 时被抢先命中 */
  const exact = str.match(/BV[0-9A-Za-z]{10}/)
  if (exact) return exact[0]
  /* 回退：宽松匹配（兼容小写输入 / B站将来改长度） */
  const loose = str.match(/BV[0-9A-Za-z]+/i)
  return loose ? loose[0] : str.trim()
}
/* B站播放器 iframe HTML（自动兼容「整条链接 / 纯 BV 号」两种写法） */
function biliIframe(input) {
  const bvid = extractBvid(input)
  if (!bvid) return ''
  const src = `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&page=1&high_quality=1&danmaku=0&autoplay=0`
  return `<iframe src="${src}" scrolling="no" allowfullscreen="true" frameborder="0"
    style="width:100%;aspect-ratio:16/9;border:0;border-radius:12px;"></iframe>`
}

/* ---------- 渲染作品卡 ---------- */
function renderWorks(works) {
  const grid = document.getElementById('worksGrid')
  if (!grid || !Array.isArray(works)) return
  grid.innerHTML = works.map((w) => `
    <article class="work-card reveal"
      data-title="${w.title || ''}"
      data-local="${w.local || ''}"
      data-bilibili="${escHtml(w.bilibili || '')}">
      <div class="work-cover">
        <span class="work-no">${w.no || ''}</span>
        <img src="${w.cover || ''}" alt="${(w.title || '').replace(/"/g, '')} 封面" loading="lazy" />
        <span class="work-play">▶ 播放短片</span>
      </div>
      <div class="work-info">
        <h3>${w.title || ''}</h3>
        <p>${w.desc || ''}</p>
        <div class="work-tags">${(w.tags || []).map((t) => `<span>${t}</span>`).join('')}</div>
        <button class="work-play-btn" type="button">▶ 播放短片</button>
      </div>
    </article>`).join('')
  // 重新挂淡入观察（新元素需要重新 observe）
  grid.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el))
}

/* ---------- 渲染手记列表 ---------- */
function renderTopics(topics) {
  const box = document.getElementById('topicsList')
  if (!box || !Array.isArray(topics)) return
  box.innerHTML = topics.map((t) => `
    <div class="topic-row">
      <span class="topic-date">${t.date || ''}</span>
      <span class="topic-title">${t.title || ''}</span>
    </div>`).join('')
}

/* ---------- 渲染影片区（B站外链优先，懒加载） ---------- */
function renderMovie(movie) {
  const box = document.getElementById('movieBlock')
  if (!box || !movie) return
  let media
  if (movie.bilibili) {
    // 懒加载：先放封面+播放按钮，点击再挂 B站 iframe（减少首屏请求）
    media = `<div class="video-lazy" data-bili="${escHtml(movie.bilibili)}" style="background-image:url('${movie.poster || ''}')">
      <span class="video-lazy-play">▶ 播放</span></div>`
  } else if (movie.local) {
    media = `<video controls preload="metadata" poster="${movie.poster || ''}">
         <source src="${movie.local}" type="video/mp4" />
         你的浏览器不支持视频播放，请更换现代浏览器（如 Chrome / Edge）。
       </video>`
  } else {
    media = `<div class="video-lazy video-lazy-empty" style="background-image:url('${movie.poster || ''}')">
      <span class="video-lazy-play">视频外链待补充</span></div>`
  }
  // 有 B站链接时，提供「在 B站观看」外链（新标签页打开，不阻塞站内加载）
  const biliBtn = movie.bilibili
    ? `<a class="bili-link" href="https://www.bilibili.com/video/${encodeURIComponent(extractBvid(movie.bilibili))}" target="_blank" rel="noopener">↗ 在 B站观看</a>`
    : ''
  box.innerHTML = `
    <div class="video-feature-media">${media}</div>
    <div class="video-feature-info">
      <h3>${movie.title || ''}</h3>
      <p>${movie.desc || ''}</p>
      <div class="video-actions">
        <a href="#works" class="link-more">VIEW ALL WORKS <span>→</span></a>
        ${biliBtn}
      </div>
    </div>`
}

/* ---------- 渲染动图板块（竖屏静音循环；数据为空时整块隐藏） ---------- */
function renderMotion(list) {
  const block = document.getElementById('motionBlock')
  const grid = document.getElementById('motionGrid')
  if (!block || !grid) return
  if (!Array.isArray(list) || !list.length) { block.style.display = 'none'; return }
  block.style.display = ''
  grid.innerHTML = list.map((m) => `
    <article class="motion-card reveal" data-src="${m.src || ''}" data-title="${(m.title || '').replace(/"/g, '')}"
      tabindex="0" role="button" aria-label="播放有声版：${(m.title || '').replace(/"/g, '')}">
      <div class="motion-media"${m.aspect ? ` style="aspect-ratio:${m.aspect}"` : ''}>
        <video src="${m.src || ''}" muted loop playsinline preload="metadata" aria-hidden="true"></video>
        <span class="motion-badge">LOOP</span>
        <span class="motion-sound">♪ 点击看有声版</span>
      </div>
      <div class="motion-info">
        <h4>${m.title || ''}</h4>
        <p>${m.desc || ''}</p>
        ${(m.tags && m.tags.length) ? `<div class="motion-tags">${m.tags.map((t) => `<span>${t}</span>`).join('')}</div>` : ''}
      </div>
    </article>`).join('')
  grid.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el))
  setupMotionVideos(grid)
}

/* 动图自动播放管家：进视口才播、出视口即停（省流量也省电）；「减少动态」用户停在首帧 */
let motionIO = null
const motionRM = window.matchMedia('(prefers-reduced-motion: reduce)')
function setupMotionVideos(scope) {
  const vids = scope.querySelectorAll('.motion-media video')
  if (!vids.length || motionRM.matches) return
  if (!('IntersectionObserver' in window)) { vids.forEach((v) => v.play().catch(() => {})); return }
  motionIO?.disconnect()
  motionIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      const v = en.target
      if (en.isIntersecting) v.play().catch(() => {})
      else v.pause()
    })
  }, { rootMargin: '120px 0px', threshold: 0.2 })
  vids.forEach((v) => motionIO.observe(v))
}
/* 切后台暂停；回来时仍在视口内的续播 */
document.addEventListener('visibilitychange', () => {
  if (motionRM.matches) return
  const vids = document.querySelectorAll('.motion-media video')
  if (document.hidden) { vids.forEach((v) => v.pause()); return }
  vids.forEach((v) => {
    const r = v.getBoundingClientRect()
    if (r.bottom > 0 && r.top < window.innerHeight) v.play().catch(() => {})
  })
})

/* ============================================================
   10.2) AI 音乐创作：音频作品卡（视觉与「碎片实验」同族）
   - 音频不能自动播放 → 点击卡片试听；全局共用一个 <audio>，同一时刻只响一首
   - 播放中：均衡器动画 + 进度条推进；点击进度条跳转；←/→ 快退快进 5s
   - 键盘：Enter / 空格 播放暂停（卡片 role=button）
   - 数据：content.json 的 tracks[]（title/desc/src/cover/tags）
     无数据时整块隐藏；编辑器预览态（?nowelcome=1 或收到 wk:content）显示空态引导
   ============================================================ */
const musicAudio = new Audio()
musicAudio.preload = 'none'
/* 播放态挂在单例上，实时预览重建 DOM 也不会出现两只在响 */
let musicActive = null            /* 当前卡片元素 */
let wkPreviewMode = new URLSearchParams(location.search).has('nowelcome')

function fmtClock(sec) {
  const s = Math.max(0, Math.floor(sec || 0))
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}
function musicMarkPlaying(card) {
  if (musicActive && musicActive !== card) musicSetIdle(musicActive)
  musicActive = card
  card.classList.add('playing')
  card.setAttribute('aria-pressed', 'true')
  const fill = card.querySelector('.music-progress-fill')
  if (fill) fill.style.width = '0%'
  const hint = card.querySelector('.music-hint')
  if (hint) hint.textContent = '❚❚ 点击暂停'
  const st = card.querySelector('.m-state')
  if (st) st.textContent = 'PLAYING'
}
function musicSetIdle(card) {
  card.classList.remove('playing')
  card.setAttribute('aria-pressed', 'false')
  const fill = card.querySelector('.music-progress-fill')
  if (fill) fill.style.width = '0%'
  const cur = card.querySelector('.t-cur')
  if (cur) cur.textContent = '0:00'
  const hint = card.querySelector('.music-hint')
  if (hint) hint.textContent = '▶ 点击试听'
  const st = card.querySelector('.m-state')
  if (st) st.textContent = 'PAUSED'
}
/* 播放 / 暂停（同曲切暂停，异曲换源从头播） */
function musicToggle(card) {
  const src = card.dataset.src
  if (!src) return
  const same = musicAudio.dataset.src === src
  if (same && !musicAudio.paused) {
    musicAudio.pause()
    musicSetIdle(card)
    if (musicActive === card) musicActive = null
    return
  }
  if (!same) {
    musicAudio.src = src
    musicAudio.dataset.src = src
    musicAudio.currentTime = 0
  }
  musicMarkPlaying(card)
  musicAudio.play().catch(() => {           /* 自动播放被拦或文件缺失 → 回到待播态 */
    musicSetIdle(card)
    if (musicActive === card) musicActive = null
  })
}
musicAudio.addEventListener('timeupdate', () => {
  if (!musicActive) return
  const d = musicAudio.duration || 0
  const fill = musicActive.querySelector('.music-progress-fill')
  if (fill) fill.style.width = (d ? (musicAudio.currentTime / d) * 100 : 0) + '%'
  const cur = musicActive.querySelector('.t-cur')
  if (cur) cur.textContent = fmtClock(musicAudio.currentTime)
})
musicAudio.addEventListener('loadedmetadata', () => {
  if (!musicActive) return
  const dur = musicActive.querySelector('.t-dur')
  if (dur) dur.textContent = fmtClock(musicAudio.duration)
})
musicAudio.addEventListener('ended', () => {
  if (!musicActive) return
  const card = musicActive
  musicSetIdle(card)
  card.querySelector('.t-cur').textContent = '0:00'
  musicActive = null
})

function renderMusic(list) {
  const block = document.getElementById('musicBlock')
  const grid = document.getElementById('musicGrid')
  if (!block || !grid) return
  const items = Array.isArray(list) ? list.filter((t) => t && (t.src || t.title)) : []
  if (!items.length) {
    /* 空：公开站点整块不出现（不留空白版块）；编辑器预览态给出上传引导 */
    block.hidden = !wkPreviewMode
    grid.innerHTML = wkPreviewMode
      ? `<div class="music-empty"><strong>还没有音乐作品</strong>
           <span>打开顶栏 ⚙ 工坊 → 「⑭ AI 音乐创作」，上传作品文件（mp3 / wav / m4a…）并填写标题、简介与标签，保存后就会出现在这里。</span></div>`
      : ''
    if (!wkPreviewMode && musicActive) { musicAudio.pause(); musicActive = null }
    return
  }
  block.hidden = false
  grid.innerHTML = items.map((t, i) => `
    <article class="music-card reveal" data-idx="${i}" data-src="${escHtml(t.src || '')}"
      tabindex="0" role="button" aria-pressed="false"
      aria-label="试听：${escHtml(t.title || '未命名音轨')}">
      <div class="music-cover">
        ${t.cover ? `<img src="${escHtml(t.cover)}" alt="" loading="lazy" />` : '<div class="music-cover-art" aria-hidden="true"></div>'}
        <span class="music-badge">TRACK ${String(i + 1).padStart(2, '0')}</span>
        <span class="music-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span class="music-play" aria-hidden="true"><span class="ic-play">▶</span><span class="ic-pause">❚❚</span></span>
        <span class="music-hint">▶ 点击试听</span>
      </div>
      <div class="music-seek"><div class="music-progress"><div class="music-progress-fill"></div></div></div>
      <div class="music-info">
        <h4>${escHtml(t.title || '未命名音轨')}</h4>
        ${t.desc ? `<p>${escHtml(t.desc)}</p>` : ''}
        <div class="music-meta"><span class="m-state">PAUSED</span><span><span class="t-cur">0:00</span> / <span class="t-dur">${t.duration ? fmtClock(t.duration) : '--:--'}</span></span></div>
        ${(t.tags && t.tags.length) ? `<div class="music-tags">${t.tags.map((g) => `<span>${escHtml(g)}</span>`).join('')}</div>` : ''}
      </div>
    </article>`).join('')

  grid.querySelectorAll('.music-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      /* 点进度条 = 跳转播放位置，不触发播放/暂停 */
      const seek = e.target.closest('.music-seek')
      if (seek && musicActive === card && musicAudio.duration) {
        const r = seek.getBoundingClientRect()
        musicAudio.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * musicAudio.duration
        return
      }
      musicToggle(card)
    })
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); musicToggle(card) }
      else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && musicActive === card) {
        e.preventDefault()
        musicAudio.currentTime = Math.max(0, musicAudio.currentTime + (e.key === 'ArrowRight' ? 5 : -5))
      }
    })
  })
  grid.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el))
  probeMusicDurations(grid)
}

/* 时长的「兜底探测」：只有当数据里没写 duration 时才跑。
   正常路径（编辑器上传时会写入 duration）根本不会走到这里 —— 零额外流量。
   结果按 src 缓存 —— 工坊实时预览会反复重渲染，不缓存就会每轮重发一遍请求。 */
const musicDurCache = new Map()
function probeMusicDurations(grid) {
  if (!grid) return
  grid.querySelectorAll('.music-card').forEach((card) => {
    const src = card.dataset.src
    const el = card.querySelector('.t-dur')
    if (!src || !el) return
    if (el.textContent !== '--:--') return      /* 数据已带时长 → 不必探测 */
    const cached = musicDurCache.get(src)
    if (cached) { el.textContent = fmtClock(cached); return }
    const probe = new Audio()
    probe.preload = 'metadata'
    const finish = () => {
      const d = probe.duration
      if (d && isFinite(d) && d > 0) {
        musicDurCache.set(src, d)
        /* 探测期间若卡片被重渲染，el 已脱离文档 —— 交给下一轮（走缓存）补写 */
        if (el.isConnected) el.textContent = fmtClock(d)
      }
      probe.removeAttribute('src')
      probe.load()                 /* 释放媒体资源，别攥着连接不放 */
    }
    probe.addEventListener('loadedmetadata', finish, { once: true })
    probe.addEventListener('error', () => probe.removeAttribute('src'), { once: true })
    probe.src = src
  })
}

/* 飘移墙上的音乐封面：滚到音乐版块并播放对应曲目（找不到卡片就提示去试听） */
function playTrackFromWall(track) {
  const block = document.getElementById('musicBlock')
  const card = block && [...block.querySelectorAll('.music-card')]
    .find((c) => c.dataset.src === String(track?.src || ''))
  if (!card) { toast('这首音乐的卡片还没生成，稍后再试～'); return }
  if (lenis) lenis.scrollTo(block)
  else block.scrollIntoView({ behavior: 'smooth', block: 'center' })
  if (!card.classList.contains('playing')) musicToggle(card)
}

/* ---------- 渲染个人简介（简历文字稿；无 profile 数据时整区隐藏） ---------- */
/* 渲染期转义：尖括号不参与结构解析（编辑端已校验，这里是纵深防御） */
function escHtml(s) {
  return String(s == null ? '' : s).replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/* ============================================================
   10.5) 视觉海报：竖版画框轮播展示区
   - 数据：content.json 的 posters[]（src / title / desc；src 为空的行自动忽略）
   - 海报是竖版素材（3:4 / 9:16）：画框定 3:4 + 主图 object-fit:contain，
     **绝不能**用 16:9 + cover —— 那样一张竖版海报会被裁掉约六成画面
   - 窄屏/比例不符时用同图虚化做氛围背景垫留白（不是纯色，画面感更强）
   - 轨道平移式轮播：箭头 / 指示点 / 键盘 ← → / 触屏滑动，鼠标悬停暂停
   - 进视口才自动播放（省电省流量）；「减少动态」用户不自动播
   - 空数据时公开站整块隐藏，编辑器预览态显示上传引导
   ============================================================ */
const posterRM = window.matchMedia('(prefers-reduced-motion: reduce)')
let posterTrackEl = null
let posterSlides = []
let posterDotEls = []
let posterIdx = 0
let posterCount = 0
let posterTimer = null
let posterIO = null

function posterGo(n) {
  if (!posterCount || !posterTrackEl) return
  posterIdx = ((n % posterCount) + posterCount) % posterCount   /* 循环取模，支持左右越界 */
  posterTrackEl.style.transform = `translateX(-${posterIdx * 100}%)`
  posterSlides.forEach((s, i) => {
    s.classList.toggle('active', i === posterIdx)
    s.setAttribute('aria-hidden', i === posterIdx ? 'false' : 'true')
  })
  posterDotEls.forEach((d, i) => {
    d.classList.toggle('active', i === posterIdx)
    d.setAttribute('aria-selected', i === posterIdx ? 'true' : 'false')
  })
}
function posterStart() {
  if (posterCount < 2 || posterTimer || posterRM.matches) return
  posterTimer = setInterval(() => posterGo(posterIdx + 1), 6000)
}
function posterStop() { if (posterTimer) { clearInterval(posterTimer); posterTimer = null } }

/* 属性值专用转义：escHtml 只转 <>，标题/说明是编辑器手输的，含引号会截断 alt="..." */
function escAttr(s) {
  return escHtml(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function renderPosters(list) {
  const block = document.getElementById('posterBlock')
  const track = document.getElementById('posterTrack')
  const dots = document.getElementById('posterDots')
  const emptyEl = document.getElementById('posterEmpty')
  if (!block || !track) return
  const items = Array.isArray(list) ? list.filter((p) => p && p.src) : []

  posterStop()
  if (posterIO) { posterIO.disconnect(); posterIO = null }

  if (!items.length) {
    /* 空：公开站点整块不出现（不留空白版块）；编辑器预览态给出上传引导 */
    block.hidden = !wkPreviewMode
    track.innerHTML = ''
    if (dots) dots.innerHTML = ''
    if (emptyEl) {
      emptyEl.innerHTML = wkPreviewMode
        ? `<strong>还没有海报</strong><span>打开顶栏 ⚙ 工坊 → 「⑮ 视觉海报」，拖入图片并填好标题与说明，保存后就会出现在这里。</span>`
        : ''
    }
    posterTrackEl = null; posterSlides = []; posterDotEls = []
    posterCount = 0; posterIdx = 0
    return
  }

  block.hidden = false
  if (emptyEl) emptyEl.innerHTML = ''
  /* 竖版画框结构：氛围背景层（同图虚化，垫住两侧留白）+ 主图 contain（永不裁切）+ 展签式说明 */
  track.innerHTML = items.map((p, i) => `
    <figure class="poster-slide${i === 0 ? ' active' : ''}" data-idx="${i}" aria-hidden="${i === 0 ? 'false' : 'true'}">
      <div class="poster-bg" style="background-image:url('${escAttr(p.src)}')" aria-hidden="true"></div>
      <img class="poster-img" src="${escAttr(p.src)}" alt="${escAttr(p.title || '海报')}" loading="${i === 0 ? 'eager' : 'lazy'}" draggable="false" />
      <figcaption class="poster-cap">
        ${p.title ? `<strong>${escHtml(p.title)}</strong>` : ''}
        ${p.desc ? `<span>${escHtml(p.desc)}</span>` : ''}
        <i class="poster-cap-no">${String(i + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}</i>
      </figcaption>
    </figure>`).join('')

  if (dots) {
    dots.innerHTML = items.length > 1
      ? items.map((_, i) => `<button class="pd${i === 0 ? ' active' : ''}" type="button" data-i="${i}" aria-label="查看第 ${i + 1} 张海报"></button>`).join('')
      : ''
  }

  posterTrackEl = track
  posterCount = items.length
  posterSlides = Array.from(track.querySelectorAll('.poster-slide'))
  posterDotEls = dots ? Array.from(dots.querySelectorAll('.pd')) : []
  posterIdx = 0
  posterGo(0)

  /* 事件：静态控件一律用覆盖式赋值 —— applyContent 会被工坊实时预览反复调用，
     用 addEventListener 会不断叠加监听器（点一次翻好几张）。 */
  const prev = document.getElementById('posterPrev')
  const next = document.getElementById('posterNext')
  const carousel = document.getElementById('posterCarousel')
  if (prev) prev.onclick = () => { posterStop(); posterGo(posterIdx - 1); posterStart() }
  if (next) next.onclick = () => { posterStop(); posterGo(posterIdx + 1); posterStart() }
  posterDotEls.forEach((d) => {
    d.onclick = () => { posterStop(); posterGo(+d.dataset.i); posterStart() }
  })
  if (carousel) {
    /* 键盘 ← → 翻页（空格留给页面滚动，不抢占） */
    carousel.onkeydown = (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); posterStop(); posterGo(posterIdx - 1); posterStart() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); posterStop(); posterGo(posterIdx + 1); posterStart() }
    }
    /* 触屏滑动：横向位移 > 40px 且横向为主才翻页（否则让页面正常竖向滚动） */
    let sx = 0, sy = 0
    carousel.ontouchstart = (e) => { const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; posterStop() }
    carousel.ontouchend = (e) => {
      const t = e.changedTouches[0]
      const dx = t.clientX - sx, dy = t.clientY - sy
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) posterGo(posterIdx + (dx < 0 ? 1 : -1))
      posterStart()
    }
    /* 悬停暂停自动播放，让人读得完一张 */
    carousel.onmouseenter = () => posterStop()
    carousel.onmouseleave = () => posterStart()
  }
  /* 进视口才自动播；出视口自动停（与动图/首屏轮播同一套省电逻辑） */
  if ('IntersectionObserver' in window) {
    posterIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => { en.isIntersecting ? posterStart() : posterStop() })
    }, { threshold: 0.25 })
    posterIO.observe(block)
  } else {
    posterStart()
  }
}

function renderProfile(p) {
  const sec = document.getElementById('profile')
  const wrap = document.getElementById('profileWrap')
  if (!sec || !wrap) return
  if (!p) { sec.style.display = 'none'; return }
  sec.style.display = ''
  const facts = Array.isArray(p.facts) ? p.facts.filter((f) => f && (f.label || f.value)) : []
  const bio = Array.isArray(p.bio) ? p.bio.filter(Boolean) : []
  const timeline = Array.isArray(p.timeline) ? p.timeline.filter((t) => t && (t.title || t.org)) : []
  const skills = Array.isArray(p.skills) ? p.skills.filter(Boolean) : []
  wrap.innerHTML = `
    <aside class="profile-side reveal">
      <div class="profile-mono" aria-hidden="true">${escHtml((p.name || '祺').slice(-1))}</div>
      <div class="profile-name">${escHtml(p.name || '')}</div>
      ${p.role ? `<div class="profile-role">${escHtml(p.role)}</div>` : ''}
      ${p.motto ? `<div class="profile-motto">「 ${escHtml(p.motto)} 」</div>` : ''}
      ${facts.length ? `<ul class="profile-facts">${facts.map((f) => `
        <li><span class="pf-label">${escHtml(f.label || '')}</span><span class="pf-value">${escHtml(f.value || '')}</span></li>`).join('')}</ul>` : ''}
    </aside>
    <div class="profile-main reveal">
      ${bio.length ? `<div class="profile-bio">${bio.map((t) => `<p>${escHtml(t)}</p>`).join('')}</div>` : ''}
      ${timeline.length ? `<h3 class="profile-sub">经历速览 · EXPERIENCE</h3>
        <ul class="profile-timeline">${timeline.map((t) => `
          <li>
            <span class="pt-period">${escHtml(t.period || '')}</span>
            <div class="pt-title">${escHtml(t.title || '')}</div>
            ${t.org ? `<div class="pt-org">${escHtml(t.org)}</div>` : ''}
            ${t.desc ? `<div class="pt-desc">${escHtml(t.desc)}</div>` : ''}
          </li>`).join('')}</ul>` : ''}
      ${skills.length ? `<h3 class="profile-sub">技能标签 · SKILLS</h3>
        <div class="profile-skills">${skills.map((s) => `<span>${escHtml(s)}</span>`).join('')}</div>` : ''}
    </div>`
  wrap.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el))
}

/* ---------- 应用整份内容 ---------- */
let SITE_CONTENT = {}
function applyContent(c) {
  if (!c) return
  SITE_CONTENT = c
  // 通用文本绑定（带 \n→<br>）
  document.querySelectorAll('[data-bind]').forEach((el) => {
    const v = get(c, el.dataset.bind)
    if (v == null) return
    el.innerHTML = nl2br(v)
    if (el.id === 'contactEmail') el.setAttribute('href', 'mailto:' + v)
  })
  // 首屏轮播图（Carousel）
  setupHeroSlides(c.hero)
  const storyBg = document.getElementById('storyBg')
  if (storyBg && c.story?.bg) storyBg.style.backgroundImage = `url('${c.story.bg}')`
  // 列表 / 影片
  renderTopics(c.topics)
  renderWorks(c.works)
  renderMovie(c.movie)
  renderMotion(c.motion)
  renderMusic(c.tracks)
  renderPosters(c.posters)
  renderProfile(c.profile)
  initDriftWall(c)
  applyBackgrounds(c.backgrounds)
}

/* ============================================================
   9.5) 区块背景（编辑工坊「背景设置」数据驱动；无配置时零注入）
   - 类型：image / video / color / gradient；覆盖层独立压暗
   - 移动端 / 弱网（省流模式 / 2G）视频背景自动降级为封面图
   - 幂等：实时预览反复触发不会堆叠背景层
   ============================================================ */
const BG_TARGETS = ['home', 'topics', 'about', 'storyBand', 'action', 'works', 'movie', 'profile', 'contact', 'footer']
/* 视频背景降级判定：窄屏手机 或 省流模式 或 2G 弱网 → true（用封面图替代视频） */
function bgShouldDegrade() {
  const conn = navigator.connection || {}
  return window.matchMedia('(max-width: 820px)').matches
    || !!conn.saveData
    || /2g/.test(conn.effectiveType || '')
}
/* 背景层内视频的播放管家：进视口才播（多个区块同时挂视频也不浪费解码） */
let bgVideoIO = null
function bgObserveVideo(v) {
  if (!('IntersectionObserver' in window)) return
  bgVideoIO?.disconnect()
  bgVideoIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => { en.isIntersecting ? en.target.play().catch(() => {}) : en.target.pause() })
  }, { rootMargin: '100px 0px', threshold: 0.05 })
  document.querySelectorAll('.sec-bg video').forEach((vid) => bgVideoIO.observe(vid))
}
function bgClean(s) { return String(s || '').replace(/['"()\\]/g, '') }
function applyBackgrounds(bgs) {
  BG_TARGETS.forEach((id) => {
    const sec = document.getElementById(id)
    if (!sec) return
    sec.querySelector(':scope > .sec-bg')?.remove()          // 幂等：先清旧层
    /* 还原被接管的既有背景层（hero 轮播 / 引言带底图） */
    if (id === 'home') { const s = document.getElementById('heroSlides'); if (s) s.style.display = '' }
    if (id === 'storyBand') { const s = document.getElementById('storyBg'); if (s) s.style.display = '' }
    const cfg = bgs && bgs[id]
    if (!cfg || !cfg.type) return
    let mediaHtml = ''
    if (cfg.type === 'color') {
      mediaHtml = `<div class="sec-bg-media" style="background:${cfg.color || '#101215'}"></div>`
    } else if (cfg.type === 'gradient') {
      const ang = Number.isFinite(+cfg.angle) ? +cfg.angle : 160
      mediaHtml = `<div class="sec-bg-media" style="background:linear-gradient(${ang}deg, ${cfg.from || '#0b0c0e'}, ${cfg.to || '#1c1f24'})"></div>`
    } else if (cfg.type === 'image' && cfg.src) {
      mediaHtml = `<div class="sec-bg-media" style="background-image:url('${bgClean(cfg.src)}')"></div>`
    } else if (cfg.type === 'video' && cfg.src) {
      if (bgShouldDegrade()) {
        /* 降级：手机 / 弱网 → 封面静帧（无封面则放弃背景，保持默认） */
        if (cfg.poster) mediaHtml = `<div class="sec-bg-media" style="background-image:url('${bgClean(cfg.poster)}')"></div>`
      } else {
        mediaHtml = `<div class="sec-bg-media"><video src="${bgClean(cfg.src)}" ${cfg.poster ? `poster="${bgClean(cfg.poster)}"` : ''} muted loop autoplay playsinline preload="metadata"></video></div>`
      }
    }
    if (!mediaHtml) return
    const op = Math.max(0, Math.min(80, +cfg.overlay || 0)) / 100
    const ovHtml = (cfg.overlayOn && op > 0)
      ? `<div class="sec-bg-overlay" style="background:${cfg.overlayColor || '#0b0c0e'};opacity:${op}"></div>`
      : ''
    const layer = document.createElement('div')
    layer.className = 'sec-bg'
    layer.innerHTML = mediaHtml + ovHtml
    sec.prepend(layer)
    /* hero / 引言带：新背景接管，隐藏既有背景层（还原时上面已恢复） */
    if (id === 'home') { const s = document.getElementById('heroSlides'); if (s) s.style.display = 'none' }
    if (id === 'storyBand') { const s = document.getElementById('storyBg'); if (s) s.style.display = 'none' }
  })
  bgObserveVideo()
}

/* ---------- 首屏轮播图 Carousel：大图轮着放（淡入淡出 + 自动切换） ---------- */
let heroTimer = null
let heroSlideEls = []
let heroDotEls = []
let heroIdx = 0
function heroGo(n) {
  if (!heroSlideEls.length) return
  heroSlideEls[heroIdx] && heroSlideEls[heroIdx].classList.remove('active')
  heroDotEls[heroIdx] && heroDotEls[heroIdx].classList.remove('active')
  heroIdx = (n + heroSlideEls.length) % heroSlideEls.length
  heroSlideEls[heroIdx].classList.add('active')
  heroDotEls[heroIdx] && heroDotEls[heroIdx].classList.add('active')
}
function heroStart() {
  if (heroSlideEls.length < 2 || heroTimer) return
  heroTimer = setInterval(() => heroGo(heroIdx + 1), 5000)
}
function heroStop() { if (heroTimer) { clearInterval(heroTimer); heroTimer = null } }
let heroIO = null
function setupHeroSlides(hero) {
  const box = document.getElementById('heroSlides')
  const heroEl = document.getElementById('home')
  if (!box || !heroEl) return
  const slides = (Array.isArray(hero?.slides) && hero.slides.length) ? hero.slides : (hero?.bg ? [hero.bg] : [])
  heroStop()
  if (heroIO) heroIO.disconnect()
  heroEl.querySelector('.hero-dots')?.remove()
  if (!slides.length) { box.innerHTML = ''; return }
  box.innerHTML = slides.map((src, i) =>
    `<div class="hero-slide${i === 0 ? ' active' : ''}" style="background-image:url('${src}')"></div>`
  ).join('')
  if (slides.length > 1) {
    heroEl.insertAdjacentHTML('beforeend',
      `<div class="hero-dots">${slides.map((_, i) => `<span class="hd${i === 0 ? ' active' : ''}" data-i="${i}"></span>`).join('')}</div>`)
  }
  heroSlideEls = Array.from(box.querySelectorAll('.hero-slide'))
  heroDotEls = Array.from(heroEl.querySelectorAll('.hero-dots .hd'))
  heroIdx = 0
  heroDotEls.forEach((d) => d.addEventListener('click', () => { heroStop(); heroGo(+d.dataset.i); heroStart() }))
  heroIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => { e.isIntersecting ? heroStart() : heroStop() })
  }, { threshold: 0.2 })
  heroIO.observe(heroEl)
}
/* 切到后台标签页时暂停轮播，省电省性能 */
document.addEventListener('visibilitychange', () => { if (document.hidden) heroStop() })

/* ============================================================
   固定交互（与内容无关，保留原特效）
   ============================================================ */

/* 1) 导航栏滚动毛玻璃 */
const navbar = document.getElementById('navbar')
window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', window.scrollY > 40))

/* 2)（已退役）旧顶栏 nav-links 与 2.5) 左侧边导航 —— 均由 CardNav 卡片导航取代（2026-09-14 移除） */

/* 3) 视频弹窗（本地 / B站） */
const modal = document.getElementById('videoModal')
const modalMedia = document.getElementById('modalMedia')
const modalTitle = document.getElementById('modalTitle')
// 用事件委托，作品卡由 JS 动态生成也能响应
document.addEventListener('click', (e) => {
  const card = e.target.closest('.work-card')
  if (!card || !modal) return
  const bili = card.dataset.bilibili
  const local = card.dataset.local
  modalTitle.textContent = card.dataset.title || ''
  if (bili) {
    modalMedia.innerHTML = biliIframe(bili)
  } else if (local) {
    modalMedia.innerHTML = `<video id="modalVideo" controls style="width:100%;aspect-ratio:16/9;background:#000;border-radius:12px;">`
      + `<source src="${local}" type="video/mp4" /></video>`
    const v = document.getElementById('modalVideo'); if (v) v.play()
  } else {
    modalMedia.innerHTML = `<div class="modal-empty">该作品视频外链待补充，请在可视化修改工坊中填入 B站链接。</div>`
  }
  modal.classList.add('open')
})
function closeModal() {
  if (!modal) return
  modal.classList.remove('open')
  modalMedia.innerHTML = ''
}
document.getElementById('modalClose')?.addEventListener('click', closeModal)
document.getElementById('modalBackdrop')?.addEventListener('click', closeModal)
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal() })

/* 3.5) 动图卡点击 → 同一套弹窗播「有声竖屏版」（静音循环只是橱窗，声音在这里） */
document.addEventListener('click', (e) => {
  const card = e.target.closest('.motion-card')
  if (!card || !modal) return
  const src = card.dataset.src
  if (!src) return
  modalTitle.textContent = card.dataset.title || ''
  modalMedia.innerHTML = `<video id="modalVideo" controls autoplay
    style="display:block;margin:0 auto;max-width:min(400px,88vw);max-height:78vh;aspect-ratio:9/16;background:#000;border-radius:12px;">
    <source src="${src}" type="video/mp4" /></video>`
  modal.classList.add('open')
})
/* 键盘可达：动图卡聚焦时按 Enter / 空格同样打开有声版 */
document.addEventListener('keydown', (e) => {
  const card = e.target.closest?.('.motion-card')
  if (!card) return
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click() }
})

/* ---------- 9) 站内提示 toast ---------- */
const toastEl = document.getElementById('toast')
let toastTimer = null
function toast(msg) {
  if (!toastEl) return
  toastEl.textContent = msg
  toastEl.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200)
}
/* 背景音乐已整体移除（2026-09-16）：content.music 配置、<audio id="bgm">、
   ♪ 浮动开关 bgm-fab 及相关自动播放/偏好记忆逻辑全部删除。
   现在站点上唯一会发声的，只有「AI 音乐创作」版块里由工坊上传的 content.tracks —— 
   没有任何内置或默认音频。 */
/* 工坊入口（右上角 ⚙）：始终显示。
   现下两种部署形态都真实提供 /workshop/edit：
   1) 本地开发（localhost，studio/server.mjs 提供保存/还原/上传接口）；
   2) 线上「整个项目」部署 —— 作品站由 Vue 以同域 iframe 承载（根路径与 /workshop 都走承载页），
      iframe 内相对链接 "edit" 正好解析到 /workshop/edit，编辑器与保存接口都在。
   ⚠️ 若日后改成「只发 public/workshop/ 的纯静态站」，那种部署没有后台，
   此按钮会撞 404 —— 届时需按 location.hostname / window.self !== window.top 重新加回显隐判断。 */
/* 影片区懒加载：点击封面再挂载 B站 iframe（减少首屏请求） */
document.addEventListener('click', (e) => {
  const lazy = e.target.closest('.video-lazy[data-bili]')
  if (!lazy) return
  const frame = biliIframe(lazy.getAttribute('data-bili'))
  if (frame) lazy.outerHTML = frame
})

/* 4) 滚动淡入（含动态生成的卡） */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target) }
  })
}, { threshold: 0.12 })
document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el))

/* 5) 进度条 + 视差 */
const progress = document.getElementById('progress')
const parallaxLayers = document.querySelectorAll('.parallax-layer')
let ticking = false
function onScroll() {
  const y = window.scrollY
  const docH = document.documentElement.scrollHeight - window.innerHeight
  if (progress) progress.style.transform = `scaleX(${docH > 0 ? y / docH : 0})`
  parallaxLayers.forEach((layer) => {
    const speed = parseFloat(layer.dataset.speed) || 0.3
    layer.style.transform = `translate3d(0, ${y * speed}px, 0) scale(1.05)`
  })
  ticking = false
}
window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true } }, { passive: true })
onScroll()

/* 6)（已退役）导航滚动高亮 —— 旧 nav-links / 侧边导航均已移除，CardNav 下拉菜单不做常驻高亮 */

/* 6.5) CardNav 卡片导航（移植自 react-bits CardNav：汉堡按下，顶栏 GSAP 展开三张分类卡）
   - 官方行为对齐：高度 60→calculateHeight 0.4s power3.out；卡片 y:50→0 opacity 0→1 stagger 0.08 -0.1 交叠
   - 移动端实测内容高度（官方「换装测量法」）；resize 重建时间线；反向收完才复位状态
   - 降级：无 gsap 或 prefers-reduced-motion → 纯 CSS 即时展开，功能不打折 */
;(function initCardNav() {
  const nav = document.getElementById('cardNav')
  const btn = document.getElementById('cnHamburger')
  const content = document.getElementById('cnContent')
  if (!nav || !btn || !content) return
  const cards = [...nav.querySelectorAll('.nav-card')]
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)')
  const hasGsap = typeof gsap !== 'undefined'
  let open = false
  let tl = null

  /* 展开高度：桌面固定 260（官方值）；手机实测——临时把内容层「换装」成可测量态 */
  function calculateHeight() {
    const isMobile = window.matchMedia('(max-width: 820px)').matches
    if (!isMobile) return 260
    const wasVisibility = content.style.visibility
    const wasPosition = content.style.position
    const wasHeight = content.style.height
    content.style.visibility = 'visible'
    content.style.position = 'static'
    content.style.height = 'auto'
    void content.offsetHeight
    const h = 60 + content.scrollHeight + 16
    content.style.visibility = wasVisibility
    content.style.position = wasPosition
    content.style.height = wasHeight
    return h
  }
  function createTimeline() {
    if (!hasGsap || RM.matches) return null
    gsap.set(nav, { height: 60, overflow: 'hidden' })
    gsap.set(cards, { y: 50, opacity: 0 })
    const t = gsap.timeline({ paused: true })
    t.to(nav, { height: calculateHeight, duration: 0.4, ease: 'power3.out' })
    t.to(cards, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out', stagger: 0.08 }, '-=0.1')
    return t
  }
  function rebuild() {
    if (!hasGsap || RM.matches) return
    tl?.kill()
    tl = createTimeline()
    if (open && tl) tl.progress(1)              /* 展开中重建：直接停在完成态 */
  }
  function setOpen(next) {
    open = next
    nav.classList.toggle('open', open)
    btn.classList.toggle('open', open)
    btn.setAttribute('aria-expanded', String(open))
    btn.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单')
    content.setAttribute('aria-hidden', String(!open))
  }
  function toggle() {
    if (tl) {
      if (!open) { setOpen(true); tl.play(0) }
      else {
        btn.classList.remove('open')            /* 汉堡先变回双线，内容收完再翻状态（对齐官方） */
        tl.eventCallback('onReverseComplete', () => setOpen(false))
        tl.reverse()
      }
    } else {
      setOpen(!open)                            /* 降级：纯 CSS 即时展开 */
      nav.style.height = open ? calculateHeight() + 'px' : '60px'
    }
  }
  btn.addEventListener('click', toggle)
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() }
  })
  /* 卡片链接：跳转后顺手收起菜单；data-scroll-to 可精确跳到子区块（如动图实验） */
  content.addEventListener('click', (e) => {
    const a = e.target.closest('a')
    if (!a) return
    const sel = a.dataset.scrollTo
    if (sel) {
      const el = document.querySelector(sel)
      if (el) {
        e.preventDefault()
        if (lenis) lenis.scrollTo(el)
        else el.scrollIntoView({ behavior: 'smooth' })
      }
    }
    if (open) toggle()
  })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) toggle() })
  window.addEventListener('resize', rebuild)
  rebuild()
})()

/* 6.6) MagicBento 粒子边框（移植自 react-bits MagicBento · 克制版）
   - 宿主：#action 三张能力卡（.service-card），静态 HTML 渲染，无需 applyContent 钩子
   - 只保留两要素：① 边框辉光随鼠标游走（--glow-x/y/intensity）② 悬停少量银色微粒
   - 刻意拿掉：3D 倾斜 / 磁吸 / 点击波纹 / 全屏聚光（「不要太浮夸」），保留卡片原有悬停上浮
   - 降级：触屏（无悬停）/ prefers-reduced-motion / 无 gsap → 仅静态悬停样式，无微粒 */
;(function initMagicBento() {
  const cards = [...document.querySelectorAll('.service-card')]
  if (!cards.length) return
  cards.forEach((c) => c.classList.add('magic-card'))
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!canHover || RM.matches || typeof gsap === 'undefined') return

  const BURST = 5          /* 官方 12 → 克制版：入场微粒数 */
  cards.forEach((card) => {
    let alive = false
    let timer = null
    function spawnOnce() {
      const rect = card.getBoundingClientRect()
      const p = document.createElement('span')
      p.className = 'magic-particle'
      p.style.left = Math.random() * rect.width + 'px'
      p.style.top = Math.random() * rect.height + 'px'
      card.appendChild(p)
      gsap.to(p, {
        x: (Math.random() - 0.5) * 60,
        y: (Math.random() - 0.5) * 60,
        opacity: 0,
        scale: 0,
        duration: 1.2 + Math.random() * 0.8,
        ease: 'power1.out',
        onComplete: () => p.remove()
      })
    }
    function loop() {      /* 稳态 ~3-5 粒：生成间隔大于生命周期的一半 */
      if (!alive) return
      spawnOnce()
      timer = setTimeout(loop, 320 + Math.random() * 320)
    }
    card.addEventListener('mouseenter', () => {
      alive = true
      gsap.to(card, { '--glow-intensity': 1, duration: 0.35, ease: 'power2.out' })
      for (let i = 0; i < BURST; i++) setTimeout(spawnOnce, i * 90)
      timer = setTimeout(loop, BURST * 90 + 200)
    })
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect()
      card.style.setProperty('--glow-x', (e.clientX - r.left) + 'px')
      card.style.setProperty('--glow-y', (e.clientY - r.top) + 'px')
    })
    card.addEventListener('mouseleave', () => {
      alive = false
      clearTimeout(timer)
      gsap.to(card, { '--glow-intensity': 0, duration: 0.5, ease: 'power2.out' })
    })
  })
})()

/* 7) 启动画面（带 ?nowelcome 时直接跳过，便于工坊实时预览） */
const splash = document.getElementById('splash')
const splashBar = document.getElementById('splashBar')
const splashEnter = document.getElementById('splashEnter')
const SPLASH_MS = 2800
const skipSplash = new URLSearchParams(window.location.search).has('nowelcome')
function closeSplash() { if (splash && !splash.classList.contains('hidden')) { splash.classList.add('hidden'); document.body.style.overflow = ''; lenis?.start() } }
if (skipSplash) {
  closeSplash()
} else {
  document.body.style.overflow = 'hidden'
  lenis?.stop()                                       /* splash 期间锁定平滑滚动 */
  if (splashBar) { splashBar.style.transition = `width ${SPLASH_MS}ms linear`; requestAnimationFrame(() => { splashBar.style.width = '100%' }) }
  const splashTimer = setTimeout(closeSplash, SPLASH_MS)
  splashEnter?.addEventListener('click', (e) => { e.stopPropagation(); clearTimeout(splashTimer); closeSplash() })
  splash?.addEventListener('click', () => { clearTimeout(splashTimer); closeSplash() })
  document.addEventListener('keydown', () => { if (splash && !splash.classList.contains('hidden')) { clearTimeout(splashTimer); closeSplash() } })
}

/* 8) 内容加载 + 工坊实时预览 */
async function loadContent() {
  try {
    const res = await fetch('content.json', { cache: 'no-cache' })
    if (res.ok) applyContent(await res.json())
  } catch (_) { /* 无 content.json 时直接用 HTML 默认值 */ }
}
loadContent()
// 工坊编辑器通过 postMessage 推送的实时内容
window.addEventListener('message', (e) => {
  const d = e.data
  if (d && d.type === 'wk:content' && d.content) {
    wkPreviewMode = true        /* 工坊实时预览：空版块显示引导态，便于主人定位去上传 */
    applyContent(d.content)
  }
})

/* ============================================================
   10) 作品漂移墙 DriftWall：3D 流动图墙（对齐 react-bits 官方行为）
   - 多列无限垂直漂移：相邻列反向、黄金比例伪随机速度方差、内容多份无缝回绕
   - 每列独立速度缓动：悬停某列 → 该列平滑停下（停快/恢复慢的非对称缓动）
   - 鼠标 3D 倾斜：帧率无关阻尼 + scale(1.18)/translateZ(-120) 景深 + turn=-14° 基础侧倾
   - 点击瓦片：图片对应某作品封面 → 弹窗播放；性能：不可见/切后台自动暂停
   ============================================================ */
const driftWall = document.getElementById('driftWall')
let dwState = null
let dwBound = false
const dwReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* 官方默认参数（react-bits DriftWall） */
const DW = { tilt: 16, turn: -14, roll: 0, depth: 120, scale: 1.18, speed: 42, variance: 0.45, parallax: 0.6 }

/* 从 content.json 收集墙图：作品封面 → 碎片实验作品 → 氛围图（轮播 / 海报 / splash），去重保序
   - 作品封面：点击可播对应作品
   - 碎片实验（motion）：图片直接铺；视频用首帧静帧，鼠标悬停才播（既动感又不烧性能）
   - 以后新加的作品会自动进墙，无需改代码 */
function dwCollect(content) {
  const works = Array.isArray(content?.works) ? content.works : []
  const motions = Array.isArray(content?.motion) ? content.motion : []
  const tracks = Array.isArray(content?.tracks) ? content.tracks : []
  const slides = Array.isArray(content?.hero?.slides) ? content.hero.slides : []
  const isVideo = (s) => /\.(mp4|webm|mov|m4v)$/i.test(String(s || ''))
  const seen = new Set()
  const items = []
  const push = (src, extra) => {
    const s = String(src || '').trim()
    if (!s || seen.has(s)) return
    seen.add(s)
    items.push({ src: s, kind: 'image', ...extra })
  }
  /* 1) 精选作品（主内容，优先铺） */
  works.forEach((w) => push(w?.cover, { work: w }))
  /* 2) 碎片实验作品（⑪ 模块上传的都会进来） */
  motions.forEach((m) => push(m?.src, { motion: m, kind: isVideo(m.src) ? 'video' : 'image' }))
  /* 2.5) AI 音乐作品：只有配了封面的才上墙（音频本身没有画面） */
  tracks.forEach((t) => push(t?.cover, { track: t }))
  /* 3) 氛围图 */
  slides.forEach((s) => push(s))
  push(content?.movie?.poster)
  push('assets/images/splash-bg.jpg')
  const byCover = new Map(works.filter((w) => w?.cover).map((w) => [w.cover, w]))
  return { items, byCover }
}

/* 官方 columnFactor：黄金比例伪随机，让每列速度自然错落（不机械） */
function dwColumnFactor(index, variance) {
  const pseudo = ((index * 0.6180339887 + 0.35) % 1) * 2 - 1
  return 1 + variance * pseudo
}

/* 官方 plane 变换：scale 放大防露边 + translateZ 推景深 + 指针倾斜 */
function dwPlaneTransform(s, px, py) {
  s.plane.style.transform =
    `translate(-50%, -50%) scale(${DW.scale}) ` +
    `rotateX(${(DW.tilt + py).toFixed(2)}deg) rotateY(${(DW.turn + px).toFixed(2)}deg) rotateZ(${DW.roll}deg) ` +
    `translateZ(${-DW.depth}px)`
}

function initDriftWall(content) {
  if (!driftWall) return
  /* 幂等：工坊实时预览会反复调用，先清旧状态 */
  if (dwState) {
    cancelAnimationFrame(dwState.raf)
    dwState.io?.disconnect()
    dwState = null
  }
  const { items, byCover } = dwCollect(content)
  if (items.length < 2) { driftWall.style.display = 'none'; return }
  driftWall.style.display = ''

  /* 布局参数（移动端瓦片更小，与 CSS 变量对应） */
  const w = driftWall.clientWidth || window.innerWidth
  const h = driftWall.clientHeight || 600
  const mobile = w < 720
  const tileStep = mobile ? 96 + 16 : 132 + 18       // --dw-tile-h + --dw-gap
  const tileW = mobile ? 140 + 16 : 200 + 18
  const cols = Math.max(mobile ? 3 : 5, Math.ceil(w / tileW) + 2)
  const rows = Math.max(4, Math.ceil((h * 0.9) / tileStep))   // 每列图数（循环取图）
  const copyH = rows * tileStep                                // 单份内容高度（回绕周期）
  const copies = Math.max(2, Math.ceil((h * 1.6) / copyH) + 1) // 官方：份数覆盖 1.6 倍容器高

  /* 生成列与瓦片（每列复制 copies 份，供无缝循环） */
  let html = ''
  for (let c = 0; c < cols; c++) {
    let tiles = ''
    for (let r = 0; r < rows; r++) {
      const i = (c + r * cols) % items.length           // 错列取图，避免相邻重复
      const it = items[i]
      const label = it.work ? ('播放作品：' + String(it.work.title || '').replace(/"/g, ''))
        : it.motion ? ('播放碎片：' + String(it.motion.title || '').replace(/"/g, ''))
          : '作品氛围图'
      const media = it.kind === 'video'
        ? `<video src="${it.src}" muted loop playsinline preload="metadata" aria-hidden="true"></video>`
        : `<img src="${it.src}" alt="" loading="lazy" decoding="async" draggable="false" />`
      tiles += `<button type="button" class="drift-wall__tile" data-tile-id="${c}-${r}" data-col="${c}" data-cover="${it.src}" data-idx="${i}" data-kind="${it.kind}"
        aria-label="${label}">
        <span class="drift-wall__inner">${media}<span class="drift-wall__overlay"></span></span>
      </button>`
    }
    html += `<div class="drift-wall__col"><div class="drift-wall__track">${tiles.repeat(copies)}</div></div>`
  }
  driftWall.innerHTML = `<div class="drift-wall__plane">${html}</div>`

  const plane = driftWall.querySelector('.drift-wall__plane')
  const tracks = Array.from(driftWall.querySelectorAll('.drift-wall__track'))
  dwState = {
    plane, byCover, items, copyH,
    cols: tracks.map((el, c) => ({
      el,
      offset: copyH * ((c * 0.37) % 1),                        // 官方：各列起始相位错开
      velocity: 0,
      base: DW.speed * dwColumnFactor(c, DW.variance) * (c % 2 === 0 ? 1 : -1)  // 相邻列反向
    })),
    pointer: { x: 0, y: 0 }, damped: { x: 0, y: 0 },
    activeId: null, hoveredCol: -1,
    raf: 0, last: null, inView: false, io: null
  }

  /* 事件委托只挂一次（读最新 state，重建 DOM 不失效） */
  if (!dwBound) {
    dwBound = true
    /* 官方 hover 命中方式：elementFromPoint（3D 变换下最可靠），命中即点亮 + 暂停该列 */
    driftWall.addEventListener('pointermove', (e) => {
      if (!dwState) return
      const rect = driftWall.getBoundingClientRect()
      if (!dwReduced) {
        dwState.pointer.x = (e.clientX - rect.left) / rect.width - 0.5
        dwState.pointer.y = (e.clientY - rect.top) / rect.height - 0.5
      }
      const hit = document.elementFromPoint(e.clientX, e.clientY)
      const tile = hit && hit.closest ? hit.closest('.drift-wall__tile') : null
      if (!tile) { dwClearActive(); return }
      const id = tile.dataset.tileId
      if (id === dwState.activeId) return
      dwSetActive(tile, id, Number(tile.dataset.col))
    })
    driftWall.addEventListener('pointerleave', () => {
      if (!dwState) return
      dwState.pointer.x = 0; dwState.pointer.y = 0
      dwClearActive()
    })
    /* 点击瓦片：作品 → 作品弹窗；碎片实验（含视频）→ 视频弹窗；氛围图 → 轻提示 */
    driftWall.addEventListener('click', (e) => {
      const t = e.target.closest('.drift-wall__tile')
      if (!t || !dwState) return
      const it = dwState.items[Number(t.dataset.idx)]
      if (it?.work) openWorkModal(it.work)
      else if (it?.motion) openWorkVideo(it.motion.src, it.motion.title || '碎片实验')
      else if (it?.track) playTrackFromWall(it.track)
      else toast('这是一张氛围图，暂无关联作品～')
    })
    /* 键盘可达：聚焦/失焦同步点亮 + 暂停该列 */
    driftWall.addEventListener('focusin', (e) => {
      const t = e.target.closest('.drift-wall__tile')
      if (t && dwState) dwSetActive(t, t.dataset.tileId, Number(t.dataset.col))
    })
    driftWall.addEventListener('focusout', (e) => {
      const t = e.target.closest('.drift-wall__tile')
      if (t) dwClearActive()
    })
    document.addEventListener('visibilitychange', () => { if (!dwState) return; document.hidden ? dwStop() : (dwState.inView && dwStart()) })
  }

  if (dwReduced) { dwRenderStatic(); return }
  /* 仅可见时启动动画（滚出视口/切后台自动停，省电省性能） */
  dwState.io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { dwState.inView = en.isIntersecting; en.isIntersecting ? dwStart() : dwStop() })
  }, { threshold: 0.05 })
  dwState.io.observe(driftWall)
}

/* 视频弹窗（碎片实验 / 本地视频）：自适应横竖屏，带声音播放 */
function openWorkVideo(src, title) {
  if (!modal || !src) return
  modalTitle.textContent = title || ''
  modalMedia.innerHTML = `<video id="modalVideo" controls autoplay
    style="display:block;margin:0 auto;width:100%;max-width:min(720px,92vw);max-height:80vh;background:#000;border-radius:12px;">
    <source src="${String(src).replace(/['"()\\]/g, '')}" type="video/mp4" /></video>`
  modal.classList.add('open')
}

function dwSetActive(tile, id, col) {
  driftWall.querySelectorAll('.drift-wall__tile.is-active').forEach((x) => x.classList.remove('is-active'))
  tile.classList.add('is-active')
  dwState.activeId = id
  dwState.hoveredCol = col
  /* 视频瓦片：悬停才播（首帧静帧 → 活起来） */
  const v = tile.querySelector('video')
  if (v) v.play().catch(() => {})
}
function dwClearActive() {
  if (!dwState) return
  driftWall.querySelectorAll('.drift-wall__tile.is-active').forEach((x) => {
    x.classList.remove('is-active')
    const v = x.querySelector('video')
    if (v) v.pause()
  })
  dwState.activeId = null
  dwState.hoveredCol = -1
}
function dwRenderStatic() {
  /* 降级：静态姿态，不启动循环（保留点击/悬停样式与可访问性） */
  if (!dwState) return
  dwPlaneTransform(dwState, 0, 0)
  dwState.cols.forEach((c) => { c.el.style.transform = `translate3d(0, ${-c.offset}px, 0)` })
}
function dwStart() {
  if (!dwState || dwState.raf || dwReduced) return
  dwState.last = null
  dwState.raf = requestAnimationFrame(dwFrame)
}
function dwStop() { if (dwState?.raf) { cancelAnimationFrame(dwState.raf); dwState.raf = 0 } }
function dwFrame(now) {
  const s = dwState
  if (!s) return
  if (s.last == null) s.last = now
  const dt = Math.min(0.05, Math.max(0, (now - s.last) / 1000))
  s.last = now

  /* 指针阻尼（帧率无关，官方公式：时间常数 0.12s） */
  const maxTilt = DW.parallax * 8
  const tx = s.pointer.x * maxTilt
  const ty = -s.pointer.y * maxTilt
  const damp = 1 - Math.exp(-dt / 0.12)
  s.damped.x += (tx - s.damped.x) * damp
  s.damped.y += (ty - s.damped.y) * damp
  dwPlaneTransform(s, s.damped.x, s.damped.y)

  /* 各列独立速度缓动：悬停列平滑停下（停 0.16s / 恢复 0.28s 非对称），其余照流 */
  for (let c = 0; c < s.cols.length; c++) {
    const col = s.cols[c]
    const target = (s.hoveredCol === c) ? 0 : col.base
    const ease = 1 - Math.exp(-dt / (target === 0 ? 0.16 : 0.28))
    col.velocity += (target - col.velocity) * ease
    const next = col.offset + col.velocity * dt
    col.offset = ((next % s.copyH) + s.copyH) % s.copyH
    col.el.style.transform = `translate3d(0, ${(-col.offset).toFixed(1)}px, 0)`
  }
  s.raf = requestAnimationFrame(dwFrame)
}
/* 漂移墙点击 → 复用全站视频弹窗播放作品（与作品卡同一套弹窗逻辑） */
function openWorkModal(w) {
  if (!modal || !modalMedia || !modalTitle) return
  modalTitle.textContent = w.title || ''
  if (w.bilibili) {
    modalMedia.innerHTML = biliIframe(w.bilibili)
  } else if (w.local) {
    modalMedia.innerHTML = `<video id="modalVideo" controls style="width:100%;aspect-ratio:16/9;background:#000;border-radius:12px;"><source src="${w.local}" type="video/mp4" /></video>`
    const v = document.getElementById('modalVideo'); if (v) v.play()
  } else {
    modalMedia.innerHTML = `<div class="modal-empty">该作品视频外链待补充，请在可视化修改工坊中填入 B站链接。</div>`
  }
  modal.classList.add('open')
}
/* 窗口尺寸变化时重建墙（防抖 320ms） */
let dwResizeTimer = null
window.addEventListener('resize', () => {
  clearTimeout(dwResizeTimer)
  dwResizeTimer = setTimeout(() => { if (SITE_CONTENT && Object.keys(SITE_CONTENT).length) initDriftWall(SITE_CONTENT) }, 320)
})

/* ============================================================
   11) Animated Footer（Luke Baffait 风格）
   - 全屏揭示：#pageContent 底部留白 100vh，footer fixed 垫底，滚到底揭开
   - 双手 ASCII：✋ 渲染离屏采样亮度 → canvas 字符画；鼠标移上成簇高亮（橙色）
   - 双手随鼠标视差漂移；滚入时从两侧滑入（GSAP）
   - 大标题「KONG / ZHUQI」SplitText 逐字入场（库缺失时手动拆字兜底）
   ============================================================ */
;(function initAnimatedFooter() {
const footerEl = document.getElementById('footer')
const footerTitleEl = document.getElementById('footerTitle')
const fwReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
/* 防御：库缺失或无 footer 时整体跳过（全站其余功能不受影响） */
if (!hasFooterLibs || !footerEl) return

/* ---------- 11.1 SplitText 逐字拆分（兜底：手动拆字） ---------- */
let fwChars = []
if (footerTitleEl) {
  if (window.SplitText) {
    fwChars = new SplitText(footerTitleEl, { type: 'chars' }).chars
  } else {
    const text = footerTitleEl.textContent
    footerTitleEl.innerHTML = ''
    fwChars = [...text].map((ch) => {
      const s = document.createElement('span')
      s.className = 'char' + (ch === '/' ? ' is-slash' : '')
      s.textContent = ch
      footerTitleEl.appendChild(s)
      return s
    })
  }
  fwChars.forEach((c) => { if (c.textContent === '/') c.classList.add('is-slash') })   /* “/” 橙色点睛 */
  gsap.set(fwChars, { yPercent: 118 })
}

/* ---------- 11.2 Footer 入场编排：双手两侧滑入 + 文案 + 标题逐字 ---------- */
const footerTL = gsap.timeline({ paused: true })
if (footerEl) {
  footerTL
    .from('#handLeft',  { x: -180, opacity: 0, duration: 1.4, ease: 'power3.out' }, 0)
    .from('#handRight', { x: 180,  opacity: 0, duration: 1.4, ease: 'power3.out' }, 0.08)
    .from('.footer-top', { y: -24, opacity: 0, duration: 0.9, ease: 'power3.out' }, 0.2)
    .from('#blurb',      { y: 30, opacity: 0, duration: 0.9, ease: 'power3.out' }, 0.35)
  if (fwChars.length) footerTL.to(fwChars, { yPercent: 0, duration: 1.05, ease: 'power4.out', stagger: 0.045 }, 0.45)
  footerTL.from('.footer-meta', { opacity: 0, duration: 0.8 }, 0.9)
  /* 揭示触发：主内容底边抵达视口 92% = footer 开始露出；回滚时反向收起 */
  ScrollTrigger.create({
    trigger: '#pageContent', start: 'bottom 92%',
    onEnter: () => footerTL.play(),
    onLeaveBack: () => footerTL.reverse()
  })
}

/* ---------- 11.3 ASCII 双手：emoji 手 → 离屏采样亮度 → canvas 字符画 ---------- */
const FW_COLS = 64, FW_ROWS = 42
const FW_RAMP = ' .·:;+=xX#%@'                          /* 亮度→字符映射（暗→亮） */
const FW_ACCENT = [255, 92, 26]                          /* 高亮簇：心跳橙 */
const FW_INK = [211, 216, 223]                           /* 基础字符：冷银（石墨银体系） */
const FW_DPR = Math.min(window.devicePixelRatio || 1, 2)

/* ✋ 画到大离屏 canvas 再缩采样（抗锯齿），返回每格亮度 0~1；mirror 镜像成另一只手 */
function fwSampleHand(mirror) {
  const big = document.createElement('canvas')
  big.width = FW_COLS * 4; big.height = FW_ROWS * 4
  const b = big.getContext('2d')
  b.font = `${FW_ROWS * 4 * 0.92}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`
  b.textAlign = 'center'; b.textBaseline = 'middle'
  if (mirror) { b.translate(big.width, 0); b.scale(-1, 1) }
  b.fillText('✋', big.width / 2, big.height / 2 + FW_ROWS)
  const small = document.createElement('canvas')
  small.width = FW_COLS; small.height = FW_ROWS
  const s = small.getContext('2d')
  s.drawImage(big, 0, 0, FW_COLS, FW_ROWS)
  const px = s.getImageData(0, 0, FW_COLS, FW_ROWS).data
  const lums = new Float32Array(FW_COLS * FW_ROWS)
  for (let i = 0; i < FW_COLS * FW_ROWS; i++) {
    const r = px[i * 4], g = px[i * 4 + 1], bl = px[i * 4 + 2], a = px[i * 4 + 3] / 255
    lums[i] = (0.2126 * r + 0.7152 * g + 0.0722 * bl) / 255 * a
  }
  return lums
}

function fwMakeHand(el, mirror) {
  if (!el) return null
  const canvas = el.querySelector('canvas')
  return { el, canvas, ctx: canvas.getContext('2d'), lums: fwSampleHand(mirror),
           energy: new Float32Array(FW_COLS * FW_ROWS), w: 0, h: 0 }
}
const fwHandL = fwMakeHand(document.getElementById('handLeft'), true)    /* 左手 = 镜像 */
const fwHandR = fwMakeHand(document.getElementById('handRight'), false)

function fwFit(st) {
  if (!st) return
  const rect = st.el.getBoundingClientRect()
  st.w = rect.width; st.h = rect.height
  st.canvas.width = Math.round(rect.width * FW_DPR)
  st.canvas.height = Math.round(rect.height * FW_DPR)
  st.ctx.setTransform(FW_DPR, 0, 0, FW_DPR, 0, 0)
  st.ctx.textAlign = 'center'; st.ctx.textBaseline = 'middle'
}
function fwFitAll() { fwFit(fwHandL); fwFit(fwHandR) }
fwFitAll()
window.addEventListener('resize', fwFitAll)

/* ---------- 11.4 鼠标：位置跟踪（视差 + 成簇高亮） ---------- */
const fwMouse = { x: -9999, y: -9999, nx: 0, ny: 0 }
const fwDamped = { x: 0, y: 0 }
footerEl?.addEventListener('pointermove', (e) => {
  fwMouse.x = e.clientX; fwMouse.y = e.clientY
  fwMouse.nx = (e.clientX / window.innerWidth) * 2 - 1
  fwMouse.ny = (e.clientY / window.innerHeight) * 2 - 1
})
footerEl?.addEventListener('pointerleave', () => { fwMouse.x = -9999; fwMouse.y = -9999; fwMouse.nx = 0; fwMouse.ny = 0 })

/* 绘制一只手：能量场驱动「成簇高亮」（靠近即点亮，离开慢熄带拖尾） */
const FW_R_CLUSTER = 8
function fwDrawHand(st) {
  if (!st) return
  const { ctx, lums, energy, w, h } = st
  ctx.clearRect(0, 0, w, h)
  const cellW = w / FW_COLS, cellH = h / FW_ROWS
  ctx.font = `${Math.floor(cellH * 0.98)}px monospace`
  const rect = st.el.getBoundingClientRect()
  const gx = (fwMouse.x - rect.left) / rect.width * FW_COLS
  const gy = (fwMouse.y - rect.top) / rect.height * FW_ROWS
  for (let y = 0; y < FW_ROWS; y++) {
    for (let x = 0; x < FW_COLS; x++) {
      const i = y * FW_COLS + x
      const dx = x - gx, dy = y - gy
      const dist = Math.sqrt(dx * dx + dy * dy)
      const target = dist < FW_R_CLUSTER ? 1 - dist / FW_R_CLUSTER : 0
      energy[i] = Math.max(energy[i] * 0.90, target)
      const lum = lums[i]
      const e = energy[i]
      if (lum < 0.05 && e < 0.04) continue               /* 空白格跳过（性能） */
      const lv = Math.min(1, lum * (0.75 + e * 0.9))
      const ch = FW_RAMP[Math.min(FW_RAMP.length - 1, Math.floor(lv * FW_RAMP.length))]
      if (ch === ' ') continue
      const rr = Math.round(FW_INK[0] + (FW_ACCENT[0] - FW_INK[0]) * e)
      const gg = Math.round(FW_INK[1] + (FW_ACCENT[1] - FW_INK[1]) * e)
      const bb = Math.round(FW_INK[2] + (FW_ACCENT[2] - FW_INK[2]) * e)
      const alpha = Math.min(1, 0.30 + lum * 0.45 + e * 0.55)
      ctx.fillStyle = `rgba(${rr},${gg},${bb},${alpha})`
      ctx.fillText(ch, (x + 0.5) * cellW, (y + 0.5) * cellH)
    }
  }
}

/* ---------- 11.5 主循环：视差漂移 + 双手绘制（接近底部才跑，省电） ---------- */
function fwNearFooter() {
  const doc = document.documentElement
  const remaining = doc.scrollHeight - (window.scrollY + window.innerHeight)
  return remaining < window.innerHeight * 1.3
}
function fwFrame() {
  requestAnimationFrame(fwFrame)
  if (fwReduced || !fwNearFooter()) return
  fwDamped.x += (fwMouse.nx - fwDamped.x) * 0.06
  fwDamped.y += (fwMouse.ny - fwDamped.y) * 0.06
  if (fwHandL) fwHandL.el.style.transform = `translate3d(${fwDamped.x * 26}px, ${fwDamped.y * 16}px, 0)`
  if (fwHandR) fwHandR.el.style.transform = `translate3d(${fwDamped.x * -26}px, ${fwDamped.y * -16}px, 0)`
  fwDrawHand(fwHandL)
  fwDrawHand(fwHandR)
}
fwFrame()

/* ---------- 11.6 降级动效：prefers-reduced-motion 直抵终态 ---------- */
if (fwReduced) {
  if (lenis) { lenis.destroy(); lenis = null }
  footerTL.progress(1)
  ScrollTrigger.getAll().forEach((t) => t.kill())
}
})()
