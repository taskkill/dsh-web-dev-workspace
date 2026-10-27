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

## 17. v1.2.84 验收台分区可收起（第 12 轮）

> 角色：UI 设计师｜上游：[requirements.md](requirements.md)（第 12 轮，§3 范围 / §6 行为规格 / §7 验收 10 条）｜下游：全栈开发（`client.js` `renderAcceptancePanel` + `ds-acc-*` CSS + zh/en i18n + localStorage）→ QA → 验收复核。
> 结论先行：验收台拆成 **「主内容清单 + 三个可折叠次要区块 + 可折叠分组 + 可收起详情」** 四层信息结构。证据库 / 复测中心 / 交付与预览分享**默认收起**，区块头 = 标题 + 摘要徽标 + 箭头，整行一个 `button`（无嵌套按钮）；工具区只放**一个动态文案**的「全部收起 ⇄ 全部展开」；复测中心**去掉内层开关、扁平化为一层**；分组头改为 `button` 并持久化；详情头带状态徽标与选中标题、收起后保留选中高亮。间距回到 4/8px 体系，正文对比度 ≥4.5:1（浅色 5.80:1 / 深色 9.90:1），折叠头的 `aria-expanded` / `aria-controls` / `hidden` / 键盘 / 焦点全部按 W3C APG 契约。本阶段只交设计与设计稿，**未改任何产品代码**。
> 效果图（SVG 源入库；PNG 由 sharp 2× 渲染，`.gitignore` 已忽略）：[默认态 360](design/acceptance-collapse-default-360.svg) / [三区块展开 360](design/acceptance-collapse-expanded-360.svg) / [全部收起 360](design/acceptance-collapse-all-collapsed-360.svg) / [详情展开 360](design/acceptance-collapse-detail-360.svg) / [691px](design/acceptance-collapse-691.svg) / [深色片段 900](design/acceptance-collapse-dark-900.svg) / 迭代证据：[R1 默认](design/acceptance-collapse-default-r1-360.svg) / [R1 展开](design/acceptance-collapse-expanded-r1-360.svg)。

### 17.1 目标与设计原则

本轮不是「加功能」，而是**把已有内容重新分层**：验收项清单 + 状态计数是每天要看的主内容，证据库 / 复测中心 / 交付与预览分享是低频工具。需求 §1 的根因判断是「同一层竖向流 + 低频块固定占位」，所以设计只做三件事——**分层、默认收起、一键复原**，不改任何既有操作。

1. **主内容常显**：清单默认展开、吃掉剩余高度并独立滚动；三区块收在清单下方，只露 44px 区块头。主内容永远不进折叠（GOV.UK 明确「所有用户都要看的内容不要放进手风琴」）。
2. **一层只做一件事**：区块头只负责「展开/收起」，操作按钮（添加证据、复测运行、打包、分享、下载）全部留在展开后的内容区顶部；**不嵌套手风琴**，因此复测中心原有的内层「复测」开关被去掉。
3. **一键复原、随时可比**：允许三区块同时展开（不互斥），并提供「全部收起 ⇄ 全部展开」；默认值可被用户一键翻面，刷新后保持。
4. **键盘与视觉同步**：每个折叠头都是真 `button`，`aria-expanded` 与箭头方向、内容显隐三者永远一致；收起内容 `hidden`，不进 Tab。
5. **窄侧栏优先**：先在 360px 把「标题 + 徽标 + 箭头」跑通，再向上适配 691 / 768 / 537（1280 视口下的面板宽）与 1440；不出现横向滚动。

**验收项 → 设计落点映射**（验收项按 requirements §8 编号；本会话无工作区绑定，`acceptance_list` 不可用，故用编号 + category 对应）

| # | 验收项（category） | 设计落点 |
|---|---|---|
| 1 | 三区块默认收起、点头部展开、头部含徽标与箭头（acceptance-collapse） | 17.3 D1/D6、17.5 A1/A2、17.7、[default-360](design/acceptance-collapse-default-360.svg) |
| 2 | 折叠状态持久化 + 损坏回退（acceptance-collapse） | 17.4 存储模型、17.5 A1 状态、17.12 给开发 `readCollapseState()/writeCollapseState()` |
| 3 | 全部收起 / 全部展开作用于区块 + 分组 + 详情（acceptance-collapse） | 17.3 D3、17.5 A3、[all-collapsed-360](design/acceptance-collapse-all-collapsed-360.svg) |
| 4 | 清单占满剩余高度；详情可展开/收起/取消选中（acceptance-collapse） | 17.3 D4、17.4 高度预算、[detail-360](design/acceptance-collapse-detail-360.svg) |
| 5 | 分组头可折叠 + 数量徽标 + 不影响勾选批量（acceptance-collapse） | 17.3 D5、17.5 A5、17.7 分组头 |
| 6 | button + aria-expanded/aria-controls + Enter/Space + 焦点 + hidden 不进 Tab（acceptance-a11y） | 17.9 契约、17.7 focus 列 |
| 7 | 360 / 691 无横向溢出，浅深主题可读（acceptance-layout） | 17.8、17.6 对比度表、[691](design/acceptance-collapse-691.svg) / [dark-900](design/acceptance-collapse-dark-900.svg) |
| 8 | 中英文文案齐全、无硬编码（acceptance-i18n） | 17.10 i18n 键表（zh/en 成对） |
| 9 | 既有操作不回归（acceptance-regression） | 17.3 D2 对 `verificationOpen` 的处理、17.12 「不可偏离」清单 |
| 10 | 版本与文档 1.2.84 / 只改允许文件（version-docs） | 本文件 §17 + 17.12 交付边界（设计与实现都不碰 Host/数据/依赖） |

### 17.2 调研与借鉴

> 调研时间 **2026-10-27**（Asia/Shanghai）。本轮用 `web_search` 定位、`web_fetch` 读取正文并逐条核对可引用结论；下表 6 个来源当日均返回 **HTTP 200 且有正文**，**无 blocked**。只借鉴信息结构、交互与可访问性契约，不复制受版权保护的文案/素材/整段源码。

#### 17.2.1 来源表

| # | 来源 | URL | 访问日期 | 类型 | 关键结论（对本设计的直接落点） |
|---|---|---|---|---|---|
| 1 | W3C WAI-ARIA APG · Accordion Example | https://www.w3.org/WAI/ARIA/apg/patterns/accordion/examples/accordion/ | 2026-10-27 | 标准（W3C APG） | 手风琴头是 heading 内的 `button`，由它控制面板显隐；`aria-expanded` 展开 `true` / 收起 `false`；`aria-controls="ID"` 指向面板；键盘只有 Enter / Space 两条要求，切换后焦点留在按钮；面板可用 `region` + `aria-labelledby` 关联头部。→ 三个区块头、分组头、详情头统一 `button` + `aria-expanded` + `aria-controls`；不加 `role="tablist"`。 |
| 2 | W3C WAI-ARIA APG · Disclosure (Show/Hide) Pattern | https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/ | 2026-10-27 | 标准（W3C APG） | disclosure = 一个 disclosure button + 受控内容区；按钮带 `aria-expanded`，`aria-controls` 可选但推荐；键盘只有 Enter / Space；箭头方向用于提示「展开后会出现内容」。→ 单块开合用 disclosure 语义即可，不需要手风琴角色；三块可独立开合（非互斥）。 |
| 3 | GOV.UK Design System · Accordion | https://design-system.service.gov.uk/components/accordion/ | 2026-10-27 | 设计系统（政府公共服务） | 手风琴通常**所有区块初始隐藏**；标题按钮 = 标题 + 摘要行（可选，但**必须尽量短**）+ 显示/隐藏动作，屏幕阅读器读成一句；持久展开状态需要**稳定唯一 id**；**不要嵌套手风琴**；**不要把所有用户都需要看的内容放进手风琴**；内容多时先考虑拆分/精简而不是折叠。→ 只用徽标做短摘要；清单不折叠；复测中心去内层开关；稳定 id + 稳定存储 key。 |
| 4 | Nielsen Norman Group · Progressive Disclosure | https://www.nngroup.com/articles/progressive-disclosure/ | 2026-10-27 | UX 研究（行业权威） | 初始只显示最重要的少量选项，次要功能按需展开；必须做对两件事：① 初始/二级的切分正确（高频留首屏）② 从一级到二级的路径明显；**超过 2 层披露可用性急剧下降**。→ 验收台最多两层：区块层（证据/复测/交付/详情）+ 分组层；分组层内不再折叠；初始只露区块头，点击路径是整行按钮。 |
| 5 | MDN · `hidden` HTML global attribute | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/hidden | 2026-10-27 | Web 标准 | `hidden` 表示内容不应被呈现；浏览器通常用 `display:none` 实现，元素不参与布局；`hidden` 对**所有呈现**生效（含读屏）；隐藏元素里的脚本仍会执行、表单仍可提交；`hidden="until-found"` 是另一种「可被页内查找发现」的状态。→ 收起内容用 `hidden`（保留 DOM 挂载，不丢端口输入/命令勾选/备注草稿），并且会自然退出 Tab 顺序；不使用 `visibility`/`height:0` 之类「仍可聚焦」的隐藏。 |
| 6 | W3C WAI · Understanding SC 1.4.11 Non-text Contrast | https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html | 2026-10-27 | 标准（WCAG 2.2 AA 解释文档） | 用于识别控件与**状态**的视觉信息需 ≥3:1；如果控件已有可见文本能识别，不强制画边界；**聚焦指示器必须与相邻背景 ≥3:1**；作者无力控制抗锯齿时，细线/浅色更危险，应留余量。→ 箭头、焦点环用 `label-secondary`/`brand`（浅色 5.80 / 18.90，深色 9.90 / 14.27）；徽标文字按文本 4.5:1 处理，不用 `label-caption`（浅色仅 2.13:1）。 |

#### 17.2.2 借鉴决策表

| 借鉴点 | 来源 | 采用 / 调整 / 不采用 | 理由与落点 |
|---|---|---|---|
| 折叠头是 `button` + `aria-expanded` + `aria-controls`，内容容器有稳定 id | #1 #2 | **采用** | 三区块头、分组头、详情头统一；`aria-controls` 指向 `hidden` 容器（17.9） |
| Enter / Space 切换，焦点留在按钮 | #1 #2 | **采用** | 不发明快捷键；Tab 顺序 = 阅读顺序 |
| 区块头文本 = 标题 + 短摘要，读屏读成一句 | #3 | **调整采用** | 摘要压成**数量徽标**（证据 n / 最近 pass·fail / 分享 n·交付 n），既满足摘要作用又不撑破 360（17.3 D6） |
| 次要内容默认收起、高频内容常显 | #3 #4 | **采用** | 三区块默认收起；清单/计数/筛选常显（验收项 1、4） |
| 多个区块允许同时展开，不做互斥自动关闭 | #4 #1（反向） | **采用** | 「全部展开」需要同时可见；`<details name>` 式互斥不采用（验收项 3） |
| 不嵌套手风琴 / 不超过两层披露 | #3 #4 | **采用** | 复测中心内层 `verificationOpen` 开关删除（17.3 D2）；分组层内不再折叠 |
| 持久化需要稳定 id / key | #3 | **采用** | 单键 JSON + 分类原值作分组 key（17.3 D5） |
| 收起内容用 `hidden`，保留挂载 | #5 | **采用** | 不丢端口输入/命令勾选/备注草稿；不触发额外请求 |
| 允许同时展开 → 折叠头用 heading 包裹 | #1 | **不采用** | 侧栏工具面板不是文档大纲；`button` 具名 + `aria-controls` 已足够，不额外加 h2/h3 与 `region`（避免与侧栏既有 landmark 冲突） |
| 折叠高度动画 | — | **不采用** | requirements §3.2 明确不做高度动画；只做 150ms 颜色/图标切换，`prefers-reduced-motion` 下全关 |
| 原生 `<details>/<summary>` | #5 关联 | **不采用** | 受控 React 渲染 + 需要持久化与既有 `aria-expanded` 真值断言；`<summary>` 内放徽标与嵌套按钮的浏览器行为不一致 |
| 折叠头加「显示/隐藏」隐藏文案（GOV.UK 做法） | #3 | **不采用（用 aria-expanded 代替）** | APG 模式下 `aria-expanded` 会被读屏播报「已展开/已收起」；额外隐藏文案会与徽标文本重复。若读屏抽查发现播报不清，再补 `acceptance.toggleShow/Hide`（记为后续微调，不阻塞） |
| 徽标用 `label-caption`（现有 `.ds-acc-cat` 风格） | #6（反向） | **不采用** | `--dsw-alias-label-caption` 浅色 #ADB2B8 / 白 = **2.13:1**，做 9.5px 文字必失败；改用 `label-secondary`（5.80:1），徽标底色用 brand/ink 6% 叠加 |

