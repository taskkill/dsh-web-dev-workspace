# 需求：七阶段双复核模式 —— 新增项目经理 Agent「验收复核」关（v1.2.72）

- 提出人：Owner（项目经理/你）；日期：2026-10-26；优先级：P0；目标版本：**v1.2.72**。
- 本文只做需求分析与可验收化，不改变 `.dsh/pipeline.json` 中的需求本身；范围、约束与验收标准以本文 + 需求详情为准。
- 一句话：「在测试通过之后、Owner 人工确认之前，增加一关 AI 项目经理的**项目级验收复核**，AI 复核 + 人工确认 = 双复核，不让没达标的东西进到发布关。」

## 1. 背景与问题

当前流水线是六阶段：product（产品经理）→ design（UI 设计师）→ development（全栈开发）→ testing（测试工程师）→ approval（项目经理人工确认）→ release（运维发布）。Owner 只在最后确认。

问题出在「测试结论」与「验收清单」之间缺少一个独立的项目级复核环节：

1. **测试阶段只对「测了什么」负责，不对「需求是否被完整覆盖」负责**。QA 回填 `pass` 的验收项，可能与需求范围点存在遗漏、部分覆盖或超范围改动，但没有角色被要求逐项对照需求复核。
2. **Owner 在 approval 关被迫自己做全量复核**：要同时看验收清单状态、证据、测试报告、Git 变更与已审标记、DoD，信息量大、耗时且容易漏；Owner 变成唯一瓶颈。
3. **放行/打回没有书面依据**：没有一份可追溯的复核报告，责任链、证据、结论都散落在对话里，打回后也难说清回退到哪一关。
4. 不做的后果：带病交付、客户侧返工、Owner 对交付质量没有系统性信心。

解法（**双复核模式**）：新设一名 **项目经理 Agent**，负责第 5 关 `acceptance`「验收复核」；它在测试通过后独立核对并给出「建议放行 / 建议打回」的书面结论。随后仍是第 6 关 `approval`「人工确认」——**只有 Owner 在面板通过后，第 7 关 release 才允许启动**。AI 复核负责「查全、查实、留证据」，Owner 负责「拍板」。

## 2. 目标用户与核心场景

| 用户 | 场景 | 期望结果 |
|---|---|---|
| **Owner（你）** | normal 模式：testing 通过 → acceptance 复核 → approval 确认 | 在人工确认关只看复核报告结论 + 关键证据即可决定通过/打回，不用自己逐项翻清单 |
| **Owner（你）** | fast 模式：中间五阶段自动推进 | 只在 approval（人工确认）与 release（发布）两个闸门出现；错误/未达标时仍能看到复核报告并打回 |
| **项目经理 Agent（新增角色）** | testing 已 approved、acceptance 处于 active | 按 `docs/opc/05-review.md` 逐项复核需求覆盖、验收清单与证据、测试报告与复测、Git 变更与已审、DoD，产出 `docs/pipeline/acceptance-review.md` 并提交「建议放行/建议打回」 |
| **Lead（编排者）** | 需要把验收复核派给一个队友 | `pipeline_dispatch({stageId:'acceptance'})` 直接返回带角色边界、交付物和 `docs/opc/05-review.md` 手册的 spawn/teamTask 参数 |
| **开发 / 测试 / 运维** | 复核结论出来后 | 开发/测试按打回意见修复并复测；运维只在 approval 通过后发布，不重复验收、不重做审批 |

**核心场景（端到端）**：测试通过并回填验收清单 → 启动 `acceptance` → 项目经理 Agent 逐项复核并写报告（发现阻断则 summary 明确「建议打回」）→ 提交评审 → normal 模式 Owner 通过/打回；fast 模式自动通过并推进到 `approval` → Owner 人工确认 → 运维在 release 记录发布信息 → 交付。

## 3. 双复核模式定义（七阶段）

阶段顺序固定为 7 个，`PIPELINE_STAGES` 是唯一事实来源：

