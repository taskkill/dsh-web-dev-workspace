# 验收复核报告（项目经理 Agent）— 第 12 轮 · v1.2.84「验收台分区可收起：证据库/复测/交付默认折叠 + 全部收起 + 分组折叠」

- 轮次 / 阶段：第 12 轮 · **acceptance（双复核第一关）**；`gateMode=fast`、`round=12`；上游 product/design/development/testing 均为 **approved**（design 为 Owner 人工确认，见 ①）
- 复核时间：2026-10-27 22:11–22:2x（Asia/Shanghai，UTC 14:11–14:2x）；复核人：项目经理 Agent（**只读复核**：未改业务代码/需求/设计/测试报告/验收结论/`.dsh` 状态，未审批、未 commit、未发布、未改版本）
- 基线：Git HEAD **`1d85de4`**（`v1.2.85 仓库/包瘦身：移除生成位图与 npm 包内 node_modules`，已提交）；本轮交付提交属 release 阶段，**HEAD 尚未提交本轮改动**
- 工作树（复核时实测）：**11 个已跟踪修改 + 13 个未跟踪新增 = 24 个变更路径**（**写入本报告后为 25 个：12 已跟踪 + 13 未跟踪，+1 即本报告**）；`git diff --stat HEAD` = **11 files, +2346 / −976**（含测试报告自身 +287/−133；QA 报告「10 files +2059/−843」为排除其自身报告的口径，两套数字可对上）；**写入本报告并修复 OBS-1 后**为 **12 files，约 +2.5k/−1.2k**（本报告自身约 +200/−201、CHANGELOG 由 +34/−0 变 +33/−0；精确总数随本记录追加略有变化），见 ④-2
- 版本：插件 `dsh-web-filebrowser-plugin/package.json` = **1.2.84**；根 `package.json` = **1.2.86**（交付后 +1 的工作区规定已在工作树完成，待 release 提交）；`CHANGELOG.md` 顶部 `## 1.2.84 — 2026-10-27`；`docs/ACCEPTANCE.md` 批次 22（11 条复测项）
- 复核环境：Linux；Node **v24.22.0**；npm **11.19.1**；本机 DSH 3080 实际下发 v1.2.84 bundle；headless chromium 131（`FONTCONFIG_FILE=/tmp/fonts/fonts.conf`）
- 复核产物：本报告 `docs/pipeline/acceptance-review.md`（旧版原样归档 `docs/pipeline/archive/v1.2.83-acceptance-review.md`，md5 `56f2a744…` 与原文件一致）+ 复测日志 `.dsh/evidence/acceptance-retest-v1.2.84.log`（修复前 459 行：21 条命令/断言原文 + 退出码 + 耗时，另含 GUI 复跑 44 条逐条结果；**末尾追加 §7 P2 闭环复验段**，现约 520 行）
- 临时脚本（不随包发布、`git` 未跟踪）：`.dsh/tmp/review-v1284/{review-static.mjs, static-rerun.mjs, gui-rerun.mjs, dark-probe.mjs, linkcheck-review.mjs, run-retest.sh}`

> **结论先行：建议放行。** **代码 / 功能 / 证据链阻断 0**；本轮 10 条验收项 **pass 10 / fail 0**，evidence 18 条全部存在；质量门 3/3 全绿（`check` / `check:json` / `test 34/34`）；独立静态 55/56（唯一 FAIL 是 **CHANGELOG 重复的 `## 1.2.85` 标题行**——P2 文档缺陷，**不阻断验收**，但 **release 提交前必须删掉 1 行**）；独立 GUI 复跑 43/44（Q39 为 QA 脚本解析器对 `color(srgb …)` 的假阴性，已用独立探针证明深色对比 7.18–14.27 全部 ≥4.5:1，**非产品缺陷**）。blocked 23 条**全部为历史遗留**，本轮新增 blocked **0**。Owner 需按批次 22 复测**写操作**与实机观感后，在 approval 关人工确认。

---

## ① 基线与复核范围

| 项 | 实测值 |
|---|---|
| 工作区 | `/data/dsh/home/dsh-web-powerfilebrowser/dsh-web-filebrowser` |
| HEAD | `1d85de4`（v1.2.85 仓库/包瘦身）；HEAD 前一条 `8e03d0c` = v1.2.83 设计先确认 |
| 变更面 | 11 已跟踪修改 + 13 未跟踪新增 = 24（写入本报告后 25：12 已跟踪 + 13 未跟踪）；`+2346/−976`（未跟踪文件内容不计入 diff） |
| 已跟踪改动 | `CHANGELOG.md`、`README.md`、`README.zh.md`、`docs/ACCEPTANCE.md`、`docs/pipeline/{requirements,design,engineering-research,test-report}.md`、`dsh-web-filebrowser-plugin/{client.js,package.json}`、`package.json` |
| 未跟踪新增 | 归档 4 个 md（v1.2.83 requirements/engineering-research/test-report/acceptance-review）、设计稿 8 张 SVG、生成器 `gen-acceptance-collapse-mockups.mjs`（均为 docs 资产，无临时垃圾/位图回灌） |
| 验收清单（复核时） | **64 条 = 41 pass / 0 fail / 0 pending / 23 blocked**；36 个分类分组 |
| 本轮 10 条 | **全部 pass**；evidence **18 条全部存在且非空**（见 ③） |
| 审阅状态 | `.dsh/review.json`：`12:acceptance` 基线 14:11:12Z 捕获 **23 文件**；**marks = 0、comments = 0 → 已审 0/23**（Owner 尚未逐文件标记，属 approval 前已知条件，不是阻断） |
| 上游门禁 | product 13:14:57Z 起算 → design 提交 13:37:30Z → **Owner approve 13:38:32Z**（`reviews[].actor=owner, decision=approve`）→ development 13:38:33Z 启动 → testing 14:10:57Z 提交；**acceptance 14:11:12Z active** |
| 版本事实 | 插件 1.2.84 / 根 1.2.86；CHANGELOG `## 1.2.84`；ACCEPTANCE 批次 22（11 checkbox）；design §17（663 行）；test-report 331 行；engineering-research 535 行 |
| 上一轮归档 | v1.2.83 requirements / engineering-research / test-report / acceptance-review 均已归档（第四项为本关写入，md5 一致） |
| `docs/pipeline/release.md` | 仍为 **v1.2.83**（发布说明属 release 阶段，本关不写；见 ⑦ OBS-9） |

