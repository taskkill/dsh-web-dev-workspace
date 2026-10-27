> 归档：这是 v1.2.72（第 1 轮）的七阶段双复核 UI 设计说明，原路径 docs/pipeline/design.md 已在 v1.2.73 覆盖为「设计质量标准」。本轮设计稿仍保留在 docs/pipeline/design/ 下。

# 七阶段双复核模式 UI 设计说明 v1.2.72（2026-10-26）

> 角色：UI 设计师（`opc-design`）｜上游需求：[requirements.md](../requirements.md)｜下游：全栈开发实现。
> 范围：Dev Workspace 的**流水线视图**与**工作台**显示 7 关、新增第 5 关「验收复核」卡、第 6 关「人工确认」的视觉区分、中英文文案与响应式/无障碍规范。
> 一句话结论：**不新增页面、不改卡片结构、不新增组件**；在现有 `ds-pipe-*` / `ds-wb-*` 卡片上做「+1 关 + 2 个小标签 + 1 个备注色调 + 一批文案」，实现成本低、回归面小。

---

## 1. 页面清单与改造范围

| 页面 | 入口 | 用户动作 | 复用/改造/新增 | 设计稿 |
|---|---|---|---|---|
| 流水线视图（侧栏单列 7 卡） | 「更多 › 项目 › 流水线」、工作台「查看流水线」 | 启动/重派阶段、normal 模式通过/打回、查看产物、记发布 | **改造**：+1 张验收复核卡；acceptance/approval 各加 1 个小标签；备注色区分 | [seven-stage-normal.svg](seven-stage-normal.svg)、[seven-stage-fast.svg](seven-stage-fast.svg) |
| 工作台（Owner 首页） | 打开工作区默认落点 | 看进度、点「启动并派发」、审批、发起变更 | **改造**：进度 `done/7`、项目流程 7 步、流程角色/当前阶段文案 | [seven-stage-workbench.svg](seven-stage-workbench.svg) |
| 工作台「需求与调整」 | 工作台卡片 | 追加/修改需求、发起变更轮 | **文案**：六→七、范围 hint 增加验收复核/跳过说明 | 见第 7 节文案表 |
| 验收复核卡 5 态 | 流水线视图内 | 启动、等待提交、通过/打回、重派 | **改造**：新卡片的 5 种状态 | [acceptance-card-states.svg](acceptance-card-states.svg) |
| 插件卡片描述（locale meta） | 扩展/插件列表 | 阅读能力说明 | **文案**：六阶段 → 七阶段双复核 | 见第 7 节 |

**明确不做**：不改页面骨架与栅格、不新增路由/弹窗/图标/依赖、不新增大面积配色、不做整站视觉改版；验收复核报告是文本产物（`.md`），沿用现有「点开文件」交互，不做内嵌预览器。

---

## 2. 信息架构与双复核模型

### 2.1 七关顺序（与 `PIPELINE_STAGES` 一致）

| # | 阶段 id | 名称 | 角色 | 关性质 |
|---|---|---|---|---|
| 1 | `product` | 需求分析 | 产品经理 | 工作阶段 |
| 2 | `design` | UI 设计 | UI 设计师 | 工作阶段 |
| 3 | `development` | 开发实现 | 全栈开发 | 工作阶段 |
| 4 | `testing` | 测试验收 | 测试工程师 | 工作阶段 |
| 5 | **`acceptance`** | **验收复核** | **项目经理 Agent** | **双复核第一关（AI 复核，给建议）** |
| 6 | **`approval`** | **人工确认** | **项目经理（你）** | **双复核第二关（人工拍板）** |
| 7 | `release` | 发布上线 | 运维 | 执行阶段 |

- 双复核关系：**第 5 关 AI 查全/查实/留证据/给建议 → 第 6 关你拍板决定 → 第 7 关才可发布**。两关相邻、职责递进，任何模式下都不能跳过。
- fast 模式只对**中间五阶段**（1–5）的「提交」自动通过；第 6/7 关永远人工。fast 不改变「打回」语义：打回仍然进入 `failed`。
- 视觉上要一眼看出「AI 复核 ≠ 你确认」：第 5 关标签 `AI 复核`（信息蓝），第 6 关标签 `人工确认`（中性深色），角色名后缀区分 `项目经理 Agent` / `项目经理（你）`。

### 2.2 布局与入口（不变）

- **流水线视图**：右侧栏单列竖向卡片流（现有 `.ds-pipe-scroll`），7 张卡顺序排列；顶部仍是工具条 + 待办横幅 + 需求卡；底部仍是 `pipeline.hint` / `pipeline.roleHint`。宽度 260–420px 均可用。
- **工作台**：`项目状态` 卡显示「第 N 轮 · 已完成 x/7」，`项目流程` 卡横向 7 步（现有 `.ds-wb-steps` 横向滚动，不折行），`需要你处理` 卡显示「第 5/6 关待审批」，其余卡片不变。
- 两个视图的入口不动：侧栏「更多 › 项目 › 流水线」、工作台「查看流水线」/「查看流水线」按钮；移动端 compact 模式底部栏不变。

---

## 3. 卡片解剖

### 3.1 通用 7 关卡片结构（复用现有 DOM，仅第 5/6 关加标签）

```
┌───────────────────────────────────────────────┐
│ (5)  验收复核                     [待评审]     │  ← .ds-pipe-stage-head
│      项目经理 Agent  (AI 复核)                  │  ← .ds-pipe-stage-role + .ds-pipe-tag
│ 建议放行 · 阻断项 0 · 复测 3/3 通过              │  ← .ds-pipe-summary
│ [验收复核报告] docs/pipeline/acceptance-review.md│  ← .ds-pipe-artifacts
│ [通过] [打回]                                   │  ← .ds-pipe-actions
└───────────────────────────────────────────────┘
```

