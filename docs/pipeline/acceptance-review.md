# 验收复核报告（项目经理 Agent）— 第 11 轮 · v1.2.83「设计先确认：设计稿截图 / HTML 预览 + 开发前人工闸门」

- 轮次 / 阶段：第 11 轮 · acceptance（双复核第一关；`gateMode=fast`、`roundScope=full`；前四阶段 product/design/development/testing 记录为 approved）
- 复核时间：2026-10-27 20:08–20:20（Asia/Shanghai，含 20:10–20:12 的 P2 闭环复验）；复核人：项目经理 Agent（**只读复核**：未改业务代码/需求/设计/验收结论/测试报告，未审批、未发布、未 commit；P2 闭环由 Lead 修复 QA 临时脚本，复核人仅复跑并更新本报告）
- 基线：Git HEAD **`2d3ebe0`**（`fix(workbench): 打包交付不再清空流水线快照，修复跳回需求录入`，已提交）
- 未提交变更（复核时实测 `git status` / `git diff --stat HEAD`）：**36 个文件 = 17 个已改 + 19 个未跟踪新增**；`git diff` = **17 files, +2712 / −451**；写入本报告后为 37 个变更（+1 本报告）
- 版本：插件 `dsh-web-filebrowser-plugin/package.json` **1.2.83**；根 `package.json` **1.2.83**（交付后 +1 至 1.2.84 属 release 阶段）；CHANGELOG `## 1.2.83`；`docs/ACCEPTANCE.md` 批次 20；design.md §16
- 复核环境：Linux；Node **v24.22.0**；npm **11.19.1**；工作区无 `node_modules`（测试仅用 Node 内置能力）；本会话**无浏览器/无 GUI 点击能力**，GUI 视觉项一律不伪造 pass
- 复核产物：本报告 `docs/pipeline/acceptance-review.md` + 复测日志 `.dsh/evidence/acceptance-retest-v1.2.83.log`（**880 行**：首轮全量复测 + P2 闭环复验，共 18 条命令原文/退出码/耗时）

> **结论先行：建议放行（待 Owner 批次 20 复测 blocked 项）**。代码/功能阻断 **0**；原 **P2 证据链阻断已闭环**（Lead 20:09:58 为 `qa-static-v1283` 白名单补入插件 README，复核 20:10 复跑 **`STATIC PASS (246 assertions)`**，见 ④-1）；剩余 **6 条 blocked** 均为 GUI 视觉/人工回归，需 Owner 按 ACCEPTANCE 批次 20 复测；**未发现 fail**。若 Owner 批次 20 发现真实功能缺陷，则回退 **development**。

---

## ① 基线与复核范围

| 项 | 实测值 |
|---|---|
| 工作区 | `/data/dsh/home/dsh-web-powerfilebrowser/dsh-web-filebrowser` |
| HEAD | `2d3ebe0`（提交信息见上）；HEAD 前一条 `c545d78` = 根版本 +1 至 1.2.83 |
| 变更面 | 17 已跟踪 + 19 未跟踪 = 36；`+2712/−451`（不含未跟踪文件内容） |
| 已跟踪改动 | `CHANGELOG.md`、`README.md`、`README.zh.md`、`docs/{ACCEPTANCE,AGENT_TEAM,PLAYBOOK}.md`、`docs/opc/{02-design,README}.md`、`docs/pipeline/{design,engineering-research,requirements,test-report}.md`、`dsh-web-filebrowser-plugin/{README,client.js,pipeline.js,package.json}`、`scripts/selftest/host-smoke.mjs` |
| 未跟踪新增 | `docs/pipeline/archive/{v1.2.79-requirements.md, v1.2.82-test-report.md}`、`docs/pipeline/design/design-gate-*` 8 组 PNG+SVG、`docs/pipeline/design/gen-design-gate-mockups.mjs` |
| 关键行数核对 | client.js `+1424/−42`、pipeline.js `+76/−21`、host-smoke `+58/−9`（与 dev summary 的 `+1461/−38` 有差：dev summary 记旧数，实测为准；测试报告 O8 已记录此 bookkeeping 差异） |
| 验收清单（复核时） | **49 条 = 26 pass / 0 fail / 23 blocked / 0 pending** |
| 证据挂载 | **44 条 evidence 全部存在（0 缺失）**；**10 条无 evidence**（3 条历史 pass + 7 条历史 blocked；本轮 #8/#9 已由 Lead 于 20:10:08 分别补挂 `docs/pipeline/test-report.md` / `CHANGELOG.md`） |
| 审阅状态 | `.dsh/review.json`：acceptance 基线已捕获（`11:acceptance`，20:04:14，36 文件）；`marks = 0`、`comments = 0` → **已审 0/36**（Owner 尚未标记，属 approval 前的已知条件，不是阻断） |
| 上游门禁 | product/design/development/testing = approved（fast 模式记录为「Owner 预授权自动通过」；design 的实际确认方式见 ⑨ OBS-1） |

---

## ② 需求覆盖表（对照 `docs/pipeline/requirements.md` 第 11 轮 + `.dsh/pipeline.json` 需求全文）

> 需求事实源：`.dsh/pipeline.json` 的 requirement（含 19:17 追加的打包热修需求）+ `docs/pipeline/requirements.md` §3 范围 / §4 约束 / §6 行为规格 / §7 验收标准 / §8 验收项清单（10 条）。逐点映射到验收项与测试证据。

