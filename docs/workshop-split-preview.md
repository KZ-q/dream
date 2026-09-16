# 分屏实时预览工坊 — 技术文档

> 左侧编辑 + 右侧 iframe 实时预览的实现拆解。本项目落地于 `src/views/WorkshopView.vue`（分屏容器 + 推送）、`src/composables/useContent.js`（站点端接收）、`src/App.vue`（路由/语言/主题回显）、`src/components/Navbar.vue`（防嵌套）、`studio/server.mjs`（本地保存/上传端点），自动化测试在 `scripts/smoke-workshop.mjs`（27 项断言）。
>
> 该模式与具体业务无关：任何「Vue 3 + Vite 单页站点 + JSON 驱动内容」的项目，都可以按本文档复刻一套可视化编辑工坊。

---

## 1. 形态总览

```
┌──────────────────────────── .wk-bar 工具条（sticky）─────────────────────────────┐
│ 🛠 内容工坊 [站点名] ●(dirty点)   首页|作品|视频|关于 │ 中/EN ▾ 主题 ▾  重置 导入 下载 │
├──────────────────────┬──┬────────────────────────────────────────────────────────┤
│  .wk-editor 编辑区    │▐│  .wk-preview 预览区                                     │
│  ┌ tabs: 站点/导航·…  │▐│  [🖥桌面 ▭平板 ▯手机]      新窗口↗  刷新               │
│  └ .wk-scroll        │▐│  ┌────────────── .pv-stage ──────────────┐             │
│    7 面板可编辑表单   │▐│  │  <iframe class="pv-frame" src="/">    │             │
│    （内部滚动）       │▐│  │  真实站点完整渲染（含导航/页脚）        │             │
└──────────────────────┴──┴──┴────────────────────────────────────────┴────────────┘
   宽 360–760px 可拖拽     分隔条        iframe 宽度随视口档位切换
```

- **左侧**：7 个编辑面板（站点 / 导航·页脚 / 首页区块 / 作品 / 视频 / 关于 / JSON 源码），全部操作直接 mutate 共享的 `useContent.state.content`（reactive 对象），不经过任何"草稿副本"。
- **右侧**：`<iframe src="/">` 加载**同一个 dev server 上的真实站点**——不是 HTML 片段预览、不是组件沙箱。站点自身的数据加载、路由、主题切换、响应式布局全部原样运行，因此预览保真度 100%。
- **工具条**：预览页签（SPA 无刷新跳转）、语言/主题切换、重置/导入/下载，以及与磁盘版本对比的 dirty 状态点。

**为什么用 iframe 而不是把站点组件直接嵌进工坊页？**
1. 站点有全局 fixed 导航、Splash、主题 CSS 变量（挂 `html`），与工坊自己的中性深色 UI 会互相污染；iframe 是天然隔离。
2. 站点内点击、路由跳转、灯箱、视频 Facade 等交互在 iframe 里原样可用，工坊代码零适配。
3. iframe 可以做视口模拟（固定宽度模拟平板/手机），组件嵌入做不到。

---

## 2. 数据流与总体架构

```
public/content/content.json          ← 唯一内容源（磁盘）
        │ fetch（cache:'no-cache'）
        ▼
useContent.state { content, lang, preset, status }     ← 单一数据源（reactive）
   ▲                    │
   │ mutate             ▼
工坊 7 面板          App.vue → <router-view> 四个页面
（SitePanel…）           ↑
   │ 编辑                │ iframe 加载同一 dev server
   │ watch(deep) → 500ms 防抖 → deep copy → postMessage('wk:content')
   └────────────────→ iframe 内的 useContent 监听器整包替换 state.content
                          → Vue 响应式自动重渲染 → "左改右看"
```

关键设计取舍：

| 决策 | 理由 |
| --- | --- |
| 编辑直接 mutate 全局 `state.content` | 省掉草稿/正本两套数据的 diff 合并；工坊与预览共用同一份 reactive 树 |
| 推送**整包** content 而非增量 patch | `structuredClone` 级别的整包替换实现最简单；JSON 体量（<100KB）下整包替换 + Vue 重渲染开销可忽略 |
| 站点端独立访问零副作用 | 所有工坊相关代码都包在 `import.meta.env.DEV` 分支里，生产构建被 dead-code 消除（实测 dist 无 Workshop chunk） |
| 保存 = 浏览器下载 JSON | 无后端、无写入 API；下载 → 覆盖 `public/content/content.json` → `npm run check` → build，把"发布"留给既有构建链路 |