| # | 阶段 id | 名称 | 执行者（roleTitle） | 进入条件 | 通过后解锁 | 复核性质 |
|---|---|---|---|---|---|---|
| 1 | `product` | 需求分析 | 产品经理 | 需求已保存 | design | 工作阶段 |
| 2 | `design` | UI 设计 | UI 设计师 | product 已通过 | development | 工作阶段 |
| 3 | `development` | 开发实现 | 全栈开发 | design 已通过 | testing | 工作阶段 |
| 4 | `testing` | 测试验收 | 测试工程师 | development 已通过 | acceptance | 工作阶段 |
| 5 | **`acceptance`** | **验收复核** | **项目经理 Agent**（`project-manager-agent`） | testing 已通过 | approval | **双复核第一关（AI 复核，给建议）** |
| 6 | **`approval`** | **人工确认** | **项目经理（你，Owner）** | acceptance 已通过 | release | **双复核第二关（人工拍板）** |
| 7 | `release` | 发布上线 | 运维 | approval 已通过 | 记录发布信息 | 执行阶段 |

**状态机**（每关一致）：`pending`（待开始）→ `active`（进行中）→ `review`（待评审）→ `approved`（已通过）；`review` 被打回变为 `failed`，修复后用 `pipeline_start_stage` 重新开始（`failed` 重新开始会保留打回备注）。只有 `pending`/`failed` 能 start；只有 `active` 能 submit；只有 `review`（approval 可在 `active`）能审批。

**闸门规则**：

- **normal（普通模式）**：每个阶段提交后进入 `review`，由 Owner 在面板通过/打回；`acceptance` 可以提交「建议放行」，但**不能自己审批**，是否放行由 Owner 在 acceptance 关（或打回后可回退到 development/testing）决定。
- **fast（快速模式）**：五个中间阶段（`product`/`design`/`development`/`testing`/`acceptance`）提交后自动通过并返回 `autoApproved=true` + `nextStageId`，agent 可直接继续下一关；**`approval` 与 `release` 永远保持人工闸门，任何模式下都不自动通过**。
- **双复核点**：第 5 关 AI 复核（查全、查实、留证据、给建议）+ 第 6 关 Owner 确认（最终决定）；两道关都过，`release` 才能启动。
- **模型无审批工具（铁律）**：任何模式下 agent 都不能审批；`acceptance` 关只能 `pipeline_submit_stage`，approval/release 只能由 Owner 在面板操作。

**相对旧六阶段的差异**：新增 `acceptance` 插在 `testing` 与 `approval` 之间；`approval` 的 `roleTitle` 由「项目经理」细化为「项目经理（你）」，`title` 保持「人工确认」。客户端、systemPrompt、工具描述、文档中的「六阶段」全部改为「七阶段/双复核」。

## 4. 第 5 关「验收复核」角色边界

### 4.1 只做什么

1. 逐项核对 **需求覆盖**：把需求目标/范围点映射到验收项或测试用例，标出覆盖/部分覆盖/未覆盖/超范围改动。
2. 核对 **验收清单**：`acceptance_list` + `acceptance_report` 每条 title/requirement/status/note/evidence/retestRound；统计 pass/fail/blocked/pending/缺证据，列出所有阻断项。
3. 核对 **测试报告与复测**：`docs/pipeline/test-report.md`、测试阶段 summary/artifacts；用 `task_detect`/`task_run` 重跑与测试阶段一致的关键命令，记录命令、退出码、耗时与输出末尾。
4. 核对 **Git 变更与已审**：变更文件清单、已审 n/N（`.dsh/review.json`）、关键文件（入口/配置/依赖/发布脚本）diff；发现未审关键文件、调试代码、临时文件、密钥风险即列阻断。
5. 核对 **DoD**：对照宪章 §6 七项（验收清单、测试报告、变更审阅、文档、发布、交付、Owner 最终确认）逐项打勾，写明未完成项及应由哪一关补齐。
6. 产出 **`docs/pipeline/acceptance-review.md`**：复核基线、逐项核对表、复测证据、变更复核、DoD 检查、结论（建议放行/建议打回 + 阻断项 + 建议回退阶段）。
7. 需要时为关键验收项用 `acceptance_evidence_add` **追加**证据路径（只追加，不改进度与历史）。
8. 发现阻断问题时，在提交评审的 summary 中明确写「**建议打回**」、阻断项、复现步骤与建议回退阶段。

### 4.2 不做什么

