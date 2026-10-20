import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { workshopServer } from './studio/server.mjs'

/* 所有环境相关参数集中在 .env / .env.example，禁止在代码里硬编码 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  /* 端口优先级：部署平台注入的 PORT > .env 的 VITE_PORT > 5173 默认 */
  const port = Number(process.env.PORT) || Number(env.VITE_PORT) || 5173
  const base = env.VITE_BASE_PATH || '/'            // 默认 '/'，子路径部署改这里
  return {
    base,
    plugins: [vue(), workshopServer()],
    server: {
      port,
      host: true,                                   // host:true 便于局域网/容器访问（= 0.0.0.0）
      allowedHosts: true                            // 公网经反向代理域名访问，需放开 Vite 的 Host 校验
    },
    build: { target: 'es2020' },
    /* 构建版本号：每次构建都变化，供页面给「文件名固定的静态资源」加 ?v= 破缓存。
       场景：作品站 public/workshop/ 是原样拷贝的，index.html / css/style.css 文件名不带 hash，
       改版后浏览器可能继续用旧缓存 —— 表现为「线上已更新，用户端看不到」。
       用法见 src/views/PortfolioSiteView.vue 与 scripts/asset-version.mjs。 */
    define: {
      __BUILD_VERSION__: JSON.stringify(Date.now().toString(36))
    }
  }
})