## 3. 分屏布局实现

### 3.1 三列 Grid + CSS 变量驱动宽度

```html
<div class="wk-body" :style="{ '--editor-w': editorW + 'px' }">
  <aside  class="wk-editor"  >…</aside>
  <div    class="wk-divider" @mousedown.prevent="startResize" />
  <section class="wk-preview">…</section>
</div>
```

```css
.wk-body {
  display: grid;
  grid-template-columns: var(--editor-w, 480px) 6px 1fr;
  min-height: 0;             /* grid/flex 子项内滚动的必备项 */
}
.wk-editor { overflow: hidden; }   /* 面板滚动交给内部 .wk-scroll */
.wk-scroll { overflow-y: auto; }
.wk-divider { cursor: col-resize; } /* 6px 竖条，:hover 提示可拖拽 */
```

要点：
- 宽度是**一个数字状态** `editorW`（px），通过 inline style 写进 CSS 变量——拖拽只改这一个 ref，Grid 自动重排。
- `min-height: 0` 是这类"顶栏 + 填满剩余高度 + 内部滚动"布局最常见的遗漏，缺了它内部 `overflow` 失效、整页被撑高。
- 响应式：`≤900px` 时 grid 改为单列两行（编辑区 45% / 预览 55%），分隔条隐藏（垂直堆叠下没有拖拽意义）。

### 3.2 拖拽分隔条

```js
const editorW = ref(480)
let resizing = false, resizeStartX = 0, resizeStartW = 0

function startResize(e) {
  resizing = true
  resizeStartX = e.clientX
  resizeStartW = editorW.value
  window.addEventListener('mousemove', onResize)   // 挂 window：鼠标滑出分隔条也不丢
  window.addEventListener('mouseup', stopResize)
}
function onResize(e) {
  if (!resizing) return
  editorW.value = Math.min(760, Math.max(360, resizeStartW + (e.clientX - resizeStartX)))
}
function stopResize() {
  resizing = false
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', stopResize)
}
```

- 上限 760px、下限 360px：保证任何一侧都不会被挤到不可用。
- 事件挂在 `window` 而非分隔条元素上——拖拽中鼠标移出分隔条后仍然连续响应，`mouseup` 在任意位置都能结束。
- `@mousedown.prevent` 阻止拖拽时触发文本选区；分隔条自身 `tabindex` + `title` 提供可发现性。

### 3.3 视口切换（桌面 / 平板 / 手机）

```js
const FRAME_W = { desktop: 'max(100%, 960px)', tablet: '768px', mobile: '375px' }
```

```html
<div class="pv-stage">   <!-- overflow:auto + justify-content: safe center -->
  <iframe class="pv-frame" :style="{ width: frameWidth }" src="/" @load="onFrameLoad" />
</div>
```

这里有一个实测踩出来的边界（详见 §7）：**分屏会把 iframe 挤到断点以下**，桌面档必须用 `max(100%, 960px)` 设下限，而不是天真地写 `100%`。

---

## 4. 消息协议（核心）

工坊（父窗口）与站点（iframe）之间共 7 个 `wk:*` 消息。**全部用 `import.meta.env.DEV` 包裹**，独立访问站点时无任何监听器，零副作用。

| 消息 | 方向 | 载荷 | 触发时机 | 接收方 |
| --- | --- | --- | --- | --- |
| `wk:hello` | iframe → 工坊 | — | 站点 `fetch(content.json)` 完成后 | `WorkshopView.onMessage`：置 ready + 立即全量推送 |
| `wk:content` | 工坊 → iframe | `{ content }` 整包 | 编辑防抖 500ms / hello 后立即 / 兜底定时器 | `useContent.js` DEV 监听：整包替换 |
| `wk:nav` | 工坊 → iframe | `{ path }` | 工具条页签点击 | `App.vue` DEV 监听：`router.push(path)` |
| `wk:route` | iframe → 工坊 | `{ path }` | iframe 内路由变化（`watch route.path`） | 工坊：`curPath = path`（页签高亮跟随） |
| `wk:lang` | 工坊 → iframe | `{ lang }` | 工具条语言下拉 | `useContent.setLang` |
| `wk:preset` | 工坊 → iframe | `{ preset }` | 工具条主题下拉 | `useContent.setPreset` |
| `wk:state` | iframe → 工坊 | `{ lang, preset }` | 预览内手动切语言/主题（`watchEffect`） | 工坊：直接赋值回显，**不回推消息** |

