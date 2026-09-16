<script setup>
import { ref, computed } from 'vue'
import { useContent } from '../../composables/useContent'
import { tUI } from '../../utils/ui'
import { bilibiliEmbed, bilibiliPage } from '../../utils/video'
import { resolveSrc } from '../../utils/image'
import SectionHead from '../SectionHead.vue'
import AppLink from '../AppLink.vue'

/* B 站视频 Facade：封面 + 播放按钮，点击后才加载 iframe（首屏零请求） */
const props = defineProps({ section: { type: Object, default: () => ({}) } })
const { t } = useContent()

const playing = ref(false)
const embedUrl = computed(() => bilibiliEmbed(props.section.bvid, { autoplay: 1 }))
const pageUrl = computed(() => bilibiliPage(props.section))
</script>

<template>
  <section class="section container">
    <SectionHead :kicker="tUI('videos')" :title="t(section.title)" :more="section.more" :more-label="tUI('viewAll')" />
    <div class="frame" v-reveal>
      <iframe
        v-if="playing && embedUrl"
        :src="embedUrl"
        :title="t(section.title)"
        scrolling="no"
        frameborder="no"
        framespacing="0"
        allowfullscreen="true"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      />
      <template v-else>
        <div class="cover">
          <img :src="resolveSrc(section.cover?.src)" :alt="t(section.cover?.alt)" loading="lazy" decoding="async" />
        </div>
        <button v-if="embedUrl" class="play" :aria-label="tUI('play')" @click="playing = true">
          <svg viewBox="0 0 24 24" width="30" height="30"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
        </button>
      </template>
    </div>
    <div v-if="section.altLinks?.length || pageUrl" class="alt" v-reveal>
      <AppLink v-if="pageUrl" :to="pageUrl" class="chip chip-link">{{ tUI('watchOnBilibili') }} ↗</AppLink>
      <AppLink v-for="l in section.altLinks || []" :key="l.url" :to="l.url" class="chip chip-link">
        {{ t(l.label) }}
      </AppLink>
    </div>
  </section>
</template>

<style scoped>
.frame {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  border-radius: var(--radius-card);
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
  width: 88px;
  height: 88px;
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
.alt {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
}
.chip-link {
  cursor: pointer;
  transition: border-color var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
}
.chip-link:hover {
  border-color: var(--c-primary);
  color: var(--c-text);
}
</style>