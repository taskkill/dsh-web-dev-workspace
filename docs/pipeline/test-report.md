# 测试报告：团队三 Agent 能力升级（v1.2.73）

- 阶段 testing（第 2 轮）｜ 2026-10-27 ｜ QA `opc-qa` ｜ 需求：产品调研借鉴 / UI 专业设计质量 / 工程开源调研与安全复用（v1.2.73）
- 环境：工作区 `/data/dsh/home/dsh-web-powerfilebrowser/dsh-web-filebrowser`；Linux；Node **v24.22.0**；npm **11.19.1**；Git HEAD **b3c1e77**（工作区 25 项未提交改动 = 本轮交付 + Lead 对 DEF-01/OBS-02/OBS-03 与 acceptance 复核打回的 B1/B2 的修复）
- 版本：根 `package.json` **1.2.73**、`dsh-web-filebrowser-plugin/package.json` **1.2.73**、`CHANGELOG.md` 含 `## 1.2.73 — 2026-10-27`
- 流水线状态（`.dsh/pipeline.json`，第 2 轮，gateMode=fast）：product / design / development = approved，**testing = active**，acceptance / approval / release = pending（七阶段结构不变）
- **结论：12 pass / 0 fail / 0 blocked。** 功能、提示词、手册、测试全部通过；Lead 已修复 DEF-01 / OBS-02 / OBS-03 与 acceptance 打回的 B1/B2/B3，最终复测全绿（2026-10-27T03:25Z）；acceptance **v3 终版复核报告**已产出（`docs/pipeline/acceptance-review.md`，164 行，结论「建议放行」、阻断 0，含 ⑦ 三项专业质量复核与 ⑧ 放行建议），验收项 8 已复验转 pass。**建议：通过**（进入 approval 人工确认）。

## 1. 范围

- 覆盖 `.dsh/acceptance.json` 中 v1.2.73 的 **12 条验收项**：四阶段提示词与 systemPrompt 关键词、三本手册新章节（01-product / 02-design / 03-engineering）、AGENT_TEAM/PLAYBOOK/README 同步、ACCEPTANCE 批次 11 / CHANGELOG / 双 package 版本、测试全绿无回归、七阶段双复核跑通、无新增依赖、调研来源真实可核、需求文档自身调研章节、文档无死链。
- 被测文件：`dsh-web-filebrowser-plugin/pipeline.js`（STAGE_GUIDES × 4 + PIPELINE_SECTION）、`docs/opc/01-product.md`、`docs/opc/02-design.md`、`docs/opc/03-engineering.md`、`docs/AGENT_TEAM.md`、`docs/PLAYBOOK.md`、`README.md`、`README.zh.md`、`dsh-web-filebrowser-plugin/README.md`、`docs/ACCEPTANCE.md`、`CHANGELOG.md`、两个 `package.json`；测试脚本 `scripts/selftest/host-smoke.mjs` 与 `.dsh/tmp/team/pipeline-selftest.mjs`。
- 不测（沿用现状 / 下游阶段）：真实浏览器 GUI 渲染与派发提示词显示（需 Owner 重启 Harness 后按 `docs/ACCEPTANCE.md` 批次 11 人工复测）；acceptance v3 复核报告已产出（见验收项 8）；真实发布。

## 2. 命令与结果（最终一次复测，2026-10-27T03:25Z）