协议设计原则：

1. **命名空间前缀 `wk:`**：避免与其他脚本（Vite HMR、浏览器扩展）的消息串扰；收到消息第一行校验 `d?.type`，非对象直接丢弃。
2. **每个方向的消息各管一件事**，不做"万能消息"——这样接收端分支简单，调试时在 console 里按 type 过滤即可看全链路。
3. **`wk:route` / `wk:state` 是"状态回显"不是"指令"**：由 iframe 内的 watcher 主动上报，工坊只改自己 UI 的显示，不再转发——这是避免消息乒乓的关键（详见 §6.3）。
4. `postMessage` 目标源暂用 `'*'`（dev-only、本地同源场景），若要移植到跨域部署的编辑器，应改为具体 origin 并校验 `e.origin`。

## 5. 握手与竞态防护（wk:hello）

### 5.1 问题

iframe 里跑的是**原封不动的站点**，它加载后会自己 `fetch(content.json)`。时序上存在竞态：

```
工坊                                iframe
 │ 编辑 X → 推送 wk:content(X) ──→ state.content = X ✓
 │                                    │
 │                          iframe load 完成后才 fetch 磁盘 JSON
 │                          fetch 完成 → state.content = 磁盘版 ✗ 编辑被覆盖！
```

反过来的时序也有坑：如果只依赖 iframe 的 `load` 事件判断"就绪"，`load` 触发时站点可能还没 `fetch` 完，此时推送的数据会被随后的 fetch 覆盖。

### 5.2 方案：数据就绪后"报到"

站点端（`useContent.js`，仅 DEV + 在 iframe 内）：

```js
const res = await fetch(`${import.meta.env.BASE_URL}content/content.json`, { cache: 'no-cache' })
applyContent(await res.json())
if (import.meta.env.DEV && window.parent !== window) {
  window.parent.postMessage({ type: 'wk:hello' }, '*')   // 数据真正就绪后才报到
}
```

工坊端收到 `wk:hello`：置 `frameReady = true`、**立即全量推送当前编辑内容**，并补发当前语言/主题。这样无论 iframe 何时 fetch 完，最终都会被工坊的编辑态"纠正"过来。

### 5.3 兜底：load + 700ms

握手依赖站点端代码正常执行；为防极端情况（报错被吞、脚本被拦），工坊端在 iframe `load` 后再设 700ms 兜底定时器：

```js
function onFrameLoad() {
  clearTimeout(helloTimer)
  helloTimer = setTimeout(() => {      // 700ms 内没等到 wk:hello 就假定就绪
    frameReady.value = true
    pushContent()
  }, 700)
}
```

`wk:hello` 与兜底定时器**互相互斥**（先到者清掉另一个），双保险且不会重复推送。

### 5.4 附带收益：Vite HMR 后编辑不丢

修改源码触发 iframe 重载 → 站点重新 fetch → 发新的 `wk:hello` → 工坊立即推当前编辑内容。**编辑内容在热重载后自动恢复**，这是"报到后全量推"设计的免费红利。

---

## 6. 推送与双向同步的实现细节

### 6.1 深度监听 + 防抖

```js
let pushTimer = null
watch(
  () => state.content,
  () => {
    if (!frameReady.value) return        // iframe 未就绪不推，靠 hello 后全量推
    clearTimeout(pushTimer)
    pushTimer = setTimeout(pushContent, 500)
  },
  { deep: true }                         // 面板改任意嵌套字段都能触发
)
```

- `deep: true`：编辑面板绑定的是 `state.content.xxx.yyy` 深层路径，必须深度监听。
- 500ms 防抖：输入法打字逐字符触发，不防抖会每键一次 postMessage，iframe 端整包替换 + 重渲染明显卡顿。实测 500ms 手感"跟手又不抖"。
- `frameReady` 门槛 + 卸载时 `clearTimeout`：工坊路由切走/组件卸载后不再触发推送。

### 6.2 推送前必须深拷贝（最容易踩的坑）