| # | 需求目标 / 范围点 | 落库验收项（本轮新增） | 测试/证据 | 复核判定 |
|---|---|---|---|---|
| 1 | 闸门：design 改为强制人工确认；fast 只剩 product/development/testing/acceptance 自动通过；design 提交停 `review`；design 未 approved 时 `pipeline_start_stage('development')` 被拒 | `8e375b5dff`（停 review）、`2d2729bed2`（开发被拒/确认后解锁） | `dev-design-gate-check`（真实 Host 模块跑通）、`npm test` 34/34 新增用例、pipeline.js `PIPELINE_MANUAL_GATE_STAGES` | **覆盖（pass）**；实机生效需重启 Host（见 ⑨ OBS-1） |
| 2 | 视觉评审：截图（PNG/JPG/SVG/WebP/GIF）在流水线卡与工作台卡显示缩略图并可打开大图 | `e6d0b2bb93` | `fe-render-smoke` 51/51（D1/D3 缩略图、lazy、alt）、qa-static 静态断言 | **代码覆盖**；GUI 实际呈现 → **blocked（批次 20）** |
| 3 | 视觉评审：HTML 设计产物 iframe 内嵌渲染、`sandbox`、三档 360/768/1280、源码为次级入口 | `0f33968c3e` | `fe-render-smoke`（D2 dialog/iframe/sandbox=''/title/lazy/三档/查看源码）、qa-static | **代码覆盖**；GUI 渲染与切档 → **blocked（批次 20）** |
| 4 | 待确认态：review 时两处显示「设计稿待你确认 · 确认后进入开发」+ 通过/打回/预览入口 | `da409176e3` | `fe-render-smoke`（review banner、确认/打回、approved 后消失） | **代码覆盖**；两处实际呈现 → **blocked（批次 20）** |
| 5 | HTML 文件预览：`.html/.htm` 默认渲染预览、工具栏预览/源码切换、空/不可读退化 | `5c6cfc4eef` | `fe-render-smoke`（D4 预览/源码切换/空态）、代码核对 `modeOf→html`、`openFile` 默认 preview、`switchTabToSource`/`showHtmlPreview` | **代码覆盖**；GUI 默认渲染/保存切回 → **blocked（批次 20）** |
| 6 | 模型侧纪律：design 提示词要求至少一张截图、HTML 不能替代、不贴源码；无截图 warning 文案准确；快速模式「四个自动/三个需人工」全副本同步 | `b75496c076`（提示词/warning）、`2f6c7001ee`（文案） | pipeline.js `STAGE_GUIDES.design` / `PIPELINE_SECTION` / 工具描述；host-smoke 新增 warning 用例；qa-static 静态断言；grep 旧口径 | **覆盖（pass）** |
| 7 | §7-8 版本文档：插件 1.2.83、CHANGELOG、ACCEPTANCE 批次 20、docs 同步；交付后根 +1 至 1.2.84 | `2c499c8a82` | 逐项实测（版本/CHANGELOG/批次 20/§16/8 组设计稿非空/归档）；根 +1 属 release | **覆盖（pass）**，release 关动作待执行 |
| 8 | §7-9 质量门全绿 + 既有功能不回归（含 GUI） | `58e9af9d1b` | `npm run check` / `check:json` / `npm test 34/34` / `fe-render-smoke 51/51` / packfix 18/18 / normal 七阶段回归 / `git diff --check`；GUI 项需 Owner | **自动化覆盖**；人工 GUI → **blocked（批次 20）** |
| 9 | **追加需求（Owner 19:17 打包热修）**：打包不清空 pipeline 快照、不跳回需求录入；按钮立即「打包中…」；补源码级回归断言 | `4fe571422f`、`0f138bf31d`、`643d66d403` | HEAD `2d3ebe0` 已提交修复；`npm test` 含 `packaging keeps the pipeline snapshot…`；packfix 静态 18/18；`runPackDelivery()` 源码核对 | 前两条 **pass**；GUI 端到端点击 → **blocked（批次 20）** |
| 10 | 约束：不改七阶段/闸门语义、不引入依赖/字体/服务、不改数据结构、不自动截图、不扩 SSH 边界、不复制第三方代码 | —— | `git diff` 无 `package.json` 依赖改动、无 Host/数据迁移；新 iframe `sandbox=""`；无第三方文件/许可头 | **覆盖（无超范围）** |

**未覆盖 / 部分覆盖 / 超范围**

- **部分覆盖（环境限制，非缺陷）**：GUI 视觉与人工点击（#2/#3/#4/#5/#8 的 GUI 部分、#9 打包 e2e）——本会话无浏览器，QA 与复核均不伪造 pass，统一 blocked 交 Owner 批次 20。
- **文档缺口（P3）**：追加的打包热修需求只记录在 `.dsh/pipeline.json` 的 `requirementLog`（append，19:17 反馈）与验收清单 3 条中，`docs/pipeline/requirements.md` 未补该段（requirements.md 最后写入 19:14，早于 append）；不影响实现与验收，建议 release 前在 requirements.md §11 补一行溯源说明。
- **超范围改动：无**。`docs/PLAYBOOK.md`、`docs/opc/*`、插件 `README.md` 的改动均由 requirements §6.5「README/docs 旧口径同步」要求；归档与设计稿资产属阶段交付物。

---

## ③ 验收清单逐项核对（本轮新增 13 条 = 设计闸门批 10 条 + 打包热修 3 条）

> 说明：Lead 下达的「10 条」指 design-gate 批次；本轮窗口（19:15–19:42）另有 3 条打包热修验收项（`createdAt` 19:35），一并核对。**blocked 不写成 pass**；每项核对 title / requirement / status / note / evidence / history（history 为 pending→verdict 两条，`round: 0`；本轮 schema 无独立 `retestRound` 字段，复测轮次以 history/`checkedAt` 体现）。

### ③-1 设计闸门批次 10 条

