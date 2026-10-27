# 工作台 UI 全面重构设计说明 —— 指挥舱（Command Deck）· v1.2.79

> 角色：UI 设计师｜上游：[requirements.md](requirements.md)（第 7 轮需求，含 6 来源调研）｜下游：全栈开发（纯客户端 client.js/CSS/i18n）→ QA → 验收复核。
> 结论先行：页面头升级为「eyebrow + 30px display + 上下文 chips + 动作组」；Now 区用**深色渐变 hero** 承载当前阶段、7 段时间轴、环形进度与主操作；Project 区 3 列；Delivery 区 7 步连接线时间轴 + 5 卡 bento（第 5 卡全宽条）；统一 11–30px 字号阶、4–32px 间距、10/14/18 圆角、三级阴影与 160ms 动效；浅/深主题均成立。版本：插件 **1.2.78 → 1.2.79**、根保持 **1.2.79**（交付后根 +1 → 1.2.80）。
> 效果图（SVG + 2× PNG）：[overview-light](design/workbench-v1279-overview-light-1440.svg) / [overview-dark](design/workbench-v1279-overview-dark-1440.svg) / [full-light](design/workbench-v1279-full-light-1440.svg) / [mobile-390](design/workbench-v1279-mobile-light-390.svg) / [迭代 r1](design/workbench-v1279-overview-light-r1-1440.svg)。

---

## 0. 摘要

| 项 | 设计决定 |
|---|---|
| 方向 | 「指挥舱」：全页唯一深色面板（hero）+ 浅色内容画布；主次由「表面/尺度/留白」决定，不靠更多边框 |
| 页面骨架 | 页面头（sticky）→ Now（hero + 告警）→ Project（3 列）→ Delivery（时间轴 + bento） |
| 首屏 | 1440×900：页面头 + hero（含主操作）+ Now 告警全部可见 |
| 字号阶 | 11 caption / 12 small / 13 body / 14 card-title / 16 section / 20 metric / 30 display（≤700 display 24） |
| 间距 | 4 / 8 / 12 / 16 / 20 / 24 / 32；页面 32（≤1023 20，≤700 14） |
| 圆角 | 10（控件）/ 14（卡片）/ 18（hero/大面板）/ 999（pill） |
| 状态色 | success / warn / error / business / idle；只用于点、条、pill 底色与图标，正文保持 label 色 |
| 响应式 | ≥1280 项目三列 / 交付两列；1024–1279 项目两列 / 交付两列；768–1023 项目两列 / 交付单列；≤700 单列、主按钮 44px |
| 动效 | 160ms cubic-bezier(.2,.7,.3,1)；hover 只做边框/阴影/位移 1px；reduced-motion 全关 |
| 交付 | 高保真 SVG/PNG + 本说明 + 组件/状态对照表 + QA 视觉基线 |

---

## 1. 调研与借鉴

> 沿用 product 阶段 2026-10-27 的 6 个可引用来源（URL + 访问日期 + 结论见 [requirements.md §7](requirements.md)）；设计阶段不重复抓取、不新增未注明来源。以下只写「对本设计稿的直接落点」。

### 1.1 来源与结论（设计视角）

