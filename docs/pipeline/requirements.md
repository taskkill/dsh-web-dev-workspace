# 需求：验收台分区可收起 —— 证据库/复测/交付默认折叠 + 全部收起 + 分组折叠（v1.2.84，第 12 轮）

- 提出人：Owner；日期：2026-10-27（Asia/Shanghai）；优先级：P0；目标版本：**v1.2.84**（第 12 轮）。
- 一句话需求：把验收台里「不是主内容」的三块（证据库、复测中心、交付与预览分享）收进可折叠区块并**默认收起**，让验收项清单成为默认展开、占满剩余高度的主内容；同时提供「全部收起 / 全部展开」、分类分组折叠、折叠状态持久化、键盘可达与窄侧栏不溢出。
- 上游：`.dsh/pipeline.json` 第 12 轮需求全文（`round=12`、`roundScope=full`、`settings.gateMode=fast`，product 阶段已 active）；v1.2.83 交付（commit `8e03d0c`，设计先确认 + 设计稿预览）与 v1.2.85 仓库/包瘦身（commit `1d85de4`，无运行时改动）；当前根 `package.json` 为 **1.2.85**，插件发布版为 **1.2.83**。
- 本轮性质：**纯客户端信息架构（分区 / 折叠）改动** —— `client.js` 渲染 + 内联 CSS + i18n 文案 + localStorage 偏好；不改 Host API、不改 `.dsh/*.json` 数据结构、不改任何既有操作语义、不新增依赖。
- 文档定位：本文只做需求分析与验收化，不替代 `.dsh/pipeline.json` 中的需求原文；第 11 轮（v1.2.83）需求已归档到 `docs/pipeline/archive/v1.2.83-requirements.md`，更早轮次见同目录。

---

## 0. 摘要

| 项 | 内容 |
|---|---|
| 问题 | 验收台把工具栏、提示、计数、添加、筛选、模板、批量、清单、选中详情、证据库、复测中心、交付按钮与预览分享**全部竖向堆在一起**；当前 `.dsh/acceptance.json` 有 **54 条**验收项、证据目录 **23 个**文件（50 条证据挂载），证据库/复测/交付三块固定占位，主内容清单被反复挤压，面板又长又没有主次。 |
| 方案 | 证据库 / 复测中心 / 交付与预览分享各自成为**可折叠区块**（区块头 = 标题 + 摘要徽标 + 折叠箭头，默认收起，localStorage 持久化）；「全部收起 / 全部展开」一次作用于所有可折叠区块；验收项清单默认展开并占满剩余高度，选中详情随选中展开/收起；分类分组头可折叠（带数量徽标、持久化）；`button` + `aria-expanded` / `aria-controls` + Enter/Space + 焦点可见；360px / 691px 不横向溢出；浅/深主题正常。 |
| 交付面 | `dsh-web-filebrowser-plugin/client.js`（`renderAcceptancePanel` 渲染、`ds-acc-*` 样式、zh/en i18n）；localStorage 新键；`CHANGELOG.md`、`docs/ACCEPTANCE.md`、`docs/pipeline/`、插件版本文件。 |
| 不做 | 不改 Host API / 数据结构 / 既有操作语义；不改工作台与流水线面板布局；不做拖拽排序、自定义布局、多面板并列；不引入第三方 UI 库 / 依赖 / `<details>` 组件；不加折叠高度动画；不做 per-root 折叠偏好隔离。 |
| 验收项 | 10 条（`acceptance-collapse` 5 / `acceptance-a11y` 1 / `acceptance-layout` 1 / `acceptance-i18n` 1 / `acceptance-regression` 1 / `version-docs` 1），见 §8；由 testing 阶段回填。 |

---

## 1. 背景与现状审计

Owner 在 v1.2.83 交付后反馈：验收台「内容一多就太长太乱」。现状**不是功能缺失**，而是信息架构问题——三类内容被放在同一个竖向流里，没有主次：

> 行号口径：下表行号为本轮实测基线（根 1.2.85 / 插件 1.2.83 的 `client.js`），允许实现后 ±2 行漂移；如与代码不符，以「函数名 / 类名」定位为准。

