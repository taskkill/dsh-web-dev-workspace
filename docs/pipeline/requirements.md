# 需求：团队三 Agent 能力升级 —— 产品调研借鉴 / UI 专业设计质量 / 工程开源调研与安全复用（v1.2.73）

- 提出人：Owner（项目经理/你）；日期：2026-10-27（Asia/Shanghai）；优先级：P0；目标版本：**v1.2.73**。
- 本轮基线：v1.2.72 的「七阶段 + 双复核」已交付（product → design → development → testing → acceptance → approval → release）。本轮**不改流水线结构**，只升级三名执行角色的作业手册与阶段提示词，并让 acceptance 复核关强制检查这些专业质量。
- 一句话：「把『先调研、再借鉴、后实现』写进产品/设计/开发三个角色，把好看好用、许可证与安全变成可检查的硬标准。」
- 本文只做需求分析与可验收化，不改写 `.dsh/pipeline.json` 中的需求本身；范围、约束与验收标准以本文 + 需求详情为准。

## 1. 背景与问题

v1.2.72 把「按边界交付 + 双复核」跑通后，团队暴露出**能力质量**问题，而不是流程问题：

1. **产品经理闭门造车**：需求文档没有同类调研、没有来源与借鉴决策，验收标准凭主观判断；遇到成熟功能时重新发明轮子，或反过来把竞品做法当成「已验证」直接照搬，无证据链。
2. **UI 设计师交付偏功能说明**：文档能「说明界面」，但缺少专业设计硬标准——间距/字号体系、颜色与对比度、完整状态、响应式、动效、可访问性——「好看、好用、体验好」无法判定，也无法在验收时检查。
3. **全栈开发遇不熟悉功能倾向从零实现**：不检索活跃开源项目、不比较候选、不检查许可证与已知漏洞；可能重复造轮子，或引入 GPL/AGPL/无许可证代码、带 CVE 的依赖，形成合规与安全风险。
4. **验收复核无据可查**：acceptance 关只能核对「测试是否通过」，无法检查「有没有调研、有没有质量硬标准、有没有许可证记录」，专业质量问题被漏过。

**不做的后果**：需求返工、UI 体验差且无客观验收标准、开源许可证/安全事件、Owner 验收继续靠主观印象。

## 2. 目标用户与核心场景

| 用户 | 场景 | 期望结果 |
|---|---|---|
| **产品经理（opc-product）** | 接到熟悉/陌生领域的 feature 需求 | 先检索 ≥3 个来源（竞品文档、行业标准、设计系统、同类 PRD/开源需求），需求文档给出「调研与借鉴」+ 借鉴决策表，区分已验证模式与创新假设，验收标准可追溯到来源与用户场景 |
| **UI 设计师（opc-design）** | 需求通过后做界面/交互设计 | 先调研 ≥2 个同类产品/设计系统；按硬标准交付 tokens、状态矩阵、响应式与可访问性说明、高保真稿，并给出自检评分与至少一轮「渲染→检查→修正」 |
| **全栈开发（opc-dev）** | 遇到不熟悉的功能/库/实现方式 | 先定位问题 → 检索 GitHub 上 ≥2 个活跃候选，比较活跃度/依赖/已知问题/CVE → 按许可证矩阵决定「借鉴代码 / 只借鉴模式 / 不用」→ 产出 `docs/pipeline/engineering-research.md` 并记录出处与许可证 |
| **项目经理 Agent（acceptance）** | 验收复核 | 除原有清单/证据/测试/变更/DoD 外，新增检查：需求有调研来源与借鉴决策、设计有质量评分/状态矩阵/对比度/迭代、开发（涉及实现时）有 engineering-research.md 与许可证记录；缺失即建议打回并写回退阶段 |
| **Lead（编排）** | 派发三个角色 | `pipeline_stage_prompt` / `pipeline_dispatch` 返回的提示词里能直接检索到调研、质量、许可证与安全要求，无需另读长文档 |
| **Owner（你）** | 人工确认与验收 | 复核报告与交付文档能直接看到「调研证据 → 决策 → 质量硬标准 → 许可证/安全结论」，判断成本降低 |

## 3. 范围

### 3.1 做什么