| 区域 | 类名（复用） | 内容 | 来源 | 设计说明 |
|---|---|---|---|---|
| 序号 | `.ds-pipe-index` | 1–7 圆形序号 | `index + 1` | 不变；7 关自然变成 1–7 |
| 标题 | `.ds-pipe-stage-title` | 阶段名 | locale `pipeline.stage.*` | 新增 acceptance 键 |
| 角色 | `.ds-pipe-stage-role` | 角色名 | locale `pipeline.role.*` | 新增 acceptance；approval 改为「项目经理（你）」 |
| 双复核标签 | **`.ds-pipe-tag`（新增最小样式）** | `AI 复核` / `人工确认` | locale `pipeline.tag.*` | 仅第 5/6 关；作为角色行内联子节点，不新增容器 |
| 状态 | `.ds-pipe-status` `data-status` | 待开始/进行中/待评审/已通过/已打回 | 阶段 `status` | 沿用 5 态与状态色 |
| 摘要 | `.ds-pipe-summary` | 阶段结论 | 阶段 `summary` | 验收复核摘要要求含结论三要素（见 3.2） |
| 备注 | `.ds-pipe-note` | 打回原因 / 跳过原因 / 快速模式自动通过 / 迁移说明 | 阶段 `note` | **新增 `data-tone`**：`failed` 用错误红（现状），其余用说明灰，避免「自动通过」被红字误读为失败 |
| 产物 | `.ds-pipe-artifacts` / `.ds-pipe-artifact` / `.ds-pipe-shot` | 报告链接、截图缩略图 | 阶段 `artifacts` | 文档按钮点击 `openFileAt`；图片走缩略图；外部链接 `↗` |
| 动作 | `.ds-pipe-actions` / `.ds-btn` | 启动并派发 / 发送角色提示 / 通过 / 打回 / 重新派发 | 阶段状态 | 完全复用现有按钮与逻辑 |
| 序列提示 | `.ds-pipe-seq-hint` | 「需上一阶段通过后才能启动。」 | 前序未通过时 | approval/release 未解锁时显示 |
| 人工确认提示 | `.ds-pipe-seq-hint`（新文案） | `pipeline.approvalReady` | acceptance 已通过且 approval 未开始/进行中 | 第 6 关专属，说明 AI 复核已完成、发布未解锁 |

### 3.2 第 5 关「验收复核」卡（新）

- **序号 5**、标题「验收复核」、角色「项目经理 Agent」、标签 `AI 复核`。
- **状态**：`pending`（待开始）/ `active`（进行中）/ `review`（待评审）/ `approved`（已通过）/ `failed`（已打回）。
- **摘要**（`summary`）由模型提交，设计上要求三要素，便于你 10 秒决策：
  1. 结论：`建议放行` / `建议打回`；
  2. 阻断项数量（0 时写 0）；
  3. 复测结果（如 `复测 3/3 通过`）。
  示例：`建议放行 · 阻断项 0 · 复测 3/3 通过（npm test / pipeline-selftest）`。
- **产物**：固定第一项 `docs/pipeline/acceptance-review.md`（label「验收复核报告」），可点开；其后可跟关键证据（截图显示为缩略图）。
- **动作**：
  - `pending`（testing 已通过）→「启动并派发」；
  - `active` →「发送角色提示」+「等待 agent 提交评审…」；
  - `review`（normal）→「通过」「打回」（打回备注写原因与建议回退阶段）；
  - `failed` →「重新派发」（保留上次备注）；
  - `approved`（fast/通过）→ `✓ 已通过`，无动作。
- **fast 特例**：提交即 `approved`，备注显示「快速模式自动通过」；不得显示红色错误样式。
- **迁移特例**：旧 6 阶段已完成项目迁移为 `approved` + 备注「升级迁移：验收复核为更新新增，旧流程已完成」，以说明灰展示，**不要**将其表达为「新流程已复核」。

### 3.3 第 6 关「人工确认」卡（与第 5 关的差异）

- 标题「人工确认」、角色「项目经理（你）」、标签 `人工确认`；`roleTitle`/locale 与 Host `PIPELINE_STAGES` 保持一致。
- **状态**：`pending` / `active` / `review` / `approved` / `failed`。
  - `pending`（acceptance 已通过）→「启动并派发」；
  - `active`（你已开始确认）→ 卡片动作仍是「发送角色提示」；**真正的通过/打回在顶部待办横幅**（现状逻辑），同时卡片下显示 `approvalReady` 提示；
  - `review`（少见）→ 卡片内「通过」「打回」；
  - `approved` → `✓ 已通过`，第 7 关解锁；`failed` → 重新派发。
- **永不自动通过**：fast 模式下第 6 关仍停在 `pending`/`active` 等你；`approvalReady` 与顶部横幅文案必须明确「发布未解锁」。
- **备注色调**：`failed` 红；其余说明灰；不新增图标。

### 3.4 第 7 关「发布上线」卡（仅锁定关系变化）

- 解锁条件由「approval 通过」决定，视觉不变：`pending` 时启动按钮禁用 + 序列提示；`active/review/approved` 时显示现有发布表单/发布记录。
- 第 6 关通过后，第 7 关卡片与发布表单自然出现；无需新样式。

### 3.5 工作台「项目流程」条