| # | 命令 | 目的 | 退出码 | 耗时 | 通过数 / 总数 | 结论 |
|---|---|---|---|---|---|---|
| 1 | `npm run check` | 20 个模块 `node --check` 语法检查 | **0** | 522 ms | 20/20 文件 | PASS |
| 2 | `npm test`（host-smoke） | Host smoke：工具/路由、证据链、7 阶段/迁移/scope/fast/prompt + **v1.2.73 四阶段关键词** | **0** | 588 ms | **18/18** | PASS |
| 3 | `node .dsh/tmp/team/pipeline-selftest.mjs` | 流水线模块深测 + **v1.2.73 提示词/三手册章节** | **0** | 669 ms | **38/38** | PASS |
| 4 | `node .dsh/tmp/team/review-selftest.mjs` | 变更审阅模块（回归） | **0** | 775 ms | **22/22** | PASS |
| 5 | `node --check dsh-web-filebrowser-plugin/client.js` | 客户端语法（回归，本轮未改 client.js） | **0** | 39 ms | — | PASS |
| 6 | `npm run check:json` | JSON 文件校验（locale 修复后） | **0** | 104 ms | JSON OK | PASS |
| 7 | `node .dsh/tmp/qa-tables-v1273.mjs` | 表格结构 / 链接口径 / B1-B3 复测 | **0** | 64 ms | STRUCTURE PASS | PASS |
| 8 | `node .dsh/tmp/qa-static-v1273.mjs` | 静态链接 / 调研 / 版本与依赖 | **0** | 51 ms | STATIC PASS | PASS |

关键输出末尾：

```text
npm test                     → PASS: 18/18 host smoke checks（原 17 用例 + 1 个 v1.2.73 关键词用例）
pipeline-selftest            → 38/38 checks passed（原 36 + 2 个 v1.2.73 用例）
review-selftest              → 22/22 checks passed（既有回归全通过）
npm run check / client check → exit 0
```

## 3. 静态检查

### 3.1 提示词关键词（pipeline.js）

`grep -nE "调研|借鉴|web_search|web_fetch|许可证|安全|对比度|状态矩阵|engineering-research" dsh-web-filebrowser-plugin/pipeline.js` → **31 行命中**，覆盖 `STAGE_GUIDES` 的 product / design / development / acceptance 与 `PIPELINE_SECTION`。

自动化逐项断言（host-smoke 18/18 + pipeline-selftest 38/38 均通过）：

| 阶段 | 断言关键词 | 结果 |
|---|---|---|
| product | 调研 / 借鉴 / web_search / web_fetch / 来源 / 借鉴决策表 / 已验证模式 / 创新假设 / 反抄袭 / blocked / 验收标准 | 全部命中 |
| design | 调研 / 借鉴 / web_search / 4/8px / 字号阶梯 / 行高 / 对比度 / 4.5:1 / 3:1 / 44×44 / 状态矩阵 / 360 / 768 / 1280 / 150–300ms / prefers-reduced-motion / ARIA / 自检评分 / 渲染→检查→修正 / 迭代 | 全部命中（字面 `rubric` 在 02-design.md 手册中，提示词用等价「五维自检评分」——符合需求 §5.1 design 行） |
| development | 调研 / 借鉴 / web_search / web_fetch / GitHub / 活跃 / 许可证 / SPDX / MIT / Apache / GPL / AGPL / 无许可证 / engineering-research.md / npm audit / OSV / CVE / 安全 / 性能 | 全部命中 |
| acceptance | 调研 / 借鉴 / 来源 / 借鉴决策表 / 设计质量 / 自检评分 / 状态矩阵 / 对比度 / 44×44 / engineering-research.md / 许可证 / N/A / 专业质量 / 建议打回；且含「复核调研与借鉴」「复核设计质量」「复核工程调研与许可证」 | 全部命中 |
| PIPELINE_SECTION | 调研与借鉴纪律 / 调研 / 借鉴 / web_search / web_fetch / 许可证 / 安全 / 对比度 / 状态矩阵 / 44×44 / engineering-research.md | 全部命中 |

### 3.2 三本手册章节与关键词（selftest 读真实文件断言）

| 手册 | 章节 | 关键词（全部命中） |
|---|---|---|
| `docs/opc/01-product.md` | `## 5. 调研与借鉴` | 来源门槛 / web_search / web_fetch / 访问日期 / 借鉴决策表 / 已验证模式 / 创新假设 / 反抄袭 / blocked / 来源表 |
| `docs/opc/02-design.md` | `## 5. 专业设计质量标准` | 4/8px / 字号阶梯 / 行高 / 对比度 / 4.5:1 / 3:1 / 44×44 / 状态矩阵 / 360 / 768 / 1280 / 150–300ms / prefers-reduced-motion / ARIA / 自检评分 / rubric / 渲染→检查→修正 / 迭代 |
| `docs/opc/03-engineering.md` | `## 5. 不熟悉功能：先调研再借鉴` | engineering-research.md / SPDX / MIT / Apache / GPL / AGPL / npm audit / OSV / CVE / 性能预算 / 活跃度 / 许可证矩阵 / 候选对比 / N/A |