| # | 现状问题 | 代码证据（本轮基线：根 1.2.85 / 插件 1.2.83，`client.js`） | 影响 |
|---|---|---|---|
| ① | **面板是单一竖向流**：`renderAcceptancePanel()` 返回一个 `ds-side-view ds-acceptance-view` 的 flex column，内部依次是 toolbar → hint → 计数 → 添加 → 筛选 → 模板 → 批量 → 清单 → 选中详情 → 证据库 → 复测中心 → 交付与预览，没有分区容器，也没有任何折叠入口 | `renderAcceptancePanel` 整体 **17157–17861**；顺序：toolbar 17248、hint 17264、counts 17266、add 17283、filters 17309、templates 17353、batch 17372、list 17399、detail 17469、evidence 17564、verify 17626、delivery 17729；样式 `.ds-acceptance-view { overflow: hidden }` **25578** | 面板高度 = 全部固定块之和 + 清单；证据/复测/交付越多，清单越被挤 |
| ② | **证据库固定展开且自带 32% 高度上限** | `.ds-acc-evidence { flex: 0 0 auto; max-height: 32%; overflow: auto; border-top: … }` **25679**；证据卡片 `.ds-acc-evidence-item { width: 68px }` **25684**，`.ds-acc-evidence-list` 换行铺满 **25683**；渲染 17564–17625 | 证据一多就占掉约 1/3 面板高度，且始终显示 |
| ③ | **复测中心固定占位**：区块头、最近复测摘要、命令选择区常驻；`verificationOpen` 只控制命令区，整块仍占位且不持久化 | 复测块 **17626–17728**；开关 `setVerificationOpen` 17639–17654；命令区条件渲染 17679；状态 `const [verificationOpen, setVerificationOpen] = useState(false)` **8533** | 即使不跑复测，也一直占据高度 |
| ④ | **交付与预览分享是固定长块**：4 个交付按钮 + 端口输入 + 分享列表 + 提示 + 交付记录 + 交付包结果；分享/交付记录越多越长 | 交付块 **17729–17859**；`ds-acc-actions` 17733–17752；`ds-acc-preview` 17753–17810；`ds-acc-history`（最近 5 条）17811–17846；`ds-acc-bundle` 17847–17858；样式 `.ds-acc-delivery` **25613**、`.ds-acc-preview` **25688** | 打包/分享这类低频操作长期占用面板底部空间 |
| ⑤ | **清单本应是主内容但被反复挤压**：`.ds-acc-list` 已设 `flex: 1 1 auto; min-height: 0; overflow: auto`，理论上占剩余高度；但上方固定块过多，且选中详情（`flex: 0 0 auto`）渲染在清单**之后**，选中即压缩清单 | `.ds-acc-list` **25591**；`.ds-acc-detail { flex: 0 0 auto; border-top: … }` **25608**；清单渲染 17399–17468；详情渲染 17469–17563 | 越是需要看清单时（选中一项看详情），清单越短 |
| ⑥ | **选中详情已有条件渲染，但没有折叠头/收起语义**：`selected === null ? null : …`，有选中即整块出现；只有「取消」按钮（调用 `selectAcceptanceItem(null)`）能关掉 | 详情条件渲染 **17469–17563**；取消按钮 **17517**；选中状态 `const [acceptanceSelected, setAcceptanceSelected] = useState(null)` **8445** | 无法「保留选中、先收起详情」；详情与清单的层级关系不可控 |
| ⑦ | **分类分组头不可交互**：分组头是 `div` + 分类名 span + 数量 span，没有 `button`、没有 `aria`、点击无响应 | 分组头 **17410–17415**（`ds-acc-group-head` / `ds-acc-group-name` / `ds-acc-group-count`）；样式 `.ds-acc-group-head` **25636**、`.ds-acc-group-count` **25637** | 54 条项 / 31 个分类时只能一路滚，无法按分类收纳 |
| ⑧ | **无任何折叠偏好存储**：现有 localStorage 键清单里没有验收台折叠相关键；已有 `readStorage` / `writeStorage` 可复用（均带 try/catch），部分偏好形如 `dsh-web-filebrowser:*` | 键常量 **33–61**（`ROOT_KEY`/`WIDTH_KEY`/…/`TODO_FILTER_KEY` 等）；`readStorage` **4244–4250**、`writeStorage` **4252–4258** | 折叠状态只能做成会话内开关，刷新即丢 |
| ⑨ | **已有可复用折叠范式，但没用在本面板**：工作台「修订记录」已实现完整 disclosure：`button` + `aria-expanded` + `aria-controls` + 内容 `hidden` + ChevronUp/Down，CSS 带 `:focus-visible` | `ds-wb-reqlog-toggle` **18178–18200**；`ds-wb-reqlog-body[hidden] { display: none }` **25758**；`:focus-visible` **25754** | 说明 a11y 折叠在本项目已有先例，本轮属于「把既有范式用到验收台」，不是新造轮子 |
| ⑩ | **i18n 缺口**：`acceptance.*` 现有 zh **830–949** / en **2094–2213**，没有任何「收起 / 展开 / 全部收起 / 全部展开 / 折叠分组」文案；`action.collapseAll` 存在但语义属于**文件树全部收起**（zh 1105 / en 2369，按钮在文件区 22781），不能直接复用到验收台 | zh acceptance 830–949、en acceptance 2094–2213；`action.collapseAll` zh **1105** / en **2369**；文件树 `collapseAll()` **13824** | 不新增键就只能硬编码中文，违反中英双语文案要求 |
| ⑪ | **窄侧栏宽度是真实约束**：侧栏宽度 = `min(treeWidth, max(220, containerWidth*0.42))`，默认可拖到 180–560 | 内联宽度计算 **9430**；`treeWidth` 默认/夹取 **4454**（180–560，默认 260）；侧栏 CSS `.ds-side` **24075–24082** | 360px 与 Owner 本机 691px 截图宽度下，折叠头「标题 + 徽标 + 箭头」必须能截断/省略，不能横向撑破 |

**根因判断**：验收台把「日常主内容（验收项清单 + 状态操作）」和「低频工具（证据库 / 复测 / 交付与分享）」放在同一层竖向流里，且低频工具固定占位。真正要修的是**信息层级**，不是把内容删掉：主内容默认占满，低频工具收进可展开区块，并提供一次性展开/收起与记忆。

**本轮修复点**：① 拆出三个可折叠区块（默认收起、持久化、带摘要徽标）；② 提供「全部收起 / 全部展开」；③ 清单作为主内容默认展开、占满剩余高度；④ 选中详情随选中展开并可收起；⑤ 分类分组头可折叠（带数量徽标、持久化）；⑥ 折叠头 `button` + `aria-expanded` / `aria-controls` + Enter/Space + focus-visible；⑦ 360px / 691px 不横向溢出、浅/深主题正常；⑧ zh/en 文案齐全；⑨ 既有操作不回归；⑩ 版本与文档同步。

---

## 2. 目标用户与核心场景

| 用户 | 场景 | 期望结果 |
|---|---|---|
| **Owner（你）** | 打开验收台，准备逐条勾选本轮验收项 | 一进面板就看到清单与状态计数，不再被证据库/复测/交付三块顶到下面；需要看证据时点「证据库」就地展开 |
| **Owner** | 收起三个次要区块后刷新页面 / 切到别的侧栏视图再回来 | 折叠状态保持不变；一键「全部展开」可临时全看，再「全部收起」回到清爽清单 |
| **Owner** | 选中一条验收项看验收条件、备注、历史与证据 | 详情就地展开；取消选中即收起，清单恢复高度；选中高亮始终可见 |
| **Owner（键盘 / 辅助技术）** | 只用键盘操作验收台 | Tab 到区块头、Enter/Space 展开收起、`aria-expanded` 同步、焦点可见；收起的内容不参与 Tab 顺序 |
| **Owner（窄侧栏 / 截图）** | 侧栏拖到 360px，或在 691px 截图宽度下录证据 | 区块头标题与徽标不撑破、不出现横向滚动条；浅/深主题可读 |
| **测试 / 验收复核** | 按 `docs/ACCEPTANCE.md` 批次 22 复测折叠行为 | 每条验收项可独立复测，不需要隐含上下文 |
| **开发** | 实现本轮 | 只改 `client.js` + i18n + localStorage；Host API、数据结构、既有操作语义零改动 |

**核心用户故事**

1. 作为 Owner，我打开验收台时先看到「验收项清单 + 状态计数」，证据库、复测中心、交付与预览分享默认收起，只露出区块头与数量徽标。
2. 作为 Owner，我点区块头（或箭头）展开证据库，上传/查看证据后可以再收起；再点「全部收起」一次把三个区块与全部分组收回。
3. 作为 Owner，我收起某个区块后刷新页面、重开面板，状态仍然保持；换到英文界面文案也正确。
4. 作为 Owner，我选中一条验收项看详情，取消选中后详情收起、清单变高；分类分组我可以单独折叠，不影响勾选与状态按钮。
5. 作为键盘用户，我用 Tab 聚焦区块头，Enter/Space 切换展开状态，`aria-expanded` 与视觉一致，焦点圈可见。
6. 作为测试，我按验收项逐条复测，能明确看到「默认收起」「持久化」「全部收起/展开」「分组折叠」「键盘可达」「窄屏不溢出」各自的可观察结果。

---

## 3. 范围

### 3.1 做什么

1. **三个次要区块可折叠（默认收起）**
   - 证据库、复测中心、交付与预览分享（含最近交付记录与交付包结果）各自成为独立折叠区块。
   - 区块头 = **标题 + 摘要徽标 + 折叠箭头**，整行可点击（不只箭头）；点击切换展开/收起。
   - 摘要徽标：证据库 = 证据数量；复测中心 = 最近复测结果（如 `2 通过 / 0 失败`）；交付与预览 = 分享链接数 / 最近交付记录数。
   - 默认值：三个区块**均收起**（首次进入 / 无偏好时）。
   - 展开后的内容与 v1.2.83 现状**完全一致**：按钮、输入、列表、记录、提示都在，只是被收纳进区块容器。