| # | 验收项 | 状态 | evidence 核对 | 复核意见 |
|---|---|---|---|---|
| 1 | `8e375b5dff` 快速模式下 design 提交停 review，不自动通过 | **pass** | `.dsh/evidence/testing-v1.2.83.log`（存在，24.6 KB，含 gate-check 原文与 prompt/test 结果） | **认可**。独立复跑 `dev-design-gate-check.mjs`：`design autoApproved: undefined status: review note: 设计确认闸门…`；`npm test` 34/34 含同名用例；pipeline.js `fastApproval` 已排除 `PIPELINE_MANUAL_GATE_STAGES` |
| 2 | `2d2729bed2` design 未确认时 development 被拒，确认后可启动 | **pass** | 同上日志 | **认可**。复跑：`development blocked: bad-order | …必须等上一阶段「UI 设计」approved…设计阶段必须由 Owner…确认（approve）…`；approve 后 `active`；normal 全流程回归也覆盖 review/failed 两态 |
| 3 | `2f6c7001ee` 快速模式文案「四个自动 / 三个需确认」 | **pass** | `.dsh/tmp/qa-static-v1283.mjs`（脚本存在；note 引用 qa-static 日志存在） | **认可（静态断言逐条通过）**。复跑 qa-static 时该段落（PIPELINE_SECTION / zh-en fastHint / 三个工具描述 / 无 five-intermediate）**全部 ok**；P2 闭环后整脚本复跑 **`STATIC PASS (246 assertions)`**（④-1），聚合结论可复现 |
| 4 | `e6d0b2bb93` 设计截图缩略图 + 打开大图 | **blocked** | `docs/pipeline/design/design-gate-workbench-card-1440.png`（存在，2880×2048） | **认可 blocked**。证据是设计依据 mockup（note 已如实标注「待 Owner GUI 复测」），不是实现截图；DOM/属性由 fe-render-smoke + qa-static 覆盖。实际缩略图与大图 → 批次 20 |
| 5 | `0f33968c3e` HTML 内嵌预览 + 360/768/1280 + 源码次级 | **blocked** | `.../design-gate-preview-modal-1440.png`（存在） | **认可 blocked**。iframe/sandbox=''/title/lazy/三档/源码入口均静态+渲染断言覆盖；真实渲染效果与三档切换 → 批次 20 |
| 6 | `da409176e3` review 时两处待确认态 + 通过/打回/预览入口 | **blocked** | `.../design-gate-pipeline-review-1440.png`（存在） | **认可 blocked**。两处同一 i18n 键、`reviewPipelineStage` 复用、approved 后 banner 消失均由 fe-render-smoke 覆盖；实机呈现 → 批次 20 |
| 7 | `5c6cfc4eef` `.html/.htm` 默认预览 + 预览/源码切换 | **blocked** | `.../design-gate-html-file-preview-1440.png`（存在） | **认可 blocked**。代码核对：`modeOf` 含 html、`openFile` 默认 `view:'preview'`、源码可编辑保存、SSH 降级、空/错态退路；实机 → 批次 20 |
| 8 | `b75496c076` design 提示词要求截图、禁只交 HTML、warning 文案准确 | **pass** | `docs/pipeline/test-report.md`（Lead 20:10:08 补挂，存在） | **认可 pass**。代码核对：`STAGE_GUIDES.design` 含「至少一张可直接查看的截图」「不只交 HTML 源码」；warning `design-no-image` 文案含「缺少可直接查看的截图…HTML 只能预览，不能替代截图」；host-smoke 新增用例覆盖。原证据缺口（P3）已由 Lead 补挂，闭环 |
| 9 | `2c499c8a82` 版本文档同步 1.2.83 + 交付后根 +1 | **pass** | `CHANGELOG.md`（Lead 20:10:08 补挂，存在） | **认可 pass**：版本事实逐项独立实测通过（plugin/root 1.2.83、CHANGELOG `## 1.2.83`、批次 20、design §16、8 组设计稿非空、engineering-research 3 候选、README/AGENT_TEAM/PLAYBOOK/opc 口径、插件 README 旧 five-intermediate 已修）；根 +1 至 1.2.84 属 release，尚未发生。note 中「静态 246 断言」现已可复现（④-1 闭环）；证据已补挂 |
| 10 | `58e9af9d1b` 质量门全绿且既有功能不回归 | **blocked**（自动化部分全绿） | `docs/pipeline/test-report.md`（存在） | **认可 blocked**。独立复跑：check/check:json/npm test 34/34/fe-render-smoke 51/51/packfix 18/18/gate-check/`qa-static-v1283` **`STATIC PASS (246)`**/`git diff --check` 全绿（P2 已闭环）；人工 GUI 回归 → 批次 20 |

### ③-2 打包热修批次 3 条（HEAD `2d3ebe0`）

| # | 验收项 | 状态 | evidence 核对 | 复核意见 |
|---|---|---|---|---|
| 11 | `4fe571422f` 打包不再清空 pipeline 快照、不跳 intake | **pass** | 4 条：`qa-static.log`、`fix.diff`、`host-smoke.log`、`served-bundle.log`（全部存在） | **认可**。源码核对 `runPackDelivery()` 只 `setDeliveryBusy/setAcceptanceError/setDeliveryBundle`+`loadDeliveryHistory()`，**不再** touch `pipelineDoc/pipelineError/pipelineEditing/pipelineReviewNote`；`npm test` 含 `packaging keeps the pipeline snapshot…`；packfix 18/18 复跑通过 |
| 12 | `0f138bf31d` 打包中按钮「打包中…/Packing…」 | **pass** | `qa-static.log`、`fix.diff`（存在） | **认可**。`acceptance.packing` zh/en 成对；工作台验收卡与验收面板两处按钮在 `deliveryBusy` 时使用（grep 命中 2 处）；i18n parity 0 差异 |
| 13 | `643d66d403` GUI 实测打包链路 | **blocked** | `served-bundle.log`、`checks.log`（存在） | **认可 blocked**。note 如实记录 headless chromium 尝试失败与可复现步骤，未伪造 pass；实机点击 → 批次 20 |