`STAGE_HANDBOOKS` 中 product/design/development/testing/acceptance/approval/release 引用的所有手册路径均存在（selftest 实际 `fsp.access` 校验，无死路径）。

### 3.3 文档同步与版本

- `docs/AGENT_TEAM.md`：角色表三行含调研/质量/许可证职责与产物，L23 新增「研究与借鉴纪律（v1.2.73）」段；`docs/PLAYBOOK.md`：product/design/development/acceptance 段落含调研/质量/许可证/安全步骤，头部版本 v1.2.73。
- `README.md`、`README.zh.md`、`dsh-web-filebrowser-plugin/README.md`：均新增 v1.2.73 三 Agent 能力说明。
- 版本：根与插件 `package.json` 均 **1.2.73**；`CHANGELOG.md` 含 `## 1.2.73 — 2026-10-27`；`docs/ACCEPTANCE.md` 已新增**批次 11**（标题升为批次 0–11）。
- 依赖：两个 `package.json` 与 HEAD 对比 `dependencies` 完全一致（根：`ssh2`；插件：`@xterm/xterm`、`@xterm/addon-fit`、`ssh2`，即 xterm 等前端依赖 + ssh2），**未新增**；`git diff -U0 -- package.json dsh-web-filebrowser-plugin/package.json` 仅 2 行版本号变化。
- 工具/路由：未新增（36 tools / 10 routes，`npm test` 首用例断言通过）。

### 3.4 相对链接与外部来源

- 全仓 Markdown 链接扫描：**27 个 Markdown 文件 / 97 个相对链接目标 / 0 失效**（相对链接按出现次数计 97 处、去重 44 个目标串；含重复引用；全部可解析，含 `docs/opc/README.md` 名册、设计稿 `design/*.svg`、`05-review.md`/`06-ops.md`、归档设计说明等）。
- DEF-01 复测：归档设计说明 `requirements.md` → `../requirements.md`；9 处空 `()` 已补同目录真实 SVG（seven-stage-normal/fast/workbench/acceptance-card-states.svg）；`grep -c "]()"` = 0；`.dsh/tmp/qa-static-v1273.mjs` → **STATIC PASS**；`.dsh/tmp/qa-tables-v1273.mjs` → **STRUCTURE PASS**（27 md / 97 相对目标 / 0 失效）。
- 外部来源（验收项 10）：`requirements.md` §6.1 共 **11 个来源**，每条含 URL + 访问日期（2026-10-27）+ 关键结论，URL 唯一；§6.5 诚实列出 4 条抓取失败来源。QA 抽查 3 条 URL 实际抓取均 **HTTP 200** 且结论与正文一致：W3C WCAG 1.4.3（4.5:1/3:1）、SPDX License List（3.29.0）、OSV（npm 漏洞库）。未见伪造来源。

## 4. 用例与结果

### 4.1 `npm test`（host-smoke，18/18 PASS）

既有 17 个用例全部通过（7 阶段/跳关/迁移/scope/fast/dispatch/工具 36/路由 10 等无回归）；新增 1 个：

| # | 用例 | 结果 |
|---|---|---|
| 18 | `v1.2.73 stage prompts carry research/quality/license/security requirements`：四阶段 `buildStagePrompt` 关键词矩阵 + acceptance 三项新增复核 marker + `PIPELINE_SECTION`「调研与借鉴纪律」关键词 | PASS |

### 4.2 `pipeline-selftest`（38/38 PASS）

既有 36 个用例全部通过（含 v1.2.72 七阶段/迁移/scope/fast/prompt 全回归）；新增 2 个：

| # | 用例 | 结果 |
|---|---|---|
| 37 | `stage prompts carry the v1.2.73 research/quality/license discipline`（四阶段关键词 + systemPrompt 纪律） | PASS |
| 38 | `role handbooks contain the v1.2.73 research/quality/license chapters`（读 01/02/03 三本手册，校验章节与关键词 + `STAGE_HANDBOOKS` 全部路径存在） | PASS |

