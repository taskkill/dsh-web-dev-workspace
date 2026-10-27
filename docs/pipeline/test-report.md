# 测试报告：工作台三区重构（v1.2.76）

- 阶段 testing（第 4 轮）｜ 2026-10-27 ｜ QA `opc-qa` ｜ 需求：工作台 UI 重构 —— 三区（现在/项目/交付）+ hero + 折叠交付卡 + 需求摘要化（v1.2.76）
- 环境：工作区 `/data/dsh/home/dsh-web-powerfilebrowser/dsh-web-filebrowser`；Linux；Node **v24.22.0**；npm **11.19.1**；Git HEAD **97316d2**（工作区 git 变更文件数个位数——**该数字是版本控制计数，不是用例数**）
- 版本：根 `package.json` **1.2.76**、`dsh-web-filebrowser-plugin/package.json` **1.2.76**（DEF-01 已修复）、`CHANGELOG.md` 含 `## 1.2.76 — 2026-10-27`
- 流水线状态（`.dsh/pipeline.json`，第 4 轮）：Host 数据/流水线代码本轮**零改动**（git diff 无 Host 模块）；工作台为纯客户端渲染变更
- **结论：4 pass / 0 fail / 8 blocked（GUI 待 Owner）。** 三区/hero/折叠/需求摘要/视觉 tokens/i18n/无障碍属性/响应式 CSS 均通过**静态检查**；全部回归命令全绿；DEF-01（版本/CHANGELOG）已修复并复测；blocked 8 项为**纯 GUI/视觉/交互**验收项，需 Owner 重建客户端 bundle + 刷新后按 `docs/ACCEPTANCE.md` 批次 13 人工复测。**建议：通过（进入 acceptance 复核）。**

## 1. 范围

- 覆盖 `.dsh/acceptance.json` 中 v1.2.76 的 **12 条验收项**：三区分层与空态、hero 三态、需求摘要化（不直出 PRD）、5 卡默认折叠/展开全部、失败自动展开与红点、视觉规范、option-a 落地与设计自评、i18n、无障碍、响应式、回归安全、文档与版本。
- 被测代码：`dsh-web-filebrowser-plugin/client.js`（**+556 / −14**：三区渲染、hero、折叠状态、需求摘要 helper、i18n 键、CSS）；本轮无 Host/依赖/数据改动。
- 被测文档：`docs/pipeline/requirements.md`、`docs/pipeline/design.md`（含三区 IA/tokens/自评）、设计落地稿 `docs/pipeline/design/workbench-redesign-*.svg|png`、`docs/proposals/workbench-redesign/`、`docs/ACCEPTANCE.md` 批次 13（本轮新增）。
- 测试代码：`scripts/selftest/host-smoke.mjs`（31 用例，回归）、`.dsh/tmp/team/{pipeline,review,assignments}-selftest.mjs`、新增 `.dsh/tmp/qa-static-v1276.mjs`（60+ 静态断言）。
- 不测（Owner 人工复测）：浏览器 DOM 实际渲染/点击/键盘、真实数据下的 hero/折叠自动展开、对比度实测、360/768/1280 视口、200% zoom、语言切换渲染；这些对应 8 条 blocked 项。

## 2. 命令与结果（最终复跑 2026-10-27T06:32Z，DEF-01 修复后）

| # | 命令 | 目的 | 退出码 | 耗时 | 通过数 / 总数 | 结论 |
|---|---|---|---|---|---|---|
| 1 | `npm run check` | 21 个模块 `node --check`（含 client.js +556 行） | **0** | 615 ms | 21/21 文件 | PASS |
| 2 | `npm run check:json` | JSON 文件校验 | **0** | 177 ms | JSON OK | PASS |
| 3 | `npm test`（host-smoke） | Host smoke 回归 | **0** | 737 ms | **31/31** | PASS |
| 4 | `node .dsh/tmp/team/pipeline-selftest.mjs` | 七阶段双复核回归 | **0** | 694 ms | **38/38** | PASS |
| 5 | `node .dsh/tmp/team/review-selftest.mjs` | 变更审阅回归 | **0** | 798 ms | **22/22** | PASS |
| 6 | `node .dsh/tmp/team/assignments-selftest.mjs` | 工作台指派器回归 | **0** | 165 ms | **27/27** | PASS |
| 7 | `node .dsh/tmp/qa-static-v1276.mjs` | v1.2.76 静态检查（i18n/结构/摘要/折叠/视觉/无障碍/差异范围/版本） | **0** | 148 ms | **STATIC PASS** | PASS |

