# 工程调研与借鉴决策：v1.2.84「验收台分区可收起」（第 12 轮）

> 角色：development 阶段「工程调研」子任务｜日期：2026-10-27（Asia/Shanghai）｜**访问日期统一 2026-10-27**
> 工作区基线：根 `package.json` **1.2.85** / 插件 **1.2.83**（本轮目标插件 **1.2.84**；交付后根版本 +1 至 1.2.86 由实现阶段执行）。
> 上游：[requirements.md](requirements.md)（第 12 轮：§3 范围 / §4 约束 / §6 行为规格 / §7 验收 10 条）、[design.md](design.md)（§17，尤其 **17.3 D1–D8** 与 **17.12 交接**）。
> 本文只做调研、决策与风险结论，**不改任何代码、`package.json`、`CHANGELOG.md`、其它 docs、`.dsh/` 状态，不改版本**；实现落点供开发/测试对齐。
> **结论先行**：**不引入任何第三方依赖、不复制第三方代码/样式/图标/文案**；采用 **「借鉴 W3C APG / GOV.UK / Radix / Headless UI 的可访问性契约与交互模式 + 复用仓库既有 `ds-wb-reqlog-toggle` disclosure 范式 + 原生 `button` / `aria-*` / `hidden` 自实现」**。4 个候选许可证明确（3×MIT + 1×W3C Software and Document License），依赖与 CVE 均可查（3 个 npm 包 OSV/GitHub Advisory 均 0 条），唯一 blocked 是 Ant Design Collapse 文档（抓取失败），**非必需来源，不构成整体 blocked**。

---

## 1. 背景与调研范围

### 1.1 本轮要解决什么

本轮**不是加功能**，而是把验收台里「日常主内容」与「低频工具」分层。现状（v1.2.83 基线）是一个单一竖向流：toolbar → hint → 计数 → 添加 → 筛选 → 模板 → 批量 → 清单 → 选中详情 → 证据库 → 复测中心 → 交付与预览分享，低频块固定占位，清单被反复挤压。

| 维度 | 现状问题（v1.2.83 基线） | 本轮目标 |
|---|---|---|
| **信息层级** | 主内容（清单 + 状态计数）与低频工具（证据 / 复测 / 交付）同层堆叠 | 清单为主内容常显并占满剩余高度；三块低频工具收进可折叠区块 |
| **默认态** | 三块固定展开；证据库自带 32% 高度上限 | 三块**默认收起**，只露 44px 区块头（标题 + 摘要徽标 + 箭头） |
| **记忆** | 无任何折叠偏好存储 | localStorage 单键 JSON 持久化，损坏/不可用回退默认 |
| **一键复原** | 无 | 「全部收起 ⇄ 全部展开」，一次作用于三区块 + 全部分组 + 详情 |
| **主内容** | 选中详情渲染在清单之后，选中即压缩清单 | 详情可展开/收起，收起保留选中；清单保底高度 + 独立滚动 |
| **分组** | 分组头是 `div`，不可交互 | 分组头改 `button`，可折叠 + 数量徽标 + 持久化 |
| **a11y** | 无折叠语义 | `button` + `aria-expanded` / `aria-controls` + `hidden` + Enter/Space + `:focus-visible` |
| **i18n** | 无折叠文案 | zh/en 成对新增折叠相关键，无硬编码中文 |
| **性能** | 全量常驻渲染 | 折叠为同步本地状态 + `hidden`，不重挂载、不新增请求、0 依赖 |

### 1.2 调研问题

1. disclosure / accordion 的 ARIA 与键盘契约是什么？哪些是标准强制、哪些是实现选择？
2. 成熟实现（GOV.UK、Radix、Headless UI）在「默认收起 / 持久化 / 全量开合 / 分组折叠」上如何取舍？哪些做法可以借鉴？
3. 是否值得引入 Radix / Headless UI 等现成组件库？引入后的包体、供应链、生命周期语义与本需求是否匹配？
4. `localStorage` 单键 JSON 的**安全解析**与容错边界是什么（坏值、超大值、原型污染、隐私模式、多标签页）？
5. 折叠的运行时成本有多大、如何测量？能否满足「每次切换 <16ms、包体 0 依赖、不新增网络请求」？

### 1.3 范围边界（明确不做）

- 不引入第三方 UI 库、组件库、字体、图标包、运行时服务；不改 `package.json` 依赖与构建步骤（浏览器客户端仍走 `window.__ModuleLoader__` + `require('react')` 的既有装载方式）。
- 不改 Host API（`acceptance.js` 路由与字段零改动）、不改 `.dsh/*.json` 数据结构、不做数据迁移。
- 不改其它面板（工作台 / 流水线 / 任务 / 文件树 / SSH / Git / 预览分享）布局。
- 不做折叠高度动画、拖拽排序、自定义布局、多面板并列、per-root 偏好隔离；不引入原生 `<details>/<summary>` 组件。
- 不复制第三方受版权保护的源码、CSS、SVG/图标、字体、文案、界面素材；只借鉴不受版权保护的交互模式与 Web 标准语义。
- 本文不改版本：插件 `1.2.83 → 1.2.84`、`CHANGELOG.md`、`docs/ACCEPTANCE.md` 批次 22 由实现/文档阶段完成。

### 1.4 基线审计（调研时工作区事实）

> 行号为 **2026-10-27 ~21:45 快照**；本工作区存在并行开发会话，`client.js` 行号会持续漂移，**以符号/类名为准**（design §17.12 已声明 ±2 行口径，实际漂移更大）。本表只列调研决策需要的既有能力，不评估并行实现质量。

| 事实 | 证据（符号 / 位置，快照） | 对本轮的意义 |
|---|---|---|
| 本地存储读写已有安全封装 | `function readStorage(key)` / `function writeStorage(key, value)`（约 4282 / 4290），两者均 `try/catch`，storage 不可用时 `readStorage` 返回 `null`、`writeStorage` 静默 | **直接复用**，不新增存储工具函数 |
| 已有完整 disclosure 范式 | `ds-wb-reqlog-toggle`（约 18418–18440）：`h('button', { type:'button', 'aria-expanded': …?'true':'false', 'aria-controls':'ds-wb-reqlog-body' })` + 内容 `h('div', { id, hidden: … ? undefined : true })` + `ChevronUpIcon`/`ChevronDownIcon`（约 4056/4060） | **本轮直接沿用该范式**扩展到验收台，不新造轮子；`hidden` 布尔语义与 `aria-expanded` 同步已有先例 |
| 验收台是单一渲染函数 | `function renderAcceptancePanel()`（约 17315），返回单一竖向流容器 | 折叠需要新增区块容器 + 区块头，但**不拆文件、不改 Host** |
| 折叠偏好键已声明 | `const ACCEPTANCE_COLLAPSE_KEY = 'dsh-web-filebrowser:acceptance-collapse'`（约 63）及读/写辅助（约 4307/4337，快照显示并行实现已开始） | 键名与 requirements §6.2 / design §17.4 一致；本文只确认契约，不评测实现 |
| `hidden` 需显式覆盖 flex 布局 | 快照已见 `.ds-acc-block-body[hidden] { display: none }`、`.ds-acc-detail-body[hidden]`、`.ds-acc-group-body[hidden]`（约 25858 / 25877 / 25884） | **必须保留**：若内容容器被作者样式设为 `display:flex`，UA 的 `[hidden]{display:none}` 会被作者样式覆盖，折叠视觉会失效（见 §7.2 R1） |
| 焦点样式已有品牌 token 先例 | `.ds-wb-reqlog-toggle:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px }`（约 26026） | 验收台折叠头沿用 `--dsw-alias-brand-primary` + `outline-offset:-2px`（避免被面板 `overflow:hidden` 裁切） |
| 现有依赖面很小 | 根 `dependencies` 仅 `ssh2@^1.17.0`、无 `devDependencies`；插件 `dependencies` 为 `@xterm/addon-fit` / `@xterm/xterm` / `ssh2`；浏览器侧第三方资产以 `vendor/`（`xterm.js` + `LICENSE.xterm`）方式随包分发 | **新增 UI 依赖不是一行 `npm i`**：需要新增 npm 包 + 浏览器端装载/`vendor` 路径 + 许可证声明，成本远高于自写约 100 行 |
| 验收数据规模（快照） | `.dsh/acceptance.json`：items **64** 条、分类 **36** 个、证据挂载 **50** 条、`.dsh/evidence` **23** 个文件（requirements §1 记录为 54 条，测试阶段仍在增长） | 折叠是「DOM 保留 + `hidden`」而非卸载，数量级下内存/渲染可接受；分组 key 数量约 36，单键 JSON 体量小 |
| i18n 为内联词典 | `acceptance.*` 在 zh/en 词典内（快照中 zh 约 830–1000 行、en 约 2200 行区间） | 新增折叠文案必须成对加入；验收项 8 会 grep 硬编码 |
| 无已有折叠动画/无 storage 事件监听 | 现有 `ds-wb-reqlog` 无动画；仓库未见 `storage` 事件跨标签同步 | 本轮沿用「无动画、无跨标签同步」，多标签最后写入者生效（见 §5.5） |

---

## 2. 候选调研

### 2.1 检索方式（可复现）

