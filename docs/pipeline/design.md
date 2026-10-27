# 工作台 UI 全面重构设计说明 —— 指挥舱（Command Deck）· v1.2.79

> 角色：UI 设计师｜上游：[requirements.md](requirements.md)（第 7 轮需求，含 6 来源调研）｜下游：全栈开发（纯客户端 client.js/CSS/i18n）→ QA → 验收复核。
> 结论先行：页面头升级为「eyebrow + 30px display + 上下文 chips + 动作组」；Now 区用**深色渐变 hero** 承载当前阶段、7 段时间轴、环形进度与主操作；Project 区 3 列；Delivery 区 7 步连接线时间轴 + 5 卡 bento（第 5 卡全宽条）；统一 11–30px 字号阶、4–32px 间距、10/14/18 圆角、三级阴影与 160ms 动效；浅/深主题均成立。版本：插件 **1.2.78 → 1.2.79**、根保持 **1.2.79**（交付后根 +1 → 1.2.80）。
> 效果图（SVG；2× PNG 导出已随 v1.2.85 仓库瘦身移出，可由 SVG 重建）：[overview-light](design/workbench-v1279-overview-light-1440.svg) / [overview-dark](design/workbench-v1279-overview-dark-1440.svg) / [full-light](design/workbench-v1279-full-light-1440.svg) / [mobile-390](design/workbench-v1279-mobile-light-390.svg) / [迭代 r1](design/workbench-v1279-overview-light-r1-1440.svg)。

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
2. 浅色主题：对照 [overview-light](design/workbench-v1279-overview-light-1440.svg) / [full-light](design/workbench-v1279-full-light-1440.svg) 检查页面头、hero、告警、三卡、时间轴、5 卡。
3. 深色主题：对照 [overview-dark](design/workbench-v1279-overview-dark-1440.svg) 检查 hero 与卡片层次、文字对比。
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

---

## 13. v1.2.80 实机反馈修正（完成态与细节）

> 来源：Owner 对 v1.2.79 实机截图反馈（2026-10-27）；范围：纯客户端 CSS/JSX/i18n，不改变 IA 与设计 token。

| # | 实机问题 | 修正 |
|---|---|---|
| 1 | 项目三列下 6 个角色 chips 被压成 3 列窄块，名称只剩 1 个字 | 项目网格内 chips 固定 **2 列**（≤700 仍 2 列，卡片全宽），chip 内边距/字号微调，名称与状态 pill 完整 |
| 2 | 完成态 hero 仍写「STAGE 7 / 7 · 当前阶段」，且「关已完成 / 已完成」重复、门禁写「通过后进入人工确认」 | 完成态 eyebrow「全部 7 关已完成」、标题「本轮交付完成」、隐藏重复状态 pill、侧栏「第 N 轮 · 全部通过」、门禁改「全部阶段已完成 · 可发布或发起新轮变更」并隐藏复核链接 |
| 3 | 需求卡摘要以「背景 Owner 评审…」开头，且与「第 7 轮变更…」行重复 | `requirementSummaryText` 去掉「背景/目标/范围…」前缀；最新变更标题与需求标题同轮相同时隐藏重复 changeLine |
| 4 | 验收卡把 14 条 blocked 计为「待验收」，并出现空的「交付物」小节 | 计数拆为 通过/未通过/待验收/阻塞（blocked 独立 pill），零值 pill 不渲染；无交付包/预览分享时不渲染「交付物」小节 |
| 5 | 完成态体检仍写「建议先处理 5 项」，把可选缺失当阻断 | 完成态 verdict 改「提示 N 项」+ 中性色；任务记录/预览分享/交付包缺失降级为 N/A（文案「暂无记录/未分享/未打包」） |
| 6 | 提交后「本轮变更」显示「已审 0/0」和「本阶段还没有文件变化」 | total=0 时隐藏已审计数，改文案「本轮变更已提交，无未提交改动。」 |
| 7 | 运行中统计顺序为 运行中/最近结果/上次失败/最近一次 | 改为 运行中 / 最近一次 / 最近结果 / 上次失败，最近一次为宽列 |
| 8 | 完成进度条为纯黑（brand 在本主题为中性墨色） | 进度填充改用 `--dsw-alias-state-business-primary` 强调色 |
| 9 | 完成态 Now 区仍显示「需要你决定的事 · 0 项」 | 完成态 hint 改「全部完成 · 暂无待处理」，并去掉重复空态行 |
| 10 | 项目状态卡重复「已完成」 | 完成态隐藏状态 pill；caption 改「全部通过」；行文案改「第 N 轮 · 全部阶段已完成」 |

**设计口径**：以上均为 v1.2.79 设计系统的实现修正，不新增 token/布局；完成态只改变文案与空态显示，不改变数据与操作。


---

## 14. v1.2.81 布局修正（Owner 实机截图）

| # | 问题 | 修正 |
|---|---|---|
| 1 | hero 只占左侧约 60%，右侧空一块 | 页面画布显式 `align-items: stretch`（不再继承旧 grid 的 start），zone 宽度 100%，hero 填满内容宽 |
| 2 | 项目区 3 卡一排太挤 | ≥768 改 **2 列 + 需求卡整行**；≥1600 才恢复 3 列；≤700 单列 |
| 3 | 交付区「变更」下方空一块、运行中卡长一条 | 设计稿整行展示；其余 4 卡 **2×2**（验收/体检、变更/运行中）；≤1023 单列 |

设计口径：三处均为响应式栅格与容器拉伸修正，不改 token/组件；项目区的 2 列 + 需求整行更接近内容密度，交付区 4 宫格消除空块与长条。


---

## 15. v1.2.82 项目区去挤压

| # | 问题 | 修正 |
|---|---|---|
| 1 | Owner 屏幕 ≥1600，项目区仍触发 3 列，每卡约 400px，需求标题截断、团队卡拥挤 | 移除 ≥1600 三列规则；≥768 始终 **2 列 + 需求卡整行**，列间距 16px；≤700 单列 |

设计口径：项目区固定为「状态｜团队 + 需求整行」，不再随超宽屏变 3 列；卡片获得约 620px 宽度，标题/摘要/chips 不再挤压。

---

## 16. v1.2.83 设计确认闸门与设计稿预览（第 11 轮）

> 角色：UI 设计师｜上游：[requirements.md](requirements.md)（第 11 轮，§6 行为规格 / §7 验收）｜下游：全栈开发（`pipeline.js` 闸门与文案 + `client.js` 预览）→ QA → 验收复核。
> 结论先行：design 提交后停在 `review`；流水线设计卡与工作台设计卡同屏给出「设计稿待你确认 · 确认后进入开发」+ 产物缩略图 + 「预览设计稿」；预览弹层用 iframe 渲染 HTML 稿、三档 360/768/1280、「查看源码」为次级入口；`.html/.htm` 默认渲染预览；确认/打回**只复用现有 `reviewPipelineStage`**，不新增审批 API。本阶段只交设计与设计说明，**未改 `client.js` / `pipeline.js`**。
> 效果图：[D1 流水线设计卡](design/design-gate-pipeline-review-1440.svg) / [D2 预览弹层](design/design-gate-preview-modal-1440.svg) / [D3 工作台设计卡](design/design-gate-workbench-card-1440.svg) / [D4 HTML 文件预览](design/design-gate-html-file-preview-1440.svg) / [移动端 390](design/design-gate-mobile-390.svg) / [关键状态板](design/design-gate-preview-states-1440.svg) / [深色主题片段](design/design-gate-dark-fragment-900.svg) / [r1 迭代证据](design/design-gate-preview-modal-r1-1440.svg)。