### ③-3 统计（全清单 49 条）

**状态总计：26 pass / 0 fail / 23 blocked / 0 pending。** 本轮 13 条 = **7 pass / 0 fail / 6 blocked**；本轮之前 36 条 = 19 pass / 0 fail / 17 blocked（即「历史 18 条 blocked」= 17 条旧轮 GUI/视口项 + 1 条本轮热修 GUI e2e `643d66d403`，旧 blocked 不伪造 pass）。Lead 已于 20:10:08 为 #8/#9 补挂 evidence（状态未变），本轮 pass 项证据缺口归零。

| category | pass | fail | blocked | pending | 缺 evidence | 合计 |
|---|---:|---:|---:|---:|---:|---:|
| design-gate | 3 | 0 | 0 | 0 | 0 | 3 |
| design-preview | 0 | 0 | 3 | 0 | 0 | 3 |
| html-preview | 0 | 0 | 1 | 0 | 0 | 1 |
| model-discipline | 1 | 0 | 0 | 0 | 0 | 1 |
| version-docs | 1 | 0 | 0 | 0 | 0 | 1 |
| regression | 0 | 0 | 1 | 0 | 0 | 1 |
| e2e | 0 | 0 | 1 | 0 | 0 | 1 |
| workbench | 4 | 0 | 1 | 0 | 3 | 5 |
| workbench-layout | 4 | 0 | 2 | 0 | 0 | 6 |
| workbench-hero | 1 | 0 | 1 | 0 | 0 | 2 |
| workbench-visual | 1 | 0 | 1 | 0 | 0 | 2 |
| workbench-gui | 0 | 0 | 3 | 0 | 0 | 3 |
| workbench-responsive / workbench-a11y / workbench-regression | 0 | 0 | 1 / 1 / 1 | 0 | 0 | 3 |
| structure | 0 | 0 | 2 | 0 | 2 | 2 |
| visual | 0 | 0 | 3 | 0 | 3 | 3 |
| a11y | 0 | 0 | 1 | 0 | 1 | 1 |
| test | 1 | 0 | 0 | 0 | 1 | 1 |
| i18n | 1 | 0 | 0 | 0 | 0 | 1 |
| quality | 4 | 0 | 0 | 0 | 0 | 4 |
| release | 1 | 0 | 0 | 0 | 0 | 1 |
| workbench-team / -requirement / -acceptance / -delivery | 1 / 1 / 1 / 1 | 0 | 0 | 0 | 0 | 4 |
| **合计** | **26** | **0** | **23** | **0** | **10** | **49** |

**阻断项（blocked）清单（23 条，全部为需人工/GUI 的验证项）**：设计预览 4 条（`e6d0b2bb93`、`0f33968c3e`、`da409176e3`、`5c6cfc4eef`）+ 回归人工 1 条（`58e9af9d1b`）+ 打包 e2e 1 条（`643d66d403`）+ 历史 GUI/视口/布局 17 条（`structure` 2、`visual` 3、`a11y` 1、`workbench-gui` 3、`workbench-layout` 2、`workbench-hero` 1、`workbench-responsive` 1、`workbench-visual` 1、`workbench-a11y` 1、`workbench-regression` 1、`workbench` 1）。**无 fail、无伪造 pass。**

---

## ④ 复测记录（独立重跑，不沿用 QA 结论）

环境：Node v24.22.0 / npm 11.19.1 / Linux；时间 2026-10-27 20:07:51（首轮）/ 20:10–20:12（P2 闭环复验）（CST）；日志 `.dsh/evidence/acceptance-retest-v1.2.83.log`（全部原文、退出码、耗时，共 18 条命令）。基线 `2d3ebe0`，根/插件 1.2.83。

| # | 命令 | 退出码 | 耗时 | 输出末尾 / 关键结论 | 复核判定 |
|---|---|---|---|---:|---|---|
| 1 | `npm run check`（21 模块 `node --check`） | **0** | 552 ms | 无错误输出 | PASS |
| 2 | `npm run check:json` | **0** | 100 ms | `JSON OK` | PASS |
| 3 | `npm test`（`host-smoke.mjs`） | **0** | 632 ms | `PASS: 34/34 host smoke checks`（含 fast 四自动+design 闸门、manual gates、design-no-image、打包快照回归） | PASS |
| 4 | `node .dsh/tmp/qa-static-v1283.mjs` | **0**（P2 闭环后） | 246 ms | **`STATIC PASS (246 assertions)`**，1 observation（仅未引用死 key `workbench.designHtmlOnly`，P3）——首轮 exit 1 见 ④-1，**已闭环** | **PASS** |
| 5 | `node .dsh/tmp/qa-static-v1283-packfix.mjs` | **0** | 53 ms | `STATIC PASS: 18/18 checks`（含 runPackDelivery 不清快照、packing 文案、i18n parity） | PASS |
| 6 | `node .dsh/tmp/fe-render-smoke.mjs` | **0** | 177 ms | `51/51 checks passed`（D1–D4 真实 client.js VM 渲染；iframe sandbox 空、title、lazy；三档；approved/HTML-only） | PASS |
| 7 | `node .dsh/tmp/dev-design-gate-check.mjs` | **0** | 76 ms | `design autoApproved: undefined status: review`；`development blocked: bad-order … 上一阶段「UI 设计」…`；approve 后 `active`；warning 文案准确 | PASS |
| 8 | `node --check pipeline.js` / `node --check client.js` | **0 / 0** | 28 / 37 ms | 无输出 | PASS |
| 9 | `git diff --check` | **0** | 25 ms | 空输出 | PASS |

