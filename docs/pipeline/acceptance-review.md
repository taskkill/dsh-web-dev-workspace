# 验收复核报告（项目经理 Agent）— 第 8 轮 · v1.2.80 完成态与细节修正

- 轮次 / 阶段：第 8 轮 · acceptance（验收复核，双复核第一关）；`roundScope=development`（product/design 由变更范围跳过并记录 skip note，development/testing 已 approved）
- 复核时间：2026-10-27 16:40（Asia/Shanghai；复测 16:38–16:39，独立核查 16:39–16:40，报告定稿 16:40）
- 复核人：项目经理 Agent（角色 `opc-pm`；只读复核，未改代码/需求/设计/验收标准，未审批/未发布/未提交 Git）
- 基线：
  - 第 8 轮依据：Owner 对 v1.2.79 实机截图反馈（团队 chips 被压缩、完成态 hero 过期文案/重复状态、需求摘要「背景」前缀与重复变更行、blocked 计为待验收、空「交付物」小节、完成态体检误报、提交后变更卡 0/0、运行中顺序、纯黑进度条、Now 0 项提示）。
  - Git HEAD `2ada4a4`（v1.2.79 交付后版本 chore）；写本报告前工作区 **6 个已跟踪修改 + 3 个未跟踪归档**；`git diff --numstat` = **+274 / −161**；含本报告后 **7 个已跟踪修改**。
  - 版本：根 `package.json` **1.2.80**、插件 **1.2.80**；`CHANGELOG.md` 含 `## 1.2.80 — 2026-10-27`；`docs/ACCEPTANCE.md` 含**批次 17**；`design.md` 含 §13 修正表。
  - 验收清单：**28 条**（本轮新增 8 + 历史 20）= **13 pass / 0 fail / 0 pending / 15 blocked**。本轮 8 条 = **7 pass / 1 blocked**（唯一 blocked 为实机视觉复测，模型无浏览器/不能重启 Host）；历史 14 条 blocked 为 v1.2.79 及其前的纯 GUI/视觉/视口项。
  - 上轮 releases 7 条；本轮未发布。
- 结论：**建议放行（附条件）**——**代码/证据阻断项 0**；7 套自动化全绿、`qa-static-v1280` 143 断言 PASS；唯一 blocked 为实机视觉复测，Owner 按批次 17 确认即可，不伪造 pass。

---

## 1. 需求覆盖（round 8 · 10 项实机问题）

| # | 实机问题 | 对应实现 / 验收项 | 复核结果 | 证据 |
|---|---|---|---|---|
| 1 | 团队 6 角色 chips 压成 3 列窄块、名称剩 1 字 | `b5e5ce08c8` | **覆盖（静态）** | `.ds-wb-project-grid .ds-wb-assign-members { grid-template-columns: repeat(2, minmax(0,1fr)) }`；chip 34px/6–8 padding/11.5px 名称/9px pill |
| 2 | 完成态 hero 仍写「当前阶段」、重复「已完成」、门禁过期 | `cffed1c08e` | **覆盖（静态）** | `hero.eyebrowDone/allDoneTitle/allDoneSub/allDoneGate`；allStagesDone 时隐藏 status pill、隐藏复核链接、meta 去重 |
| 3 | 需求摘要「背景」前缀、与「第 N 轮变更」重复 | `b24094caad` | **覆盖（静态）** | `requirementSummaryText` 去除 section 前缀；`latestChange.title === requirementTitle` 时隐藏 changeLine |
| 4 | blocked 计为「待验收」、空「交付物」小节 | `ac193d54d9` | **覆盖（静态）** | `blockedCount` 独立 + blocked pill；零值 pill 不渲染；`latestDelivery/previewShare` 均空时隐藏交付物小节 |
| 5 | 完成态体检「建议先处理」误报 | `7f3ee03afb` | **覆盖（静态）** | `preflightWarnDone` + `data-kind=info`；完成态 tests/preview/delivery 缺失降级 `na`，文案「暂无记录/未分享/未打包」 |
| 6 | 提交后变更卡「已审 0/0」 | `7f3ee03afb` | **覆盖（静态）** | total=0 隐藏已审计数；`changesCommitted` 文案 |
| 7 | 运行中统计顺序 | `0dc4526cab` | **覆盖（静态）** | 运行中 → 最近一次（宽列）→ 最近结果 → 上次失败 |
| 8 | 进度条纯黑 | `0dc4526cab` | **覆盖（静态）** | 进度填充 `var(--wb-biz)`（`--dsw-alias-state-business-primary`） |
| 9 | 完成态 Now 区 0 项提示 | `0dc4526cab` | **覆盖（静态）** | `workbench.section.nowDone` + 隐藏重复空态行 |
| 10 | 项目状态卡重复「已完成」 | `0dc4526cab` | **覆盖（静态）** | 完成态隐藏 pill、caption `allPassed`、行 `doneLine` |

**未覆盖 / 超范围**：唯一 blocked 为 **实机 GUI 复测**（`1c1b66989d`，环境限制）；无超范围改动（无 Host/数据/依赖/新页面/新功能）。