**B1-A 复测轮（2026-10-27T06:42Z）**：`qa-static-v1276` → **STATIC PASS**（exit 0，148ms；新增 B1-A 断言 17 项全部通过）；`npm run check` exit 0（665ms）；`npm test` **31/31**（700ms）。

**计数口径（唯一权威）**：host-smoke **31/31**、pipeline-selftest **38/38**、review-selftest **22/22**、assignments-selftest **27/27**、`npm run check` 覆盖 **21** 个模块、验收项 **12 条**（4 pass / 0 fail / 8 blocked）。报告不使用 git 变更文件数作为用例数。

## 3. 静态检查（`.dsh/tmp/qa-static-v1276.mjs`）

### 3.1 i18n（新增三区/hero/折叠/摘要键 + 旧 assign 键）

| 键组 | zh | en | 成对 | 说明 |
|---|---|---|---|---|
| `workbench.section.*` | **7** | **7** | ✅ | 三区标题/副说明/现在区空态 |
| `workbench.hero.*` | **5** | **5** | ✅ | 当前阶段/进度/负责角色/闸门提示/启动派发 |
| `workbench.fold.*` | **8** | **8** | ✅ | 展开/收起/全部/计数/空/失败计数/自动展开提示 |
| `workbench.requirement.*` | **3** | **3** | ✅ | 查看完整/轮次范围 chips/摘要提示 |
| **新增合计** | **23** | **23** | ✅ | 需求要求约 18–24 键 ✔ |
| `workbench.assign.*`（旧） | **122** | **122** | ✅ | 无删除/重命名（指派器文案不回归） |
| 词典总计 | 1202 | 1202 | ✅ | 无单向缺失、无 key 名残留 |

### 3.2 结构 / hero / 摘要 / 折叠（静态断言全部 PASS）

- **三区**：`nowSection, projectSection, deliverySection` 顺序渲染；每区 `<section aria-labelledby=…>` + 动态 title id；区头含 `ds-wb-zone-bar`（3px 色条）/`ds-wb-zone-icon`/`13px 600` 标题/hint；无项目时只渲染需求卡（不伪造 hero）；现在区空态有提示。
- **hero**：阶段/状态 pill/摘要（line-clamp 2）/7 点进度（aria-hidden）/`x/7` 进度文字/负责角色；动作按 `reviewStage`（通过+打回+辅助链接）、pending/failed（启动并派发+指派任务）、其他（打开流水线+指派任务）分支；`workbench.hero.gateNote` 闸门提示。
- **需求摘要化（B1-A 新口径）**：`requirementSummaryText()` 剥离代码块/行内代码/标题/链接/markdown 符号，超 160 字截断（附省略号）；渲染 `.ds-wb-adjust-summary` + `line-clamp 2`（单行文本、最多 2 行显示）；**源码无 `ds-wb-adjust-detail` 全文渲染路径 / 无完整 detail 文本区块**——完整 detail 仅作为 `title` 属性（悬停提示，不进入 innerText 文本区块）；**摘要允许为 detail 的节选，逐字重合不作为失败依据**；四个操作（查看完整/追加/修改/新轮）保留。
- **折叠**：5 卡 `design/acceptance/preflight/review/running`；`useState([])` 默认全收起；折叠头 `aria-expanded` + `aria-controls` + body `hidden` + `role=region`；`foldAutoKeys` 自动展开（acceptance `failCount>0`、preflight `some(level==='fail')`）；手动收起记入 `workbenchFoldsClosed`；`expandAllFolds`/`collapseAllFolds`；失败红点 `ds-wb-fold-dot` 与 `fold-auto` 提示。
- **CSS/tokens**：页面浅灰蓝底（layer-2 42% mix）、白卡 `border-radius:12px` + `box-shadow:0 1px 2px`、色条 `width:3px`、卡片标题 `12px` + `text-transform:none`、分区标题 `13px`、hero 动作 `min-height:44px`、`outline:2px solid` + `offset`、`@media (max-width:700px)` 单列、`prefers-reduced-motion: reduce` 降级。
- **调试残留**：新增行无 `console.log`、无 `debugger;`；`node --check client.js` exit 0。