1. **阶段提示词（`dsh-web-filebrowser-plugin/pipeline.js`）**
   - `STAGE_GUIDES` 的 `product` / `design` / `development` / `acceptance` 四个条目补充「必做调研与借鉴 / 专业设计质量 / 开源调研与安全复用 / 复核检查点」；`PIPELINE_SECTION` 增加一段团队能力纪律（调研优先、质量硬标准、许可证与安全），使 systemPrompt 与 `pipeline_stage_prompt` 输出均可检索到关键词：`调研`、`借鉴`、`web_search`、`许可证`、`安全`、`对比度`、`状态矩阵`、`engineering-research.md`。
   - dispatch / stage_prompt 的产物与检查点路径保持可检索（`docs/pipeline/engineering-research.md`、`docs/pipeline/design.md`、`docs/pipeline/requirements.md`）。
2. **三份角色手册（`docs/opc/`）**
   - `01-product.md`：新增「调研与借鉴」SOP 与模板（来源要求、引用格式、借鉴决策表、已验证模式 vs 创新假设、反抄袭边界、无网络 blocked），并更新产出模板/质量清单/失败模式。
   - `02-design.md`：新增「专业设计质量标准」（间距/字号/对比度/触控/状态/响应式/动效/可访问性/自检评分/迭代），更新交付物与评审清单。
   - `03-engineering.md`：新增「开源调研与安全复用」SOP 与 `docs/pipeline/engineering-research.md` 模板（候选对比、活跃度、许可证矩阵、出处记录、可靠/安全/性能），更新工程检查清单与失败模式。
3. **团队与用户文档**：`docs/AGENT_TEAM.md` 角色表/职责同步三 Agent 新能力；`docs/PLAYBOOK.md` 对应阶段加入调研/质量/许可证步骤；`README.md`、`README.zh.md`、`dsh-web-filebrowser-plugin/README.md` 与 locale 插件描述同步「调研优先 + 专业质量 + 开源安全复用」；`docs/opc/README.md` 与 `00-charter.md` 必要时同步原则/DoD。
4. **发布记录与版本**：`docs/ACCEPTANCE.md` 新增「批次 11 · 三 Agent 能力升级（v1.2.73）」复测步骤；`CHANGELOG.md` 新增 `## 1.2.73 — 2026-10-27`；根 `package.json` 与 `dsh-web-filebrowser-plugin/package.json` 均对齐 **1.2.73**。
5. **测试**：`npm run check`、`npm test`（host-smoke）通过；扩展 `scripts/selftest/host-smoke.mjs` 或 `.dsh/tmp/team/pipeline-selftest.mjs`，覆盖新提示词关键词与 handbook 引用；现有 acceptance/delivery/tasks/review/preview/memory/todo 无回归。

### 3.2 不做什么

- **不改流水线结构**：仍为七阶段双复核，不新增/删除阶段，不改闸门与迁移语义。
- **不引入运行时依赖**：`package.json` 的 `dependencies` 不新增；不实现联网抓取服务（使用 Harness 自带 `web_search` / `web_fetch`）。
- **不改业务功能代码**：本轮只动 SOP/提示词/文档/测试；不新增 UI 功能，不做视觉改版。
- **不复制第三方代码**：只借鉴功能/交互/信息结构与实现思路；禁止把受版权保护的文案、商标、界面素材或整段源码复制进仓库。
- **不伪造调研**：所有引用必须有真实 URL 与访问日期；无网络时标注 `blocked` 并说明缺失，不得编造来源或结论。
- **不把密钥/令牌/真实用户数据写入文档、对话或仓库**。

## 4. 三个角色能力升级细则

### 4.1 产品经理：调研与借鉴（product 阶段必做）

- **来源门槛**：product 阶段用 `web_search` / `web_fetch` 检索 **≥3 个来源**（同类产品文档、行业标准、设计系统、同类开源需求/PRD），逐个记录 `URL + 访问日期 + 关键结论`；来源不足 3 个或无法访问时，在需求文档标注 `blocked` 并写清缺什么、影响哪条验收标准。
- **引用格式**（统一）：`[来源标题](URL)（访问日期 YYYY-MM-DD，类型：竞品/标准/设计系统/PRD/开源）——关键结论`。禁止只写域名或「网上查的」。
- **借鉴决策表**（需求文档必含）：列 `借鉴点 | 来源 | 采用/调整/不采用 | 理由 | 对应需求或验收项`。每条决策必须能回到来源与理由；采用时要写落地方案，不采用要写原因（成本/合规/不匹配用户场景）。
- **已验证模式 vs 创新假设**：需求文档明确区分——「已验证模式」指有来源与业界实践支撑的做法；「创新假设」指无直接来源、需要额外验证或 A/B/可用性测试的假设，必须写验证方式与失败预案。
- **验收标准溯源**：每条验收标准要能追溯到调研证据或用户场景；无依据的标准不得写成 P0。
- **反抄袭边界**：只借鉴功能、交互、信息结构；不复制受版权保护的文案、商标、界面素材与整段源码；引用数据/图表注明出处。
- **交付物**：`docs/pipeline/requirements.md` 含「调研与借鉴」章节、来源表、借鉴决策表、已验证/创新假设清单；验收项可被第三方按来源复核。