| 手段 | 用途 | 本次结果 |
|---|---|---|
| `web_search`（1 次，4 条 query 合并） | 定位候选文档与仓库 | 返回 APG、GOV.UK、Radix、Headless UI、unpkg 等 8 条来源 |
| `web_fetch`（4 次） | 读取候选文档正文 | **4/4 HTTP 200 且读到正文**（W3C APG、GOV.UK、Radix Collapsible、Headless UI Disclosure） |
| `web_fetch`（1 次，失败） | Ant Design Collapse 文档 | `TypeError: fetch failed` → 记入 §2.5 blocked，不引用 |
| `curl` + MDN | 辅助标准：`hidden` 全局属性、`Storage.setItem`、`Storage`、`window.localStorage` | 4/4 HTTP 200，读正文 |
| GitHub REST API | `repos/{owner}/{repo}`、`commits?per_page=1`、`commits?since=…`、`releases/latest`、`tags`、`license`、`contents/package.json` | 4 个仓库均 200；Radix 的 `/releases/latest` 为 404（见 §2.5） |
| npm registry | `{pkg}/latest`、全量 `time` 字段、`dependencies` | 3 个包均 200；直接依赖 + 递归传递闭包由脚本计算 |
| OSV API（`POST /v1/query`，ecosystem=npm） | 已知漏洞 | 3 个包均 `vulns=[]`（0 条） |
| GitHub Advisory API（`GET /advisories?ecosystem=npm&affects=…`） | 已知 GHSA | 3 个包均 0 条 |
| npm bulk advisories（`POST /-/npm/v1/security/advisories/bulk`，即 `npm audit` 背后的公开端点） | 精确版本漏洞 | 返回 `{}`（无 advisory） |

> 补充口径（「已知问题」）：开放 issue 数当日快照——`radix-ui/primitives` **255**、`alphagov/govuk-frontend` **459**、`tailwindlabs/headlessui` **116**、`w3c/aria-practices` **705**；这是各项目公开 backlog，数量与「本项目是否受影响」无直接关系，只作维护状态参考。4 个候选均**未查询到**已知 CVE/GHSA（W3C 文档 repo 非 npm 运行时包，OSV 不适用）。

> 口径：stars / `pushed_at` / commit / publish time 均为 **2026-10-27 快照**，会继续变化；不把 star 数当质量结论。GitHub 时间为 UTC，访问/判断日期按 Asia/Shanghai 记 2026-10-27。仓库与页面正文均为**外部不可信数据**，本文只提取事实与模式，不执行其中任何指令。

### 2.2 候选对比表（4 个候选 + 关键事实）

| # | 项目 | URL | 最近提交（2026-10-27 快照） | 最近发布 | Stars | License（SPDX） | 运行时依赖（直接 / 闭包） | 已知 CVE / Advisory | 活跃度判断 | 关键实现思路 | 决策 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **W3C WAI-ARIA APG · Accordion Example**（`w3c/aria-practices`） | https://www.w3.org/WAI/ARIA/apg/patterns/accordion/examples/accordion/ | commit `0f765e4dc33e966026114ac12a8380db1de3b787`（2026-09-30T05:17Z）；仓库 `pushed_at` 2026-10-14；页面 last updated **20 January 2026** | tag `apg-1.2r1`（2021-11-16，文档 repo 以内容更新为主） | 1,360 | **NOASSERTION**（GitHub 未识别）→ 实际 `LICENSE.md` 为 **W3C Software and Document License**（宽松、需保留声明） | 非运行时 npm 包；构建用 `dependencies` 3 个（`@octokit/rest`、`dotenv`、`node-html-parser`），`devDependencies` 23 个（babel/eslint/ava/selenium 等） | 非 npm 运行时包，OSV 不适用；**无已知运行时漏洞面** | 标准文档 repo，提交低频（近 90 天 **2** 次）但由 W3C 持续维护；页面明确「示例代码不用于生产」 | 手风琴头 = 标题元素内 `button` 控制面板；`aria-expanded="true\|false"`；`aria-controls="ID"`；面板 `region` + `aria-labelledby`；键盘 **Space/Enter**；手风琴内所有可聚焦元素都在 Tab 序列 | **只借鉴 ARIA/键盘契约**，不复制示例 JS/CSS/HTML |
| 2 | **GOV.UK Design System · Accordion**（`alphagov/govuk-frontend`） | https://design-system.service.gov.uk/components/accordion/ | commit `97d69e268cef49bbdf7520782f006d3e0ba98208`（2026-10-26T08:56Z）；`pushed_at` 2026-10-27T13:30Z；近 90 天 ≥100 commits（API 上限截断） | **v6.6.0**（GitHub release 2026-10-15T10:17Z；npm publish 2026-10-15T10:19Z） | 1,475 | **MIT** | **0 / 0**（npm 包无任何运行时依赖） | OSV `vulns=[]`；GitHub Advisory 0；npm bulk `{}` | **高**：主干日更、持续发版 | 手风琴通常**初始全部隐藏**；标题按钮 = 标题文本 + 摘要行（可选、**必须尽量短**）+ 显示/隐藏动作，读屏读成一句；稳定唯一 `id` 才能保持展开状态；**不要嵌套手风琴**；**不要把所有用户都要看的内容放进手风琴**；无 JS 时全部内容以标题形式可见 | **借鉴「默认隐藏 + 短摘要 + 稳定 id + 不嵌套 + 主内容不折叠」**；不复制其 Nunjucks 宏、CSS class 体系与 JS 模块 |
| 3 | **Radix UI Primitives · Collapsible**（`radix-ui/primitives`） | https://www.radix-ui.com/primitives/docs/components/collapsible | commit `eb3a2b7091293e27df8f9ba906632d8daa3d81a3`（2026-10-14T19:06Z）；`pushed_at` 2026-10-14 | GitHub **无** `/releases/latest`（404，仓库走 changesets/npm 发版）；npm `@radix-ui/react-collapsible` **1.2.1**（publish 2026-10-12T21:03Z；仓库最新 tag `1.6.7`） | 19,437 | **MIT** | **8 / 10**（全部为同组织 `@radix-ui/*` 首方小包） | OSV `vulns=[]`；GitHub Advisory 0；npm bulk `{}` | **高**：近 90 天 ≥100 commits、10 月仍在发版 | 受控/非受控（`open` / `defaultOpen` / `onOpenChange`）；`data-state="open\|closed"`；源码确认 `Content` 默认用 `<Presence present={forceMount \|\| open}>`，**收起即卸载**，要常驻必须 `forceMount`；`Trigger` 的 `aria-controls` 仅在展开时输出；暴露 `--radix-collapsible-content-height/width` 供高度动画；遵循 Disclosure APG，Space/Enter 切换；文档标注版本 1.1.21 / bundlephobia **4.67 kB** | **只借鉴受控状态模型与 `data-*` 样式钩子**；**不引入依赖**（见 §4.2） |
| 4 | **Headless UI · Disclosure**（`tailwindlabs/headlessui`） | https://headlessui.com/react/disclosure | commit `eea57cf46fd6767ed1059012f7073b88eb159fba`（**2026-04-13**T16:12Z）；`pushed_at` 2026-04-13；**近 90 天 0 commits** | npm `@headlessui/react` **2.2.10**（publish 2026-04-07T17:12Z；GitHub release `@headlessui/react@v2.2.10` 2026-04-07T17:11Z） | 28,803 | **MIT** | **5 / 21**（`@react-aria/focus`、`@floating-ui/react`、`@tanstack/react-virtual`、`use-sync-external-store`、`@react-aria/interactions`） | OSV `vulns=[]`；GitHub Advisory 0；npm bulk `{}` | **中低**：截至 2026-10-27 已约 **6.5 个月**无提交、无发版（命中「维护活跃」评估的减分项） | `Disclosure` / `DisclosureButton` / `DisclosurePanel` 自动接好 `aria-expanded` / `aria-controls`；`defaultOpen` 默认 `false`；键盘 Enter/Space；`DisclosurePanel` 的 **`unmount` 默认 `true`（收起即卸载）**；`data-open` 属性样式钩子；`close()` 关闭后把焦点还给按钮 | **只借鉴自动 ARIA 接线与焦点归还模式**；**不引入依赖**（见 §4.2） |

### 2.3 逐项判断（事实 → 借鉴 → 不采用 → 结论）

**候选 1：W3C WAI-ARIA APG · Accordion Example（W3C Software and Document License）**

- **事实**（读到的正文）：每个手风琴头是 `h3` 内一个 `button`，由它控制面板显隐；`aria-expanded` 展开为 `true`、收起为 `false`；`aria-controls="ID"` 指向面板；面板可用 `region` + `aria-labelledby` 与头部关联；键盘表中 **Space/Enter** 在头部按钮上展开收起，**Tab/Shift+Tab 覆盖手风琴内所有可聚焦元素**；页面顶部明确警告「The code in this example is not intended for production environments」。
- **借鉴**：`button` + `aria-expanded` + `aria-controls` 的真值契约；Enter/Space；焦点留在头部按钮；收起内容不参与 Tab（`hidden` 天然满足）。
- **不采用**：不复制示例 JS/CSS/HTML；不额外加 `region` / heading 层级——本项目是侧栏工具面板而非文档大纲，design §17.3 已明确不加 `role="region"`/`h2/h3`，避免与侧栏既有 landmark 冲突。
- **结论**：**模式借鉴，零代码复制，零依赖**。

