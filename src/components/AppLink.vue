<script setup>
import { computed } from 'vue'
import { linkKind } from '../utils/link'

/* 统一链接出口：内链走 router，外链/锚点/邮箱走原生 a */
const props = defineProps({ to: { type: String, default: '' } })
const kind = computed(() => linkKind(props.to))
</script>

<template>
  <router-link v-if="kind === 'internal'" :to="to"><slot /></router-link>
  <a v-else-if="kind === 'external'" :href="to" target="_blank" rel="noopener"><slot /></a>
  <a v-else-if="kind === 'mailto'" :href="to"><slot /></a>
  <a v-else-if="kind === 'anchor'" :href="to"><slot /></a>
  <span v-else><slot /></span>
</template>