### 4.2 UI 设计师：专业设计质量（design 阶段必做）

- **先调研**：design 阶段检索 **≥2 个同类产品/设计系统**，提炼可借鉴的版式、组件、交互与动效模式，写进设计说明的来源段；结论同样记录 URL + 访问日期。
- **硬性设计标准**（全部可检查）：
  | 维度 | 硬标准 |
  |---|---|
  | 间距 | 4/8px 体系（4px 细粒度、8px 主节奏；可用 4 的倍数） |
  | 字号与行高 | 明确字号阶梯（如 12/14/16/20/24/32）与对应行高，正文行高 ≥1.4 |
  | 颜色 | token 化（背景/前景/主色/语义色），正文对比度 **≥4.5:1**，大字号（≥18pt 或 14pt bold）**≥3:1**；非文本控件边界 ≥3:1 |
  | 触控目标 | 可点击区域 **≥44×44 CSS px**（建议 48×48） |
  | 完整状态 | 默认 / hover / focus / active / disabled / loading / empty / error 八态齐备（组件状态矩阵） |
  | 响应式 | 至少覆盖 **360 / 768 / 1280** 三档，写清断点与折叠行为 |
  | 动效 | 150–300ms、有 easing、可关闭/可降级（`prefers-reduced-motion`） |
  | 可访问性 | 键盘可达、焦点可见、ARIA/可读名称、不用颜色单独表意 |
- **交付物**：信息架构、页面/组件清单、状态矩阵、设计 tokens、关键页面与状态的高保真稿/截图（PNG/JPG/SVG 或可预览 HTML）、可访问性说明、**设计自检评分**（视觉层级/清晰度/一致性/反馈/可访问性，各 1–5 分 + 问题与修正）。不得只写文字描述。
- **迭代要求**：至少完成一轮「渲染 → 检查（按上表）→ 修正」并记录修改前后差异；未迭代不得提交。

### 4.3 全栈开发：先调研再借鉴，许可证与安全（development 阶段必做）

- **触发条件**：遇到不熟悉的功能/库/协议/实现方式，先定位问题，再检索 GitHub 上 **≥2 个维护活跃、许可证明确的同类开源项目**；不得未检索就默认为「从零实现」。
- **活跃度评估维度**：最近提交/发布（`pushed_at`）、最近 release、issue/PR 响应、star 与贡献者数、依赖数量与质量；已知问题与 CVE（查 GitHub Advisory / OSV / `npm audit`）。
- **许可证矩阵**：
  | 许可证族 | 规则 |
  |---|---|
  | MIT / Apache-2.0 / BSD-2/3 / ISC | 可借鉴；复制代码时保留版权与许可声明（Apache-2.0 另加 NOTICE/变更说明） |
  | MPL-2.0 / LGPL-2.1/3.0 | 谨慎评估：文件级/动态链接义务，需 Lead 确认并记录 |
  | GPL-2.0/3.0 / AGPL-3.0 / 无许可证 | **禁止复制代码**，只能借鉴模式与思路；无许可证 = 未授权，不得使用 |
  | 其它/自定义许可证 | 必须逐条阅读，写进矩阵结论；不确定时按「禁止复制」处理 |