```js
function pushContent() {
  if (!state.content) return
  post({ type: 'wk:content', content: JSON.parse(JSON.stringify(state.content)) })
}
```

**Vue 3 的 reactive 对象是 Proxy，无法跨窗口结构化克隆**——直接 `postMessage(state.content)` 会抛 `DataCloneError`，且报错信息不一定直观指向 Proxy。`JSON.parse(JSON.stringify())` 是最小依赖的解法（本项目内容是纯 JSON 数据，无函数/Symbol/循环引用）。若数据含 `Date`、`Map` 等，改用 `structuredClone(toRaw(obj))` 并确认无残留 Proxy。

### 6.3 双向同步与防消息循环

三对"指令 + 回显"都用同一个模式——**回显只改本地 UI，不重新广播**：

```js
if (d.type === 'wk:state') {
  // 预览内手动切换语言/主题 → 工具条回显（直接赋值，不回推消息，避免循环）
  if (d.lang && d.lang !== state.lang) state.lang = d.lang
  if (d.preset && d.preset !== state.preset) state.preset = d.preset
}
```

iframe 端的 `wk:route` / `wk:state` 是 watcher 自动上报的：

```js
// App.vue（仅 DEV + 在 iframe 内）
watch(() => route.path, (p) => {
  if (inFrame()) window.parent.postMessage({ type: 'wk:route', path: p }, '*')
}, { immediate: true })
```

防循环的三道闸：
1. **回显赋值前判等**（`d.lang !== state.lang`），相同值不触发响应式更新 → watcher 不再上报；
2. **回显走直接赋值** `state.lang = d.lang`，而不是 `setLang()`——不产生新的消息；
3. **工坊 UI 更新不推送**：页签高亮、下拉选中值只是显示层，只有用户真正操作（`goPage`/`onLang`）才发指令消息。

### 6.4 页签跳转用 router.push 而非改 src

```js
function goPage(p) {
  curPath.value = p
  if (frameReady.value) post({ type: 'wk:nav', path: p })
}
```

iframe 端收到 `wk:nav` 执行 `router.push(d.path)`。**千万不要 `iframe.src = path`**——整页重载会丢掉已推送的编辑内容、还要重新握手。SPA 内部导航 + 整包内容已在 iframe 内，跳转是零成本的。

## 7. 视口模拟的断点边界（实测踩坑）

**现象**：1280px 屏幕上，编辑区默认 480px + 分隔条 6px + stage 内边距 ~26px，iframe 桌面档实际只有 **~766px**——低于站点自身导航栏的桌面断点（`@media (max-width: 900px)`），预览里导航**永远显示为汉堡菜单**，桌面态根本看不到。冒烟测试在 iframe 里点导航链接时直接超时（`element is not visible`）才暴露。

**修复（三条缺一不可）**：

```css
.pv-stage { display: flex; justify-content: safe center; overflow: auto; }
.pv-frame { flex: 0 0 auto; }   /* 不设 max-width！否则 max() 被 clamp 回溢出宽度 */
```

```js
const FRAME_W = { desktop: 'max(100%, 960px)', tablet: '768px', mobile: '375px' }
```

1. **桌面档宽度下限**：`max(100%, 960px)`——容器够宽就跟容器，不够宽也强制 960px（> 900px 断点），保证桌面布局可预览，超宽部分交给 stage 横向滚动。
2. **`justify-content: safe center`**：普通 `center` 在子项溢出时两侧同时溢出，滚动条永远滚不到左半边；`safe center` 在放不下时自动退回 `flex-start`，溢出侧可完整滚动。Chrome 93+ 支持。
3. **去掉 iframe 的 `max-width: 100%`**：否则 `max(100%, 960px)` 的结果又被 clamp 回容器宽度，前功尽弃。

通用结论：**视口模拟档位必须对照站点自己的响应式断点设计**，"桌面"档的宽度下限 = 站点最大移动断点 + 余量。

---

## 8. Dev-only 架构：生产零残留