**候选 2：GOV.UK Design System · Accordion（MIT）**

- **事实**（读到的正文）：手风琴通常**所有区块初始隐藏**；标题按钮包含标题文本 + 可选摘要行 + 「show/hide」动作，读屏把整段读成一句（逗号分隔）；摘要行「只有确实需要时才加，且必须尽量短」；`govuk-accordion` 容器的 `id` **必须在整个服务域内唯一**以维持持久展开状态；无 JS 时内容全部可见；**不要把手风琴嵌套手风琴**；**不要把所有用户都需要看的内容放进手风琴**；内容多到影响加载性能时不要用手风琴。
- **借鉴**：① 默认收起是成熟默认值（但只对**低频工具**）；② 头部「标题 + 短摘要」→ 本轮压成**数量徽标**；③ 持久化需要**稳定唯一 id / key**；④ 不嵌套、主内容（清单）不折叠；⑤ 无 JS 版降级 → 本项目降级为「存储不可用/损坏时回退默认值、每个区块仍可手动展开」（不伪造无 JS 场景）。
- **不采用**：不引入 `govuk-frontend` 依赖或复制其 Nunjucks 宏 / CSS class 体系 / JS 模块；不用其「隐藏的 show/hide 文案」，因为 APG 模式下 `aria-expanded` 已被读屏播报（design §17.3 已否决）。
- **结论**：**模式借鉴，零代码复制，零依赖**。

**候选 3：Radix UI Primitives · Collapsible（MIT）**

- **事实**（文档正文 + 源码核对）：`Root` 支持 `open` / `defaultOpen` / `onOpenChange` 受控或非受控；`Trigger` 是按钮；`Content` 暴露 `forceMount`，**源码为 `<Presence present={forceMount || context.open}>`——默认收起即卸载**；`Content` 关闭时还带 `hidden={!isOpen}`、`id={contentId}`；`Trigger` 的 **`aria-controls` 仅在展开时输出**（`aria-controls={open ? contentId : undefined}`），`aria-expanded` 恒输出 `open || false`；`data-state="open|closed"` 可作样式钩子；暴露 `--radix-collapsible-content-height/width` 供高度动画；文档声明遵循 Disclosure WAI-ARIA design pattern，键盘 Space/Enter；文档页标注版本 `1.1.21`、bundlephobia 体积 **4.67 kB**（npm 最新 1.2.1，版本存在轻微文档滞后）。
- **借鉴**：受控状态 + `data-state`/`data-open` 式样式钩子（本项目已有 `aria-expanded` 与 `hidden`，视觉态可由 `[aria-expanded="false"]` 选择器驱动，无需额外 data 属性）；「一个 Trigger 控一个 Content」的最小模型。
- **不采用**：① 引入需带 **10 个传递闭包包**（8 直接 + 2 传递），且浏览器客户端当前只通过 `vendor/` 分发第三方浏览器资产，新增依赖要同时处理装载路径与许可证文件；② `Content` 默认 **卸载**，与 requirements §4「收起时保留 DOM，避免丢失端口输入/命令勾选/备注草稿」直接冲突，必须 `forceMount` 才能常驻——**买了库还要改默认行为**；③ **`aria-controls` 仅在展开时输出**，而本项目验收项 6 要求折叠头**常驻** `aria-controls` 指向内容容器——采用时还得补属性；④ 不提供「三区块 + 分组 + 详情」的组合与「全部收起/展开」，适配代码量接近自写；⑤ 会引入 React peer 版本约束（`^16.8 || ^17 || ^18 || ^19`）。
- **结论**：**只借鉴状态模型与样式钩子思路，不引入依赖**。

**候选 4：Headless UI · Disclosure（MIT）**

- **事实**（读到的正文）：`Disclosure` / `DisclosureButton` / `DisclosurePanel` 自动接好 `aria-*`（文档明确「all components will receive the appropriate `aria-*` related attributes like `aria-expanded` and `aria-controls`」）；`defaultOpen` 默认 `false`；键盘表只有 Enter/Space；`DisclosurePanel` 的 `unmount` **默认 `true`（按开合卸载/挂载）**；`data-open` 属性用于样式；`close()` 关闭后默认把焦点还给 `DisclosureButton`；组件 headless、需要自己写样式。
- **借鉴**：自动 ARIA 接线的目标形态（我们自写时按同样契约断言）；`defaultOpen=false` 与「默认收起」一致；`close()` 焦点归还（本项目直接在按钮上切换，焦点天然不动，无需额外代码）。
- **不采用**：① **活跃度不足**：截至访问日约 6.5 个月无提交、无发版（2026-04-13 后 0 commits/90d），引入即承担停滞风险；② 依赖更重（5 直接 / **21 传递**）；③ `unmount` 默认 true 与「保留 DOM」冲突（需 `unmount={false}`），且同样没有「全部开合 / 分组折叠」；④ React peer 仅 `^18 || ^19`。
- **结论**：**只借鉴 ARIA 接线与焦点归还模式，不引入依赖**。

> 未单列的候选：**shadcn/ui Collapsible** 是 Radix Collapsible 的样式包装（同一套语义与依赖），不构成独立候选；**Ant Design Collapse** 文档抓取失败，见 §2.5，未据此得出任何结论。

### 2.4 辅助标准/平台来源（非候选仓库，均已读正文）

| # | 来源 | URL | 访问日期 | 关键结论（工程落点） |
|---|---|---|---|---|
| A | MDN · `hidden` HTML global attribute | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/hidden | 2026-10-27 | `hidden` 表示内容**不应呈现给用户**；浏览器可能用 `display:none` 实现，元素**不参与页面布局**；`hidden="until-found"` 是另一种「可被页内查找发现」的状态（会参与布局）；**隐藏元素的子孙仍处于活动状态**——脚本仍可执行、表单仍可提交。→ 我们用普通 `hidden`（非 `until-found`）收起内容：DOM 保留、退出布局与 Tab、不触发请求；因为验收台隐藏内容不含 `<script>`，`hidden` 不影响其「活动」性（表单/输入值保留是好事）。 |
| B | MDN · `Storage.setItem()` | https://developer.mozilla.org/en-US/docs/Web/API/Storage/setItem | 2026-10-27 | `setItem` 在**配额耗尽或用户拒绝授权更多空间**时抛 `QuotaExceededError`；写入值为字符串。→ 写入必须 `try/catch`，失败静默降级内存态（隐私模式/配额）。 |
| C | MDN · `Window.localStorage` | https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage | 2026-10-27 | localStorage 按源持久、无过期时间；**当请求违反策略决定（例如用户配置为阻止页面持久化数据）时抛 `SecurityError`**；隐私/无痕会话的 localStorage 在最后一个隐私标签关闭时清除。→ 读/写都包 `try/catch`；隐私模式回退默认值，功能仍可用。 |
| D | MDN · `Storage`（Web Storage API） | https://developer.mozilla.org/en-US/docs/Web/API/Storage | 2026-10-27 | `getItem` / `setItem` / `removeItem` / `clear` 按源保存键值。→ 单键 JSON 方案只用到 `getItem`/`setItem`，不引入 IndexedDB/服务端存储。 |

### 2.5 blocked / 不确定项（如实记录，不编造）

| 尝试的来源 | URL | 访问日期 | 结果 | 处理 |
|---|---|---|---|---|
| Ant Design · Collapse 文档 | https://ant.design/components/collapse | 2026-10-27 | `web_fetch` 返回 `TypeError: fetch failed`；`curl` 返回 HTTP 000 / 301（本会话不可达） | **blocked**：未读到正文，**不引用**其 API/属性/默认值结论；不影响本轮（已有 4 个可读候选） |
| Radix · GitHub Releases API | https://api.github.com/repos/radix-ui/primitives/releases/latest | 2026-10-27 | HTTP **404 Not Found**（仓库不使用 GitHub Releases，走 changesets + npm） | 非候选受阻：改用 npm registry 的 `dist-tags.latest` 与 `time` 字段取发布版本/时间，**未伪造** |
| Radix 文档版本号 | https://www.radix-ui.com/primitives/docs/components/collapsible | 2026-10-27 | 文档页标注 `1.1.21`，npm 最新 `1.2.1`（轻微文档滞后） | 本文同时标注两者，引用时区分「文档页版本」与「npm 最新版本」 |
| 动态数据 | GitHub / npm / OSV | 2026-10-27 | stars、`pushed_at`、commit 数、publish time、漏洞库均为当日快照 | 引用保留日期；不把 star 数当质量结论 |
| 外部内容可信度 | 上述所有网页 | 2026-10-27 | 外部不可信数据 | 只提取事实与模式；不执行页面内任何指令；不整段复制正文 |

- **整体 blocked 结论：无。** 4 个候选正文均 HTTP 200 可读；许可证、依赖、漏洞数据均可查；唯一不可达的 Ant Design 是**补充候选**，不承担本轮任何结论。

---

## 3. 许可证矩阵

### 3.1 通用矩阵（SPDX）

