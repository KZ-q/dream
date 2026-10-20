/* ============================================================
   DepthCarousel —— 原生 (JS + CSS) 移植版
   源：react-bits / DepthCarousel-JS-CSS（React 组件 + GSAP）
   移植要点：
     · 3D 层叠布局算法与源组件逐行一致（translateX/Z + rotateY + 亮度/模糊衰减）
     · GSAP 存在时用 gsap.to(power3.out)；不存在时回退 rAF 三次缓出，行为一致
     · 指针拖拽 / 横向滚轮 / 键盘 ← → / 点击卡片 / 圆点 / 箭头 全部保留
     · 纵向滚轮不劫持（让页面正常滚动）——长页面必需的适配
     · prefers-reduced-motion：瞬时切换、不自动播放
   用法：DepthCarousel.create(el, { items:[{image,alt,title,desc}], ...opts })
   ============================================================ */
(function (global) {
  'use strict'

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max)
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)   /* GSAP power3.out 等价 */

  const DEFAULTS = {
    cardWidth: 300,
    cardHeight: 400,
    radius: 18,
    tint: '#05060a',
    depth: 220,
    spread: 90,
    tilt: 22,
    tiltDirection: 'right',
    perspective: 1400,
    visibleCards: 4,
    falloff: 0.2,
    blur: 6,
    duration: 700,
    ease: 'power3.out',
    autoplay: false,
    autoplayDelay: 3200,
    loop: true,
    showControls: true,
    showIndicators: true,
    label: '视觉海报轮播',
    onChange: null,
  }

  const ARROW_PATH = {
    prev: 'M15 5l-7 7 7 7',
    next: 'M9 5l7 7-7 7',
  }

  function makeArrow(kind, label) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'depth-carousel__arrow depth-carousel__arrow--' + kind
    btn.setAttribute('aria-label', label)
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' +
      '<path d="' + ARROW_PATH[kind] + '" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"/></svg>'
    return btn
  }

  class DepthCarousel {
    constructor(root, options) {
      this.root = root
      this.opt = Object.assign({}, DEFAULTS, options || {})
      this.items = (this.opt.items || []).map((it) =>
        typeof it === 'string' ? { image: it, alt: '', title: '', desc: '' } : it
      )
      this.count = this.items.length

      this.cards = []
      this.tints = []
      this.dots = []
      this.pos = 0
      this.focusIdx = 0        /* 必须同步 pos：用 -1 会让第一次「下一张」被吞掉 */
      this.scale = 1
      this.drag = null
      this.suppressClick = false
      this.wheelTimer = 0
      this.autoTimer = 0
      this.hovered = false
      this.focused = false
      this.autoEnabled = !!this.opt.autoplay
      this.reduced = global.matchMedia('(prefers-reduced-motion: reduce)').matches
      this._gsapTween = null
      this._raf = 0
      this.ac = new AbortController()

      this.build()
      this.bind()
      this.measure()
      this.layout(this.pos)
      this.notify(0)
      this.startAuto()
    }

    /* ---------- DOM ---------- */
    build() {
      const o = this.opt
      const root = this.root
      root.innerHTML = ''
      root.classList.add('depth-carousel')
      root.style.setProperty('--dc-perspective', o.perspective + 'px')
      root.setAttribute('role', 'group')
      root.setAttribute('aria-roledescription', 'carousel')
      root.setAttribute('aria-label', o.label)
      root.tabIndex = 0

      const stage = document.createElement('div')
      stage.className = 'depth-carousel__stage'
      root.appendChild(stage)

      this.items.forEach((it, i) => {
        const card = document.createElement('div')
        card.className = 'depth-carousel__card'
        card.style.width = o.cardWidth + 'px'
        card.style.height = o.cardHeight + 'px'
        card.style.borderRadius = o.radius + 'px'
        card.setAttribute('aria-roledescription', 'slide')
        card.setAttribute('aria-label', i + 1 + ' of ' + this.count)

        /* 氛围底：同图模糊铺满，垫住 contain 的留白（不裁切海报主体） */
        const bg = document.createElement('div')
        bg.className = 'dc-card__bg'
        bg.setAttribute('aria-hidden', 'true')
        bg.style.backgroundImage = 'url("' + String(it.image).replace(/"/g, '\\"') + '")'
        card.appendChild(bg)

        const img = document.createElement('img')
        img.className = 'depth-carousel__img'
        img.src = it.image
        img.alt = it.alt || it.title || ''
        img.draggable = false
        img.loading = i === 0 ? 'eager' : 'lazy'
        card.appendChild(img)

        const tint = document.createElement('span')
        tint.className = 'depth-carousel__tint'
        tint.setAttribute('aria-hidden', 'true')
        tint.style.background = o.tint
        card.appendChild(tint)

        card.addEventListener(
          'click',
          () => {
            if (this.suppressClick) return
            this.setFocus(i, true)
          },
          { signal: this.ac.signal }
        )

        stage.appendChild(card)
        this.cards.push(card)
        this.tints.push(tint)
      })

      if (o.showControls && this.count > 1) {
        const prev = makeArrow('prev', '上一张')
        const next = makeArrow('next', '下一张')
        prev.addEventListener('click', () => this.navigateBy(-1), { signal: this.ac.signal })
        next.addEventListener('click', () => this.navigateBy(1), { signal: this.ac.signal })
        root.appendChild(prev)
        root.appendChild(next)
      }

      if (o.showIndicators && this.count > 1) {
        const dots = document.createElement('div')
        dots.className = 'depth-carousel__dots'
        dots.setAttribute('role', 'tablist')
        dots.setAttribute('aria-label', '海报分页')
        this.items.forEach((_, i) => {
          const d = document.createElement('button')
          d.type = 'button'
          d.className = 'depth-carousel__dot'
          d.setAttribute('role', 'tab')
          d.setAttribute('aria-label', '查看第 ' + (i + 1) + ' 张海报')
          d.addEventListener('click', () => this.setFocus(i, true), { signal: this.ac.signal })
          dots.appendChild(d)
          this.dots.push(d)
        })
        root.appendChild(dots)
      }
    }

    /* ---------- 布局：与源组件一致的 3D 层叠 ---------- */
    layout(pos) {
      const o = this.opt
      const n = this.count
      if (!n) return
      const dir = o.tiltDirection === 'left' ? -1 : 1
      const sc = this.scale

      for (let i = 0; i < n; i++) {
        const el = this.cards[i]
        if (!el) continue

        let d = i - pos
        if (o.loop && n > 1) {
          d = ((d % n) + n) % n
          if (d > n / 2) d -= n
        }

        const back = Math.max(0, d)
        const az = Math.abs(d)
        const shown = az <= o.visibleCards + 0.5

        const tz = -o.depth * d
        const tx = dir * o.spread * d
        const ry = dir * o.tilt * clamp(d, 0, 1)

        let opacity = d < 0 ? Math.max(0, 1 + d) : 1
        if (!shown) opacity = 0

        const brightness = Math.max(0.15, 1 - back * o.falloff)
        const blurPx = o.blur > 0 ? Math.min(o.blur, (back / Math.max(1, o.visibleCards)) * o.blur) : 0
        const zi = Math.round(2000 - d * 20)

        el.style.transform =
          'translate(-50%, -50%) scale(' + sc + ') translateX(' + tx.toFixed(2) +
          'px) translateZ(' + tz.toFixed(2) + 'px) rotateY(' + ry.toFixed(3) + 'deg)'
        el.style.opacity = opacity.toFixed(3)
        /* opacity:0 在「3D 变换 + will-change + 子元素 filter」的合成层里仍可能被绘制出来
           （实测 Edge/Chromium 会露出一张幽灵卡），用 visibility 兜底最稳 */
        el.style.visibility = opacity < 0.01 ? 'hidden' : 'visible'
        el.style.filter = 'brightness(' + brightness.toFixed(3) + ') blur(' + blurPx.toFixed(2) + 'px)'
        el.style.zIndex = String(zi)
        el.style.pointerEvents = shown && opacity > 0.05 ? 'auto' : 'none'

        const ov = this.tints[i]
        if (ov) ov.style.opacity = clamp(back * o.falloff * 1.25, 0, 0.86).toFixed(3)
      }
    }

    measure() {
      /* 自适应缩放：容器放得下「主卡 + 左右各一张邻卡」就是 1:1，
         更窄才整体缩（卡片 px 尺寸本身由 main.js 的断点表决定）。
         只乘 1.6 而不是 2：邻卡有 translateZ 透视缩小，按足量算会缩得过小。 */
      const w = this.root.clientWidth || 0
      const needed = this.opt.cardWidth + Math.abs(this.opt.spread) * 1.6
      this.scale = clamp(w / needed, 0.4, 1)
      this.layout(this.pos)
    }

    /* ---------- 补间 ---------- */
    killTween() {
      if (this._gsapTween) {
        this._gsapTween.kill()
        this._gsapTween = null
      }
      if (this._raf) {
        cancelAnimationFrame(this._raf)
        this._raf = 0
      }
    }

    normalizePos() {
      const n = this.count
      if (n) this.pos = ((this.pos % n) + n) % n
    }

    tweenTo(target, animate) {
      this.killTween()
      const ms = animate && !this.reduced ? this.opt.duration : 0

      if (!ms) {
        this.pos = target
        this.layout(this.pos)
        this.normalizePos()
        this.layout(this.pos)
        return
      }

      if (global.gsap && typeof global.gsap.to === 'function') {
        const proxy = { p: this.pos }
        this._gsapTween = global.gsap.to(proxy, {
          p: target,
          duration: ms / 1000,
          ease: this.opt.ease,
          onUpdate: () => {
            this.pos = proxy.p
            this.layout(proxy.p)
          },
          onComplete: () => {
            this.normalizePos()
            this.layout(this.pos)
            this._gsapTween = null
          },
        })
        return
      }

      /* 无 GSAP：rAF + 三次缓出，与 power3.out 观感一致 */
      const from = this.pos
      const t0 = performance.now()
      const step = (now) => {
        const t = clamp((now - t0) / ms, 0, 1)
        this.pos = from + (target - from) * easeOutCubic(t)
        this.layout(this.pos)
        if (t < 1) {
          this._raf = requestAnimationFrame(step)
        } else {
          this._raf = 0
          this.normalizePos()
          this.layout(this.pos)
        }
      }
      this._raf = requestAnimationFrame(step)
    }

    setFocus(rawIndex, animate) {
      if (!this.count) return
      const n = this.count
      const idx = this.opt.loop ? ((rawIndex % n) + n) % n : clamp(rawIndex, 0, n - 1)
      let delta = idx - this.pos
      if (this.opt.loop && n > 1) {
        delta = ((delta % n) + n) % n
        if (delta > n / 2) delta -= n
      }
      this.tweenTo(this.pos + delta, animate !== false)
      if (idx !== this.focusIdx) {
        this.focusIdx = idx
        this.notify(idx)
      }
    }

    navigateBy(step) {
      this.setFocus(this.focusIdx + step, true)
    }

    notify(idx) {
      this.dots.forEach((d, i) => {
        d.classList.toggle('is-active', i === idx)
        d.setAttribute('aria-selected', i === idx ? 'true' : 'false')
      })
      this.cards.forEach((c, i) => {
        c.setAttribute('aria-hidden', i === idx ? 'false' : 'true')
      })
      if (typeof this.opt.onChange === 'function') this.opt.onChange(idx, this.items[idx])
    }

    /* ---------- 交互 ---------- */
    bind() {
      const root = this.root
      const sig = { signal: this.ac.signal }

      /* 指针拖拽（鼠标 / 触屏统一走 Pointer Events） */
      root.addEventListener(
        'pointerdown',
        (e) => {
          if (this.count < 2) return
          this.killTween()
          this.drag = {
            x: e.clientX,
            startPos: this.pos,
            lastX: e.clientX,
            lastT: performance.now(),
            v: 0,
            moved: false,
            id: e.pointerId,
          }
        },
        sig
      )

      root.addEventListener(
        'pointermove',
        (e) => {
          const drag = this.drag
          if (!drag) return
          const stepPx = Math.max(this.opt.cardWidth * 0.55 * this.scale, 40)
          const dx = e.clientX - drag.x
          if (!drag.moved && Math.abs(dx) > 4) {
            drag.moved = true
            try { root.setPointerCapture(drag.id) } catch (_) {}
          }
          if (!drag.moved) return
          const now = performance.now()
          const dt = Math.max(now - drag.lastT, 1)
          drag.v = (e.clientX - drag.lastX) / dt
          drag.lastX = e.clientX
          drag.lastT = now
          this.pos = drag.startPos - dx / stepPx
          this.layout(this.pos)
        },
        sig
      )

      const endDrag = () => {
        const drag = this.drag
        if (!drag) return
        this.drag = null
        if (!drag.moved) return
        this.suppressClick = true
        setTimeout(() => { this.suppressClick = false }, 0)
        const stepPx = Math.max(this.opt.cardWidth * 0.55 * this.scale, 40)
        /* 甩动惯性：按最后一段速度往前预估一点，但**总位移限制在起始位置 ±1 张**
           —— 不夹会让一次快速轻扫直接跳过 2~3 张（取模环绕时甚至绕回原张） */
        const projected = clamp(
          this.pos - (drag.v * 140) / stepPx,
          drag.startPos - 1,
          drag.startPos + 1
        )
        this.setFocus(Math.round(projected), true)
      }
      root.addEventListener('pointerup', endDrag, sig)
      root.addEventListener('pointercancel', endDrag, sig)

      /* 只接管横向滚轮；纵向让页面正常滚动 */
      root.addEventListener(
        'wheel',
        (e) => {
          if (this.count < 2) return
          if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
          e.preventDefault()
          this.killTween()
          const raw = e.deltaX
          const delta = e.deltaMode === 1 ? raw * 24 : raw
          const step = clamp(delta / (this.opt.cardWidth * 0.9), -0.6, 0.6)
          this.pos += step
          this.layout(this.pos)
          clearTimeout(this.wheelTimer)
          this.wheelTimer = setTimeout(() => this.setFocus(Math.round(this.pos), true), 130)
        },
        { passive: false, signal: this.ac.signal }
      )

      root.addEventListener(
        'keydown',
        (e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            this.navigateBy(-1)
          } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            this.navigateBy(1)
          }
        },
        sig
      )

      /* 悬停 / 键盘焦点暂停自动播放。
         注意只认「键盘可见焦点」：鼠标点一下箭头同样会 focusin，
         若照字面处理，之后就一直不自动播了（这一版就踩过这个坑）。 */
      const isKbFocus = (el) => {
        try { return !!(el && el.matches && el.matches(':focus-visible')) } catch (_) { return true }
      }
      root.addEventListener('mouseenter', () => { this.hovered = true }, sig)
      root.addEventListener('mouseleave', () => { this.hovered = false }, sig)
      root.addEventListener('focusin', (e) => { this.focused = isKbFocus(e.target) }, sig)
      root.addEventListener('focusout', () => { this.focused = false }, sig)

      if (typeof ResizeObserver === 'function') {
        this.ro = new ResizeObserver(() => this.measure())
        this.ro.observe(root)
      } else {
        global.addEventListener('resize', () => this.measure(), sig)
      }
    }

    /* ---------- 自动播放 ---------- */
    startAuto() {
      if (!this.autoEnabled || this.reduced || this.count < 2 || this.autoTimer) return
      this.autoTimer = setInterval(
        () => {
          if (!this.hovered && !this.focused) this.navigateBy(1)
        },
        Math.max(this.opt.autoplayDelay, 600)
      )
    }

    stopAuto() {
      if (this.autoTimer) {
        clearInterval(this.autoTimer)
        this.autoTimer = 0
      }
    }

    setAutoplay(on) {
      this.autoEnabled = !!on
      if (on) this.startAuto()
      else this.stopAuto()
    }

    destroy() {
      this.killTween()
      this.stopAuto()
      clearTimeout(this.wheelTimer)
      this.ac.abort()
      if (this.ro) this.ro.disconnect()
      this.root.innerHTML = ''
      this.root.classList.remove('depth-carousel')
      this.root.removeAttribute('style')
      this.root.removeAttribute('tabindex')
      this.root.removeAttribute('role')
      this.root.removeAttribute('aria-roledescription')
      this.root.removeAttribute('aria-label')
    }
  }

  global.DepthCarousel = {
    create(root, options) {
      if (!root) return null
      return new DepthCarousel(root, options)
    },
  }
})(window)