### 16.1 目标与设计原则

本轮的设计对象不是「再做一个页面」，而是把**设计评审的门、面、证据**装配到现有指挥舱里：门（design 不由快速模式自动通过）、面（产物以人可看的形式出现）、证据（缩略图 + 大图 + HTML 渲染）。

1. **证据先于确认（evidence before approval）**：预览入口、缩略图、通过/打回必须同卡同屏；Owner 不需要先点两层才看得到图。弹层底部同时放「打回原因」与「确认设计，进入开发」，让证据与动作在同一个视野里。
2. **一个动作门，一个主行动**：流水线卡的主行动是「预览设计稿」，弹层的主行动是「确认设计，进入开发」；打回是次级危险动作，不与主行动并排同色。全页不加第二个强品牌色按钮。
3. **只读预览、隔离渲染**：HTML 一律 `iframe + sandbox=""`，不向主文档注入设计稿 CSS/JS；图片走应用内图片查看器；源码永远是次级入口，不是默认行为。
4. **复用指挥舱 token 与组件**：新增颜色全部是 `--dsw-alias-*` 的语义别名（warn=待评审、success=已通过、error=已打回），不新造设计系统；圆角/阴影/动效沿用 §5。
5. **紧凑但不牺牲门槛**：360px 侧栏保持现有面板的信息密度，但**通过/打回/预览/确认按钮实测高度一律 ≥44px**；窄屏弹层全屏、底部操作区固定，滚动的只有预览画布。

### 16.2 调研与借鉴

> 调研时间 2026-10-27（Asia/Shanghai）。本轮用 `web_search` 检索 + `web_fetch` 读取；下列 4 个来源当日均返回 **HTTP 200** 并读取到正文，**无 blocked**。只借鉴交互结构、信息层级与安全约束，不复制受版权保护的文案/素材/源码。

| # | 来源 | URL | 访问日期 | 类型 | 关键结论（对本设计的直接落点） |
|---|---|---|---|---|---|
| 1 | Figma Help · Review branch changes | https://help.figma.com/hc/en-us/articles/5693123873687-Review-branch-changes | 2026-10-27 | 竞品（设计评审） | 评审在**独立 Branch review 窗口**里完成：左侧汇总 + 主区看变更 + 底部 `Add your review`（Approve / Suggest changes）；评审后可 **Review again**。→ 预览用**全屏弹层**而不是跳页；产物切换放顶部；结论放底部；通过/打回同一入口。 |
| 2 | Storybook Docs · Story rendering | https://storybook.js.org/docs/configure/story-rendering | 2026-10-27 | 设计系统/工具 | 故事渲染在**专用 preview iframe（Canvas）**里，与应用 UI 隔离；head/body 注入只进 preview iframe。→ 设计稿预览必须是「框内渲染」，画布四周留白、有独立滚动，不污染主应用。 |
| 3 | GitHub Docs · Approving a PR with required reviews | https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews | 2026-10-27 | 平台标准（评审闸门） | required review **阻止合并**；作者**不能自批**；变更后批准可失效需重审。→ design 未 approved 时 development 必须被代码层拦住；模型无审批入口；打回→failed→重提再次 review。 |
| 4 | MDN · HTMLIFrameElement.sandbox | https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/sandbox | 2026-10-27 | Web 标准 | `sandbox` 对嵌套内容施加额外限制，默认最严；`allow-scripts` 与 `allow-same-origin` 同开会绕过限制。→ 预览默认 `sandbox=""`；`title` 必填；不放开脚本；源码退路兜底。 |

**借鉴决策表**

| 借鉴点 | 来源 | 采用/调整/不采用 | 理由与落点 |
|---|---|---|---|
| 独立评审窗口 + 汇总/主区/结论三层 | #1 | **采用** | D2 弹层：header（标题/状态/提示）→ toolbar（产物/宽度/源码）→ canvas（设备框）→ 底部（note + 通过/打回）。 |
| 变更可重审（Review again） | #1 | **采用（沿用已有状态机）** | 打回 → `failed` → 修复重提 → 再次 `review`；不新增「一次通过永久有效」。 |
| 专用 preview iframe 隔离 | #2 | **采用** | HTML 产物与 `.html` 文件都在 iframe 内渲染；画布独立滚动；不注入主文档。 |
| required review 阻断下游 | #3 | **采用** | design 不在 fastApproval 名单；`startStage('development')` 由 Host 守卫拦住，不靠 UI 提示。 |
| 作者不能自批 | #3 | **采用（已有机制）** | 模型没有 approve 工具；只有 Owner 面板可点。 |
| `sandbox` 默认最严 | #4 | **采用** | `sandbox=""`、`title` 必填、`loading="lazy"`；失败时给「查看源码」。 |
| 评审入口只放弹层、卡片只给链接 | #1 | **不采用** | 本产品是「面板内评审」：卡片必须直接给缩略图与按钮，减少一轮点击。 |
| 批量自动通过 / 定时放行 | #3 | **不采用** | 本轮要移除的正是自动通过；疲劳靠「一屏一图一确认」降低，不放宽闸门。 |
| 预览默认打开源码 | — | **不采用** | 与需求相反；源码只作为次级入口。 |

**已验证模式 vs 创新假设**

- 已验证模式（有来源）：① 独立评审窗口 + 顶部产物切换 + 底部结论（#1）；② preview iframe 隔离渲染（#2）；③ 强制评审 + 不可自批 + 变更重审（#3）；④ sandbox 收紧 + title 必填（#4）。
- 创新假设（需验证）：① 在 360px 侧栏内同时放「提示条 + 缩略图 + 4 个按钮」仍可读 —— 用 [D1](design/design-gate-pipeline-review-1440.svg) 目检 + Owner 批次 20 复测，失败则缩略图降为 2 个 + 「查看全部」入口；② 768 档居中设备框足够判断桌面布局 —— 若不足则补 1024 档，宽度常量集中一处；③ 弹层内 iframe 在无脚本下视觉完整 —— 高保真稿以静态视觉为准，若交互稿缺脚本则标注「脚本受限」并保留源码入口。

**抓取受限/无网络说明**：无。4 个来源均 HTTP 200；本轮未出现 blocked。上游 product 阶段的 6 个来源（Figma / GitHub / Storybook / MDN×2 / HITL）见 [requirements.md §5](requirements.md)，本设计不重复引用其原文。

### 16.3 设计决策

