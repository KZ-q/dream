/* 链接分类：external / internal / anchor / mailto / none */
export function linkKind(url) {
  if (!url) return 'none'
  if (url.startsWith('#')) return 'anchor'
  if (/^(https?:)?\/\//.test(url)) return 'external'
  if (url.startsWith('mailto:')) return 'mailto'
  return 'internal'
}