### 3.3 B1-A 口径修订与复测（PM acceptance）

> **修订原因**：验收项 `54b593b33b` 原条件②「DOM 不含 detail 连续 60 字片段」与需求/设计「≤2 行摘要」自相矛盾——摘要本应由 detail 派生，实测最长逐字匹配 141 字。PM acceptance 将条件②改为「不出现 detail 的**整段全文渲染**（无 `ds-wb-adjust-detail` 全文路径 / 无完整 detail 区块）；摘要允许是 detail 的节选，逐字重合不作为失败依据」，①③④⑤ 保持。
> **QA 复测（2026-10-27T06:42Z，`qa-static-v1276` 新增 B1-A 断言块）**：STATIC PASS（exit 0，148ms）；实测当前工作区 requirement detail=**2396 字** → `requirementSummaryText` 摘要=**161 字**（160+省略号）、单行；源码无 `ds-wb-adjust-detail` 渲染块，完整 detail 仅出现在 `title` 属性（非 innerText 文本区块）；四操作均存在；无需求时由 intake/需求卡空态承接。回归：`npm run check` exit 0（665ms）、`npm test` 31/31（700ms）。

### 3.4 改动范围 / 依赖 / 版本

- `git diff --stat`：**仅 3 个文件** — `client.js`（+556/−14）、`docs/pipeline/design.md`、`docs/pipeline/requirements.md`；另 `docs/ACCEPTANCE.md`/`test-report.md` 为本轮测试文档；**无 Host 模块**（index/assignments/pipeline/review/acceptance）改动；未跟踪文件均在 `docs/`（设计稿/提案）。
- 依赖：两个 `package.json` 的 `dependencies` 与 HEAD 完全一致（**未新增**）；本轮无 package.json diff。
- 版本/CHANGELOG：根 **1.2.76** ✔、插件 **1.2.76** ✔（DEF-01 已修复：插件 1.2.75→1.2.76，diff 仅版本号，dependencies 未动）；`CHANGELOG.md` 顶部含 `## 1.2.76 — 2026-10-27`（三区/hero/需求摘要/折叠/视觉/i18n/响应式/测试 + Housekeeping 含批次 13 与双包 1.2.76）；`qa-static-v1276` → **STATIC PASS**。

## 4. 用例与结果

- `qa-static-v1276.mjs`：i18n 15 项、三区/hero 20+ 项、摘要 9 项、折叠 15 项、CSS/无障碍/响应式 18 项、diff 范围/调试残留 10 项、版本/依赖 6 项——除 2 条 DEF-01 外全部 PASS。
- 回归：`npm run check`（21 模块）、`npm test`（31/31）、pipeline-selftest（38/38）、review-selftest（22/22）、assignments-selftest（27/27）全绿；Host 模块零改动 → 七阶段/双复核/指派器/验收/交付/审阅逻辑无回归。
- 说明：本轮**只改 client.js**，Host 无改动，因此所有 Host 层测试为“无回归证明”；工作台 UI 行为需浏览器验证（见 blocked 项）。

## 5. 12 条验收项逐条对照