| 位置 | 手段 | 效果 |
| --- | --- | --- |
| `router/index.js` | `import.meta.env.DEV && router.addRoute(...)`（组件用 `() => import(...)` 动态导入） | 生产分支整段消除，动态 import 一起被摇掉 → **dist 无 Workshop chunk**（构建后 `ls dist/assets | grep -i workshop` 为空，已实测） |
| `useContent.js` / `App.vue` | 消息监听全部包在 `if (import.meta.env.DEV)` 里 | 生产站点无任何 postMessage 监听，独立访问零副作用 |
| `Navbar.vue` | `v-if="isDev && !inFrame"` | 生产不可达；开发时 iframe 内也隐藏（`inFrame = window.self !== window.top`），**防止在预览里再点开一个工坊造成嵌套**。注意桌面 links 与移动汉堡菜单是两个渲染分支，**都要带 `!inFrame`**——曾出现移动菜单只判 `isDev` 导致预览窄视口开汉堡泄漏工坊入口（T9b 回归项防再犯） |
| `App.vue` | `route.name === 'workshop'` 时 `v-if` 掉站点 Navbar/Footer | fixed 导航(z 较低)与 sticky 工具条(z 60)会互相遮挡点击——预览页签导航入口由工坊工具条提供 |

残留成本：生产 HTML 里 Navbar 的工坊链接因 `isDev` 常量 false 而不渲染，仅剩约 30 字节字符串字面量，可接受。

**本地保存与图片入库端点（`studio/server.mjs`，Vite 插件 `apply:'serve'` 仅 dev 挂载）**：工坊页由 dev server 直接服务，可安全挂本地写端点（仅 localhost 可达，构建零残留）。`vite.config.js` 注册 `workshopServer()` 即生效：

| 端点 | 作用 |
| --- | --- |
| `GET /api/content` | 读磁盘 `public/content/content.json` |
| `PUT /api/content` | 校验顶层字段（`site`/`home`）后写回；**写前自动备份上一版** → `content.backup.json`（已 gitignore） |
| `POST /api/upload` | 图片入库 `public/assets/images/`（扩展名白名单防目录穿越、≤5MB、同名覆盖即替换），返回 `/assets/images/<name>` 直接填 src |
| `GET /api/images` | 图库列表（按 mtime 倒序；WkImage「图库」弹层数据源） |

工具条「保存」按钮 = dirty 时 `PUT` 全量 content → 成功后同步 baseline（状态点转绿）+ 显示「已保存 HH:MM」；「下载 content.json」仍保留为离线导出通道。

---

## 9. 编辑状态一致性

- **dirty 点**：`baseline = JSON.stringify(初始 content)`；`dirty = JSON.stringify(当前) !== baseline`。绿点 = 与磁盘一致，橙点 = 有未保存改动。
- **导入 / 重置后必须同步重置 baseline**（`baseline.value = JSON.stringify(parsed)`），否则 dirty 永远亮着误导用户；**保存成功后同样要同步 baseline**（写回的内容就是当前编辑态），状态点才会转绿。
- **重置** = 重新 `fetch(content.json)`（`cache: 'no-cache'` 绕过浏览器缓存）拿磁盘真值；**导入** = 前端校验顶层字段（`site`/`home`）后整包替换。
- **编辑只存内存，保存一键落盘**：「保存」经 `PUT /api/content` 写回磁盘（自动备份上一版）；「下载 content.json」为离线导出。底部常驻提示条写明两条保存路径。
- **刷新预览**：`frameKey.value++`（`:key` 重建 iframe）+ 页签归位 `/`，随后走完整的 hello 握手 + 全量推送，编辑自动恢复。

---

## 10. 自动化测试要点（scripts/smoke-workshop.mjs，27 项）

无完整 playwright 依赖（只装 `playwright-core`），驱动系统 Edge/Chrome，自起 dev server（5199）全程自愈收尾：

