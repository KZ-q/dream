<script setup>
import HeroSection from './sections/HeroSection.vue'
import WorksSection from './sections/WorksSection.vue'
import VideoSection from './sections/VideoSection.vue'
import ServicesSection from './sections/ServicesSection.vue'
import StatsSection from './sections/StatsSection.vue'
import CtaBannerSection from './sections/CtaBannerSection.vue'

/* type → 组件映射（未知 type 容错：生产渲染为空，开发告警） */
const map = {
  hero: HeroSection,
  works: WorksSection,
  video: VideoSection,
  services: ServicesSection,
  stats: StatsSection,
  ctaBanner: CtaBannerSection
}

defineProps({ sections: { type: Array, default: () => [] } })
</script>

<template>
  <template v-for="(s, i) in sections" :key="i">
    <component :is="map[s.type]" v-if="map[s.type]" :section="s" />
    <div v-else class="unknown" />
  </template>
</template>

<style scoped>
.unknown {
  display: none;
}
</style>