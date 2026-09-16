<script setup>
import { useContent } from '../../composables/useContent'
import { tUI } from '../../utils/ui'
import SectionHead from '../SectionHead.vue'
import IconGlyph from '../IconGlyph.vue'

defineProps({ section: { type: Object, default: () => ({}) } })
const { t } = useContent()
</script>

<template>
  <section class="section container">
    <SectionHead :kicker="tUI('services')" :title="t(section.title)" />
    <div class="grid">
      <article v-for="(f, i) in section.items || []" :key="i" class="card item" v-reveal="i * 70">
        <div class="ico"><IconGlyph :name="f.icon" :size="36" /></div>
        <h3 class="display name">{{ t(f.title) }}</h3>
        <p class="desc">{{ t(f.desc) }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}
.item {
  padding: 30px 28px;
}
.ico {
  margin-bottom: 16px;
  color: var(--c-accent);
}
.name {
  font-size: 20px;
  margin-bottom: 10px;
}
.desc {
  margin: 0;
  color: var(--c-muted);
  font-size: 15px;
}
</style>