- 7 个 `.ds-wb-step`：序号/✓ + 阶段名 + 角色 + 状态 + 可选耗时/备注；横向滚动（`overflow-x: auto`），**不折行**。
- 第 5 步文案：`验收复核` / `项目经理 Agent`；第 6 步：`人工确认` / `项目经理（你）`；状态色沿用 `.ds-wb-step[data-status]`。
- 当前阶段摘要行（`.ds-wb-flow-now`）显示：`当前：验收复核 · 待评审 · 负责：项目经理 Agent`；进入第 6 关后变为 `当前：人工确认 · 进行中 · 负责：项目经理（你）`。
- 工作台流程条**不新增标签**（7 步空间紧、横向滚动宽度有限），角色名已能区分；双复核标签只在流水线卡出现，避免重复信息。

---

## 4. 状态矩阵

状态机（每关一致）：`pending → active → review → approved`；`review` 打回 → `failed`；`failed` 重新开始 → `active`（保留打回备注）。fast 只影响**提交后的自动通过**。

### 4.1 acceptance（第 5 关）

| 状态 | normal 模式 | fast 模式 | 视觉 | 动作 |
|---|---|---|---|---|
| `pending` 待开始 | testing 通过后出现，可启动 | 启动后提交前短暂停留（提交即通过） | 默认卡；`启动并派发` 可用 | 启动并派发 |
| `active` 进行中 | agent 正在逐项复核/写报告 | 同左 | 品牌色边框（深色描边） | 发送角色提示 + 等待提交 |
| `review` 待评审 | 报告已提交，等你通过/打回 | 不出现（直接 approved） | 警示色边框 + `待评审` | 通过 / 打回 + 备注 |
| `approved` 已通过 | 通过后解锁 approval | 自动通过 + `快速模式自动通过` 说明 | 成功色 ✓；备注说明灰 | 无 |
| `failed` 已打回 | 打回，回退 development/testing（按报告建议 + 你的备注） | 同左（reject 不自动） | 错误色边框 + 红备注 | 重新派发 |

### 4.2 approval（第 6 关）与 release（第 7 关）——两种模式相同

| 状态 | approval | release | 视觉/动作 |
|---|---|---|---|
| `pending` | acceptance 通过后解锁；正常/fast 都停在这里等你 | 未解锁（按钮禁用 + 序列提示） | 默认/锁定 |
| `active` | 你已开始确认；顶部横幅出现「通过/打回」+ 备注输入 | 发布表单（仅 approval 已通过后） | 品牌色边框 |
| `review` | 少见（agent 启动后提交）；同样走通过/打回 | 发布待审 | 警示色边框 |
| `approved` | 你确认通过 → release 解锁 | 发布记录可记 | 成功色 ✓ |
| `failed` | 你打回 → 回退 acceptance/development（按备注） | — | 错误色 + 备注 |

**互斥/顺序规则（UI 必须体现）**：`acceptance` 未 `approved` 时 `approval` 启动按钮禁用；`approval` 未 `approved` 时 `release` 启动按钮禁用；任何模式都不得出现 approval/release 被自动通过的视觉。

---

## 5. 两种关键状态设计稿

### 5.1 设计稿 A：normal 模式，验收复核待评审

**文件**：[design/seven-stage-normal.svg](seven-stage-normal.svg)（1280×1030，浅色主题）

场景数据（设计稿采用）：

| 阶段 | 状态 | 摘要/备注 |
|---|---|---|
| 1 需求分析 | 已通过 | 七阶段双复核需求说明，9 条验收点 |
| 2 UI 设计 | 已通过 | 设计说明 + 3 张 SVG 高保真稿 |
| 3 开发实现 | 已通过 | 7 阶段常量、迁移、闸门逻辑；npm test 通过 |
| 4 测试验收 | 已通过 | 42 项验收全 pass；测试报告已出 |
| **5 验收复核** | **待评审** | **建议放行 · 阻断项 0 · 复测 3/3 通过**；产物 `acceptance-review.md` |
| 6 人工确认 | 待开始（锁定） | 启动按钮禁用 +「需上一阶段通过后才能启动。」 |
| 7 发布上线 | 待开始（锁定） | 同上 |

界面表现（评审时逐项看）：
1. 顶部待办横幅：`第 5 关「验收复核」待你审批` + `通过` / `打回` + 备注输入 + 横幅提示；横幅底色为待审警示色。
2. 第 5 卡：`(5) 验收复核`、`项目经理 Agent`、`AI 复核` 标签、`待评审`、三要素摘要、可点开的复核报告、`通过/打回`。
3. 第 6 卡：`(6) 人工确认`、`项目经理（你）`、`人工确认` 标签、`待开始`、禁用的「启动并派发」+ 序列提示。
4. 第 7 卡：`(7) 发布上线`、`运维`、`待开始`、禁用 + 序列提示。
5. 右侧标注：双复核关系图（AI 建议 → 你决定 → 才可发布）、卡片要点、颜色图例。

### 5.2 设计稿 B：fast 模式，验收复核自动通过、人工确认待你拍板

**文件**：[design/seven-stage-fast.svg](seven-stage-fast.svg)（1280×1030，浅色主题）

场景数据：第 1–5 关均 `已通过`（第 5 关备注「快速模式自动通过」，说明灰），第 6 关 `进行中`（你已点「启动并派发」），第 7 关锁定。

界面表现（评审时逐项看）：
1. 工具条「快速模式」开关为勾选态（hover 显示 `pipeline.fastHint`）。
2. 顶部待办横幅：`第 6 关「人工确认」待你审批` + `通过` / `打回` + 备注输入；横幅提示仍为「你只需要点通过 / 打回……」。
3. 第 5 卡：`已通过` + `快速模式自动通过`（**说明灰**，不是红色）+ 复核报告仍可点开。
4. 第 6 卡：`进行中`、`人工确认` 标签、`approvalReady` 提示「AI 验收复核已完成；你确认通过后才会解锁发布阶段。」；卡片动作「发送角色提示」，等待文案改为「等待你确认（在顶部待办里通过/打回）」（建议，见第 10 节）。
5. 第 7 卡：仍锁定；fast 不会自动通过它。
6. 右侧标注：fast 规则（五中间阶段自动通过；人工确认与发布永远人工）、双复核关系图（第 5 关自动 ✓）、「只有人工确认与发布需要你」。