> 复核边界：本会话只读——不改 `client.js` / `package.json` / `CHANGELOG.md` / `docs/ACCEPTANCE.md` / `.dsh/acceptance.json` / `.dsh/pipeline.json` / 测试报告；GUI 复跑只写 localStorage 折叠偏好与只读选择/筛选（写操作未点）；复跑脚本的输出路径已重定向到 `.dsh/tmp/review-v1284/`，**未覆盖任何 QA 证据文件**。

---

## ② 需求覆盖表（对照 `.dsh/pipeline.json` 需求全文 + `docs/pipeline/requirements.md` §7/§8）

> 需求事实源：`.dsh/pipeline.json` requirement（8 条验收标准）+ `requirements.md` §3 范围 / §6 行为规格 / §7 10 条可追溯标准 / §8 10 条验收项。逐点映射到实现、测试与独立复核证据。

| # | 需求目标 / 验收标准 | 落库验收项 | 测试 / 独立复核证据 | 判定 |
|---|---|---|---|---|
| 1 | 证据库 / 复测中心 / 交付与预览分享默认收起，点头部展开/收起，头部有标题 + 摘要徽标 + 箭头，展开内容与现状一致 | `3f101fa562` | 静态 S1–S4/S29/S30（三块 `renderBlockHead`、button+aria、hidden、徽标 ≤2 与 96px）；GUI Q1–Q10（默认 44px 三收起、逐块展开、证据 40 项、复测无内层开关、交付 4 按钮）；截图 default/expand-evidence/expanded | **通过** |
| 2 | 折叠状态写 localStorage，刷新/重开保持；损坏/不可用回退默认且不崩溃；「全部收起/全部展开」作用于所有可折叠区块 | `757fe8a4eb`、`1e429dfa5d` | 静态 S15–S20（单键、默认值、16 KiB、整份回退、危险键、256 组、写失败吞异常）、S11–S13；GUI Q11–Q13（幂等两轮）、Q25–Q29（混合态 783 B 持久化、not-json 回退、坏形状回退、写失败降级） | **通过** |
| 3 | 清单默认展开并占满剩余高度；选中详情随选中展开、可收起、取消选中隐藏；分组可折叠且不影响勾选/批量/状态/筛选 | `c6f153e79e`、`7357e9e50b` | 静态 S5–S8/S18/S26（分组/详情 button+aria+hidden、48px、96px 保底）；GUI Q2（清单 492px）、Q5–Q6、Q14–Q22（36 组；折叠行不占位；四筛选 64→33/0/3→64；勾选/批量条只读） | **通过** |
| 4 | 折叠头为 button，aria-expanded/aria-controls 同步，Enter/Space 可切换、焦点可见、收起内容不参与 Tab（hidden） | `dc5f5d8476` | 静态 S2/S5/S7/S9/S27/S32（button、aria、2px focus-visible、`[hidden]{display:none}`、`verificationOpen` 已删）；GUI Q30–Q35（39 个头合法、Tab/Enter/Space、焦点保持、隐藏 body 跳过 Tab） | **通过** |
| 5 | 360px 与 691px 无横向滚动，长标题/徽标不撑破；浅/深主题分隔线与对比度正常（正文 ≥4.5:1） | `6a62bac296` | GUI Q36–Q40（345/260/691 均 `scrollWidth==clientWidth`；徽标 ellipsis）；**独立深色探针**（`.dsh/tmp/review-v1284/dark-probe.mjs`，支持 `color(srgb …)`）：block title 14.27 / badge 9.25 / group 9.90 / detail title 14.27 / selected row 7.18 / chevron 9.90，浅色 18.9/5.8/5.8 | **通过** |
| 6 | 中英文折叠文案齐全、无硬编码中文、缺失回退合理 | `760e12d0ab` | 静态 S21–S24（14 对 zh/en 成对非空；全量词典 parity 1265=1265；渲染段 40 669 字符 CJK 0；新增 zh 全中文 / en 无 CJK）；GUI Q41（lang=en 无中文残留） | **通过**（zh 运行时切换未实测，见 ⑦ OBS-6） |
| 7 | 回归：筛选/勾选/状态/证据/复测/打包/预览分享/导出不变；`check`/`check:json`/`test` 全绿 | `66b51b2f9b` | 质量门 3/3；diff 无 Host 模块（S43）、包 diff 仅 version 行（S44）、无依赖/数据文件（S42/S48）；GUI Q42（刷新/模板/四筛选/勾选/证据区/命令区/交付按钮只读冒烟）、Q43（4 个窗口段 **0 console error**）；QA 证据 `v1.2.84-qa-gui-results.json` 44/44 | **通过**（写操作未在真实数据执行 → Owner 批次 22） |
| 8 | 版本：插件 1.2.84、CHANGELOG 1.2.84、ACCEPTANCE 批次 22、文档同步；交付后根 +1 至 1.2.86 | `d365d11c1e` | 静态 S34–S40（插件 1.2.84 / 根 1.2.86 / CHANGELOG / 批次 22 / design §17 / 8 张 SVG 非空 / 归档 3 份 / pipeline.json design approved）；本地链接 135 条 0 死链 | **基本通过**（CHANGELOG 有 1 行重复标题，P2 待 release 前修正，见 ⑦ OBS-1） |
| 9 | 约束：只改 client.js + localStorage + i18n + 版本/文档；不动 Host API/数据结构/依赖/操作语义；不加第三方库 | —— | S42–S48 全过：11 个已跟踪文件全部在允许清单内；`acceptance.js/pipeline.js/ssh.js/index.js` 等 Host 模块 0 改动；两个 `package.json` 仅版本行；`.dsh/` 未被 git 跟踪（0 文件）；渲染段无 `fetch`/定时器/`innerHTML`/`eval`（S33）；engineering-research 4 候选、零依赖零复制 | **通过（无超范围）** |