| 决策 | 结论 | 理由 |
|---|---|---|
| 评审入口放哪 | **流水线侧栏设计卡（强提示）+ 工作台 Now 区设计卡（同语义）+ 预览弹层（操作）**，三处同一状态、同一 i18n 键 | 流水线是 Owner 处理闸门的原位置；工作台是首屏；弹层是证据与动作的合流处。不新增导航项。 |
| 3 秒内看懂「该我确认了」 | 卡片内信息顺序固定：**warn 色提示条 → 「第 2 关 · UI 设计 · 3 个产物」计数 → 缩略图行 → 「预览设计稿」主按钮 → 通过/打回**；弹层 header 再次重复提示条 | 先用颜色定位，再用文字确认，再用产物证明，最后给动作；颜色不只表意（同屏有文字）。 |
| HTML 预览的安全沙箱 | `iframe` + `sandbox=""` + `title="设计稿预览：<文件名>"` + `loading="lazy"`；不放开 `allow-scripts` / `allow-same-origin`；失败不白屏、给源码 | requirements §4 安全约束；iframe 失败时按钮降级为「查看源码」。 |
| 三档宽度 | 360 / 768 / 1280，默认 1280（容器更窄时取 100%）；只改 iframe/设备框宽度，不重复拉取；iframe 高度 ≥640，画布容器横向滚动 | 360 看移动、768 看平板、1280 看桌面；「不重复拉取」保证切换即时。 |
| 确认动作 | **只复用现有 `reviewPipelineStage(stageId, 'approve' \| 'reject')`**，note 沿用现有输入；不做二次确认弹窗 | 不新增审批 API/数据字段；少一次点击层级；打回原因写回阶段 note。 |
| 源码入口层级 | 次级文字/描边按钮：卡片内「查看源码」在弹层 toolbar 右侧与底部；默认永远先渲染 | 需求明确「源码不是默认」；保留开发者与失败场景的退路。 |
| 快速模式口径 | 文案统一为「product/development/testing/acceptance 自动通过；design/approval/release 需 Owner 确认」 | requirements §6.5；避免旧「五个中间阶段」误导。 |

### 16.4 信息架构与线框说明

```
流水线侧栏（360）                        主区（工作台，简化）
┌──────────────────────────────┐        ┌────────────────────────────────┐
│ 流水线 · 第11轮 · ☑快速模式    │        │ 工作台  [第11轮][快速模式][1/7]  │
│ ⚠ 设计稿待你确认 · 确认后进入开发│        │ ┌──── hero（深色）─────────────┐ │
│   第2关 · UI设计 · 3个产物 [通过][打回]│ │ │ UI 设计 · 待评审 · 通过/打回  │ │
│ [评审备注（打回时可选）…]      │        │ └──────────────────────────────┘ │
│ 需求卡（2 行）                 │        │ NOW 需要你决定的事               │
│ ① 需求分析 · 已通过            │        │ ┌ 设计稿 [待你确认] 3 个产物 ──┐ │
│ ② UI 设计 · 待评审             │        │ │ ⚠ 设计稿待你确认 · 确认后进入开发│ │
│   ⚠ 提示条 + 缩略图行          │        │ │ [缩略图][缩略图][HTML ▶]      │ │
│   [预览设计稿][通过][打回]      │        │ │ [预览设计稿][通过][打回][note]│ │
│ ③ 开发实现 · 待开始 🔒(被拦)    │        │ └──────────────────────────────┘ │
└───────────────┬──────────────┘        └────────────────┬───────────────┘
                │ 预览设计稿 / 缩略图                       │ 预览设计稿
                └──────────────────┬─────────────────────┘
                                   ▼
┌──────────── 设计稿预览弹层（role="dialog" aria-modal="true"）────────────┐
│ 设计稿预览 [待评审] · 第11轮 · UI 设计 · 3 个产物            [✕ 44×44]  │
│ ⚠ 设计稿待你确认 · 确认后进入开发      3 个产物 · 图片 2 / HTML 1       │
│ [流水线卡1440][移动端390][高保真稿HTML*]  预览宽度 [360|768|1280] [查看源码]│
│ ┌────────────── 预览画布（#F1F5F9，可横向滚动）──────────────┐          │
│ │   ┌─ 设备框：iframe 渲染（sandbox=""、title 必填）────┐   │          │
│ │   │  design-gate-preview.html · HTML 高保真稿        │   │          │
│ │   └──────────────────────────────────────────────────┘   │          │
│ └──────────────────────────────────────────────────────────┘          │
│ [打回原因（可选）]    通过后进入开发；发布仍保持锁定   [查看源码][打回][确认设计，进入开发]│
│ Esc 关闭 · 关闭后焦点回到触发按钮 · 通过/打回复用 reviewPipelineStage      │
└───────────────────────────────────────────────────────────────────────┘
文件树/标签页 .html/.htm ── 默认预览（iframe 渲染）⇄ 工具栏「预览 / 源码」── 源码编辑
```

**入口关系**：① 流水线设计卡 → D2；② 工作台设计卡 → D2；③ 文件树/标签 `.html/.htm` → D4（与 D2 共用 iframe 渲染与源码退路，但 D4 不进入审批通道）。D1/D3 在非 review 状态退化为普通阶段卡/无设计卡；D2 关闭后回到原视图，不改路由、不加历史记录。

### 16.5 组件清单（D1–D5）

> 全部复用 §5 tokens 与现有 `ds-*` 组件；新增的语义别名只指向现有 alias，不引入新色板。所有「通过 / 打回 / 预览 / 确认」按钮实测高度 **44px（桌面）/ 48px（移动）**。