## 2. 验收清单逐项核对（本轮新增 8 条）

| # | 验收项 | 状态 | 复核结论 |
|---|---|---|---|
| 1 | `b5e5ce08c8` 团队 chips 2 列可读 | pass（静态） | **认可**；实机可读性由 blocked GUI 项覆盖 |
| 2 | `cffed1c08e` 完成态 hero 文案/门禁/去重 | pass（静态） | **认可** |
| 3 | `b24094caad` 需求摘要去前缀/去重复行 | pass（静态） | **认可** |
| 4 | `ac193d54d9` blocked 独立计数/空交付物隐藏 | pass（静态） | **认可** |
| 5 | `7f3ee03afb` 完成态体检/变更卡文案 | pass（静态） | **认可** |
| 6 | `0dc4526cab` 运行中顺序/进度强调色/Now/状态卡 | pass（静态） | **认可** |
| 7 | `347a0da05d` 质量门/版本 1.2.80/批次 17 | pass | **认可** |
| 8 | `1c1b66989d` 实机 GUI 复测 | blocked | 环境限制；批次 17 由 Owner 复测 |

- **统计**：本轮 pass 7 / fail 0 / blocked 1；**合计 28 条 = 13 pass / 0 fail / 15 blocked**（历史 14 blocked 为 v1.2.79 及以前的 GUI/视口项）。
- **阻断项**：**0**（唯一 blocked 不涉及代码/证据缺陷；不把 blocked 伪造成 pass）。

## 3. 复测记录

环境：工作区 `/data/dsh/home/dsh-web-powerfilebrowser/dsh-web-filebrowser`；Node v24.22.0；Asia/Shanghai 2026-10-27 16:38–16:39。证据日志：`.dsh/evidence/acceptance-retest-v1.2.80.log`。

| # | 命令 | 退出码 | 耗时 | 结果 |
|---|---|---|---|---|
| 1 | `npm run check` | **0** | 571 ms | 21 个模块语法全过（含 client.js） |
| 2 | `npm run check:json` | **0** | 116 ms | JSON OK |
| 3 | `npm test` | **0** | 628 ms | **PASS: 31/31** |
| 4 | `node .dsh/tmp/team/pipeline-selftest.mjs` | **0** | 672 ms | **38/38** |
| 5 | `node .dsh/tmp/team/review-selftest.mjs` | **0** | 802 ms | **22/22** |
| 6 | `node .dsh/tmp/team/assignments-selftest.mjs` | **0** | 162 ms | **27/27** |
| 7 | `node .dsh/tmp/qa-static-v1280.mjs` | **0** | 144 ms | **STATIC PASS（143 断言）** |
| 8 | `git diff --check` | **0** | — | 干净 |

**独立核验（不照抄 QA）**：

- **团队 chips**：项目网格内 2 列规则存在，chip 内边距/字号/pill 调整；未改变 chip 的 `onClick`/指派抽屉行为。
- **完成态 hero**：`allStagesDone` 分支存在；`hero.eyebrowDone/allDoneTitle/allDoneSub/allDoneGate` 双语；`allStagesDone ? null : status-pill`；完成态不再渲染 `gateNote`/复核链接。
- **需求卡**：summary helper 去「背景/目标/范围…」前缀；相同标题 changeLine 隐藏；四操作/修订 disclosure 未改。
- **计数/空态**：`blockedCount` 独立；pending 只计 pending；empty 交付物条件；零值 pill 不渲染。
- **体检/变更卡**：`preflightWarnDone/info`、完成态 `na` 降级；`changesCommitted` + total>0 才显示已审；handler 未改。
- **运行中/视觉**：统计顺序、`--wb-biz` 进度色、Now `nowDone`、状态卡 `allPassed/doneLine`。
- **i18n**：新增 12 键 zh/en 各 1 定义 + 至少 1 引用；删除 1 个死键（`hero.remainingDone`）；`hero.currentStage`/`running.last` 仍无；**无未引用新键**。
- **安全/范围**：新增行无 console/debugger/innerHTML/TODO；`dependencies` 与 HEAD 一致；无 Host 模块改动；无新模型工具/路由；`git diff --check` 干净。
- **版本/文档**：根/插件 1.2.80；CHANGELOG 1.2.80；批次 17；design.md §13；archive 新增 3 个 v1.2.79 文档且相对链接 0 失效。
- **说明**：本轮为纯 UI 文本/空态/CSS 修正，模型无浏览器、不能重启 Host，故实机视觉项保持 blocked。

## 4. 变更与审阅

- **变更规模**（写本报告前）：6 个已跟踪修改 + 3 个未跟踪归档；`git diff --numstat` 合计 **+274 / −161**：
  - `dsh-web-filebrowser-plugin/client.js` **+120/−55**（10 项修正 + 12 键/删 1 键）；
  - `dsh-web-filebrowser-plugin/package.json` 1/1（1.2.79→1.2.80）；
  - `CHANGELOG.md` +29；`docs/ACCEPTANCE.md` +20/−2；`docs/pipeline/design.md` +21；`docs/pipeline/test-report.md` +83/−103（本轮重写）。
  - 未跟踪：`docs/pipeline/archive/v1.2.79-{test-report,acceptance-review,release}.md`（3 文档，链接已重算）。