### 4.3 `review-selftest`（22/22 PASS，回归）

变更审阅模块 22 个用例全部通过（含 v1.2.72 新增的 acceptance 基线/已审用例），本轮未改 review.js，无回归。

## 5. 12 条 v1.2.73 验收项逐条对照

| # | 验收项 id | 验收项（结论式） | 结论 | 证据（命令 / 文件 / 用例） |
|---|---|---|---|---|
| 1 | `a81769de27` | 四个阶段提示词与 systemPrompt 含调研/质量/许可证/安全要求且可检索 | **pass** | `npm test` 18/18 新用例；`pipeline-selftest` 38/38「stage prompts carry the v1.2.73…」；`grep -nE "调研\|借鉴\|web_search\|许可证\|安全\|对比度\|状态矩阵\|engineering-research" dsh-web-filebrowser-plugin/pipeline.js` 31 行命中（STAGE_GUIDES×4 + PIPELINE_SECTION） |
| 2 | `6547accbd1` | `docs/opc/01-product.md` 新增「调研与借鉴」SOP 与借鉴决策表模板 | **pass** | selftest「role handbooks…」读文件断言 `## 5. 调研与借鉴` + 来源门槛/访问日期/借鉴决策表/已验证模式/创新假设/反抄袭/blocked/来源表；手册 188 行 |
| 3 | `bef0b5fe0a` | `docs/opc/02-design.md` 新增专业设计质量标准（间距/字号/对比度/触控/状态/响应式/动效/可访问性/评分/迭代） | **pass** | selftest 断言 `## 5. 专业设计质量标准` + 18 个关键词（4/8px、4.5:1、3:1、44×44、八态、360/768/1280、150–300ms、prefers-reduced-motion、ARIA、自检评分、rubric、渲染→检查→修正、迭代等）；手册 274 行 |
| 4 | `935f00d714` | `docs/opc/03-engineering.md` 新增开源调研与安全复用 SOP + engineering-research.md 模板 | **pass** | selftest 断言 `## 5. 不熟悉功能：先调研再借鉴` + 14 个关键词（engineering-research.md、SPDX、许可证矩阵、MIT/Apache/GPL/AGPL、npm audit、OSV、CVE、性能预算、活跃度等）；手册 207 行 |
| 5 | `841c967ac4` | AGENT_TEAM / PLAYBOOK / README（含中文与插件 README）同步三 Agent 新能力 | **pass** | `git diff`：AGENT_TEAM 角色表三行 +「研究与借鉴纪律」段（L23）；PLAYBOOK 头部版本 + ②③④ 阶段调研/质量/许可证步骤；README.md / README.zh.md / 插件 README 均新增 v1.2.73 能力段。locale 描述（OBS-02）亦已补，见 §6 |
| 6 | `8db64ef5f6` | 验收记录与版本一致：ACCEPTANCE 批次 11、CHANGELOG 1.2.73、两个 package.json 1.2.73 | **pass** | `docs/ACCEPTANCE.md` 含「批次 11 · 三 Agent 能力升级（v1.2.73）」；`CHANGELOG.md` L5 `## 1.2.73 — 2026-10-27`；根/插件 `package.json` 均 1.2.73（静态脚本逐项断言） |
| 7 | `24119ca5f3` | npm run check、npm test、pipeline-selftest 全绿且覆盖新关键词与 handbook 引用，无回归 | **pass** | §2：check exit 0（20 模块）、test 18/18、pipeline-selftest 38/38；另 review-selftest 22/22（既有回归）；新增用例覆盖四阶段关键词 + 三手册章节 + handbook 路径存在性 |
| 8 | `d1891f12f4` | 七阶段双复核完整跑通，acceptance 复核报告结论「建议放行」且含三项新增复核 | **pass**（v3 报告复验转 pass） | `docs/pipeline/acceptance-review.md` **v3 终版（164 行，第 2 轮 v1.2.73）**：含 v1/v2/v3 打回与修复历史，结论「建议放行」、阻断 0、DoD 本关可判 5/5；⑦ 三项专业质量复核全部通过（需求调研 11 来源/17 行决策表/5 假设/4 失败来源；设计 9 MUST/五维 rubric/八态/三档/ARIA/R1-R3 迭代；工程本轮 N/A 且理由记录）；七阶段 full-flow 另由 `pipeline-selftest` 38/38 覆盖。history：pending→blocked→pass。证据：§5#8/§7 |
| 9 | `b6657ac188` | 无新增运行时依赖：两个 package.json 的 dependencies 与锁文件未被扩大 | **pass** | 静态脚本：根/插件 `dependencies` 与 HEAD 完全一致（根 `ssh2`；插件 `@xterm/xterm` + `@xterm/addon-fit` + `ssh2`），未新增；`git diff -U0` 仅版本号 2 行；仓库无 package-lock 变更（本轮未生成/修改锁文件） |
| 10 | `1f3dbcccbf` | 调研来源真实可核：至少 3 个 URL + 访问日期 + 关键结论，无伪造来源 | **pass** | `requirements.md` §6.1 共 **11 个来源**（URL + 2026-10-27 + 关键结论，URL 唯一）；§6.5 列出 4 条失败来源；QA `web_fetch` 抽查 3 条：W3C WCAG 1.4.3 → HTTP 200（4.5:1/3:1 与正文一致）、SPDX License List → HTTP 200（v3.29.0）、OSV → HTTP 200（npm 漏洞库） |
| 11 | `37adbb8ace` | product 需求文档自身含调研与借鉴章节、借鉴决策表与已验证/创新假设区分 | **pass** | `requirements.md` §6「调研与借鉴」：§6.1 来源表（11）、§6.2 借鉴决策表（17 行：采用/调整/不采用 + 理由 + 落点）、§6.3 已验证模式 vs 创新假设（5 条假设 + 验证方式）、§6.5 失败来源披露；静态脚本逐项断言通过 |
| 12 | `daf5622f89` | 文档无死链：requirements/手册引用 URL 可访问，仓库内相对链接可解析 | **pass**（acceptance 复核打回的 B1/B2/B3 均已修复，最终复测转 pass） | 外链 OK（抽查 3 条 HTTP 200；requirements §6.1 全部可核）；DEF-01 修复后全仓 **27 个 Markdown / 97 个相对链接目标 / 0 失效**；`.dsh/tmp/qa-static-v1273.mjs` → STATIC PASS、`.dsh/tmp/qa-tables-v1273.mjs` → STRUCTURE PASS（2026-10-27T03:25Z 本次最终复测）；归档空链接 grep = 0。历史：pending→fail→pass→fail(B1/B2)→pass→fail(B3)→pass，7 条 history 保留（retestRound=5）。证据：§3.4/§6/§7 |

