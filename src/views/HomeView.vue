<script setup>
import { computed } from 'vue'
import { useContent } from '../composables/useContent'
import SectionRenderer from '../components/SectionRenderer.vue'

const { state } = useContent()
const sections = computed(() => state.content?.home?.sections || [])
</script>

<template>
  <SectionRenderer :sections="sections" />
</template>