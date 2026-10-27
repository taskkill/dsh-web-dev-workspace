# 工程调研与借鉴决策（v1.2.79 工作台 UI 全面重构）

- 角色：全栈开发；日期：2026-10-27（Asia/Shanghai）；上游：[requirements.md](requirements.md) + [design.md](design.md)。
- 范围：`dsh-web-filebrowser-plugin/client.js` 的 JSX/CSS/i18n + 版本/文档；**不改 Host、路由、模型工具、`.dsh` 数据**。
- 结论：不引入任何第三方组件库/图标库/字体/依赖；借鉴 3 个活跃开源项目的**模式**（可访问性、token 分层、图标规范），不复制代码。零依赖、纯内联 SVG、纯 CSS 实现。

---

## 1. 检索方式与时间

- 检索于 2026-10-27 通过 GitHub REST API（`https://api.github.com/repos/<owner>/<repo>`）读取 stars、license、pushed_at、archived，并读取 `LICENSE` 原文确认许可证。
- 同时沿用 product 阶段 2026-10-27 的 6 个设计/标准来源（[requirements.md §7](requirements.md)）；不重复抓取、不伪造 star 数或日期。
- 检索目的：确认「是否需要引入现成组件库」以及「可借鉴哪些模式」，并给出许可证矩阵，避免 GPL/AGPL/无许可证代码进入交付物。

## 2. 候选项目与许可证矩阵

| # | 项目 | GitHub | 最新 commit（2026-10-27） | Stars（2026-10-27） | 许可证 | 最近推送 | 活跃/归档 | 与本项目关系 | 决策 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | shadcn/ui | https://github.com/shadcn-ui/ui | `8f04138777c1` | 126,649 | **MIT** | 2026-10-26 | 活跃 | 可复制组件源码的「组件即代码」库；强调可访问默认值 | **只借鉴模式，不复制代码**：卡/按钮状态、focus-visible、token 组织 |
| 2 | Radix Primitives | https://github.com/radix-ui/primitives | `eb3a2b709129` | 19,435 | **MIT** | 2026-10-14 | 活跃 | 无样式可访问原语（dialog/menu/tooltip 的焦点与 ARIA） | **只借鉴模式，不引入依赖**：焦点环、键盘语义、层叠顺序 |
| 3 | Carbon Design System | https://github.com/carbon-design-system/carbon | `d8d5cf803fc4` | 9,582 | **Apache-2.0** | 2026-10-27 | 活跃 | IBM 企业级设计系统（token、栅格、字体层级） | **只借鉴模式，不复制代码/样式**：间距 4/8 基数、字号阶、表面分层 |
| 4 | Lucide Icons | https://github.com/lucide-icons/lucide | `7f1f31d71cc1` | 25,325 | **ISC**（LICENSE 原文确认；GitHub API 显示 NOASSERTION 为识别问题） | 2026-10-27 | 活跃 | 一致的线性图标工具包 | **不引入依赖，不复制图标**：沿用工作区既有内联 SVG 与 16px 线宽规范 |
| 5 | Tailwind CSS | https://github.com/tailwindlabs/tailwindcss | `8cc0551b1217` | 98,130 | **MIT** | 2026-10-19 | 活跃 | 原子化 CSS 框架 | **不采用**：项目已有手写 CSS 体系，引入会与现有 `ds-*`/token 冲突 |

### 2.1 许可证允许/禁止

| 许可证 | 允许复制/修改/分发 | 义务 | 本项目使用 |
|---|---|---|---|
| MIT（shadcn/ui、Radix、Tailwind） | 是 | 保留版权与许可声明 | 未复制代码；若未来复制须在 THIRD_PARTY 中声明 |
| Apache-2.0（Carbon） | 是 | 保留声明、NOTICE、专利条款 | 未复制代码/样式 |
| ISC（Lucide） | 是 | 保留版权与许可声明 | 未复制图标 |
| GPL-2.0/3.0、AGPL-3.0 | 复制会传染到本项目 | 源码开放/网络服务开放 | **未筛选、未使用** |
| 无许可证 | 默认保留所有权利 | 不可复制 | **未使用** |

> 本轮交付物中**没有**任何第三方源码、样式表、图标文件、字体文件或设计素材；`git diff` 可复核（仅 `client.js` + 版本/文档/效果图）。

## 3. 借鉴模式与落点