**未覆盖 / 部分覆盖（均为环境或只读边界，非缺陷）**

- **写操作未实测**：状态修改、批量三操作、删除、备注保存、证据上传/删除、复测运行、打包/下载、预览分享创建/复制/打开/关闭、交付记录/包下载 —— QA 与复核均未在真实数据上执行（只读边界），列入 **Owner 批次 22 人工复测**；补偿为「相关 handler 未在 diff 中 + 质量门全绿 + 入口只读冒烟 + 0 console error」。
- **zh 运行时切换、真实无痕模式、实机缩放下视觉**：未实测（见 ⑦ OBS-6）。
- **历史 blocked 项**：23 条为旧轮 GUI/视觉项，不属于本轮范围，未复测（见 ⑦ OBS-5）。

---

## ③ 验收清单与证据链核对（本轮 10 条，只读 `.dsh/acceptance.json`）

**状态总计：64 条 = 41 pass / 0 fail / 0 pending / 23 blocked。** 本轮 10 条 = **pass 10 / fail 0 / blocked 0 / pending 0**；evidence 共 **18 条，逐条 `stat` 存在且非空（0 缺失）**。QA 于 22:10 前后把 10 条 pending 回填 pass（history 两条：pending 13:20:57Z → pass 14:10:41Z，`round: 0`，`by: agent`；note 写明了 QA 独立验证结论与证据路径，未伪造）。

| # | 验收项 id / 标题（简） | 状态 | evidence（条） | 文件核对 | 复核意见 |
|---|---|---|---|---|---|
| 1 | `3f101fa562` 三区块默认收起/区块头展开/徽标 | **pass** | 2 | `v1.2.84-qa-default.png`、`v1.2.84-qa-expand-evidence.png`（均存在） | **认可**。GUI 复跑 Q0–Q10 复现（默认三块 44px、aria=false、body hidden、徽标 40 evidence / No runs / No shares · none）；已抽检 default 截图（520×1904，三块收起头 + 清单为主） |
| 2 | `757fe8a4eb` localStorage 持久化 / 坏值回退 | **pass** | 2 | `v1.2.84-qa-persist-after-reload.png`、`v1.2.84-qa-bad-value-fallback.png` | **认可**。复跑 Q25–Q29 复现：混合态 783 B、36 组、坏值/坏形状整份回退、写失败降级、0 console error；静态 S15–S20 交叉核对 |
| 3 | `1e429dfa5d` 全部收起/全部展开（含分组与详情）且持久化 | **pass** | 2 | `v1.2.84-qa-all-collapsed.png`、`v1.2.84-qa-all-collapsed-selection.png` | **认可**。复跑 Q11–Q13/Q23–Q24：3 块 + 36 组全收起/全展开、两轮幂等、选中保留；静态 S11–S13 |
| 4 | `c6f153e79e` 清单默认展开 + 详情随选中展开/收起/取消 | **pass** | 2 | `v1.2.84-qa-detail.png`、`v1.2.84-qa-detail-collapsed.png` | **认可**。复跑 Q2/Q6/Q10/Q18–Q21；已抽检 detail 截图（48px 详情头 + 验收条件/备注/证据/历史）；静态 S8/S18/S26 |
| 5 | `7357e9e50b` 分组可折叠 + 数量徽标 + 不影响勾选/批量/状态/筛选 | **pass** | 1 | `v1.2.84-qa-group-collapsed.png` | **认可**。复跑 Q5/Q14–Q17/Q22：36 组、`aria-label="version-docs, 2 item(s)"`、组内行 64→62→64、隐藏组跳过 Tab、四筛选 64→33/0/3→64 |
| 6 | `dc5f5d8476` button + aria-expanded/aria-controls + Enter/Space | **pass** | 1 | `v1.2.84-qa-keyboard-focus.png` | **认可**。复跑 Q30–Q35：39 个折叠头全部 `button[type=button]`、id 唯一、Enter/Space 切换且焦点保持、2px focus-visible |
| 7 | `6a62bac296` 360/691 无横向溢出 + 浅/深主题可读 | **pass** | 3 | `v1.2.84-qa-narrow-260.png`、`v1.2.84-qa-wide-691.png`、`v1.2.84-qa-dark.png` | **认可**。复跑 Q36–Q40（345/260/691 均 344/344、259/259、690/690）；**独立深色探针** 6 处对比 7.18–14.27 全 ≥4.5:1（修复 QA 脚本解析器假阴性） |
| 8 | `760e12d0ab` i18n 成对/无硬编码/回退 | **pass** | 1 | `v1.2.84-qa-static.log` | **认可**。QA 静态日志可读；独立静态 S21–S24 复核 14 对、全量 parity、渲染段 0 CJK；独立复跑 QA 静态 20/20 |
| 9 | `66b51b2f9b` 既有操作无回归 + 质量门全绿 | **pass** | 3 | `v1.2.84-qa-quality-gates.log`、`docs/pipeline/test-report.md`、`.dsh/evidence/v1.2.84-qa-gui-results.json` | **认可（范围限制已注明）**。质量门 3/3 复跑一致；QA 44/44 结果 JSON 可读；写操作由 Owner 批次 22 补测 |
| 10 | `d365d11c1e` 版本/文档 1.2.84 + 根 1.2.86，只改允许文件 | **pass** | 1 | `docs/pipeline/test-report.md` | **认可**（版本事实独立实测通过）。**注意**：CHANGELOG 有重复 `## 1.2.85` 标题行（P2，见 ⑦ OBS-1），建议 release 前修正后本项仍成立 |