### 5.3 设计稿 C：验收复核卡 5 种状态

**文件**：[design/acceptance-card-states.svg](acceptance-card-states.svg)（1100×960）

逐状态给出卡片外观、触发条件、动作与文案；重点看 `review`（normal 主路径）与 `approved + 快速模式自动通过`（fast 主路径），以及 `failed` 的打回备注与「重新派发」。

### 5.4 设计稿 D：工作台 7 步流程条

**文件**：[design/seven-stage-workbench.svg](seven-stage-workbench.svg)（1100×560）

展示 `项目流程` 卡 7 步横向条、当前步骤摘要行「当前：验收复核 · 待评审 · 负责：项目经理 Agent」、`已完成 4/7` 进度；验证 7 步在 1080px 内容宽下的排布与横向滚动行为。

---

## 6. 交互流程

### 6.1 normal 模式（逐关审批）

1. `testing` 通过 → acceptance 变 `pending`（可启动），流水线顶部横幅 `下一步：启动「验收复核」`。
2. 你/Lead 点「启动并派发」→ acceptance `active`，卡片显示「进行中」+「发送角色提示」+「等待 agent 提交评审…」。
3. 项目经理 Agent 逐项复核并写 `docs/pipeline/acceptance-review.md` → `pipeline_submit_stage({stageId:'acceptance', summary, artifacts})`。
4. acceptance `review`：流水线顶部横幅变为 `第 5 关「验收复核」待你审批`（警示色），含通过/打回与备注；卡片同步出现通过/打回。
5. 你点「通过」→ acceptance `approved` → approval `pending`（解锁）；点「启动并派发」→ approval `active` → 顶部横幅 `第 6 关「人工确认」待你审批` → 你通过 → release 解锁。
6. 你点「打回」→ acceptance `failed` + 备注（写原因与建议回退阶段）→ 开发/测试修复 → acceptance 卡「重新派发」→ 回到步骤 2。默认回退到 development 还是 testing 由复核报告「建议回退阶段」+ 你的备注决定，UI 不预设。

### 6.2 fast 模式

1. 第 1–5 关提交后自动 `approved`（Host 返回 `autoApproved=true`，下一个是 approval）；acceptance 卡备注显示「快速模式自动通过」，且仍保留复核报告可查。
2. approval 保持 `pending`：你需点「启动并派发」→ `active`，顶部横幅出现「通过/打回」。
3. 你通过 → release 解锁；你打回 → approval `failed`，按备注回到 acceptance/development 修复。
4. fast 开关只影响之后的提交，不回退已 approved 阶段；任何阶段打回都不会被自动通过。

### 6.3 变更轮 scope 的显示

| scope | acceptance 显示 | 说明 |
|---|---|---|
| `full` | 正常执行 | 完整七关 |
| `development` | 正常执行 | 跳过需求/设计，开发→测试→**验收复核**→确认→发布 |
| `release` | `approved` + 跳过备注 | 本轮不执行 acceptance，注释「跳过：本次变更仅调整发布物」；approval 仍须已通过 |
| `product` / `design` / `product-design` | `approved` + 跳过备注 | 需求/设计重做后本轮结束；workbench 流程条显示「跳过」（现有 `note.startsWith('跳过')` 逻辑） |

跳过关的备注同样用**说明灰**，不显示为成功/失败。

### 6.4 迁移（旧 6 阶段数据）

- 全 `pending` / 进行中：验收复核补为 `pending`，流水线自然显示 7 卡，之后按新顺序执行。
- 旧已完成：acceptance 迁移为 `approved` + 迁移备注，以说明灰展示；`✓ 已通过` 仍显示，但备注明确「旧流程已完成，不代表新流程重新复核」。
- UI 不新增「迁移」徽标/弹窗；只靠备注文案。

### 6.5 空 / 加载 / 错误态（沿用）

- 流水线数据未加载（`stages.length === 0`）：沿用「读取流水线失败：—」提示；不做新占位。
- 保存中：`pipelineBusy` 时禁用按钮，工具条显示「保存中…」。
- 请求失败：顶部错误行 + 重试（现有 `pipelineError`）。
- 验收复核产物未登记：不显示产物区（不新增空态占位，避免噪音）；摘要为空时仅显示状态。

---

## 7. 中英文文案表

术语统一：**验收复核 / Acceptance review**、**人工确认 / Human sign-off**、**AI 复核 / AI review**、**双复核 / dual review**、**项目经理 Agent / Project manager agent**、**项目经理（你）/ Project manager (you)**。中文界面不出现「六阶段/六关」，英文不出现「six-stage」。

### 7.1 必需键（新增/变更）

