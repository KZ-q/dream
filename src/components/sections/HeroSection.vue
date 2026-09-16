<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useContent } from '../../composables/useContent'
import { tUI } from '../../utils/ui'
import ConfigImage from '../ConfigImage.vue'
import SocialIcon from '../SocialIcon.vue'
import AppLink from '../AppLink.vue'

const props = defineProps({ section: { type: Object, default: () => ({}) } })
const { state, t } = useContent()

const badge = computed(() => props.section.badge)
const badgeText = computed(() => (badge.value ? t(badge.value.text) || tUI('openTo') : ''))

/* 视差：仅 hero 一层，背景 0.3 倍速（reduced-motion 时禁用） */
const par = ref(0)
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const onScroll = () => (par.value = Math.min(window.scrollY, 600))
onMounted(() => {
  if (!reduced) window.addEventListener('scroll', onScroll, { passive: true })
})
onUnmounted(() => window.removeEventListener('scroll', onScroll))

const socials = computed(() => state.content?.site?.socials || [])
</script>

<template>
  <section class="hero">
    <div class="bg" :style="{ transform: `translateY(${par * 0.3}px) scale(1.06)` }">
      <ConfigImage :image="section.image" eager />
    </div>
    <div class="shade" aria-hidden="true" />

    <div class="container inner">
      <div v-if="badge" class="patch" v-reveal>
        <span class="dot" />
        <span>{{ badgeText }}</span>
      </div>

      <h1 class="display title grad-anim">{{ t(section.title) }}</h1>
      <p class="sub" v-reveal="80">{{ t(section.subtitle) }}</p>

      <div class="cta" v-reveal="160">
        <AppLink
          v-for="(c, i) in section.cta || []"
          :key="i"
          :to="c.url"
          :class="['btn', c.style === 'ghost' ? 'btn-ghost' : 'btn-primary']"
        >
          {{ t(c.label) }}
        </AppLink>
      </div>

      <div v-if="socials.length" class="socials" v-reveal="240">
        <a
          v-for="(s, i) in socials"
          :key="i"
          :href="s.url"
          target="_blank"
          rel="noopener"
          :aria-label="t(s.label)"
          :title="t(s.label)"
        >
          <SocialIcon :name="s.platform" :size="19" />
        </a>
      </div>
    </div>

    <div class="hint" aria-hidden="true">⌄</div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  min-height: 92vh;
  display: flex;
  align-items: center;
  overflow: hidden;
}
.bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}
.shade {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.5), transparent 42%, rgba(0, 0, 0, 0.68)),
    linear-gradient(90deg, rgba(0, 0, 0, 0.45), transparent 62%);
}
[data-preset='paper'] .shade {
  background: linear-gradient(180deg, rgba(246, 244, 239, 0.72), transparent 46%, rgba(246, 244, 239, 0.85)),
    linear-gradient(90deg, rgba(246, 244, 239, 0.66), transparent 62%);
}
.inner {
  position: relative;
  z-index: 2;
  padding-block: 150px 110px;
  width: 100%;
}
.patch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--c-line);
  background: rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(8px);
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 13px;
  letter-spacing: 0.08em;
}
[data-preset='paper'] .patch {
  background: rgba(255, 255, 255, 0.6);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c-accent);
  box-shadow: 0 0 12px var(--c-accent);
  animation: breathe 2.4s ease-in-out infinite;
}
.title {
  font-size: clamp(40px, 7vw, 84px);
  margin-top: 22px;
}
.sub {
  max-width: 560px;
  color: var(--c-muted);
  font-size: clamp(15px, 1.4vw, 18px);
  margin: 18px 0 0;
}
[data-preset='paper'] .sub {
  color: color-mix(in srgb, var(--c-muted) 80%, var(--c-text));
}
.cta {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 30px;
}
.socials {
  display: flex;
  gap: 10px;
  margin-top: 44px;
}
.socials a {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid color-mix(in srgb, var(--c-line) 70%, transparent);
  border-radius: 50%;
  color: var(--c-muted);
  background: color-mix(in srgb, var(--c-bg) 40%, transparent);
  backdrop-filter: blur(6px);
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease),
    transform var(--t-fast) var(--ease);
}
.socials a:hover {
  color: var(--c-text);
  border-color: var(--c-primary);
  transform: translateY(-3px);
}
.hint {
  position: absolute;
  bottom: 16px;
  left: 50%;
  color: var(--c-muted);
  font-size: 22px;
  animation: floaty 2s var(--ease) infinite;
}
</style>