- 不改业务代码、不改需求/设计/验收标准、不重写测试用例；不回填 `acceptance` 的 pass/fail（状态由测试阶段维护）。
- 不审批任何阶段、不自批、不发布；不代替 Owner 在 approval 关做决定。
- 不伪造或挪用证据；不得在未复测/有 fail/blocked 的情况下建议放行（「带病放行」即失败）。
- 不删除或篡改已有验收项、证据与历史记录；不跳过复测直接沿用旧结论。

### 4.3 输入

- **流水线状态**：`pipeline_status`（需求、七关状态、当前阶段、上游 summary/artifacts）；`pipeline_stage_prompt({stageId:'acceptance'})`（角色边界、交付物、闸门规则）。
- **需求与范围**：`.dsh/pipeline.json` 的需求标题/详情、`docs/pipeline/requirements.md`。
- **验收清单**：`acceptance_list`、`acceptance_report`（含证据附录与「证据缺口」小节）、`.dsh/acceptance.json` 复测历史。
- **测试结论**：`docs/pipeline/test-report.md`、testing 阶段 summary/artifacts、最近任务运行记录（`task_list`/`task_output`）。
- **变更与审阅**：Git 变更列表与 diff、`.dsh/review.json` 的已审标记。
- **设计与证据**：`docs/pipeline/design.md` 与设计资源（涉及 UI 时）、`.dsh/evidence/`、已有发布记录（如有）。
- **DoD**：`docs/opc/00-charter.md` §6 七项质量门槛。

### 4.4 交付物

- **`docs/pipeline/acceptance-review.md`**（必需，固定结构）：① 基线与复核人；② 需求覆盖表；③ 验收清单逐项核对表 + 统计；④ 复测记录（命令/退出码/耗时）；⑤ 变更与审阅；⑥ DoD 检查；⑦ 放行建议（含阻断项与建议回退阶段）。
- **提交评审**：`pipeline_submit_stage({stageId:'acceptance', summary, artifacts:[{path:'docs/pipeline/acceptance-review.md',label:'验收复核报告'}, ...关键证据]})`；summary 必须含结论（建议放行/建议打回）、阻断项数量、复测结果。
- **可选证据**：关键验收项的截图/日志/报告路径（`acceptance_evidence_add`）。

### 4.5 与 approval、release 的闸门关系

| 关系 | 规则 |
|---|---|
| testing → acceptance | `testing` 必须 `approved` 才能 `pipeline_start_stage({stageId:'acceptance'})`；跳关报 `bad-order` 拒绝 |
| acceptance → approval | `acceptance` 通过后 `approval` 才解锁；normal 模式需 Owner 在 acceptance 关通过（或接受建议），fast 模式自动通过并返回 `nextStageId='approval'` |
| acceptance 与 approval 的职责区分 | acceptance 是**建议**（查全/查实/留证据），approval 是**决定**（Owner 拍板）；acceptance 报告是 approval 的输入，不能替代 Owner 确认 |
| acceptance → release | `release` 永远不能绕过 acceptance；即使旧文档迁移后 acceptance 已是 approved，也仅代表「升级前旧流程已完成」，不表示新流程重新复核过 |
| approval → release | `approval` 必须由 Owner 通过；`reviewStage(approve)` 批准 release 时还会二次校验 `approval.status === 'approved'`；fast 模式也不会自动通过这两关 |

## 5. 范围

### 5.1 做什么

1. **Host 流水线（`dsh-web-filebrowser-plugin/pipeline.js`）**
   - `PIPELINE_STAGES` 扩为 7 个并新增 `{ id:'acceptance', role:'project-manager-agent', roleTitle:'项目经理 Agent', title:'验收复核' }`；approval 的 `roleTitle` 改为「项目经理（你）」，`title` 保持「人工确认」。
   - `STAGE_GUIDES` 新增 acceptance 使命/只做什么/不做什么/交付物；approval 提示词改为「在 AI 验收复核之后由 Owner 最终确认，模型不能审批」。
   - `STAGE_HANDBOOKS`：acceptance → `docs/opc/05-review.md` + `docs/opc/00-charter.md`；release → `docs/opc/06-ops.md`（原 `05-ops.md` 改名）。
   - `PIPELINE_SECTION`（systemPrompt）与 `pipeline_dispatch` / `pipeline_status` / `pipeline_submit_stage` / `pipeline_start_stage` 等工具描述改为 7 阶段、双复核、fast 模式「五个中间阶段自动通过，approval/release 永远人工」，stageId 枚举补 `acceptance`。
   - `CHANGE_SKIP_STAGES` 与迁移逻辑按 §6 更新；生成给 Owner 的流水线摘要/计数同步 7 关。