| # | 组件 | 尺寸 / 间距 | 字号 / 字重 | 颜色 token / 圆角 | 关键状态 |
|---|---|---|---|---|---|
| D1 | 流水线设计卡（review 态） | 卡 344×auto（侧栏 360，内边距 6/7）；header 16×16 序号 + 标题；提示条 332×46；缩略图 104×48，gap 6；按钮 44 高（预览 118 / 通过 56 / 打回 56），gap 6；note 输入 332×32 | 序号 9/700；标题 11/700；角色 9/400；状态 pill 9.5/600；提示条标题 11/700；缩略图标签 8.5；按钮 11/600 | 卡 `--wb-surface` + `--wb-line` + review 时 1.5px `--wb-warn`；提示条 bg `color-mix(warn 12%, surface)`、边 `color-mix(warn 45%, line)`；通过 `--wb-ok`；打回 `--wb-err`；圆角 7（沿用 `.ds-pipe-stage`） | review 才展开；按钮 `disabled` 于 `pipelineBusy`；缩略图 `loading="lazy"`；无产物时显示空态行 |
| D1b | 待确认提示条（可复用） | 332×46（卡内）/ 全宽 32（弹层 header）；图标 16 圆 + 文案两行；内边距 12 | 标题 11–12/700；副文案 9.5–10/400 | `--wb-warn` / `--wb-warn-bg` / `--wb-warn-line`；圆角 8；warn 色**必须**配文字与计数 | 提交中不隐藏；error 时条底加 errorline；非 review 不渲染 |
| D2 | 设计稿预览弹层 | 宽 `min(1240px, 92vw)`，高 `min(840px, 92vh)`；header 104；toolbar 56；canvas 556；footer 84；内边距 24；设备框 768×486（效果图按 0.76 缩放展示 768×640，真实实现 iframe 高 ≥640） | 标题 20/700；副标题 12；tab 12；宽度按钮 11；正文 12；按钮 13/600 | 背板 `color-mix(ink 52%)` + 背景 2.5px 模糊；`--dsw-alias-bg-overlay`；圆角 16；设备框 12；tab 选中 brand 1.4px | 多产物 / 加载中 / 失败 / 空产物 / 打回 note 展开；Esc 关闭；点击背板关闭 |
| D2b | 产物切换 tabs | 高 36（桌面）/ 44（移动），单选；每项 icon 16 + 文案；横向滚动（移动端） | 12/600（选中 700） | 选中：surface + brand 1.4px + brand 文案；未选中：透明 + line；focus 2px brand 环 | 选中态 `aria-selected`；HTML 项带播放/eye 微标；无产物不渲染 |
| D2c | 设备宽度切换 | 容器 32（桌面）/ 44 行高（移动，视觉 32 + 点击区 44）；3 段 360/768/1280；分组圆角 8 | 11/600（选中 700） | 容器 `--wb-surface-2` + `--wb-field-line`（3:1 边界）；选中白底 + line + 轻阴影 | 选中 `aria-pressed`；切换中保留旧帧 + 顶部 2px 进度；加载失败时禁用并有 title |
| D2d | 确认/打回按钮 | 44（桌面）/ 48（移动）；确认 192×44（移动全宽）；打回 64–76×44；间距 8 | 13/600；打回 11.5/600 | 确认 `--wb-brand` 底白字（5.17:1）；打回 surface + `--wb-err` 文字/边（5.91:1）；focus 2px brand 环 | 提交中 loading；`pipelineBusy` disabled；error 行内提示，可重试；不做二次确认 |
| D2e | 预览 iframe / 加载态 | 画布内边距 16；设备框最大宽 100%；iframe 高 ≥640；横向滚动；加载骨架 3 行 | 加载文案 11 | 设备框 surface + line2 + shadow-2；骨架 surface-3；进度环 brand | `loading="lazy"`；错误态错误卡 + 重试 + 查看源码；确认按钮禁用直到可用 |
| D3 | 工作台设计卡（review 态） | 卡全宽 1184×330；header 40；提示条 1144×46；缩略图 4×268×124，gap 12；按钮 44（预览 132 / 通过 76 / 打回 76）；note 340×44 | 卡标题 14/700；提示条标题 12/700；副 10.5；缩略图标签 9–10；按钮 11.5/600 | 卡 `--wb-surface` + `--wb-line` + `--wb-shadow-1`；badge `--wb-warn-fill` + `--wb-warn`；HTML tile brand 1.5px；圆角 14 | 空态「设计阶段尚未提交截图」；通过禁用并给原因；缩略图 hover 边框 brand；`focus-within` 2px 环 |
| D4 | `.html/.htm` 文件预览 | 标签栏 36；编辑器工具栏 44；预览/源码 segments 32；iframe 框全宽、URL 条 34；预览区四周 28；空态/错误卡居中等宽 | 标签 12；工具栏 12；URL 9 mono；正文 12 | 预览底 `--wb-canvas`；设备/框 `--wb-surface` + line2；选中态 brand；错误 `--wb-err` | 默认 preview；空文件「文件为空」；读取失败错误 + 源码退路；SSH 根降级源码并提示；只读预览（保存仍在源码） |
| D5 | 状态 pill / 文案 | 高 18–22；与现有 pill 一致 | 9–10/600 | review=warn、approved=success、failed=error、pending=neutral；**不只靠颜色**（含文字） | 快速模式文案见 16.9；`design-no-image` warning 文案见 16.9 |

### 16.6 八态状态矩阵

> 八态 = default / hover / focus / active / disabled / loading / empty / error；N/A 必须写理由。可交互组件统一 focus = 2px brand 环 + 2px offset；移动端点击区 ≥44×44。

| 组件 | Default | Hover | Focus | Active | Disabled | Loading | Empty | Error |
|---|---|---|---|---|---|---|---|---|
| **D1 待确认提示条** | warn 底 + 1px warn 边 + 图标 + 标题（11/700）+ 计数；`role="status"` | N/A（非交互容器；内部按钮各自 hover） | N/A（容器；内部按钮各自 focus 环） | N/A（容器） | N/A（不由用户禁用；提交中按钮禁用而条保留） | 条保留，按钮文案「处理中…」+ 12px 旋转；条不闪 | 非 review 不渲染（N/A 理由：无待确认语义） | 评审失败：条底 `.ds-errorline` 红字 + 保留通过/打回可重试 |
| **D1 产物缩略图** | 104×48 图 tile + 标签；HTML tile 1.4px brand 边 + eye 徽标 20 | 边 brand 50%，无位移动画 | 2px brand 环 + 2px offset | 按下 opacity .92 | N/A（始终可点；文件不存在时点击进入弹层错误态） | 骨架块 + 极轻 shimmer（reduced-motion 关闭 shimmer） | 无产物：不渲染行，显示「暂无产物」一行 caption | 图加载失败：灰底 + 文件名 + 重试图标；点击仍可失败提示 |
| **D2 设备宽度切换** | 3 段 360/768/1280；选中 768 白底 + 粗体；容器 32/44 | 未选中 hover surface-2 | 2px brand 环 | pressing surface-3 | 预览失败/无 iframe 时禁用，`title` 说明原因 | 切换中保留旧帧 + 顶部 2px 进度条；按钮可继续切 | N/A（默认 1280，始终有选中项） | N/A（切换本身不失败；失败由预览区承接） |
| **D2 确认 / 打回按钮** | 确认 brand 底白字 44；打回描边 err 文字 44；间距 8 | 确认亮度 .94；打回 err 6% 底 | 2px brand 环 + 2px offset（hero 内白/蓝环） | translateY(1px) | `pipelineBusy` 或预览不可用时 opacity .45 + `cursor:not-allowed` + title「当前无法确认」 | 文案「处理中…」+ 12px 旋转，宽度不变，防重复提交 | N/A（始终有文案） | 行内 `.ds-errorline` / toast，按钮尺寸不变，可重试 |
| **D2 预览加载（iframe）** | 白底设备框 + `title`；图片为应用内大图 | N/A（画布容器） | iframe 可聚焦（title 可读）；外层容器 2px brand 环 | N/A | N/A | 骨架 3 行 + 「正在加载设计稿…」+ `aria-live="polite"`；确认禁用 | 无产物：空态「该阶段尚未提交设计产物」+ 说明 | 错误卡「无法加载该设计稿」+ 原因（raw-404/不可读）+ 重试 + 查看源码；不白屏 |
| **D2 产物 tabs** | 3 个 tab 横排；选中白底 brand 边 + brand 文案 | 未选中 hover surface-2 | 2px brand 环 | pressing surface-3 | 只有 1 个产物时仍显示单 tab（无禁用） | 切换时旧内容保留到新内容就绪 | 无产物：不渲染 tabs，显示空态 | 文件缺失：tab 保留，点开进入错误卡 |
| **D3 工作台设计卡** | 卡表面 + line + shadow-1；warn badge「待你确认」+ 4 缩略图 + 预览/通过/打回 44 | 卡 `:hover` 边强；缩略图边 brand | `:focus-within` 2px brand 环 | N/A（卡本身非按钮） | 通过禁用（无截图/加载中）opacity .45；打回仍可用 | 缩略图 3 个骨架；预览按钮 spinner | 「设计阶段尚未提交截图」+「请提交至少一张 PNG/JPG/SVG；HTML 不能替代截图」+ 通过禁用原因 | 行内 errorline + 重试；不隐藏「预览设计稿」（若仍有 HTML） |
| **D4 预览 / 源码切换** | segments 2 项 32（点击区 44），默认 preview；右侧源码次级 | 未选中 hover surface-2 | 2px brand 环 | pressing surface-3 | 文件加载中禁用源码；SSH 根禁用 preview 并 title 说明 | 预览 iframe 骨架；源码沿用现有 loading | 空文件：「文件为空」+ 仍可切源码；不白屏 | 读取失败：错误卡 + 重试 + 「查看源码」退路；预览失败同 D2e |
| **D5 状态 pill / 快速模式提示** | review=warn、approved=success、failed=error、pending=neutral；快速模式提示并列「四个自动 / 三个需确认」 | N/A（只读标签） | N/A（非交互） | N/A | N/A | N/A | 计数 0 显示「0 / 无」，不显示假数据 | N/A |