> P2 闭环复验另追加 8 条命令（20:10–20:12，原文见日志 §「P2 证据链闭环复验」；命令/退出码见 ④-1），全部 exit 0；首轮的失败项 4 已转为 PASS。

### ④-1 失败项已闭环（P2）：`qa-static-v1283` 白名单过期（Lead 20:09:58 修复，复核 20:10 复跑通过）

- **首轮事实（保留，不删除）**：20:07 复核首跑 `node .dsh/tmp/qa-static-v1283.mjs` 退出码 1；245 ok / 1 FAIL（其余断言覆盖 design-gate 闸门、bad-order 文案、模型纪律、设计卡/预览 CSS、i18n、安全、回归测试存在性等），唯一失败是脚本第 465–475 行「变更范围」白名单：`allowed()` 只允许 `client.js / pipeline.js / package.json / host-smoke / CHANGELOG / README.md / README.zh.md / docs/**`，**不含 `dsh-web-filebrowser-plugin/README.md`**；另有 1 条 observation：`workbench.designHtmlOnly` 未引用（与测试报告 O7 一致，P3 死 key）。
- **根因（时间线证据，均取自文件 mtime / 证据日志）**：
  1. 20:00:44 写 `qa-static-v1283.mjs`；20:01 QA 主日志；**20:03:03** `testing-v1.2.83-qa-static.log` 记录 `STATIC PASS (246 assertions)`（当时树里插件 README 尚未改，白名单成立）；
  2. **20:03:43** `dsh-web-filebrowser-plugin/README.md` 被修改——即测试报告 O6 指出的旧文案「five intermediate stages」→「four implementation stages + design 需 Owner 确认」（requirements §6.5 要求，属**合法修复**）；
  3. 20:04:10 testing 阶段 approved，20:04:14 acceptance 起算；QA 未在 README 修复后重跑 qa-static，故快照「STATIC PASS」与当前树不一致。
- **修复（Lead 执行，未改业务代码）**：**20:09:58** 在 `.dsh/tmp/qa-static-v1283.mjs` 的 `allowed()` 增加 `file === 'dsh-web-filebrowser-plugin/README.md'`（仅 QA 临时脚本；`.dsh/` 被 `.gitignore` 忽略，不随包发布、未进入 git）。
- **复核（本次复验，20:10）**：重跑 → **exit 0，246 ms，`STATIC PASS (246 assertions)`**，1 observation（仅 `workbench.designHtmlOnly` 未引用）；追加复跑 `npm test` **0**/650 ms/34/34、`fe-render-smoke` **0**/189 ms/51/51、`dev-design-gate-check` **0**/83 ms（行为正确）、`packfix` **0**/54 ms/18/18、`npm run check` **0**/554 ms、`check:json` **0**/101 ms、`git diff --check` **0**/30 ms（干净）；结果已追加至 `.dsh/evidence/acceptance-retest-v1.2.83.log`（现 880 行）。
- **定性（闭环后）**：原失败**不是** v1.2.83 产品缺陷，也不推翻 #1/#2/#3/#8 的 pass 结论（其实质断言始终通过）；它曾使 **测试报告 §3/§8「10 套全绿」与 ACCEPTANCE 批次 20 最后一条「qa-static-v1283 STATIC PASS 均 exit 0」在当前树不可复现**（DoD「测试报告可复现」）。**修复 + 复跑后该项已可复现，P2 关闭**；建议 release 备注记录「qa-static 白名单补入插件 README（O6 修复后）+ 复跑 PASS」。**不再需要为该项回退 testing。**
- **遗留观察（P3）**：`workbench.designHtmlOnly` 死 key（qa-static observation / 测试报告 O7）仍存在，建议后续清理，不阻断。

### ④-2 独立核验（不依赖 QA 脚本的交叉检查）

- 设计闸门：`pipeline.js` 的 `PIPELINE_MANUAL_GATE_STAGES = ['design','approval','release']`、`fastApproval = gateMode==='fast' && !PIPELINE_MANUAL_GATE_STAGES.includes(id)`、design 提交写 `review` + 「设计确认闸门」note、`startStage('development')` 在 design 非 approved 时抛 `bad-order` 并附设计确认提示——与 `dev-design-gate-check.mjs`（真实模块、非 mock）行为一致。
- 预览安全：D2 设计预览 iframe（`sandbox: ''`、`title`、`loading:'lazy'`）与 D4 `.html` 预览 iframe（`sandbox: ''`、`title`、`loading:'lazy'`）各一处；HTML tab 明确不提供「在浏览器打开」（`!isTextMode(tab.mode) && tab.mode !== 'html'`）；diff 未新增 `dangerouslySetInnerHTML` / `eval(` / `srcdoc` / `allow-scripts` 到设计预览块。
- i18n：`pipeline.fastHint` zh「product/development/testing/acceptance 提交后自动通过；design/approval/release 始终需要 Owner 确认」、en 对应；新增 33 key；packfix 的 zh/en parity 0 差异；旧「五个中间阶段 / five intermediate」在代码/README/AGENT_TEAM/PLAYBOOK/opc 均已清除（残留仅历史 CHANGELOG 1.2.72 条、归档文档与「不得再出现」的规则表述）。
- 版本：插件/根 1.2.83、CHANGELOG `## 1.2.83`、ACCEPTANCE 批次 20、design.md §16、归档 `v1.2.82-test-report.md` / `v1.2.79-requirements.md` 均实测存在；根 +1 至 1.2.84 留待 release。
- 文档链接：对 design/requirements/engineering-research/test-report/ACCEPTANCE/CHANGELOG/README 相对链接做解析，**73 条本地链接 0 失效**。

