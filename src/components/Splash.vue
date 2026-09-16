<script setup>
/* 首屏加载过渡：极光圆点脉冲 + 站名 */
import { computed } from 'vue'
import { state, t } from '../composables/useContent'

const name = computed(() => t(state.content?.site?.title) || '')
</script>

<template>
  <div class="splash">
    <div class="orb" />
    <p class="name display">{{ name }}</p>
  </div>
</template>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 22px;
  background: var(--c-bg);
}
.orb {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--grad-btn);
  box-shadow: 0 0 42px color-mix(in srgb, var(--c-primary) 65%, transparent);
  animation: pulse 1.4s var(--ease) infinite;
}
@keyframes pulse {
  50% {
    transform: scale(0.72);
    opacity: 0.6;
  }
}
.name {
  font-size: 17px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--c-muted);
}
</style>