2. **折叠状态持久化 + 全部收起 / 全部展开**
   - 折叠状态写入 localStorage（单键 JSON，见 §6.2），刷新页面、切换侧栏视图、重新打开面板后保持。
   - 面板工具区提供「全部收起 / 全部展开」；一次作用于三个区块 + 所有分类分组 + 选中的详情区（若展开）。
   - 存储缺失 / 损坏 / 不可用（隐私模式）时回退默认值，UI 不报错、不崩溃。
   - 允许**多个区块同时展开**（不做互斥自动关闭）。
3. **验收项清单是主内容**
   - 清单默认展开；三区块收起时占满工具区/筛选区以下的剩余高度，并独立滚动。
   - 选中项详情在有选中时展开、可手动收起；取消选中 / 选中另一项时按 §6.4 规则更新；详情展开不把清单压到不可用。
   - 分类分组头可点击折叠/展开，带**数量徽标**；分组折叠状态持久化；折叠不影响勾选、批量、状态修改、删除、筛选。
4. **可访问性**
   - 所有折叠头是 `<button type="button">`，带 `aria-expanded`（`true`/`false`）与 `aria-controls`（指向内容容器稳定 `id`）。
   - Enter / Space 切换；切换后焦点留在按钮；`:focus-visible` 可见描边。
   - 收起的内容用 `hidden`（或等价 `display:none`）隐藏，**不参与 Tab 顺序**；内容容器 id 唯一。
   - 折叠头有可读名称（标题 + 摘要徽标文本），屏幕阅读器能听出「证据库，2 条证据，已收起」。
5. **响应式与主题**
   - 360px 侧栏宽度与本机 691px 截图宽度下：无横向滚动条，长标题/徽标截断或换行但不撑破布局。
   - 浅色 / 深色主题下分隔线、箭头、徽标、正文对比度正常（正文与图标文字 ≥4.5:1）。
6. **i18n 与文档**
   - 新增折叠相关文案在 zh / en 词典齐全，无硬编码中文；缺失键回退合理（回退到另一语言或 key，不崩溃）。
   - `CHANGELOG.md` 1.2.84 条目、`docs/ACCEPTANCE.md` 批次 22、`docs/pipeline/` 各文档同步、插件版本 1.2.84。

### 3.2 不做什么

- **不改 Host API**：`dsh-web-filebrowser-plugin/acceptance.js` 的 Host 路由、请求/响应字段零改动；不改 `.dsh/acceptance.json`、`.dsh/deliveries.json`、`.dsh/verifications/` 等数据格式，不迁移旧数据。
- **不改既有操作语义**：状态按钮（待验收/通过/不通过/阻塞）、全选与批量、模板、备注保存、证据上传/删除、复测运行/发送失败、导出报告、打包交付/下载、预览分享创建/复制/打开/关闭、刷新，行为全部不变，只是被收纳进容器。
- **不改其它面板**：工作台、流水线、任务、文件树、Git、SSH、预览分享面板的布局与交互不在本轮范围。
- **不做结构重构**：不做拖拽排序、自定义布局、多面板并列、可调整区块顺序。
- **不引入依赖 / 第三方 UI 库 / `<details>` 组件**：继续用现有 React `h()` + 内联 CSS + `--dsw-alias-*` token。
- **不做折叠高度动画**：避免高度动画与 `hidden` 语义冲突、避免性能抖动；状态切换即时生效（focus ring 与箭头方向变化即可）。
- **不做 per-root 折叠偏好隔离**：本轮单键全局（见 §10 开放问题 3）。
- **不做「记忆选中项」「记忆滚动位置跨会话」**：会话内保持即可（刷新后选中项按现有语义丢失）。
- 不复制第三方受版权保护的文案、商标、界面素材与整段源码。

---

## 4. 约束与非功能

- **技术栈 / 复用**：React `h()` 渲染 + 内联 CSS + `--dsw-alias-*` token；复用 `readStorage` / `writeStorage`（4244–4258）、`ChevronDownIcon` / `ChevronUpIcon`、现有 disclosure 范式（`ds-wb-reqlog-toggle` 18178–18200、CSS 25752–25758）、i18n 内联词典（zh/en）。
- **状态边界**：新偏好只进浏览器 localStorage（建议键 `dsh-web-filebrowser:acceptance-collapse`）；不写 `.dsh/`、不走 Host。
- **保留 DOM**：收起时内容用 `hidden` 隐藏但保留挂载，避免丢失复测命令勾选、端口输入、备注草稿等会话内输入状态；不得因折叠触发额外网络请求。
- **可访问性**：折叠头键盘可达、`aria-expanded` / `aria-controls` 完整、焦点可见；`hidden` 内容不进入 Tab 顺序；不只用颜色表达状态。
- **响应式**：侧栏 360px（下限）与 691px（Owner 本机截图宽度）无横向溢出；1440px 宽屏下区块头不拉伸变形。
- **主题**：浅 / 深主题下折叠头、分隔线、徽标、箭头对比度正常；不新增硬编码色值，使用现有 token。
- **性能**：折叠/展开为纯本地状态切换；不新增渲染长任务；54 条项 + 23 个证据文件的规模下仍可用。
- **兼容**：Chrome / Safari / Firefox 现代版本；localStorage 不可用时降级为「默认收起但每个区块可手动展开」。
- **零数据迁移**：旧 localStorage 值（不存在 / 损坏 / 旧 schema）不导致面板崩溃；旧验收数据（无 category / category 为空）正常显示并归入「未分类」分组。
- **质量门**：`npm run check`、`npm run check:json`、`npm test`（`scripts/selftest/host-smoke.mjs`）全绿；既有功能不回归。
- **版本口径**：插件 `1.2.83 → 1.2.84`；`CHANGELOG.md` 增加 1.2.84；`docs/ACCEPTANCE.md` 批次 22；交付后根 `package.json` 由 1.2.85 → **1.2.86**（工作区硬性规定：每交付一次 +1）。
- **时间**：沿用分工，不设外部截止；本阶段只定义验收，不给实现排期。

---

## 5. 调研与借鉴

> 调研时间 **2026-10-27**（Asia/Shanghai）。检索与抓取工具：`web_search` × 2（每轮 8 条结果）、`web_fetch` × 18。成功读取可引用正文 **7 个来源**（下表 1–7），其余 11 次抓取为空壳 / 404 / 仅导航壳 / 内容截断 / 重定向，已如实归入 §5.4，不引用未读到的内容。仅借鉴功能、交互、信息结构，不复制受版权保护的文案 / 素材 / 源码。

### 5.1 来源与关键结论

