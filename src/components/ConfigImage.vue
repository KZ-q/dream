<script setup>
import { computed } from 'vue'
import { useContent } from '../composables/useContent'
import { imageVars, resolveSrc } from '../utils/image'

const props = defineProps({
  image: { type: Object, default: null },
  eager: Boolean
})

const { t } = useContent()
const src = computed(() => resolveSrc(props.image?.src))
const alt = computed(() => t(props.image?.alt || ''))
const styleVars = computed(() => imageVars(props.image || {}))
</script>

<template>
  <img
    v-if="src"
    class="ci"
    :src="src"
    :alt="alt"
    :style="styleVars"
    :loading="eager ? 'eager' : 'lazy'"
    decoding="async"
  />
  <div v-else class="ci ci-empty" aria-hidden="true"></div>
</template>

<style scoped>
.ci {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: var(--img-opacity, 1);
  object-position: var(--img-position, center);
  transform: translate(var(--img-x, 0px), var(--img-y, 0px)) scale(var(--img-scale, 1));
}
.ci-empty {
  background: var(--c-surface);
}
@media (max-width: 768px) {
  .ci {
    opacity: var(--mimg-opacity, var(--img-opacity, 1));
    object-position: var(--mimg-position, var(--img-position, center));
    transform: translate(var(--mimg-x, var(--img-x, 0px)), var(--mimg-y, var(--img-y, 0px)))
      scale(var(--mimg-scale, var(--img-scale, 1)));
  }
}
</style>