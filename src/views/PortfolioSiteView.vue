<script setup>
/* ============================================================
   孔诸祺 AIGC 作品站（静态站点）承载页
   通过内嵌 iframe 加载 public/workshop/ 下的纯静态站（index.html）。
   使用 import.meta.env.BASE_URL 拼接地址，保证部署在任意子路径下都不 404。
   ============================================================ */
import { computed } from 'vue'

/* BASE_URL 来自 vite.config 的 base（默认 '/'）。拼出 /workshop/index.html
   ?v= 用构建版本号（vite.config 的 define.__BUILD_VERSION__）：
   workshop/index.html 文件名固定、不带 hash，改版后浏览器可能拿旧缓存导致「线上已更新、用户端看不到」。
   给 iframe 地址加上每次构建都会变的版本号，就能强制拉最新的 HTML，
   而 HTML 内部的 css/js 引用又由 scripts/asset-version.mjs 打上内容哈希，两级都破缓存。 */
const src = computed(() => `${import.meta.env.BASE_URL}workshop/index.html?v=${__BUILD_VERSION__}`)
</script>

<template>
  <div class="portfolio-frame">
    <iframe :src="src" title="孔诸祺 · AIGC 影像创作" loading="eager"></iframe>
  </div>
</template>

<style scoped>
/* 全屏页框：占满视口，无外边距，让静态站自己决定内边距 */
.portfolio-frame {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background: #0a0908;
  /* ⚠️ 必须高于 App.vue 的 header.nav（z-index: 50）。
     承载页本身就是全屏作品站、自带导航栏，若被应用自己的导航栏压在上层，
     顶部约 69px 的点击会全被那层 header 吃掉 —— 表现为作品站右上角
     「⚙ 工坊」按钮看得见却点不动（实际点击落在 header 的语言按钮上）。 */
  z-index: 100;
}
.portfolio-frame iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}
</style>
