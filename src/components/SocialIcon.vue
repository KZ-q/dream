<script setup>
/* 社交平台图标：已知平台用品牌近似图形，未知平台回退地球 */
defineProps({ name: { type: String, default: '' }, size: { type: Number, default: 18 } })

const FILL = {
  github:
    'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z',
  x: 'M18.9 2H22l-6.8 7.8L23 22h-6.3l-4.9-6.4L6.2 22H3l7.3-8.4L1 2h6.4l4.4 5.9L18.9 2zM17.8 20h1.7L6.6 3.9H4.8L17.8 20z'
}

const STROKE = {
  bilibili:
    'M4 8.5h16a1 1 0 0 1 1 1V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5a1 1 0 0 1 1-1z M8 3.5L10.5 7 M16 3.5L13.5 7 M9 13v2.5 M15 13v2.5',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M22 7l-10 7L2 7',
  weibo: 'M9.5 21c-3.6 0-6.5-2-6.5-5 0-2.8 3-6 6.7-6 3 0 4.6 1.6 4.6 4 0 3.2-2.6 7-4.8 7z M8.8 17.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z M15 3a6 6 0 0 1 6 6 M15.5 6.5A2.8 2.8 0 0 1 18 9',
  xiaohongshu:
    'M6 3.5h12a2.5 2.5 0 0 1 2.5 2.5v12a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18V6A2.5 2.5 0 0 1 6 3.5z M7.5 8.5h9 M12 8.5V16 M8.8 16c2 .8 4.4.8 6.4 0',
  douyin: 'M14 4v10.5a3.75 3.75 0 1 1-3.75-3.75 M14 4c.5 2.7 2.3 4.5 5 4.8',
  youtube:
    'M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8z M10.5 9.5l4.5 2.5-4.5 2.5v-5z',
  globe:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3c2.5 2.4 4 5.6 4 9s-1.5 6.6-4 9c-2.5-2.4-4-5.6-4-9s1.5-6.6 4-9z'
}

function resolve(name) {
  if (FILL[name]) return { type: 'fill', d: FILL[name] }
  return { type: 'stroke', d: STROKE[name] || STROKE.globe }
}
</script>

<template>
  <svg
    v-if="resolve(name).type === 'fill'"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path :d="resolve(name).d" />
  </svg>
  <svg
    v-else
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="resolve(name).d" />
  </svg>
</template>