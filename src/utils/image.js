/* 图片配置 → CSS 变量（含移动端独立覆盖） */
export function imageVars(img = {}) {
  const m = img.mobile || {}
  const vars = {
    '--img-opacity': img.opacity ?? 1,
    '--img-position': img.objectPosition || 'center',
    '--img-scale': img.scale ?? 1,
    '--img-x': `${img.offsetX ?? 0}px`,
    '--img-y': `${img.offsetY ?? 0}px`
  }
  if (m.opacity != null) vars['--mimg-opacity'] = m.opacity
  if (m.objectPosition) vars['--mimg-position'] = m.objectPosition
  if (m.scale != null) vars['--mimg-scale'] = m.scale
  if (m.offsetX != null) vars['--mimg-x'] = `${m.offsetX}px`
  if (m.offsetY != null) vars['--mimg-y'] = `${m.offsetY}px`
  return vars
}

/* 相对路径 → 带 base 的绝对路径；外链/data 原样返回 */
export function resolveSrc(src) {
  if (!src) return ''
  if (/^(https?:)?\/\//.test(src) || src.startsWith('data:') || src.startsWith('/')) return src
  return import.meta.env.BASE_URL + src.replace(/^\//, '')
}