**本轮之前 54 条 = 31 pass / 23 blocked**（不重复核验内容，只核对 blocked 归属，见 ⑦）。

### ③-2 证据链缺口（分级）

- **本轮 10 条：0 缺口。** 18 条 evidence 全部存在；截图可读（本轮抽检 `v1.2.84-qa-default.png`、`v1.2.84-qa-detail.png` 与复跑失败截图共 3 张，内容与描述一致；QA `v1.2.84-qa-gui-results.json` 44 条 0 失败）。
- **历史遗留（非本轮、非阻断）**：全清单有 **10 条项无 evidence**（3 条历史 pass + 7 条历史 blocked，属 v1.2.79 以前记录），另有 **9 条历史 evidence 指向已删 PNG**（`workbench-v1279-*.png` 5 条、`design-gate-*.png` 4 条 —— 由 v1.2.85「移除生成位图」删掉，见 ⑦ OBS-4）。本轮不新增缺口，建议后续轮次清理/改指 SVG。

---

## ④ 测试与复测（独立重跑，不沿用 QA 结论）

> 全部原文、退出码、耗时见 `.dsh/evidence/acceptance-retest-v1.2.84.log`（修复前 459 行 + §7 P2 闭环复验追加段）；GUI 复跑脚本复制到 `.dsh/tmp/review-v1284/gui-rerun.mjs` 并把输出重定向到复核临时目录，**未覆盖 QA 证据**。

| # | 命令 / 复核动作 | 退出码 | 结果 | 判定 |
|---|---|---|---|---|
| 1 | `npm run check`（21 模块 `node --check`） | **0** | 523 ms，无错误 | PASS |
| 2 | `npm run check:json` | **0** | 98 ms，`JSON OK` | PASS |
| 3 | `npm test`（host smoke） | **0** | 669 ms，**`PASS: 34/34`** | PASS |
| 4 | `git diff --check` | **0** | 空输出 | PASS |
| 5 | `node .dsh/tmp/review-v1284/review-static.mjs`（**本复核人自写**，56 条断言：结构/ARIA/i18n/storage/CSS/版本/diff 范围/证据链） | **1** | **55/56 PASS**；唯一 FAIL = **S37 CHANGELOG 版本标题不唯一（重复 `1.2.85`）**；1 条 OBS（历史 evidence 缺 9 文件） | **命中真实文档缺陷**（见 ⑦ OBS-1），其余全过 |
| 6 | `node .dsh/tmp/review-v1284/static-rerun.mjs`（QA 静态脚本复跑，输出改指向复核临时目录） | **0** | **20/20 PASS**（含 S6 `verificationOpen` 已删、S8 14 对 i18n、S10 96/260/240/340、S14 storage 防护、S16 diff 范围） | PASS（QA 静态结论可复现） |
| 7 | GUI E2E 复跑 `FONTCONFIG_FILE=/tmp/fonts/fonts.conf node .dsh/tmp/review-v1284/gui-rerun.mjs`（headless chromium 131，1400×1000@2×，3080 实际 bundle） | **1** | **43/44**；唯一 FAIL = **Q39 脚本 `TypeError: Cannot read properties of null (reading 'r')`**（非断言失败）；15 张截图；Q43 = 4 个窗口段 0 console error | **脚本假阴性**，见 ④-1 |
| 8 | 独立深色对比探针 `.dsh/tmp/review-v1284/dark-probe.mjs`（支持 `rgb()` 与 `color(srgb …)`） | **0** | dark scheme 生效；block title **14.27**、badge **9.25**、group **9.90**、detail title **14.27**、selected row **7.18**、chevron **9.90**（全部 ≥4.5:1） | **PASS（产品达标）** |
| 9 | 文档本地链接检查（本轮 8 份文档） | **0** | 178 链接、**135 条本地链接 0 死链** | PASS |
| 10 | 归档一致性 `md5sum` | **0** | `docs/pipeline/archive/v1.2.83-acceptance-review.md` = `56f2a744f5c9b0663bfa7bb4701c5b83`，与旧报告一致 | PASS |
| 11 | 证据链 / blocked / 版本事实脚本（见日志 §4–§5） | **0** | 10 条 pass + 18 evidence 存在；blocked 23 条最新 `updatedAt` 早于本轮起算；重复标题 1 个；批次 22 checkbox 11 条 | PASS（缺陷已记录） |

### ④-1 GUI 复跑 Q39 失败根因（脚本假阴性，不是产品缺陷）

- **现象**：Q39（深色主题对比度）在 `blend()` 抛 `TypeError`，`parse()` 返回 `null` —— QA 解析器只匹配 `rgb()/rgba()`，而 **选中行是 pass 项**时标题颜色来自 `color-mix(...)`，Chromium 计算值为 `color(srgb 0.512745 0.866078 0.645686)`，正则不匹配 → 返回 null → `blend(null, bg)` 崩溃。
- **数据顺序原因**：QA 原跑（22:07 CST / 14:07Z）时 10 条本轮验收项尚为 **pending**，第一行可见项是 pending（标题用普通变量颜色 → 可解析）→ 44/44；QA 在 22:10 把 10 条回填 pass 后，第一行选中项变 pass（`color-mix` 序列化）→ 同一脚本在**当前树**上复跑必然在 Q39 崩溃。**脚本对数据状态敏感，与产品无关**。
- **独立验证**：复核人另写 `dark-probe.mjs`（解析 `rgb()` + `color(srgb …)`），同一深色态下 6 处对比度 7.18–14.27 全部 ≥4.5:1，与 QA 原报告数值（7.35/9.25/17.45 等）同量级、结论一致。**Q39 的产品主张成立。**
- **处理**：不推翻本轮 #7 pass；建议 QA 后续把对比度解析器改为支持 `color(srgb …)`（或固定选 pending 行），避免数据回填后脚本假阴性（P3）。