| # | 来源 | URL | 访问日期 | 类型 | 关键结论（对本需求的影响） |
|---|---|---|---|---|---|
| 1 | W3C WAI-ARIA APG · Accordion Example | https://www.w3.org/WAI/ARIA/apg/patterns/accordion/examples/accordion/ | 2026-10-27 | 标准（W3C APG） | 每个手风琴头是 heading 内的 `button`，由它控制面板显隐；`aria-expanded` 在展开时 `true`、收起时 `false`；`aria-controls="ID"` 指向面板；面板用 `region` + `aria-labelledby` 关联头部；焦点在头部按钮时 **Space/Enter** 展开收起；`Tab` 顺序包含手风琴内所有可聚焦元素。→ 折叠头必须用真 `button` + `aria-expanded`/`aria-controls`，Enter/Space 是标准键，收起内容不应留在 Tab 序列里。 |
| 2 | W3C WAI-ARIA APG · Disclosure (Show/Hide) Pattern | https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/ | 2026-10-27 | 标准（W3C APG） | disclosure = 一个 disclosure button + 受其控制的内容区；按钮 `aria-expanded` 表达可见性，`aria-controls` 为可选但推荐；键盘只有 Enter 与 Space 两条要求；三角箭头指向「展开后会出现内容」。→ 单个区块开关用 disclosure 语义即可，不需要手风琴角色；三个区块可独立开合（非互斥）。 |
| 3 | MDN · `<details>` HTML disclosure element | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details | 2026-10-27 | Web 标准 | `<details>` 是原生 disclosure，默认关闭（`open` 属性为布尔）；`<summary>` 是标签；点击或聚焦后按空格可切换；同 `name` 的多个 `<details>` 可做「一次只开一个」互斥。→ 原生 details 可作备选，但「一次只开一个」与我们的需求相反（我们允许多块同时展开）；且项目现有受控渲染与 a11y 断言更贴近 button 范式。 |
| 4 | Nielsen Norman Group · Accordions on Desktop: When and How to Use | https://www.nngroup.com/articles/accordions-on-desktop/ | 2026-10-27 | UX 研究（行业权威） | 手风琴 = 标题 + 图标 + 面板，属于 progressive disclosure：能减少杂乱与滚动、给出页面概览、提升可扫读性；但会**降低内容可见性、增加交互成本**，若用户需要同时看多个区块内容，自动互斥收起会妨碍比较——这种情况应直接全部展示。适用条件：内容密集、用户不会同时需要多个区块。→ 次要区块默认收起、主内容常显、**不自动互斥关闭**，标题要一眼能看出内容。 |
| 5 | Nielsen Norman Group · Progressive Disclosure | https://www.nngroup.com/articles/progressive-disclosure/ | 2026-10-27 | UX 研究（行业权威） | 初始只显示**最重要的少量选项**，次要功能按需展开；做对两件事即可：① 初始 / 二级的切分要正确（高频留在首屏）；② 从一级到二级的路径要明显；超过 2 层披露可用性急剧下降。→ 验收项清单 + 状态操作是高频 → 一级常显；证据库 / 复测 / 交付是低频 → 二级可收起；整体不超过两层（区块层 + 分组层）。 |
| 6 | GOV.UK Design System · Accordion | https://design-system.service.gov.uk/components/accordion/ | 2026-10-27 | 设计系统（政府公共服务） | 手风琴通常**所有区块初始隐藏**；标题按钮包含标题文本 + 摘要行 + 显示/隐藏动作，屏幕阅读器读成一句；摘要行只在确有需要时加且**必须尽量短**；持久展开状态需要**稳定唯一 id**；无 JS 时全部内容以标题形式显示；**不要嵌套手风琴**，**不要把所有用户都需要看的内容放进手风琴**。→ 默认收起可用；区块头「标题 + 短摘要（徽标）」有出处；持久化必须有稳定键；主内容（清单）不放进手风琴。 |
| 7 | MDN · Storage（Web Storage API） | https://developer.mozilla.org/en-US/docs/Web/API/Storage | 2026-10-27 | Web 标准 | `localStorage` 提供 `getItem` / `setItem` / `removeItem` / `clear`；按源持久保存；Baseline 广泛可用。→ 折叠偏好按「一个 JSON 键读写」实现，读写包 try/catch，异常时回退默认。 |

### 5.2 借鉴决策表

| 借鉴点 | 来源 | 采用 / 调整 / 不采用 | 理由 / 落点 |
|---|---|---|---|
| 折叠头是真 `button` + `aria-expanded` + `aria-controls`，内容容器有稳定 `id` | #1 #2 | **采用** | 验收台三个区块头、详情头、分类分组头统一用 `button`；`aria-expanded` 与视觉同步；`aria-controls` 指向 `hidden` 内容容器（§6.6，验收项 6） |
| Enter / Space 切换，焦点留在按钮 | #1 #2 | **采用** | 不额外发明快捷键；Tab 顺序自然（验收项 6） |
| 次要内容默认收起、高频内容常显（正确的初始/二级切分） | #4 #5 #6 | **采用** | 证据库 / 复测 / 交付默认收起；验收项清单与状态计数、筛选常显（验收项 1、4） |
| 区块头带「标题 + 短摘要」，摘要必须简短 | #6 | **调整采用** | 不写整句摘要，改用**数量徽标**（证据 n / 复测 pass·fail / 分享 n），既满足摘要作用又不撑破 360px（验收项 1、7） |
| 多个区块允许同时展开，不做互斥自动关闭 | #4 #3（反向） | **采用** | 「全部展开」需要同时可见；NN/g 明确指出自动收起会妨碍比较；`<details name>` 互斥不采用（验收项 3） |
| 折叠状态持久化，键/ id 稳定 | #6 #7 | **采用** | 单键 JSON（区块 + 分组），localStorage 读写带 try/catch；稳定 key 用数据里的分类原值而非显示语言（§6.2，验收项 2） |
| 初始全部隐藏是常见默认 | #6 | **调整采用** | 仅对**次要区块**默认收起；验收项清单属于「所有用户都需要看的内容」，按 #6 的反面建议**不放进折叠**、默认展开（验收项 1、4） |
| 不超过两层披露、不嵌套手风琴 | #5 #6 | **采用** | 验收台最多两层：区块层（证据/复测/交付/详情）+ 分组层；分组层内不再折叠（验收项 1、5） |
| 无 JS 时内容全部可见 | #6 | **调整采用** | 本应用是 React SPA，必须有 JS。降级目标改为「存储不可用 / 数据损坏时回退默认值且每个区块仍可手动展开」，不伪造无 JS 场景（验收项 2） |
| 原生 `<details>/<summary>` | #3 | **不采用** | 项目是受控 React 渲染，需把状态持久化并与既有 `aria-expanded` 断言一致；`<summary>` 内放徽标 + 嵌套可聚焦元素的语义与浏览器行为不一致；复用已有 `ds-wb-reqlog-toggle` 范式风险更低 |
| 分组「一次只开一个」互斥 | #3 | **不采用** | 用户需要同时看多个分类的条目；互斥会造成额外开合成本（#4 的负面结论） |
| 折叠头用文档 heading 层级（h2/h3） | #1 | **调整** | 验收台是侧栏工具面板，不是文档大纲；优先 `button` 具名 + `aria-controls`。是否加 heading 由 UI 设计决定，验收只要求「可读名称 + 键盘可达」（验收项 6） |
| 长标题 / 徽标在窄栏截断而非撑破 | #6 #7 + 项目既有省略号范式 | **采用（自证）** | 360px / 691px 下 `min-width: 0` + `text-overflow: ellipsis`；徽标最多保留 2 个，超出合并为 `+n`（验收项 7） |