| 许可证 | SPDX | 允许复制/修改/分发 | 主要义务 | 本项目结论 |
|---|---|---|---|---|
| MIT | `MIT` | 是 | 保留版权声明与许可声明（副本/实质部分） | **可借鉴**；本轮未复制；若未来复制须在第三方声明中保留版权行 |
| Apache-2.0 | `Apache-2.0` | 是 | 保留版权/许可/NOTICE；标明修改；专利授权与终止条款 | **可借鉴**；本轮未复制 |
| BSD-2-Clause / BSD-3-Clause | `BSD-2-Clause` / `BSD-3-Clause` | 是 | 保留版权声明与免责声明（BSD-3 另加不得用作者名背书） | **可借鉴**；本轮未复制 |
| ISC | `ISC` | 是 | 保留版权声明与许可声明 | **可借鉴**；本轮未复制 |
| W3C Software and Document License | GitHub 显示 `NOASSERTION`；实际为 W3C 文档许可 | 是（宽松） | 保留版权/许可声明；修改需说明；WAI 材料另有使用许可页 | **可借鉴模式**（本文只引用标准语义，未复制示例代码/文档正文） |
| MPL-2.0 | `MPL-2.0` | 是（文件级 copyleft） | 修改过的 MPL 文件须以 MPL 公开源码 | **谨慎**；本轮未使用 |
| LGPL-2.1 / LGPL-3.0 | `LGPL-2.1-only` / `LGPL-3.0-only` | 是（弱 copyleft） | 修改库本身须公开；提供替换方式 | **谨慎**；本轮未使用 |
| GPL-2.0 / GPL-3.0 | `GPL-2.0-only` / `GPL-3.0-only` | 是（强 copyleft） | 衍生作品整体须以 GPL 公开源码 | **禁止复制代码**；只可借鉴不受版权保护的模式/思想 |
| AGPL-3.0 | `AGPL-3.0-only` | 是（网络 copyleft） | 通过网络提供服务也触发源码提供义务 | **禁止复制代码**；只可借鉴模式 |
| 无许可证 / 未知 | `NOASSERTION` / 无 | 默认保留所有权利 | 不可复制/修改/分发 | **禁止复制代码/素材**；只可借鉴模式 |

> 许可证矩阵是工程合规基线，不构成法律意见；未来若引入依赖或复制代码，须由 Owner 确认并在发布前补充第三方声明。

### 3.2 本轮候选的许可证证据

| 候选 | SPDX | 证据（2026-10-27） | 结论 |
|---|---|---|---|
| `radix-ui/primitives` | **MIT** | GitHub API `repos/radix-ui/primitives` 返回 `license.spdx_id = "MIT"` | 允许借鉴；本轮未复制 |
| `alphagov/govuk-frontend` | **MIT** | GitHub API `license.spdx_id = "MIT"`；npm `govuk-frontend@6.6.0` `license = "MIT"` | 允许借鉴；本轮未复制 |
| `tailwindlabs/headlessui` | **MIT** | GitHub API `license.spdx_id = "MIT"`；npm `@headlessui/react@2.2.10` `license = "MIT"` | 允许借鉴；本轮未复制 |
| `w3c/aria-practices` | GitHub `NOASSERTION` → **W3C Software and Document License** | GitHub API `/license` 返回 `license.spdx_id = "NOASSERTION"`，读取 `LICENSE.md` 原文：「All documents in this Repository are licensed by contributors under the [W3C Software and Document License]」 | 允许借鉴；本轮仅引用标准语义，未复制示例代码/文档正文 |
| MDN 文档（辅助来源） | 内容另有其许可 | 本文只做标准行为的事实引用，**不复制**正文、示例代码或样式 | 不产生复制 |

### 3.3 本轮结论（合规）

1. **不引入任何第三方依赖**：根/插件 `package.json` 依赖零变化，无新增 lockfile 条目、无构建脚本变化；浏览器端不新增 `vendor/` 资产。
2. **不复制第三方代码/素材**：不复制 4 个候选的源码、CSS、SVG/图标、字体、文案、截图；只借鉴公开的交互模式与 Web 标准语义（`button` / `aria-expanded` / `aria-controls` / `hidden` / Enter/Space）。
3. **可借鉴的依据**：3 个 MIT + 1 个 W3C 宽松许可都允许借鉴甚至复制，但「允许」不等于「需要」；本轮功能用现有 `h()` + 内联 CSS + `--dsw-alias-*` token 即可完成，复制会引入维护与声明成本，没有收益。
4. **禁止清单**：GPL/AGPL/无许可证代码不进入交付物；MPL/LGPL 需逐案评估，不在本轮范围。
5. **未来复制的流程**（与仓库既有实践一致）：仓库已有 `dsh-web-filebrowser-plugin/vendor/LICENSE.xterm` 先例——若未来必须附带第三方代码，须在 `vendor/`（浏览器资产）或等价 `THIRD_PARTY_NOTICES` 中记录来源 URL、版本/commit、SPDX、版权行、修改说明；Apache-2.0 附 NOTICE；MPL 修改文件按 MPL 公开；GPL/AGPL 一律不复制。

---

## 4. build vs borrow 决策

### 4.1 决策表

| 能力 | 自建（复用现有） | 借鉴 | 决策与理由 |
|---|---|---|---|
| 三区块头 + 分组头 + 详情头的 disclosure | `ds-wb-reqlog-toggle` 既有范式（`button` + `aria-expanded` + `aria-controls` + `hidden` + Chevron） | APG / GOV.UK / Radix / Headless UI 的 ARIA 与键盘契约 | **自建**：范式已在仓库内，复用即得；引入库只省接线代码 |
| 区块体收起但保留 DOM | 现有 React `hidden` 布尔语义 + `[hidden]{display:none}` | MDN `hidden` 语义 | **自建**：一行 `hidden` 属性；库的默认生命周期（Radix presence / Headless `unmount:true`）反而要改 |
| 全部收起 / 全部展开 | 现有本地 state + 一次 `setState` + 一次 `setItem` | GOV.UK「初始全隐藏 + 一键复原」、NN/g「允许多块同时展开」 | **自建**：一个 `anyOpen` 派生值 + 一个按钮；库不提供组合 API |
| 徽标（数量摘要） | 现有 `ds-acc-*` 视觉 + `color-mix` token | GOV.UK「短摘要行」→ 压成徽标 | **自建**：只渲染文本节点，零依赖 |
| 选中详情折叠 | 现有 `selected === null ? null : …` + 新 `detailOpen` | APG disclosure | **自建**：选中项变化时重置 `detailOpen`，逻辑约 5 行 |
| 分类分组折叠 | 现有 groups map（分类原值） | GOV.UK「稳定 key 持久化」、NN/g「不超过两层披露」 | **自建**：分组 key 用数据原值 + `Object.create(null)` 字典 |
| localStorage 偏好 | 现有 `readStorage` / `writeStorage` + 新键 + 校验 | MDN Storage / Storage.setItem / localStorage | **自建**：单键 JSON + 白名单校验 + 整份回退 |
| 折叠高度动画 | —— | Radix CSS 变量 / Headless `transition` | **不做**：requirements §3.2 明确不做；避免与 `hidden` 语义冲突与高度抖动 |
| 键盘/ARIA 自动接线 | —— | Headless UI / Radix 的自动 `aria-*` | **自建**：断言可控（见 §7.3），不依赖库的实现细节 |

### 4.2 选型结论：Build on existing primitives（不借代码、不借依赖，借模式）

**理由（按权重）**

1. **包体 0 增量、供应链不新增**：浏览器客户端是 `window.__ModuleLoader__` + `require('react')` 的单文件形态，第三方浏览器资产以 `vendor/` 随包分发（如 `xterm.js` + `LICENSE.xterm`）。引入 `@radix-ui/react-collapsible` 意味着 **8 直接 + 2 传递**包进入分发面；引入 `@headlessui/react` 则是 **5 + 21** 包。两者都需要评估装载方式、许可证声明与升级维护，收益却只是「约 100 行接线代码」。
2. **生命周期语义不匹配**：本轮明确要求「收起时保留 DOM，避免丢失端口输入、复测命令勾选、备注草稿」。**Radix 源码**为 `<Presence present={forceMount || open}>`——默认收起即卸载；**Headless UI 文档**明确 `DisclosurePanel` 的 `unmount` 默认 `true`。引入后第一件事就是改它们的默认行为；此外 Radix 的 `aria-controls` 只在展开时输出，而验收项 6 要求折叠头**常驻** `aria-controls`——**买了库还要补属性**，与「借库省事」的初衷相反。
3. **没有现成的组合**：需求是「三区块 + 分组 + 详情」的联动「全部收起/展开」+ 单键持久化 + 分类原值 key。Radix/Headless 只提供单块 disclosure 原语，组合、持久化、徽标、窄栏截断仍要自己写；`govuk-frontend` 是整套设计系统（CSS + Nunjucks + JS 模块），与本项目 `--dsw-alias-*` token 体系并存会造成样式与维护双轨。
4. **a11y 断言可控**：验收项 6 直接断言 DOM（`button`、`aria-expanded` 真值、`aria-controls` 命中唯一 id、`hidden`、焦点环、Tab 跳过）。自写时这些属性由我们显式设置，可静态 grep + 运行断言；封装库会隐藏属性与生命周期，反而增加测试不确定性。
5. **既有范式已验证**：`ds-wb-reqlog-toggle` 就是同一套 disclosure（`button` + `aria-expanded` + `aria-controls` + `hidden` + Chevron + `:focus-visible`），复用它让验收台与工作台行为一致，风险最低。

