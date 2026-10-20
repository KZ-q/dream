import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  /* 部署根路径直达作品站：访客访问 / 即看到作品集（与原「public/workshop 静态发布」的观感一致）。
     注意用 iframe 承载而非直出 —— iframe 内相对链接 "edit" 才能正确解析到 /workshop/edit，
     工坊入口也据此判定「有后台可用」而正常显示。原 Craftfolio 首页让位到 /home。 */
  { path: '/', name: 'root-workshop', component: () => import('../views/PortfolioSiteView.vue') },
  { path: '/home', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/works', name: 'works', component: () => import('../views/WorksView.vue') },
  { path: '/videos', name: 'videos', component: () => import('../views/VideosView.vue') },
  { path: '/about', name: 'about', component: () => import('../views/AboutView.vue') },
  /* 孔诸祺 AIGC 作品站：纯静态站（public/workshop/）经 iframe 承载，dev/prod 均可访问 */
  { path: '/workshop', name: 'workshop', component: () => import('../views/PortfolioSiteView.vue') }
]

/* 内容工坊（编辑器）注册策略 —— 双版本构建的核心开关：
   - dev（npm run dev）：/studio 与 /workshop/edit 都注册，本地用工坊改内容；
   - 工坊版构建（npm run build:workshop → --mode workshop → VITE_WITH_WORKSHOP=1）：注册 /workshop/edit，
     线上也能打开工坊（保存/上传依赖本地 dev server，静态部署下自动降级为只读预览）；
     /studio 是旧版通用工坊（预览同步依赖 dev 专属代码），不随工坊版上线；
   - 基础版构建（npm run build）：两者都不注册，产物不含编辑器 chunk；直链 /workshop/edit 重定向回作品站。
   ⚠️ /workshop/edit 必须排在 /workshop/:pathMatch(.*)* 之前，否则会被通配符抢先匹配。 */
if (import.meta.env.DEV) {
  routes.push({ path: '/studio', name: 'studio', component: () => import('../views/WorkshopView.vue') })
}
if (import.meta.env.DEV || import.meta.env.VITE_WITH_WORKSHOP) {
  /* 孔诸祺作品站专属可视化工坊（/workshop/edit） */
  routes.push({ path: '/workshop/edit', name: 'workshop-edit', component: () => import('../views/WorkshopEditorView.vue') })
} else {
  /* 基础版未编译工坊编辑器：直链编辑页时回到作品站，避免 iframe 落到 404 */
  routes.push({ path: '/workshop/edit', redirect: '/workshop' })
}

routes.push({ path: '/workshop/:pathMatch(.*)*', name: 'workshop-sub', component: () => import('../views/PortfolioSiteView.vue') })
routes.push({ path: '/:pathMatch(.*)*', redirect: '/' })

/* 锚点元素可能尚未渲染（content 异步加载完成前 #id 不存在），
   轮询等待其出现；超时则回退滚动到顶部，避免直链 /about#contact 失效 */
function waitForAnchor(hash, timeout = 8000) {
  return new Promise((resolve) => {
    const id = decodeURIComponent(hash.slice(1))
    const t0 = Date.now()
    const tick = () => {
      const el = document.getElementById(id)
      if (el) return resolve(el)
      if (Date.now() - t0 > timeout) return resolve(null)
      setTimeout(tick, 120)
    }
    tick()
  })
}

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  async scrollBehavior(to, from, saved) {
    if (saved) return saved
    if (to.hash) {
      const el = await waitForAnchor(to.hash)
      return el ? { el, behavior: 'smooth', top: 80 } : { top: 0 }
    }
    return { top: 0 }
  }
})