2. **客户端（`dsh-web-filebrowser-plugin/client.js` + `locale/zh.json`、`locale/en.json`）**
   - 流水线视图/工作台显示 7 关；stageTitles/roleLabels 增加 acceptance（验收复核 / 项目经理 Agent），approval 显示「人工确认 / 项目经理（你）」。
   - 中英文文案：快速模式提示改为「中间五阶段自动通过，只有人工确认与发布需要你」；approvalReady、pipeline.hint、工作台流程/范围 hint、需求与调整范围说明同步；验收复核卡支持「启动并派发」、normal 模式通过/打回；release 表单保留。
   - 所有依赖阶段数量的默认值（如 `stages.length === 0 ? 6 : ...`）更新为 7；无「六阶段」残留（历史 CHANGELOG 除外）。
3. **团队与文档**：`docs/AGENT_TEAM.md` 角色表/阶段表/流程/数据表；`docs/PLAYBOOK.md` 插入「⑥ 验收复核」并重排编号；`docs/opc/05-review.md` 新增、`05-ops.md` → `06-ops.md` 改名并更新全部引用；`docs/opc/README.md`、`00-charter.md` 组织表/RACI/DoD/七阶段节奏同步；`README.md`、`README.zh.md`、插件 README、locale 插件描述改为「七阶段双复核」。
4. **版本与记录**：`CHANGELOG.md` 新增 `## 1.2.72 — 2026-10-26`（英文，含双复核、迁移、测试）；根 `package.json` 与 `dsh-web-filebrowser-plugin/package.json` 对齐 **1.2.72**；`docs/ACCEPTANCE.md` 新增「批次 10 · 双复核模式（v1.2.72）」复测步骤。
5. **测试**：`npm run check`（全模块语法）、`npm test`（`scripts/selftest/host-smoke.mjs` 扩展 7 阶段/迁移/变更 scope/快速模式）、`.dsh/tmp/team/pipeline-selftest.mjs` 扩展（顺序与跳关拒绝、acceptance 提示词与 dispatch、fast 自动通过、approval/release 人工、旧文档迁移全 pending/进行中/已完成、变更轮 scope、工具文案）。

### 5.2 不做什么

- 不新增依赖、不改 Harness 核心、不在插件内实现多 Agent 运行时（团队执行仍用 Agent Teams 原生能力）。
- 不改变验收/交付/待办/记忆等既有存储语义与数据格式（只做向后兼容的增量）。
- 不自动审批 `approval`/`release`，不把 AI 复核结论等同于人工放行；不在 release 关执行真实发布动作（发布由运维按流程完成）。
- 不做整站视觉改版，沿用现有卡片/面板样式；不改历史 CHANGELOG 与历史版本号。
- 不删除旧六阶段迁移信息；不改动已完成项目的既有结论（只补 acceptance 迁移备注）。

## 6. 兼容与迁移要求

### 6.1 旧 6 阶段 `.dsh/pipeline.json` 迁移（三情形）

| 旧文档状态 | 迁移后 | 约束 |
|---|---|---|
| **全 pending**（刚立项未开工） | 按 id 归一化补 `acceptance: pending`，插入在 testing 与 approval 之间；其余阶段状态不变 | 迁移幂等；不重复插入；未知字段保留；顺序固定 |
| **进行中**（部分 active/review/approved） | 补 `acceptance: pending`；进行中阶段保持 active/review；按新顺序继续（testing 通过后先走 acceptance） | 不允许绕过 acceptance 启动 approval/release；release 启动前仍要求 approval approved |
| **旧已完成**（approval 或 release 已 approved） | `acceptance` 迁移为 `approved`，并在 note 记「升级迁移：验收复核为更新新增，旧流程已完成」 | 不把已完成项目误判为未完成；迁移备注要能在报告中看到，表明不代表新流程重新复核 |