### 5.3 已验证模式 vs 创新假设

**已验证模式（有来源支撑）**

1. `button` + `aria-expanded` / `aria-controls` + Enter/Space + 收起内容移出 Tab 顺序（#1、#2）→ 落为三个区块头、详情头、分组头的可访问性契约。
2. 初始只显示高频内容、低频内容按需展开，且不超过两层披露（#4、#5、#6）→ 落为「清单常显 + 三区块默认收起 + 分组层」。
3. 允许同时展开多个区块，避免自动互斥（#4）→ 落为三个区块独立开合 + 「全部展开」。
4. 折叠状态持久化需要稳定键；localStorage 是标准持久化机制（#6、#7）→ 落为 `dsh-web-filebrowser:acceptance-collapse` 单键 JSON。
5. 区块头「标题 + 短摘要」是成熟形态（#6）→ 调整落为徽标式摘要。

**创新假设（需验证，写验证方式与失败预案）**

| # | 假设 | 验证方式 | 失败预案 |
|---|---|---|---|
| 1 | 三个区块默认收起不会让 Owner 找不到证据/复测/交付入口 | Owner 按 `docs/ACCEPTANCE.md` 批次 22 复测；检查区块头徽标是否提供足够信息 | 若 Owner 找不到：证据库在「选中验收项」时自动展开；或把证据库默认改为展开（其他两块仍收起） |
| 2 | 数量徽标足以替代 GOV.UK 的长摘要行 | 360px / 691px 截图检查徽标可读且不换行溢出 | 徽标只保留数字，标题用 `title` tooltip 给全称；或把徽标移入区块头第二行 |
| 3 | 单键全局折叠偏好足够，无需按工作区分开 | 切换两个工作区，检查折叠状态是否仍符合预期 | 若 Owner 希望每工作区独立：键名追加 root 标识（记为后续需求，本轮不改） |
| 4 | 详情区可手动收起不会让 Owner 误以为「选中丢了」 | 收起详情后检查清单行仍有选中高亮、再展开仍在 | 详情头保留选中标题 + 「展开/收起」，收起后清单行加更明显的选中底色 |
| 5 | 「全部收起 / 全部展开」按钮不增加认知负担 | 工具区按钮数量与文案检查；Owner 复测 | 去掉「全部展开」，只保留「全部收起」；展开通过各区块头完成（验收项 3 仍覆盖） |
| 6 | 691px 是 Owner 实际截图验收宽度，360px 已覆盖下限 | 360 / 691 两档截图；再用 1440 检查无变形 | 若实际更窄（<360），补测 320px；布局以 `min-width: 0` + 省略号兜底 |

### 5.4 受阻 / 不可用说明（不伪造）

| 尝试的来源 | URL | 访问日期 | 结果 | 处理 |
|---|---|---|---|---|
| Nielsen Norman Group · Accordions on Mobile（视频页） | https://www.nngroup.com/videos/accordions-on-mobile/ | 2026-10-27 | HTTP 200，但正文只返回站点导航壳（视频说明与逐字稿未出现在抓取结果中） | **不可引用**：同一主题已由 #4 桌面版文章覆盖，不引用视频结论 |
| Ant Design · Collapse 组件文档 | https://ant.design/components/collapse/ | 2026-10-27 | HTTP 200 但正文为 JS 应用空壳（抓取内容为空）；`raw.githubusercontent.com` 抓取返回 `TypeError: fetch failed` | **blocked**：未取到可用正文，不引用其 API / 属性结论 |
| Material Design 3 · Expansion panels | https://m3.material.io/components/expansion-panels/overview | 2026-10-27 | HTTP 404（页面路径已迁移） | **blocked**：未取到正文，不引用 |
| GitHub Docs · Organizing information with collapsed sections | https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-collapsed-sections | 2026-10-27 | HTTP 200，但正文在关键段落前被截断；对应 raw markdown 抓取失败 | **部分可用**：只能确认「GitHub 用折叠区块组织长内容」这一层，不引用更细结论 |
| VS Code Docs · Custom Layout | https://code.visualstudio.com/docs/configure/custom-layout | 2026-10-27 | HTTP 200，正文为布局密度 / 主次侧栏位置，未包含「侧栏分区折叠状态持久化」的说明 | **未覆盖本需求点**：不作为来源，不编造 VS Code 结论 |
| GitHub Primer · Collapsible 组件页 | https://primer.style/product/components/collapsible/ | 2026-10-27 | 被重定向到 primer.style 首页，未取到组件文档 | **blocked**：未取到正文 |

- 结论：可用来源 7 个（≥3 门槛已满足），**无整体 blocked**；上表 6 个尝试（含同一来源的多次抓取）如实记录为不可用或未覆盖，未写入任何未读取到的结论。
- 说明：本轮**不需要**外部能力（无头浏览器、云服务等），没有能力型 blocked。

---

## 6. 需求规格（行为细节，供设计与开发对齐）

### 6.1 区块结构（建议，不锁死视觉）

| 区块 | 建议 id | 默认 | 区块头内容 | 内容容器 id |
|---|---|---|---|---|
| 证据库 | `evidence` | **收起** | 标题「证据库」+ 徽标「{n} 条证据」+ 箭头 | `ds-acc-evidence-body` |
| 复测中心 | `verify` | **收起** | 标题「复测中心」+ 徽标（最近复测 `pass 通过 / fail 失败`；无记录显示「无记录」）+ 箭头 | `ds-acc-verify-body` |
| 交付与预览分享 | `delivery` | **收起** | 标题「交付与预览分享」+ 徽标（`{分享数} 个分享 · {交付数} 个交付`，为 0 时只显示一项）+ 箭头 | `ds-acc-delivery-body` |
| 选中项详情 | `detail` | 有选中时展开 | 选中项标题 + 折叠箭头（可选） | `ds-acc-detail-body` |
| 分类分组 | `group:<category>` | 展开 | 分类名 + 数量徽标 + 箭头 | 由索引/稳定 hash 生成唯一 id |

- 区块头整行可点击（`button` 占满宽度，内部左侧标题/徽标、右侧箭头）；箭头方向与展开状态一致。
- 复测中心内部**既有**「复测」按钮（`verificationOpen` 控制命令选择区，8533 / 17639）保持原行为：区块折叠只控制整块容器显隐，不替代该按钮；设计阶段需明确两者视觉关系（见 §10 开放问题 1）。
- 证据库的「添加证据」按钮与文件 input 保留在区块内，展开即可用；收起时 input 仍在 DOM（hidden），不影响已选文件状态。

### 6.2 默认值与持久化

