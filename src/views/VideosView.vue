<script setup>
import { ref, computed } from 'vue'
import { useContent } from '../composables/useContent'
import { tUI } from '../utils/ui'
import { bilibiliEmbed, bilibiliPage } from '../utils/video'
import { resolveSrc } from '../utils/image'
import AppLink from '../components/AppLink.vue'

/* 视频页：B 站视频卡片列表，每张卡片独立 Facade 展开 */
const { state, t } = useContent()

const data = computed(() => state.content?.videos || {})
const items = computed(() => data.value.items || [])
const playing = ref(new Set())

function play(i) {
  playing.value = new Set([...playing.value, i])
}
function embed(item) {
  return bilibiliEmbed(item.bvid, { autoplay: 1, page: item.page || 1 })
}
function pageUrl(item) {
  return bilibiliPage(item)
}
</script>

<template>
  <div class="container">
    <header class="page-hero" v-reveal>
      <p class="kicker">{{ tUI('videos') }}</p>
      <h1 class="display title">{{ t(data.title) }}</h1>
      <p class="lead">{{ t(data.desc) }}</p>
    </header>

    <div class="list">
      <article v-for="(v, i) in items" :key="v.id || i" class="item card" v-reveal="(i % 2) * 80">
        <div class="frame">
          <iframe
            v-if="playing.has(i) && embed(v)"
            :src="embed(v)"
            :title="t(v.title)"
            scrolling="no"
            frameborder="no"
            framespacing="0"
            allowfullscreen="true"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          />
          <template v-else>
            <div class="cover">
              <img :src="resolveSrc(v.cover?.src)" :alt="t(v.cover?.alt)" loading="lazy" decoding="async" />
            </div>
            <button v-if="embed(v)" class="play" :aria-label="tUI('play')" @click="play(i)">
              <svg viewBox="0 0 24 24" width="26" height="26"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
            </button>
          </template>
        </div>
        <div class="info">
          <h2 class="display t">{{ t(v.title) }}</h2>
          <p v-if="t(v.desc)" class="desc">{{ t(v.desc) }}</p>
          <div class="meta">
            <div class="tags">
              <span v-for="(tag, j) in v.tags || []" :key="j" class="chip">{{ t(tag) }}</span>
            </div>
            <AppLink v-if="pageUrl(v)" :to="pageUrl(v)" class="ext">{{ tUI('watchOnBilibili') }} ↗</AppLink>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.title {
  font-size: clamp(32px, 5vw, 56px);
}
.lead {
  margin-top: 14px;
}
.list {
  display: grid;
  gap: 28px;
  padding-bottom: 40px;
}
.item {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: clamp(18px, 3vw, 32px);
  padding: clamp(16px, 2.4vw, 24px);
  align-items: center;
}
.frame {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  border-radius: calc(var(--radius-card) - 4px);
  overflow: hidden;
}
.frame iframe {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
.cover {
  position: absolute;
  inset: 0;
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.play {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  color: #fff;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease);
}
.play:hover {
  transform: scale(1.08);
  box-shadow: 0 0 40px color-mix(in srgb, var(--c-primary) 55%, transparent);
}
.t {
  font-size: clamp(20px, 2.4vw, 28px);
}
.desc {
  color: var(--c-muted);
  font-size: 15px;
  margin: 12px 0 0;
}
.meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 18px;
}
.tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.ext {
  color: var(--c-accent);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.ext:hover {
  text-decoration: underline;
}
@media (max-width: 820px) {
  .item {
    grid-template-columns: 1fr;
  }
}
</style>