1. **iframe 内元素定位**：`const frame = page.frameLocator('.pv-frame')`，之后 `frame.locator('.brand-name')` 与普通页面 API 一致。
2. **等待联动用 `waitFor({ hasText })` 而非固定 sleep**：编辑后断言用 `frame.locator('.brand-name', { hasText: '工坊测试站' }).waitFor()`，比 sleep 更快也更稳；仅在需要"等待防抖到期"的断言间隙用 `waitForTimeout(900)`（> 500ms 防抖）。
3. **顺序依赖要复位**：切到 en 测完语言联动，必须切回 zh 再做后续中文断言；切到手机视口测完，**必须切回桌面再测 iframe 内导航**（否则 900px 断点下导航隐藏，点击超时）。
4. **下载验证走真实事件**：`page.waitForEvent('download')` → `saveAs` 到临时目录 → `JSON.parse` 校验，结束后删临时目录。
5. **错误零容忍**：整页收集 `pageerror` + `console.error` + 每项断言失败，结尾统一 `errors.length === 0` 才算绿——双向消息链路最容易在 console 里留下静默报错。
6. 覆盖矩阵：分屏结构（tab 数/iframe/分隔条）→ 预览渲染（hero + 完整导航）→ 内容联动（站名/JSON/hero）→ 图片（本地 PNG 经 `setInputFiles` 上传 → `/api/upload` 入库 `public/assets/images/` → iframe hero 换路径图 + 磁盘文件存在断言；透明度滑块拖到 0.4 → iframe 图片 opacity 联动）→ 语言/主题 → 视口（375px 宽度断言 + **手机视口开汉堡断言无「工坊」项**）→ 路由双向（页签→iframe、iframe 点导航→页签高亮）→ 下载/导入/重置 → **保存**（`waitForResponse` 捕获 PUT /api/content → 磁盘含改动 + 备份文件生成 + dirty 点转绿 + 已保存时间显示）。
7. **文件上传用 `setInputFiles` 内存缓冲区**：`locator('input.wk-file').setInputFiles({ name, mimeType, buffer })` 直接喂 1×1 PNG，不落临时盘；注意 file input 必须限定作用域（编辑区有多个图片上传位），否则 strict mode 违规——同类教训：导入测试的选择器要用 `.wk-bar-actions input[type=file]` 与图片上传位区分开。
8. **写盘类测试必须还原磁盘现场**：T13 保存前先快照 `content.json` 原文，断言完成后 `writeFileSync` 还原 + 删除 `content.backup.json` + 删除测试上传的 `local.png`；并在脚本 `finally` 里兜底再还原一次——测试中断也不给源文件和 git status 留痕。

---

## 11. Windows / Node 环境坑

- **Node 22 禁止无 shell spawn `.cmd`（EINVAL）**：起 dev server 用 `spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--port', '5199', '--strictPort'])`，而不是 `spawn('npm run dev')`。
- **收尾杀进程树**：`execSync('taskkill /PID <pid> /T /F')`——`/T` 必须带，vite 有子进程。
- PowerShell 后台起 preview：`Start-Process cmd.exe -ArgumentList '/c npm run preview ...'` 包装（直接 `Start-Process npm` 报 "cannot find all the information required"）。

---

## 12. 移植到其他项目的复用清单

1. 站点内容收敛为**单一 reactive 状态 + 整包替换函数**（对齐 `applyContent`）；
2. 站点端加 DEV 分支：在 iframe 内（`window.parent !== window`）时 fetch 完成后发 `wk:hello`，并监听 `wk:content`/`wk:lang`/`wk:preset`；
3. 编辑器页复制 `WorkshopView.vue` 骨架：grid 分屏 + 拖拽分隔条 + 视口档位（**对照自家站点断点**）+ `wk:*` 消息收发；
4. App/路由层加 `wk:nav` 监听与 `wk:route`/`wk:state` 回显（watcher + 判等，防乒乓）；
5. Navbar 等固定导航组件加 `inFrame` 隐藏策略；
6. 编辑面板按业务拆分，全部直接 mutate 状态（不用草稿副本）；
7. 复制 `smoke-workshop.mjs` 改选择器与业务断言；
8. 构建后验证 `dist` 无编辑器 chunk。

## 13. 已知局限与可选增强

| 局限 | 说明 | 可选增强 |
| --- | --- | --- |
| 编辑不持久化 | 刷新工坊页丢编辑（有常驻提示 + 下载保存） | `sessionStorage` 自动暂存 / 定时落 IndexedDB |
| postMessage 目标 `'*'` | dev-only 本地同源够用 | 跨域部署时改 origin 白名单并校验 `e.origin` |
| 拖拽仅 mouse 事件 | 触屏拖不动分隔条 | 换 `pointerdown/move/up`（Pointer Events 统一鼠标触摸） |
| deep watch + 全量序列化对比 | 大内容（>1MB）时 dirty 对比有开销 | 分块哈希或 `watch` 粒度下沉 |
| 无编辑历史 | 误操作只能重置 | baseline 快照栈 + undo/redo |
| 样式仅内容可编 | 主题预设可切，但 tokens 不可改 | 面板挂 `theme.colors` 即可（数据已支持） |



