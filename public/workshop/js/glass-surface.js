/* ============================================================
   GlassSurface · 原生移植（react-bits「GlassSurface-JS-CSS」→ Vanilla）
   ------------------------------------------------------------
   原组件 824 行 JSX 做的事，这里用 190 行等价实现，核心完全一致：

   · 置换图（displacement map）：
     一张 SVG data-URI，黑底上叠「红横向渐变」「蓝纵向渐变」（mix-blend-mode）
     和最内层一块模糊过的白块。红/蓝渐变构成 XY 方向的位移梯度，
     内层软边白块负责把位移「收」在边缘 —— 玻璃中间不变形，只在边缘折光。
   · 三条 feDisplacementMap 分别以 distortionScale + (0/10/20) 的 scale
     采样 SourceGraphic，再用 feColorMatrix 抠出单通道、screen 混合 —— 这就是色散。
   · 最后 backdrop-filter: url(#id) 把整条链作用到「背后的内容」上。

   与原组件的差异（都是为「贴皮」服务，不改观感）：
   1. 不包裹 children、不改 DOM 结构 —— 只插入 .gfs-bg 层，原节点的
      GSAP 时间线 / IntersectionObserver / 事件委托全部原样可用。
   2. 目标原背景会被清成 transparent（否则滤镜只会糊到自己的底色），卸载时还原。
   3. 置换幅度按元素宽度缩放：-180 在 900px 导航上刚好，在 120px 角标上会糊。

   渲染器：官方有 webgl / svg / auto 三档。这里只实现 svg —— WebGL 那版要把
   背景元素拷进纹理再用 GLSL 采样，收益主要是「SVG 滤镜不被 backdrop-filter 支持时」
   仍然可用；而本机实测 Chrome 155 的 CSS.supports('backdrop-filter','url(#x)') 为 true，
   SVG 路径已足够。传 renderer:'webgl' 会被静默降级到 svg（不做假承诺）。
   ============================================================ */