#### 17.2.3 已验证模式 vs 创新假设

**已验证模式（有来源）**

1. disclosure 的 ARIA/键盘契约（#1、#2）→ 三区块头 + 详情头 + 分组头。
2. 初始只显示高频内容、低频内容按需展开，且不超过 2 层（#3、#4）→ 清单常显 + 三区块默认收起 + 分组层。
3. 允许多块同时展开、避免互斥（#4）→ 三块独立开合 + 「全部展开」。
4. 默认收起是常见默认值（#3）→ 三区块默认 `false`。
5. `hidden` 的语义与副作用（#5）→ 收起保留挂载、退出 Tab、无额外请求。
6. 非文本/聚焦对比 ≥3:1、文本 ≥4.5:1（#6）→ 箭头/焦点环/徽标取值与实测表。

**创新假设（需验证，写验证方式与失败预案）**

| # | 假设 | 验证方式 | 失败预案 |
|---|---|---|---|
| 1 | 区块头只做 disclosure（操作按钮内移）不会让 Owner 找不到「添加证据/复测/打包」 | 360 默认态 + 展开态对照；Owner 按 `docs/ACCEPTANCE.md` 批次 22 复测 | 展开体顶行固定放主操作（本设计已如此）；若仍难找，给「证据库」区块头加 +N 快捷图标（下轮） |
| 2 | 数量徽标足以替代 GOV.UK 式整句摘要 | 360 / 691 渲染 + 徽标 96px 上限实测 | 徽标只留数字，完整文本进 `title`；或徽标移到第二行（会增高区块头，不优） |
| 3 | 单按钮动态文案（全部收起 ⇄ 全部展开）比两个按钮更省认知 | 360 工具区实测 + Owner 复测 | 改回两个按钮并把当前位置改成「全部收起/全部展开」并列（仍在同一位置，不新增行） |
| 4 | 详情可收起不会被误认为「选中丢了」 | 收起态截图 + 清单行高亮对照 | 详情头保留「详情已收起 · 选中保留」文案（已做）+ 选中行 2px 左条 |
| 5 | 691 与 360 之间不需要额外断点 | 360 / 691 / 768 / 537 四档渲染 | 若 480–560 出现徽标挤压，按「面板宽 <420 → 1 徽标 + `+n`」规则兜底 |

#### 17.2.4 抓取受限 / 无网络说明

- 无。上表 6 个来源当日均 HTTP 200 且读取到正文（其中 GOV.UK 页面正文在「summary line」段落后被截断，但「不要嵌套手风琴 / 不要把所有用户都要看的内容放进手风琴 / 稳定 id / 摘要必须短」四条结论均在被读取到的正文内，未引用截断之后的段落）。
- 未引用 product 阶段 §5.4 中抓取失败的来源（Ant Design Collapse、Material 3 Expansion panels 等），也未据此编造任何结论；本设计对它们的判断不构成依据。
- 本轮不需要外部服务/无头浏览器截图，无能力型 blocked。

### 17.3 设计决策（6 项必须拍板 + 2 项补强）

#### D1 区块头结构：单一全宽 `button`，操作按钮移入展开体

**结论**：三个区块头 = 一个占满整行的 `<button type="button">`，内部只有「标题（12/600）+ 摘要徽标（≤2 个，9.5/600）+ 箭头（12，`aria-hidden`）」。**头部内不出现任何其它按钮**。「添加截图 / 证据」「运行复测」「打包交付 / 导出报告 / 下载构建产物」「创建分享链接 / 复制 / 打开 / 关闭」全部保留在展开后的内容区顶部，沿用既有按钮与既有 handler。

**理由**：① 头部一旦放按钮就变成「button 套 button」，HTML 不允许、读屏与点击语义都会坏（需 `stopPropagation` 打补丁）；② 双层开关（头部 + 内层「复测」）正是 GOV.UK 明确反对的嵌套手风琴；③ 收起态只需要「标题 + 数量」告知有什么，不需要操作入口；④ 收起态仍可操作会与「整行点击切换」抢点击。

**否决的备选**：头部右侧放 icon 按钮（☰ / +）。理由：44px 头部里塞 3 个 24px 图标后，360px 下标题只剩 ~120px；且 `aria-expanded` 的按钮内含其它可聚焦元素会被读屏读成复合控件。

**对既有实现的影响**：`renderAcceptancePanel()` 里证据块的 `.ds-acc-evidence-head`（17564 起）、复测块的 `.ds-acc-evidence-head` 复用（17626 起）、交付块不再渲染标题行，改为统一 `blockHead()`；三块内容整体包进 `<div id="ds-acc-<block>-body" hidden>`。

#### D2 复测中心双层开关：扁平化（去掉内层「复测」按钮）

**结论**：**删除内层开关**。复测区块展开后直接显示：最近一次复测摘要（时间 + `pass 通过 / fail 失败` + 失败时「把失败发给 agent」）→ 命令选择列表（checkbox）→ `[运行复测]` 主按钮 + 「重新检测命令」。区块头是唯一开关。

**对既有状态的处理（明确交接）**：
- 删除 `verificationOpen` state（`client.js` 约 **8533**）与内层切换按钮 `.ds-acc-verify-toggle`（约 **17639–17654**）、以及条件渲染包装 `verificationOpen ? … : null`（约 17679）。
- 把内层开关里「展开时若未选命令则自动预选前 3 个 test/build/lint 建议」的逻辑**搬到 verify 区块头的切换函数**（`toggleBlock('verify')` 展开分支执行一次）；其余逻辑不动。
- 不复用、不迁移该状态：它是会话内 state、无持久化，刷新即回默认；新状态 `blocks.verify` 有持久化（默认 `false`）。
- 视觉上只有一个开关，`verificationOpen` 不再出现在 DOM；`acceptance.retest`（复测）文案继续用于**运行按钮**，不作为开关文案。
- **兼容退路**（若开发坚持最小 diff）：允许保留 `verificationOpen` 变量但恒为 `true`（区块展开即是命令区），**不得渲染第二个可见开关**；验收项 1/6 只检查可观察结果与 DOM 中折叠头数量。

**理由**：一个内容块只应有一个开合入口（APG disclosure 的最小模型）；双层开关会让「点开区块还要再点一次才看到命令」，且默认收起状态下用户看到的是「复测」二字而不知道区块已展开。

#### D3 「全部收起 / 全部展开」：单按钮动态文案，刷新右侧，无 disabled

**结论**：工具区 `[刷新] [⟰ 全部收起]` —— **一个按钮、动态文案**，位置在刷新按钮右侧，间距 8px，`ds-linkbtn` 级视觉（无边框、10.5/600、`label-secondary`），左侧带双箭头图标（全部收起 = 双上箭头，全部展开 = 双下箭头）。

- 文案判定：`anyOpen = blocks.evidence || blocks.verify || blocks.delivery || detailOpen || 任一已展开分组` → `anyOpen ? 全部收起 : 全部展开`。
- 点击行为：`anyOpen` 为真 → 三区块收起 + 全部分组收起 + 详情收起（**不取消选中**）；否则反之（三区块展开 + 全部分组展开 + 详情展开，若有选中）。
- **不做 disabled**：按钮永远可执行且结果幂等（重复点同一态 → 状态不变、只写一次存储）；理由：动态文案已经把「下一步会发生什么」表达清楚，加 disabled 会出现「按钮灰着但用户想要复原」的死路。requirement §6.3 允许「始终可用但幂等」。
- `title` / `aria-label` 说明作用域：「收起三个分区、所有分类分组与详情」/「展开三个分区、所有分类分组与详情」；避免首次进入时（分组默认展开、三区块已收起）按钮显示「全部收起」造成的困惑——它确实会收起分组与详情。
- 不改变清单的展开状态（清单不是可折叠区块）。

**否决的备选**：两个并列按钮（全部收起 / 全部展开）——占用 2 个点击位、在同一时刻总有一个是无效动作，且 360 工具区会挤占「保存中…」提示位；本设计在 R1 里画过（见 17.11），评审后合并。

#### D4 详情区头部：状态徽标 + 选中标题 + 收起反馈

**结论**：详情块（有选中才渲染）头部 = 48px 的整行 `button`：

```
[通过] 证据库、复测中心、交付与预览分享默认收起，点区块头展开     ⌃
详情已收起 · 选中保留，点此展开                               (仅收起态，9px)
```

- 左起：状态徽标（16 高，`通过/不通过/阻塞/待验收` 四色语义底色 + 同色系深色文字）→ 选中项标题（12/600，**展开态最多 2 行**、**收起态 1 行**，超出省略，完整文本进 `title`）→ 右侧箭头（展开 ⌃ / 收起 ⌄）。
- 收起态额外一行 9px `label-secondary` 文案「详情已收起 · 选中保留，点此展开」，直接消除「选中丢了」的误判；同时清单里该行保持 **brand 8% 底 + 2px 左指示条**。
- 取消选中（现有「取消」按钮，约 17517）→ 详情整块消失；**选中另一项 → 自动重新展开**（避免「点了没反应」）；手动收起后再次点同一行 → 保持收起（点同一项不强制弹回，减少抖动）——两种行为都可观察，验收项 4 覆盖「选中另一项重新展开」。
- 不新增详情持久化键：`detailOpen` 随会话，有选中时默认展开，刷新后按现状不记忆选中项（requirements §3.2）。

#### D5 分组折叠：`button` + 数量徽标 + 以分类原值持久化

**结论**：分组头从 `div` 改为 `<button type="button" class="ds-acc-group-head" aria-expanded aria-controls>`，高度 28，左侧分类名（9.5/600，`label-secondary`，不用 `label-caption` 以免 3.71:1 不达标）+ 数量徽标（9/600，14 高，`badgeBg`）+ 右侧 12px 箭头。