- **交付物 `docs/pipeline/engineering-research.md`**：候选对比表（项目 | 许可证 | 活跃度 | 依赖 | 优点 | 已知问题/CVE | 结论）、采用/不采用理由、来源 URL + commit（或 release 版本）、引用代码的出处与许可证、对现有实现的影响。涉及复制代码时必须记录并在代码注释/NOTICE 中保留出处。
- **可靠/安全/性能**：关键路径有测试与错误处理；新增依赖前检查维护状态并跑 `npm audit`（或 OSV 等价检查），锁文件固定版本、最小依赖；输入校验，避免注入/密钥泄漏；给出性能预算与测量方法，避免不必要的重依赖。
- **豁免**：本轮若只改文档/提示词、不新增依赖与代码，engineering-research 可记为 `N/A` 并说明原因，但 SOP 与模板必须落进 `03-engineering.md`，验收复核关按「适用性」检查。

## 5. 流水线提示词与文档要求

### 5.1 阶段提示词（STAGE_GUIDES / PIPELINE_SECTION）

| 阶段 | 必须新增的可检索内容 |
|---|---|
| product | 调研 ≥3 来源（URL+日期+结论）、借鉴决策表、已验证/创新假设、反抄袭边界、无网络标 blocked；验收标准可溯源 |
| design | 先调研 ≥2 来源；4/8px、字号阶梯、对比度 4.5:1/3:1、触控 44×44、八态、360/768/1280、动效 150–300ms、ARIA；自检评分与至少一轮迭代 |
| development | 先检索 ≥2 活跃开源候选；活跃度维度；许可证矩阵（MIT/Apache/BSD/ISC 可用，GPL/AGPL/无许可禁复制）；`docs/pipeline/engineering-research.md`；audit/OSV、最小依赖、性能预算 |
| acceptance | 新增三项复核：需求调研来源与借鉴决策、设计质量评分/状态矩阵/对比度/迭代、开发 engineering-research.md 与许可证记录（单轮豁免需写 N/A 理由）；缺失→建议打回并写回退阶段 |

- `PIPELINE_SECTION`（systemPrompt）加一段「团队能力纪律」；`pipeline_dispatch` / `pipeline_stage_prompt` 输出可直接检索关键词（供 selftest 断言）。

### 5.2 文档与记录

- `docs/opc/01-product.md`、`02-design.md`、`03-engineering.md` 三份手册新增章节与模板（见 §4）；`docs/opc/README.md` 名册/速查引用同步。
- `docs/AGENT_TEAM.md`：角色表三行补「调研/质量/许可证」职责与产物；`docs/PLAYBOOK.md`：product/design/development/acceptance 段落补调研、质量、许可证、安全步骤；`README.md`、`README.zh.md`、`dsh-web-filebrowser-plugin/README.md`、locale 插件描述同步。
- `docs/ACCEPTANCE.md` 批次 11 覆盖：提示词关键词、三手册新章节、AGENT_TEAM/PLAYBOOK/README、CHANGELOG/版本、测试与双复核跑通。
- `CHANGELOG.md` 1.2.73（英文），记录三 Agent 能力升级、文档/提示词变更与测试；两个 `package.json` 版本 1.2.73。

## 6. 调研与借鉴（本需求自身的调研证据）

> 调研执行时间：2026-10-27（Asia/Shanghai）。使用 Harness 自带 `web_search`（2 轮共 8 条查询）与 `web_fetch`（11 次抓取）；下表来源均为真实抓取（HTTP 200），关键结论为抓取正文摘要。失败/未采用来源见 §6.5，未伪造任何来源。

### 6.1 来源与关键结论（≥3 个已验证来源，共 11 个）