**合计：pass 12 / fail 0 / blocked 0。**（本轮 testing 开始前 Lead 已将验收清单重置为 v1.2.73 的 12 条；12 条均保留完整 history：item 8 由 blocked 复验转 pass（3 条），item 12 为 7 条 history 的多次复测记录。）

## 6. 文档一致性与死链

- 关键词一致性：三手册、四阶段提示词、PIPELINE_SECTION、AGENT_TEAM、PLAYBOOK、README 的关键词集合与需求 §5.1/§5.2 对照一致（自动化断言覆盖 60+ 关键词）。
- 版本一致性：两个 package.json、CHANGELOG、ACCEPTANCE 批次 11 均对齐 1.2.73；无新增依赖。
- 死链：**0**（DEF-01 已修复并复测；全仓 27 md / 97 个相对链接目标全部可解析，空目标 0）；外部来源 URL 抽查 3/3 HTTP 200。
- 观察项（均已修复）：
  - OBS-02（P3，已修复）：`locale/zh.json`、`en.json` 的 `meta.description` 已补 v1.2.73 能力描述（产品调研/UI 质量/开源许可证与安全审查），`npm run check:json` → JSON OK。
  - OBS-03（P3，已修复）：`docs/opc/README.md` 角色速查已补 `web_search/web_fetch`、`engineering-research.md` 与三 Agent 能力（v1.2.73）说明。