### 16.7 响应式规格（360 / 768 / 1280）

| 断点 | 弹层 | 产物 tabs / 设备切换 | 预览画布 | 卡片 / 页面 |
|---|---|---|---|---|
| ≥1280（桌面） | 宽 min(1240, 92vw)，高 min(840, 92vh)，居中；背板 52% 深色 + 模糊 | tabs 一行；设备切换单行 360/768/1280（默认 1280）；源码按钮 toolbar 右侧 | 画布内边距 16；768 档居中设备框；1280 档容器内横向滚动；高度 ≥640 | 流水线侧栏 360；工作台设计卡全宽；缩略图 4 列（268）；通过/打回 44 |
| 1024–1279 | 宽 92vw；header 收窄，提示条文案可换行 | tabs 横向滚动；设备切换不换行（360/768/1280 各 32 高） | 画布横向滚动；1280 档显示为可滚动区 | 工作台 2 列；流水线侧栏 320–360；缩略图 2–3 列 |
| 768–1023（平板） | 宽 92vw，高 92vh；header 高度自适应 | tabs 横向滚动；设备切换允许换行（两组）；「查看源码」移到第二行 | 设备框最大宽 100%；左右留白 12；iframe 高度 ≥480 并随视口 | 工作台单列；设计卡缩略图 2 列；按钮 44 |
| ≤700（移动，含 390/360） | **全屏**：100%×100%，圆角 0；header 双行（标题 + 状态）；底部操作区 sticky | tabs 横向滚动，选中项自动滚入；设备切换换行，**视觉 32 + 行高 44**；源码按钮独立行 | 画布占满剩余高度；iframe 最大宽 100%，360 档默认；设备框居中；可纵向滚动 | 设计卡单列；缩略图 2 列（150 最小）；通过/打回/预览/确认 48 高、确认全宽；提示条三行内 |
| 360 极限 | 全屏；标题 16；提示条可换行 2 行；底部确认全宽 48 | 设备切换三档等分一行（各 56 宽）或换行；tabs 可横向滚动 | iframe 宽 100%；设备框无外留白 | 无横向溢出；长文件名 `overflow-wrap:anywhere` + 2 行 clamp |

- 弹层在 ≤700 全屏、`aria-modal="true"` 下禁止背景滚动（`body overflow:hidden` 由现有 modal 机制处理）；关闭后恢复滚动与焦点。
- 所有宽度档位只在「iframe 宽度 + 设备框宽度」上变化，不销毁 iframe、不重复请求；容器 `overflow-x:auto`，移动端 `max-width:100%`。
- 预览画布内的设计稿内容本身不注入主应用；滚动发生在 iframe 内部或画布容器，二者不嵌套争抢滚轮（画布滚动条仅在 1280 档出现）。

### 16.8 可访问性

**语义 / ARIA / 键盘**

- 弹层：`role="dialog"` + `aria-modal="true"` + `aria-labelledby`（标题 id）+ `aria-describedby`（提示条 id）；初始焦点落在标题或关闭按钮；焦点陷阱只在弹层内循环；`Esc` 关闭并把焦点归还到触发按钮（流水线卡「预览设计稿」/工作台卡「预览设计稿」/缩略图）。
- 产物 tabs：`role="tablist"` + `role="tab"` + `aria-selected`；左右方向键切换（可选增强），`Home/End` 到首尾；tab 与 `tabpanel` 用 `aria-controls`/`aria-labelledby` 关联。
- 设备切换：`role="group" aria-label="预览宽度"`；每个按钮 `aria-pressed`；切换后 live region 播报「已切换到 768 宽」。
- 预览 iframe：`title="设计稿预览：design-gate-preview.html"`（必有）；`sandbox=""`；`loading="lazy"`；iframe 内的文档不获得主应用 API/存储。
- 图片：`alt` 用产物 label（缺失时用文件名）；纯装饰图标 `aria-hidden="true"`；缩略图按钮有可读名称「预览设计稿：流水线卡 1440」。
- 状态提示：`role="status"`（review 提示条）、加载/错误 `aria-live="polite"`；错误文案说明「什么错、为什么、怎么修」。
- Tab 顺序 = 阅读顺序：关闭 → 产物 tabs → 宽度切换 → 查看源码 → iframe → 打回原因 → 打回 → 确认设计。流水线卡内：提示条（不可聚焦）→ 缩略图 → 预览设计稿 → 通过 → 打回 → note。
- 焦点可见：2px brand 环 + 2px offset；hero 深色内用 `#93C5FD` 环；`focus-visible` 才显示，鼠标点击不留下环。
- 危险操作：打回与确认之间 8px 间距；打回不紧邻「确认」左侧？设计中打回在确认左侧但用描边红区分；不弹二次确认（需求 §6.3 明确不做）。

**对比度（计算值，sRGB）**

| 前景 / 背景 | 比值 | 用途 |
|---|---|---|
| #0F172A / #FFFFFF | 17.85 | 浅色主文本 |
| #475569 / #FFFFFF | 7.58 | 次要文本 |
| #64748B / #FFFFFF | 4.76 | caption / 辅助 |
| #64748B / #F8FAFC | 4.55 | 页面底 caption（≥4.5） |
| #475569 / #F1F5F9 | 6.92 | 预览画布上的说明（不用 4.34 的 caption） |
| #2563EB / #FFFFFF | 5.17 | 链接 / 主按钮（白字） |
| #92400E / #FFFBEB | 6.84 | 待确认提示条标题 |
| #B45309 / #FFFBEB | 4.84 | 提示条副文案 |
| #B45309 / #FEF3C7 | 4.51 | warn badge 文字（AA 小字） |
| #15803D / #ECFDF5 | 4.76 | 通过/已通过文字 |
| #B91C1C / #FEF2F2 | 5.91 | 打回/错误文字 |
| #FFFFFF / #0B1220 | 18.72 | hero 主文本 |
| #FCD34D / #0B1220 | 12.98 | hero 内待评审 pill |
| #FFFFFF 76% / #0B1220 | 10.94 | hero 次文本 |
| #FFFFFF 56% / #0B1220 | 6.39 | hero 辅助文本 / placeholder |
| #93C5FD / #0B1220 | 10.38 | hero 链接 / focus 环 |
| #7C8A9E / #FFFFFF | 3.51 | 输入框/分段控件边界（非文本 ≥3） |
| #7C8A9E / #F8FAFC | 3.35 | 同上（页面底） |
| #E8EDF5 / #0B0F15 | 16.34 | 深色主题主文本 |
| #8B97A8 / #151B24 | 5.84 | 深色主题 caption |
| #FBBF24 / #151B24 | 10.36 | 深色 warn |
| #60A5FA / #10151D | 7.20 | 深色链接/focus 环 |
| #FFFFFF / #2563EB | 5.17 | 深色主按钮 |