| # | 来源 | URL | 访问日期 | 类型 | 关键结论（用于本需求） |
|---|---|---|---|---|---|
| 1 | NN/g · UX Research Cheat Sheet（Susan Farrell, 2017-02-12） | https://www.nngroup.com/articles/ux-research-cheat-sheet/ | 2026-10-27 | 调研方法 | 调研越早影响越大，应贯穿各阶段；**竞争分析（competitive analysis）** 属 Explore 阶段常用方法；Test 阶段包含**可访问性评估**。→ 支撑 product「同类调研」、design「先调研 + 可访问性」 |
| 2 | ProductPlan · Product Requirements Document 术语页 | https://www.productplan.com/glossary/product-requirements-document | 2026-10-27 | PRD 规范 | PRD 标准结构：目标/目的、功能 + 用例、UX 流程与设计说明、系统与环境要求、Assumptions/Constraints/Dependencies；PRD 是设计、实现与测试计划的依据。→ 支撑需求文档结构与验收标准溯源 |
| 3 | W3C WAI · Understanding SC 1.4.3 Contrast (Minimum)（WCAG 2.1） | https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html | 2026-10-27 | 无障碍标准 | 正文与背景对比度**至少 4.5:1**；大字号（≥18pt 或 14pt bold）**至少 3:1**；不满足会造成低视力用户不可读。→ 支撑 design 对比度硬标准 |
| 4 | W3C WAI · Understanding SC 2.5.5 Target Size（WCAG 2.1，Level AAA） | https://www.w3.org/WAI/WCAG21/Understanding/target-size.html | 2026-10-27 | 无障碍标准 | 指针目标**至少 44×44 CSS px**；触屏输入精度粗，目标过小难点击；频繁使用/不可撤销的操作建议更大。→ 支撑触控目标 ≥44×44 |
| 5 | Material Design · Metrics & keylines（Material 1 归档页） | https://m1.material.io/layout/metrics-keylines.html | 2026-10-27 | 设计系统 | 组件按 **8dp 基线网格**对齐（图标按 4dp 网格）；触控目标**至少 48×48dp**（建议 7–10mm），间距建议 8dp；移动端左右边距 16dp。→ 支撑 4/8px 间距体系与 48dp 建议 |
| 6 | SPDX · License List（版本 3.29.0，2026-09-16） | https://spdx.org/licenses/ | 2026-10-27 | 许可证标准 | 提供标准化的 license 短标识、全名与 OSI Approved 列；用于统一许可证矩阵命名与比对。→ 支撑开发许可证矩阵用 SPDX 标识 |
| 7 | GitHub · Choose an open source license | https://choosealicense.com/ | 2026-10-27 | 许可证实践 | MIT 宽松（可闭源分发）；GPLv3 要求共享改进（copyleft，不可闭源分发衍生）；**没有许可证 = 没有授权**（不能随意使用）。→ 支撑许可证分级与「无许可证禁止复制」 |
| 8 | Anthropic · Building effective agents（含 2026 更新提示） | https://www.anthropic.com/research/building-effective-agents | 2026-10-27 | Agent 工程实践 | 优先简单可组合模式；区分 workflow 与 agent；**evaluator-optimizer** 适合有明确评估标准的迭代改进；保留**human checkpoints**；工具定义与文档（ACI）质量直接影响可靠性。→ 支撑「阶段提示词写死检查点」与 acceptance「评估者 + 人工确认」双复核 |
| 9 | npm Docs · npm-audit（v11） | https://docs.npmjs.com/cli/v11/commands/npm-audit | 2026-10-27 | 依赖安全 | `npm audit` 为 npm 官方依赖漏洞扫描命令，用于检查依赖树中的已知安全问题。→ 支撑开发依赖安全检查 |
| 10 | OSV · Open Source Vulnerabilities | https://osv.dev/ | 2026-10-27 | 漏洞数据库 | 聚合 GitHub Advisory、PyPA、RustSec 等漏洞库；支持按包版本/commit 查询与 lockfile/SBOM 扫描（npm 生态收录 23 万+ 漏洞）。→ 支撑「已知 CVE / 已知问题」检查 |
| 11 | GitHub Docs · REST API endpoints for repositories（API 2022-11-28） | https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28 | 2026-10-27 | 活跃度数据 | 仓库 REST 端点提供仓库元数据与活跃度字段（如 `pushed_at`、`stargazers_count`、`open_issues_count`）及 `license` 信息，可用于候选项目活跃度与许可证初筛。→ 支撑「活跃度评估维度」 |

### 6.2 借鉴决策表（采用 / 调整 / 不采用 + 理由）

