/* 浏览器窗口 Hero：鼠标 3D 倾斜 + 角色头部追踪 + 视线（虹膜）追踪 + 光标聚光 + 滚动渐隐
   （2026-10-20 二次迭代）在头部追踪之上重加「视线」：同图复制 + 双眼羽化蒙版，
   只平移虹膜、眼白与轮廓不动 —— 眼球追踪旧方案（贴假眼珠）已废弃，这版不会穿帮。
   性能约定：单一 rAF 循环，只写 transform 与 CSS 自定义属性，绝不读写布局属性（无重排）
   平滑架构（复刻自 Mainframe 案例 useHeadTracker）：
     · 时间基准插值 s = 1 − e^(−k·dt)：与帧率无关，120Hz 屏不会比 60Hz 快一倍
     · 死区 DEAD：小于阈值的指针变化不更新目标，从源头消灭抖动
     · 分层 k 值：视线(16) > 整窗(10) > 身体(9) > 头部(7.5) —— 眼睛先看，头再跟上
     · 幅度封顶：整窗 ±3.4°/±7px、身体 ±12px、头部 ±3.1°/±6.5px、虹膜 ±1.15%
     · 指针离开：k 降到约 1/4 缓缓回正，不弹不跳
   降级约定：prefers-reduced-motion 或粗指针（触屏）下静态；触屏改用极缓的待机视线漂移 */