| # | 验收项 id | 验收项（结论式） | 结论 | 证据 / 原因 |
|---|---|---|---|---|
| 1 | `b4d6cd2e33` | 三区分层落地（现在/项目/交付，模块一眼可辨，无待办降级） | **blocked** | 静态已证结构（三 section/顺序/区头/空状态分支）；视觉与空态呈现需 Owner 刷新后按批次 13 核对 |
| 2 | `dc651f1f45` | hero 当前阶段卡首屏可见，主操作按阶段正确 | **blocked** | 静态已证分支（通过+打回 / 启动派发+指派 / 查看流水线+指派）与进度/闸门提示；首屏位置与点击效果需浏览器 |
| 3 | `54b593b33b` | 「需求与调整」不再直出整段 PRD：摘要+四操作（B1-A 修订口径） | **pass**（按 B1-A 新口径复测） | 新口径：不出现 detail **整段全文渲染/区块**，摘要允许为 detail 节选、逐字重合不作为失败依据。证据：`qa-static-v1276` B1-A 断言（STATIC PASS，148ms）——无 `ds-wb-adjust-detail` 渲染路径；`.ds-wb-adjust-summary` + `line-clamp:2`；helper 纯文本化+160 字截断；完整 detail 仅 `title` 属性（3.3 节记录 detail 2396 字 → 摘要 161 字、单行）；四操作均在；无需求走空态。「查看完整需求」弹层交互留 Owner 抽查（剩余风险）。 |
| 4 | `b1c04ed3fb` | 交付区 5 卡默认收起、折叠头计数、展开后内容完整 | **blocked** | 静态已证默认 `useState([])`、5 卡定义、计数摘要、`aria-expanded/controls/hidden`、展开全部/收起全部；点击展开内容/不丢滚动需浏览器 |
| 5 | `576044e996` | 关键失败自动展开 + 红点，修复后恢复收起 | **blocked** | 静态已证 `foldAutoKeys`（acceptance fail>0、preflight fail）与红点/`fold-auto`、手动收起记忆；构造 fail 数据后的实际表现需 GUI 验证 |
| 6 | `60c8493783` | 视觉规范落地（底色/白卡/色条/字号/间距/对比度） | **blocked** | 静态已证 tokens/字号/间距/圆角/阴影/focus 样式；实际对比度测量与截图为 GUI 验证 |
| 7 | `1902af2ad1` | 实现与 option-a 基准一致、设计五维自评 ≥4 | **blocked** | design.md 已记录三区 IA/tokens/状态矩阵/响应式/无障碍/自评；与 option-a 逐区目视比对需 Owner |
| 8 | `e296650343` | i18n 中英文完整，旧 assign 键不破坏 | **pass** | 静态可证：新增 23 键 zh/en 各 23 且完全成对；assign 122 键未变；词典总计 1202/1202 无单向缺失。语言切换后的渲染留 Owner 抽查（剩余风险） |
| 9 | `47d54ee97e` | 无障碍：折叠 aria/焦点/44px/reduced-motion | **blocked** | 静态已证 `aria-expanded`/`aria-controls`/`hidden`/`role=region`、section `aria-labelledby`、44px、focus-visible、reduced-motion CSS；Tab 顺序/焦点归还需浏览器 |
| 10 | `61289ca00a` | 响应式 ≤700 单列，360/768/1280 无横向溢出 | **blocked** | 静态已证 `@media (max-width:700px)` 单列/按钮换行/折叠单列；实际视口溢出与 200% zoom 需浏览器 |
| 11 | `3e1d932372` | 回归安全：四命令全绿、无 Host 改动/无新依赖/数据未变 | **pass** | 命令全绿（见 §2）；`git diff` 仅 client.js+docs、Host 模块零改动；dependencies 未新增；无 `.dsh` 数据文件进入 diff。GUI 手工回归（流水线/指派/验收/交付/标签菜单）留 Owner 抽查 |
| 12 | `0f85704800` | 文档与版本一致：design/ACCEPTANCE 批次13/CHANGELOG 1.2.76/双 package 1.2.76 | **pass**（DEF-01 修复后复测转 pass） | design.md 本轮设计 ✔、ACCEPTANCE 批次 13 ✔（本轮新增）；**DEF-01 已修复：插件 + 根 package.json 均 1.2.76**（插件 diff 仅版本号，dependencies 未动），`CHANGELOG.md` 含 `## 1.2.76 — 2026-10-27`；`node .dsh/tmp/qa-static-v1276.mjs` → **STATIC PASS**（148ms）。history：pending→fail→pass。证据：§2/§3.3/§7 |

**合计：pass 4 / fail 0 / blocked 8（GUI 待 Owner）。**

## 6. 回归范围与结果

- Host 层：`npm run check`（21 模块）、`npm test` 31/31、pipeline-selftest 38/38、review-selftest 22/22、assignments-selftest 27/27 全绿；本轮 **Host 模块零改动**（无 index/assignments/pipeline/review/acceptance diff）→ 七阶段双复核、指派器、验收台、交付/审阅/记忆/待办无实现层回归。
- 客户端：`client.js` 为**加法式**重构（+556/−14，删除行集中在旧工作台卡片区块的重排）；`node --check` 通过；旧 `workbench.assign.*` 122 键与指派器/标签菜单/流水线/验收卡渲染函数均保留。
- 数据：无 `.dsh/pipeline.json` / `.dsh/acceptance.json` 改动（UI 只读渲染）；无新增依赖。

