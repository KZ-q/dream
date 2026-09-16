<script setup>
import { ref, computed } from 'vue'
import { useContent } from '../composables/useContent'
import { tUI } from '../utils/ui'
import { resolveSrc } from '../utils/image'
import Lightbox from '../components/Lightbox.vue'

/* 作品集：自由标签筛选 + 网格 + 灯箱（项目案例与创作并存） */
const { state, t } = useContent()

const data = computed(() => state.content?.works || {})
const items = computed(() => data.value.items || [])

/* 标签聚合（保持首次出现顺序，i18n 键按当前语言展示） */
const tags = computed(() => {
  const seen = []
  for (const it of items.value) {
    for (const tag of it.tags || []) {
      const key = typeof tag === 'object' ? tag.en || Object.values(tag)[0] : tag
      if (!seen.includes(key)) seen.push(key)
    }
  }
  return seen
})
const active = ref('__all__')

const filtered = computed(() => {
  if (active.value === '__all__') return items.value
  return items.value.filter((it) =>
    (it.tags || []).some((tag) => (typeof tag === 'object' ? tag.en || Object.values(tag)[0] : tag) === active.value)
  )
})

function tagText(key) {
  const raw = (items.value.flatMap((it) => it.tags || []) || []).find(
    (tag) => (typeof tag === 'object' ? tag.en || Object.values(tag)[0] : tag) === key
  )
  return t(raw ?? key)
}

const lbIndex = ref(-1)
</script>

<template>
  <div class="container">
    <header class="page-hero" v-reveal>
      <p class="kicker">{{ tUI('works') }}</p>
      <h1 class="display title">{{ t(data.title) }}</h1>
      <p class="lead">{{ t(data.desc) }}</p>
    </header>

    <div class="tagbar" v-reveal="60" data-testid="tagbar">
      <button :class="{ on: active === '__all__' }" @click="active = '__all__'">
        {{ tUI('all') }} · {{ items.length }}
      </button>
      <button v-for="tg in tags" :key="tg" :class="{ on: active === tg }" @click="active = tg">
        {{ tagText(tg) }}
      </button>
    </div>

    <TransitionGroup v-if="filtered.length" name="gfilter" tag="div" class="grid">
      <button
        v-for="(w, i) in filtered"
        :key="w.id || i"
        class="cell card"
        @click="lbIndex = i"
      >
        <img :src="resolveSrc(w.cover?.src)" :alt="t(w.cover?.alt)" loading="lazy" decoding="async" />
        <span class="veil" aria-hidden="true" />
        <span class="info">
          <span class="t display">{{ t(w.title) }}</span>
          <span class="tags">
            <span v-for="(tag, j) in w.tags || []" :key="j">{{ t(tag) }}</span>
          </span>
        </span>
        <span v-if="w.year" class="year chip">{{ w.year }}</span>
      </button>
    </TransitionGroup>
    <p v-else class="empty lead">{{ tUI('emptyWorks') }}</p>

    <Lightbox :items="filtered" :index="lbIndex" @close="lbIndex = -1" @nav="lbIndex = $event" />
  </div>
</template>

<style scoped>
.title {
  font-size: clamp(32px, 5vw, 56px);
}
.lead {
  margin-top: 14px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding-bottom: 40px;
}
.cell {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  text-align: left;
}
.cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 600ms var(--ease);
}
.cell:hover img {
  transform: scale(1.06);
}
.veil {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 40%, rgba(0, 0, 0, 0.78));
  opacity: 0;
  transition: opacity var(--t-med) var(--ease);
}
.cell:hover .veil,
.cell:focus-visible .veil {
  opacity: 1;
}
.info {
  position: absolute;
  inset: auto 18px 16px;
  display: grid;
  gap: 6px;
  color: #fff;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity var(--t-med) var(--ease), transform var(--t-med) var(--ease);
  pointer-events: none;
}
.cell:hover .info,
.cell:focus-visible .info {
  opacity: 1;
  transform: none;
}
.t {
  font-size: 18px;
}
.tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.75);
}
.year {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  backdrop-filter: blur(6px);
}
.empty {
  padding: 48px 0 80px;
  text-align: center;
}
/* 筛选过渡 */
.gfilter-move {
  transition: transform 500ms var(--ease);
}
.gfilter-enter-active {
  transition: opacity 400ms var(--ease), transform 400ms var(--ease);
}
.gfilter-enter-from {
  opacity: 0;
  transform: scale(0.94);
}
.gfilter-leave-active {
  display: none;
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 540px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .info {
    opacity: 1;
    transform: none;
  }
  .veil {
    opacity: 1;
  }
}
</style>