### ④-2 P2 闭环复验（Lead 修复 CHANGELOG 重复标题行后，只读复验；2026-10-27 22:19 CST / 14:19Z）

- **修复内容**（Lead 执行；本复核人只读复验，未改该行）：删除 `CHANGELOG.md` 中重复的 `## 1.2.85 — 2026-10-27` 之一。现该标题**仅出现 1 次（第 38 行）**；`## 1.2.84` 条目完整（第 5–36 行）、1.2.85 正文未动；版本标题序列 = 1.2.84 / 1.2.85 / 1.2.83 / …，**无重复**。
- **复验命令与结果**（2026-10-27 22:19 CST / 14:19Z，均实测）：
  - `node .dsh/tmp/review-v1284/review-static.mjs` → **exit 0，56/56 PASS**：原唯一 FAIL **S37「CHANGELOG 版本标题唯一」已转 PASS**，其余 55 条断言不变（1 条历史 evidence OBS 仍为非阻断）；
  - `npm run check` → **exit 0**（21 模块，560 ms）；`npm run check:json` → **exit 0**（`JSON OK`，115 ms）；`npm test` → **exit 0**（`PASS: 34/34`，652 ms）；
  - `git diff --check` → **exit 0**（干净）；本地链接复检 135 条 **0 死链**；
  - `CHANGELOG.md` 现 diff = **+33/−0**（修复前 +34/−0，差额 1 行即被删的重复标题行）。
- **结论：P2 闭环，无需再修；放行建议不变（阻断 0，建议放行）**。⑧ 放行条件第 4 项（release 前删除重复行）已满足。本记录覆盖前文 OBS-1 的「待修」表述；①/⑤/⑦ 中 OBS-1 的原始记录保留为修复前时点审计。

---

## ⑤ Git 变更与已审

### ⑤-1 文件清单与逐文件复核结论（11 已跟踪 + 13 未跟踪；本报告写入后为 12 已跟踪）

| 文件 | 变更 | 复核结论 |
|---|---|---|
| `dsh-web-filebrowser-plugin/client.js` | **+669 / −394** | ① `renderBlockHead()` 单一全宽 button（44px、aria-expanded/aria-controls、chevron）；② evidence/verify/delivery 三块体 `hidden` 保留挂载 + 面板内滚动（260/240/340）+ 清单 `min-height:96`；③ 分组头 button + 数量徽标 + 分类原值 key；④ 详情 48px 折叠头 + 收起提示 + 选中保留；⑤ 工具区单按钮动态 Collapse/Expand all（含分组+详情，不取消选中）；⑥ 删除 `verificationOpen` 与内层开关，预选命令逻辑移入区块切换；⑦ localStorage 单键 + 16 KiB + 危险键过滤 + 整份回退 + 写失败静默；⑧ 14 对 zh/en key；⑨ D8 对比度 CSS。未新增 `eval/innerHTML/fetch/定时器`；未改任何既有 handler 语义 |
| `dsh-web-filebrowser-plugin/package.json` | +1 / −1 | 1.2.83 → **1.2.84**，仅 version 行 |
| `package.json` | +1 / −1 | 1.2.85 → **1.2.86**，仅 version 行；无依赖变化 |
| `CHANGELOG.md` | +33 / −0（P2 修复后；原 +34/−0 见 ④-2） | 1.2.84 条目内容与实现一致（44px/徽标/单键持久化/96px/260·240·340/14 key/对比度）；**第 39 行曾多出一行重复 `## 1.2.85 — 2026-10-27`（P2，已修复，见 ④-2 / ⑦ OBS-1）** |
| `docs/ACCEPTANCE.md` | +19 / −1 | 批次 22（11 条复测项）；含 v1.2.84 已知限制段 |
| `docs/pipeline/requirements.md` | +253 / −171 | 第 12 轮需求重写（旧轮已归档）；§7 10 条标准、§8 10 条验收项、§5 7 来源 + 13 条借鉴决策 |
| `docs/pipeline/design.md` | +664 / −0 | 追加 §17（663 行，不改旧章节）：6 来源、D1–D8、八态矩阵、360/691/768/1280、a11y 契约、14 对 i18n、自检 4.8/5、R1 迭代证据 |
| `docs/pipeline/engineering-research.md` | +416 / −275 | 4 候选（W3C APG / GOV.UK / Radix / Headless UI）、许可证矩阵（3×MIT+W3C）、OSV/GHSA/npm 0 CVE、build-vs-borrow 决策、安全/性能/a11y 契约、不复制声明 |
| `docs/pipeline/test-report.md` | +287 / −133 | 第 12 轮报告（331 行）：质量门 3/3、静态 20/20、GUI 44/44、10 条 pass、4 条脚本修正如实记录、3 条观察项、7 条残余风险 |
| `README.md` / `README.zh.md` | 各 +1 | 各新增一句 v1.2.84 亮点，口径与实现一致 |
| **本报告** `docs/pipeline/acceptance-review.md` | 覆盖旧版（旧版已归档） | 本次复核唯一写入的已跟踪文件；不进入业务代码/数据 |
| 未跟踪（13） | — | 4 份归档 md（v1.2.83 requirements/engineering-research/test-report/acceptance-review，后两者本次复核写入）、8 张 `acceptance-collapse-*.svg`（均 >1 KB，可打开）、1 个纯 SVG 生成器脚本（无外部依赖） |

### ⑤-2 范围 / 依赖 / 数据 / 安全核对（独立静态断言）