### 4.3 明确不采用的替代方案

| 替代方案 | 不采用理由 |
|---|---|
| 引入 `@radix-ui/react-collapsible`（MIT） | 10 个传递包 + 默认卸载语义与本需求冲突（要 `forceMount`）+ 无组合/持久化 API；新增浏览器分发资产与许可证声明 |
| 引入 `@headlessui/react`（MIT） | 近 6.5 个月无提交（供应链停滞风险）+ 21 个传递包 + `unmount:true` 默认 + 仅 React 18/19 peer |
| 引入 `govuk-frontend`（MIT） | 整套设计系统（CSS + 宏 + JS 模块），与现有 token/`h()` 体系双轨；本轮只需要一个 disclosure 模式 |
| 原生 `<details>/<summary>` | 受控 React 渲染 + 持久化 + `aria-expanded` 断言；`<summary>` 内放徽标与嵌套可聚焦元素的浏览器行为不一致；且需求明确不引入 `<details>` 组件 |
| 复制 APG 示例 JS/CSS 或 Radix/Headless 源码 | 许可证允许（MIT/W3C）但无必要；示例明确「不用于生产」；复制会带来样式/维护/声明成本 |
| 把状态放 Host / `.dsh/*.json` | 需求明确偏好只进浏览器 localStorage；Host 写入会引入 API 与数据迁移面 |
| 条件渲染（卸载/挂载）代替 `hidden` | 会丢失端口输入、命令勾选、备注草稿等会话内状态；与 requirements §4 冲突 |
| 折叠高度动画 | 需求明确不做；`hidden` + 高度动画语义冲突，且引入每帧布局成本 |
| 引入全局状态库（Zustand/Jotai 等） | 折叠状态是面板内单一局部状态，React `useState` 足够；新增依赖无收益 |

### 4.4 实现蓝图（供开发对齐，本文不写代码）

**数据流**

```
renderAcceptancePanel()
  ├─ readAcceptanceCollapse()  ← 面板首次渲染读一次（bad value → 默认）
  ├─ state: { blocks:{evidence,verify,delivery}, groups:{<category>:boolean}, detailOpen }
  ├─ 区块头 button → toggleBlock(key) → setState + writeAcceptanceCollapse(next)
  ├─ 分组头 button → toggleGroup(categoryKey) → setState + write
  ├─ 详情头 button → setDetailOpen → 不写存储（随选中状态）
  ├─ 全部收起/展开 button → setAllCollapsed(!anyOpen) → 一次 setState + 一次写
  └─ 内容容器 hidden={open ? undefined : true}（保留 DOM，不卸载）
```

**存储契约（与 design §17.4 一致）**

```json
{
  "blocks": { "evidence": false, "verify": false, "delivery": false },
  "groups": { "验收 · 折叠与持久化": true, "__uncat__": true }
}
```

- 键：`dsh-web-filebrowser:acceptance-collapse`（已声明为 `ACCEPTANCE_COLLAPSE_KEY`）。
- 读取一次；`JSON.parse` + 类型白名单校验；**任一结构不符 → 整份回退默认**（三块收起、分组展开、详情展开）。
- 写入：区块/分组切换、「全部收起/展开」后立即写；一次操作一次 `JSON.stringify` + 一次 `setItem`；`try/catch` 静默失败。
- `detailOpen` **不持久化**（随选中项；刷新后按现状不记忆选中）。

**函数契约（工程级，不锁实现细节）**

| 函数 | 输入 | 输出/副作用 | 失败行为 |
|---|---|---|---|
| `readAcceptanceCollapse()` | 无 | `{ blocks, groups }` 合法值 | 任何异常/坏值 → `DEFAULT_COLLAPSE`（不抛错） |
| `writeAcceptanceCollapse(next)` | 已校验的合法值 | `localStorage.setItem(KEY, JSON.stringify(next))` | `try/catch` 静默；内存态继续工作 |
| `toggleBlock(key)` | `'evidence' \| 'verify' \| 'delivery'` | `setState(prev => …)` + 写存储 | 幂等（连续点击按 `!prev`） |
| `setAllCollapsed(collapsed)` | boolean | 一次 setState 覆盖 blocks/groups/detailOpen + 一次写 | 幂等 |
| `groupKeyOf(item)` | acceptance item | `item.category?.trim() \|\| '__uncat__'` | 永不返回空字符串 |

**不可偏离（与 design §17.12.1 对齐）**

- 三个区块头 / 分组头 / 详情头必须是 `button` + `aria-expanded` + `aria-controls` + 内容 `hidden`；切换后焦点留在按钮。
- 区块头是**单按钮**，内部不得嵌套其它可聚焦元素。
- 收起保留挂载；折叠**不发起网络请求**；不做高度动画。
- 存储键名、JSON 形状、默认值、分组 key 用分类原值；损坏整份回退。
- 中英文案成对；颜色只用 `--dsw-alias-*` token / `color-mix`，不硬编码语义色。
- 不改 Host API / `.dsh` 数据结构 / 依赖 / 其它面板。

### 4.5 调研时实现快照（并行开发中，不阻断，仅供收尾核对）

> 调研时（2026-10-27 ~21:45）工作区已有并行实现痕迹；本节只记录**观察到的现状**，不评价、不作为验收依据，最终以提交与测试为准。

| 观察点 | 快照 | 收尾建议 |
|---|---|---|
| 存储键与辅助函数 | 已见 `ACCEPTANCE_COLLAPSE_KEY`（约 63）、读取约 4307、写入约 4337 | 确认坏值整份回退 + 字段白名单（见 §5.1） |
| 折叠头/体 | 已见 `ds-acc-block-toggle`（约 17396）、`ds-acc-block-body`（约 17829 起）、三块 `hidden` 绑定（17829/17891/17966） | 确认三个 body 的 `hidden` 绑定同一 state、`aria-controls` 命中 id |
| 分组/详情 | 已见 `.ds-acc-group-head`（约 17638）、`ds-acc-detail-toggle`（约 17714） | 确认分组头是 `button` 且 body `hidden` |
| `hidden` 覆盖 | 已见 `.ds-acc-block-body[hidden]` / `.ds-acc-detail-body[hidden]` / `.ds-acc-group-body[hidden]` | **保留**；否则 flex 内容会在收起时仍占布局 |
| 焦点/键盘 | 已见 `.ds-acc-block-toggle:focus-visible`（约 25850）等 `outline-offset: -2px` | 确认所有折叠头（含分组/详情）都有 `:focus-visible` |
| 全部收起/展开 | 已见 `acceptance.collapseAll` / `expandAll` / `…Title` zh+en 键 | 确认文案随 `anyOpen` 动态切换 |
| 证据缩略图 | 证据项是 `<img loading="lazy" src=rawUrl…>` | 默认收起时隐藏的懒加载图不应立即请求；展开后按视口加载（见 §6.2 测量） |

---

## 5. 安全结论

### 5.1 localStorage 单键 JSON 的解析与校验契约

| # | 规则 | 说明 / 理由 |
|---|---|---|
| S1 | **只用一个键** `dsh-web-filebrowser:acceptance-collapse`，值为 JSON 字符串 | 与现有 `dsh-web-filebrowser:*` 命名一致；不新增多个键，减少攻击/污染面 |
| S2 | **解析只用 `JSON.parse`**，包 `try/catch`；**不使用** `eval` / `new Function` / `JSON5` / `import()` | JSON.parse 不执行代码；坏值只产生异常，不是执行面 |
| S3 | **解析前长度上限**：若原始字符串超过上限（建议 **16 KiB**）→ 直接回退默认，不解析 | 单键正常值约数百字节（3 个 block + ≤36 个分组）；16 KiB 足够宽松，同时挡住「人为塞超大值」造成的解析/校验耗时 |
| S4 | **结构白名单**：根必须是普通对象；`blocks` 只接受 `evidence` / `verify` / `delivery` 三个键且值必须是 boolean | 未知键忽略；`blocks` 里塞 `__proto__`/`constructor`/数组等一律不进入状态 |
| S5 | **分组校验**：`groups` 必须是普通对象；键为字符串且长度 ≤ 120；值必须是 boolean；**最多 256 个条目**；跳过 `__proto__` / `constructor` / `prototype` | 分类名来自数据，正常 ≤ 几十个；上限挡住膨胀。跳过危险键避免原型污染（即使当前只赋值 boolean 也应防御） |
| S6 | **构造全新对象**：逐字段读取后写入新对象（`{}` 或 `Object.create(null)` 作字典），**不** `Object.assign(state, parsed)`、不 `...parsed` 展开不可信对象 | 防止不可信对象携带额外属性进入 React state / 后续 `JSON.stringify` |
| S7 | **任何不符 → 整份回退默认**（不全量合并、不部分采纳） | 行为可预测，验收项 2 可观察；避免「坏值被部分接受」造成的隐性状态 |
| S8 | **写入只写已校验的规范对象**：先由 state 构造 `{blocks, groups}`，再 `JSON.stringify`；**不把 DOM/输入框/URL 参数**写进去 | 存储内容完全由代码产生，不含用户自由文本（分组 key 来自数据分类，已是受控字符串） |
| S9 | **读/写都 `try/catch`**：`SecurityError`（策略阻止持久化）、`QuotaExceededError`（配额）、隐私模式 → 静默降级内存态 | MDN 已确认这两类异常语义（§2.4 B/C）；UI 不报错、不崩溃、不 toast |
| S10 | **不做迁移、不做版本号**：旧 schema/坏值一律回退默认 | requirements §6.2 明确「不做版本迁移」；避免迁移代码成为新的解析面 |

