<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useContent } from '../composables/useContent'
import { linkKind } from '../utils/link'
import { resolveSrc } from '../utils/image'
import AppLink from './AppLink.vue'

const props = defineProps({ presets: { type: Array, default: () => [] } })

const { state, t, setLang, setPreset } = useContent()
const route = useRoute()

const scrolled = ref(false)
const menuOpen = ref(false)
const themeOpen = ref(false)
const themeBox = ref(null)

const onScroll = () => {
  scrolled.value = window.scrollY > 24
}
const onDocClick = (e) => {
  if (themeBox.value && !themeBox.value.contains(e.target)) themeOpen.value = false
}
onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('click', onDocClick)
})
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  document.removeEventListener('click', onDocClick)
})
watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
    themeOpen.value = false
  }
)

const site = computed(() => state.content?.site || {})
const navItems = computed(() => state.content?.nav || [])
const LANG_LABEL = { zh: '中', en: 'EN' }
const langs = computed(() => site.value.languages || ['zh'])
const curPreset = computed(() => props.presets.find((p) => p.id === state.preset))
const isDev = import.meta.env.DEV
/* 工坊 iframe 预览内不显示"工坊"入口（避免预览里再嵌工坊） */
const inFrame = window.self !== window.top

/* 选中预设后收起下拉（否则菜单保持展开，需点击外部才能关闭） */
function onPickPreset(id) {
  setPreset(id)
  themeOpen.value = false
}
</script>

<template>
  <header class="nav" :class="{ scrolled: scrolled || menuOpen }">
    <div class="container nav-inner">
      <router-link to="/" class="brand">
        <img v-if="site.logo" class="logo" :src="resolveSrc(site.logo)" alt="" />
        <span class="brand-name display">{{ t(site.title) }}</span>
      </router-link>

      <nav class="links" aria-label="Main">
        <router-link
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          :class="{ active: route.path === item.to }"
        >
          {{ t(item.label) }}
        </router-link>
        <router-link v-if="isDev && !inFrame" to="/workshop" class="nav-link wk-link">工坊</router-link>
      </nav>

      <div class="right">
        <!-- 主题预设切换器 -->
        <div ref="themeBox" class="theme">
          <button
            class="theme-btn"
            data-testid="preset-btn"
            :aria-expanded="themeOpen"
            aria-label="Theme"
            @click.stop="themeOpen = !themeOpen"
          >
            <span
              class="swatch"
              :style="curPreset ? { background: `linear-gradient(120deg, ${curPreset.colors.join(',')})` } : null"
            />
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
          <Transition name="drop">
            <div v-if="themeOpen" class="theme-menu card">
              <button
                v-for="p in presets"
                :key="p.id"
                data-testid="preset-option"
                :class="{ on: state.preset === p.id }"
                @click="onPickPreset(p.id)"
              >
                <span class="swatch" :style="{ background: `linear-gradient(120deg, ${p.colors.join(',')})` }" />
                <span class="tname">{{ t(p.label) }}</span>
                <span v-if="state.preset === p.id" class="tick">✓</span>
              </button>
            </div>
          </Transition>
        </div>

        <!-- 语言切换 -->
        <div v-if="langs.length > 1" class="lang">
          <button
            v-for="l in langs"
            :key="l"
            :data-lang="l"
            :class="{ on: state.lang === l }"
            @click="setLang(l)"
          >
            {{ LANG_LABEL[l] || l.toUpperCase() }}
          </button>
        </div>

        <AppLink v-if="site.cta" :to="site.cta.url" class="btn btn-primary nav-cta">
          {{ t(site.cta.label) }}
        </AppLink>
        <button class="burger" :aria-expanded="menuOpen" aria-label="Menu" @click="menuOpen = !menuOpen">
          <span /><span /><span />
        </button>
      </div>
    </div>

    <div v-if="menuOpen" class="mobile">
      <template v-for="item in navItems" :key="item.to">
        <router-link v-if="linkKind(item.to) === 'internal'" :to="item.to">{{ t(item.label) }}</router-link>
        <a v-else :href="item.to" target="_blank" rel="noopener">{{ t(item.label) }}</a>
      </template>
      <router-link v-if="isDev && !inFrame" to="/workshop">🛠 工坊（开发）</router-link>
      <div class="m-row">
        <div v-if="langs.length > 1" class="lang">
          <button v-for="l in langs" :key="l" :class="{ on: state.lang === l }" @click="setLang(l)">
            {{ LANG_LABEL[l] || l.toUpperCase() }}
          </button>
        </div>
        <div class="swatches">
          <button
            v-for="p in presets"
            :key="p.id"
            :aria-label="t(p.label)"
            :title="t(p.label)"
            :class="{ on: state.preset === p.id }"
            @click="setPreset(p.id)"
          >
            <span class="swatch" :style="{ background: `linear-gradient(120deg, ${p.colors.join(',')})` }" />
          </button>
        </div>
      </div>
      <AppLink v-if="site.cta" :to="site.cta.url" class="btn btn-primary">{{ t(site.cta.label) }}</AppLink>
    </div>
  </header>