## 7. 缺陷 / 阻塞

| ID | 标题 | 严重度 | 状态 | 说明 / 修复建议 |
|---|---|---|---|---|
| DEF-01 | 版本/CHANGELOG 未同步：插件 `package.json` 仍 **1.2.75**（应 1.2.76）、`CHANGELOG.md` 缺 `## 1.2.76 — 2026-10-27` | **P2（交付记录/验收项 12）** | **已修复并复测通过** | Lead 已把插件升至 1.2.76（根保持 1.2.76，dependencies 未动）并新增 CHANGELOG 1.2.76 段；复测 `qa-static-v1276` → **STATIC PASS**（148ms）、`npm run check` exit 0（615ms）、`npm test` 31/31（737ms）；item 12 转 pass（history pending→fail→pass）。 |
| BLOCKED-GUI | 8 条纯 GUI/视觉/交互验收项：b4d6cd2e33、dc651f1f45、b1c04ed3fb、576044e996、60c8493783、1902af2ad1、47d54ee97e、61289ca00a | — | blocked（Owner 人工） | 需 Owner：① 重启 Harness（确保 Host 最新）；② **重建客户端 bundle**（client.js 有改动）；③ 强制刷新；④ 按 `docs/ACCEPTANCE.md` 批次 13 逐项核对（三区/hero/折叠/自动展开/视觉/option-a/无障碍/响应式）；⑤ 结果回填验收项。Host 逻辑与 i18n/结构静态已验证，非实现缺陷。 |
| OBS-01（非阻断） | 旧 CSS `.ds-wb-adjust-detail` 规则仍保留（渲染已不再使用，属死样式） | P3 | 观察 | 不影响“不直出 PRD”（无 JSX 使用）；可在后续清理死 CSS。 |

## 8. 剩余风险

1. **GUI 未由 QA 浏览器实测**：8 条 blocked 项覆盖三区视觉、hero 交互、折叠点击/自动展开、对比度、option-a 落地、键盘焦点、360/768/1280 视口与 200% zoom；自动化仅能证明代码结构与样式规则存在。
2. **折叠状态为会话内记忆**：刷新后恢复默认收起（design 已声明不做 localStorage）；Owner 复测时注意该预期。
3. **需求摘要长度（B1-A 口径）**：摘要为 detail 节选（~160 字 + 2 行截断，逐字重合不设阈值），超长需求需点「查看完整需求」；若 Owner 认为摘要信息不足，可调阈值（非阻断）。
4. **旧工作台卡片删除行**：client.js 有 −14 行（原卡片平铺区块重排为三区），需 GUI 回归确认所有旧卡片入口仍在（静态已确认渲染函数保留）。
5. **DEF-01 版本/CHANGELOG**：已修复（根 + 插件均 1.2.76，CHANGELOG 1.2.76 齐全），复测 STATIC PASS。
6. 真实发布/SSH 工作区/深色主题沿用现状人工复测。

## 9. 结论与建议

- 自动化：`npm run check`（604ms）、`check:json`（177ms）、`npm test` 31/31（696ms）、pipeline-selftest 38/38（694ms）、review-selftest 22/22（798ms）、assignments-selftest 27/27（165ms）全部 exit 0；`qa-static-v1276` 60+ 断言仅 2 条版本项失败（DEF-01）。
- 静态：三区结构/hero 分支/需求摘要（B1-A 新口径：无整段全文渲染，摘要为 detail 节选、≤2 行/≤160 字）/折叠默认收起与自动展开逻辑/i18n 23 新键成对 + assign 122 键不回归/无障碍 aria 属性/响应式 ≤700 CSS/视觉 tokens/无调试残留/diff 仅 client.js+docs/无新依赖——全部通过；`qa-static-v1276` B1-A 断言块 STATIC PASS。
- 验收：**4 pass / 0 fail / 8 blocked（GUI 待 Owner）**；DEF-01（版本/CHANGELOG）已修复并复测，blocked 为纯 GUI/视觉项。
- **建议：通过**，提交 testing 阶段；由 Owner 重建客户端 bundle + 刷新，按 `docs/ACCEPTANCE.md` 批次 13 完成 GUI/视觉人工复测，随后进入 acceptance 复核与 approval 人工确认。未改业务代码、未审批、未创建 git 提交。
