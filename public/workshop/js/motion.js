/* ============================================================
   Motion System v2 — 行为侧
   ------------------------------------------------------------
   只做两件事（其余全部交给 motion.css 声明式完成，JS 越少越稳）：

   1) 入场错峰：把每个区块内的 .reveal 编号写入 --i，
      由 CSS 换算成 70ms 级联延迟。同屏 6 个元素时，最后一个晚 420ms 出发 ——
      视觉上是"依次浮现"，而不是"整块贴上来"。

   2) 分层视差：修复一个一直没生效的 bug。
      原 main.js 用 document.querySelectorAll('.parallax-layer')，
      但全站没有任何元素挂这个类（#storyBg 挂的是 data-speed 属性），
      那 6 行代码等于空转，引言带的视差从未动过。
      这里改用 [data-speed] 选择器重新接管，并做两件事：
        · 位移封顶 ±22px（原来 y*speed 随页面长度线性增长，滚到 3000px 就偏 750px，
          观感不是"深度"而是"背景跟丢了"）；
        · 用 lerp 平滑，把滚动事件的高频抖动吃掉。

   与 main.js 的关系：两者不重叠。main.js 的 .parallax-layer 列表为空，
   不会与这里争抢同一个元素的 transform。
   ============================================================ */
(function () {
  'use strict'

  var clamp = function (v, a, b) { return Math.min(Math.max(v, a), b) }
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)')

  /* ---------- 1) 入场错峰 ---------------------------------------------- */
  var STAGGER_CAP = 6   /* 超过 6 件不再累加，否则末位要等 1s 以上，反而拖慢 */

  function assignStagger() {
    var groups = new Map()
    var nodes = document.querySelectorAll('.reveal')
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i]
      /* 以「最近的 section」为分组单位：同一屏内的元素才需要错峰，
         跨区块错峰没有意义（它们本来就不同时可见） */
      var host = el.closest('section') || el.parentElement || document.body
      if (!groups.has(host)) groups.set(host, [])
      groups.get(host).push(el)
    }
    groups.forEach(function (list) {
      for (var k = 0; k < list.length; k++) {
        list[k].style.setProperty('--i', String(Math.min(k, STAGGER_CAP)))
      }
    })
  }

  assignStagger()

  /* 作品 / 音乐 / 海报由 JS 渲染，节点晚于本文件出现 —— 用防抖 MutationObserver 补编号。
     只监听 childList、不监听 attributes，避免写 --i 时触发自己（无限循环）。 */
  var moTimer = null
  if ('MutationObserver' in window) {
    new MutationObserver(function () {
      clearTimeout(moTimer)
      moTimer = setTimeout(assignStagger, 220)
    }).observe(document.body, { childList: true, subtree: true })
  }

  /* ---------- 2) 分层视差 ---------------------------------------------- */
  var PAR_LIMIT = 22    /* 位移硬上限（px）：滚过一整屏最多偏 22px，够形成层次又不失真 */
  var PAR_LERP = 0.12   /* 平滑系数：0.12 ≈ 8 帧追到目标的 90%，比直绑 scrollY 稳得多 */

  var state = { raf: 0, layers: [], current: [], bound: false }

  function collect() {
    var next = Array.prototype.slice.call(document.querySelectorAll('[data-speed]'))
    /* 只保留新增的层，避免重复 init 时同一元素被两条循环同时写 transform */
    for (var i = 0; i < next.length; i++) {
      if (state.layers.indexOf(next[i]) === -1) {
        state.layers.push(next[i])
        state.current.push(0)
      }
    }
  }

  function tick() {
    var vh = window.innerHeight
    var still = false

    for (var i = 0; i < state.layers.length; i++) {
      var el = state.layers[i]
      var host = el.parentElement || el

      /* ⚠️ 必须量父元素：el 自身带 transform，getBoundingClientRect 会把它算进去，
         形成"量→改→量"的反馈回路，滚动时表现为缓慢漂移。 */
      var rect = host.getBoundingClientRect()
      if (rect.bottom < -320 || rect.top > vh + 320) continue

      /* 元素中心相对视口中线的归一化偏移（-1 顶部 … +1 底部），天生自限 */
      var offset = (rect.top + rect.height / 2 - vh / 2) / (vh / 2)
      var speed = parseFloat(el.getAttribute('data-speed')) || 0.25
      var target = clamp(-offset * PAR_LIMIT * (speed / 0.25), -PAR_LIMIT, PAR_LIMIT)

      var delta = target - state.current[i]
      if (Math.abs(delta) > 0.12) {
        state.current[i] += delta * PAR_LERP
        still = true
      } else {
        state.current[i] = target
      }
      el.style.transform = 'translate3d(0, ' + state.current[i].toFixed(2) + 'px, 0)'
    }

    state.raf = still ? window.requestAnimationFrame(tick) : 0
  }

  function kick() {
    if (!state.raf) state.raf = window.requestAnimationFrame(tick)
  }

  function initParallax() {
    if (reduce.matches) return
    collect()
    if (!state.layers.length) return
    if (!state.bound) {
      window.addEventListener('scroll', kick, { passive: true })
      window.addEventListener('resize', kick, { passive: true })
      state.bound = true
    }
    kick()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initParallax)
  } else {
    initParallax()
  }

  /* ---------- 3) 工坊推送内容后可能新增 [data-speed] 层 ---------------- */
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'wk:content') setTimeout(initParallax, 400)
  })
})()
