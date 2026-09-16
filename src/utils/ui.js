/* 链接分类：external / internal / anchor / mailto / none */
export function linkKind(url) {
  if (!url) return 'none'
  if (url.startsWith('#')) return 'anchor'
  if (/^(https?:)?\/\//.test(url)) return 'external'
  if (url.startsWith('mailto:')) return 'mailto'
  return 'internal'
}

/* 站内固定 UI 文案（跟随当前语言） */
import { state } from '../composables/useContent'

const UI = {
  home: { en: 'Home', zh: '首页' },
  works: { en: 'Works', zh: '作品' },
  videos: { en: 'Videos', zh: '视频' },
  about: { en: 'About', zh: '关于' },
  featured: { en: 'Featured Works', zh: '精选作品' },
  services: { en: 'What I Do', zh: '服务能力' },
  stats: { en: 'In Numbers', zh: '数据一览' },
  skills: { en: 'Skills', zh: '技能' },
  tools: { en: 'Toolchain', zh: '工具链' },
  timeline: { en: 'Journey', zh: '创作历程' },
  contact: { en: 'Contact', zh: '联系方式' },
  workflow: { en: 'Workflow', zh: '合作流程' },
  viewAll: { en: 'View all', zh: '查看全部' },
  all: { en: 'All', zh: '全部' },
  play: { en: 'Play video', zh: '播放视频' },
  watchOnBilibili: { en: 'Watch on Bilibili', zh: '在哔哩哔哩观看' },
  emptyWorks: { en: 'No works under this tag yet.', zh: '该标签下暂无作品。' },
  commission: { en: 'Commission me', zh: '合作邀约' },
  openTo: { en: 'Open for commissions', zh: '接受合作委托' },
  scroll: { en: 'Scroll', zh: '下滑探索' }
}

export function tUI(key) {
  const item = UI[key]
  if (!item) return key
  return item[state.lang] ?? item.en
}