- 读取时按 id 归一化（`readPipeline`），写回仍走原子 temp+rename + 进程内锁；迁移只补结构，不改需求/摘要/产物/发布记录。

### 6.2 变更轮 scope

| 变更范围 | 跳过阶段 | acceptance 行为 |
|---|---|---|
| `full` | 无 | 执行 acceptance（完整七关） |
| `development` | `product`、`design` | 执行 development/testing/**acceptance**/approval/release |
| `release` | `product`、`design`、`development`、`testing`、`acceptance` | 不执行 acceptance，跳过原因写入 note；仍要求 approval 已通过 |
| `product` / `design` / `product-design` | 按原语义（分别跳过后续实现与闸门；product-design 跳过 development/testing/**acceptance**/approval/release） | 跳过 acceptance 及其后阶段，本轮在需求/设计重做后结束 |

### 6.3 快速模式（gateMode=fast）

- `acceptance` 与其它中间阶段一致：提交后自动通过、返回 `nextStageId='approval'`。
- `approval`、`release` 在任何模式下都不自动通过；`approval` 未通过时不能 start release。
- 快速模式切换不回退已 approved 的阶段，只影响之后提交的阶段。

### 6.4 其它兼容约束

- 模型工具仍**没有任何审批工具**：acceptance 只能提交评审；approval/release 只能由 Owner 在面板操作。
- `.dsh/` 运行状态不进 Git；文档与代码随版本提交；SSH 远程工作区不支持流水线/验收（沿用现状并在提示中说明）。

## 7. 验收标准（对照需求 9 条 + 可验证方式）

| # | 结论式验收点 | 可验证方式 | 关联 category |
|---|---|---|---|
| 1 | 流水线恰好 7 阶段且顺序固定；跳关启动一律被拒 | `pipeline_status` / 读取 7 个 stage id 顺序；对 testing 未过 start acceptance、acceptance 未过 start approval、approval 未过 start release 分别调用并确认 `bad-order` 拒绝 | `pipeline` |
| 2 | acceptance 角色为「项目经理 Agent」，提示词/dispatch 给全边界与 `docs/opc/05-review.md` 手册 | `pipeline_stage_prompt({stageId:'acceptance'})` 与 `pipeline_dispatch({stageId:'acceptance'})` 检查 roleTitle、只做什么/不做什么、交付物（复核报告+放行/打回建议）、handbooks 路径 | `pipeline` |
| 3 | normal 模式提交进入 review 且 Owner 可通过/打回；fast 自动通过并推进到 approval；approval/release 永不自动 | 切 normal 提交 acceptance 观察 `review`+owner 审批；切 fast 提交观察 `autoApproved=true,nextStageId='approval'`（以及 product→design 链）；对 approval/release 提交/审批路径确认仍需人工 | `pipeline` |
| 4 | 旧 6 阶段文档升级不报错，全 pending/进行中/旧已完成三种情形迁移正确 | 用三份旧格式 `.dsh/pipeline.json` 样本（全 pending、testing active、approval/release approved）运行迁移/selftest；检查补 acceptance、approved + 迁移备注、无绕过路径 | `migration` |
| 5 | 变更轮 scope 正确：full/development 执行 acceptance；release 跳过 acceptance；product/design/product-design 按原语义跳过 | `startChangeRound` 各 scope 后检查跳过阶段与 note；release scope 不能再走 acceptance；development scope 的 acceptance 可执行 | `migration` |
| 6 | 客户端中英文显示 7 关、新角色/标题/提示准确，复核卡可启动派发 | 刷新页面看流水线/工作台 7 关；切 en/zh 看 stageTitles/roleLabels/快速模式提示；acceptance 卡「启动并派发」与 normal 通过/打回可用；工作台无「六阶段」残留 | `client` |
| 7 | systemPrompt 与工具描述为 7 阶段且说明双复核；`pipeline_status` 显示 7 关与计数 | 读注入的 `PIPELINE_SECTION` 与工具 description；调用 `pipeline_status` 检查 7 行状态与计数 | `pipeline` |
| 8 | `npm run check`、`npm test`、`pipeline-selftest` 全绿，无回归 | 依次执行三条命令并记录退出码/末尾输出；selftest 覆盖阶段顺序、迁移、scope、fast 模式、提示词 | `test` |
| 9 | 文档与版本 1.2.72 一致齐全 | `grep`/人工核对 AGENT_TEAM、PLAYBOOK、opc（05-review 新增、06-ops 改名引用）、README/README.zh、CHANGELOG 1.2.72、ACCEPTANCE 批次 10；两个 `package.json` 版本均为 1.2.72；「六阶段」仅历史 CHANGELOG 允许出现 | `docs` |