---

## ⑤ 变更与审阅

### ⑤-1 文件清单与关键 diff 结论

| 文件 | 变更 | 复核结论 |
|---|---|---|
| `dsh-web-filebrowser-plugin/pipeline.js` | +76/−21 | `PIPELINE_MANUAL_GATE_STAGES`；fast 排除 design；设计 review note；bad-order 设计提示；warning 文案按有无 HTML 分流（code 不变）；STAGE_GUIDES.design/development、buildStagePrompt 设计确认段、PIPELINE_SECTION/工具描述/工具返回文案同步。逻辑自洽，无新增依赖/数据结构 |
| `dsh-web-filebrowser-plugin/client.js` | +1424/−42 | D1 流水线设计卡（banner/缩略图/预览/通过/打回）、D2 预览弹层（role=dialog、Esc/背板、tabs、360/768/1280、iframe sandbox=''/title/lazy、源码次级、复用 reviewPipelineStage）、D3 工作台设计卡/hero 待确认、D4 `.html` 默认预览+预览/源码切换、33 个 zh/en key、CSS。未新增 `dangerouslySetInnerHTML`/`eval`/调试输出 |
| `scripts/selftest/host-smoke.mjs` | +58/−9 | 新增「fast 四自动 + design 闸门」「manual gate stages」「design-no-image 文案」用例；旧「五阶段」断言改为「四阶段 + design」；真实调用 pipeline 模块 |
| 文档 | `CHANGELOG` +36；`ACCEPTANCE` +19/−3（批次 20）；`requirements` §11；`design` §16（+347）；`engineering-research` +376/−72；`test-report` +154/−54；`README*`、`AGENT_TEAM`、`PLAYBOOK`、`opc/*`、插件 `README` 口径同步 | 与本轮需求一致；无旧口径残留（历史 CHANGELOG 除外，不应改） |
| 版本 | 插件 package.json 1.2.82→1.2.83 | 根 package.json 未改（1.2.83，release 再 +1） |
| 未跟踪新增 | 2 个归档 + 8 组设计稿（PNG@2× 2880×2048/780×1688 等 + 对应 SVG，全部非空）+ 生成脚本 | 均为阶段交付/设计资产，非临时垃圾；生成脚本纯 SVG 无外部依赖 |
| 临时/证据 | `.dsh/tmp/*`（qa-static/fe-render-smoke/gate-check 等）、`.dsh/evidence/*` | **未被 git 跟踪**（`.dsh/` 与 `*.log` 在 `.gitignore`）；`git ls-files .dsh` 为空；未被意外 `git add` |

### ⑤-2 审阅状态

- `.dsh/review.json`：acceptance 基线已捕获 36 文件，**`marks = 0` → 已审 0/36**，`comments = 0`；本轮 Owner 未在 Git 更改列表逐文件标记「已审」。
- 复核人已逐文件审阅 diff（含上述关键 diff），未发现调试残留、密钥、第三方侵权文件或超范围二进制。**「已审 0/36」按 Lead 指示如实记录为「人工确认前的已知条件」，不是阻断项**；建议 Owner 在 approval 关之前补标或显式接受。

### ⑤-3 调试 / 临时 / 密钥检查

- 对 `git diff` 新增行做 `console.log|console.debug|debugger|TODO|FIXME|password|token|secret|/tmp/` 扫描：**无代码调试残留**；仅文档中出现 `/tmp/fonts`（设计稿渲染环境说明，属历史说明）。
- 无新增 `.log/.orig/.rej/.bak/.tmp` 被跟踪；`.dsh/` 未跟踪；未发现密钥/凭据；`git diff --check` 干净。

---

## ⑥ DoD 检查（对照 `docs/opc/00-charter.md` §6；8 项，含本关自身）

| # | DoD 项 | 判定 | 说明 / 由哪一关补齐 |
|---|---|---|---|
| 1 | 验收清单：must 全 pass，无 fail/blocked | **有条件通过（未满足全绿）** | 49 条 = 26 pass / 0 fail / **23 blocked**；本轮 13 条 = 7 pass / 6 blocked。blocked 全为 GUI/人工验证（环境限制，不伪造 pass）→ **Owner 按 ACCEPTANCE 批次 20 复测**；实机发现缺陷则回退 development |
| 2 | 测试报告：覆盖正常/异常/边界，证据齐全且**可复现** | **通过** | 报告齐全（正常/异常/边界/回归/deviation 均有）；**P2 闭环后 10 套自动化可复现**：`qa-static-v1283` 复跑 `STATIC PASS (246 assertions)`、`npm test` 34/34、`fe-render-smoke` 51/51、`packfix` 18/18、gate-check、check/check:json、`git diff --check` 均 exit 0（④ 已记录） |
| 3 | 验收复核报告齐全，结论「建议放行」 | **通过** | 本报告（本次覆盖 v1.2.82 旧报告），结论见 ⑧ |
| 4 | 变更审阅：Git 变更逐文件「已审」，无未审改动 | **有条件通过** | 复核人已逐文件审阅 diff；`.dsh/review.json` **已审 0/36**（Owner 未标记）→ **Owner 在 approval 关补标或显式接受**；无超范围/调试/密钥 |
| 5 | 文档：需求/设计/实现/测试/验收复核/发布记录齐全 | **有条件通过** | requirements/design/engineering-research/test-report/ACCEPTANCE/CHANGELOG/README/AGENT_TEAM/PLAYBOOK/opc 已同步、链接 0 失效、v1.2.82 旧报告已归档；**P3 缺口**：追加的打包热修需求未写入 requirements.md（仅 pipeline requirementLog 与验收清单）；**发布记录 release.md 仍为 v1.2.82** → release 阶段重写 |
| 6 | 发布：approval 已人工确认，发布记录含环境/URL/版本/回滚 | **pending（本关不可判）** | approval/release 未开始；release 需写 release.md + `pipeline_record_release`，并确认根版本 +1 至 1.2.84；前置条件见 ⑧ |
| 7 | 交付：报告 + 证据 + 交付包 + 链接已交付客户 | **pending（release 后）** | 待 release 后打包交付（delivery bundle）与验收报告导出 |
| 8 | Owner 最终确认 | **pending（approval 关）** | 人工确认闸门属 Owner；本关仅建议。另见 ⑨ OBS-1：本轮 design 的「Owner 确认」发生在对话中，未落在新代码闸门上 |

