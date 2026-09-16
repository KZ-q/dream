<script setup>
import { useContent } from '../../composables/useContent'
import { resolveSrc } from '../../utils/image'
import AppLink from '../AppLink.vue'

defineProps({ section: { type: Object, default: () => ({}) } })
const { t } = useContent()
</script>

<template>
  <section class="section container">
    <div class="banner card" v-reveal>
      <div class="bg" aria-hidden="true">
        <img v-if="section.image?.src" :src="resolveSrc(section.image.src)" alt="" loading="lazy" />
      </div>
      <div class="inner">
        <h2 class="display title grad-anim">{{ t(section.title) }}</h2>
        <p v-if="t(section.desc)" class="desc">{{ t(section.desc) }}</p>
        <div class="cta">
          <AppLink
            v-for="(c, i) in section.cta || []"
            :key="i"
            :to="c.url"
            :class="['btn', c.style === 'ghost' ? 'btn-ghost' : 'btn-primary']"
          >
            {{ t(c.label) }}
          </AppLink>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.banner {
  position: relative;
  overflow: hidden;
  padding: clamp(56px, 8vw, 96px) clamp(20px, 5vw, 64px);
  text-align: center;
}
.bg {
  position: absolute;
  inset: 0;
}
.bg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.inner {
  position: relative;
}
.title {
  font-size: clamp(30px, 4.6vw, 56px);
}
.desc {
  color: var(--c-muted);
  max-width: 52ch;
  margin: 14px auto 0;
}
.cta {
  display: flex;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 28px;
}
</style>