</template>

<style scoped>
.nav {
  position: fixed;
  inset: 0 0 auto;
  z-index: 50;
  transition: background var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
  border-bottom: 1px solid transparent;
}
.nav.scrolled {
  background: color-mix(in srgb, var(--c-bg) 72%, transparent);
  backdrop-filter: blur(14px);
  border-bottom-color: var(--c-line);
}
.nav-inner {
  display: flex;
  align-items: center;
  gap: 26px;
  height: 68px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.logo {
  height: 28px;
  width: auto;
}
.brand-name {
  font-size: 19px;
}
.links {
  display: flex;
  gap: 26px;
  margin-inline: auto;
}
.links a {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--c-muted);
  transition: color var(--t-fast) var(--ease);
}
.links a:hover,
.links a.active {
  color: var(--c-text);
}
.links a.active {
  color: var(--c-primary);
}
.links a.wk-link {
  color: var(--c-accent);
  opacity: 0.85;
}
.right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

/* 主题切换器 */
.theme {
  position: relative;
}
.theme-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--c-line);
  border-radius: 999px;
  background: transparent;
  color: var(--c-muted);
  cursor: pointer;
  transition: border-color var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
}
.theme-btn:hover {
  border-color: var(--c-primary);
  color: var(--c-text);
}
.swatch {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
}
.theme-menu {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 20;
  min-width: 168px;
  padding: 8px;
  display: grid;
  gap: 2px;
  background: color-mix(in srgb, var(--c-bg) 88%, transparent);
  backdrop-filter: blur(16px);
}
.theme-menu button {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--c-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: background var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
}
.theme-menu button:hover {
  background: var(--c-surface);
  color: var(--c-text);
}
.theme-menu button.on {
  color: var(--c-text);
}
.tname {
  flex: 1;
}
.tick {
  color: var(--c-accent);
  font-size: 12px;
}
.drop-enter-active,
.drop-leave-active {
  transition: opacity var(--t-fast) var(--ease), transform var(--t-fast) var(--ease);
}
.drop-enter-from,
.drop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* 语言切换 */
.lang {
  display: flex;
  border: 1px solid var(--c-line);
  border-radius: 999px;
  overflow: hidden;
}
.lang button {
  padding: 4px 12px;
  background: none;
  border: 0;
  color: var(--c-muted);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.lang button.on {
  background: var(--c-primary);
  color: #fff;
}
[data-preset='paper'] .lang button.on {
  color: #f6f4ef;
}
.nav-cta {
  padding: 9px 22px;
  font-size: 13px;
}
.burger {
  display: none;
  flex-direction: column;
  gap: 5px;
  background: none;
  border: 0;
  cursor: pointer;
  padding: 8px;
}
.burger span {
  width: 22px;
  height: 2px;
  background: var(--c-text);
}
.mobile {
  display: none;
}
@media (max-width: 900px) {
  .links,
  .nav-cta,
  .theme {
    display: none;
  }
  .burger {
    display: flex;
  }
  .mobile {
    display: grid;
    gap: 4px;
    padding: 12px clamp(16px, 4vw, 32px) 20px;
    border-top: 1px solid var(--c-line);
    background: color-mix(in srgb, var(--c-bg) 92%, transparent);
    backdrop-filter: blur(14px);
  }
  .mobile > a {
    padding: 10px 4px;
    font-weight: 600;
  }
  .m-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 4px;
  }
  .swatches {
    display: flex;
    gap: 10px;
  }
  .swatches > button {
    padding: 2px;
    border: 2px solid transparent;
    border-radius: 50%;
    background: none;
    cursor: pointer;
  }
  .swatches > button.on {
    border-color: var(--c-primary);
  }
  .mobile .btn {
    margin-top: 10px;
    justify-content: center;
  }
}
</style>