| 借鉴点 | 来源 | 决策 | 理由 | 落点 |
|---|---|---|---|---|
| 调研贯穿各阶段、竞争分析用于探索期 | #1 | **采用** | 产品/设计阶段正缺「先看别人怎么做」；与「不熟悉功能先调研」一致 | 01-product / 02-design 手册 + product/design 提示词 |
| PRD 结构（目标/功能+用例/UX 说明/环境/约束依赖） | #2 | **采用（裁剪）** | 结构成熟可复用；裁剪掉与本仓库交付无关的重型字段（如完整 MRD 联动） | requirements.md 模板 + 01-product |
| 正文 4.5:1、大字 3:1 对比度 | #3 | **采用** | WCAG AA 可量化、可自动/人工检查，直接解决「好看无从判定」 | 02-design 硬标准 + design 提示词 + 评分表 |
| 触控目标 44×44 CSS px | #4 | **采用为下限** | WCAG 2.5.5 有明确像素值；与 Material 48dp 建议兼容（取更严格的落地建议 48） | 02-design 状态/尺寸标准 |
| 8dp 基线网格、4dp 图标网格、16dp 边距 | #5 | **采用** | 4/8px 体系工程实现简单、评审可检查 | 02-design 间距/布局标准 |
| 用 SPDX 短标识统一许可证命名 | #6 | **采用** | 避免 MIT/Apache/BSD 等写法不一致，便于矩阵与 selftest grep | 03-engineering 许可证矩阵 |
| MIT 宽松 / GPL 传染 / 无许可证不可用 | #7 | **采用** | 对应「可借鉴 / 禁止复制」的分级；无许可证默认禁止复制 | 03-engineering SOP + development 提示词 |
| evaluator-optimizer + human checkpoints | #8 | **采用（映射为双复核）** | acceptance 是 evaluator（给建议），approval 是 human checkpoint（拍板）；已有结构直接复用 | acceptance 提示词与复核清单 |
| 简单可组合、工具文档化 | #8 | **采用** | 本轮只加提示词与手册，不引入框架/依赖，符合「不新增运行时依赖」 | 设计约束（§3.2） |
| npm audit 依赖漏洞扫描 | #9 | **采用** | npm 生态标准命令，无需新依赖；作为新增依赖前置检查 | 03-engineering 安全步骤 |
| OSV / GitHub Advisory 查询已知漏洞 | #10 | **采用** | 覆盖面比单一工具广，可作为 audit 的补充 | 03-engineering「已知问题/CVE」列 |
| GitHub REST 活跃度字段 | #11 | **采用（人工 + 文档化）** | 本仓库不做联网服务，agent 用 web_fetch 读取公开页面/API 即可；字段明确可写进模板 | engineering-research.md 模板 |
| 强制绑定某一设计系统（Material 3 全套 / Apple HIG 全套） | #5 等 | **不采用** | 会锁死品牌与实现、引入不必要迁移成本；只借鉴通用规则，不绑定组件库 | — |
| 全局强制 7:1（WCAG AAA 对比度增强） | #3 延伸 | **不采用（本轮）** | 作为全局硬门槛成本高、会挤压品牌色；先以 AA（4.5:1/3:1）为门槛，7:1 作为可选加分 | 评分说明 |
| 每个阶段都做完整用户研究 | #1 延伸 | **不采用** | 与 1 人公司+Agent 节奏不匹配；本轮只要求 product ≥3、design ≥2、dev ≥2 候选的**轻量调研** | — |
| 完整照搬 PRD 全模板字段 | #2 延伸 | **不采用** | 模板过重会拖慢交付；采用与验收相关的子集，其余按需 | — |
| 把「来源数量」等同于质量 | 自研（无来源） | **不采用** | 数量只是下限；必须给关键结论与决策，否则视为未调研 | 验收项与复核检查 |

### 6.3 已验证模式 vs 创新假设

- **已验证模式（有来源支撑）**：WCAG 4.5:1/3:1 与 44×44 触控目标；Material 8dp/4dp 网格与 48dp 建议；SPDX 标识与许可证分级（MIT/Apache/BSD/ISC 宽松、GPL/AGPL 传染、无许可证不可用）；PRD 基本结构；调研方法与竞争分析；Agent 的 evaluator-optimizer + human checkpoint；npm audit / OSV 作为依赖安全手段。
- **创新假设（本项目自研，需在交付中验证）**：
  1. 把「调研来源数量」写成阶段硬门槛（product ≥3、design ≥2、dev ≥2 候选）并作为 acceptance 复核项——来源数量与质量之间的相关性需在后续复盘中验证；
  2. 「借鉴决策表」字段设计（借鉴点/来源/采用·调整·不采用/理由/对应验收项）——是否足够驱动决策，需要在真实需求中试用；
  3. 设计自检评分五维（视觉层级/清晰度/一致性/反馈/可访问性，1–5 分）——评分主观性需靠对比度/状态矩阵等客观项校准；
  4. 在 1 人公司 + Agent 团队场景下「轻量调研」是否足够——若出现明显误判，下轮再提高门槛；
  5. 无网络时标 `blocked` 而不阻断交付的策略——需验证是否会拖延，必要时允许「先内网调研 + 后续补外部来源」但需记录缺口。