> 大字（30px hero 标题）≥3:1 全部满足；非文本边界使用 `--wb-field-line`（#7C8A9E）保证 ≥3:1；正文不使用 #94A3B8（2.56:1，仅装饰）。r1 中 #94A3B8 辅助文案已判定失败并修正（见 16.10）。

**颜色以外 / 动效 / 触控**

- 状态不只靠颜色：提示条含图标 + 文案 + 「第 N 关 · 阶段 · 产物数」；pill 含文字；空态/错误含标题 + 说明 + 动作。
- 动效：160ms `cubic-bezier(.2,.7,.3,1)`，只动 border-color / background / color / transform(1px)；弹层打开不做全屏缩放动画；`prefers-reduced-motion: reduce` 下 `transition:none`、无 shimmer、无 pulse。
- 触控：确认/打回/预览/源码 44（移动 48）；icon 32 视觉 + 44 点击区；设备段 32 视觉 + 44 行高；缩略图 104×48；移动端 tabs 44。
- 说明：弹层内 iframe 里显示的按钮属于**被预览的设计稿内容**（按 0.76× 缩放的画面），不是本产品控件，不参与 44px 判定；本产品的通过/打回/确认/源码按钮均满足上一条。

### 16.9 文案与 i18n 建议

**D5 文案（必须同批修改，避免旧口径残留）**

- 快速模式提示（zh）：「product/development/testing/acceptance 自动通过；design/approval/release 始终需要 Owner 确认。」
- 快速模式提示（en）：「product/development/testing/acceptance auto-approve on submit; design, approval and release always need the owner's confirmation.」
- 待确认提示：「设计稿待你确认 · 确认后进入开发」；副文案：「通过后开发阶段才能启动；打回后设计变为「已打回」」。
- 空态：「设计阶段尚未提交截图；请 UI 设计师提交至少一张 PNG / JPG / SVG（HTML 不能替代截图）。」
- 无图 warning（Host，`design-no-image`）：「设计阶段未提交可直接查看的截图（PNG/JPG/SVG）；HTML 产物只能预览，不能替代截图。」（`code` 不变，避免破坏断言）
- 设计提示词交付物首条：「至少一张可直接查看的截图（PNG/JPG/SVG，命名为 `<页面>-<状态>-<设备>.<ext>`）；可选可预览 HTML」；`doesNot` 增补「不得只交 HTML 源码而不交截图」。
- Lead 纪律：「设计提交后必须把截图/预览入口给 Owner 看并停下；不得把 HTML 源码贴给 Owner；design 未 approved 前不得启动 development。」

**建议 i18n key（新增，不删旧键）**

| key | zh | en |
|---|---|---|
| `pipeline.designGateBanner` | 设计稿待你确认 · 确认后进入开发 | Design awaiting your approval · confirm to start development |
| `pipeline.designGateHint` | 通过后开发阶段才能启动；打回后设计变为「已打回」。 | Development unlocks after approval; rejecting marks design as failed. |
| `pipeline.previewDesign` | 预览设计稿 | Preview design |
| `pipeline.designArtifactCount` | {n} 个产物 | {n} artifacts |
| `pipeline.designReviewProgress` | 第 {n} 关 · UI 设计 · {count} 个产物 | Stage {n} · UI design · {count} artifacts |
| `workbench.designPending` | 待你确认 | Awaiting your approval |
| `workbench.designPreview` | 预览设计稿 | Preview design |
| `workbench.designEmpty` | 设计阶段尚未提交截图；请 UI 设计师提交至少一张 PNG / JPG / SVG（HTML 不能替代截图）。 | No screenshots yet; the designer must submit at least one PNG/JPG/SVG (HTML cannot replace screenshots). |
| `workbench.designHtmlPreview` | 预览 | Preview |
| `designPreview.title` | 设计稿预览 | Design preview |
| `designPreview.tabImage` | 图片稿 | Image |
| `designPreview.tabHtml` | 高保真稿 · HTML | Hi-fi · HTML |
| `designPreview.width` | 预览宽度 | Preview width |
| `designPreview.viewSource` | 查看源码 | View source |
| `designPreview.confirm` | 确认设计，进入开发 | Approve design & start development |
| `designPreview.reject` | 打回 | Reject |
| `designPreview.rejectReason` | 打回原因（可选）：写清需要修改的地方… | Reason (optional): what should change… |
| `designPreview.loading` | 正在加载设计稿… | Loading design… |
| `designPreview.loadError` | 无法加载该设计稿 | Unable to load this design |
| `designPreview.loadErrorHint` | 文件不存在或不可读；可查看源码或重试。 | File missing or unreadable; view source or retry. |
| `designPreview.retry` | 重试 | Retry |
| `designPreview.empty` | 该阶段尚未提交设计产物 | No design artifacts submitted yet |
| `designPreview.iframeTitle` | 设计稿预览：{name} | Design preview: {name} |
| `designPreview.escHint` | Esc 关闭 · 焦点回到触发按钮 | Esc to close · focus returns to trigger |
| `action.preview` / `action.edit` / `action.source` | 预览 / 源码 / 源码 | Preview / Edit / Source |

### 16.10 自检评分与迭代记录

**迭代第 1 版（r1）渲染 → 检查**

效果图：[design-gate-preview-modal-r1-1440.svg](design/design-gate-preview-modal-r1-1440.svg)（同目录 SVG）。r1 是「先做出来的弹层」：只有一张静态图片、没有产物切换、没有 iframe、没有提示条、设备按钮 24px、确认按钮 32px、辅助文案用 #94A3B8。

r1 五维评分：视觉层级 **4**、清晰度 **3**、一致性 **3**、反馈 **2**、可访问性 **2** → 均分 **2.8**（未达门槛）。must 失败：触控（确认 32 / 设备 24）、对比度（#94A3B8 2.56:1）、关键状态（无加载/失败/空态）、HTML 预览缺失。