- 持久化 key：**数据里的分类原值**（如 `验收 · 折叠与持久化`、英文界面下仍是该数据值），空/缺失统一 `__uncat__`；不用显示语言派生，避免切 zh/en 后状态丢失。
- DOM id：`ds-acc-group-body-<index>`（index = 当前筛选结果里的分组序号，保证唯一且当次渲染稳定）；筛选改变时 id 会随渲染重排，但 `aria-controls` 永远指向当前 body，功能不受影响。
- 新分类出现默认展开；分类消失不清理旧 key（无害，体积可控）。
- 折叠只影响该组条目显隐：全选/批量/状态/删除/筛选逻辑一行不改（全选仍按筛选结果，包含被收起分组中的项）。

#### D6 徽标截断规则（360 优先）

**结论**：徽标 = 16 高、`border-radius: 8`、左右 padding 5、字号 9.5/600、**单行不换行**；**最多 2 个**；每个 `max-width: 96px`，超出 `text-overflow: ellipsis`（完整文本进 `title`）；第 3 个及以后合并成 `+n`（`title` 列出被折叠项）；`+n` 自身不省略。

- 优先级：`状态/结果` > `一级计数` > `二级计数`。例如交付区块 = `3 个分享` + `5 个交付`；若再加「交付包已生成」就变成 `3 个分享` + `+2`。
- 布局让位顺序：标题 `flex: 1 1 auto; min-width: 0`（先省略）→ 徽标 `flex: 0 0 auto` 但 `max-width: 96px`（再省略自身文本）→ 箭头 `flex: 0 0 auto` 永不压缩。
- **面板宽 < 420px** 时降为「1 个徽标 + `+n`」；≥420px 显示 2 个完整；691 / 768 / 1440 不触发省略。
- 数值口径：证据徽标 = `evidenceFiles.length`；复测徽标 = 最近一次 verification 的 `passed/failed`（无记录 → `无记录`）；交付徽标 = `previewShares.length` / `deliveryHistory.length`（为 0 时只显示另一项；都为 0 → `无分享 · 无交付`）。

#### D7 内容高度预算与滚动（补强，防止「清单被压没」）

- 清单：`.ds-acc-list { flex: 1 1 auto; min-height: 96px; overflow: auto }`（现有 `flex:1 1 auto; min-height:0` 基础上把 `min-height` 提到 96px）。
- 区块体：`.ds-acc-block-body { flex: 0 0 auto; overflow: auto }`，max-height 分别为 **证据库 260 / 复测中心 240 / 交付与预览分享 340**；三块同时展开时超出部分在区块体内滚动，不把面板整体撑长、不把清单压到 0。
- 三块收起时（默认态）面板高度 = 工具区 + 清单（弹性）+ 3×44 区块头；360×900 实测清单拿到约 430px。

#### D8 颜色与对比度修正（补强，直接影响 must）

