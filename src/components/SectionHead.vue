<script setup>
import AppLink from './AppLink.vue'

defineProps({
  kicker: { type: String, default: '' },
  title: { type: String, default: '' },
  more: { type: String, default: '' },
  moreLabel: { type: String, default: '' }
})
</script>

<template>
  <header class="sec-head" v-reveal>
    <div>
      <p v-if="kicker" class="kicker">{{ kicker }}</p>
      <h2 v-if="title" class="display section-title">{{ title }}</h2>
    </div>
    <AppLink v-if="more" :to="more" class="more">{{ moreLabel }}</AppLink>
  </header>
</template>