(() => {
  const hero = document.getElementById('home')
  const win = document.getElementById('heroWindow')
  const wrap = document.getElementById('heroWindowWrap')
  if (!hero || !win || !wrap) return

  const screen = win.querySelector('.hw-screen')
  const charParallax = win.querySelector('.hw-char-parallax')
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  const coarse = window.matchMedia('(hover: none), (pointer: coarse)')
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b)

  /* ---- 动作参数：每层「跟随速度 k / 回正速度 kBack / 幅度上限」 ---- */
  const LAYERS = {
    win:  { k: 10,  kBack: 3,   rx: 3.4, ry: 2.4, px: 7,  py: 5  },  /* 整窗 3D 倾斜：最跟手 */
    body: { k: 9,   kBack: 2.8, px: 12, py: 8 },                    /* 角色身体视差：与窗反向微移出景深 */
    head: { k: 7.5, kBack: 2.2, tilt: 3.1, shift: 6.5, lift: 4.5 },     /* 头部小幅追踪：最慢一档，天然滞后 */
  }
  const GAZE = { k: 16, kBack: 5.5, x: 1.15, y: 0.9 }  /* 视线：比头快半拍；位移上限为层宽/高的百分比 */
  const DEAD = 0.004    /* 死区：忽略亚像素级指针抖动（不更新目标 = 不启动渲染） */
  const DT_MAX = 0.05   /* 单帧最大步长：切后台再回来不会跳一大步 */

  /* ---- 头部层：把 picture 包进 inner(JS 写倾斜) → breathe(CSS 呼吸)，
         两层 transform 各管各的，互不覆盖（眼球叠加层已随本次重写移除） ---- */
  let charInner = null
  let charGaze = null
  function buildHead() {
    if (!charParallax) return
    const pic = charParallax.querySelector('picture')
    if (!pic || charParallax.querySelector('.hw-char-inner')) return
    const inner = document.createElement('div')
    inner.className = 'hw-char-inner'
    charParallax.insertBefore(inner, pic)
    const breathe = document.createElement('div')
    breathe.className = 'hw-char-breathe'
    inner.appendChild(breathe)
    breathe.appendChild(pic)

    /* 视线层：同图复制 + 双眼羽化蒙版。层尺寸 = 角色图尺寸（容器 shrink-to-fit），
       所以 background-size:100% 100% 与原图逐像素对齐；只平移虹膜，眼白/轮廓不动 */
    const gaze = document.createElement('div')
    gaze.className = 'hw-gaze'
    breathe.appendChild(gaze)
    charGaze = gaze
    const img = breathe.querySelector('img')
    if (img) {
      const syncSrc = () => {
        const src = img.currentSrc || img.getAttribute('src')
        if (src) gaze.style.backgroundImage = 'url("' + src + '")'
      }
      if (img.complete && img.naturalWidth) syncSrc()
      else img.addEventListener('load', syncSrc, { once: true })
      /* 响应式换图（srcset 随视口切换）后重新同步背景 */
      window.addEventListener('resize', syncSrc, { passive: true })
    }
    charInner = inner
  }
  buildHead()

  /* ---- 状态：指针目标 + 各层当前值（全部归一化 −1~1） ---- */
  let tx = 0, ty = 0          /* 指针目标（相对窗口中心） */
  let wx = 0, wy = 0          /* 整窗倾斜 */
  let bx = 0, by = 0          /* 角色身体视差 */
  let hx = 0, hy = 0          /* 头部转动 */
  let gx = 0, gy = 0          /* 视线偏移（比头部更快跟上） */
  let raf = 0, running = false, returning = false, lastT = 0
  let rect = null             /* 窗口矩形缓存：指针移动时零布局读取，滚动/尺寸变化即作废 */

  const measure = () => { rect = win.getBoundingClientRect() }

  const render = (now) => {
    const dt = lastT ? Math.min((now - lastT) / 1000, DT_MAX) : 0.016
    lastT = now
    /* 时间基准指数平滑：同样的 k，60Hz 与 120Hz 观感一致（不会高刷屏快一倍） */
    const ease = (cur, tgt, k) => cur + (tgt - cur) * (1 - Math.exp(-k * dt))

    /* 整窗 3D 倾斜（最跟手） */
    wx = ease(wx, tx, returning ? LAYERS.win.kBack : LAYERS.win.k)
    wy = ease(wy, ty, returning ? LAYERS.win.kBack : LAYERS.win.k)
    win.style.setProperty('--rx', (wx * LAYERS.win.rx).toFixed(3) + 'deg')
    win.style.setProperty('--ry', (-wy * LAYERS.win.ry).toFixed(3) + 'deg')
    win.style.setProperty('--px', (wx * LAYERS.win.px).toFixed(2) + 'px')
    win.style.setProperty('--py', (wy * LAYERS.win.py).toFixed(2) + 'px')

    /* 角色身体视差（与整窗反向，制造"离观者更近"的景深） */
    bx = ease(bx, tx, returning ? LAYERS.body.kBack : LAYERS.body.k)
    by = ease(by, ty, returning ? LAYERS.body.kBack : LAYERS.body.k)
    if (charParallax) {
      charParallax.style.setProperty('--cx', (bx * -LAYERS.body.px).toFixed(2) + 'px')
      charParallax.style.setProperty('--cy', (by * -LAYERS.body.py).toFixed(2) + 'px')
    }

    /* 头部小幅追踪：k 最小 → 相对指针天然滞后半拍，是"被带着看"而不是硬绑定 */
    hx = ease(hx, tx, returning ? LAYERS.head.kBack : LAYERS.head.k)
    hy = ease(hy, ty, returning ? LAYERS.head.kBack : LAYERS.head.k)
    if (charInner) {
      charInner.style.setProperty('--ctilt', (hx * LAYERS.head.tilt).toFixed(3) + 'deg')
      charInner.style.setProperty('--cshift', (hx * LAYERS.head.shift).toFixed(2) + 'px')
      charInner.style.setProperty('--clift', (hy * -LAYERS.head.lift).toFixed(2) + 'px')
    }

    /* 视线：k 最大 → 眼睛先看过去，头部再慢慢跟上（先动眼、后动头才像活人） */
    gx = ease(gx, tx, returning ? GAZE.kBack : GAZE.k)
    gy = ease(gy, ty, returning ? GAZE.kBack : GAZE.k)
    if (charGaze) {
      charGaze.style.setProperty('--gx', (gx * GAZE.x).toFixed(3) + '%')
      charGaze.style.setProperty('--gy', (gy * GAZE.y).toFixed(3) + '%')
    }

    const settled =
      Math.abs(tx - wx) < 0.002 && Math.abs(ty - wy) < 0.002 &&
      Math.abs(tx - bx) < 0.002 && Math.abs(ty - by) < 0.002 &&
      Math.abs(tx - hx) < 0.002 && Math.abs(ty - hy) < 0.002 &&
      Math.abs(tx - gx) < 0.002 && Math.abs(ty - gy) < 0.002
    if (!settled) {
      raf = requestAnimationFrame(render)
    } else {
      running = false
      lastT = 0                       /* 复位时间戳，下次启动 dt 不跳变 */
    }
  }

  const kick = () => {
    if (!running) {
      running = true
      lastT = 0
      raf = requestAnimationFrame(render)
    }
  }

  const onMove = (e) => {
    if (reduce.matches || coarse.matches) return
    if (!rect) measure()
    /* 光标聚光：细活，不受死区影响，始终随手 */
    if (screen) {
      screen.style.setProperty('--mx', clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100) + '%')
      screen.style.setProperty('--my', clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100) + '%')
    }
    const nx = clamp((e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2), -1, 1)
    const ny = clamp((e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2), -1, 1)
    /* 死区：亚像素级抖动不更新目标 —— 抖动的源头在这里被掐掉 */
    if (Math.abs(nx - tx) < DEAD && Math.abs(ny - ty) < DEAD) return
    returning = false
    tx = nx
    ty = ny
    kick()
  }

  /* 指针移出 → 目标归零，回正速度降到约 1/4，缓缓正视（不弹不跳） */
  const reset = () => {
    tx = 0
    ty = 0
    returning = true
    kick()
  }

  const ready = () => {
    wrap.classList.add('is-ready')
    measure()
  }
  if (document.readyState === 'complete') requestAnimationFrame(ready)
  else window.addEventListener('load', () => requestAnimationFrame(ready), { once: true })

  if (!reduce.matches && !coarse.matches) {
    hero.addEventListener('pointermove', onMove, { passive: true })
    hero.addEventListener('pointerleave', reset)
    document.addEventListener('mouseleave', reset)
    window.addEventListener('blur', reset)
  }

  /* 窗口位置随滚动 transform 变化 —— 矩形缓存必须跟着作废（防抖重算，绝不每帧读布局） */
  let rTimer = 0
  window.addEventListener('resize', () => {
    clearTimeout(rTimer)
    rTimer = setTimeout(() => { rect = null; ready() }, 160)
  })
  window.addEventListener('scroll', () => { rect = null }, { passive: true })

  let sraf = 0
  const onScroll = () => {
    if (sraf) return
    sraf = requestAnimationFrame(() => {
      sraf = 0
      if (reduce.matches || coarse.matches) return
      const p = clamp(window.scrollY / Math.max(window.innerHeight, 1), 0, 1)
      win.style.setProperty('--scroll-y', (-p * 46).toFixed(1) + 'px')
      win.style.setProperty('--scroll-o', String(Math.max(1 - p * 0.55, 0.25)))
    })
  }
  if (!reduce.matches) window.addEventListener('scroll', onScroll, { passive: true })

  /* 键盘 / 触摸用户直接显示，不依赖鼠标 */
  if (reduce.matches || coarse.matches) ready()

  void raf
})();                                              /* ⚠️ 必须带分号：否则下一行 IIFE 会被当成对它的调用 */

