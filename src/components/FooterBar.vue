<script setup>
import { computed } from 'vue'
import { useContent } from '../composables/useContent'
import { resolveSrc } from '../utils/image'
import AppLink from './AppLink.vue'
import SocialIcon from './SocialIcon.vue'

const { state, t } = useContent()
const site = computed(() => state.content?.site || {})
const footer = computed(() => state.content?.footer || {})
const socials = computed(() => site.value.socials || [])
const year = new Date().getFullYear()
</script>

<template>
  <footer class="foot">
    <div class="container top">
      <div class="brand">
        <img v-if="site.logo" class="logo" :src="resolveSrc(site.logo)" alt="" />
        <span class="display name">{{ t(site.title) }}</span>
        <span class="owner">© {{ year }} {{ t(footer.owner) }}</span>
      </div>
      <nav class="flinks" aria-label="Footer">
        <AppLink v-for="(l, i) in footer.links || []" :key="i" :to="l.to">{{ t(l.label) }}</AppLink>
      </nav>
      <div v-if="socials.length" class="socials">
        <a
          v-for="(s, i) in socials"
          :key="i"
          :href="s.url"
          target="_blank"
          rel="noopener"
          :aria-label="t(s.label)"
          :title="t(s.label)"
        >
          <SocialIcon :name="s.platform" />
        </a>
      </div>
    </div>
    <p v-if="t(footer.aiDisclosure)" class="container small">{{ t(footer.aiDisclosure) }}</p>
    <p class="container small dim">
      <a
        v-if="footer.beian?.text"
        :href="footer.beian.url || 'https://beian.miit.gov.cn/'"
        target="_blank"
        rel="noopener"
        class="beian"
      >{{ footer.beian.text }}</a>
      {{ t(footer.note) }}
    </p>
  </footer>
</template>

<style scoped>
.foot {
  border-top: 1px solid var(--c-line);
  padding: 48px 0 40px;
  margin-top: var(--section-gap);
}
.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.logo {
  height: 26px;
  width: auto;
}
.name {
  font-size: 17px;
}
.owner {
  color: var(--c-muted);
  font-size: 13px;
  margin-left: 8px;
}
.flinks {
  display: flex;
  gap: 22px;
}
.flinks a {
  color: var(--c-muted);
  font-size: 14px;
}
.flinks a:hover {
  color: var(--c-text);
}
.socials {
  display: flex;
  gap: 8px;
}
.socials a {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--c-line);
  border-radius: 50%;
  color: var(--c-muted);
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease),
    transform var(--t-fast) var(--ease);
}
.socials a:hover {
  color: var(--c-text);
  border-color: var(--c-primary);
  transform: translateY(-2px);
}
.small {
  margin: 4px auto;
  max-width: var(--max-width);
  font-size: 12px;
  line-height: 1.8;
  color: var(--c-muted);
}
.dim {
  opacity: 0.75;
}
.beian {
  color: inherit;
  margin-right: 10px;
}
.beian:hover {
  color: var(--c-text);
  text-decoration: underline;
}
</style>