- acceptance 复核打回修复复测（B1/B2/B3，PM 复核意见）：
  - B1：`docs/opc/README.md`「三 Agent 能力（v1.2.73）」段落已从角色速查表中间移到表格之后；表格 product/design/development/testing/acceptance/approval/release **7 行完整**（自动化断言：表头后连续 7 行 + 段落在表后）。
  - B2：`docs/pipeline/requirements.md` §7 第 1 行 3 个未转义 `|` 已改为 `/` 分隔（`stageId:'product'/'design'/'development'/'acceptance'`）；按未转义 `|` 计数该行 **3 列**，与表头一致，无表格截断。
  - B3（PM v2 复核）：`docs/pipeline/test-report.md` §7 B2 行的行内代码含 2 个裸竖线，导致该 5 列表格被拆成 7 列；Lead 已改写为「3 个未转义的竖线符号」「无裸竖线」，不含字面竖线；本次复测 qa-tables 对该表按未转义竖线计数为 5 列，与表头一致。
  - 最终复测（2026-10-27T03:25Z）：`node .dsh/tmp/qa-tables-v1273.mjs` → **STRUCTURE PASS**（exit 0，64ms，本轮改动文档所有表格列数一致）；`node .dsh/tmp/qa-static-v1273.mjs` → **STATIC PASS**（51ms）；`npm run check`（522ms）/`npm test`（588ms，18/18）/`pipeline-selftest`（669ms，38/38）/`review-selftest`（775ms，22/22）/`npm run check:json`（104ms，JSON OK）全部 exit 0。

## 7. 缺陷 / 阻塞

| ID | 标题 | 严重度 | 状态 | 说明 / 修复建议 |
|---|---|---|---|---|
| DEF-01 | 归档设计说明 `archive-v1.2.72-seven-stage-design.md` 失效相对链接 + 9 处空链接 | **P3（文档质量）** | **已修复并复测通过** | Lead 已修：`requirements.md` → `../requirements.md`，9 处空 `()` 补真实 SVG 文件名；复测 `.dsh/tmp/qa-static-v1273.mjs` → STATIC PASS、全仓 27 md / 97 相对目标 / 0 失效、item 12 转 pass（历史见 §5#12） |
| OBS-02 | locale 插件描述未同步 v1.2.73 能力 | P3 | **已修复** | `meta.description` zh/en 已补三 Agent 能力描述；`npm run check:json` JSON OK |
| OBS-03 | `docs/opc/README.md` 速查未提三 Agent 新能力 | P3 | **已修复** | 角色速查已补 `web_search/web_fetch`、`engineering-research.md`、三 Agent 能力（v1.2.73） |
| B1 | `docs/opc/README.md`「三 Agent 能力（v1.2.73）」段落在角色速查表中间，致 approval/release 行脱离表格（PM acceptance 复核打回） | P2（文档渲染） | **已修复并复测通过** | Lead 已移到表格之后；复测表内 7 行完整、段落在表后（`qa-tables-v1273.mjs` STRUCTURE PASS） |
| B2 | `docs/pipeline/requirements.md` §7 L192 stageId 枚举 3 个未转义的竖线符号致表格列截断（PM acceptance 复核打回） | P2（文档渲染） | **已修复并复测通过** | 已改为 `'product'/'design'/'development'/'acceptance'`；复测该行 3 列、无裸竖线（`qa-tables-v1273.mjs` STRUCTURE PASS） |
| B3 | `docs/pipeline/test-report.md` §7 B2 行的行内代码含 2 个裸竖线，致该 5 列表格被拆成 7 列（PM v2 复核打回） | P2（文档渲染） | **已修复并复测通过** | Lead 已改写为「3 个未转义的竖线符号」「无裸竖线」，不含字面竖线；本次最终复测 `qa-tables-v1273.mjs` → STRUCTURE PASS（该表 5 列与表头一致） |
| BLOCKED-1（已关闭） | v1.2.73 acceptance 复核报告（建议放行 + 三项新增复核） | — | **已关闭（转 pass）** | PM 已产出 v3 终版报告（164 行，建议放行、阻断 0，含 ⑦ 三项专业质量复核与 ⑧ 放行建议）；QA 核对后已将 `d1891f12f4` 由 blocked 复验为 pass（history 3 条，retestRound 不变） |