/* ============================================================
   卡片指针跟随高光：只写 --mx / --my 与 .sheen / .is-hover
   —— 不改 DOM 结构、不改布局，纯事件委托（作品卡是异步渲染的，所以按需挂 class）
   —— rAF 节流，指针移出即清除；触屏（无悬停）直接不启用
   ============================================================ */
;(() => {
  const coarse = window.matchMedia('(hover: none), (pointer: coarse)')
  if (coarse.matches) return

  const SEL = '.work-card, .topic-row'
  let current = null
  let pending = null
  let praf = 0

  const flush = () => {
    praf = 0
    if (!current || !pending) return
    const r = current.getBoundingClientRect()
    current.style.setProperty('--mx', (((pending.cx - r.left) / r.width) * 100).toFixed(2) + '%')
    current.style.setProperty('--my', (((pending.cy - r.top) / r.height) * 100).toFixed(2) + '%')
  }

  document.addEventListener('pointermove', (e) => {
    const card = e.target && e.target.closest ? e.target.closest(SEL) : null
    if (card !== current) {
      if (current) current.classList.remove('is-hover')
      current = card
      if (current) {
        current.classList.add('sheen')
        /* 下一帧再点亮，好让 ::after 从 0 淡入（不跳变） */
        requestAnimationFrame(() => { if (current === card) card.classList.add('is-hover') })
      }
    }
    if (!current) return
    pending = { cx: e.clientX, cy: e.clientY }
    if (!praf) praf = requestAnimationFrame(flush)
  }, { passive: true })

  document.addEventListener('pointerleave', () => {
    if (current) current.classList.remove('is-hover')
    current = null
  })
})()
