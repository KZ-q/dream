<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useContent } from '../../composables/useContent'

/* 数据一览：进入视口时数字缓动滚动（reduced-motion 直接显示） */
const props = defineProps({ section: { type: Object, default: () => ({}) } })
const { t } = useContent()

const items = computed(() => props.section.items || [])
const progress = ref(0)
const root = ref(null)
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

let io = null
onMounted(() => {
  if (reduced) {
    progress.value = 1
    return
  }
  io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const t0 = performance.now()
      const dur = 1400
      const tick = (now) => {
        const p = Math.min((now - t0) / dur, 1)
        progress.value = 1 - Math.pow(1 - p, 3)
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    },
    { threshold: 0.4 }
  )
  io.observe(root.value)
})
onUnmounted(() => io?.disconnect())

function shown(v) {
  return Math.round((v || 0) * progress.value)
}
</script>

<template>
  <section ref="root" class="section container">
    <div class="bar card" v-reveal>
      <div v-for="(s, i) in items" :key="i" class="stat">
        <p class="num display">
          <span class="v">{{ shown(s.value) }}</span><span class="suffix">{{ s.suffix }}</span>
        </p>
        <p class="label">{{ t(s.label) }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  padding: clamp(28px, 4vw, 48px) clamp(16px, 3vw, 40px);
  gap: 24px;
}
.stat {
  text-align: center;
  position: relative;
}
.stat + .stat::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 12%;
  bottom: 12%;
  width: 1px;
  background: var(--c-line);
}
.num {
  font-size: clamp(34px, 4.6vw, 56px);
  line-height: 1;
}
.num .v {
  font-variant-numeric: tabular-nums;
}
.suffix {
  color: var(--c-accent);
  font-size: 0.6em;
  margin-left: 4px;
}
.label {
  margin: 10px 0 0;
  color: var(--c-muted);
  font-size: 14px;
  letter-spacing: 0.04em;
}
@media (max-width: 640px) {
  .stat + .stat::before {
    display: none;
  }
}
</style>