| # | 来源 | 访问日期 | 设计结论 |
|---|---|---|---|
| 1 | Linear · [A calmer interface](https://linear.app/now/behind-the-latest-design-refresh) | 2026-10-27 | 侧栏/导航退后、内容优先；减少无意义分割线；调色更平静；标签更紧凑 → 侧栏降权、卡边降对比、页面只留一个强焦点（hero） |
| 2 | NN/g · [Visual Hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/) | 2026-10-27 | 层级靠对比/尺度/分组；大元素 ≤2 个；留白是层级工具 → 30px 只给页面标题与 hero 阶段名；区块 15–16；卡 14 |
| 3 | NN/g · [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | 2026-10-27 | 摘要 + 明确前进机制；不嵌套多层 → 需求卡 2 行 + 查看完整；事件记录降级；不恢复折叠 |
| 4 | Vercel Geist · [Colors](https://vercel.com/geist/colors) | 2026-10-27 | 两个背景层级；组件 1/2/3 对应默认/hover/active；边框 4–6；半透明阴影、边框只画一次 → 页面底 vs 卡片 layer-1；卡 hover 边框/阴影；单层边框 |
| 5 | Vercel Geist · [Grid](https://vercel.com/geist/grid) | 2026-10-27 | 三断点定义列；最多一层网格；可点击 cell 各自焦点环 → 1280/1024/700 断点；Project/Delivery 单层 grid |
| 6 | W3C WAI · [WCAG 1.4.3](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) | 2026-10-27 | 正文 ≥4.5:1、大字 ≥3:1 → 设计稿记录对比度（§8.2），hero 白字 18.7:1 |

### 1.2 借鉴决策

| 借鉴点 | 决策 | 落点 |
|---|---|---|
| 一个强焦点、其余退后 | **采用** | 全页仅 hero 深色；卡片与区头用中性色 |
| 少边框、用留白/表面组织 | **采用** | 卡边 22%（hover 32%）；卡内不再套边框；区块间 28–32 |
| 双表面层级 + hover/active | **采用** | `--wb-canvas` 页面底 / `--wb-surface` 卡片 / hover 表面 2 |
| 半透明阴影 | **采用** | `--wb-shadow-1/2` 全部用 color-mix 半透明 |
| 三断点 + 单层网格 | **采用** | Project/Delivery 各自单层；断点 1280/1024/700 |
| 渐进披露（摘要+入口） | **采用** | 需求 2 行；事件 5 条；设计卡缩略图 + 文档链接 |
| 深色主题专门配色 | **不采用** | hero 固定 #0B1220 锚点；浅/深主题共用；其余表面走 alias token |
| 大面积玻璃拟态/渐变背景 | **不采用** | 页面只加 10% 品牌径向光，不做大色块 |
| 折叠/展开交付卡 | **不采用** | v1.2.78 已取消，本轮保持直接展示 |

---

## 2. 设计原则

1. **一眼有主次**：全页只有一个深色面板（hero）；30px 只出现两次（页面标题、hero 阶段名）。
2. **结论先行**：每张卡首行是「标题 + 主 metric/状态」，细节在后；卡片不是表单。
3. **留白即层级**：区块间 28–32、卡间 14–16、卡内 16–20；用距离分组而不是加边框。
4. **克制**：品牌色只用于链接/焦点/小面积强调；状态色只用于点/条/pill。
5. **稳**：只动表现层与布局容器，所有按钮/数据流/禁用逻辑原样保留。

---

## 3. 信息架构与页面清单

```
页面头（sticky 108px）  工作区 · 项目 · 第 N 轮 / 工作台 30px + chips / 动作组
Now 区（eyebrow）       hero（深色，全宽） + 告警卡 + 空态
Project 区（eyebrow）   项目状态 | 团队与指派 | 需求与调整（3 列）
Delivery 区（eyebrow）  项目流程时间轴 + 事件；5 卡 bento（2 列 + 1 全宽）
```

| 页面/区块 | 关键内容 | 保留的交互 |
|---|---|---|
| 页面头 | eyebrow、display 标题、轮次/快速模式/已通过 chips、当前阶段说明、刷新/流水线/团队/通知/关闭 | 全部原 handler；compact 返回 |
| Hero | STAGE 05/07、阶段名、状态 pill、摘要、负责角色、7 段时间轴、环形 4/7、主/次 CTA、review note、门禁说明、查看复核报告 | reviewPipelineStage(approve/reject)、startPipelineStage、openPipeline |
| 告警卡 | 失败项/问题计数、说明、发给团队、查看验收 | sendAcceptanceFailures、openAcceptance、问题行 action |
| 项目状态 | 4/7 大数字、进度条、轮次/模式 chips、当前阶段、查看流水线/打开需求 | openPipeline、openRequirement |
| 团队与指派 | 6 角色三态 chips、指派任务、团队面板入口、最近指派 | openAssignmentDrawer、团队入口 |
| 需求与调整 | 标题、轮次/范围 chips、2 行摘要、查看/追加/修改/新轮、修订记录 disclosure | openRequirementPanel 四模式、修订 disclosure |
| 项目流程 | 7 步连接线时间轴（名字/角色/状态/当前高亮）、事件记录 | 点击阶段 openPipeline |
| 交付 5 卡 | 设计稿、验收、交付前体检、本轮变更、运行中（第 5 卡全宽条） | 原卡片全部按钮/链接 |

---

## 4. 布局规格

### 4.1 页面骨架尺寸（1440 桌面）

| 层 | 尺寸/间距 |
|---|---|
| 外壳顶栏 | 高 52；左右 padding 16；品牌 28×28 圆角 8；标题 13/700 |
| 侧栏 | 宽 248；padding 16/12；分组标签 10/600 + 1.2 字距；项高 34、图标 16、文字 12.5；活动项 232×32 圆角 8 + 2×16 左指示条 |
| 页面头 | 高 108（padding 18/32）；sticky top 0；底面 96% 不透明 + 1px 下边线 |
| 内容画布 | max-width 1280；左右 32（≤1023 24、≤700 14）；上 28、下 40；区块间 32（≤1023 24、≤700 20） |
| Hero | 全宽 × 270；padding 26/28；左列弹性、右列 300（≤1279 280）；圆角 18 |
| 告警卡 | 全宽 × 56；左色条 3；圆角 14 |
| Project 卡 | 3 列，卡宽 ≈366；高 ≥170；padding 18/20；gap 14 |
| 时间轴卡 | 全宽 × 154；7 步均分；事件行 11px |
| Delivery 卡 | 2 列 = 557 × 184；第 5 卡全宽 × 120；gap 14 |

### 4.2 断点

| 断点 | 页面/画布 | Project | Delivery | Hero | 页面头 |
|---|---|---|---|---|---|
| ≥1280 | 32 / 1280 | 3 列 | 2 列 + 全宽条 | 左右（右 300） | sticky |
| 1024–1279 | 24 / 1280 | 2 列（需求全宽） | 2 列 + 全宽条 | 左右（右 280） | sticky |
| 768–1023 | 20 / 100% | 2 列（需求全宽） | 1 列 | 上下两段 | sticky |
| ≤700 | 14 / 100% | 1 列 | 1 列 | 单列 | 非 sticky |
| 360 极限 | 14 | 1 列 | 1 列 | 单列，display 24 | 非 sticky |

- 所有 grid 子项 `min-width:0`；标题 `overflow-wrap:anywhere`；长项目名 `text-overflow:ellipsis`。
- 触控：主 CTA 44×≥120；次 CTA 36；icon button 32（视觉）但外层点击区 44；卡内文字链接行高 ≥24。
- Hero 右栏在 ≤1023 下移，CTA 全宽 44；review note 保持 34。

### 4.3 关键状态布局

- 无项目：仅需求录入卡（宽 ≤640 居中），不渲染 hero/三区。
- review 阶段：hero 主 CTA = 通过/打回；pending/failed：启动并派发/指派任务；其它：查看流水线/指派任务。
- 全通过：hero 显示「全部阶段已完成」+ 查看流水线；进度 7/7。
- 验收 fail / 体检 warn：告警卡出现（左条 warn/error）；卡内状态 pill 红色 + 文字。
- 空列表：验收/变更/运行卡显示一行空态 12px caption，不显示假数据。

---

## 5. 设计 Tokens

> 全部用 `--dsw-alias-*` + `color-mix`；`#0B1220` 只作为 hero 深色锚点。实现作用域 `.ds-wb-page.ds-wb-v1279`，避免影响其它视图。

```css
.ds-wb-page.ds-wb-v1279 {
  /* 表面 */
  --wb-canvas: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 55%, var(--dsw-alias-bg-base));
  --wb-surface: var(--dsw-alias-bg-layer-1);
  --wb-surface-2: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 70%, var(--dsw-alias-bg-base));
  --wb-line: color-mix(in srgb, var(--dsw-alias-label-caption) 22%, transparent);
  --wb-line-strong: color-mix(in srgb, var(--dsw-alias-label-caption) 32%, transparent);
  /* 文本 */
  --wb-ink: var(--dsw-alias-label-primary);
  --wb-ink-2: var(--dsw-alias-label-secondary);
  --wb-ink-3: var(--dsw-alias-label-caption);
  /* 品牌/状态 */
  --wb-brand: var(--dsw-alias-brand-primary);
  --wb-ok: var(--dsw-alias-state-success-primary);
  --wb-warn: var(--dsw-alias-state-warn-primary);
  --wb-err: var(--dsw-alias-state-error-primary);
  --wb-biz: var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary));
  /* 字号阶 */
  --wb-fs-caption: 11px; --wb-fs-sm: 12px; --wb-fs-body: 13px;
  --wb-fs-card: 14px;    --wb-fs-section: 16px; --wb-fs-metric: 20px; --wb-fs-display: 30px;
  /* 间距 */
  --wb-sp-1: 4px; --wb-sp-2: 8px; --wb-sp-3: 12px; --wb-sp-4: 16px;
  --wb-sp-5: 20px; --wb-sp-6: 24px; --wb-sp-7: 32px;
  /* 圆角/阴影/动效 */
  --wb-r-sm: 10px; --wb-r-md: 14px; --wb-r-lg: 18px;
  --wb-shadow-1: 0 1px 2px color-mix(in srgb, var(--wb-ink) 8%, transparent);
  --wb-shadow-2: 0 1px 2px color-mix(in srgb, var(--wb-ink) 8%, transparent),
                 0 16px 38px -28px color-mix(in srgb, var(--wb-ink) 28%, transparent);
  --wb-hero: linear-gradient(135deg,
      color-mix(in srgb, var(--wb-brand) 72%, #0b1220) 0%,
      #0b1220 58%,
      color-mix(in srgb, #0b1220 90%, var(--wb-brand)) 100%);
  --wb-hero-fg: #ffffff;
  --wb-hero-fg-2: rgba(255,255,255,.76);
  --wb-hero-fg-3: rgba(255,255,255,.56);
  --wb-motion: 160ms cubic-bezier(.2,.7,.3,1);
}
```

| 类别 | 值 |
|---|---|
| 间距 | 4 / 8 / 12 / 16 / 20 / 24 / 32（4 基数 + 8 节奏；组件内 8/12，卡内 16/20，区块 28/32） |
| 字号/行高 | 11/1.4；12/1.45；13/1.55；14/1.4；16/1.3；20/1.2；30/1.15 |
| 字重 | 400 正文；600 小标题/标签；650 卡标题（实现用 600）；700 display/hero/metric |
| 数字 | `font-variant-numeric: tabular-nums` |
| 圆角 | 10 控件/输入；14 卡片/告警；18 hero；999 pill |
| 阴影 | surface = shadow-1；卡 hover = shadow-2；hero = 0 18 36 -20 + inset 1px 白 8% |
| 动效 | 160ms；hover 位移 -1px；focus ring 2px + 2px offset；loading 旋转 800ms linear |
| 层级 z | 页面头 20；hero 内装饰 0；抽屉/菜单 100；toast 200（沿用现有） |

---

## 6. 组件与八态状态矩阵

> 八态 = default / hover / focus / active / disabled / loading / empty / error；N/A 必须写理由。可交互组件的 focus 统一 2px brand + 2px offset。

### 6.1 组件清单

| # | 组件 | 规格（默认） | 备注 |
|---|---|---|---|
| C1 | 页面头 | 108px、sticky、eyebrow 11/600、display 30/700、chips 22、动作组 32 | compact 时隐藏副标题、返回按钮前置 |
| C2 | 主 CTA | 44×≥120，hero 内白底深字 / 页面内 brand 底白字，圆角 10，13/600 | 一屏一个 |
| C3 | 次 CTA | 36/44 高，透明或 surface-2，圆角 10 | 与主 CTA 间距 12 |
| C4 | 文本链接 | 11–12/600 brand，行高 ≥24 | hover 下划线 |
| C5 | Icon button | 32×32，圆角 8，hover surface-2 | 点击区 44（padding） |
| C6 | 卡片 | 14 圆角、1px line、shadow-1、padding 18/20 | hover 只用于可点卡 |
| C7 | Hero | 270 高、18 圆角、深色渐变、白字、内嵌右栏 | 全页唯一深色 |
| C8 | 阶段段（rail） | 7 段，高 6、圆角 3、gap 8；下方 10px 阶段名 | 纯展示，aria-hidden + 文字说明 |
| C9 | 时间轴 | 7 步，圆点 14（含 ✓）、连接线 2px、名字 12/600、角色 10、状态 11 | 当前步 tint 底 + 边线 |
| C10 | Pill/Chip | 高 20–22、圆角 999、11/600，状态底色 8–12% | 不得只靠颜色：含文字 |
| C11 | 输入 | 34–36 高、圆角 10、1px line，focus brand + ring | review note |
| C12 | 告警卡 | 56 高、左条 3、圆角 14、图标圆 30 | warn/error 两色 |
| C13 | 侧栏项 | 34 高、圆角 8；活动项 brand 8% + 2×16 指示条 | 降权非活动 |
| C14 | 空态 | 12px caption 一行，无插图、无假数据 | 各卡统一 |

### 6.2 八态矩阵

| 组件 | Default | Hover | Focus | Active | Disabled | Loading | Empty | Error |
|---|---|---|---|---|---|---|---|---|
| C2 主 CTA | 白底 #0B1220 字（hero）/ brand 底白字（页面） | 亮度 .96 + translateY(-1px) | 2px #93C5FD 环 | translateY(0) + 亮度 .9 | opacity .55、cursor not-allowed | 文案「处理中…」+ 14px 旋转，宽度不变 | N/A（始终有文案） | toast + `.ds-errorline` 红字，不改变按钮尺寸 |
| C3 次 CTA | 透明/ surface-2 + line | 表面 2 / 白 10% | 2px brand 环（hero 内白 40%） | 表面 3 / 白 16% | opacity .45 | 文案「处理中…」 | N/A | 同上 |
| C4 链接 | brand 600 | 下划线 + 深一档 | 2px brand 环 | 深一档 | N/A（不设禁用链接） | N/A | N/A | N/A |
| C5 Icon button | 32×32、透明 | surface-2 底 | 2px brand 环 | 内阴影 2% | opacity .45 | 图标换 14px 旋转 | N/A | toast |
| C6 卡片 | surface + line + shadow-1 | line-strong + shadow-2 + translateY(-1px)（仅可点卡） | `:focus-within` 2px brand 环 | N/A（卡非按钮） | N/A | 骨架 3 行（22% 底），reduced-motion 静态 | 一行 caption 空态 | 行内 `.ds-errorline` + 重试链接 |
| C7 Hero | 深色渐变 + 白字 + 光晕 | N/A（容器） | 内部按钮各自环 | N/A | N/A | 阶段数据加载中：骨架条 + 「加载中」文字 | 无项目不渲染 | 数据错误 → 页面级 errorline |
| C8 阶段段 | 6px 条 + 10px 标签 | N/A（展示） | N/A（展示） | N/A | N/A | 当前阶段 pulse 2s（reduced-motion 取消） | 阶段数 0 → 不渲染 rail | failed 段红色 + 文字「已打回」 |
| C9 时间轴步 | 圆点 + 名称/角色/状态 | 背景 surface-2 tint | 2px brand 环 | 背景 12% tint | N/A（可点，始终可用） | active 步圆点 pulse | 无项目不渲染 | failed 红点 + 文字 |
| C10 Pill/Chip | 状态底色 8% + 状态字 | 可点 chip 边框加强 | 2px brand 环 | 选中 brand 12% | opacity .5 | N/A | 计数 0 显示「0」/「无」 | N/A |
| C11 输入 | surface-2 + line、34–36 高 | line-strong | brand 边框 + 2px 环 | N/A | opacity .55、不可输入 | N/A | placeholder 文案 | err 边框 + 11px 错误文案 |
| C12 告警卡 | 白卡 + 左条 + 图标 | 边框 tint 加深 | 内部按钮各自环 | N/A | N/A | N/A | 无告警不渲染 | 本身即 error/warn 语义 |
| C13 侧栏项 | 透明 + 12.5 字 | surface-2 底 | 2px brand 环 | 左指示条 + brand 8% 底 | opacity .45 | N/A | N/A | N/A |
| C14 空态 | 12px caption | N/A | N/A | N/A | N/A | N/A | 自身即空态 | N/A |

---

## 7. 响应式规格（360 / 768 / 1280）

### 7.1 360（移动）

- 页面边距 14；页面头非 sticky：eyebrow 9.5、display 24、chips 20；动作组折叠为「刷新 + 更多」。
- Hero 单列：padding 20；阶段名 24；状态 pill 同行；7 段 rail 宽 100%；进度文案 10；主/次 CTA 各 44 高、全宽并排（或上下），note 32；门禁说明 9.5。
- 告警卡 58 高、两行文案；项目/交付全部单列；交付 5 卡单列，第 5 卡不再全宽条（与其它一致）。
- 时间轴 7 步：两行（4+3），圆点 11、标签 8.5；无横向滚动。
- 无横向溢出：所有文字 `overflow-wrap:anywhere`；chips 可换行。

### 7.2 768（平板竖屏）

- 页面边距 20；页面头 sticky；display 30；Project 2 列（需求全宽）；Delivery 1 列（≤1023 为单列，与需求口径一致）；Hero 上下两段（左文案 + 右进度/CTA 并排换行），CTA 44。
- 侧栏在 ≤900 由现有 compact 机制接管（保持既有行为，不改交互）。

### 7.3 1280（桌面）

- 页面边距 32；Project 3 列；Delivery 2 列 + 全宽条；Hero 左右（右 300）；页面头 sticky；内容 max-width 1280。
- 1440 时画布居中；左右剩余空间留白，不拉伸卡片。

### 7.4 断点验证清单

| 视口 | 期望 |
|---|---|
| 360×800 | 单列、无横滚、CTA 44、rail 100% |
| 768×1024 | 项目 2 列 / 交付 1 列、hero 两段、无横滚 |
| 1024×768 | 2 列（需求全宽）、hero 左右 280 |
| 1280×800 | 3 列、hero 左右 300、首屏 hero 完整 |
| 1440×900 | 首屏 hero + Now 完整；Delivery 顶部可见 |

---

## 8. 可访问性

### 8.1 语义与键盘

- 页面：`<header class="ds-wb-page-head">` + 现有滚动容器 + 三个 `<section aria-labelledby="ds-wb-zone-{now|project|delivery}-title">`；标题层级 h1（工作台）→ h2（区块）→ h3（卡片/hero 阶段）。
- Hero 阶段名用 h2/h3 语义（视觉 30）；7 段时间轴用 `<ol aria-label="阶段进度">`，段条 `aria-hidden`，每步提供文字状态。
- 时间轴 `<ol>`，每步按钮 `type="button"` + `aria-current="step"`（当前阶段）；事件列表 `<ul>`。
- 所有 icon button 有 `aria-label`；纯装饰 SVG `aria-hidden="true"`；链接文案独立可读（不只「→」）。
- Tab 顺序 = 阅读顺序：页面头动作 → hero 主/次 → note → 告警 → 项目 → 时间轴 → 交付卡；焦点环 2px brand + 2px offset，`focus-visible`。
- 抽屉/弹层沿用现有 focus 与 Esc 关闭逻辑，不改。

### 8.2 对比度（计算值，sRGB）

| 前景 / 背景 | 比值 | 用途 |
|---|---|---|
| #0F172A / #FFFFFF | 17.85 | 浅色主文本 |
| #475569 / #FFFFFF | 7.58 | 次要文本 |
| #64748B / #FFFFFF | 4.76 | caption（≥4.5） |
| #94A3B8 / #FFFFFF | 2.56 | **仅非信息性装饰**（不用作正文） |
| #2563EB / #FFFFFF | 5.17 | 链接/按钮 |
| #15803D / #FFFFFF | 5.02 | 成功文字 |
| #B45309 / #FFFFFF | 5.02 | 警告文字 |
| #B91C1C / #FFFFFF | 6.47 | 错误文字 |
| #FFFFFF / #0B1220 | 18.72 | hero 主文本 |
| #FFFFFF / #1D3E8F | 9.82 | hero 渐变亮端 |
| #93C5FD / #0B1220 | 10.38 | hero 链接 |
| #E8EDF5 / #0B0F15 | 16.34 | 深色主题主文本 |
| #8B97A8 / #151B24 | 5.84 | 深色主题 caption |
| #60A5FA / #10151D | 7.20 | 深色主题链接 |

> 浅色主题 `--wb-ink-3` 使用 label-caption（#64748B，4.76:1）；不使用 faint 承载信息。hero 内 rgba 白透明度：主 1.0（18.7）、次 .76（等效 ≥10:1）、弱 .56（等效 ≥5.5:1，且仅用于辅助说明）。

### 8.3 颜色以外的表达

- 每个阶段段/圆点旁有文字状态（已通过/待评审/待开始/已打回）。
- 告警卡有图标 `!` + 标题 + 计数 pill + 文案；错误不是只有红色。
- 状态 pill 由「底色 + 文字」组成；环形进度有数字 4/7。

### 8.4 动效与降级

- `transition: var(--wb-motion)` 只用于边框/阴影/颜色/位移 1px；不自动播放动画。
- `@media (prefers-reduced-motion: reduce)`：`transition:none`、无 pulse、无骨架 shimmer。
- 无全屏遮罩过渡；不改变布局尺寸（loading 文案同宽）。

---

## 9. 可用性走查（Nielsen 10 启发式）

| # | 启发式 | 发现 | 修正 |
|---|---|---|---|
| 1 | 系统状态可见 | 旧 hero 只有 7 个 8px 点，进度不直观 | 7 段时间轴 + 环形 4/7 + 「已通过 4/7」文字 + 状态 pill |
| 2 | 贴合真实世界 | 旧卡标题 9.5px 全大写、术语密 | 中文标题 14/600；阶段名与角色用业务词（验收复核/项目经理 Agent） |
| 3 | 用户可控 | 打回/关闭/返回分散 | 页面头固定刷新/流水线/团队/通知/关闭；compact 返回前置 |
| 4 | 一致性与标准 | 旧卡字号 9–10.5、按钮高度不一 | 统一 11–30 字号阶、44/36/32 三档按钮、10/14/18 圆角 |
| 5 | 错误预防 | 打回不可撤销 | 次 CTA 与主 CTA 分离；review note 可选；沿用现有确认/禁用逻辑 |
| 6 | 识别优于回忆 | 交付卡要看内容才知道结论 | 卡首行「标题 + metric/状态」（4 张、42/42、通过、已审 1/3、1 个） |
| 7 | 灵活高效 | 旧页面需要滚动找主操作 | 首屏 hero 固定主操作；紧凑模式保留；键盘焦点顺序 |
| 8 | 美学与极简 | 10 张同质卡 + 多分割线 | 一个深色焦点、卡边降对比、卡内去嵌套框、留白分组 |
| 9 | 错误恢复 | 失败项只藏卡内 | 告警卡置顶 + 计数 + 「发给团队」+ 失败项文字；页面级 errorline |
| 10 | 帮助与文档 | 门禁规则不易懂 | hero 门禁说明 + 「查看复核报告」+ 卡内 hint + 团队入口 |

---

## 10. 自检评分与迭代记录

### 10.1 迭代第 1 版（r1）渲染 → 检查

效果图：[workbench-v1279-overview-light-r1-1440.svg](design/workbench-v1279-overview-light-r1-1440.svg)

r1 五维评分：视觉层级 **4**、清晰度 **4**、一致性 **3**、反馈 **4**、可访问性 **3** → 均分 **3.6**（低于门槛）。must 项 **1 项失败**：hero 三个次按钮 30px 高、单行拥挤（触控 <44）。其他发现：

1. 页面标题 26px、区块标签 13px，和 v1.2.78 差距不明显，缺「大气」；
2. 项目区 2 列 + 需求全宽第二行，页面更长、需求更弱；
3. 交付卡按 3 列摆放，标题被压缩（12px 仍可能截断）；
4. 卡边过淡、阴影过轻，卡片与页面底分不开（尤其深色主题仅 6% 明度差）；
5. hero 右侧 CTA 无主次，review note 与门禁说明拥挤；
6. 7 段 rail 固定 90px 宽，右侧留白不对称。

### 10.2 修正（r2 → 最终稿）

| # | 修正 | 结果 |
|---|---|---|
| 1 | 主 CTA 44px 白底 + 次 CTA 44px 透明，分两列；note 独立一行；门禁说明/复核报告链接分层 | must 项修复，触控达标 |
| 2 | display 30 / hero 阶段名 30 / 区块 15–16 / 卡 14；字号阶收敛到 5 档 | 层级更强 |
| 3 | Project ≥1280 三列，1024–1279 两列（需求全宽），≤700 单列 | 首屏更紧凑 |
| 4 | Delivery 2 列 + 第 5 卡全宽条（1128×120），标题完整 | 无截断、节奏更好 |
| 5 | 卡边 22%（hover 32%）、shadow-1/2 半透明；深色 surface 提升到 #151B24 + 26% 边 | 两主题层次清楚 |
| 6 | rail 宽度 = 左列宽度 - 6×8，段条均分；当前段琥珀、已通过绿 | 对称、可读 |
| 7 | 补充深色主题、移动端 390 效果图与 r1 对照 | 验证两主题与窄屏 |

r2 五维评分：视觉层级 **5**、清晰度 **4**、一致性 **5**、反馈 **4**、可访问性 **5** → 均分 **4.6**；must 项 **0 失败**。判定：可交接开发。

### 10.3 MUST 项核对

| MUST | 结果 |
|---|---|
| 4/8px 间距体系 | ✅ 4/8/12/16/20/24/32 |
| 字号阶梯与行高 ≥1.4 | ✅ 11/12/13/14/16/20/30；正文 1.4–1.55 |
| 颜色 token 化 + 对比度 | ✅ 只用 alias + color-mix；§8.2 计算 |
| 可点击区域 ≥44×44 | ✅ 主 CTA 44；icon 外层 44；卡内链接 ≥24 行高（§4.1） |
| 八态矩阵 | ✅ §6.2，N/A 均写理由 |
| 响应式 360/768/1280 | ✅ §7 |
| 动效 150–300ms + reduced-motion | ✅ 160ms + 降级 |
| 键盘可达/焦点可见/ARIA/不只靠颜色 | ✅ §8 |
| 一屏一个主行动 + 层级清晰 | ✅ hero 主 CTA 唯一 |

---

## 11. 交接

### 11.1 给开发：组件/状态对照表

| 设计组件 | 实现位置/类名 | 状态规则 | Tokens/要点 |
|---|---|---|---|
| 页面头 | `.ds-wb-page-head` + `.ds-wb-head-eyebrow/-title/-meta/-actions` | sticky；compact 隐藏副标题；≤700 非 sticky | 30/700、11/600、108px 高、bottom line |
| Hero | `.ds-wb-hero` + `.ds-wb-hero-copy/-side/-eyebrow/-title/-summary/-meta` | 无项目不渲染；全通过态；review/pending/其它三态 CTA | `--wb-hero` 渐变、18 圆角、白字、`--wb-motion` |
| 环形进度 | `.ds-wb-hero-ring`（SVG 2 圆） | 4/7 arc；0/7 与 7/7 边界正确 | r=34、sw=7、rotate(-90)、tabular-nums |
| 阶段 rail | `.ds-wb-rail` + `.ds-wb-rail-step[data-status]` | approved/active/review/pending/failed 五色 | 段高 6、gap 8、标签 10 |
| 告警卡 | `.ds-wb-alert[data-tone="warn|error"]` | 有 failedItems/issues 才渲染 | 左条 3、圆角 14、图标 30 |
| 区块头 | `.ds-wb-zone-head` + `.ds-wb-zone-kicker/-title/-hint` | 沿用现有 zoneHead | kicker 11/600、title 16/650 |
| Project 栅格 | `.ds-wb-project-grid` | 1280/1024/700 三断点 | 单层 grid、gap 14 |
| 需求卡 | 现有 `.ds-wb-adjust` 内容 + `.ds-wb-adjust-summary` | 保留 disclosure/四操作 | 2 行 clamp、动作换行 |
| 时间轴 | `.ds-wb-flow` + `.ds-wb-flow-step[data-status]` | current tint、✓、failed 文字 | 圆点 14、连接线 2 |
| 交付栅格 | `.ds-wb-delivery-grid` + `.ds-wb-delivery-card` | 2 列；第 5 卡 `.ds-wb-delivery-wide` | 卡 557×184 / 宽 1128×120 |
| 按钮 | 复用 `.ds-btn` + `.ds-wb-btn`，hero 内 `.ds-wb-hero-primary/-secondary` | 见 §6.2 | 44/36/32、圆角 10 |
| 侧栏/外壳 | `.ds-root .ds-header/.ds-side/.ds-pane-*` 限定覆盖 | 不改交互 | 降权、活动项 8% + 2px |
| i18n | 新增 `workbench.v1279.*`（标题/eyebrow/进度/空态/门禁等） | zh/en 成对 | 不删旧键 |

**开发约束**：只改 `dsh-web-filebrowser-plugin/client.js`（含 CSS/i18n）+ 版本/文档；不改 Host/数据/依赖；保留全部 handler 与禁用逻辑；类名前缀 `ds-wb-`，外壳覆盖加 `.ds-root` 限定；不使用大范围 `!important`。

> 说明：效果图左侧的「分组式侧栏」是视觉方向示意；实际外壳仍是现有的「文件 / 搜索 / Git / 更多」横向侧栏条 + pane 头 + 标签页。本轮外壳只做 CSS 轻量统一（48px 顶栏、更安静的侧栏表面、pane 头与活动标签），**不改变导航结构、交互或快捷键**，满足需求「外壳 CSS 为主、不改交互」。

### 11.2 给测试：视觉基线与复测步骤

1. 重启 Harness → 刷新页面 → 打开工作台（必要时关闭再开）。
2. 浅色主题：对照 [overview-light](design/workbench-v1279-overview-light-1440.png) / [full-light](design/workbench-v1279-full-light-1440.png) 检查页面头、hero、告警、三卡、时间轴、5 卡。
3. 深色主题：对照 [overview-dark](design/workbench-v1279-overview-dark-1440.png) 检查 hero 与卡片层次、文字对比。
4. 360/768/1024/1280/1440 视口：按 §7.4 检查无横向滚动、单列/两列/三列、CTA 44。
5. 交互：通过/打回、启动并派发、review note、指派器、需求四操作、验收/体检/变更/运行、通知/刷新/关闭/compact。
6. 键盘：Tab 顺序、focus 环可见、Enter/Space 可触发；prefers-reduced-motion 下无动画。
7. 记录：截图 + 视口 + 主题 + 结论（pass/fail/blocked），回填 acceptance 对应项。

---

## 12. 风险与开放问题

| 风险 | 说明 | 处理 |
|---|---|---|
| 深色 hero 在深色主题过重 | hero 锚点固定深色，周围表面更深 | 内光晕 + 1px 白 8% 边；深色效果图已出，待 Owner 目视 |
| 全量 CSS 覆盖回归 | 旧卡片内部有 9–10.5px 规则 | 只覆盖 `.ds-wb-v1279` 作用域；QA 静态断言 + 逐卡回归 |
| 5 卡 bento 第 5 卡全宽 | 宽卡内容少会显空 | 改为 4 列统计（运行中/最近一次/结果/失败）+ 操作，见 full-light |
| 360 宽度 7 段 rail | 段条过窄 | 移动端两行时间轴（§7.1），标签 8.5 |
| 视觉主观「高大上」 | 需要 Owner 判断 | 提供浅/深/全页/移动 4 效果图 + r1 对照；批次 16 目视验收 |