## 8. 回归范围与结果

- `npm test` 既有 17 用例：apply() 工具 36 / 路由 10、子注册工具集、验收证据链、Git 审阅、交付包、产物 warnings、7 阶段常量/跳关/normal/fast/迁移/scope/dispatch/prompt——全部 PASS，无回归。
- `pipeline-selftest` 既有 36 用例：常量/空工作区/需求校验/跳关/acceptance 闸门/打回重开/approval 闸门/边界/发布记录/损坏文档/归一化/并发锁/prompt/工具/SSH 拒绝/systemPrompt section/变更轮/需求日志/scope/restartStage/symlink/迁移三情形——全部 PASS。
- `review-selftest` 22 用例全部 PASS（acceptance 基线等 v1.2.72 能力未回归）。
- `node --check client.js` exit 0（本轮未改 client.js，验证无意外改动）。
- 代码范围核对：QA 只改 `scripts/selftest/host-smoke.mjs`、`.dsh/tmp/team/pipeline-selftest.mjs`、`docs/ACCEPTANCE.md`、`docs/pipeline/test-report.md`（+ `.dsh/tmp/` 下 QA 辅助脚本）；`pipeline.js` 与三本手册的改动均来自 development；未改业务代码、未审批、未创建 git 提交。

## 9. 剩余风险

1. **Host 重启依赖**：`pipeline.js` 的 STAGE_GUIDES / PIPELINE_SECTION 改动需重启 Harness 后新提示词才生效；纯提示词/文档改动无需重建客户端 bundle。
2. **GUI 派发显示未实测**：QA 环境无浏览器，四阶段提示词通过 `buildStagePrompt`/工具层断言验证；Owner 需按 `docs/ACCEPTANCE.md` 批次 11 在面板「启动并派发」确认对话提示词可见。
3. **调研依赖联网**：`web_search`/`web_fetch` 不可用时按提示词要求标 blocked；本轮需求自身调研已完成（11 来源，3 条抽查 200）。
4. **acceptance 三项新增复核**：v3 复核报告已产出并通过（阻断 0）；后续 approval 人工确认与 release 发布记录仍需 Owner/运维完成，如发现证据缺口可回退。
5. 文档债务已清零：DEF-01（归档死链）、OBS-02（locale 描述）、OBS-03（opc/README 速查）均已修复并复测；后续新增文档仍需保持相对链接可解析。
6. 未覆盖：真实发布环境、SSH 工作区、深色主题/窄侧栏视觉（沿用现状人工复测）。

## 10. 结论与建议

- 自动化：`npm run check`（20 模块）、`npm test`（18/18）、`pipeline-selftest`（38/38）、`review-selftest`（22/22）、`node --check client.js` 全部 exit 0；新增断言覆盖四阶段关键词、PIPELINE_SECTION 纪律与三本手册章节。
- 静态：关键词/版本/依赖/来源真实性/外链抽查全部通过；全仓 27 md / 97 相对链接目标 / 0 失效；表格结构 **STRUCTURE PASS**（本次最终复测 03:25Z，含 acceptance 打回的 B1/B2/B3 复测）。
- 验收：**12 pass / 0 fail / 0 blocked**；DEF-01/OBS-02/OBS-03 与 acceptance 打回的 B1/B2/B3 已由 Lead 修复并经 QA 复测（静态脚本 STATIC PASS、STRUCTURE PASS、全仓 27 md / 97 相对目标 / 0 失效、check:json JSON OK）；acceptance v3 终版报告（建议放行、阻断 0、三项专业质量复核通过）已产出，验收项 8 复验转 pass。
- **建议：通过**，提交 acceptance 阶段；进入 approval（Owner 人工确认，参考 `docs/pipeline/acceptance-review.md` v3）与 release（运维记录发布信息/回滚方式）。