- localStorage 键：`dsh-web-filebrowser:acceptance-collapse`（与现有 `dsh-web-filebrowser:*` 命名一致）。
- 值：JSON，形如 `{"blocks":{"evidence":false,"verify":false,"delivery":false,"detail":true},"groups":{"__uncat__":true,"<category>":false}}`；缺失键按默认值补齐，**不做版本迁移**。
- 默认值：`evidence=false`、`verify=false`、`delivery=false`（收起）；`detail=true`（有选中时展开）；分组默认 `true`（展开）。
- 写入时机：任一区块/分组切换后立即写入；读入时机：验收台首次渲染时读取一次。
- 容错：`readStorage` + `JSON.parse` 包 try/catch；解析失败 / 类型不符 → 全部回退默认值；storage 抛异常（隐私模式）→ 使用内存态，功能可用。
- 分组 key 用**数据里的分类原值**（如 `验收-collapse`），不用显示语言派生；分类为空/缺失统一用 `__uncat__`，避免中英切换后状态丢失。

### 6.3 全部收起 / 全部展开

- 位置：验收台工具区（刷新按钮一行）右侧，两个文字按钮/链接按钮；`disabled` 规则：全部已收起时「全部收起」禁用，全部已展开时「全部展开」禁用（或始终可用但幂等——由设计定，验收只要求可观察结果正确）。
- 「全部收起」：三区块收起 + 所有分组收起 + 详情收起（若有选中，**不取消选中**，清单行高亮保留）。
- 「全部展开」：三区块展开 + 所有分组展开 + 详情展开（若有选中）。
- 两者都写 localStorage；刷新后保持。
- 不改变清单本身的展开状态（清单不是可折叠区块）。

### 6.4 主内容与详情

- `.ds-acc-list` 保持 `flex: 1 1 auto; min-height: 0; overflow: auto`（25591）；三区块收起时它吃掉剩余高度；区块展开时允许清单变短但仍可滚动，禁止清单高度塌成 0。
- 详情规则：
  - 选中项时详情展开，展示验收条件 / 备注 / 证据 / 状态历史（现状内容 17469–17563）。
  - 详情可手动收起（保留选中）；取消选中（现有「取消」17517）→ 详情消失。
  - 手动收起后选择**另一条**验收项 → 详情重新展开（避免「点了没反应」）；同一项再次点击可保持/切换（设计定，验收只要求可观察且不丢失选中）。
  - 详情展开时清单高度缩减但仍可用；详情自身可滚动，不能把工具区顶出可视区。

### 6.5 分类分组折叠

- 分组头从 `div` 改为 `button`，保留分类名与数量徽标（现有 17410–17415 的 name/count 视觉可复用）。
- 点击切换该组条目显隐；收起时组内条目不参与 Tab 顺序；分组头本身可 Tab 到达。
- 折叠状态与其它折叠一起写 localStorage；筛选/全选/批量不因分组折叠改变（全选仍选中被筛出的全部项，包括收起分组中的项——与现状「按筛选结果」语义一致）。
- 新增分类出现时默认展开；分类消失不主动清理旧 key（无害）。

### 6.6 可访问性契约

- 折叠头：`<button type="button" aria-expanded="true|false" aria-controls="<唯一 id>">`；内容容器有对应 `id`。
- 收起：内容容器加 `hidden`（或 `display:none`）；展开：移除 `hidden`。不可只做视觉隐藏而保留 Tab 可聚焦。
- 键盘：Tab 可到达每个折叠头；Enter / Space 切换；切换后焦点仍在按钮；无自定义按键。
- 焦点：`:focus-visible` 描边使用现有品牌 token，可见且不被容器 `overflow: hidden` 裁掉。
- 名称：折叠头文本包含区块标题 + 摘要徽标文本；箭头 `aria-hidden="true"`。
- 不引入 `role="tablist"`/`role="region"` 等额外语义（避免与侧栏既有结构冲突）；如设计坚持 APG region，需保证可读名称。

### 6.7 响应式与主题

- 360px：区块头单行；标题 `min-width: 0`、`overflow: hidden`、`text-overflow: ellipsis`；徽标 `flex: 0 0 auto` 且最多 2 个；箭头固定右侧；面板 `overflow-x: hidden` 且无 `scrollWidth > clientWidth`。
- 691px：同上且信息更完整（可显示第二个徽标）；1440px 不出现区块头过度拉伸（内容最大宽度由现有侧栏决定）。
- 深 / 浅主题：分隔线用 `--dsw-alias-border-l1`，徽标用现有 `color-mix` 品牌色/状态色；正文与徽标文字对比度 ≥4.5:1。

### 6.8 i18n 键（新增建议，命名以实现为准）

- `acceptance.collapseAll` / `acceptance.expandAll`
- `acceptance.block.evidence` / `acceptance.block.verify` / `acceptance.block.delivery`（或复用现有 `acceptance.evidenceLibrary` / `acceptance.retestTitle` / `acceptance.preview`）
- `acceptance.badge.evidenceCount`（`{count}`）、`acceptance.badge.retestResult`（`{pass}`/`{fail}`）、`acceptance.badge.shareCount`（`{count}`）
- `acceptance.collapse` / `acceptance.expand`（`title` / `aria-label` 用）、`acceptance.groupToggle`（分组头名称模板）
- 要求：zh / en 均有键；中文界面无英文残留、英文界面无中文；缺失键回退不崩溃。

### 6.9 不改动的边界（实现时自检）

- 不新增 / 不修改 Host 路由与 `acceptance.js` 逻辑；不改请求字段（`acceptanceAdd` / `acceptanceUpdate` / `acceptanceDelete` / `evidence*` / `verification*` / `delivery*` / `preview*`）。
- 不改 `.dsh/acceptance.json` 结构；不改 `evidenceFiles` / `acceptanceItems` 的数据形态。
- 不删任何既有 DOM 交互（状态按钮、批量、模板、上传、复测、打包、分享、导出）。
- 新 CSS 全部挂在 `ds-acc-*` 命名空间下，避免影响其它面板。

---

## 7. 验收标准（可追溯）