**本关小结**：8 项中 **2 项通过**（本报告 + 测试报告）、3 项有条件通过（验收清单/变更审阅/文档）、3 项 pending（发布/交付/Owner 确认）。**本关无代码/功能阻断，无证据链阻断（P2 已闭环）。**

---

## ⑦ 专业质量复核（调研 / 设计质量 / 工程调研与许可证）

| 项 | 要求 | 实测证据 | 判定 |
|---|---|---|---|
| 需求调研 | ≥3 来源 + 借鉴决策表 | `requirements.md` §5：**6 个来源**（Figma / GitHub Docs / Storybook / MDN iframe / MDN sandbox / HITL）均 2026-10-27 访问、URL 齐全、决策表区分采用/不采用、已验证模式 vs 创新假设、无 blocked；来源结论与验收项 #1/#2 的强制闸门设计一致 | **通过** |
| 设计质量 | ≥2 来源、自检均分 ≥4、至少一轮迭代、状态/响应式/对比度/ARIA | `design.md` §16：**4 来源**（Figma / Storybook / GitHub / MDN sandbox）决策表；**八态矩阵**（8 态 × 9 行，含 N/A 理由）；响应式 360/768/1280/1024–1279；对比度计算表（正文 ≥4.5、非文本 ≥3）；ARIA/键盘/44px；**R1→R2→R3 三轮迭代记录**（含 r1 证据图）；自检五维 **4.8/5**、must 0 失败；8 组 PNG/SVG 设计稿实测非空（PNG 2880×2048@2× 等）；已知 deviation（1280 横向滚动、iframe 高度、无完整焦点陷阱、D3 无截图禁通过、404 检测有限）在 §16.13 明示并与实现一致 | **通过**（注：文档实际为「八态矩阵（9 行组件）」，与 MUST 清单一致；Lead 口径中的「九态」应按八态理解） |
| 工程调研与许可证 | ≥2 候选 + 许可证矩阵 + 来源 URL/commit；禁止 GPL/AGPL/无许可证复制 | `engineering-research.md`：**3 候选** = `microsoft/vscode`（MIT，commit `e809cab…`，release 1.143.1）、`storybookjs/storybook`（MIT，commit `04d17e4…`，v10.6.4）、`jupyterlab/jupyterlab`（BSD-3-Clause，commit `7dfda76…`，v4.6.4），含 §6 全量 URL+commit+访问日期（13 条来源）、§2.5 blocked 说明（无候选 blocked，raw.githubusercontent 受限已用 API 绕开）、§3 许可证矩阵（含 GPL/AGPL/无许可证禁止复制）、§7 不复制声明与风险登记册；实现侧 `git diff` **零依赖变更**、未引入第三方文件/许可头、设计预览 `sandbox=""` 比 JupyterLab 更严；结论「Build, don't borrow code」与代码一致 | **通过**（零依赖、零复制） |
| 安全 / 性能 / 可访问性 | — | 两个新 iframe 均 `sandbox=''`+`title`+`lazy`；HTML tab 禁止顶层打开；三档只改宽度不重拉；产物 ≤20；ARIA/44px/focus-visible/reduced-motion 静态断言通过；无新增请求/依赖 | **通过（静态/渲染层面）**；实机观感 → 批次 20 |

---

## ⑧ 放行建议

**建议：「建议放行（待 Owner 批次 20 复测 blocked 项）」；代码/功能阻断 0，原 P2 证据链阻断已闭环。**

- **阻断项（当前 0）**
  - 原 **[P2 · 证据链 · 1 项]** `qa-static-v1283` 白名单过期 → **已闭环**：Lead 20:09:58 在 QA 临时脚本 `allowed()` 补入 `dsh-web-filebrowser-plugin/README.md`（未改业务代码），复核 20:10 复跑 **`STATIC PASS (246 assertions)`** 并追加证据日志；测试报告「10 套全绿」与批次 20 末条已可复现。详见 ④-1。
- **待 Owner 复测（6 条 blocked，非阻断项）**：`e6d0b2bb93`、`0f33968c3e`、`da409176e3`、`5c6cfc4eef`、`58e9af9d1b`、`643d66d403` —— 需 Owner 按 `docs/ACCEPTANCE.md` **批次 20** 在重启 Harness（加载新 `pipeline.js` 闸门）+ 重建客户端 bundle + 强刷后复测；未复测前保持 blocked，不伪造 pass。
- **流程待办（非阻断）**：`.dsh/review.json` 已审 **0/36**，Owner 未逐文件标记；属人工确认前已知条件，建议 approval 关前补标或显式接受。
- **建议回退阶段**
  - P2 已闭环，**不需**为证据链回退 testing；
  - 若 Owner 批次 20 发现 design 闸门/预览/`.html` 预览/打包链路的真实功能缺陷 → **回退 development**（对应缺陷修复后重走 testing → acceptance）；
  - 不建议因 blocked 项本身回退（属环境限制）。