| 轮次 | 触发 | 发现（对照标准） | 修正 | 证据 |
|---|---|---|---|---|
| R1 | 渲染 r1 弹层 | ① HTML 产物仍是图片占位「图片预览（HTML 产物暂未渲染）」，无 iframe/产物切换/查看源码 → 不满足 design-preview 核心；② 设备档位 24px、确认 32px → 触控 must 失败；③ 弹层内无「设计稿待你确认 · 确认后进入开发」，Owner 看不到闸门语义；④ 辅助文案 #94A3B8 / #FFFFFF = 2.56:1 → 对比度 must 失败 | 引入 iframe + `sandbox=""` + `title`；顶部产物 tabs；三档 360/768/1280；底部 44px 确认/打回；header 提示条；全部辅助文案改 #64748B（4.76:1）；确认复用 `reviewPipelineStage` | r1 → final 对比；[r1](design/design-gate-preview-modal-r1-1440.svg) / [final](design/design-gate-preview-modal-1440.svg) |
| R2 | 渲染 final 三张（D1/D2/D3） + 移动端 | ① 流水线 todo 副文案与「通过」按钮重叠；hero 右栏 300px 越出内边距，按钮贴到 hero 右缘；② D2 预览内容里 mini hero 的「通过/打回」超出画布右缘；③ D4 无 mockup、工作台卡无空态、状态矩阵需要独立证据；④ 状态板四宫格用绝对坐标导致面板互相覆盖 | 收窄 hero 右栏到 300、内边距 28；mini hero 按钮左移到 916/998；新增 D4 HTML 文件预览图；新增状态板（加载/失败/空/打回）；状态板改 `translate` 局部坐标 | [D1](design/design-gate-pipeline-review-1440.svg) / [D2](design/design-gate-preview-modal-1440.svg) / [D3](design/design-gate-workbench-card-1440.svg) / [D4](design/design-gate-html-file-preview-1440.svg) / [状态板](design/design-gate-preview-states-1440.svg) |
| R3 | 2× 逐张目检 + 对比度复算 | ① 移动端设备档位行被预览画布遮挡（画布从 224 开始覆盖 192 起的设备框）；② 预览画布上 9.5px 说明文字用 #64748B / #F1F5F9 = 4.34:1，低于 4.5；③ 侧栏提示条 44px 按钮挤压文案；④ 深色主题未验证 | 画布下移到 228、设备框 236、内容压到 396 高；画布说明改 #475569（6.92:1）；提示条文案拆行/缩短；补深色片段并实测对比度；全部重渲染 @2× 后逐张 read_image 目检 | [移动端](design/design-gate-mobile-390.svg)、[深色片段](design/design-gate-dark-fragment-900.svg) |

**最终五维评分（附证据）**

| 维度 | 分数 | 证据 | 扣分点 / 说明 |
|---|---|---|---|
| 视觉层级 | **5** | D1/D2/D3 渲染图 | 一屏一个主行动：卡片=预览、弹层=确认；warn 条在最上，缩略图在中，动作在下 |
| 清晰度 | **5** | 文案表 + 状态板 | 「待你确认 · 确认后进入开发」双处同句；空/错/加载都有可读文案与退路 |
| 一致性 | **4** | tokens 表 + 深浅片段 | 复用 `--wb-*` / `--dsw-alias-*`；侧栏沿用现有 8.5–11px 微阶（与 `.ds-pipe-*` 一致），不是 12/14/16 全阶 → 扣 1 分并说明 |
| 反馈 | **5** | 八态矩阵 + 状态板 | loading/error/empty/disabled 齐；确认按钮 loading 防重复；打回 note 保留 |
| 可访问性 | **5** | 对比度表 + 键盘/ARIA 说明 | 正文 4.5+、大字 3+、非文本 3.51；44px；Esc/focus 归还；iframe title |

**均分 4.8 / 5；must 项 0 失败；结论：可提交 Owner 评审。**（自评不替代 Owner 评审与 acceptance 复核。）

**MUST 核对**

| MUST | 结果 |
|---|---|
| 4/8px 间距体系 | ✅ 4/8/12/16/20/24/32；侧栏 6/7 为现有 `.ds-pipe-*` 既有值（与现有面板一致） |
| 字号阶梯 + 行高 ≥1.4 | ✅ 常规 12/14/16/20/30；正文 12–13；侧栏 8.5–11 为现有微阶（明确例外）；行高 1.4–1.55 |
| 颜色 token + 对比度 | ✅ 全部 alias/color-mix；实测表见 16.8 |
| 触控 ≥44×44 | ✅ 通过/打回/预览/确认 44（移动 48）；icon 32 视觉 + 44 点击区；设备段 32 视觉 + 44 行 |
| 八态矩阵 | ✅ 16.6 共 9 行，N/A 均写理由 |
| 响应式 360/768/1280 | ✅ 16.7；360 无横向溢出、弹层全屏 |
| 动效 150–300ms + reduced-motion | ✅ 160ms + 全关降级 |
| 键盘/焦点/ARIA/不只靠颜色 | ✅ 16.8；截图/状态板含文字 |
| 至少一轮渲染→检查→修正 | ✅ R1/R2/R3 + r1 证据 |
| 调研 ≥2 来源 | ✅ 4 个 HTTP 200 来源 + 决策表 |

### 16.11 给开发的组件/状态对照表与插入点

> 行号为 **v1.2.82 基线**（并行会话可能改动 client.js；实现时按符号搜索）。本阶段**未改代码**，以下只是交接建议。

| 设计组件 | 建议实现位置 / 类名 | 状态规则 | Tokens / 要点 |
|---|---|---|---|
| D1 流水线设计卡 review 态 | `client.js` `stageNode()`（约 19758）+ `renderArtifact()`（约 19705）；新类 `.ds-pipe-design-review`、`.ds-pipe-design-shots`、`.ds-pipe-design-actions` | `status==='review'` 才渲染提示条；`pipelineBusy` 禁用按钮；产物最多 20 个（沿用） | `--wb-warn` / `--wb-warn-bg`；按钮 44；缩略图 `loading="lazy"` |
| D1 顶部 todo 提示条 | `client.js` `.ds-pipe-todo`（约 19935）；复用 `pipeline.reviewBanner` 或新增 `pipeline.designGateBanner` | `ownerGateStage` 为 design 时用新文案；通过/打回仍调 `reviewPipelineStage` | 44px 按钮、note 沿用 `pipelineReviewNote` |
| D2 预览弹层 | 新增 `designPreview` state（`{open, artifactPath, device: 1280}`）+ 渲染函数；复用 `.ds-modal-backdrop` / `.ds-modal`（约 26610/26637）；新前缀 `.ds-dp-`（`.ds-dp-head/tabs/device/canvas/actions`） | 由「预览设计稿」/缩略图点击打开；关闭清 state；Esc/背板关闭并还焦点；tabs 只对存在的产物 | `min(1240px,92vw)`、`min(840px,92vh)`；iframe `sandbox=""`、`title`、`loading="lazy"`；设备 360/768/1280；确认 disabled 于加载/失败 |
| D2 缩略图/图片大图 | `renderArtifact` 图片分支 + 工作台 `designShots`（约 17553）；图片查看器复用现有 | `isImagePath` 才走图；HTML 走 D2 预览 | `alt = label`；`loading="lazy"` |
| D3 工作台设计卡 | `client.js` designCard（约 18355）+ `designShots`/`designDocs`（约 18392）；新类 `.ds-wb-design-badge`、`.ds-wb-design-actions`、`.ds-wb-design-empty` | `designStages` 有产物才渲染；`review` 加 badge/预览/通过/打回；无图空态并禁用通过 | `--wb-warn-fill` / `--wb-warn`；HTML 文档按钮改「预览」→ D2 |
| D4 `.html/.htm` 预览 | `modeOf()`（约 2948）增 `'html'`；`openFile()`（约 13867）建 tab 时 `view='preview'`；`isTextMode`（约 2955）纳入 html；工具栏（约 15974）加 `.ds-html-switch`（复用 `.ds-switch`，约 26329） | 默认 preview；切源码可编辑保存；空/错态沿用现有 errorline；SSH 根降级源码 + 提示 | `rawUrl()` 作为 iframe src；`sandbox=""`；`title=tab.name`；预览区 `.ds-html-preview` |
| D5 文案 | `client.js` i18n `pipeline.fastHint`（约 748/1978）与 `workbench.design*`（约 435/1665）；`pipeline.js` `PIPELINE_SECTION`（约 196）、`STAGE_GUIDES.design`（约 1496）、`collectArtifactWarnings`（约 849）、工具描述（约 2360） | zh/en 成对；旧 key 不删；`design-no-image` 的 `code` 不变 | 见 16.9 文案表 |
| 闸门（非 UI，但设计依赖） | `pipeline.js` `submitStage()` `fastApproval`（约 1136–1161）排除 design；`startStage()`（约 1059–1090）提示「请在面板确认设计稿后重试」 | design 提交固定 `review`；未 approved 时 development 抛 `bad-order` | 不新增审批 API/字段；复用 `reviewPipelineStage` |