- **已审数**：`.dsh/review.json` 的 acceptance 基线已捕获（9 条目）；`marks` = **0**（面板未标记）；PM Agent 已逐文件审阅 diff（本报告 §3）。
- **关键文件审阅结论**：client.js 只改渲染/文案/CSS，无 Host 写入、无新依赖、无调试/密钥；package.json 仅版本号；CHANGELOG/ACCEPTANCE/design 与实现一致；archive 链接 0 失效。
- **异常扫描**：无调试代码/密钥/临时文件/新依赖/超范围改动；`git diff --check` 干净。

## 5. DoD 检查（宪章 §6）

- [ ] **验收清单**：28 条 = 13 pass / 0 fail / 15 blocked（本轮唯一 blocked 为实机视觉；历史 14 条为 GUI/视口环境项）—— **有条件通过**（无代码/证据阻断；不伪造 GUI pass）。
- [x] **测试报告**：完整、7 套命令复跑全绿、143 静态断言、覆盖 10 项修复 —— **通过**。
- [x] **验收复核报告**：本报告（含覆盖/逐项/复测/变更/DoD/专业质量/放行建议）—— **通过**。
- [ ] **变更审阅**：逐文件审阅无异常；面板 marks 0/6（Owner 可补标）—— **有条件通过**。
- [x] **文档**：CHANGELOG/ACCEPTANCE/design/test-report/archive 同步；相对链接 0 失效 —— **通过**。
- [ ] **发布**：待 approval 后 release —— **本关不可判**。
- [ ] **交付**：待 release —— **本关不可判**。
- [ ] **Owner 最终确认**：approval 关 —— **本关不可判**，模型不审批。

**结论**：DoD 本关可判 5 项（2 项有条件通过：验收清单/变更审阅）；3 项留待 approval/release；**建议放行（附条件）**。

## 6. 专业质量复核（⑦）

| 复核项 | 结论 | 证据 / N/A 理由 |
|---|---|---|
| ① 需求调研与借鉴 | **N/A（本轮）** | 本轮为 Owner 实机截图驱动的纯 UI 修正，`roundScope=development`，product/design 按流水线跳过并记录 skip note；无新需求方向/新用户场景，无需重复调研。v1.2.79 的 6 来源与决策表仍在 `docs/pipeline/requirements.md`，未被改写。 |
| ② 设计质量 | **N/A（本轮）** | 不新增 token/布局/组件，只按 v1.2.79 设计系统修正完成态与空态；`design.md §13` 记录了 10 项修正前后关系与设计口径；未复制第三方设计素材。 |
| ③ 工程调研与许可证 | **N/A（本轮）** | 无新增第三方代码/依赖/字体/图标/CDN（`dependencies` 与 HEAD 一致）；沿用 `docs/pipeline/engineering-research.md`（v1.2.79，5 候选 + 许可证矩阵 + 安全/性能）；本轮 client.js 修正不涉及新许可证决策。 |
| 安全/性能复核 | **通过** | 新增行无 XSS/调试/密钥；纯 CSS/JSX；+120/−55 小改动、O(1) 计算、无新请求；无 Host/数据改动。 |

**专业质量阻断**：0（N/A 均写明理由，不是默认省略）。

## 7. 开放观察（均 P3，不阻断）

| # | 说明 | 处理 |
|---|---|---|
| OBS-1 | 本轮唯一 blocked 为实机视觉复测（模型无浏览器） | Owner 批次 17 复测回填 |
| OBS-2 | 完成态 Now 区仍保留区头，只改 hint 与空态 | 若 Owner 希望整区隐藏可再调 |
| OBS-3 | 历史 14 条 blocked 仍在清单（v1.2.79 及以前的 GUI/视口项） | 可按 Owner 决定在批次 17 一并复测/更新/作废 |
| OBS-4 | 面板「已审」0/6 | PM 已人工审阅 diff；Owner 可补标 |
| OBS-5 | 交付区第 5 卡全宽未改 | 属既定设计，一行 CSS 可回退 |

## 8. 放行建议

- **结论：建议放行（附条件）**。
- **阻断项：0**（无代码缺陷、无证据缺失、无超范围/许可证/安全问题）。
- **待 Owner 实机复测**：按 `docs/ACCEPTANCE.md` **批次 17** 核对团队卡 6 chips、完成态 hero、需求摘要、验收计数/空交付物、体检提示、变更卡提交态、运行中顺序、蓝色进度条、Now hint、浅/深主题与 360–1440；回填 `1c1b66989d`。若失败，**打回 development** 修复后重走 testing → acceptance。
- **建议回退阶段**：无（仅实机复测失败时回退 development）。
- **后续**：approval（Owner 人工确认）→ release（发布 v1.2.80，交付后根 +1 至 1.2.81）。