(function () {
  'use strict'

  /* 参数与官方组件逐项对齐（23 个 props 里，与「贴皮」相关的这些全部支持）：
     borderWidth / brightness / opacity / blur / displace / backgroundOpacity /
     saturation / distortionScale / redOffset / greenOffset / blueOffset /
     xChannel / yChannel / mixBlendMode / refraction / renderer
     未移植：width / height / borderRadius（本站按元素真实尺寸自适应）、
             shape / backdrop（仅 WebGL 渲染器使用）。 */
  var DEFAULTS = {
    borderWidth: 0.07,
    brightness: 50,
    opacity: 0.93,
    blur: 11,               /* 置换图内层白块的柔化半径（决定折光带宽度） */
    displace: 0.7,          /* 官方默认 0；这里保留 0.7 作边缘抗锯齿，可被覆盖 */
    backgroundOpacity: 0.55,/* 玻璃底色不透明度（--gfs-tint） */
    saturation: 1.15,
    distortionScale: -180,
    redOffset: 0,
    greenOffset: 10,
    blueOffset: 20,
    xChannel: 'R',
    yChannel: 'G',
    mixBlendMode: 'difference',
    refraction: true,       /* false = 只留磨砂/高光/描边，不做折射 */
    renderer: 'auto',       /* auto | svg | blur；webgl 未移植，按 svg 处理 */
    rim: true
  }

  var uid = 0
  var instances = []
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)')

  /* ---------- 能力探测：Safari / Firefox 的 backdrop-filter 不接受 url() ---------- */
  var supportCache = null
  function supportsFilterBackdrop() {
    if (supportCache !== null) return supportCache
    var ua = navigator.userAgent
    var isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)
    var isFirefox = /Firefox/.test(ua)
    if (isSafari || isFirefox) { supportCache = false; return false }
    var probe = document.createElement('div')
    probe.style.backdropFilter = 'url(#__gfs_probe__)'
    supportCache = probe.style.backdropFilter !== ''
    return supportCache
  }

  /* ---------- 置换图 ---------- */
  function buildMap(w, h, radius, o, id) {
    var edge = Math.min(w, h) * (o.borderWidth * 0.5)
    var innerW = Math.max(w - edge * 2, 0)
    var innerH = Math.max(h - edge * 2, 0)
    var svg =
      '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg">' +
        '<defs>' +
          '<linearGradient id="rg-' + id + '" x1="100%" y1="0%" x2="0%" y2="0%">' +
            '<stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="red"/>' +
          '</linearGradient>' +
          '<linearGradient id="bg-' + id + '" x1="0%" y1="0%" x2="0%" y2="100%">' +
            '<stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="blue"/>' +
          '</linearGradient>' +
          '<filter id="sf-' + id + '" filterUnits="userSpaceOnUse" x="0" y="0" width="' + w + '" height="' + h + '" color-interpolation-filters="sRGB">' +
            '<feGaussianBlur stdDeviation="' + o.blur + '"/>' +
          '</filter>' +
        '</defs>' +
        '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="black"/>' +
        '<rect x="0" y="0" width="' + w + '" height="' + h + '" rx="' + radius + '" fill="url(#rg-' + id + ')"/>' +
        '<rect x="0" y="0" width="' + w + '" height="' + h + '" rx="' + radius + '" fill="url(#bg-' + id + ')" style="mix-blend-mode:' + o.mixBlendMode + '"/>' +
        '<rect x="' + edge + '" y="' + edge + '" width="' + innerW + '" height="' + innerH + '" rx="' + radius + '" fill="hsl(0 0% ' + o.brightness + '% / ' + o.opacity + ')" filter="url(#sf-' + id + ')"/>' +
      '</svg>'
    return 'data:image/svg+xml,' + encodeURIComponent(svg)
  }

  /* ---------- 滤镜链 ---------- */
  function buildFilterSvg(id, mapUrl, o, scale) {
    var rScale = scale + o.redOffset
    var gScale = scale + o.greenOffset
    var bScale = scale + o.blueOffset
    var svgNS = 'http://www.w3.org/2000/svg'

    var svg = document.createElementNS(svgNS, 'svg')
    svg.setAttribute('class', 'gfs-filter')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('focusable', 'false')

    var defs = document.createElementNS(svgNS, 'defs')
    var filter = document.createElementNS(svgNS, 'filter')
    filter.setAttribute('id', id)
    filter.setAttribute('color-interpolation-filters', 'sRGB')
    filter.setAttribute('x', '0%')
    filter.setAttribute('y', '0%')
    filter.setAttribute('width', '100%')
    filter.setAttribute('height', '100%')

    var feImage = document.createElementNS(svgNS, 'feImage')
    feImage.setAttribute('x', '0')
    feImage.setAttribute('y', '0')
    feImage.setAttribute('width', '100%')
    feImage.setAttribute('height', '100%')
    feImage.setAttribute('preserveAspectRatio', 'none')
    feImage.setAttribute('result', 'map')
    feImage.setAttribute('href', mapUrl)
    feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', mapUrl)
    filter.appendChild(feImage)

    var channels = [
      { name: 'dispRed',   scale: rScale, result: 'red',   matrix: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0' },
      { name: 'dispGreen', scale: gScale, result: 'green', matrix: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0' },
      { name: 'dispBlue',  scale: bScale, result: 'blue',  matrix: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0' }
    ]

    channels.forEach(function (ch) {
      var disp = document.createElementNS(svgNS, 'feDisplacementMap')
      disp.setAttribute('in', 'SourceGraphic')
      disp.setAttribute('in2', 'map')
      disp.setAttribute('scale', String(ch.scale))
      disp.setAttribute('xChannelSelector', o.xChannel)
      disp.setAttribute('yChannelSelector', o.yChannel)
      disp.setAttribute('result', ch.name)
      filter.appendChild(disp)

      var cm = document.createElementNS(svgNS, 'feColorMatrix')
      cm.setAttribute('in', ch.name)
      cm.setAttribute('type', 'matrix')
      cm.setAttribute('values', ch.matrix)
      cm.setAttribute('result', ch.result)
      filter.appendChild(cm)
    })

    var blend1 = document.createElementNS(svgNS, 'feBlend')
    blend1.setAttribute('in', 'red')
    blend1.setAttribute('in2', 'green')
    blend1.setAttribute('mode', 'screen')
    blend1.setAttribute('result', 'rg')
    filter.appendChild(blend1)

    var blend2 = document.createElementNS(svgNS, 'feBlend')
    blend2.setAttribute('in', 'rg')
    blend2.setAttribute('in2', 'blue')
    blend2.setAttribute('mode', 'screen')
    blend2.setAttribute('result', 'output')
    filter.appendChild(blend2)

    var blurNode = document.createElementNS(svgNS, 'feGaussianBlur')
    blurNode.setAttribute('in', 'output')
    blurNode.setAttribute('stdDeviation', String(o.displace))
    filter.appendChild(blurNode)

    defs.appendChild(filter)
    svg.appendChild(defs)
    return { svg: svg, feImage: feImage }
  }

  function parseRadius(el) {
    var br = getComputedStyle(el).borderTopLeftRadius || '0'
    var n = parseFloat(br)
    return isNaN(n) ? 0 : n
  }

  function clamp(v, a, b) { return Math.min(Math.max(v, a), b) }

  /* ---------- 单个实例 ---------- */
  function attach(el, options) {
    if (!el || el.__gfs) return el && el.__gfs

    var o = Object.assign({}, DEFAULTS, options || {})
    var id = 'gfs-' + (++uid)

    var bg = document.createElement('div')
    bg.className = 'gfs-bg'
    bg.setAttribute('aria-hidden', 'true')

    var frost = document.createElement('div')
    frost.className = 'gfs-frost'
    bg.appendChild(frost)

    var sheen = document.createElement('div')
    sheen.className = 'gfs-sheen'
    bg.appendChild(sheen)

    var rim = null
    if (o.rim !== false) {
      rim = document.createElement('div')
      rim.className = 'gfs-rim'
      bg.appendChild(rim)
    }

    var built = buildFilterSvg(id, '', o, o.distortionScale)
    bg.appendChild(built.svg)

    /* 记住原背景，卸载时还原 */
    var prevInlineBg = el.style.backgroundColor
    el.classList.add('gfs')
    el.style.backgroundColor = 'transparent'
    el.appendChild(bg)

    var inst = {
      el: el, id: id, opt: o, bg: bg, feImage: built.feImage, ro: null, raf: 0,
      lastW: 0, lastH: 0
    }

    function paint() {
      var w = Math.round(el.clientWidth)
      var h = Math.round(el.clientHeight)
      if (!w || !h) return
      if (w === inst.lastW && h === inst.lastH) return
      inst.lastW = w
      inst.lastH = h
      var radius = parseRadius(el)
      var map = buildMap(w, h, radius, o, id)

      /* 幅度随宽度缩放：-180 适合 900px 的导航，120px 的角标需要收窄 */
      var factor = clamp(w / 520, 0.35, 1)
      var scale = o.distortionScale * factor
      /* 色散偏移同步收敛：固定的 10/20px 在小面板上会让边缘出现明显彩虹脏边
         （实测 620px 展签牌左缘可见），按幅度比例缩到 1/3 以内就干净了。 */
      var dispFactor = Math.min(1, Math.abs(scale) / 150)

      inst.feImage.setAttribute('href', map)
      inst.feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', map)

      var disps = bg.querySelectorAll('feDisplacementMap')
      var offsets = [o.redOffset, o.greenOffset, o.blueOffset]
      for (var i = 0; i < disps.length && i < offsets.length; i++) {
        disps[i].setAttribute('scale', (scale + offsets[i] * dispFactor).toFixed(1))
      }
    }

    /* 高度动画期间（CardNav 展开）ResizeObserver 会每帧回调。
       置换图是按像素尺寸生成的，逐帧重建纯属浪费 —— 拖到「停下来 140ms」再重建一次；
       中间的过渡帧由 feImage 的 preserveAspectRatio="none" 拉伸顶上，肉眼无差。 */
    function queue() {
      if (inst.raf) return
      inst.raf = requestAnimationFrame(function () {
        inst.raf = 0
        clearTimeout(inst.settle)
        inst.settle = setTimeout(paint, 140)
      })
    }

    /* 渲染器选择：
       - webgl 未移植（要 800 行 GLSL + 把背景拷进纹理），显式降级到 svg，避免用户以为开了 WebGL
       - blur = 官方 renderer:'blur' 的等价物：只模糊不折射
       - refraction:false 同样走「无折射」，但保留磨砂/高光/描边 */
    var wanted = o.renderer === 'webgl' ? 'svg' : o.renderer
    var fallback = reduce.matches || wanted === 'blur' || !supportsFilterBackdrop()
    var refract = o.refraction !== false && !fallback

    if (fallback) el.classList.add('gfs--fallback')
    if (!refract) el.classList.add('gfs--norefract')
    bg.style.setProperty('--gfs-filter', refract ? 'url(#' + id + ')' : 'none')
    bg.style.setProperty('--gfs-sat', String(o.sat != null ? o.sat : o.saturation))
    bg.style.setProperty('--gfs-tint', String(o.backgroundOpacity))

    inst.refresh = queue
    inst.paint = paint
    el.__gfs = inst
    instances.push(inst)

    queue()
    paint()

    if ('ResizeObserver' in window) {
      inst.ro = new ResizeObserver(queue)
      inst.ro.observe(el)
    }

    return inst
  }

  function detach(el) {
    var inst = el && el.__gfs
    if (!inst) return
    if (inst.ro) inst.ro.disconnect()
    if (inst.raf) cancelAnimationFrame(inst.raf)
    if (inst.bg && inst.bg.parentNode) inst.bg.parentNode.removeChild(inst.bg)
    el.classList.remove('gfs', 'gfs--fallback', 'gfs--norefract')
    el.style.backgroundColor = ''
    delete el.__gfs
    instances = instances.filter(function (x) { return x !== inst })
  }

  function refreshAll() {
    instances.forEach(function (i) { i.paint() })
  }

  /* ---------- 自动挂载：扫描 [data-glass] ---------- */
  function autoMount() {
    var nodes = document.querySelectorAll('[data-glass]')
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i]
      if (el.__gfs) {
        /* main.js 的 applyContent() 会用 innerHTML 重写 [data-bind] 节点的内容，
           把我们插进去的 .gfs-bg 一起冲掉（类名还在、层没了）。
           检测到层已脱离文档就丢弃旧实例重挂，避免出现「有 gfs 类但没玻璃」的僵尸。 */
        if (el.__gfs.bg && el.__gfs.bg.isConnected) continue
        detach(el)
      }
      var opts = {}
      var scale = parseFloat(el.getAttribute('data-glass-scale'))
      if (!isNaN(scale)) opts.distortionScale = scale
      /* 斜角宽度：0.07 是官方默认，约等于「min(宽,高) 的 3.5%」。
         低矮的导航条（60px）上只有 2px，几乎看不出折光，所以允许逐个放大。 */
      var edge = parseFloat(el.getAttribute('data-glass-edge'))
      if (!isNaN(edge)) opts.borderWidth = edge
      if (el.getAttribute('data-glass-rim') === 'off') opts.rim = false

      /* 新增：官方其余参数的数据属性入口 */
      var disp = parseFloat(el.getAttribute('data-glass-displace'))
      if (!isNaN(disp)) opts.displace = disp
      var tint = parseFloat(el.getAttribute('data-glass-tint'))
      if (!isNaN(tint)) opts.backgroundOpacity = tint
      var sat = parseFloat(el.getAttribute('data-glass-sat'))
      if (!isNaN(sat)) opts.saturation = sat
      if (el.getAttribute('data-glass-refraction') === 'off') opts.refraction = false
      var renderer = el.getAttribute('data-glass-renderer')
      if (renderer) opts.renderer = renderer

      attach(el, opts)
    }
  }

  function boot() {
    autoMount()
    /* 海报 / 音乐 / 作品由 main.js 异步渲染，晚一点再扫一遍 */
    setTimeout(autoMount, 600)
    setTimeout(autoMount, 1800)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }

  window.addEventListener('resize', function () {
    clearTimeout(window.__gfsResize)
    window.__gfsResize = setTimeout(refreshAll, 180)
  }, { passive: true })

  /* 工坊实时推送内容后，可能新增 [data-glass] 节点 */
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'wk:content') setTimeout(autoMount, 400)
  })

  window.GlassSurface = {
    attach: attach,
    detach: detach,
    refresh: refreshAll,
    mount: autoMount,
    supported: supportsFilterBackdrop,
    defaults: DEFAULTS,
    /* 运行时改参数：先卸载再按新参数重挂（置换图与滤镜 ID 都要重建） */
    set: function (el, opts) {
      detach(el)
      return attach(el, opts)
    }
  }
})()
