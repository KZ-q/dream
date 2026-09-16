/* B 站视频工具：bvid 或完整链接 → iframe 播放器地址 */

/* 从 bvid 字段或 B 站链接中提取 BV 号 */
export function extractBvid(input) {
  if (!input) return ''
  const m = String(input).match(/BV[0-9A-Za-z]{8,12}/)
  return m ? m[0] : /^BV[0-9A-Za-z]+$/.test(String(input).trim()) ? String(input).trim() : ''
}

/* iframe 嵌入地址（bilibili 官方播放器，支持分P/自动播放参数） */
export function bilibiliEmbed(input, { page = 1, autoplay = 0, danmaku = 0 } = {}) {
  const bvid = extractBvid(input)
  if (!bvid) return ''
  return `https://player.bilibili.com/player.html?bvid=${bvid}&page=${page}&autoplay=${autoplay}&danmaku=${danmaku}&high_quality=1`
}

/* 「在 B 站打开」的页面地址：优先 item.url，否则由 bvid 拼接 */
export function bilibiliPage(item) {
  if (item?.url) return item.url
  const bvid = extractBvid(item?.bvid)
  return bvid ? `https://www.bilibili.com/video/${bvid}` : ''
}