| Key | 中文 | English | 用途/位置 |
|---|---|---|---|
| `pipeline.stage.acceptance` | 验收复核 | Acceptance review | 第 5 关卡标题；工作台流程步名 |
| `pipeline.role.acceptance` | 项目经理 Agent | Project manager agent | 第 5 关卡角色；工作台流程角色 |
| `pipeline.stage.approval` | 人工确认 | Human sign-off | **变更**：原「PM / 客户确认」→「人工确认」 |
| `pipeline.role.approval` | 项目经理（你） | Project manager (you) | **变更**：原「项目经理」→「项目经理（你）」 |
| `pipeline.fastHint` | 中间五阶段（需求/设计/开发/测试/验收复核）提交后自动通过并推进；只有人工确认与发布需要你点。 | The five intermediate stages (product/design/development/testing/acceptance) auto-approve and advance on submit; only the human sign-off and release need you. | 快速模式开关 title；工作台快速模式 title |
| `pipeline.approvalReady` | AI 验收复核已完成；你确认通过后才会解锁发布阶段。 | The AI acceptance review is done; release unlocks only after your sign-off. | 第 6 关卡提示（acceptance 已通过时） |
| `pipeline.hint` | 需求由你下发；产品经理→UI 设计→开发→测试→**AI 验收复核**→你确认→运维发布（双复核）。每个阶段的角色边界写在派发提示词里，评审由你在面板上把关。 | You issue the requirement; product → design → development → testing → **AI acceptance review** → your sign-off → ops release (dual review). Role boundaries live in the dispatched prompts; every gate is yours to approve. | 流水线底部说明 |
| `pipeline.tag.ai`（新增） | AI 复核 | AI review | 第 5 关标签 |
| `pipeline.tag.human`（新增） | 人工确认 | Human sign-off | 第 6 关标签 |
| `pipeline.approvalWaiting`（新增，建议） | 等待你确认（在顶部待办里通过 / 打回） | Waiting for your confirmation (approve or request changes in the banner above) | approval `active` 时替代「等待 agent 提交评审…」 |
| `pipeline.autoApproved`（新增，可选） | 快速模式自动通过 | Auto-approved in fast mode | fast 自动通过备注的本地化显示；不新增则直接显示 Host 备注 |

### 7.2 工作台与流程文案（六 → 七）

