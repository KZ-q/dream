<script setup>
import { computed, ref } from 'vue'
import { useContent } from '../../composables/useContent'
import { tUI } from '../../utils/ui'
import { resolveSrc } from '../../utils/image'
import SectionHead from '../SectionHead.vue'
import Lightbox from '../Lightbox.vue'

/* 精选作品：取全站作品列表前 N 项，点击进入灯箱 */
const props = defineProps({ section: { type: Object, default: () => ({}) } })
const { state, t } = useContent()

const all = computed(() => state.content?.works?.items || [])
const items = computed(() => all.value.slice(0, props.section.count || 6))
const cols = computed(() => props.section.columns || 3)

const lbIndex = ref(-1)
</script>

<template>
  <section class="section container">
    <SectionHead :kicker="tUI('featured')" :title="t(section.title)" :more="section.more" :more-label="tUI('viewAll')" />
    <div class="grid" :style="{ '--cols': cols }">
      <button
        v-for="(w, i) in items"
        :key="w.id || i"
        class="cell card"
        v-reveal="(i % cols) * 60"
        @click="lbIndex = i"
      >
        <img :src="resolveSrc(w.cover?.src)" :alt="t(w.cover?.alt)" loading="lazy" decoding="async" />
        <span class="veil" aria-hidden="true" />
        <span class="info">
          <span class="t display">{{ t(w.title) }}</span>
          <span class="tags">
            <span v-for="(tag, j) in (w.tags || []).slice(0, 3)" :key="j">{{ t(tag) }}</span>
          </span>
        </span>
        <span class="plus" aria-hidden="true">＋</span>
      </button>
    </div>
    <Lightbox :items="items" :index="lbIndex" @close="lbIndex = -1" @nav="lbIndex = $event" />
  </section>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(var(--cols), 1fr);
  gap: 16px;
}
.cell {
  position: relative;
  margin: 0;
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
.plus {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  font-size: 15px;
  opacity: 0;
  transform: scale(0.8);
  transition: opacity var(--t-med) var(--ease), transform var(--t-med) var(--ease);
}
.cell:hover .plus {
  opacity: 1;
  transform: none;
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