| 模式 | 来源 | 落地方式 |
|---|---|---|
| 焦点可见：`:focus-visible` 2px 环 + offset | Radix / shadcn/ui | `.ds-wb-v1279 ...:focus-visible { outline: 2px solid brand; outline-offset: 2px }`；hero 内用 #93C5FD 保证深色对比 |
| 语义化组件：button type、aria-label、aria-current、aria-labelledby | Radix / shadcn/ui | 页面头 h1 + 三 section；rail 为 `<ol>` + sr-only 状态；时间轴 `<ol>`；icon 按钮均有 aria-label |
| token 分层：页面底/表面/hover/active/border 分级 | Carbon / Geist | `--wb-canvas` / `--wb-surface` / `--wb-surface-2` / `--wb-line` / `--wb-line-strong`，避免散落色值 |
| 4/8 间距基数 + 字号阶 ≤5 档 | Carbon | 4/8/12/16/20/24/32；11/12/13/14/16/20/30（正文 12–13 为主） |
| 图标统一 16px、1.6px 线宽、aria-hidden | Lucide | 继续使用工作区已有内联 SVG（Refresh/Pipeline/Task/Close 等），不新增图标依赖 |
| 单层网格 + 三断点 | Geist Grid | Project/Delivery 各自单层 grid；1280/1024/700 断点 |
| 不自造动画框架 | Radix（reduce-motion 优先） | 仅 CSS transition 160ms；`prefers-reduced-motion` 全关 |

## 4. 安全审查

| 项 | 结论 |
|---|---|
| 新增依赖 | **0**（package.json dependencies 未变；未新增 devDependencies） |
| 外部资源 | 0（不引第三方字体/CDN/图片；效果图为仓库内 SVG/PNG，不参与运行时） |
| XSS | 未新增 `dangerouslySetInnerHTML`；全部文本走 React 文本节点；`title` 只放短文本（沿用 v1.2.77 教训，≤80 字） |
| 用户输入 | review note 为受控 input，仅存 React state；需求文本仍按现有 API 传输 |
| 敏感信息 | diff 中无 token/密码/内网地址；未改 Host 路由与鉴权 |
| 供应链 | 无新增包，因此无新增供应链风险；`npm audit` 无新增项 |
| CSP / 内联样式 | 新增 1 处内联 style（进度条 width，字符串百分比，非用户输入）；无内联脚本 |
| 链接安全 | 新增按钮均 `type="button"`；无新窗口/外链 |

## 5. 性能审查

| 指标 | 变化 | 说明 |
|---|---|---|
| `client.js` 体积 | 1,223,438 B → 1,269,012 B（+45.5 KB，+3.7%） | 其中 CSS ≈33 KB、JSX/i18n ≈12 KB；无新增运行时依赖 |
| 运行时计算 | O(1) 新增 | rail 进度 = done/total；环形 offset = 2πr×(1−p)；每次 render 常数级 |
| DOM 增量 | hero 侧栏约 +12 节点、rail 7 节点、running 统计 4 节点；无重复列表 | 所有卡片仍复用原数据与 handler，无额外请求 |
| 渲染/动画 | 仅 `border-color/background/box-shadow/transform/width` | 均为合成/低成本属性；无 requestAnimationFrame、无自动动画 |
| 网络 | 0 新增请求 | 无字体/图片/第三方脚本；效果图不进运行时 |
| CSS 选择器 | 全部以 `.ds-wb-page.ds-wb-v1279` 或 `.ds-root` 限定 | 不污染编辑器/终端等其它视图；无 `!important`（除 reduced-motion） |
| 内存 | 无新 ref/定时器/listener | 状态与副作用保持原样 |
| 主题切换 | 纯 CSS token/color-mix | 无 JS 重渲染 |

**目标浏览器**：DSH Web GUI 现代 Chromium（`color-mix` / `backdrop-filter` 可用）。降级：不支持 `color-mix` 时相关装饰属性失效但不影响布局与文字；`backdrop-filter` 失效时页面头仍为 92% 不透明表面。无 IE/旧 Safari 支持承诺（与现有插件一致）。

## 6. 可访问性实现清单

- 语义：`header` 页面头 + `h1` 工作台 + 三个 `<section aria-labelledby>` + `h2` 区块标题 + hero `h2`；rail `<ol aria-label>`；时间轴 `<ol>`；按钮全部 `type="button"`。
- 键盘：页面头动作/hero CTA/note/告警/卡片/时间轴顺序与阅读顺序一致；`:focus-visible` 2px 环；Enter/Space 由原生 button 触发。
- 屏幕阅读器：rail 每步显示阶段名 + `sr-only` 状态；环内有 4/7 文本；所有 icon button 有 `aria-label`；纯装饰 SVG/段条 `aria-hidden`。
- 对比：浅色正文 17.85/7.58/4.76，深色 16.34/5.84，hero 18.72；详见 [design.md §8.2](design.md)。
- 动效：`prefers-reduced-motion: reduce` 关闭全部 transition/animation。
- 触控：hero 主/次 CTA 44px；icon 按钮视觉 32、外层 44；卡内链接行高 ≥24。

## 7. 质量门与后续

- 回归：`npm run check`（21 模块）、`check:json`、`npm test`（31/31）、pipeline/review/assignments selftest、新增 `qa-static-v1279`。
- 静态断言将覆盖：页面头/h1/eyebrow、深色 hero 渐变与 ring、rail 7 段、三列/两列/单列断点、delivery 2 列 + 全宽条、44px、focus-visible/reduced-motion、i18n 成对无死键、版本 1.2.79、无新增依赖/无 `dangerouslySetInnerHTML`。
- 后续可选（不在本轮）：折叠/记忆、主题专项、把工作台拆分为模块；均需另立轮次。