优先级：第 1/3/4 条为 P0（闸门与迁移错误会破坏交付），其余 P0；文档/文案类为 P1 但本版本必须完成。

## 8. 优先级与交付物

- **P0**：7 阶段常量与顺序、acceptance 角色/提示词/handbook/dispatch、normal+fast 闸门（approval/release 永不自动）、旧文档迁移、变更轮 scope、测试全绿。
- **P1**：客户端 7 关与中英文文案、systemPrompt/工具描述、文档与版本一致性。
- **交付物路径**：`dsh-web-filebrowser-plugin/pipeline.js`、`client.js`、`locale/*.json`、`docs/AGENT_TEAM.md`、`docs/PLAYBOOK.md`、`docs/opc/05-review.md`、`docs/opc/06-ops.md`、`README*.md`、`CHANGELOG.md`、`docs/ACCEPTANCE.md`、两个 `package.json`；测试脚本 `scripts/selftest/host-smoke.mjs` 与 `.dsh/tmp/team/pipeline-selftest.mjs`。
- **Owner 验收路径**：重启 Harness（Host 改动生效）→ 刷新页面 → 流水线面板走一遍 normal 与 fast → 用旧 6 阶段样本验证迁移 → 按 `docs/ACCEPTANCE.md` 批次 10 逐条点击。

## 9. 风险与依赖

| 风险/依赖 | 影响 | 应对 |
|---|---|---|
| **Host 改动需重启 Harness 才生效**，客户端改动需刷新/重建 bundle | 不重启会看到旧六阶段行为，误判「实现失败」 | 实现与验证清单写清重启步骤；验收前重启 + 强制刷新；自动化只能覆盖静态语法与文件状态 |
| **UI 文案一致性**：客户端、systemPrompt、工具描述、README/opc 多处以「六阶段」表述 | 用户与 Agent 认知不一致，文档被判不一致 | 全仓 grep「六阶段/六关/6 stage」，除历史 CHANGELOG 外零残留；中英文双语同批修改 |
| **迁移边界**：旧已完成项目的 acceptance 迁移为 approved | 被误解为「新流程已复核」 | note 固定写「升级迁移：验收复核为更新新增，旧流程已完成」；文档与复核报告模板要求体现；不迁移历史摘要以外内容 |
| **fast 模式误自动通过 approval/release** | 绕过人工闸门（严重） | 代码条件显式排除 approval/release；selftest 与 host-smoke 双向覆盖；验收项第 3 条专测 |
| **角色越界**：验收复核改代码/改验收状态/自批 | 复核失去独立性，双复核失效 | SOP + 阶段提示词写死边界；模型无审批工具；验收项与测试覆盖 |
| **并发写冲突**：多 Agent 同时改 docs/代码 | 文件互相覆盖 | Lead 按 write scope 分工，每个任务声明写范围；提交前统一 diff 复核 |
| **依赖本机环境**：Node/npm 版本、selftest 依赖 `.dsh/tmp/team/` 样本 | 测试不可复现 | 在 README/ACCEPTANCE 标注命令与前提；selftest 自带样本生成，不依赖残留文件 |
| **旧客户端缓存** | 7 关不显示 | 构建后强制刷新/清缓存；交付记录写明版本号 v1.2.72 便于核对 |

## 10. 未决问题（需 Owner/Lead 拍板）

1. 旧已完成项目迁移后的 acceptance 是否需要在报告中用不同标注（当前用 note 文案区分），还是仅保留 note？——默认按 note 文案区分，不改状态语义。
2. normal 模式下 acceptance 被 Owner 打回时，默认回退到 development 还是 testing？——由复核结论「建议回退阶段」给出，Owner 在面板决定，不强制。
3. 历史文档（如旧版本 CHANGELOG、旧版本发布记录）中的「六阶段」是否允许保留？——允许（历史事实），但所有现行面向用户文档必须改为七阶段。