- **无 Host 模块改动**：`acceptance.js / pipeline.js / ssh.js / index.js / tasks.js / delivery.js / preview.js / assignments.js / review.js / memory.js / …` **均不在 diff**（S43）；`git diff` 中无 `.js` Host 文件。
- **无依赖变化**：两个 `package.json` 的 diff **只有 4 行 version**（S44）；无 `package-lock`/`vendor/`/构建脚本变化。
- **无数据文件改动**：`git ls-files .dsh` = **0**（`.dsh/` 被 gitignore）；`.dsh/tmp`、`.dsh/evidence` 未被跟踪，不会进入提交（release 需复核）。
- **无临时/调试/密钥残留**：新增行无 `console.log/debugger/TODO/FIXME`（S50）；无 `.log/.orig/.bak` 被跟踪；未新增二进制（本轮设计稿全为 SVG 文本）。
- **渲染安全**：验收台渲染切片无 `fetch`/定时器/动态 import/`innerHTML`/`dangerouslySetInnerHTML`/`eval`（S33）；分组 body id 用索引不拼分类名（S6）；徽标文本走 React 文本节点 + `title`。

### ⑤-3 审阅状态

- `.dsh/review.json`：`12:acceptance` 基线 14:11:12Z 捕获 **23 文件**（11 已跟踪 + 12 未跟踪）；**marks = 0、comments = 0 → 已审 0/23**。
- 复核人已逐文件审阅上述 diff（含 `client.js` 全量 diff 1 317 行、文档 diff、未跟踪资产）；未发现超范围/调试/密钥/侵权文件。**「已审 0/23」按惯例如实记录为 approval 前已知条件，不是阻断项**；建议 Owner 在 approval 关补标或显式接受。

---

## ⑥ DoD 检查（对照 `docs/opc/00-charter.md` §6；8 项）

| # | DoD 项 | 判定 | 说明 |
|---|---|---|---|
| 1 | 验收清单：must 全 pass，无 fail/blocked | **通过（本轮范围）** | 本轮 10/10 pass；全清单 41 pass / 0 fail / 0 pending / **23 blocked（历史遗留，0 新增）**；blocked 全为旧轮 GUI/视觉项，需 Owner 批次复测（见 ⑦） |
| 2 | 测试报告：覆盖正常/异常/边界，证据齐全且**可复现** | **通过** | 3 套质量门独立复跑全绿；QA 静态 20/20 可复现；GUI 43/44（唯一失败为 QA 脚本对 `color(srgb)` 的解析假阴性，产品由独立探针证明达标）；报告自述 44/44 与复跑差异已如实记录（④-1） |
| 3 | 验收复核报告齐全，结论「建议放行」 | **通过** | 本报告；旧报告已归档且字节一致 |
| 4 | 变更审阅：Git 变更逐文件「已审」，无未审改动 | **有条件通过** | 复核人逐文件审阅；`.dsh/review.json` **已审 0/23**（Owner 未标记）→ approval 关补标或显式接受；无超范围/调试/密钥 |
| 5 | 文档：需求/设计/实现/测试/复核/发布记录齐全 | **有条件通过** | requirements §7/§8、design §17、engineering-research、test-report、ACCEPTANCE 批次 22、CHANGELOG 1.2.84、README 已同步；链接 0 死链；归档齐全。**缺口：CHANGELOG 重复标题行（P2）+ release.md 仍为 v1.2.83（属 release 阶段重写）** |
| 6 | 发布：approval 已人工确认，发布记录含环境/URL/版本/回滚 | **pending（本关不可判）** | approval/release 未开始；release 需重写 release.md、`pipeline_record_release`、确认根版本 1.2.86 随提交落地 |
| 7 | 交付：报告 + 证据 + 交付包 + 链接已交付客户 | **pending（release 后）** | 待 release 打包/交付与报告导出 |
| 8 | Owner 最终确认 | **pending（approval 关）** | 本关仅建议；Owner 按批次 22 复测后在面板确认 |

### ⑥-1 需求 8 条验收标准逐条对照（`.dsh/pipeline.json` requirement）

| 标准 | 实现证据 | 测试 / 复核证据 | 判定 |
|---|---|---|---|
| 1) 三区块可点击折叠/展开，头部有摘要与数量徽标，展开内容与现状一致 | `client.js` `renderBlockHead` / 三块体 / `renderBlockBadges`（≤2、+n、96px） | S1–S4/S29/S30；GUI Q1–Q10 | **通过** |
| 2) 折叠状态写 localStorage 刷新保持；全部收起/展开一次作用全部可折叠区块 | 单键 `dsh-web-filebrowser:acceptance-collapse` + `toggleAllAcceptanceBlocks` | S11–S20；GUI Q11–Q13/Q25–Q29 | **通过** |
| 3) 清单默认展开随面板伸缩；选中详情展开/取消隐藏；分组可折叠不影响勾选/状态 | `.ds-acc-list{min-height:96}`、详情头、分组头 + 原 handler 未改 | S5–S8/S18/S26；GUI Q2/Q6/Q10/Q14–Q22 | **通过** |
| 4) 键盘可达：Tab/Enter/Space、aria 同步、收起内容不进 Tab | 三个头 button + `[hidden]{display:none}` + focus-visible | S2/S5/S7/S9/S27/S32；GUI Q30–Q35 | **通过** |
| 5) 360/691 无横向滚动、长标题/徽标不撑破、浅/深主题 ≥4.5:1 | ellipsis max-width 96/62%、D8 color-mix 文字色 | Q36–Q40；独立深色探针 7.18–14.27 | **通过** |
| 6) i18n 中英齐全、无硬编码中文、缺失回退合理 | 14 对 key、渲染段 0 CJK、`t()` 既有回退 | S21–S24；GUI Q41 | **通过**（zh 运行时未实测） |
| 7) 回归不变 + 质量门全绿 | handler 未改、diff 无 Host/依赖 | 3 套门 + S42–S48 + Q42/Q43；写操作待 Owner | **通过（范围限制）** |
| 8) 版本/文档同步，交付后根 1.2.86，只改允许文件 | plugin 1.2.84 / root 1.2.86 / CHANGELOG / 批次 22 / 11 文件全允许 | S34–S49；链接 0 死链；**CHANGELOG 重复标题需修** | **基本通过（1 处 P2 文档待修）** |

---

## ⑦ 风险、blocked 与观察项