### 6.4 调研对需求的影响

- 把「调研」从口号变成**可检索的来源表 + 决策表**（来自 #1/#2/#8），因此验收项要求文档中能 grep 到来源与决策；
- 对比度/触控/网格/状态等硬标准全部**引用公开标准**（#3/#4/#5），验收可量化；
- 许可证分级与「无许可证禁止复制」直接来自 #6/#7，写入 development 提示词与手册；
- 活跃度与已知漏洞检查采用 #9/#10/#11，形成 engineering-research.md 的固定列。

### 6.5 未采用/抓取失败的来源（诚实披露）

| URL | 结果 | 处理 |
|---|---|---|
| https://en.wikipedia.org/wiki/Product_requirements_document | 抓取失败：域名解析到非公网 IP，被 Host 拒绝 | 未采用，不用作证据；PRD 依据改用 #2 |
| https://www.carbondesignsystem.com/elements/spacing/overview/ | 抓取失败：跨域重定向后 fetch failed | 未采用；间距依据改用 #5（Material） |
| https://owasp.org/Top10/ | 未跟随跨域重定向，抓取失败 | 未采用；安全依据改用 #9/#10 |
| https://www.atlassian.com/software/confluence/templates/product-requirements | HTTP 200，但正文被截断，未取得可引用结论 | 未采用；PRD 依据改用 #2 |

> 结论：网络可用，调研来源 ≥3（实际 11 个可引用来源，全部记录了 URL + 访问日期 + 关键结论）；不存在「无网络」导致的 `blocked`。以上失败项已如实标注，不影响本需求的主要结论。

## 7. 验收标准（对照需求 8 条 + 可验证方式）

| # | 结论式验收点 | 可验证方式（命令/文件/关键词） |
|---|---|---|
| 1 | 四个阶段提示词与 systemPrompt 含调研/质量/许可证/安全要求，`pipeline_stage_prompt` 可检索 | `grep -n "调研\|借鉴\|web_search\|许可证\|安全\|对比度\|状态矩阵\|engineering-research" dsh-web-filebrowser-plugin/pipeline.js` 命中 `STAGE_GUIDES` 的 product/design/development/acceptance 与 `PIPELINE_SECTION`；调用 `pipeline_stage_prompt({stageId:'product'/'design'/'development'/'acceptance'})` 在输出中 grep 到对应关键词 |
| 2 | 01-product.md 新增调研与借鉴 SOP | `grep -n "调研与借鉴\|借鉴决策表\|已验证模式\|创新假设\|反抄袭\|web_search\|blocked" docs/opc/01-product.md` 全部命中；含来源格式与决策表模板 |
| 3 | 02-design.md 新增专业设计质量标准 | `grep -n "4/8\|4px\|8px\|对比度\|4.5:1\|44\|状态矩阵\|360\|768\|1280\|150–300ms\|ARIA\|自检\|迭代" docs/opc/02-design.md` 命中；含 tokens/状态/响应式/动效/A11y/评分要求 |
| 4 | 03-engineering.md 新增开源调研与安全复用 SOP | `grep -n "开源调研\|engineering-research.md\|许可证\|SPDX\|MIT\|Apache\|GPL\|AGPL\|npm audit\|OSV\|CVE\|性能预算\|活跃度" docs/opc/03-engineering.md` 命中；含候选对比表与许可证矩阵模板 |
| 5 | AGENT_TEAM/PLAYBOOK/README 同步；ACCEPTANCE 批次 11；CHANGELOG 1.2.73；两个 package.json 1.2.73 | 三个文档 grep 到三 Agent 新职责/步骤；`grep -n "批次 11" docs/ACCEPTANCE.md`；`grep -n "1.2.73" CHANGELOG.md`；`node -e "require('./package.json').version"` 与插件 package.json 均为 `1.2.73` |
| 6 | `npm run check`、`npm test`、pipeline-selftest 全绿且覆盖新关键词/handbook 引用，无回归 | 依次执行并记录退出码：`npm run check`、`npm test`、`node .dsh/tmp/team/pipeline-selftest.mjs`；selftest 断言含新提示词关键词与 `docs/opc/05-review.md` 等 handbook 路径 |
| 7 | 七阶段双复核完整跑通，acceptance 复核报告结论为「建议放行」 | `pipeline_status` 七关状态齐全；存在 `docs/pipeline/acceptance-review.md` 且结论段含「建议放行」；报告含三项新增复核（需求调研证据/设计质量/开发许可证）及 N/A 理由说明 |
| 8 | 无新增运行时依赖；无伪造来源；文档无死链 | `git diff package.json dsh-web-filebrowser-plugin/package.json` 无 `dependencies` 新增；requirements.md 中所有引用 URL 与 §6.1 表一致且可访问（抽查 3 条 `curl -o /dev/null -w "%{http_code}"` 或 Host fetch）；文档内相对链接可解析，无 404/死链 |