- **放行条件（建议写入 approval 关备注）**
  1. **Owner 批次 20 完成 6 条 blocked 复测并回填状态**（本报告建议放行的核心前提）；
  2. approval 关 Owner 人工确认；
  3. review marks 补标（已审 0/36）或显式接受；
  4. release 关根 `package.json` +1 至 **1.2.84**、重写 `docs/pipeline/release.md`（环境/URL/版本/回滚）、`pipeline_record_release` 落库、Git 提交**不含** `.dsh/tmp` 与 `.dsh/evidence`；
  5. （可选 P3）release 前补 requirements.md 的追加需求溯源。
- **版本与生效**：插件/根 1.2.83；生效需重启 Harness + 重建客户端 bundle + 强刷；无数据迁移；回滚可 revert 本轮交付提交（release 前基线 `2d3ebe0`）。

---

## ⑨ 观察与 P3（非阻断）

| # | 观察 | 处理建议 |
|---|---|---|
| OBS-1 | **本轮 design 的实际确认方式**：`.dsh/pipeline.json` 的 design 阶段 `note` 为「快速模式：Owner 预授权自动通过」，`submittedAt == reviewedAt`（19:42:17），`reviews: []` —— 说明本轮 design 是**旧 Host 代码的 fast 自动通过**，Owner 的确认发生在**对话中**（Lead 提供设计稿截图），新的 design 强制闸门代码**在本轮完成后才随 v1.2.83 生效**。 | 如实记录，不据此判 fail；批次 20 必须在重启后验证新闸门真实生效；release 说明需写「需重启 Host 才生效」 |
| OBS-2 | `qa-static-v1283` 白名单过期（④-1）：根因是 QA 定稿后为修 O6 改了插件 README，未重跑脚本。**已闭环**：Lead 20:09:58 补 allowlist（未改业务代码），复核 20:10 复跑 `STATIC PASS (246 assertions)`，证据日志已追加。 | 已关闭；建议后续 QA 脚本把「本轮允许的 README/docs 同步」显式列举，避免同类漂移 |
| OBS-3 | 6 条 blocked 全部需 Owner 批次 20；另历史 17 条 GUI blocked 长期未复测 | 建议批次 20 顺带扫一遍历史 blocked，避免清单长期悬挂 |
| OBS-4 | 追加的打包热修需求未写入 `requirements.md`（在 `pipeline.json` requirementLog 与验收清单中） | release 前在 requirements.md §11 补一行溯源（P3） |
| OBS-5 | **已闭环（原 P3）**：`b75496c076`/`2c499c8a82` 未挂 evidence 的问题已由 Lead 于 20:10:08 补挂（`docs/pipeline/test-report.md` / `CHANGELOG.md`），状态未变；剩余 10 条无 evidence 均为历史项（3 pass + 7 blocked） | 本轮 pass 项证据缺口归零；历史项可随批次 20 一并补/作废 |
| OBS-6 | `workbench.designHtmlOnly` 为未引用死 key（qa-static observation） | 后续清理，不阻断 |
| OBS-7 | 已知 deviation：1280 档容器内横向滚动、iframe 固定高度 640/560/480、无完整焦点陷阱、D3 无截图时禁用「通过」、iframe 404 检测有限 | 已在 design §16.13 明示并在 test-report O1–O5 记录；建议 Owner 在批次 20 目检确认可接受 |
| OBS-8 | 设计文档使用「八态矩阵（9 行组件）」，与 Lead 口径「九态」表述不同 | 以 design.md §16.6 与 MUST 清单为准（八态、N/A 写理由），非缺陷 |
| OBS-9 | dev summary 行数与实测有差（client.js +1461/−38 vs 实测 +1424/−42；docs 清单漏列 PLAYBOOK/opc） | 以实测为准（test-report O8 已记录），不影响验收 |
| OBS-10 | `docs/pipeline/release.md` 仍为 v1.2.82 | release 阶段重写（本关 N/A） |

---

## 附：证据索引

- 本关复测日志：`.dsh/evidence/acceptance-retest-v1.2.83.log`（880 行：环境/HEAD/版本 + 首轮复测 + P2 闭环复验，共 18 条命令原文+退出码+耗时）
- 本关复核报告：`docs/pipeline/acceptance-review.md`（本文件；P2 闭环后更新 ①/③/④/⑥/⑧/⑨）
- QA 证据：`.dsh/evidence/testing-v1.2.83.log`（24.6 KB）、`testing-v1.2.83-qa-static.log`、`testing-v1.2.83-normal-flow.log`
- 热修证据：`.dsh/evidence/pack-fix/{qa-static.log,fix.diff,host-smoke.log,served-bundle.log,checks.log}`
- QA 脚本：`.dsh/tmp/qa-static-v1283.mjs`、`qa-static-v1283-packfix.mjs`、`fe-render-smoke.mjs`、`dev-design-gate-check.mjs`（均不随包发布）
- 上游文档：`docs/pipeline/requirements.md`、`design.md` §16、`engineering-research.md`、`test-report.md`、`docs/ACCEPTANCE.md` 批次 20、`CHANGELOG.md` `## 1.2.83`
- 设计稿：`docs/pipeline/design/design-gate-*.png|svg`（8 组，PNG@2× 实测非空）