### 5.2 无新增网络请求 / 无 Host 面

- 折叠/展开只做 `setState` + `localStorage.setItem`：**不调用 `fetch`、不新增 Host 路由、不改 `acceptance.js`**；`setItem` 是本地存储 API，不产生网络。
- 折叠**不改变**任何既有请求：证据列表、复测记录、预览分享、交付历史的加载仍由既有 effect 决定，与折叠状态无关。
- 唯一与网络相关的变化是**减少**：默认收起后，证据库里的 `<img loading="lazy">` 缩略图不在视口 → 首屏少发起 raw 请求；展开后按既有 `loading="lazy"` 行为加载，与 v1.2.83 常显时等价，不新增请求类型或上限（见 §6.2 验证）。
- 不扩大 SSH/文件 API 能力边界；不新增 `window.open`、`iframe`、`postMessage`。

### 5.3 注入与 XSS 面

| 风险 | 控制 | 依据 |
|---|---|---|
| 折叠头标题/徽标注入 HTML | 全部走 React 文本子节点（`h('span', null, text)`）与 `title` 属性；**不使用** `innerHTML` / `dangerouslySetInnerHTML` / `insertAdjacentHTML` | 仓库既有渲染风格；React 自动转义 |
| 分类名/证据文件名注入 | 同上：文本节点 + `title`；不做字符串拼 HTML | 分类名来自验收数据，仍按不可信处理 |
| DOM id 注入 / DOM clobbering | 区块 id 为固定字面量 `ds-acc-<block>-body`；分组 id 用**数字索引** `ds-acc-group-body-<index>`（不用分类名拼 id） | design §17.3 D5；避免 `id` 含空格/特殊字符与全局变量覆盖 |
| 原型污染 | 见 §5.1 S5/S6：跳过危险键 + 新对象 + 逐字段赋值 | 防御性实现，即使当前值类型受限 |
| 存储内容被第三方脚本篡改 | 存储值仍按不可信输入校验（S4–S7）；渲染全部文本节点 | 同源脚本已可控制页面，但校验保证不因坏值崩溃/注入 |
| 折叠状态成为侧信道 | 无敏感信息；仅 3 个 boolean + 分类可见性 | 低风险 |

### 5.4 拒绝服务 / 资源面（本地存储与 DOM）

| 向量 | 控制 | 残余风险 |
|---|---|---|
| 超大 JSON（本地存储被塞入 MB 级值） | S3：读取长度上限 16 KiB，超限直接默认，不解析 | 若未来放宽上限，需重新评估；当前每键有配额上限，风险低 |
| 超多分组 key | S5：最多 256 条，超出忽略；正常约 36 个分类 | 极端自定义数据下部分分组偏好不生效（功能仍可用，不崩溃） |
| 超长分类名 | S5：key 长度 ≤ 120；显示侧 `min-width:0` + `text-overflow: ellipsis` | 超长分类名被省略显示，完整名进 `title` |
| 折叠/展开高频点击 | 同步 `useState` 更新，无请求、无动画、无定时器；连续点击天然幂等 | 无 |
| `hidden` 子树常驻 DOM | 数量级：64 条验收项 + 36 分组 + 23 证据文件 + 复测命令；`display:none` 不参与布局 | 可接受；若未来数据规模数量级增长再考虑虚拟化（后续需求） |
| 折叠触发图片加载风暴（展开证据库） | 既有 `loading="lazy"` + 用户主动展开；默认收起反而减少首屏请求 | 展开瞬间可能有 N 张缩略图请求（与 v1.2.83 常显等价），测试阶段用 Network 面板确认 |

### 5.5 隐私模式 / 多标签 / 旧数据

| 场景 | 行为 | 依据 |
|---|---|---|
| 隐私/无痕模式阻止持久化 | `setItem` 抛 `SecurityError` → 静默失败；本次会话内 state 仍工作；刷新回默认（三块收起） | MDN `Window.localStorage` §2.4 C |
| 存储配额耗尽 | `setItem` 抛 `QuotaExceededError` → 静默失败，内存态继续 | MDN `Storage.setItem` §2.4 B |
| 存储值被手动改坏 / 旧 schema | `JSON.parse` 失败或结构不符 → 整份回退默认；不崩溃、不写坏值（下次用户操作会覆盖为合法值） | S6–S7；验收项 2 |
| 多标签页并发写 | 无 `storage` 事件监听；最后写入者生效；另一标签页刷新后读到最新值 | requirements 未要求跨标签同步；风险低且可接受 |
| 数据被清空（acceptance items 删除/重命名） | 分组 key 为分类原值，旧 key 残留但不渲染；无害 | design §17.3 D5「分类消失不主动清理旧 key」 |

---

## 6. 性能结论

### 6.1 结论表

| 指标 | 结论 | 说明 |
|---|---|---|
| 新增运行时依赖 | **0** | `package.json` 依赖与构建步骤不变；浏览器端无新 `vendor/` 资产 |
| 新增网络请求 | **0**（折叠操作本身） | 切状态 + `setItem`；不调用 fetch、不改既有加载 effect |
| 折叠/展开语义 | **同步本地 state + `hidden`** | 内容 DOM **保留挂载**（不卸载）；不新增 effect，折叠 state 不进入数据加载 effect 依赖，因此不触发额外请求 |
| 重挂载 | **不重挂载** | 节点位置与 key 不变；React 只重渲染该子树（vnode diff），DOM 节点保留 |
| 目标耗时 | **<16ms / 次**（一次 state 更新 + 一次 `JSON.stringify` + 一次 `setItem` + 一次布局） | 目标值，非实测值；测量方法见 §6.2 |
| 包体增量 | 仅 `client.js` 内联组件/CSS/i18n 文案的代码增量 | 具体字节以开发后实测为准，**本文不虚构数字** |
| 内存 | DOM 常驻（64 项 + 36 分组 + 23 证据 + 命令列表） | `hidden` 不参与布局；常驻是小规模列表，可接受 |
| 首屏 | 默认收起 → 证据缩略图懒加载不触发，首屏请求**不增反减** | 依赖 `loading="lazy"` + 隐藏不在视口 |
| 滚动/布局抖动 | 无动画、无 `ResizeObserver`、无每帧计算 | requirements §3.2 明确不做高度动画 |
| 存储写入频率 | 每次切换 1 次；「全部收起/展开」1 次（不在循环里逐块写） | design §17.12.1 防重复要求 |

### 6.2 测量方法与预期结果

| 测量项 | 方法（可复制） | 预期结果 | 判定 |
|---|---|---|---|
| 单次切换耗时 | DevTools Console 包一层：`const t0=performance.now(); document.querySelector('[aria-controls="ds-acc-evidence-body"]').click(); requestAnimationFrame(()=>console.log(performance.now()-t0))` | < 16ms（含布局）；通常个位数 ms | 超过 16ms 需查是否误引入动画/重复渲染 |
| 主线程成本 | Performance 面板录「点区块头」→ 看 `Scripting` / `Layout` / `Recalculate Style` 三行 | 无长任务（>50ms）；布局仅发生在显隐的子树 | 出现长任务则定位（React DevTools Profiler） |
| 网络请求 | Network 面板清空 → 反复折叠/展开三区块 | **0 个新请求**（除非展开证据库且缩略图首次进入视口） | 出现非 raw 请求即缺陷；证据缩略图请求需与 v1.2.83 基线和 `loading="lazy"` 解释 |
| DOM 是否卸载 | Elements 面板：收起后搜索 `ds-acc-evidence-body` 仍在 DOM 且带 `hidden`；输入框 `value` 仍在 | 节点存在、属性 `hidden`、状态保留 | 节点消失 = 违反「保留 DOM」 |
| 存储写入耗时 | `console.time('setItem'); …; console.timeEnd('setItem')` 包住一次写 | 亚毫秒级（<1ms） | 长时间（>10ms）说明值异常大（应被 §5.1 S3 上限挡住） |
| 存储值大小 | `localStorage.getItem('dsh-web-filebrowser:acceptance-collapse').length` | 数百字节量级（3 block + 分组数条） | 上千字节需检查是否写入多余字段 |
| React 重渲染范围 | React DevTools Profiler 录一次 toggle | 只重渲染验收台面板子树 | 整页/工作台重渲染需查 state 提升位置 |
| 首屏请求数 | 刷新后 Network 面板对比 v1.2.83 | 证据缩略图请求减少（默认收起时视口外不加载） | 不减反增需查 `loading="lazy"` 是否被破坏 |