| Key | 中文（改后） | English（改后） |
|---|---|---|
| `workbench.redoHint` | 从所选阶段开始重做，之后的阶段都会重置；例如选「需求分析」会按新需求重跑全部**七关**，选「开发实现」只重做开发及之后。 | The chosen stage and everything after it reset; e.g. picking “Requirement” reruns all **seven stages**, picking “Development” redoes development onward. |
| `workbench.reqScope.full` | **完整七关** | **Full seven stages** |
| `workbench.reqScope.fullHint` | 需求 → 设计 → 开发 → 测试 → **验收复核** → 确认 → 发布。 | Product → design → development → testing → **acceptance review** → sign-off → release. |
| `workbench.reqScope.productHint` | 只重做需求与验收项：产品 → 完成。设计/开发/测试/**验收复核**/确认/发布跳过，适合只改需求文档。 | Redo the requirement and acceptance items only: product → done. Design/development/testing/**acceptance review**/sign-off/release are skipped — for requirement-document-only changes. |
| `workbench.reqScope.designHint` | 只重做设计：跳过需求，设计 → 完成。开发/测试/**验收复核**/确认/发布跳过，适合只改设计稿。 | Redo the design only: product is skipped, design → done. Development/testing/**acceptance review**/sign-off/release are skipped — for design-only changes. |
| `workbench.reqScope.product-designHint` | 重做需求与设计：产品 → 设计 → 完成。开发/测试/**验收复核**/确认/发布跳过。 | Redo requirement and design: product → design → done. Development/testing/**acceptance review**/sign-off/release are skipped. |
| `workbench.reqScope.developmentHint` | 跳过需求与设计：开发 → 测试 → **验收复核** → 确认 → 发布。适合代码/配置调整。 | Skip product and design: development → testing → **acceptance review** → sign-off → release. For code/config changes. |
| `workbench.reqScope.releaseHint` | 跳过需求/设计/开发/测试/**验收复核**：只做确认 → 发布。适合发布物调整。 | Skip product/design/development/testing/**acceptance review**: sign-off → release only. For packaging changes. |
| `workbench.changeHintIncomplete` | 完成全部**七关**后，才能发起新轮变更 | Start a change round once all **seven stages** are approved |
| `workbench.reqMode.changeHint` | 归档本轮**七关**并重新走一遍：项目全部完成后可用。 | Archive this round and run the **seven stages** again; available once every stage is approved. |
| `todo.dispatchChangeMessage` | 当前项目已完成。将用「{title}」发起完整**七关**的新一轮变更，并从产品经理阶段开始。 | The current project is complete. Start a full **seven-stage** change round with “{title}” and begin at the product stage. |
| `pipeline.hint` | 见 7.1（同时含双复核说明） | 见 7.1 |
| `pipeline.fastHint` | 见 7.1 | 见 7.1 |
| `pipeline.approvalReady` | 见 7.1 | 见 7.1 |

### 7.3 派发提示文案（`buildIntakePrompt`，中文）

- 「快速模式已开启：**中间四阶段**提交后自动通过」→「中间**五**阶段（含验收复核）提交后自动通过」。
- 步骤 3：「之后继续编排 design / development / testing」→ 补 `acceptance`：「design / development / testing / **acceptance（验收复核，派给项目经理 Agent）**」。
- 「到 approval 闸门停下」保持；可补一句「AI 复核报告是人工确认的输入，不能替代 Owner 确认」。

### 7.4 插件描述（locale meta）

- `locale/zh.json`：`六阶段交付流水线` → **`七阶段双复核交付流水线（AI 验收复核 + 人工确认）`**。
- `locale/en.json`：`a six-stage delivery pipeline` → **`a seven-stage dual-review delivery pipeline (AI acceptance review + human sign-off)`**。

### 7.5 不需要改的文案

`pipeline.reviewBanner`（`第 {n} 关「{stage}」待你审批`）、`pipeline.activeBanner`、`pipeline.nextBanner`、`workbench.reviewGate`、`notify.stageReview*` 都用动态 `n`/`stage`，7 关自动正确，不要硬编码关数。

---

## 8. 视觉规范

### 8.1 颜色（只用 token）

| Token | 用途 | SVG 近似（浅色稿，仅供预览） |
|---|---|---|
| `--dsw-alias-bg-base` / `bg-layer-1` | 面板/卡片底 | `#ffffff`；页面底 `#f9fafb` |
| `--dsw-alias-bg-layer-2` | 序号底、pill 底、输入底 | `#f1f3f5` |
| `--dsw-alias-border-l1` / `l2` | 卡片/输入边框 | `#e6e9ee` / `#d5dae1`（预览加深） |
| `--dsw-alias-label-primary` | 标题、主文字 | `#0f1115` |
| `--dsw-alias-label-secondary` | 摘要、次文字 | `#61666b` |
| `--dsw-alias-label-caption` | 角色、hint、标签说明 | `#8a919c`（预览加深；实现用 token） |
| `--dsw-alias-state-business-primary` | **AI 复核标签**（蓝） | `#4176e6` |
| `--dsw-alias-state-success-primary` | 已通过 | `#22c55e` |
| `--dsw-alias-state-warn-primary` | 待评审边框/状态 | `#f59e0b` |
| `--dsw-alias-state-error-primary` | 已打回/错误备注 | `#ec1313` |

- **AI 复核** = 信息蓝（冷色，表示「机器建议」）；**人工确认** = 中性深色（`label-primary`，表示「你的决定」）；两者都不使用成功/警告色，避免与状态混淆。
- 深浅主题：全部走 token，主题切换自动适配；SVG 只提供浅色稿，开发需在深色主题下自查（验收步骤见第 11 节）。

### 8.2 新增样式（唯一两处，均为增量）

**① 双复核标签**（插在 `.ds-pipe-stage-role` 文本后，作为其子节点，不新增容器）：

```css
.ds-pipe-tag {
  display: inline-block; margin-left: 4px; padding: 0 5px; border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary);
  font-size: 8.5px; line-height: 14px; font-weight: 600; vertical-align: 1px;
}
.ds-pipe-tag[data-kind="ai"] {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent);
  color: var(--dsw-alias-state-business-primary);
}
.ds-pipe-tag[data-kind="human"] {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);
  color: var(--dsw-alias-label-primary);
}
```

**② 备注色调**（现有 `.ds-pipe-note` 默认错误红，新增说明灰变体）：

```css
.ds-pipe-note[data-tone="info"] { color: var(--dsw-alias-label-caption); }
```

> 结构不变：标签是角色行内联文本；备注只加 `data-tone` 属性；按钮、产物、状态全部复用现有类。除此之外不新增任何 `ds-pipe-*`/`ds-wb-*` 样式。

### 8.3 字号 / 间距 / 圆角（不新增）

- 侧栏：卡片标题 11px/600、角色 9px、摘要 10px、提示 9.5px、标签 8.5px；卡片圆角 7px、内边距 6×7、卡间距 6px。
- 工作台：卡片标题 10.5px、步骤名 11px、角色 9px、当前摘要 11px；卡片圆角 10px、内边距 10×12、栅格间距 10px（窄屏单列）。
- 按钮：侧栏 22px 高、工作台 28px 高（compact 34px）；不动。
- 动效：无新增（沿用 `border-color` 0.15s 过渡）。

### 8.4 状态色规则（与现有 `data-status` 一致）

| 状态 | 边框 | 状态 pill 文字 | 动作 |
|---|---|---|---|
| pending | 默认 | caption | 启动并派发（禁用时附序列提示） |
| active | `brand-primary` | `brand-primary` | 发送角色提示 / 等待 |
| review | `state-warn-primary` | `state-warn-primary` | 通过 / 打回 |
| approved | 默认 + `✓ 已通过` | `state-success-primary` | — |
| failed | `state-error-primary` | `state-error-primary` | 重新派发 |

---

## 9. 响应式与无障碍

### 9.1 响应式

- **侧栏 260–420px**：卡片单列、不横向滚动；头部 `flex` 允许标题压缩，`待评审/进行中` pill 不换行；长摘要沿用 `overflow-wrap: anywhere`。260px 下若 `角色 + AI 复核标签` 挤行，标签允许换到下一行（inline，不溢出）。
- **7 步流程条**：保持横向滚动、不折行；1080px 内容宽下 7×116 + 6×20（连接线）= 932px 可完整显示；≤700px 单列卡片网格下流程条仍横向滚动。
- **compact 模式**（`data-compact="true"`）：按钮增大到 34px；流水线视图同样为单列、动作按钮换行；不新增折叠/抽屉。
- 设计稿按桌面侧栏宽度绘制；手机模式以「同组件、单列、可滚动」为准，不单独出新布局。

### 9.2 无障碍

- **颜色不单独表意**：状态 pill 有文字（待开始/进行中/待评审/已通过/已打回），标签有文字（AI 复核/人工确认），序号 1–7 可见；即使色弱也能分辨。
- **对比度**：主文字/标题用 `label-primary`；摘要用 `label-secondary`；`label-caption` 仅用于辅助信息（角色、hint），不作为唯一信息载体。AI 标签蓝底浅蓝（`state-business-primary` + 10% 混合）加 600 字重，仍需在实现后实测；若 8.5px 下不达标，提高到 9px 或改用 `label-secondary` 文本 + 蓝色圆点（二选一，优先加字号）。
- **键盘**：顺序 = 工具条（快速模式 → 刷新）→ 待办横幅（通过 → 打回 → 备注输入）→ 需求卡 → 7 张卡依次（动作按钮 → 产物链接）。禁用按钮不进入 Tab 顺序，因此「需上一阶段通过后才能启动。」必须作为**可见文本**存在（现状 `.ds-pipe-seq-hint` 已满足）。
- **可读名称**：本设计不新增图标按钮。产物按钮 `title=路径`；图片产物 `alt=label`；本轮新增的标签是文本，无需 aria-label。approval `active` 的等待文案要写明「在顶部待办里通过/打回」，避免屏幕阅读器用户只听到「等待」。
- **动效减少**：无新增动画，现有 0.15s 边框过渡可忽略。

---

## 10. 实现注意点（给开发）

### 10.1 `client.js` 必改位置（按当前 v1.2.71 行号，±几行以实际为准）

| # | 位置 | 改动 | 不做的后果 |
|---|---|---|---|
| 1 | 工作台 `stageTitles`（≈16376–16383） | 增加 `acceptance: t('pipeline.stage.acceptance')` | 工作台流程第 5 步标题显示原始 id `acceptance` |
| 2 | 工作台 `roleLabels`（≈16407–16414） | 增加 `acceptance: t('pipeline.role.acceptance')` | 第 5 步角色为空 |
| 3 | 工作台 `const total = stages.length === 0 ? 6 : stages.length`（≈16375） | `6 → 7` | 无数据时显示 `/6` |
| 4 | 流水线视图 `roleLabels`（≈17475–17482） | 增加 acceptance 角色 | 第 5 卡角色显示 `acceptance` |
| 5 | 流水线视图 `stageTitles`（≈17483–17490） | 增加 acceptance 标题 | 第 5 卡标题显示 `acceptance` |
| 6 | 中文字典（≈586–597） | 新增/变更 stage、role、tag、fastHint、approvalReady、hint、approvalWaiting | 中文缺键回退 key 名 |
| 7 | 英文字典（≈1636–1647） | 同上英文 | 英文缺键回退 key 名 |
| 8 | `stageNode` 角色行（≈17602） | 角色 span 内追加双复核标签：`stage.id === 'acceptance' ? AI 复核 : stage.id === 'approval' ? 人工确认 : null` | 两关视觉无法区分 |
| 9 | `stageNode` 备注行（≈17607） | 加 `'data-tone': status === 'failed' ? undefined : 'info'`（或按 note 前缀） | fast/迁移/跳过备注显示成红色错误 |
| 10 | approval 等待文案（≈17615） | `stage.id === 'approval' ? t('pipeline.approvalWaiting') : t('pipeline.waitingAgent')`（建议） | 第 6 关显示「等待 agent 提交评审…」误导 |
| 11 | CSS 流水线区（≈22540 状态 pill 之后） | 加 `.ds-pipe-tag` 3 条规则、`.ds-pipe-note[data-tone="info"]` 1 条 | 标签无样式、说明备注仍红 |
| 12 | 工作台「需求与调整」文案：`redoHint`(≈453)、`reqScope.*`(≈458–469)、`changeHintIncomplete`(≈470)、`reqMode.changeHint`(≈477) | 六→七，补验收复核 | 变更轮提示仍说「六关」 |
| 13 | `todo.dispatchChangeMessage`（≈837） | 六→七 | 已完成后发起变更提示不一致 |
| 14 | `buildIntakePrompt`（≈10053–10068） | 「中间四阶段」→「五阶段」；步骤 3 补 `acceptance`（项目经理 Agent） | 交给 Lead 的派发提示仍按旧流程 |
| 15 | `pipeline.hint`(≈567/1617)、`pipeline.fastHint`(≈580/1630)、`pipeline.approvalReady`(≈628/1678) | 按 7.1 改 | 底部说明与开关 title 仍写旧流程 |
| 16 | locale meta（`locale/zh.json`、`en.json`） | 插件描述改七阶段双复核 | 插件卡片仍写六阶段 |

另有两处经检查**不需要改**，避免开发误改：

- `buildRequirementPrompt`（≈10079–10096）：只讲需求修订与打回哪一关，没有阶段数量文案；保持原样。
- `pipeline.stage.*` 的通用调用（≈8521 `t('pipeline.stage.' + stage.id)`、≈10161、≈11817）：补上 locale 键后自动显示「验收复核」，无需逐个硬编码。
- release 前置提示：客户端没有独立的 release 提示文案，锁定由按钮禁用 + `pipeline.sequenceHint` 表达；Host `STAGE_GUIDES.release`（`pipeline.js`）已写「approval 已通过后发布」，UI 侧无需新增文案。

> 第 6/7 关审批逻辑**不需要改**：`ownerGateStage` 已覆盖 `review` 与 approval `active`；横幅关数用 `findIndex + 1` 动态计算，自动变成 5/6；`approvalReady` 触发条件 `stages[index-1].status === 'approved'` 在 acceptance 通过后自然成立。

### 10.2 Host 侧依赖（不在本设计写范围，但影响 UI 呈现）

- `PIPELINE_STAGES` 7 阶段 + `{ id:'acceptance', role:'project-manager-agent', roleTitle:'项目经理 Agent', title:'验收复核' }`，approval `roleTitle` →「项目经理（你）」。UI 角色名来自 locale，但必须与 Host 保持一致，避免提示词/面板角色名不一致。
- fast 自动通过备注由 Host 写入；建议固定文案「快速模式自动通过」，供客户端按前缀本地化（可选）；若保留「快速模式：Owner 预授权自动通过」，UI 用说明灰展示即可。
- 迁移备注「升级迁移：验收复核为更新新增，旧流程已完成」；UI 只负责说明灰展示，不新增状态语义。
- 变更轮 `release` scope 跳过 acceptance 的 note 沿用「跳过：…」，工作台已按 `note.startsWith('跳过')` 显示「跳过」。

### 10.3 自查清单（开发提交前）

- [ ] 中英文各切一遍：7 关标题/角色正确，第 5 卡无 `acceptance` 原始 id，第 6 卡角色「项目经理（你）」。
- [ ] normal 走一遍：testing 通过 → 启动 acceptance → 提交 → 横幅/卡片通过 → approval 解锁 → 通过 → release 解锁。
- [ ] fast 走一遍：中间五阶段自动通过；acceptance 显示「快速模式自动通过」且为说明灰；approval 仍需启动+人工通过；release 不自动。
- [ ] 打回 acceptance：failed 红备注 + 重新派发可用；approval/release 保持锁定。
- [ ] 深色主题：标签/边框/说明灰可读；260px 侧栏不溢出；工作台 7 步横向滚动正常。
- [ ] `grep -n "六阶段\|六关\|six-stage\|six stages" dsh-web-filebrowser-plugin/client.js` 仅历史 CHANGELOG 例外。

---

## 11. 验收对照（需求 §7 第 6 条为主）

| 验收点 | 页面/控件落点 | 设计稿 | 验证方式 |
|---|---|---|---|
| 流水线恰好 7 关且顺序固定 | 流水线视图 7 张卡序号 1–7；工作台 7 步流程条 | A/B/C/D | 刷新页面数卡片/步骤；序号与阶段名逐一对照 |
| 新角色「项目经理 Agent」可见 | 第 5 卡标题/角色、`AI 复核` 标签；工作台第 5 步角色 | A/C/D | 中英文各看一次，角色文案正确 |
| 第 6 关「人工确认 / 项目经理（你）」 | 第 6 卡标题/角色/`人工确认` 标签 | A/B | 与第 5 卡相邻对比，一眼可区分 |
| normal：acceptance 待评审可通过/打回 | 顶部横幅 + 第 5 卡动作 + 复核报告产物 | A/C | 切 normal 提交 acceptance，点通过/打回观察状态与解锁 |
| fast：acceptance 自动通过、approval 待你确认 | 第 5 卡「快速模式自动通过」+ 第 6 卡进行中 + 横幅 | B | 切 fast 提交 acceptance，确认 autoApproved 后 approval 仍需人工 |
| approval/release 永不自动 | 两卡在 fast 下不出现「✓ 已通过」自动态 | B | fast 模式检查两关始终需启动/审批 |
| 复核卡可启动派发 | 第 5 卡「启动并派发」可用（testing 通过后） | A/C | 点击后变进行中并派发提示 |
| 工作台无「六阶段」残留 | 进度 x/7、流程 7 步、范围 hint | D + 文案表 | grep + 中英文界面走查 |
| 验收报告可点开 | 第 5 卡产物链接 `docs/pipeline/acceptance-review.md` | A/B/C | 点击在编辑器中打开文件 |

---

## 12. 未决问题与风险

| # | 问题/风险 | 影响 | 当前设计决定 | 负责人/确认时间 |
|---|---|---|---|---|
| 1 | normal 打回 acceptance 默认回退到 development 还是 testing | 修复路径不清 | 由复核报告「建议回退阶段」+ 你的打回备注决定，UI 不预设（与需求 §10.2 一致） | Owner/Lead（实施前确认） |
| 2 | fast 自动通过备注的中文化/英文化 | 英文界面出现中文备注 | 核心先做「说明灰」；本地化（`pipeline.autoApproved`）为可选 P1 | 开发/Lead |
| 3 | 迁移 approved 的 acceptance 是否要额外视觉标记 | 可能误解为「新流程已复核」 | 只用备注说明灰，不加新状态/徽标（与需求 §10.1 一致） | Owner（默认按此） |
| 4 | 侧栏极窄（260px）下标签与状态 pill 挤压 | 换行/溢出 | 标签 inline 允许换行；必要时实现后按实测微调标签字号（8.5–9px） | 开发自测 |
| 5 | 工作台 7 步流程条横向滚动是否足够 | 小屏看不到后两步 | 本轮保持横向滚动（复用现有组件）；若 Owner 觉得不便，下一轮可改两行/紧凑模式 | Owner 验收时决定 |
| 6 | approval `active` 等待文案改动是否会牵连测试快照 | 1 处条件文案变更 | 建议改（更准确）；若开发要最小改动可保留旧文案，但需在文档记录 | 开发/QA |
| 7 | `--dsw-alias-state-business-primary` 在小字号下的对比度 | AI 标签可读性 | 加 600 字重 + 浅色底；实测不达标优先加字号到 9px | QA 验收 |

---

## 13. 资源清单

| 文件 | 内容 | 对应页面/状态 |
|---|---|---|
| [design/seven-stage-normal.svg](seven-stage-normal.svg) | normal 模式流水线视图 7 关，acceptance 待评审、approval/release 锁定，含双复核关系与要点标注 | 设计稿 A |
| [design/seven-stage-fast.svg](seven-stage-fast.svg) | fast 模式，acceptance 自动通过（备注说明灰）、approval 进行中待你确认、release 锁定 | 设计稿 B |
| [design/acceptance-card-states.svg](acceptance-card-states.svg) | 验收复核卡 5 状态（待开始/进行中/待评审/已通过/已打回）与动作 | 设计稿 C |
| [design/seven-stage-workbench.svg](seven-stage-workbench.svg) | 工作台项目流程 7 步、当前阶段摘要、4/7 进度 | 设计稿 D |

> SVG 内嵌中文使用系统字体栈（PingFang SC / Microsoft YaHei / Noto Sans CJK SC / Noto Sans SC）；颜色为浅色主题 token 近似值，实现必须使用 `--dsw-alias-*`。设计稿可直接用浏览器打开或放入 `docs/` 预览。