### ⑦-1 阻断项

- **代码 / 功能 / 证据链阻断：0。** 本轮 10/10 pass、evidence 0 缺失、质量门全绿、无 Host/依赖/数据改动、无回归迹象。
- **非阻断、release 前待修（P2，1 项，已闭环）**：见 OBS-1（CHANGELOG 重复标题行）。不构成回退 development 的理由，但不建议带病提交/发布。**该行已由 Lead 于 22:1x CST 修复，22:19 CST 复验 PASS，见 ④-2；release 前已无待修项。**

### ⑦-2 blocked 项（23 条，全部历史遗留，本轮新增 0）

统计：**23 条 blocked**，最新 `updatedAt` = 2026-10-27T12:03:59Z（**早于本轮起算 13:14:55Z**），本轮新增 **0**。归属（按验收项 category）：

- **第 11 轮（v1.2.83）6 条**：设计预览 3（`e6d0b2bb93`/`0f33968c3e`/`da409176e3`）+ HTML 文件预览 1（`5c6cfc4eef`）+ 回归人工 1（`58e9af9d1b`）+ 打包 e2e 1（`643d66d403`）。
- **旧轮（≤10）17 条**：workbench 结构/hero/布局/视觉/响应式/a11y/回归/实机 GUI 等（`b4d6cd2e33`、`dc651f1f45`、`60c8493783`、`1902af2ad1`、`47d54ee97e`、`61289ca00a`、`4939bdcb62`、`f2276bbaad`、`d2e803c08e`、`1db92733b0`、`34b966a4a8`、`cda93230ed`、`b6ebf8148d`、`60d7d3a430`、`1c1b66989d`、`9b18175f4d`、`21b6ebc49e`）。
- 结论：**blocked 未清是历史清单悬挂，不是第 12 轮缺陷**；本轮 10 条均为 pass，未新增 blocked。建议 Owner 借批次 22 顺带扫一遍历史 blocked（可选，非本轮放行条件）。

### ⑦-3 观察项（非阻断，按严重度排序）

| # | 级别 | 观察 | 建议 |
|---|---|---|---|
| OBS-1 | **P2 文档（已闭环，见 ④-2）** | `CHANGELOG.md` 第 38–39 行连续两行 `## 1.2.85 — 2026-10-27`（第 39 行为本轮新增的重复行；HEAD 版本只有一行）。内容本身正确（1.2.84 条目完整），但重复标题破坏版本章节唯一性 | **release 提交前删除多余的一行**（1 行改动）；修掉后本轮 #10 pass 与 DoD#5 完整成立。不建议因此回退 development |
| OBS-2 | **P3 设计偏差** | 设计 §17.8 与 §17.3 D6 声明「面板宽 < 420px 时降为 1 个徽标 + `+n`」，实现未加该窄面板规则：始终最多 2 枚徽标（CSS `.ds-acc-block-badges{max-width:62%}` + 单枚 96px ellipsis 兜底）。260/345/360 下无横向溢出（已验证），仅「第二枚徽标显示方式」与设计稿不同 | 本轮不阻断（需求未要求 1 vs 2；无溢出）；建议在 design §17.8 标注「本期实现为 CSS 省略兜底，窄面板 1+`+n` 规则留作后续」或下一轮补齐 container query |
| OBS-3 | **P3 测试脚本** | QA GUI 脚本 Q39 的 `parse()` 只支持 `rgb()/rgba()`，当前数据（10 条回填 pass）下选中行标题为 `color(srgb …)` → 复跑 43/44 崩溃；QA 原跑 44/44 因当时选中行为 pending。**属脚本假阴性** | 建议 QA 脚本支持 `color(srgb …)` 并固定选择 pending/blocked 行；本轮以独立探针复核产品达标 |
| OBS-4 | **P3 历史证据** | 全清单 **9 条历史 evidence 指向被 v1.2.85 删除的 PNG**（`workbench-v1279-*.png` ×5、`design-gate-*.png` ×4）+ **10 条历史项无 evidence**；均为旧轮记录，本轮 10 条不受影响 | 后续轮次把历史 evidence 改指 SVG 或补挂/作废，避免清单长期悬挂 |
| OBS-5 | P3 历史 blocked | 23 条 blocked 长期未复测（v1.2.79–v1.2.83 的 GUI/视觉项） | 建议 Owner 批次 22 顺带复测回填；非本轮放行条件 |
| OBS-6 | P3 未覆盖 | QA/复核均未实测 **zh 运行时切换**（当前 GUI locale=en）与**真实无痕模式**；写操作未在真实数据执行 | Owner 批次 22 复测清单已列；`t()` 机制未改动 + 14 对 key 静态成对，风险低 |
| OBS-7 | P3 已知口径 | 证据库徽标 = 客户端 `loadEvidence()` 最近 40 条直接条目（含子目录名，上限 40），与 Host `listEvidenceFiles`（仅普通文件）口径不同；当前显示恒为 `40 evidence` | 已由 QA O2 记录，属既有证据列表实现；建议后续单独立项统一口径 |
| OBS-8 | P3 bookkeeping | QA 报告 §2 用「10 files +2059/−843」（排除其自身报告）与当前 `git diff` 的「11 files +2346/−976」看似不一致，**差额恰为 test-report 自身 +287/−133，可对上**；QA §2 表内 requirements「+424/−?」、engineering-research「+691/−?」是 `--stat` 的「变更行数」而非 add/del，属表述口径差异 | 以实测 `git diff --numstat` 为准；不影响验收 |
| OBS-9 | P3 阶段产物 | `docs/pipeline/release.md` 仍为 v1.2.83（上一轮发布说明） | release 阶段重写（环境/URL/版本/回滚/SHA256），本关 N/A |
| OBS-10 | P3 文档基线引用 | requirements §1 审计行号与 design §17.3 的 `verificationOpen 约 8533` 等行号是**改动前基线**，当前树已漂移（该变量已删） | 属设计/需求文档写作时点引用，非错误；后续文档变更宜注明基线 commit |