### 6.3 不做 / 负结果

- **不做防抖**：折叠是低频用户动作，加防抖反而引入延迟与「点了没反应」；连续快速点击按 `current => !current` 幂等。
- **不做 `useMemo` 过度优化**：区块头徽标计算是常数级字符串拼接；仅按现有渲染成本即可。
- **不做虚拟列表**：当前数量级（64 项 / 36 分组 / 23 证据）不需要；未来数量级增长另立需求。
- **不记录/不测量首屏包体字节**：具体增量以开发后 `git diff --stat` 与构建产物实测为准，本文不虚构。

---

## 7. 兼容性、可访问性与风险

### 7.1 兼容性

| 特性 | 目标环境 | 结论 / 注意 |
|---|---|---|
| `hidden` 属性 | Chrome / Safari / Firefox 现代版本 | 全支持；**必须显式写 `[hidden]{display:none}` 覆盖**（见 R1） |
| `aria-expanded` / `aria-controls` | 上述浏览器 + 读屏 | 全支持；`aria-controls` 指向 `hidden` 元素是允许的 |
| `:focus-visible` | 上述浏览器 | 已在仓库多处使用（工作台/文件树/验收台快照） |
| `color-mix()` | Chrome 111+ / Safari 16.2+ / Firefox 113+（2023 起 Baseline） | 仓库既有 token/`color-mix` 用法；本轮不新增硬编码色。若需兼容更旧浏览器，可回退为 token 纯色（design §17.6 已给出对比度值） |
| `prefers-reduced-motion` | 全支持 | 本轮无高度动画；若有颜色/图标过渡，`@media (prefers-reduced-motion: reduce){ transition: none }` |
| localStorage | 全支持 | 隐私模式/策略可能抛异常 → `try/catch` 降级（§5.5） |

### 7.2 风险登记册

| # | 风险 | 影响 | 可能性 | 缓解 | 剩余风险 |
|---|---|---|---|---|---|
| R1 | `hidden` 与 `flex` 布局冲突：内容容器若被作者 CSS 设为 `display:flex`，会覆盖 UA 的 `[hidden]{display:none}`，收起后仍占位 | 中（折叠视觉失效） | 中 | 显式 `.ds-acc-block-body[hidden]` / `.ds-acc-detail-body[hidden]` / `.ds-acc-group-body[hidden] { display:none }`（快照已存在）；测试断言 `getComputedStyle(body).display === 'none'` | 无（可静态断言） |
| R2 | `color-mix` 在旧浏览器不支持，徽标底色/文字色降级 | 低（视觉/对比度） | 低 | 目标现代浏览器；必要时回退 token 纯色；对比度验收项 7 覆盖 | 旧浏览器可能出现颜色降级 |
| R3 | localStorage 隐私模式/配额导致写入失败 | 低（偏好不持久） | 中 | `try/catch` + 内存态；不报错；验收项 2 覆盖 | 刷新后回默认（可接受） |
| R4 | 存储坏值/旧 schema 导致面板崩溃 | 高（若发生） | 低 | §5.1 白名单 + 整份回退 + 长度上限 | 无（可控） |
| R5 | 默认收起让 Owner 找不到证据/复测/交付入口 | 中（可用性） | 中 | 区块头常显 + 数量徽标 + 「全部展开」；design 创新假设 1 有失败预案（证据库在有选中时自动展开） | 需要 Owner 复测确认 |
| R6 | 展开证据库瞬间触发多张缩略图请求，被误判为「折叠发请求」 | 低（验收误读） | 中 | 折叠/展开本身 0 请求；缩略图是既有 `loading="lazy"` 内容加载，与 v1.2.83 常显等价；Network 面板按「操作类型」区分 | 需测试记录说明 |
| R7 | 并行会话改动 `client.js`，行号漂移导致交接误差 | 中（协作） | 高 | 以类名/符号/断言为准；本文与 design 均标注快照口径 | 行号引用可能过时 |
| R8 | 全部收起后分组 key 残留（分类改名/删除） | 低（存储体积） | 低 | 不主动清理（无害）；单键 JSON 体量小 | 无 |
| R9 | 多标签页并发写互相覆盖 | 低（偏好抖动） | 低 | 最后写入者生效；不监听 `storage` 事件（不在本轮范围） | 两标签页可能显示不同折叠态，刷新后一致 |
| R10 | 折叠头内误放可聚焦元素（按钮套按钮） | 高（HTML/读屏语义坏） | 低 | design §17.3 D1 明确「头内不出现其它按钮」；静态断言区块头子树无可聚焦元素 | 无 |
| R11 | `aria-controls` id 重复（多面板并存时） | 低（读屏关联错） | 低 | 固定字面量 id + 面板唯一性；分组用数字索引 | 若未来同屏渲染两个验收台会冲突（当前不存在） |

### 7.3 可访问性工程契约（可静态断言）

1. 每个折叠头（三区块 / 分组 / 详情）是 `<button type="button">`，带 `aria-expanded="true|false"` 与 `aria-controls="<唯一 id>"`。
2. 内容容器有对应 `id`；收起时带 `hidden`，且 `getComputedStyle(...).display === 'none'`。
3. 折叠头子树**不包含**其它可聚焦元素（无嵌套 button/a/input）。
4. 键盘：Tab 可达每个折叠头；Enter/Space 切换；切换后 `document.activeElement` 仍是该折叠头。
5. `:focus-visible` 有 2px 品牌色 outline，不被 `overflow:hidden` 裁切（`outline-offset:-2px` 或等效）。
6. 折叠头可读名称含区块标题 + 徽标文本（读屏读成一句），箭头 `aria-hidden="true"`。
7. 收起内容不进入 Tab 序列（`hidden` 天然满足，无需 `tabindex=-1` 补丁）。
8. 状态不只靠颜色：箭头方向 + `aria-expanded` + 文本/徽标共同表达。
9. 不新增 `role="tablist"` / `role="region"` 等额外语义（避免与侧栏既有 landmark 冲突）。

---

## 8. 结论

### 8.1 采用方案

- **Build on existing primitives**：复用 `ds-wb-reqlog-toggle` disclosure 范式（`button` + `aria-expanded` + `aria-controls` + `hidden` + Chevron + `:focus-visible`）、`readStorage`/`writeStorage`、`ChevronUpIcon`/`ChevronDownIcon`、`ds-acc-*` 样式与 `--dsw-alias-*` token、zh/en i18n 词典。
- **Borrow patterns only**：APG 的 ARIA/键盘契约（`aria-expanded`、`aria-controls`、Enter/Space、Tab 序列）；GOV.UK 的「默认隐藏 + 短摘要 + 稳定 id + 不嵌套 + 主内容不折叠」；Radix 的受控状态/样式钩子思路；Headless UI 的「自动 ARIA 接线 + `close()` 焦点归还」目标形态。
- **零依赖、零代码复制**：不新增 npm 包 / `vendor/` 资产 / 构建步骤；不复制任何第三方源码、CSS、图标、文案。

### 8.2 未采用理由（一句话版）

| 方案 | 未采用理由 |
|---|---|
| `@radix-ui/react-collapsible` | 10 个传递包 + 默认卸载（需 `forceMount`）+ 无组合/持久化 API；收益仅为约 100 行接线 |
| `@headlessui/react` | 约 6.5 个月无提交 + 21 个传递包 + `unmount:true` 默认 + React 18/19 peer |
| `govuk-frontend` | 整套设计系统与现有 token/`h()` 双轨；只需要一个模式 |
| `<details>/<summary>` | 受控渲染/持久化/`aria-expanded` 断言不匹配；`<summary>` 内徽标与嵌套可聚焦元素行为不一致 |
| 复制 APG/Radix/Headless 源码 | 许可证允许但无必要；示例明确不用于生产；维护/声明成本 > 自写 |
| 卸载代替 `hidden` | 丢失端口输入、命令勾选、备注草稿 |
| 高度动画 | 需求明确不做；与 `hidden` 语义冲突 |
| 状态放 Host / `.dsh` | 需求明确只进浏览器 localStorage；避免 API 与迁移面 |

### 8.3 主要风险（详见 §7.2）

`hidden` 与 flex 布局覆盖（R1，需显式 `[hidden]{display:none}`）、`color-mix` 旧浏览器降级（R2）、localStorage 隐私模式/配额（R3）、默认收起导致入口难找（R5）、展开证据库触发懒加载缩略图被误读为「折叠发请求」（R6）、并行开发导致行号漂移（R7）。

### 8.4 blocked 状态

**无整体 blocked。** 4 个候选文档均读取到正文；许可证、依赖、漏洞数据均可查；唯一 blocked 的 Ant Design Collapse 属补充候选，未承担任何结论。

---

## 9. 来源 URL + commit/版本 + 访问日期

> 访问日期统一 **2026-10-27**（Asia/Shanghai）。GitHub/npm 数据为当日快照。