- 新增/改造文字**不用** `--dsw-alias-label-caption`（浅色 2.13:1、深色 4.02:1 均不达 4.5:1），次级文字统一 `--dsw-alias-label-secondary`（5.80 / 9.90）；`label-caption` 只留给装饰性分隔与占位。
- 行标题保留「状态着色」语义（`data-status`），但把原 `state-success-primary`(#22C55E)/`state-error-primary`(#EC1313) 换成 **与 `label-primary` 混色后的深色版**（浅色 #19743D 5.82 / #891214 9.72），否则 2.28:1 不达 AA。
- 徽标底色 = 语义色 12% 叠加 + 文字 = 语义色 55% 与 `label-primary` 混合（浅色 5.04–8.00，深色 4.55–7.88 全部 ≥4.5）。
- 焦点环：`outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px`（整行按钮用**内缩 2px**，避免被面板 `overflow:hidden` 裁掉）；浅色 18.90:1、深色 14.27:1。

### 17.4 信息架构与关键流程

**层级（不新增导航，全部在 `paneView='acceptance'` 内）**

```
验收台面板（.ds-side-view.ds-acceptance-view）
├─ 工具区        [刷新] [⟰ 全部收起/全部展开]                    （常显）
├─ 提示 + 计数 + 添加 + 筛选 + 模板                              （常显，既有）
├─ 验收项清单（主内容，flex:1，min-height:96，独立滚动）          （常显）
│   ├─ 分组头 button（分类名 + 数量 + 箭头）                      （可折叠，默认展开，持久化）
│   └─ 验收项行（勾选 / 标题 / 状态按钮 / 删除；选中高亮）
├─ 详情块 button 头 + 详情体                                     （有选中即出现；可收起）
├─ 证据库   区块头(44) / 区块体(≤260 滚动)                       （默认收起，持久化）
├─ 复测中心 区块头(44) / 区块体(≤240 滚动)                       （默认收起，持久化；扁平化）
└─ 交付与预览分享 区块头(44) / 区块体(≤340 滚动)                  （默认收起，持久化）
```

**存储模型（localStorage 单键）**

```json
{
  "blocks": { "evidence": false, "verify": false, "delivery": false },
  "groups": { "验收 · 折叠与持久化": true, "__uncat__": true }
}
```

- 键：`dsh-web-filebrowser:acceptance-collapse`（与现有 `dsh-web-filebrowser:*` 命名一致）。
- 读取：面板首次渲染读一次；`JSON.parse` + 类型校验（`blocks` 必须是对象、值必须是 boolean；`groups` 必须是对象），任一不符 → **整份回退默认**（三块收起、分组展开、详情展开），不抛错、不写坏值。
- 写入：任一区块/分组切换、「全部收起/展开」后立即写；`setItem` 包 try/catch，失败（隐私模式/配额）→ 静默降级为内存态，UI 不报错。
- `detailOpen` **不写入**（随选中状态；不持久化选中项）。

**关键流程**

1. **打开面板**：读偏好 → 缺省 `evidence/verify/delivery=false`、分组全 `true` → 渲染；清单占满剩余高度。
2. **展开证据库**：点区块头任意位置（或 Tab 到该头按 Enter/Space）→ `aria-expanded=true` + 移除 body `hidden` + 箭头变 ⌃ + 写存储；内容区顶行即「添加截图 / 证据」。
3. **全部收起**：`anyOpen` 为真时点工具区按钮 → 三区块 + 全部分组 + 详情收起、选中保留 → 文案变「全部展开」→ 写存储。
4. **选中验收项**：详情块出现（头 + 体展开）；再点详情头 → 收起（保留选中 + 头文案）；再点清单另一项 → 详情重新展开。
5. **折叠分组**：点分组头 → 组内条目 `hidden`；行内状态/勾选/删除不受影响；刷新后组仍收起。
6. **异常**：存储损坏 → 回退默认并覆盖写新值；数据接口失败 → 既有 `.ds-errorline` + 刷新按钮重试，折叠功能仍可用（纯本地状态）。

**空/加载/错误态在区块层的表现**：证据 0 条 → 徽标 `0 条证据`，展开体显示既有 `acceptance.evidenceEmpty`；复测无记录 → 徽标 `无记录`，展开体 `acceptance.retestEmpty`；分享/交付 0 → 徽标按 D6 省略，展开体既有空态文案；请求中 → 徽标显示 `—`，展开体一行「加载中…」；失败 → 徽标 `—`，展开体沿用 `previewError`/`acceptanceError` 的 errorline（不新增错误文案）。

### 17.5 组件清单（A1–A10）

> 全部复用现有 `ds-*` 组件与 `--dsw-alias-*` token，作用域挂在 `.ds-acc-*` 下，不影响其它面板。新增组件的内边距/间距只用 4/8/12/16；沿用既有 `.ds-acc-*` 的 5/6/7px 微间距处已在 §17.6 标注为「既有值，不改」。

| # | 组件 | 尺寸 / 间距 | 字号 / 字重 | 颜色 token | 关键交互 |
|---|---|---|---|---|---|
| A1 | 区块头（证据库 / 复测中心 / 交付与预览分享共用） | 高 **44**、左右 padding **8**、整行宽；标题与徽标 gap 8；箭头 12×12 固定右列（距右 8） | 标题 **12/600**；徽标 9.5/600 | 底色面板（`bg-layer-1` 混色）；标题 `label-primary`；徽标见 A4；箭头 `label-secondary`；上边线 `border-l1` | 整行 `button`；click / Enter / Space 切换；hover 底色 = `label-primary` 6%；focus 环 2px `brand`（inset -2） |
| A2 | 区块体容器 | `flex:0 0 auto; overflow:auto`；max-height：证据 **260** / 复测 **240** / 交付 **340**；内边距 8；顶部无额外边框（区块头已有） | 沿用既有 body 字号（9–11） | 底 `bg-layer-1` 混色；内部沿用既有组件 | 展开才渲染内容（保留挂载，`hidden`）；滚动条仅竖向；不发额外请求 |
| A3 | 「全部收起 / 全部展开」按钮 | 高 26（视觉）/ 点击区 26×≥84；与刷新 gap 8；图标 13 + 文案，图标/文字 gap 4 | **10.5/600** | 无边框；文字 `label-secondary`；hover 文字 `label-primary`；focus 环 2px `brand` | 单按钮动态文案；点击后批量切换 + 写存储；无 disabled（幂等） |
| A4 | 摘要徽标 | 高 **16**、rx 8、左右 padding 5；`max-width 96`、单行、`text-overflow ellipsis`；最多 2 个；gap 5 | **9.5/600** | 中性：底 `label-primary` 6%（浅 #F1F1F1 / 深 #343436）+ 文字 `label-secondary`；通过：底 success 12% + 文字 success 55% 混 `label-primary`；失败：error 12% + error 55% 混；阻塞：warn 12% + warn 55% 混；`+n` 用中性 | 纯展示（在 button 内，随按钮可读名称播报）；完整文本进 `title` |
| A5 | 分组头 | 高 **28**、左右 padding **8**；分类名 + 数量徽标 gap 5；箭头 12 距右 8；行宽整行 | 分类名 **9.5/600**；数量 **9/600** | 分类名 `label-secondary`；数量底 `badgeBg` + 文字 `label-secondary`；箭头 `label-secondary`；hover 底色 `label-primary` 6% | `button`；click/Enter/Space；`aria-expanded` + `aria-controls`；持久化（分类原值 key） |
| A6 | 详情头 / 详情体 | 头高 **48**、padding 8；状态徽标 16 + 标题 gap 6；箭头距右 8；体沿用既有 `.ds-acc-detail`（padding 6/8） | 标题 **12/600**（展开 2 行、收起 1 行 clamp）；收起提示 **9/400** | 头底 `bg-layer-2` 混色；标题 `label-primary`；徽标按状态；提示 `label-secondary`；上边线 `border-l1` | 有选中才渲染；`button` 头；收起保留选中；选中另一项自动展开；不持久化 |
| A7 | 清单选中行强化 | 行内既有布局不变；选中底 + 左条 **2px** | 行标题 11（既有）；状态着色见 D8 | 选中底 brand **8%**（浅 #ECECEC / 深 #38383A）+ 左条 `brand`；标题 `label-primary`（通过/不通过用 D8 的深色版） | 选中态与详情头文案互为反馈；hover 仍为 4%（既有） |
| A8 | 折叠箭头 | 12×12（16 viewBox 缩放 0.75），`aria-hidden="true"` | — | `label-secondary`（浅 5.80 / 深 9.90，均 ≥3 非文本） | 展开 ⌃ / 收起 ⌄；切换即时，无高度动画 |
| A9 | 区块内空/加载/错误行 | 一行 hint，padding 2/0；错误行沿用 `.ds-errorline` | 9.5/400 | 空/加载 `label-secondary`；错误 `state-error-primary` | 不吞错误；重试入口仍是工具区「刷新」 |
| A10 | 折叠状态存储（非视觉） | 单键 JSON；读写包 try/catch | — | — | 损坏 → 整份回退默认；写入失败 → 内存态 |

### 17.6 设计 tokens

**间距（4/8 体系）**

| 值 | 用途（新增/改造组件） |
|---|---|
| 4 | 图标与文字 gap、徽标间距下限、行内元素微间距 |
| 8 | 区块头左右 padding、组头左右 padding、区块体内边距、按钮与刷新间距、标题/徽标间距 |
| 12 | 区块体分区块之间的纵向间距（如证据网格与提示行） |
| 16 | 展开体主按钮行与下一分区之间 |
| 24 | 区块体顶部/底部留白上限（内容少时） |
| 44 / 48 | 区块头 / 详情头高度（同时也是触控目标） |
| 既有 5/6/7/10 | **不改**：`.ds-acc-counts gap 5`、`.ds-acc-badges gap 4`、`.ds-acc-evidence-list gap 5`、`.ds-acc-hint padding 6 10`、`.ds-acc-toolbar gap 6` 等为既有值，本轮不动以免视觉漂移；新增元素不引入 5/6/7 |

**字号阶梯与行高**

| 用途 | 字号/行高 | 说明 |
|---|---|---|
| 区块头标题、详情标题 | **12 / 18（1.5）** | 取自 12 阶梯（侧栏可用的最小阶梯值） |
| 工具区动态按钮 | 10.5 / 16（1.52） | 沿用 `.ds-acc-toolbar` 既有按钮字号 |
| 徽标 / 分组名 / 分组数量 | 9.5 或 9 / 16（≥1.68） | 沿用现有徽标字号，单行 |
| 区块体内正文 | 10–11 / 15–16.5（1.5） | 沿用既有 body 字号，正文行高 ≥1.4 |
| 次要说明（详情收起提示、meta） | 9 / 13.5（1.5） | 仅用于非关键说明，颜色用 `label-secondary` |
| 既有微阶 8.5 | **例外**：证据文件名、行内徽标沿用 v1.2.83 既有值 | 属密集侧栏既有样式；新增组件不新增 8.5px 文本 |

字重只用 400（正文）/600（标题、标签、按钮），面板内不使用 700（避免与侧栏 pane head 争层级）。

**颜色 token 映射（值取自 DSH 主题 CSS 实测）**

| 语义 | token | 浅色 | 深色 | 用途 |
|---|---|---|---|---|
| 面板底 | `bg-layer-2` 46% + `bg-layer-1`（同 `.ds-side` 背景式） | #FFFFFF | #272729 | 区块头/清单底色 |
| 区块体内底 | `bg-layer-2` 混 `bg-layer-1` | #FAFAFB | #232324 | 展开体底（与头部区分） |
| 主文字 | `label-primary` | #0F1115 | #F9FAFB | 区块标题、行标题、详情标题 |
| 次文字 | `label-secondary` | #61666B | #CFD3D6 | 徽标文字、分组名、提示、meta、箭头 |
| 装饰文字 | `label-caption` | #ADB2B8 | #81858C | **只做装饰**（不承载信息），本轮不用于新文本 |
| 焦点/品牌 | `brand-primary` | #0F1115 | #F9FAFB | 焦点环、选中左条、主按钮底（深色为白底深字） |
| 成功 | `state-success-primary` 55% + `label-primary` | #19743D | #4ED17E | 「通过 / 复测通过」徽标文字、通过行标题 |
| 失败 | `state-error-primary` 55% + `label-primary` | #891214 | #F25A5A | 「不通过」徽标文字、失败行标题 |
| 阻塞 | `state-warn-primary` 55% + `label-primary` | #8E5F10 | #F7AD31 | 「阻塞」徽标文字 |
| 分隔 | `border-l1` | #0000000A | #FFFFFF0F | 区块头/分组/详情之间的 1px 分隔（装饰） |
| 控件边界 | `border-l2` | #0000001A | #FFFFFF1F | 输入框、按钮边框 |
| 输入框边界 | `label-tertiary` 档 | #7F8287 | #8A8D92 | 输入/端口框边线（非文本 3.86 / 4.48） |

**对比度实测（sRGB 计算值；浅色底 #FFFFFF、深色底 #272729）**

| 前景 / 背景 | 比值 | 用途 | 结论 |
|---|---|---|---|
| #0F1115 / #FFFFFF | **18.90** | 浅色主文字 / 区块标题 | ✅ 正文 |
| #61666B / #FFFFFF | **5.80** | 浅色次文字 / 徽标 / 分组名 | ✅ 正文 |
| #81858C / #FFFFFF | 3.71 | 浅色 `label-tertiary`（装饰/图标） | ⚠️ 仅非文本 |
| #ADB2B8 / #FFFFFF | 2.13 | `label-caption` | ❌ 不用于文字 |
| #0F1115 / #F1F1F2（hover 底） | 16.74 | 区块头 hover 时标题 | ✅ |
| #61666B / #F1F1F2（hover 底） | 5.14 | hover 时徽标 | ✅ |
| #0F1115 / #ECECEC（选中底） | 16.00 | 选中行标题 | ✅ |
| #61666B / #ECECEC | 4.91 | 选中行 meta | ✅ |
| #61666B / #F1F1F1（徽标底 6%） | 5.13 | 中性徽标文字 | ✅ |
| #19743D / #FFFFFF | 5.82 | 浅色「通过」文字 | ✅ |
| #19743D / #E4F8EC（success 12%） | 5.25 | 通过徽标 | ✅ |
| #891214 / #FFFFFF | 9.72 | 浅色「不通过」文字 | ✅ |
| #891214 / #FDE3E3 | 8.00 | 不通过徽标 | ✅ |
| #8E5F10 / #FFFFFF | 5.53 | 浅色「阻塞」文字 | ✅ |
| #8E5F10 / #FEF3E2 | 5.04 | 阻塞徽标 | ✅ |
| #FFFFFF / #0F1115（主按钮） | 18.90 | 「运行复测」主按钮 | ✅ |
| #61666B / #F7F7F8（输入底） | 5.42 | 输入 placeholder | ✅ |
| #7F8287 / #FFFFFF | 3.86 | 输入框边界（非文本） | ✅ |
| #0F1115 / #FFFFFF（focus 环） | 18.90 | 浅色焦点环 | ✅ |
| #F9FAFB / #272729 | **14.27** | 深色主文字 | ✅ |
| #CFD3D6 / #272729 | **9.90** | 深色次文字 | ✅ |
| #ADB2B8 / #272729 | 6.98 | 深色 `label-tertiary` | ✅ |
| #81858C / #272729 | 4.02 | 深色 `label-caption` | ❌ 不用于文字 |
| #CFD3D6 / #343436（徽标底 6%） | 8.25 | 深色中性徽标 | ✅ |
| #4ED17E / #233C2C | 6.13 | 深色通过徽标 | ✅ |
| #F25A5A / #3C1F1B | 4.55 | 深色不通过徽标 | ✅ |
| #F7AD31 / #2A261D | 7.88 | 深色阻塞徽标 | ✅ |
| #F9FAFB / #38383A（选中底 8%） | 11.20 | 深色选中行 | ✅ |
| #F9FAFB / #272729（focus 环） | 14.27 | 深色焦点环 | ✅ |
| #0F1115 / #F9FAFB（深色主按钮反转） | 18.08 | 「运行复测」深色 | ✅ |

> 结论：新增/改造文字全部 ≥4.5:1；箭头、焦点环、输入边界等非文本 ≥3:1（箭头 5.80 / 9.90，焦点 18.90 / 14.27）；`label-caption` 明确禁止承载新信息。

**圆角 / 焦点 / 动效**

| 项 | 值 |
|---|---|
| 圆角 | 6（输入/按钮/区块内小控件，沿用既有 6）、8（徽标 pill、focus 环圆角）、999（筛选 chip，既有 11 → 视觉等价） |
| 焦点环 | `outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; border-radius: 6px`；整行按钮用 inset 避免被 `overflow:hidden` 裁切；行内小按钮用 `outline-offset: 2px` |
| 动效 | `transition: color 150ms ease-out, background-color 150ms ease-out`；**不做高度/位移动画**（需求禁止高度动画，避免与 `hidden` 语义冲突）；箭头用图标切换而非 transform 旋转（无过渡抖动） |
| reduced-motion | `@media (prefers-reduced-motion: reduce) { transition: none }`；无 shimmer / 无 pulse / 无自动播放 |
| 层级 | 不新增 z-index；全部在面板内常规流 |

### 17.7 八态状态矩阵

> 八态 = default / hover / focus / active / disabled / loading / empty / error；N/A 必须写理由。交互组件统一 focus = 2px `brand` 环。

| 组件 | default | hover | focus | active | disabled | loading | empty | error |
|---|---|---|---|---|---|---|---|---|
| **A1 区块头** | 44 高、标题 12/600 + ≤2 徽标 + ⌄ 箭头；上边线 1px | 底色 `label-primary` 6%（浅 #F1F1F2 / 深 #343436）；文字/箭头不变 | 2px `brand` 环 inset -2（浅 18.90 / 深 14.27），环不被裁 | 底色 8%；**箭头仍指向当前状态**（按下不翻转，松开才切换） | **N/A**：折叠头永远可操作（内容为空时展开仍看得到空态说明，不需要禁用） | 内容区首次加载：徽标 `—`，展开体一行「加载中…」+ `aria-busy="true"`；头部不转圈 | 数据为空：徽标 `0 条证据` / `无记录` / `无分享`；展开体既有空态文案；仍可展开 | 数据失败：徽标 `—`；展开体 `previewError`/`acceptanceError` errorline；点「刷新」重试；节点仍在 |
| **A2 区块体** | 展开时无 `hidden`，内容与 v1.2.83 一致；max-height 内滚动 | N/A（容器） | N/A（容器；内部控件各自 focus） | N/A | N/A | 一行「加载中…」/骨架；不发额外请求 | 空态一行 `label-secondary` | errorline + 重试（刷新）；不自动收起 |
| **A3 全部收起/展开按钮** | 26 高；双上箭头 +「全部收起」（任一项已展开）；双下箭头 +「全部展开」（全部收起时） | 文字 `label-primary` + 下划线（沿用 `ds-linkbtn:hover`） | 2px `brand` 环 + 2px offset | 文字/图标 8% 底 | **N/A**：永远可执行且幂等（重复点同状态不改结果）；无「全部已收起所以禁用」的死路 | N/A（纯本地同步切换） | N/A（始终有文案；本面板恒有三区块） | N/A（不触发请求，无失败路径） |
| **A4 摘要徽标** | 16 高、单行、≤96px；中性/成功/失败/阻塞四类；`+n` 合并 | 随父级 hover | 随父级 focus 环（不单独聚焦） | 随父级按下 | N/A（非交互） | `—`（数据未到） | `0 条证据` / `无记录` / `无分享 · 无交付` | `—` |
| **A5 分组头** | 28 高；分类名 + 数量徽标 + ⌄；组内条目常显 | 底色 `label-primary` 6% | 2px `brand` 环 inset -2 | 底色 8% | N/A：分组折叠不影响勾选/批量，永远可点 | N/A（纯本地分组） | 组内 0 项时不渲染该组（不显示空分组头） | N/A（无异步源） |
| **A6 详情头** | 48 高；状态徽标 + 标题（展开 2 行 / 收起 1 行）+ ⌃；收起态加 9px「详情已收起 · 选中保留，点此展开」 | 底色加深（4%） | 2px `brand` 环 inset -2 | 底色 8% | N/A：无选中时整块不渲染（不是禁用） | N/A（详情随选中同步渲染） | 无选中 → 不渲染（即空态）；有选中但无备注/证据 → 体内各自空态文案 | N/A（详情无异步加载；保存失败走既有 toast/errorline） |
| **A7 选中行** | 未选中：透明底；选中：brand 8% 底 + 2px 左条 | 4% 底（既有） | 行内 `button` 2px `brand` 环（既有） | 8% 底 | N/A（行本身不禁用；状态按钮各自禁用逻辑不变） | N/A | N/A（行不承载空态） | N/A |
| **A8 箭头图标** | 12×12，`label-secondary`（5.80 / 9.90）；⌄ 收起 / ⌃ 展开；`aria-hidden` | 随父级 | 随父级 | 随父级 | N/A | N/A | N/A | N/A |
| **A10 存储层** | 读到合法 JSON → 应用 | — | — | — | N/A | N/A | 无键 → 默认值 | 解析失败/类型不符/`setItem` 抛错 → 整份回退默认 + 静默降级内存态（不 toast、不崩溃） |

### 17.8 响应式规格（360 / 768 / 1280 + 691）

> 关键事实：验收台是**侧栏面板**，宽度 = `min(treeWidth, max(220, containerWidth × 0.42))`，`treeWidth` 可拖 180–560；`containerWidth < 900` 时进入 compact，侧栏 = 100% 视口宽。所以设计按**面板宽度**定规则，而不是只看视口。

| 视口 / 面板宽 | 形态 | 区块头 | 徽标 | 详情头 | 清单 / 区块体 |
|---|---|---|---|---|---|
| **360**（下限；或 compact 360 手机） | 单列 | 44 高单行；标题 `flex:1` 省略；箭头固定右 | **1 个 + `+n`**（面板宽 <420 走窄规则）；每个 ≤96px | 标题 **2 行 clamp**（展开）；收起 1 行 + 提示行 | 清单 min-height 96；证据 4 列（68×60/项）；区块体内滚动 |
| **691**（Owner 本机截图宽，compact 全宽） | 单列 | 44 高；标题完整 | **2 个完整**（不省略） | 2 行 clamp → 实际 1–2 行 | 清单 470；证据 8 列；三分组全展开 |
| **768**（compact 全宽） | 单列 | 同 691；内容左对齐、右侧箭头不拉伸 | 2 个完整 | 同 691 | 清单占比更大；证据 8–9 列 |
| **1280 视口（桌面侧栏默认 260 / 可拖 220–537）** | 侧栏 + 主区 | 面板 <420 时等同 360 窄规则；480–537 时 2 徽标完整 | 视面板宽按上述规则 | 同 360/691 | `.ds-acc-list` 弹性；三块 44 高固定底部 |
| **1440 视口（面板 ≤537）** | 侧栏 + 主区 | 内容左对齐、中间弹性留白，箭头最右；不出现「徽标被拉到屏幕另一边」的拉伸 | 同 1280 | 同 1280 | 面板宽仍 ≤537，布局与 1280 一致 |

**断点行为细则**

1. 所有折叠头/行：`display:flex; min-width:0`；标题 `min-width:0; overflow:hidden; text-overflow:ellipsis`；徽标 `flex:0 0 auto; max-width:96px`；箭头 `flex:0 0 auto`。任一层都不允许把父容器撑宽（验收项 7 用 `scrollWidth ≤ clientWidth` 断言）。
2. 面板 `overflow-x: hidden`；验收台视图不产生横向滚动；长分类名（>12 字）分组头同样省略，完整名进 `title`。
3. 清单滚动发生在 `.ds-acc-list` 内部；区块体滚动发生在各区块体内部；两者不嵌套争抢滚轮（三块都收起时只有清单滚动）。
4. 360 与 691 都验证过：三区块收起 + 分组 2–3 个 + 详情收起/展开 + 全部收起态四种组合均无横向溢出；具体见 17.11 渲染检查记录与 17.13 资源清单。

### 17.9 可访问性

**语义 / ARIA 契约（三区块头、分组头、详情头统一）**

| 要求 | 实现 |
|---|---|
| 元素 | `<button type="button" class="ds-acc-block-toggle / ds-acc-group-head / ds-acc-detail-toggle">`，整行宽 |
| 展开状态 | `aria-expanded="true"` / `"false"`，与内容显隐、箭头方向三者同步 |
| 关联 | `aria-controls="ds-acc-evidence-body / ds-acc-verify-body / ds-acc-delivery-body / ds-acc-detail-body / ds-acc-group-body-<i>"`，内容容器有同名 `id` |
| 隐藏 | 收起内容加 `hidden`（等价 `display:none`），**不参与 Tab**；保留 DOM 挂载以保住输入态 |
| 键盘 | Tab 可到每个头；Enter / Space 切换；切换后焦点留在按钮；不拦截其它按键；无自定义快捷键 |
| 焦点可见 | `:focus-visible` 2px `brand` 环（整行 inset -2，行内元素 offset 2）；鼠标点击不残留环 |
| 可读名称 | 按钮文本 = 标题 + 徽标文本（如「证据库 20 条证据」）；箭头 `aria-hidden="true"`；读屏会补「已收起/已展开」 |
| 不新增语义 | 不加 `role="tablist"/"region"/aria-modal`；不做 roving tabindex |
| 不给颜色单独表意 | 箭头方向 + `aria-expanded` + 文字；状态用「通过/不通过/阻塞」文字 + 徽标文字，颜色只是辅助 |

**Tab 顺序（自上而下 = 阅读顺序）**：工具区「刷新」→「全部收起/展开」→ 提示/计数（不可聚焦）→ 添加输入 → 添加 → 全选 → 筛选 chips → 模板 → 清单分组头 → 行内（勾选 → 标题 → 4 个状态按钮 → 删除）→ 详情头（若有）→ 详情体（保存备注 → 取消 → 添加证据 → 证据项…）→ 证据库块头 →（展开时）添加证据 → 证据项 → 复测块头 →（展开时）命令 checkbox → 运行 → 交付块头 →（展开时）交付按钮 → 端口 → 创建分享 → 分享行 → 交付记录 → 交付包。

**屏幕阅读器抽查（设计侧预估 + QA 实测）**

- 焦点到证据库头：「证据库，20 条证据，已收起，按钮」；按 Space 后「已展开」。（若实测播报未含状态，再补 `acceptance.toggleShow/Hide` 隐藏文案，见 17.2.2 的「调整」行。）
- 分组头：「验收 · 折叠与持久化，7 项，已展开，按钮」。
- 详情头：「通过，证据库、复测中心、交付与预览分享默认收起…，已展开，按钮」+（收起态）「详情已收起 · 选中保留，点此展开」。
- 工具区按钮：「全部收起，按钮」；`title`/`aria-label` 补充作用域「收起三个分区、所有分类分组与详情」。
- 收起区块的 body 不在 Tab 序列；用读屏「表单控件列表」确认端口输入、checkbox、按钮都不出现。

**触控目标（含声明的例外）**

| 控件 | 实测尺寸 | 判定 |
|---|---|---|
| 区块头 | 整行 × **44**（360 下 344×44；691 下 675×44） | ✅ ≥44×44 |
| 详情头 | 整行 × **48** | ✅ ≥44×44 |
| 分组头 | 整行 × 28 | ⚠️ **例外声明**：指针密集桌面（面板内控件普遍 20–26 高，如状态按钮 20、刷新 26），按 SOP §5.1#4「24×24 + 8px 间距」条款；28 ≥24、整行宽 ≥220、与相邻行间距 ≥8 |
| 全部收起/展开 | 84×26 | ⚠️ 同上例外（≥24 + 与刷新按钮 8px 间距） |
| 行内状态按钮 / 删除 | 20 高（既有） | ⚠️ 既有值，本轮不改（改了会挤爆 360 行宽，属范围外） |

**颜色以外 / 动效 / 缩放**

- 状态不只靠颜色：箭头方向 + `aria-expanded`；选中行 = 底色 + 2px 左条 + 详情头标题；徽标均为「文字 + 底色」，颜色仅辅助。
- 动效：150ms 颜色切换；无高度动画、无 shimmer；`prefers-reduced-motion` 下 `transition:none`。
- 200% 缩放 / 文字放大：面板宽 360 下标题换行、徽标省略，无横向滚动（flex + ellipsis 兜底）；验收项 7 的静态断言以 360 宽度为基线。
- 不做拖拽排序、不做 hover-only 操作、不做长按操作。

### 17.10 文案与 i18n

**新增 i18n 键（zh / en 必须成对，不删旧键）**

| key | zh | en | 用途 |
|---|---|---|---|
| `acceptance.collapseAll` | 全部收起 | Collapse all | 工具区动态按钮（可执行收起时） |
| `acceptance.expandAll` | 全部展开 | Expand all | 工具区动态按钮（全部已收起时） |
| `acceptance.collapseAllTitle` | 收起三个分区、所有分类分组与详情 | Collapse the three sections, all category groups and the detail panel | 按钮 `title` / `aria-label`（收起态） |
| `acceptance.expandAllTitle` | 展开三个分区、所有分类分组与详情 | Expand the three sections, all category groups and the detail panel | 按钮 `title` / `aria-label`（展开态） |
| `acceptance.block.delivery` | 交付与预览分享 | Delivery & preview sharing | 交付区块头标题（新键；证据/复测复用既有 `acceptance.evidenceLibrary` / `acceptance.retestTitle`） |
| `acceptance.badge.evidence` | {count} 条证据 | {count} evidence | 证据徽标（可复用 `acceptance.evidenceCount`，复用则此键不新增） |
| `acceptance.badge.retest` | {pass} 通过 / {fail} 失败 | {pass} passed / {fail} failed | 复测徽标（比 `acceptance.retestDone` 短） |
| `acceptance.badge.retestEmpty` | 无记录 | No runs | 复测徽标空态 |
| `acceptance.badge.share` | {count} 个分享 | {count} share(s) | 交付区块徽标 1 |
| `acceptance.badge.delivery` | {count} 个交付 | {count} deliverable(s) | 交付区块徽标 2 |
| `acceptance.badge.more` | +{count} | +{count} | 徽标溢出合并 |
| `acceptance.detailToggle` | 选中项详情 | Selected item detail | 详情块可读名称前缀（或 `aria-label` 前缀） |
| `acceptance.detailCollapsed` | 详情已收起 · 选中保留，点此展开 | Detail collapsed · selection kept, activate to expand | 详情收起态提示行 |
| `acceptance.groupToggle` | {name}，{count} 项 | {name}, {count} item(s) | 分组头 `aria-label` 模板（保证读屏听到数量） |

**复用既有键（不新增）**：`acceptance.evidenceLibrary`（证据库）、`acceptance.retestTitle`（复测中心）、`acceptance.evidenceCount`（{count} 条证据）、`acceptance.evidenceAdd`（添加截图 / 证据）、`acceptance.retest`（复测 = 运行按钮）、`acceptance.retestRunning`、`acceptance.retestLatest`、`acceptance.retestSend`、`acceptance.retestEmpty`、`acceptance.retestNoCommands`、`tasks.detect`、`acceptance.preview`、`acceptance.previewCreate`、`acceptance.history`、`acceptance.download`、`acceptance.bundleReady`、`acceptance.evidenceEmpty`、`acceptance.historyEmptyState`、`action.cancel`、`acceptance.groupOther`、`acceptance.saving`。

**文案规则**

- 徽标：数字 + 单位，不写整句；为 0 时仍显示 `0 条证据` / `无记录`，不隐藏（隐藏会让「收起后一无所知」，违背 GOV.UK 摘要的作用）。
- 「全部收起 / 全部展开」用**动词 + 范围**，与按钮实际作用一致；中文不加句号，英文首字母大写。
- 详情收起提示用「·」分隔两个信息（已收起 / 选中保留），不写成一句长话（360 会折行）。
- 英文按 `{count} item(s)` 这类现有仓库惯例处理单复数（避免新增复数规则与依赖）；如需严格单复数，记后续需求（不阻塞本轮）。
- 新增文案不得硬编码中文到渲染逻辑；所有可见文本（含 `title`、`aria-label`）走 `t()`；`grep` 渲染段无中文字面量。

### 17.11 自检评分与迭代记录

#### 17.11.1 迭代第 1 版（R1）渲染 → 检查

R1 = 第一版草稿（按需求逐条直译）：三块包成可折叠容器，但为了「省一次点击」把操作按钮留在了区块头；复测中心保留了原有的内层「复测」开关；工具区放了两个并列按钮；分组头还是原来的 `div`；详情区没有折叠头；区块展开时没有高度预算。

效果图：[R1 默认 360](design/acceptance-collapse-default-r1-360.svg) / [R1 展开 360](design/acceptance-collapse-expanded-r1-360.svg)。

| 轮次 | 触发（渲染/走查） | 发现（对照标准条目） | 修正 | 证据路径 | 复评分 |
|---|---|---|---|---|---|
| R1 | 渲染 `default-r1-360` / `expanded-r1-360` 后逐张 `read_image` | ① **操作按钮塞进区块头**：360 下「证据库 + 添加证据 + 20 条证据 + 箭头」互相压字，标题只剩 3–6 字（SOP §5.1#9 层级、#1 间距）→ 嵌套 `button` 违规；② **复测中心双层开关**：区块展开后仍要再点内层「复测」才见命令（GOV.UK 不嵌套手风琴）；③ **区块体无 max-height**：三块全展开时清单只剩 **24px**，主内容不可用（requirements §6.4「禁止塌成 0」）；④ **工具区两个按钮**（全部收起/全部展开）语义重复、无当前态反馈，且挤占「保存中…」位；⑤ **分组头仍是 `div`**：无箭头、不可点（违反验收项 5）；⑥ **行标题与状态按钮只差 1px**：360 下文字贴住按钮边框（4/8px 体系 + 触控间距）；⑦ **详情无折叠头**：选中后没有「已选中/可收起」反馈（验收项 4）；⑧ **徽标无上限**：交付头 2 徽标 + 2 按钮 + 标题互相挤压、右侧裁切 | 见 17.11.2 逐条修正 | [R1 默认](design/acceptance-collapse-default-r1-360.svg) / [R1 展开](design/acceptance-collapse-expanded-r1-360.svg) | 视觉层级 3、清晰度 3、一致性 3、反馈 2、可访问性 2 → 均分 **2.6**（未达门槛，must 失败：间距/触控/状态/层级） |
| R1 工具位 | R1 渲染 + 生成器自检 | ⑨ **渲染器缺 `translate`**：三个区块头叠在同一 y，只看到最后一块（自检工具问题，非设计本身）；⑩ **断行按字符硬切**：`aria-expan` / `ded` 被切开，与真实 `overflow-wrap:anywhere`（优先词边界）不符；中文行首出现「，」 | 生成器改为**栈式布局**（每块独立 `translate`）；断行改为「优先空格/CJK 边界 + 硬断兜底」；中文避头标点（，。、；：！？」等不落行首）；清单视口用 `clipPath` 裁剪最后一行，模拟真实滚动 | 生成器 `gen-acceptance-collapse-mockups.mjs`（R1 模式可复现） | 复评：渲染与真实 CSS 行为一致 |

#### 17.11.2 R2 修正（最终稿）

| R1 问题 | R2 修正 | 落点 |
|---|---|---|
| ① 头内嵌操作按钮 / 嵌套 button | 区块头 = **单一全宽 button**，只放标题 + 徽标 + 箭头（44 高）；操作按钮移到展开体顶行（添加证据 / 运行复测 / 打包·导出·下载 / 创建分享） | D1、A1、A2；[default-360](design/acceptance-collapse-default-360.svg) / [expanded-360](design/acceptance-collapse-expanded-360.svg) |
| ② 复测双层开关 | 删除内层 `verificationOpen` 与 `.ds-acc-verify-toggle`；区块展开 = 最近结果 + 命令列表 + 运行按钮；自动预选逻辑搬到 verify 头切换 | D2、A1；[expanded-360](design/acceptance-collapse-expanded-360.svg) |
| ③ 清单被压到 24px | 区块体 max-height（260/240/340）+ 内部滚动；清单 `min-height:96px`；三块收起时清单占满剩余高度（360×900 约 430px） | D7、A2；[default-360](design/acceptance-collapse-default-360.svg) / [detail-360](design/acceptance-collapse-detail-360.svg) |
| ④ 两个工具区按钮 | 合并为**单按钮动态文案**（全部收起 ⇄ 全部展开），放刷新右侧 8px；无 disabled；`title` 说明作用域 | D3、A3；[default-360](design/acceptance-collapse-default-360.svg) / [all-collapsed-360](design/acceptance-collapse-all-collapsed-360.svg) |
| ⑤ 分组头是 div | 改 `button`：分类名（9.5/600 `label-secondary`）+ 数量徽标 + 12px 箭头；持久化用分类原值 | D5、A5；[detail-360](design/acceptance-collapse-detail-360.svg) |
| ⑥ 行标题贴住状态按钮 | 行内左侧（勾选+标题）与右侧（状态按钮+删除）之间留 **6px** 间距，重算标题换行宽度（360 下标题 14–15 字/行，最多 3 行） | 17.5 A7、17.6 间距；[default-360](design/acceptance-collapse-default-360.svg) |
| ⑦ 详情无折叠头 | 48px 详情头：状态徽标 + 选中标题（展开 2 行 / 收起 1 行）+ 箭头；收起态「详情已收起 · 选中保留，点此展开」；选中行 8% 底 + 2px 左条 | D4、A6、A7；[detail-360](design/acceptance-collapse-detail-360.svg) |
| ⑧ 徽标无上限 | 最多 2 个、每个 ≤96px 省略、超 2 个合并 `+n`；面板 <420px 降为 1 个 + `+n`；标题先让位 | D6、A4；[default-360](design/acceptance-collapse-default-360.svg) / [691](design/acceptance-collapse-691.svg) |
| R1 未覆盖：深色 / 691 / 全部收起 | 补 3 张稿：全部收起（含分组 + 详情收起 + 选中保留）、691、深色片段（含对比度实测标注）；深色下徽标/箭头/焦点环全部复算 | 17.8、17.13；[all-collapsed](design/acceptance-collapse-all-collapsed-360.svg) / [691](design/acceptance-collapse-691.svg) / [dark-900](design/acceptance-collapse-dark-900.svg) |
| R2 二轮目检发现 | ① 深色徽标三处对比度标注写错（6.42/4.72/7.34 → 实测 6.13/4.55/7.88）、主按钮 15.99 → 18.08；② 691 复测徽标文案过长被省略 → 改为 `2 通过 / 0 失败`；③ 全部收起态清单区大段留白 → 清单高 300 → 200 并给「全部分组已收起」提示行；④ 证据/交付体内部滚动没有视觉提示 → 区块体右缘加 2px 滚动条示意；⑤ 选中行文字改为保留状态色（绿/红），选中只靠底色 + 左条表达。以上均已修正并重渲染 | 最终 6 张 PNG（检查记录见 17.13） |

> 说明：R2 重新渲染后对 6 张稿逐张 `read_image` 目检（中文无豆腐块、无文字溢出/重叠、层级正确），并用脚本扫描全部 `<rect>/<text>` 的右边界：**8 个 SVG 均无横向溢出**（rect/text `x+width ≤ canvas width`）。对比度数值由脚本按 sRGB 相对亮度重算（见 17.6 表），非手抄。

#### 17.11.3 五维自检评分（附证据）

| 维度 | 分数 | 证据 | 说明 / 扣分点 |
|---|---|---|---|
| 视觉层级 | **5** | [default-360](design/acceptance-collapse-default-360.svg) / [691](design/acceptance-collapse-691.svg) | 一屏一个主行动（默认态 = 清单勾选；展开态 = 运行复测）；三个 44px 区块头在清单下方形成清晰的第二层；详情块独立成层 |
| 清晰度 | **5** | [all-collapsed](design/acceptance-collapse-all-collapsed-360.svg) / [detail-360](design/acceptance-collapse-detail-360.svg) + 17.10 文案表 | 收起/展开、选中保留、徽标数值都为可读文案；空态与 0 值有明确写法（0 条证据 / 无记录 / 无分享） |
| 一致性 | **4** | 17.6 token 表 + [dark-900](design/acceptance-collapse-dark-900.svg) | 复用 `--dsw-alias-*` 与既有 `ds-*`；但面板内仍保留 v1.2.83 的 8.5–11px 微阶与 5/6/7px 既有间距、26px 工具按钮 → 与 12/14/16 全阶梯不完全一致，扣 1 分并已在 17.6 显式声明例外 |
| 反馈 | **5** | 17.7 八态矩阵 + [all-collapsed](design/acceptance-collapse-all-collapsed-360.svg) | 折叠即时有视觉与 `aria-expanded` 双反馈；详情收起保留选中；存储损坏静默回退；数据失败沿用 errorline + 刷新重试 |
| 可访问性 | **5** | 17.9 + 17.6 对比度表 + [691](design/acceptance-collapse-691.svg)（含 focus 环示例） | 正文 4.5:1 全达成（浅 5.80/深 9.90）；焦点环 18.90/14.27；区块头 44、详情头 48；键盘/ARIA/`hidden` 契约完备；分组头例外已声明 |

**均分 = (5+5+4+5+5)/5 = 4.8 / 5；must 项 0 失败 → 结论：可提交 Owner 评审。**（自评不替代 Owner 评审与 acceptance 复核。）

#### 17.11.4 MUST 核对（SOP §5.6 十条）

| # | MUST | 结果 | 证据 |
|---|---|---|---|
| 1 | 调研 ≥2 来源（URL + 日期 + 结论） | ✅ 6 个来源均 2026-10-27 HTTP 200 | 17.2.1 / 17.2.4 |
| 2 | 间距只用 4 的倍数 | ✅ 新组件 4/8/12/16/24；既有 5/6/7/10 已声明不改 | 17.6 间距表 |
| 3 | 字号出自阶梯、正文行高 ≥1.4 | ✅ 新增标题 12/18；徽标 9.5/16；正文 10–11/15–16.5；8.5px 为例外（既有） | 17.6 字号表 |
| 4 | 正文 ≥4.5:1、大字 ≥3:1（记录计算值） | ✅ 浅 5.80 / 深 9.90（正文），18.90 / 14.27（焦点环） | 17.6 对比度表 |
| 5 | 控件边界/焦点环非文本 ≥3:1 | ✅ 箭头 5.80/9.90；焦点 18.90/14.27；输入边界 3.86/4.48 | 17.6 / 17.9 |
| 6 | 触控 ≥44×44（或 24×24 + 8px 并声明） | ✅ 区块头 44、详情头 48；分组头 28 / 工具按钮 26 已按例外条款声明 | 17.9 触控表 |
| 7 | focus/disabled/loading/empty/error 五态齐备 | ✅ 17.7 矩阵含 8 行；disabled 均给 N/A 理由（折叠头永不需禁用） | 17.7 |
| 8 | 360/768/1280 三档不溢出、可完成核心任务 | ✅ 360 / 691 / 768 / 1280 / 1440 规则 + 6 张稿；脚本扫描无横向溢出 | 17.8 / 17.13 |
| 9 | 150–300ms 动效 + reduced-motion | ✅ 150ms 颜色过渡；无高度动画；reduced-motion 全关 | 17.6 / 17.9 |
| 10 | 键盘可达 + 焦点可见 + ARIA + 一轮「渲染→检查→修正」 | ✅ 17.9 契约 + R1→R2 记录 + 8 张稿逐张目检 | 17.9 / 17.11 |

#### 17.11.5 Nielsen 10 启发式走查（设计阶段）

| # | 启发式 | 发现 / 处理 |
|---|---|---|
| 1 | 系统状态可见 | 每个折叠头的箭头 + 徽标 + `aria-expanded` 三重表达状态；「全部收起/展开」文案随当前态变化；无异步加载歧义（折叠不发请求） |
| 2 | 贴合真实世界 | 用业务词「证据库 / 复测中心 / 交付与预览分享 / 分享 / 交付记录」；徽标用「20 条证据」「2 通过 / 0 失败」的人类读法 |
| 3 | 用户可控自由 | 折叠随手可逆；「全部展开」一键复原；不强制流程、不阻塞清单操作；不做二次确认（折叠不是危险操作） |
| 4 | 一致性与标准 | 三区块头/分组头/详情头统一 44/28/48 与同一箭头语义；复用既有 `ds-*` 与 token；中英术语一致 |
| 5 | 错误预防 | 折叠不产生数据写入；存储损坏回退默认；收起不丢失输入（备注草稿、端口、命令勾选仍在 DOM） |
| 6 | 识别优于回忆 | 收起态仍显示数量徽标（证据 20 / 复测结果 / 分享 3 · 交付 5）；详情头显示选中项标题；不需要记住上次状态 |
| 7 | 灵活高效 | 熟手一键全部收起/展开；单区块点一次即开；键盘用户 Tab + Enter/Space 同样 1 步 |
| 8 | 美学与极简 | 默认态只有清单 + 三个 44px 头；没有多余边框（只留 1px 分隔）；一屏一个主行动 |
| 9 | 错误识别/恢复 | 存储失败静默降级（不打扰）；数据失败沿用 errorline + 刷新重试；错误文案不新增、不丢失 |
| 10 | 帮助与文档 | 区块头 `title` 给完整文本；「全部收起」`title` 说明作用域；详情收起提示就地解释；不依赖外部文档 |

### 17.12 给开发 / 测试的交接

#### 17.12.1 给开发：组件 → 代码对照与插入点

> 行号为 **v1.2.83 / 根 1.2.85 基线**（requirements §1 口径，允许 ±2 行漂移；并行会话可能改动 `client.js`，实现时以**符号/类名**为准）。本轮只改 `client.js`（渲染 + CSS + i18n），不改 Host、数据结构、依赖。

| 设计组件 | 建议实现位置 | 状态规则 | 要点 / token |
|---|---|---|---|
| A1 区块头 | 新增 `renderBlockHead({ id, title, badges, open, onToggle })`；证据块 17564–17625、复测块 17626–17728、交付块 17729–17859 各用一次 | `aria-expanded={open}`、`aria-controls={'ds-acc-'+id+'-body'}`；点击写存储 | 44 高、`padding: 0 8`、标题 12/600、徽标 9.5/600、箭头 12 `ChevronUpIcon`/`ChevronDownIcon`（复用 4026/4030） |
| A2 区块体 | 三块内容包 `h('div', { id: 'ds-acc-<id>-body', hidden: open ? undefined : true, className: 'ds-acc-block-body' })` | `hidden` 用布尔；保留挂载（**不要**条件卸载，否则丢端口/命令勾选/备注草稿） | max-height 260/240/340；`overflow:auto`；不新增请求 |
| A3 全部收起/展开 | 工具区 17248–17262 内、刷新按钮之后 | `anyOpen` 计算见 D3；点击 `setAllCollapsed(!anyOpen)`；文案 + `title` 双 key | 26 高、10.5/600、`ds-linkbtn` 风格 + 双箭头图标（新增 `ChevronsUpIcon/ChevronsDownIcon`，或复用两个 Chevron 叠放） |
| A4 徽标 | 区块头内 `renderBadge(kind, text)` | 规则见 D6；`title=完整文本`；`+n` 的 `title` 列出被折叠项 | 16 高、rx 8、padding 0 5、max-width 96px |
| A5 分组头 | 17410–17415 的 `div` → `button`；`groups.map` 内 | `aria-expanded={groups[rawCategory] !== false}`；`aria-controls={'ds-acc-group-body-'+index}`；组体包一层 `div` + `hidden`（整组一个容器，别逐行加 `hidden`） | 28 高、`label-secondary`、数量徽标 9/600、箭头 12 |
| A6 详情头 + 体 | 17469–17563 外层加头：`h('button', { className:'ds-acc-detail-toggle', 'aria-expanded': detailOpen, 'aria-controls':'ds-acc-detail-body' })` | 选中变化（`acceptanceSelected` 从 A→B 且 B!==null）时 `setDetailOpen(true)`；「取消」清空选中；手动收起时保留选中 | 48 高；标题 2 行/1 行 clamp；收起提示 9px `label-secondary` |
| A7 选中行 | 25641 `.ds-acc-row[data-selected="true"]` | 现有 8% 底保留，加 `box-shadow: inset 2px 0 0 var(--dsw-alias-brand-primary)` 或 `border-left` | 行标题状态色改混合色（D8） |
| A8 状态色 | 25642 `.ds-acc-title` 的 `state-*` → 混合色 | `color-mix(in srgb, var(--dsw-alias-state-success-primary) 55%, var(--dsw-alias-label-primary))`、error 同式 | 保证 5.82 / 9.72（浅）、7.63 / 4.53（深） |
| A9 CSS 落点 | 追加在 `.ds-acc-*` 块内（25578–25700 之后） | 新类：`.ds-acc-block`、`.ds-acc-block-toggle`、`.ds-acc-block-body[hidden]`、`.ds-acc-block-badges`、`.ds-acc-block-badge`、`.ds-acc-block-badge[data-kind]`、`.ds-acc-group-head`（改 button 后重置 `border:0;background:transparent;width:100%`）、`.ds-acc-detail-toggle`、`.ds-acc-detail-caption`、`.ds-acc-chevron`、`.ds-acc-toolbar-toggle` | 全部 `:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px }`；`@media (prefers-reduced-motion: reduce) { transition: none }` |
| A10 存储 | 键常量区 33–61；`readStorage`/`writeStorage` 4244–4258 可复用 | `COLLAPSE_KEY = 'dsh-web-filebrowser:acceptance-collapse'`；`readCollapseState()` 返回 `{blocks, groups}`，**任何异常 → 默认值**；`writeCollapseState(next)` try/catch 静默 | 不写 `.dsh/`、不过 Host、不做版本迁移；分组 key 用 `item.category?.trim() \|\| '__uncat__'` |

**建议的实现骨架（伪代码，按仓库风格用 `h()`）**

```js
const COLLAPSE_DEFAULT = { blocks: { evidence: false, verify: false, delivery: false }, groups: {} }
const groupKeyOf = (item) => (typeof item.category === 'string' && item.category.trim().length > 0 ? item.category.trim() : '__uncat__')
// 读：一次；坏值 → 默认
function readCollapse() {
  try {
    const raw = readStorage(COLLAPSE_KEY)
    if (!raw) return COLLAPSE_DEFAULT
    const doc = JSON.parse(raw)
    const blocks = {}
    for (const key of ['evidence', 'verify', 'delivery']) blocks[key] = doc?.blocks?.[key] === true
    const groups = {}
    if (doc && typeof doc.groups === 'object' && doc.groups !== null) {
      for (const [key, value] of Object.entries(doc.groups)) if (typeof value === 'boolean') groups[key] = value
    }
    return { blocks, groups }
  } catch { return COLLAPSE_DEFAULT }
}
// 写：每次切换后
const writeCollapse = (next) => { try { writeStorage(COLLAPSE_KEY, JSON.stringify(next)) } catch {} }
// 全部收起/展开：anyOpen 见 D3；一次写
```

**可自由调整 vs 不可偏离**

- 可自由调整：徽标之间的 gap（4–8）、箭头尺寸（12±2）、区块体 max-height（±40）、证据网格列宽（保持 68±8）、详情标题 clamp 行数、块间距、`title` 文案措辞。
- **不可偏离**：区块头是单按钮且**不嵌套**其它可聚焦元素；三个折叠头/分组头/详情头必须 `button` + `aria-expanded` + `aria-controls` + 内容 `hidden`；切换后焦点留在按钮；`localStorage` 键名与 JSON 形状、默认值、分组 key 用分类原值；不做高度动画、不加依赖、不改 Host/数据结构；折叠不发网络请求；收起时保留挂载；中英文案成对；颜色只用 token/`color-mix`（不得硬编码语义色）。

**防重复与错误恢复**

- 折叠是同步本地状态，无 busy 态、无请求；连续快速点击按 `current => !current` 写法天然幂等。
- 「全部收起/展开」一次写一次存储；不要在循环里逐块写（避免多次 `JSON.stringify`）。
- 存储读失败 → 默认态；写失败 → 内存态（功能可用，不提示，不阻塞）；不做 toast。
- 数据失败沿用既有 `acceptanceError`/`previewError` errorline，折叠头徽标显示 `—`，用户可「刷新」重试；**失败不自动收起**已展开的区块。

**性能与兼容**

- 收起只是加 `hidden`：54 条项 + 20 证据 + 24 命令仍在 DOM，`hidden` 不参与布局、不触发请求；不新增每帧计算；不改数据结构。
- 目标：切换 <16ms（一次 state 更新 + 一次 `localStorage.setItem`）；不做防抖（折叠是低频操作）。
- Chrome / Safari / Firefox 现代版本；`color-mix` 与 `:focus-visible` 已在 v1.2.8x 系列使用；`hidden` 全支持。

#### 17.12.2 给测试：视觉基线与复测步骤

**视觉基线（浅色，逐张对照）**

1. [default-360](design/acceptance-collapse-default-360.svg)：三区块收起、只露 44px 头（标题 + 徽标 + ⌄）；清单占满剩余高度并独立滚动；工具区「刷新 + 全部收起」；分组头带数量与箭头。
2. [expanded-360](design/acceptance-collapse-expanded-360.svg)：三块展开内容与 v1.2.83 一致（证据网格、命令列表 + 运行、4 个交付按钮、端口 + 3 条分享、交付记录、交付包）；复测中心**没有**内层开关；清单仍可滚动（本图 132px）。
3. [all-collapsed-360](design/acceptance-collapse-all-collapsed-360.svg)：三块 + 全部分组 + 详情均收起；详情头仍显示状态徽标 + 标题 + 「详情已收起 · 选中保留」；清单行高亮仍在；按钮变「全部展开」。
4. [detail-360](design/acceptance-collapse-detail-360.svg)：详情头 48px（状态徽标 + 标题 2 行 + ⌃）；详情体完整（分类/验收条件/备注/保存/取消/证据/状态历史）；选中行 8% 底 + 2px 左条。
5. [691](design/acceptance-collapse-691.svg)：徽标 2 个完整显示；证据库为 hover 态；复测中心为 `:focus-visible` 态（2px 环）；无省略。
6. [dark-900](design/acceptance-collapse-dark-900.svg)：深色下徽标/箭头/焦点环/选中行/主按钮（白底深字）与对比度标注一致。

**可观察断言（建议复制给 QA 脚本/手测）**

| 项 | 断言 |
|---|---|
| 默认态 | `localStorage` 无键时：三块 body 都有 `hidden`；三个块的 `aria-expanded="false"`；`.ds-acc-list` 高度 > 300px（360 宽 900 高时约 430） |
| 无横向溢出 | `panel.scrollWidth <= panel.clientWidth`（面板容器）；360 / 691 各测一次；长分类名（>12 字）也测 |
| 持久化 | 展开证据库 + 收起复测 → 刷新 → 两块状态保持；`localStorage.getItem('dsh-web-filebrowser:acceptance-collapse')` 可 `JSON.parse` |
| 损坏回退 | 写入 `{"blocks":{"evidence":"bad"}}` → 刷新 → 三块收起、分组展开、无报错；写入 `not-json` 同样回退 |
| 全部收起 | 点「全部收起」→ 三块 + 全部分组 + 详情收起；选中行仍 `data-selected="true"`；按钮文案变「全部展开」；刷新保持 |
| 全部展开 | 再点 → 三块展开、分组展开、详情（若有选中）展开；刷新保持 |
| 详情 | 选中 → 出现；点详情头 → 收起但选中保留（头文案 + 行高亮）；取消选中 → 整块消失；选另一项 → 自动展开 |
| 分组 | 点组头 → 组内条目不可见且不在 Tab 序列；勾选/批量/状态/删除/筛选行为与折叠前一致；刷新保持 |
| 键盘/ARIA | Tab 到每个折叠头 → Enter 与 Space 均可切换、焦点不跳走；`aria-expanded` 与视觉一致；`aria-controls` 命中唯一 `id`；`getComputedStyle(focused).outlineWidth === '2px'` |
| 读屏 | 证据库头读「证据库 20 条证据 已收起」；分组头含分类名与数量；详情头含状态与标题 |
| 主题 | 切深色：徽标/箭头/分隔线/焦点环可见；正文对比 ≥4.5（对照 17.6 表抽查 3 处） |
| reduced-motion | 系统开启「减少动态效果」后，折叠切换无过渡（`transition-duration` 为 0s） |
| 回归 | requirements §8 第 9 条全列（刷新/添加/模板/筛选/全选/批量/状态/删除/备注/证据上传删除/复测/导出/打包下载/分享增删/交付记录/交付包）+ 其它面板冒烟 + `npm run check` / `check:json` / `npm test` 退出码 0 |

**常见误判（不要当 bug）**：折叠**没有高度动画**（需求明确不做）；区块收起时 DOM 仍在（用 `hidden` 判断，不要用元素是否存在判断）；分组 id 会随筛选变化（`aria-controls` 仍正确）；详情收起后仍保留选中（这是设计）。

### 17.13 资源清单与渲染环境

| 文件 | 说明 |
|---|---|
| [acceptance-collapse-default-360.svg](design/acceptance-collapse-default-360.svg) | 默认态：三区块收起、清单为主、2 个分组、工具区「全部收起」（360×846） |
| [acceptance-collapse-expanded-360.svg](design/acceptance-collapse-expanded-360.svg) | 三区块展开：证据网格 20 项、复测命令列表 + 运行、交付按钮 + 预览分享 3 条 + 交付记录 + 交付包（360×1324，连续绘制完整内容，真实面板内区块体滚动） |
| [acceptance-collapse-all-collapsed-360.svg](design/acceptance-collapse-all-collapsed-360.svg) | 全部收起：三分组 + 详情 + 三区块均收起，选中保留，按钮变「全部展开」（360×640） |
| [acceptance-collapse-detail-360.svg](design/acceptance-collapse-detail-360.svg) | 详情展开：48px 详情头 + 验收条件/备注/证据/状态历史，选中行高亮（360×999） |
| [acceptance-collapse-691.svg](design/acceptance-collapse-691.svg) | 691px 截图宽度（compact 全宽）：徽标 2 个完整、hover 与 focus 示例（691×885） |
| [acceptance-collapse-dark-900.svg](design/acceptance-collapse-dark-900.svg) | 深色主题片段 + 对比度实测标注（900×658） |
| [acceptance-collapse-default-r1-360.svg](design/acceptance-collapse-default-r1-360.svg) | R1 迭代证据（头内嵌操作按钮、双工具按钮、分组 div）（360×727） |
| [acceptance-collapse-expanded-r1-360.svg](design/acceptance-collapse-expanded-r1-360.svg) | R1 迭代证据（复测双层开关、无 max-height、清单被压到 24px）（360×1094） |
| [gen-acceptance-collapse-mockups.mjs](design/gen-acceptance-collapse-mockups.mjs) | 生成器（纯 SVG 字符串，无外部依赖）：`node gen-acceptance-collapse-mockups.mjs` 生成 6 张最终稿；`R1=1 node …` 生成 2 张 R1 稿 |

> PNG 导出不入库（`.gitignore` 已忽略 `docs/pipeline/design/*.png`），需要位图时按下述命令重建（逻辑坐标 → @2× 位图）。

**渲染环境与命令**

```bash
# 字体：Noto Sans SC 装在 /tmp/notofonts，fontconfig 配置 /tmp/fonts/fonts.conf
cd <repo>
node docs/pipeline/design/gen-acceptance-collapse-mockups.mjs          # 6 张最终 SVG
R1=1 node docs/pipeline/design/gen-acceptance-collapse-mockups.mjs     # 2 张 R1 SVG
FONTCONFIG_FILE=/tmp/fonts/fonts.conf \
  NODE_PATH=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules \
  node -e "const s=require('sharp'); s('docs/pipeline/design/acceptance-collapse-default-360.svg',{density:144}).png().toFile('docs/pipeline/design/acceptance-collapse-default-360.png').then(i=>console.log(i.width,i.height))"
```

- 输出尺寸（逻辑 × 2）：360 稿 → 720 宽；691 稿 → 1382；900 稿 → 1800；全部 `density:144`。
- SVG 内字体栈：`Noto Sans SC, PingFang SC, sans-serif`；字号/间距与 17.6 一致（1:1 CSS px，便于对照实现）。
- 本轮已逐张 `read_image` 目检：中文无豆腐块、无文字溢出/重叠、层级与选中高亮正确；并脚本扫描 8 个 SVG 的 rect/text 右边界 → 无横向溢出。

### 17.14 风险与未决 / 给 Owner 的确认清单

**风险**

| 风险 | 影响 | 处理 |
|---|---|---|
| 用户找不到证据/复测/交付入口（默认收起） | 需要多点一次 | 区块头常显 + 数量徽标（20 条证据 / 2 通过·0 失败 / 3 分享·5 交付）+ 「全部展开」；创新假设 1 已写失败预案 |
| 单按钮动态文案被误读 | 不知道当前是「全收起」还是「全展开」 | 文案随状态变化 + `title` 说明作用域；若 Owner 反馈，退回两个按钮（**仍占用同一位置**，不新增行） |
| 复测中心扁平化改动既有行为 | 回归风险 | 只删内层开关并把自动预选搬到 verify 头；运行/发送失败逻辑不动；验收项 9 覆盖 |
| 区块展开时清单变短 | 用户觉得「清单被挤压」 | 清单 `min-height:96` + 三块体滚动上限；展开态稿标出「保底 96px」 |
| 360 徽标省略导致数值不可见 | 信息缺失 | 完整文本进 `title`；`+n` 只合并第 3 个以后；面板 <420 时至少保留 1 个最重要徽标 |
| 深色徽标对比 | 低视力不可读 | 徽标文字用「语义色 55% + label-primary」混合；实测 4.55–7.88 全部 ≥4.5，见 17.6 |
| 存储写入失败（隐私模式） | 偏好不持久 | 静默降级内存态，功能可用；验收项 2 覆盖 |
| 并行会话改动 `client.js` 导致行号漂移 | 交接误差 | 以类名/符号为准；本设计只给插入点建议，不改代码 |

**未决问题（不阻塞本轮设计，交 Owner/Lead）**

1. 快速模式（TDD，fast gate）下 design 是否也需要 Owner 点确认？本轮按既有流水线（design 始终人工确认），不改。
2. 「全部展开」是否也应展开清单内所有分组的**滚动位置**（跳到顶部）？默认**不滚动**（避免打断），若 Owner 需要可后续加 `scrollTop=0`。
3. 是否给折叠头加键盘快捷键（如 `[` 全部收起）？默认不加（不新增快捷键，避免冲突）。
4. 详情「点同一项」是否应切换展开/收起？当前设计为「保持收起、选中不变」；若 Owner 更希望「点标题即开合」，改 `selectAcceptanceItem` 分支即可，不改变验收项 4 的可观察结果。

**给 Owner 的确认清单（design 闸门逐条看）**

- [ ] 验收台默认打开时：**清单在上、证据库/复测中心/交付与预览分享只在底部露 44px 区块头**，符合「清单成为主内容」的预期（[default-360](design/acceptance-collapse-default-360.svg)）。
- [ ] 区块头只有「标题 + 数量徽标 + 箭头」，**没有把添加证据/复测/打包塞进头部**；展开后按钮在原位且都能用（[expanded-360](design/acceptance-collapse-expanded-360.svg)）。
- [ ] 工具区只有**一个**「全部收起/全部展开」按钮（在刷新右侧），文案随状态变化，没有两个并列按钮。
- [ ] 复测中心展开即见「最近复测 + 命令 + 运行」，**没有内层开关要点第二次**。
- [ ] 选中项详情有 48px 头（状态 + 标题 + 箭头）；收起后仍能在头里看到「详情已收起 · 选中保留」且清单行高亮（[detail-360](design/acceptance-collapse-detail-360.svg)）。
- [ ] 「全部收起」后三区块 + 全部分组 + 详情都收起、选中不丢（[all-collapsed-360](design/acceptance-collapse-all-collapsed-360.svg)）。
- [ ] 691px 截图宽度下标题/徽标完整、无横向滚动（[691](design/acceptance-collapse-691.svg)）；深色主题可读（[dark-900](design/acceptance-collapse-dark-900.svg)）。
- [ ] 文案口径可接受：`全部收起 / 全部展开`、`详情已收起 · 选中保留，点此展开`、徽标 `20 条证据` / `2 通过 / 0 失败` / `3 个分享` / `5 个交付`（zh + en 见 17.10）。

> 审批通过后由全栈开发按 17.12 实现；实现完成交 QA 按 17.12.2 复测，再由项目经理复核、Owner 确认。