| # | 验收标准 | 验证方法 | 溯源 | 优先级 |
|---|---|---|---|---|
| 1 | 证据库 / 复测中心 / 交付与预览分享默认收起，点区块头可展开/收起，头部有标题 + 摘要徽标 + 箭头，展开后内容与现状一致 | 打开验收台（无偏好）→ 三块只显示区块头；点击三处头部各自展开/收起；检查徽标数值与数据一致；展开后各按钮可点 | 场景 1 + #4 #5 #6 | P0 |
| 2 | 折叠状态写入 localStorage 并在刷新/重开面板后保持；存储损坏/不可用时回退默认且可用 | 展开证据库、收起复测 → 刷新 / 切侧栏再回 → 状态保持；手写损坏 JSON 后刷新 → 回退默认、不崩溃；隐私模式可用 | 场景 3 + #6 #7 | P0 |
| 3 | 「全部收起 / 全部展开」一次作用于所有可折叠区块（含分组与详情），并持久化 | 点全部收起 → 三块 + 全部分组 + 详情收起，清单高亮仍在；点全部展开 → 全部展开；刷新后保持 | 场景 2 + #1 #4 #5 | P0 |
| 4 | 验收项清单默认展开并占满剩余高度；选中详情随选中展开、可收起、取消选中即收起 | 三块收起时清单高度明显大于展开时；选中 → 详情出现；手动收起 → 详情收起但选中保留；取消选中 → 详情消失 | 场景 4 + #4 #5 #6 | P0 |
| 5 | 分类分组头可折叠、带数量徽标，且不影响勾选 / 批量 / 状态操作 / 筛选 | 多分类数据下点分组头 → 该组条目显隐；徽标数量正确；折叠后全选、批量、单项状态、删除、筛选行为不变；刷新后分组状态保持 | 场景 4 + #5 #6 | P0 |
| 6 | 折叠头为 button，`aria-expanded` / `aria-controls` 同步，Enter/Space 可切换，焦点可见，收起内容不参与 Tab | DOM 检查三区块 + 分组 + 详情头：`button`、`aria-expanded` 与视觉一致、`aria-controls` 命中唯一 id；Tab + Enter + Space 实测；收起内容 `hidden` 且 Tab 跳过；`:focus-visible` 可见 | 场景 5 + #1 #2 | P0 |
| 7 | 360px 侧栏与 691px 截图宽度无横向滚动条，长标题/徽标不撑破，浅/深主题正常 | 侧栏拖到 360px、截图宽度 691px 检查 `scrollWidth ≤ clientWidth`；长分类名/多徽标不溢出；浅/深主题检查分隔线、箭头、徽标、正文对比度 ≥4.5:1 | 场景 5 + #4 #6 | P0 |
| 8 | 中英文折叠文案齐全、无硬编码中文、缺失回退合理 | 切 zh/en 检查新增文案（全部收起/展开、徽标、区块标题、分组名）；grep 无硬编码折叠中文；删 en 键后回退不崩溃 | 实现要求 + #5 | P1 |
| 9 | 验收台既有操作与全局功能无回归 | 筛选、全选、批量、状态修改、备注、证据上传/删除、复测运行、导出报告、打包下载、预览分享、交付记录、刷新逐项复测；工作台/流水线/任务/文件树/SSH/Git 冒烟；`npm run check` / `check:json` / `npm test` 退出码 0 | 边界要求 | P0 |
| 10 | 版本与文档同步到 1.2.84，交付后根版本 1.2.86，且只改允许文件 | 插件 `package.json` 1.2.84；`CHANGELOG.md` 1.2.84 条目；`docs/ACCEPTANCE.md` 批次 22；`docs/pipeline/` 同步；交付提交根 `package.json` 1.2.86；`git diff` 不含 Host/数据/依赖改动 | 工作区硬性规定 | P1 |

---

## 8. 验收项清单（10 条）

> **落库说明（重要）**：本会话是流水线派发的 **product 阶段执行单元**，当前会话**没有绑定工作区**，`acceptance_add` 返回 `The workspace acceptance checklist is unavailable because this session has no workspace directory.`（已实际调用验证）。因此 10 条验收项**先在本文档定义**，需由 **Lead / Owner 在具备工作区的会话**用 `acceptance_add` 逐条落库为 `pending`，再由 testing 阶段回填；**不手改 `.dsh/acceptance.json`**。`pipeline_submit_stage` 同样受此限制（见 §12 提交记录）。category 已按模块命名，便于落库直接复制。

| # | title（结论式验收点） | requirement（可复测条件） | category |
|---|---|---|---|
| 1 | 证据库、复测中心、交付与预览分享默认收起，点区块头即可展开/收起并显示数量徽标 | 打开验收台（`paneView=acceptance`，工作区已有验收项与证据）：localStorage 无偏好时三块均为收起态，只显示区块头（标题 + 摘要徽标 + 箭头），内部按钮/列表不可见；点击区块头任意位置展开，再点收起；展开后内容与 v1.2.83 一致（证据上传、复测命令选择、打包/下载/预览分享可用）；证据库徽标 = 证据数量，复测徽标 = 最近复测通过/失败，交付徽标 = 分享链接数 / 交付记录数 | acceptance-collapse |
| 2 | 折叠状态持久化到 localStorage，刷新与重开面板后保持，损坏或不可用时回退默认且不崩溃 | 展开证据库、收起复测中心后刷新页面（F5）→ 状态保持；切到其它侧栏视图再回验收台 → 保持；localStorage 出现 `dsh-web-filebrowser:acceptance-collapse`（或等价键）且值可解析；手动写入损坏 JSON 后刷新 → 回退默认（三块收起、清单展开、分组展开）且无报错；隐私模式 / storage 抛异常时功能仍可用 | acceptance-collapse |
| 3 | 「全部收起 / 全部展开」一次作用于所有可折叠区块（含分组与详情）且持久化 | 工具区存在「全部收起 / 全部展开」；点全部收起 → 三区块 + 全部分组 + 详情收起（选中项高亮仍在清单行）；点全部展开 → 三区块 + 全部分组 + 详情展开；两按钮在全部已收起/已展开时禁用或幂等；操作后刷新仍保持；中英文文案随语言切换 | acceptance-collapse |
| 4 | 验收项清单默认展开并占满剩余高度；选中详情随选中展开、可收起、取消选中即收起 | 三区块收起时清单高度占满工具区以下空间并独立滚动；选中一项 → 详情出现（验收条件/备注/证据/状态历史）；手动收起详情 → 详情消失但选中高亮保留；取消选中 → 详情消失、清单高度恢复；选中另一项 → 详情重新展开；详情展开时清单仍可滚动 | acceptance-collapse |
| 5 | 分类分组头可折叠且带数量徽标，折叠不影响勾选、批量、状态操作与筛选 | 存在 ≥2 个分类时，分组头显示分类名 + 数量徽标；点击分组头收起该组条目，再点展开；折叠时组内条目不参与 Tab 顺序；刷新后分组折叠状态保持；折叠/展开后全选、批量通过/不通过/重置、单项状态修改、删除、四种筛选行为与折叠前一致（选中数量与批量条正确） | acceptance-collapse |
| 6 | 折叠头为 button 且 aria-expanded/aria-controls 同步，Enter/Space 可切换，焦点可见，收起内容不参与 Tab | 检查三个区块头、详情头、分组头：元素为 `<button type="button">`；`aria-expanded` 与视觉展开状态一致（true/false 切换）；`aria-controls` 指向内容容器且 id 唯一；Tab 可到达，Enter 与 Space 均切换且焦点留在按钮；`:focus-visible` 有可见描边；收起内容为 `hidden`/`display:none` 且 Tab 跳过；折叠头可读名称含区块标题与徽标文本 | acceptance-a11y |
| 7 | 360px 侧栏与 691px 截图宽度下无横向溢出，浅/深主题可读 | 侧栏 360px 与 691px 下：`document.scrollWidth ≤ clientWidth`（无横向滚动条）；长分类名/多徽标截断或省略、不撑破；箭头与标题不被裁切；浅色/深色主题下分隔线、箭头、徽标与正文对比度 ≥4.5:1；1440px 下区块头不变形 | acceptance-layout |
| 8 | 中英文折叠文案齐全、无硬编码中文、缺失回退合理 | 切 zh/en：全部收起/全部展开、三区块标题、三个徽标、分组折叠名称等均有正确翻译；中文界面无英文残留、英文界面无中文；grep `client.js` 折叠相关渲染无硬编码中文；删除 en 一个键后界面回退到 zh 或 key 且不崩溃 | acceptance-i18n |
| 9 | 验收台既有操作与全局功能无回归，质量门全绿 | 逐项复测：刷新、添加、模板、筛选（全部/未完成/不通过/缺证据）、全选、批量三操作、取消选择、单项状态四按钮、删除、备注保存、证据上传/删除、复测运行/发送失败、导出验收报告、打包交付/下载构建产物、预览分享创建/复制/打开/关闭、交付记录下载、交付包下载；工作台/流水线/任务/文件树/SSH/Git/预览分享冒烟；`npm run check`、`npm run check:json`、`npm test` 退出码 0 | acceptance-regression |
| 10 | 版本与文档同步到 1.2.84 且交付后根版本 1.2.86，只改允许文件 | 插件 `dsh-web-filebrowser-plugin/package.json` = 1.2.84；`CHANGELOG.md` 有 1.2.84 条目；`docs/ACCEPTANCE.md` 有批次 22；`docs/pipeline/` 需求/设计/测试/复核/发布文档同步；交付提交中根 `package.json` = 1.2.86；`git diff` 仅 `client.js` + i18n + 插件版本 + CHANGELOG + docs，无 Host API / 数据结构 / 依赖变更 | version-docs |