---

## ⑧ 放行建议

**建议：「建议放行」**（双复核第一关通过；最终由 Owner 在 approval 关人工确认）。

- **阻断项：0**（无代码/功能/证据链阻断）。
  - 唯一需处理的是 **P2 文档缺陷 OBS-1**：`CHANGELOG.md` 多一行 `## 1.2.85`；**建议 Lead/运维在 release 提交前删除 1 行**，不因此回退 development。**（已于 2026-10-27 22:19 CST 修复并复验通过，见 ④-2）**
- **blocked：23 条，全部历史遗留（第 11 轮 6 + 旧轮 17），本轮新增 0**；本轮 10 条全部 pass。blocked 不视为本轮 fail，也不伪造 pass。
- **质量门**：`npm run check` / `npm run check:json` / `npm test` **3/3 exit 0（34/34）**；独立静态 55/56（唯一 FAIL 为 OBS-1）；QA 静态复跑 20/20；GUI 复跑 43/44（Q39 脚本假阴性，产品由独立探针证明 7.18–14.27 全 ≥4.5:1）；`git diff --check` 干净；本地链接 0 死链。
- **证据链缺口**：本轮 **0**（10 条 × 18 evidence 全部存在）；历史遗留 9 条失效 PNG + 10 条无 evidence（OBS-4，非本轮）。
- **Owner 批次 22 需人工复测的写操作 / 实机清单**（`docs/ACCEPTANCE.md` 批次 22 的 11 条中，自动化无法覆盖的部分）：
  1. **状态与批量**：单项四状态按钮、批量通过/不通过/重置、删除、备注保存（会写 `.dsh/acceptance.json`）；
  2. **证据**：上传（截图/PDF/日志）与删除、缩略图打开；
  3. **复测**：运行复测、发送失败给 agent、重新检测命令；
  4. **交付**：打包交付（zip）、下载构建产物、发送失败清单、导出验收报告（会写 `.dsh/deliveries.json` / 产生交付物）；
  5. **预览分享**：创建/复制/打开/关闭分享链接、交付记录下载、交付包下载（占用端口）；
  6. **全局冒烟**：工作台/流水线/任务/待办/文件树/SSH/Git/预览分享面板；
  7. **界面观感**：实机浅/深主题、**中文界面运行时切换**、真实无痕模式、260–691px 侧栏拖动、缩放；
  8. （可选）顺带复测 23 条历史 blocked（OBS-5）。
  - 复测前：**重建客户端 bundle + 强刷**（本轮 Host 无改动，无需重启 Harness；v1.2.84 是纯客户端）。设计基线：`docs/pipeline/design/acceptance-collapse-*.svg`。
- **建议回退阶段**：**无需回退**。若 Owner 批次 22 发现折叠/持久化/键盘/窄栏的真实功能缺陷 → 回退 **development**（修复后重走 testing → acceptance）；若仅为 OBS-1 文档行 → release 前直接修正即可。
- **放行条件（建议写入 approval 关备注）**：
  1. **Owner 按批次 22 完成写操作与实机复测并回填**（本轮 10 条 pass 基于只读 GUI 与自动化，写操作尚未实机验证）；
  2. approval 关 Owner 人工确认（本关不审批）；
  3. `.dsh/review.json` 已审 **0/23** → approval 前补标或显式接受；
  4. ~~release 提交前删除 CHANGELOG 重复标题行（OBS-1）~~ → **已修复并复验通过（④-2）**；
  5. release 关重写 `docs/pipeline/release.md`（环境/URL/版本/回滚）、`pipeline_record_release` 落库、确认**根 1.2.86** 随提交落地；提交**不含** `.dsh/tmp` 与 `.dsh/evidence`（`.dsh/` 已 gitignore）；
  6. 发布后重建 bundle + 强刷复测；无数据迁移。
- **版本与生效**：插件 1.2.84 / 根 1.2.86；纯客户端改动，**重建客户端 bundle + 强刷** 即生效；回滚可 revert 本轮交付提交（release 前基线 `1d85de4`），无数据结构变更。

---

## 附：证据索引

- 本关复核报告：`docs/pipeline/acceptance-review.md`（本文件）；旧版归档 `docs/pipeline/archive/v1.2.83-acceptance-review.md`
- 本关复测日志：`.dsh/evidence/acceptance-retest-v1.2.84.log`（环境/HEAD/版本 + 质量门 + 独立静态 + QA 静态复跑 + GUI 复跑 44 条逐条 + 深色探针 + 证据链/blocked/版本检查 + 链接/归档校验，均含退出码与耗时；末尾 §7 为 P2 闭环复验）
- 复核临时脚本与复跑产物（不随包发布、未跟踪）：`.dsh/tmp/review-v1284/`（`review-static.mjs`、`static-rerun.mjs`、`gui-rerun.mjs`+`cdp.mjs`、`dark-probe.mjs`、`linkcheck-review.mjs`、`run-retest.sh`、`gui-rerun.log`、`gui-results.json`、`shots/` 15 张）
- QA 证据（只读引用，未改动）：`.dsh/evidence/v1.2.84-qa-*.png`（18 张）、`v1.2.84-qa-quality-gates.log`、`v1.2.84-qa-static.log`、`v1.2.84-qa-gui.log`、`v1.2.84-qa-gui-results.json`
- 上游文档：`docs/pipeline/requirements.md` §7/§8、`design.md` §17、`engineering-research.md` §5–§7、`test-report.md`、`docs/ACCEPTANCE.md` 批次 22、`CHANGELOG.md` `## 1.2.84`
- 验收清单：`.dsh/acceptance.json`（64 条 = 41 pass / 23 blocked；本轮 10 条全 pass）
- 设计稿：`docs/pipeline/design/acceptance-collapse-*.svg`（8 张，另 PNG@2× 供审阅、gitignored）