**给开发的边界**

- 可自由调整：预览画布留白、缩略图比例（保持 >4:3）、tabs 的宽度、错误卡文案细节。
- 不可偏离：`sandbox=""`（不放开脚本）、`title` 必填、确认/打回/预览 ≥44、三档宽度显式标注、源码为次级入口、设计 review 必须有提示条与缩略图、通过/打回只走 `reviewPipelineStage`。
- 防重复：`pipelineBusy` 或本地 `submitting` 时禁用确认/打回，文案「处理中…」；失败后恢复可点并保留 note。
- 错误恢复：预览失败 → 错误卡（原因 + 重试 + 查看源码）；确认失败 → errorline/toast，不丢失 note；打回失败 → 清 busy，可重试。

**给测试的视觉基线**

1. 浅色 1440：对照 [D1](design/design-gate-pipeline-review-1440.svg) / [D2](design/design-gate-preview-modal-1440.svg) / [D3](design/design-gate-workbench-card-1440.svg) / [D4](design/design-gate-html-file-preview-1440.svg) 检查提示条、缩略图、按钮高度、三档切换、源码入口。
2. 关键状态：对照 [状态板](design/design-gate-preview-states-1440.svg) 检查加载/失败/空态/打回 note。
3. 移动 390×844：对照 [移动端](design/design-gate-mobile-390.svg) 检查全屏、tabs 横滚、设备切换换行、底部 48px 操作。
4. 深色：对照 [深色片段](design/design-gate-dark-fragment-900.svg) 检查 warn/success/error 与 focus 环；正文对比 ≥4.5。
5. 键盘：Tab 顺序、Esc 关闭并还焦点、iframe title 可读、图片 alt 存在、`prefers-reduced-motion` 无动画。
6. 三档：360/768/1280 下 iframe 宽度变化、容器横向滚动、无横向溢出；确认/打回 44（移动 48）。

### 16.12 资源清单与渲染环境

| 文件 | 说明 |
|---|---|
| [design-gate-pipeline-review-1440.svg](design/design-gate-pipeline-review-1440.svg) | D1 流水线设计卡 review 态，1440×1024 浅色，全页（侧栏 360 + 工作台简化） |
| [design-gate-preview-modal-1440.svg](design/design-gate-preview-modal-1440.svg) | D2 设计稿预览弹层（HTML iframe + 三档 + 确认/打回 + 查看源码） |
| [design-gate-workbench-card-1440.svg](design/design-gate-workbench-card-1440.svg) | D3 工作台设计卡待确认态（4 产物 + 预览/通过/打回 + 说明） |
| [design-gate-html-file-preview-1440.svg](design/design-gate-html-file-preview-1440.svg) | D4 工作区 `.html` 默认预览 + 工具栏「预览 / 源码」 |
| [design-gate-mobile-390.svg](design/design-gate-mobile-390.svg) | D2 移动端 390×844 全屏弹层（tabs 横滚、设备切换、48px 底部操作） |
| [design-gate-preview-states-1440.svg](design/design-gate-preview-states-1440.svg) | 关键状态板：加载中 / 加载失败 / 工作台空态 / 打回说明 |
| [design-gate-dark-fragment-900.svg](design/design-gate-dark-fragment-900.svg) | 深色主题片段（D1 卡 + D2 弹层 + 对比度实测） |
| [design-gate-preview-modal-r1-1440.svg](design/design-gate-preview-modal-r1-1440.svg) | r1 迭代证据（final 对照） |
| [gen-design-gate-mockups.mjs](design/gen-design-gate-mockups.mjs) | 生成器（纯 SVG 字符串，无外部依赖）；`OUT=<dir> node gen-design-gate-mockups.mjs` |

> PNG 渲染导出不入库（`.gitignore` 已忽略 `docs/pipeline/design/*.png`）；仓库只保留 SVG 源，需要位图时按下方命令重建。

> D4 的空文件 / 读取失败分支不另出图：视觉沿用现有编辑器 `.ds-empty` / `.ds-errorline` 与 §16.6 矩阵（避免与既有空/错误态重复）；D4 主图覆盖默认「预览」与工具栏「预览 / 源码」切换入口。

**渲染环境**：字体 Noto Sans SC 400/600/700（复制到 `/tmp/fonts` + fontconfig）；sharp `density:144` → 逻辑 1440×1024 输出 2880×2048（@2×）；移动端 390×844 → 780×1688。全部 SVG 内字体栈 `Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif`。已逐张 `read_image` 目检：中文无豆腐块、无文字溢出/重叠；r1/final 对照见 16.10。

### 16.13 风险与未决

| 风险 | 影响 | 处理 |
|---|---|---|
| iframe 直接指向 raw URL：跨域/鉴权/SSH 根不可用 | 预览失败 | 本地根优先；失败显示错误卡 + 查看源码；SSH 根降级源码并提示，不扩大 SSH 能力边界 |
| `sandbox=""` 下依赖脚本的交互稿视觉缺失 | 高保真稿不完整 | 静态视觉为准；如需交互，后续放开 `allow-scripts`（禁止同开 `allow-same-origin`）并标注「脚本受限」 |
| 1280 档在 1240px 弹层内需横向滚动 | Owner 可能觉得不便 | 默认 1280 但容器内滚动；若 Owner 反馈，后续加「适应窗口」开关（本轮不做） |
| 两处入口（流水线 + 工作台）重复 | 视觉噪音 | 同一 i18n 键/状态；流水线是强提示，工作台是首屏入口；Owner 复查后可只保留一处强提示（创新假设 3） |
| 侧栏 8.5–11px 微阶与 12/14/16 全阶不完全一致 | 字号阶梯审查扣分 | 明确例外：沿用现有 `.ds-pipe-*` 面板（9–10.5px 实际值）；新增提示 10–11；工作台/弹层用 12–20 |
| 设计稿无截图时仍可打回但不可通过 | 流程卡住 | 空态显示「请提交至少一张 PNG/JPG/SVG」+ 通过禁用原因；Lead 纪律 + `design-no-image` warning 双保险 |
| 并行会话改动 client.js 导致插入行号漂移 | 交接误差 | 以符号/类名搜索为准；本设计只给建议，不修改代码 |

**未决问题（不阻塞本轮设计，交 Owner/Lead）**

1. 交互型高保真稿是否需要 `allow-scripts`？默认不允许。
2. 三档是否足够？若 Owner 需要 1024 档，宽度常量集中定义，后续加一档即可。
3. 是否需要「设计稿版本对比」？本轮不做，记为后续需求。
4. 深色主题下 HTML 稿自身可能是浅色 → 预览画布保持中性浅底，不强制反转设计稿。