## 8. 优先级与交付物

- **P0**：三份手册新增章节与模板；四个阶段提示词 + PIPELINE_SECTION；acceptance 新增三项检查；测试全绿；版本与记录一致。
- **P1**：AGENT_TEAM/PLAYBOOK/README/locale 同步；ACCEPTANCE 批次 11；双复核跑通报告。
- **交付物路径**：`dsh-web-filebrowser-plugin/pipeline.js`；`docs/opc/01-product.md`、`02-design.md`、`03-engineering.md`（必要时 `README.md`、`00-charter.md`）；`docs/AGENT_TEAM.md`、`docs/PLAYBOOK.md`、`README.md`、`README.zh.md`、`dsh-web-filebrowser-plugin/README.md`、`dsh-web-filebrowser-plugin/locale/*.json`；`docs/ACCEPTANCE.md`、`CHANGELOG.md`、两个 `package.json`；测试脚本 `scripts/selftest/host-smoke.mjs` 与 `.dsh/tmp/team/pipeline-selftest.mjs`。
- **本轮验证路径**：读三份手册新章节 → 读提示词关键词 → 跑三条测试命令 → 走一遍七阶段（fast 模式）→ 看 `docs/pipeline/acceptance-review.md` 结论。

## 9. 风险与未决问题

| 风险/未决 | 影响 | 应对 |
|---|---|---|
| 调研在本环境可能无法联网（本轮已验证可用） | 无来源 → 需求不可信 | 已实际抓取 11 个来源并记录；后续轮次无网时标 `blocked`，不伪造 |
| 提示词增长导致阶段提示词过长 | 模型忽略关键检查点 | 关键词前置、分条列点；selftest 断言关键词存在；必要时压缩为「必做清单」 |
| 硬标准过多导致设计与验收过重 | 拖慢小需求交付 | 区分「must（对比度/44px/状态/响应式）」与「should（48dp/动效/全部八态）」；评分表按 must 项一票否决 |
| 「来源数量」被机械满足 | 记录链接但无结论 | 决策表要求每行绑定来源+理由+对应验收项；无结论视为未调研 |
| 许可证矩阵误判（尤其 MPL/LGPL/无许可证） | 合规风险 | 不确定时默认「禁止复制」并升级 Lead 决策；SPDX 标识统一记录 |
| 新增检查让 acceptance 复核范围过大 | 复核耗时/遗漏 | 三项检查固定为「有/无/不适用+理由」，不替代原有清单核对 |
| 本轮只改文档不改功能 → 双复核跑通缺少「真实证据」 | 验收结论偏形式 | acceptance 复核要求逐项给文件/命令证据，N/A 必须写理由；本需求自身的调研记录作为证据 |
| 文档多处同步（AGENT_TEAM/PLAYBOOK/README/locale）易漏 | 文案不一致 | 用统一关键词清单 grep 核对；验收项 #5 覆盖 |

## 10. 未决问题（需 Owner/Lead 拍板）

1. 设计自检评分的分值权重与「must 项一票否决」是否要固定成模板？——建议先按 §4.2 五维 1–5 分 + must 项清单执行，下一轮复盘再固化权重。
2. 调研来源数量门槛（product ≥3 / design ≥2 / dev ≥2 候选）是否需要按需求规模分档？——建议本版本固定下限，小需求可复用团队既有来源但要记录。
3. 本轮「不适用」的 engineering-research 是否要求 acceptance 复核在报告中显式写 N/A？——建议写，并在批次 11 复测步骤中体现。
4. 是否允许把调研来源放入 `docs/pipeline/` 单独文件（如 `research.md`）？——建议默认写进 requirements/design 文档内，避免文件碎片化；大调研可另附并引用。
