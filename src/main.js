import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { reveal } from './directives/reveal'

/* 展示字体（免费授权，本地 woff2，仅被当前预设实际使用时下载） */
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/rajdhani/600.css'
import '@fontsource/rajdhani/700.css'
import '@fontsource/cinzel/700.css'
import '@fontsource/playfair-display/700.css'
import '@fontsource/baloo-2/700.css'
import '@fontsource/baloo-2/800.css'

import './styles/tokens.css'
import './styles/base.css'

const app = createApp(App)
app.use(router)
app.directive('reveal', reveal)
app.mount('#app')