<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useContent } from '../composables/useContent'

/* 作品灯箱：全屏查看大图，支持键盘 Esc 关闭 / ←→ 切换 */
const props = defineProps({
  items: { type: Array, default: () => [] },
  index: { type: Number, default: -1 }
})
const emit = defineEmits(['close', 'nav'])

const { t } = useContent()
const item = computed(() => props.items[props.index] || null)

function onKey(e) {
  if (props.index < 0) return
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'ArrowRight') go(1)
  else if (e.key === 'ArrowLeft') go(-1)
}
function go(d) {
  const n = props.items.length
  if (!n) return
  emit('nav', (props.index + d + n) % n)
}
onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
watch(
  () => props.index >= 0,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
  }
)
onUnmounted(() => (document.body.style.overflow = ''))
</script>

<template>
  <Teleport to="body">
    <Transition name="lb">
      <div v-if="item" class="lb" @click.self="emit('close')">
        <button class="icon-btn close" aria-label="Close" @click="emit('close')">✕</button>
        <button v-if="items.length > 1" class="icon-btn prev" aria-label="Previous" @click="go(-1)">‹</button>
        <figure class="body">
          <img :src="item.cover && item.cover.src" :alt="t(item.cover?.alt)" />
          <figcaption>
            <div class="meta">
              <h3 class="display">{{ t(item.title) }}</h3>
              <span v-if="item.year" class="chip">{{ item.year }}</span>
            </div>
            <p v-if="t(item.desc)" class="desc">{{ t(item.desc) }}</p>
            <div class="tags">
              <span v-for="(tag, i) in item.tags || []" :key="i" class="chip">{{ t(tag) }}</span>
            </div>
            <a v-if="item.link" :href="item.link" target="_blank" rel="noopener" class="ext">
              {{ item.link.replace(/^https?:\/\//, '').split('/')[0] }} ↗
            </a>
          </figcaption>
        </figure>
        <button v-if="items.length > 1" class="icon-btn next" aria-label="Next" @click="go(1)">›</button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.lb {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 2vw, 24px);
  padding: clamp(16px, 4vw, 48px);
  background: color-mix(in srgb, var(--c-bg) 82%, transparent);
  backdrop-filter: blur(18px);
}
.body {
  margin: 0;
  max-width: min(1080px, 100%);
  display: grid;
  gap: 14px;
}
.body img {
  max-height: 68vh;
  width: auto;
  max-width: 100%;
  margin-inline: auto;
  border-radius: var(--radius-card);
  border: 1px solid var(--c-line);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
}
figcaption {
  display: grid;
  gap: 10px;
  justify-items: start;
}
.meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.meta h3 {
  font-size: clamp(18px, 2.4vw, 26px);
}
.desc {
  margin: 0;
  color: var(--c-muted);
  font-size: 14px;
  max-width: 72ch;
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
}
.ext:hover {
  text-decoration: underline;
}
.icon-btn {
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  border-radius: 50%;
  border: 1px solid var(--c-line);
  background: color-mix(in srgb, var(--c-bg) 60%, transparent);
  color: var(--c-text);
  font-size: 20px;
  cursor: pointer;
  transition: border-color var(--t-fast) var(--ease), transform var(--t-fast) var(--ease);
}
.icon-btn:hover {
  border-color: var(--c-primary);
  transform: scale(1.06);
}
.close {
  position: absolute;
  top: 20px;
  right: 20px;
}
.lb-enter-active,
.lb-leave-active {
  transition: opacity 260ms var(--ease);
}
.lb-enter-active .body,
.lb-leave-active .body {
  transition: transform 260ms var(--ease);
}
.lb-enter-from,
.lb-leave-to {
  opacity: 0;
}
.lb-enter-from .body {
  transform: scale(0.96);
}
.lb-leave-to .body {
  transform: scale(0.98);
}
@media (max-width: 640px) {
  .prev,
  .next {
    position: fixed;
    top: auto;
    bottom: 18px;
  }
  .prev {
    left: 18px;
  }
  .next {
    right: 18px;
  }
  .body img {
    max-height: 52vh;
  }
}
</style>