---

## 9. 版本与文档

- 插件 `dsh-web-filebrowser-plugin/package.json`：1.2.83 → **1.2.84**。
- 根 `package.json`：当前 1.2.85；**交付后 +1 至 1.2.86**（工作区硬性规定）。
- `CHANGELOG.md`：新增 1.2.84 条目（验收台分区可收起 / 全部收起 / 分组折叠 / a11y / i18n）。
- `docs/ACCEPTANCE.md`：新增**批次 22**（本轮复测步骤：默认收起、持久化、全部收起/展开、分组折叠、键盘、360/691 布局、回归与自动化）。
- `docs/pipeline/`：`requirements.md`（本文）、`design.md`、`test-report.md`、`acceptance-review.md`、`release.md` 同步本轮；上轮（v1.2.83）需求已归档 `docs/pipeline/archive/v1.2.83-requirements.md`。
- 若面板文案变更涉及 README 的验收台章节，同步 `README.md` / `README.zh.md`（如有相关表述）。

---

## 10. 风险与开放问题

| 风险 | 影响 | 缓解 |
|---|---|---|
| 折叠后内容仍挂载（hidden），54 条项 + 23 证据 + 24 复测命令同时存在，渲染量不小 | 低 | `hidden` 不参与布局、无额外请求；不新增每帧计算；如仍卡顿，证据列表可分页（后续需求） |
| localStorage 损坏、旧值 schema 不符、多标签页并发写 | 中 | 读取包 try/catch + 类型校验 + 默认值合并；写入失败静默降级内存态；验收项 2 专门覆盖 |
| `verificationOpen`（复测命令区开关，8533）与新区块折叠叠加，可能双开关困扰 | 中 | 明确「区块折叠=容器级，`verificationOpen`=命令区级且保持原行为」；设计阶段画清两态；见开放问题 1 |
| 分组持久化 key 用显示语言派生会导致中英切换丢状态 | 中 | 用数据里的分类原值作 key；空/缺失统一 `__uncat__`；验收项 5 覆盖刷新，验收项 8 覆盖语言切换 |
| 360px 下「标题 + 2 个徽标 + 箭头」过挤 | 中 | `min-width: 0` + 省略号 + 徽标最多 2 个；超出合并 `+n`；验收项 7 实测 |
| 全部收起后 Owner 找不到证据/交付入口 | 中 | 区块头常显 + 徽标信息 + 「全部展开」；创新假设 1 的失败预案 |
| 详情可收起被误认为选中丢失 | 低 | 清单行选中高亮保留；详情头显示选中标题；创新假设 4 的失败预案 |
| 深色主题下徽标（品牌色 12% 背景 + 品牌色文字）对比不足 | 中 | 用现有 token 与状态色；验收项 7 要求 ≥4.5:1；必要时徽标改 `bg-layer-2` + `label-secondary` |
| GUI 渲染无法由模型完全实测 | 中 | 提供静态断言 + 截图证据；Owner 按 `docs/ACCEPTANCE.md` 批次 22 复测；未测项标 blocked，不伪造 pass |

**开放问题（需 UI 设计 / Owner 拍板，不阻塞本轮实现）**

1. **复测中心两层开关的关系**：区块折叠（容器级）与既有「复测」按钮（命令区级，`verificationOpen`）如何呈现？默认建议：区块头只开合容器；「复测」按钮保持原行为（默认命令区收起，点开才出现命令列表）。
2. **详情是否需要独立折叠头**：默认建议「有选中即展开 + 详情内收起入口」；不新增详情持久化键，避免与选中状态冲突。
3. **折叠偏好是否按工作区隔离**：默认单键全局；若 Owner 需要每工作区独立，记为后续需求（键名追加 root 标识）。
4. **是否允许折叠动画**：默认不加（保持 `hidden` 语义简单、避免高度抖动）；若设计坚持，需保证 `prefers-reduced-motion` 下关闭。
5. **「全部收起」是否同时禁用详情区**：默认「不取消选中，只收起详情」；若 Owner 更希望一键清空选中，需另加动作（不在本轮）。

---

## 11. 历史与归档

- 上一版文档：v1.2.83 第 11 轮「设计先确认：设计阶段截图/HTML 预览 + 开发前人工闸门」，已归档到 `docs/pipeline/archive/v1.2.83-requirements.md`（本轮开始时从 `requirements.md` 原样复制归档）。
- 更早归档：`docs/pipeline/archive/v1.2.79-requirements.md`（工作台 UI 重构）、`v1.2.78-requirements.md` 等；本轮基线为 v1.2.83 交付（`8e03d0c`）+ v1.2.85 包瘦身（`1d85de4`）。
- 本轮只覆盖「验收台分区可收起 + 全部收起/展开 + 分组折叠 + a11y/i18n/响应式 + 版本文档」，不重述历史轮次内容。

---

## 12. 阶段提交记录

- 本阶段（product，第 12 轮）提交受会话工作区绑定限制：`pipeline_status` / `pipeline_stage_prompt` / `acceptance_add` / `pipeline_submit_stage` 在本执行单元均返回 `... unavailable because this session has no workspace directory.`（已逐一实际调用）。需求原文已存在于 `.dsh/pipeline.json`（本轮 `round=12`、product=active），本文档与其一致。
- 待 Lead 在具备工作区的会话：① 用 `acceptance_add` 落库 §8 的 10 条（`pending`）；② 用 `pipeline_submit_stage({stageId:'product', artifacts:[{path:'docs/pipeline/requirements.md', label:'需求分析 v1.2.84 第 12 轮'}]})` 提交本阶段。