| # | 来源 | URL | 版本 / commit / tag | 访问日期 | 用途 |
|---|---|---|---|---|---|
| 1 | W3C WAI-ARIA APG · Accordion Example | https://www.w3.org/WAI/ARIA/apg/patterns/accordion/examples/accordion/ | 页面 last updated 2026-01-20；仓库 commit `0f765e4dc33e966026114ac12a8380db1de3b787`（2026-09-30） | 2026-10-27 | 候选 1；`aria-expanded`/`aria-controls`/`region`/Space-Enter/Tab 契约 |
| 2 | `w3c/aria-practices` | https://github.com/w3c/aria-practices | 最新 commit `0f765e4d…`；`pushed_at` 2026-10-14；tag `apg-1.2r1`（2021-11-16） | 2026-10-27 | 候选 1 活跃度与许可证仓库信息 |
| 3 | `w3c/aria-practices` · LICENSE | https://github.com/w3c/aria-practices/blob/main/LICENSE.md | `LICENSE.md`：W3C Software and Document License（GitHub SPDX `NOASSERTION`） | 2026-10-27 | 许可证确认 |
| 4 | GOV.UK Design System · Accordion | https://design-system.service.gov.uk/components/accordion/ | 文档页（2026-10-27 抓取） | 2026-10-27 | 候选 2；默认隐藏、短摘要、稳定 id、不嵌套、主内容不折叠 |
| 5 | `alphagov/govuk-frontend` | https://github.com/alphagov/govuk-frontend | 最新 commit `97d69e268cef49bbdf7520782f006d3e0ba98208`（2026-10-26）；release **v6.6.0**（2026-10-15）；`pushed_at` 2026-10-27 | 2026-10-27 | 候选 2 活跃度/发布 |
| 6 | `alphagov/govuk-frontend` · npm | https://registry.npmjs.org/govuk-frontend/latest | **6.6.0**，MIT，依赖 0（publish 2026-10-15T10:19Z） | 2026-10-27 | 许可证 + 依赖面 |
| 7 | Radix UI Primitives · Collapsible | https://www.radix-ui.com/primitives/docs/components/collapsible | 文档页标注 **1.1.21**（bundlephobia 4.67 kB）；Markdown 版同日 200 | 2026-10-27 | 候选 3；受控/`forceMount`/`data-state`/CSS 变量/Disclosure APG |
| 8 | `radix-ui/primitives` | https://github.com/radix-ui/primitives | 最新 commit `eb3a2b7091293e27df8f9ba906632d8daa3d81a3`（2026-10-14）；`pushed_at` 2026-10-14；tag `1.6.7` | 2026-10-27 | 候选 3 活跃度 |
| 9 | `@radix-ui/react-collapsible` · npm | https://registry.npmjs.org/@radix-ui/react-collapsible/latest | **1.2.1**，MIT，直接依赖 8（闭包 10；publish 2026-10-12T21:03Z） | 2026-10-27 | 依赖面 + 许可证 |
| 9b | Radix Collapsible 源码（行为核对） | https://github.com/radix-ui/primitives/blob/main/packages/react/collapsible/src/collapsible.tsx | 文件 blob `f22f0cf6f0120d0ecab39fb3e5a8765023ed2dc0`（8,962 bytes） | 2026-10-27 | 核对 `<Presence present={forceMount \|\| open}>`、`aria-controls` 仅展开时输出、`hidden={!isOpen}` |
| 10 | Headless UI · Disclosure | https://headlessui.com/react/disclosure | 文档页 v2.1（页面标注）；npm **2.2.10** | 2026-10-27 | 候选 4；自动 `aria-*`、`defaultOpen`、Enter/Space、`unmount:true` 默认、`close()` 焦点归还 |
| 11 | `tailwindlabs/headlessui` | https://github.com/tailwindlabs/headlessui | 最新 commit `eea57cf46fd6767ed1059012f7073b88eb159fba`（2026-04-13）；release `@headlessui/react@v2.2.10`（2026-04-07） | 2026-10-27 | 候选 4 活跃度（近 90 天 0 commits） |
| 12 | `@headlessui/react` · npm | https://registry.npmjs.org/@headlessui/react/latest | **2.2.10**，MIT，直接依赖 5（闭包 21；publish 2026-04-07T17:12Z） | 2026-10-27 | 依赖面 + 许可证 |
| 13 | MDN · `hidden` global attribute | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/hidden | 标准文档（Baseline widely available） | 2026-10-27 | `hidden` 语义、`display:none`、隐藏子树仍活动 |
| 14 | MDN · `Storage.setItem()` | https://developer.mozilla.org/en-US/docs/Web/API/Storage/setItem | 标准文档 | 2026-10-27 | `QuotaExceededError` 语义 |
| 15 | MDN · `Window.localStorage` | https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage | 标准文档 | 2026-10-27 | `SecurityError`、隐私模式清除语义 |
| 16 | MDN · `Storage` | https://developer.mozilla.org/en-US/docs/Web/API/Storage | 标准文档 | 2026-10-27 | getItem/setItem 按源存储 |
| 17 | OSV API（npm 查询） | https://api.osv.dev/v1/query | 查询 `@radix-ui/react-collapsible` / `@headlessui/react` / `govuk-frontend`，均 `vulns=[]` | 2026-10-27 | 已知漏洞 |
| 18 | GitHub Advisory API | https://api.github.com/advisories?ecosystem=npm&affects=… | 三个包均 0 条 | 2026-10-27 | 已知 GHSA |
| 19 | npm bulk advisories | https://registry.npmjs.org/-/npm/v1/security/advisories/bulk | 三个精确版本返回 `{}` | 2026-10-27 | 精确版本漏洞 |

**检索命令可复现（摘要）**

```bash
# 仓库元数据 / 提交 / 发布 / 许可证 / 文件内容
gh_api() { curl -s -m 15 -H 'Accept: application/vnd.github+json' "https://api.github.com/$1"; }
gh_api repos/radix-ui/primitives
gh_api 'repos/alphagov/govuk-frontend/commits?per_page=1'
gh_api repos/tailwindlabs/headlessui/releases/latest
gh_api repos/w3c/aria-practices/license

# npm 版本、发布时间、依赖
curl -s https://registry.npmjs.org/@radix-ui%2Freact-collapsible/latest
curl -s https://registry.npmjs.org/govuk-frontend | node -e 'const d=JSON.parse(require("fs").readFileSync(0));const v=d["dist-tags"].latest;console.log(v,d.time[v])'

# 漏洞
curl -s -X POST https://api.osv.dev/v1/query -H 'Content-Type: application/json' \
  -d '{"package":{"name":"@radix-ui/react-collapsible","ecosystem":"npm"}}'
```

---

## 10. 不复制第三方代码声明、复核方式与历史

### 10.1 声明

本轮交付物（含本文及后续实现）**不包含任何第三方源代码、CSS、SVG/图标、字体、图片、设计素材或文档文案的复制**。具体地：

1. 不引入第三方 npm 包、CDN、字体、图标库、运行时服务；`package.json` 依赖与构建步骤不变；`vendor/` 不新增资产。
2. 不复制 APG / GOV.UK / Radix / Headless UI 的代码片段；不复制其界面布局、文案、图标、配色。
3. 只借鉴**不受版权保护的模式与标准语义**：`aria-expanded` / `aria-controls` / `hidden` / Enter-Space（HTML/ARIA 标准）、disclosure 单开合模型（通用交互模式）、「默认收起 + 短摘要 + 主内容常显」（通用信息架构原则）、单键 JSON 持久化（通用工程模式）。
4. 效果图由本项目自行生成（`docs/pipeline/design/`），不包含第三方素材。
5. 若未来确需复制 MIT/BSD/Apache/ISC/W3C 许可的代码，按 §3.3 流程补充声明；GPL/AGPL/无许可证代码一律不复制。

### 10.2 如何复核

- `git diff`：**本次调研提交只新增本文 + 归档旧版**（`docs/pipeline/archive/v1.2.83-engineering-research.md`）；实现轮次的 diff 另计，只应出现 `client.js` / i18n / 版本 / CHANGELOG / docs，不应出现第三方文件。
- `package.json` / 插件依赖 / `vendor/`：依赖与资产零变化。
- 静态搜索：验收台折叠实现内无 `dangerouslySetInnerHTML` / `innerHTML` / `eval` / `new Function`；无新增 `fetch`；无新增 `vendor/`。
- 许可证扫描：交付物中无第三方版权头、无第三方 LICENSE 文件被误加入（`vendor/LICENSE.xterm` 为既有文件，不属本轮新增）。
- 断言复核：按 §7.3 的 9 条契约逐条 grep / DOM 检查。

### 10.3 历史与归档

- 本文件上一版为 **v1.2.83 第 11 轮「设计先确认：设计阶段截图/HTML 预览 + 开发前人工闸门」**，本轮开始时已原样复制归档到 [`archive/v1.2.83-engineering-research.md`](archive/v1.2.83-engineering-research.md)（`sha256` 与归档前主文件一致）。
- 更早归档：`archive/v1.2.78-engineering-research.md`；v1.2.79 工作台 UI 重构版保留在 git 历史（`git show 50cbc34:docs/pipeline/engineering-research.md`）。
- 本轮（v1.2.84，第 12 轮）按新需求重写为「验收台分区可收起」调研；上一轮的 iframe sandbox / 设计闸门候选与结论**不再作为本轮依据**，避免把无关注释混入本轮决策。
