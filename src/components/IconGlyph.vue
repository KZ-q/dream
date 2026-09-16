<script setup>
/* 站内线性图标（feather 风格，stroke 统一 1.8） */
const props = defineProps({
  name: { type: String, default: 'spark' },
  size: { type: Number, default: 24 }
})

const PATHS = {
  spark: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3z M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z',
  palette:
    'M12 3a9 9 0 1 0 .4 18c1.4 0 2.1-.9 2.1-1.9 0-.9-.6-1.5-1.4-2-.6-.4-1-.9-1-1.6 0-1 .8-1.8 1.9-1.8H16a5 5 0 0 0 5-5c0-3.9-4-6.7-9-6.7z M7.5 10.5h.01 M10 7h.01 M14.5 7.5h.01',
  video: 'M3 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z M16 10.5l5-3v9l-5-3',
  wand: 'M5 19L14.5 9.5 M17.5 3v3.5 M15.75 4.75h3.5 M19 9v3 M17.5 10.5h3 M12.5 3.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1L9.5 6.5l2.1-.9.9-2.1z',
  message:
    'M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.6 0-3.1-.4-4.4-1.2L3 20l1.2-5.1A8.5 8.5 0 1 1 21 11.5z M8.5 10.5h.01 M12 10.5h.01 M15.5 10.5h.01',
  image:
    'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M21 15l-5-5L5 19',
  layers: 'M12 2l10 5.5L12 13 2 7.5 12 2z M2 12.5L12 18l10-5.5 M2 17l10 5.5L22 17',
  rocket:
    'M12 2.5c3 1.8 4.8 5.5 4.8 9.4l2.7 3.7-3.8-.8c-.9 1.8-2.2 3.2-3.7 3.7-1.5-.5-2.8-1.9-3.7-3.7l-3.8.8 2.7-3.7c0-3.9 1.8-7.6 4.8-9.4z M12 10.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z M10 21.5c.5 1 3.5 1 4 0',
  chart: 'M4 20h16 M7 20v-6 M12 20V6 M17 20v-9',
  calendar:
    'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M8 3v4 M16 3v4 M4 10h16',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M22 7l-10 7L2 7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3.5 2',
  pin: 'M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  play: 'M9 6.5v11l9-5.5-9-5.5z'
}

const d = () => PATHS[props.name] || PATHS.spark
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="d()" />
  </svg>
</template>