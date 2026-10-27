# 工作台「Agent 指派器」设计说明 v1.2.75（2026-10-27）

> 角色：UI 设计师（`opc-design`）｜上游需求：[requirements.md](requirements.md)（工作台 Agent 指派器 MVP，331 行）｜上游提案：[AGENT_ASSIGN.md](../proposals/AGENT_ASSIGN.md) + 3 屏提案稿 [mockups/](../proposals/mockups/)｜下游：全栈开发实现。
> 本轮性质：第 3 轮变更（`roundScope=full`），七阶段 + 双复核不变；本设计**以需求为准**修正提案稿差异（发布阶段置灰、成员状态改为「记录推导 + 团队面板为准」、卡片顺序、附件 MVP 降级、无深链）。
> 结论先行：在工作台新增一张全宽「团队与指派」卡（位于「项目状态」与「项目流程」之间），通过 608px 右侧抽屉生成**结构化指派单**发到当前对话，由 Lead 用原生 team 工具执行；插件只做项目侧派工台、留痕与状态桥，**不写 `.dsh/pipeline.json`、不碰 approval/release 闸门**。版本：插件升 **1.2.75**、根保持 **1.2.75**（交付后根 +1 至 1.2.76）。

---

## 0. 摘要

| 项 | 内容 |
|---|---|
| 交付物 | 本说明 + 4 张落地稿（`assign-workbench` / `assign-dialog` / `assign-status` / `assign-empty-state`，SVG+PNG） |
| 页面位置 | 工作台：需要你处理 → 项目状态 → **团队与指派** → 项目流程（其余现有卡不变） |
| 核心交互 | 选角色/成员/新建 Agent → 写任务与验收 → 关联阶段或临时任务 → 指派 → 结构化派单进对话 → 状态卡追踪/催办/打回/通过/再指派/取消 |
| Host 契约 | 新模块 `assignments.js` + 4 个 owner-only op（list/save/update/delete）+ `.dsh/agent-assignments.json`（原子写/串行锁/≤100 条/≤1MB） |
| 不变式 | 指派前后 `.dsh/pipeline.json` 哈希一致；approval/release 不可指派；模型无指派工具；不新增运行时依赖 |
| MVP 缩减 | 成员实时状态 → 记录推导 + 团队面板为准；团队面板入口 → 可复制说明（无死链）；附件 → 提示拖入对话；发布阶段置灰；无自动超时 |
| 验收 | 12 条 acceptance items 全覆盖（§14），效果图逐项可核对（§13） |

---

## 1. 调研与借鉴（≤2 页）

> 调研由 product 阶段完成并写入 [requirements.md](requirements.md) §7（2026-10-27，`web_search` 1 次 + `web_fetch` 13 次，7 个可引用来源、4 个失败来源如实披露）。设计阶段**沿用并复核**；不重复抓取、不新增未注明来源。

### 1.1 来源与关键结论

| # | 来源 | URL | 访问日期 | 关键结论（对本设计的影响） |
|---|---|---|---|---|
| 1 | Microsoft Learn · Design human-in-the-loop workflows | https://learn.microsoft.com/en-us/training/modules/governance-guardrails-operations/4-design-human-workflows | 2026-10-27 | 人类应在高影响决策点介入（派发 / 完成确认），审批显式、可审计、责任明确；串行执行。→ 状态卡「通过/打回由 Owner 操作」、打回必填原因、history 留痕、per-root 串行写 |
| 2 | Microsoft HAX Toolkit · Guidelines for Human-AI Interaction | https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/ | 2026-10-27 | G1/G2 说清能力与边界、G9 纠错、G11 解释原因、G16 说明后果、G18 通知变化。→ 表单能力说明、闸门后果提示、打回/再指派、toast 与 `aria-live` |
| 3 | Linear Docs · Assign and delegate issues | https://linear.app/docs/assigning-issues | 2026-10-27 | 一个 issue 单一 assignee、ownership 清晰；可委托给 agent 但人类保留责任。→ `assignedTo` 三选一互斥、单目标展示、Owner 最终确认 |
| 4 | GitHub Docs · Assigning issues and PRs（对比） | https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/assigning-issues-and-pull-requests-to-other-github-users | 2026-10-27 | GitHub 支持多 assignee。→ **不采用多指派**（与团队执行/状态追踪冲突） |
| 5 | NN/g · Progress Indicators Make a Slow System Less Insufferable | https://www.nngroup.com/articles/progress-indicators/ | 2026-10-27 | 状态可见性与即时反馈；>1 秒操作需进度指示。→ 五段进度、状态 pill 文案、toast、催办、等待提示 |
| 6 | MDN · ARIA `dialog` role | https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/dialog_role | 2026-10-27 | `role=dialog` + 可访问名称、焦点入/出、Tab 循环、模态时外部不可交互。→ 抽屉/底部面板焦点管理与 Esc 归还（§9） |
| 7 | Node.js Docs · File system | https://nodejs.org/api/fs.html | 2026-10-27 | 文件 promise API 非线程安全；temp+rename 原子替换。→ assignments 原子写 + per-root 串行锁（§10） |

### 1.2 借鉴决策（采用 / 调整 / 不采用）

| 模式 | 来源 | 决策 | 理由与落点 |
|---|---|---|---|
| 单 assignee + 人类保留责任 | #3 | **采用** | 三选一互斥、单目标；Owner 通过/打回。 |
| HITL：只在派发与完成确认点介入 | #1 | **采用** | 减少 Owner 负担；状态机只在 `review→done`、`→failed` 需要 Owner。 |
| 显式审批 + 可审计 + 串行 | #1/#7 | **采用** | history ≤50、打回必填 note、原子写、锁。 |
| 状态可见 + 进度反馈 | #5 | **采用** | 五段进度 + 状态 pill + toast + 催办。 |
| ARIA dialog 焦点规范 | #6 | **采用** | `role="dialog" aria-modal="true"`、`aria-labelledby/describedby`、Esc 归还焦点、Tab 循环。 |
| HAX G1/G2/G9/G11/G16/G18 | #2 | **采用（简化）** | 表单说明能力边界、关联阶段后果提示、打回/再指派、`aria-live`。 |
| 多 assignee | #4 | **不采用** | 团队工具执行与状态追踪会歧义；MVP 单目标。 |
| 直接实时读团队服务 / 插件直接 spawn | #3/#2 延伸 | **不采用（本轮）** | 无 owner 级 API、权限模型限制；改为「记录推导 + 团队面板为准 + 入口说明」。 |
| 自动超时失败 / 自动重试 | #1/#5 延伸 | **不采用** | Agent 可能长跑；自动失败会误判；仅等待提示 + 催办。 |
| 引入 write-file-atomic 等依赖 | #7 延伸 | **不采用** | 需求禁新依赖；自建 temp+rename。 |

### 1.3 已验证 vs 创新假设

- **已验证模式**：单 assignee/委托给 Agent、HITL 关键点审批、状态可见与进度、ARIA dialog、原子写与串行锁。
- **创新假设（待交付验证）**：结构化派单模板减少漏项；「已派发/等待 Lead」拆分；记录推导成员状态足够；指派与流水线状态解耦；「自动判断阶段」推导准确；附件降级可接受；100 条/1MB/history 50 足够。

### 1.4 设计质量基线

沿用 v1.2.73 设计硬标准（[archive-v1.2.73-agent-capabilities.md](design/archive-v1.2.73-agent-capabilities.md)）：4/8px 间距、12/14/16/20/24/32 字号阶梯与 ≥1.4 行高、token 对比度 ≥4.5:1（大字/非文本 ≥3:1）、八态状态矩阵、150–300ms 动效 + `prefers-reduced-motion`、键盘/ARIA、360/768/1280。

---

## 2. 目标、原则与范围

**目标**：Owner 在工作台 30 秒内完成「选 Agent → 写任务 → 指派」；Lead 收到可直接执行的结构化指派单；状态可追踪、可催办、可打回/再指派；指派全程不触碰流水线闸门。

**原则**：
1. **Owner-first**：卡片先回答「谁在做什么、哪条要我处理」；指派入口始终在一屏内。
2. **单一目标**：一条记录只有一个 assignee（role/member/newAgent 三选一）。
3. **闸门优先**：approval/release 不可指派；阶段任务只读推导、不写 pipeline。
4. **证据与留痕**：验收标准、产物路径、history、时间戳齐全；打回必须写原因。
5. **MVP 诚实降级**：做不到的实时状态/深链/附件，用明确提示替代，不画死链。
6. **复用现有体系**：`ds-wb-*` / `ds-btn` / `ds-pipe-*` / `--dsw-alias-*`；不新增依赖与设计系统。

**范围**：卡片、抽屉、状态卡、结构化派单、i18n、Host 契约、空/加载/错误态、窄屏底部面板规则。
**不做**：团队运行时/实时成员 API/直接 spawn、SSH 支持、服务端搜索分页、自动超时、移动端全量重排（只给底部面板规则）。

---

## 3. 信息架构与卡片（屏幕 1）

### 3.1 位置与层级

工作台视觉顺序（需求 §3.1 / 验收项 64983c295b）：

```
需要你处理（warn，注意力最高）
项目状态（当前轮次/进度）
团队与指派（NEW，全宽）
项目流程（七阶段）
…其余现有卡（交付前体检 / 本轮变更 / 需求与调整 / 设计稿 / 验收 / 运行中）
```

- 实现：卡片 JSX 插在 `requirementCard` 与 `flowCard` 之间；样式加 `.ds-wb-assign { grid-column: 1 / -1; }` 全宽。
- 「需要你处理」保持 `order:-1` 置顶；团队卡不得抢闸门按钮的视觉权重。

### 3.2 卡片解剖

| 区域 | 内容与规格 |
|---|---|
| 卡头 | 标题「团队与指派」13/20 600；副标题「6 名角色成员 · {执行中} 人执行中 · {待确认} 人待确认（按指派记录推导）」12/18；右上「指派任务」主按钮 + 「团队面板入口」（复制说明，非深链） |
| 成员 chips | 3 列 × 2 行（窄屏自动换行）；单 chip 338×48，头像 26、名称 14/600、副行 12（角色 id + 职责）、状态 pill 88×24；6 个角色：产品/设计/开发/测试/项目经理 Agent/运维 |
| 状态推导 | 仅三态：**空闲 / 执行中 / 待你确认**（不显示阻塞/离线，MVP 不承诺实时）；推导规则见 §3.3；旁边注明「实时状态以 Harness 团队面板为准」 |
| 最近指派 | 默认 5 条、可展开；行高 30：状态 pill（已派发/执行中/已完成/已打回/待你确认）+ 角色头像 + 标题 + 成员·角色 id + 类型（关联阶段/临时任务）+ 时间 + 操作（处理/查看/复制派单/再指派） |
| 空态 | 0 条时：图标 + 「还没有指派任务」+ 「选角色、写清验收标准，把任务交给团队；状态会记录在这里。」+ 指派任务 CTA + 团队面板入口（见 `assign-empty-state`） |
| 页脚 | 左：「派发后由 Lead 用原生 team 工具执行；成员与共享任务状态以团队面板为准。」右：「记录保存在 .dsh/agent-assignments.json」 |
| 尺寸 | 全宽 1080（工作台 max-width），内边距 20，圆角 12，1px `border-l1`；卡片高随记录数自适应（5 条约 432） |

### 3.3 成员状态推导（MVP，唯一规则）

| 派生状态 | 判定（任一记录） | 展示 |
|---|---|---|
| 待你确认 | 该角色/成员存在 `status=review` 的记录 | 琥珀 pill + 文字「待你确认」 |
| 执行中 | 无 review，且存在 `status=dispatched` 或 `running` | 蓝色 pill + 文字「执行中」 |
| 空闲 | 其余情况（无记录 / 只有 done/failed/cancelled） | 灰色 pill + 文字「空闲」 |

- **权威来源**：Harness 原生团队面板（成员 roster/当前任务）。卡片仅在 chip 与页脚标注「按指派记录推导 · 实时以团队面板为准」，不显示「阻塞/离线」以免误导。
- 团队面板入口：无稳定深链时展示**复制入口说明**（点击复制文案并 toast，不跳转、不报错）；不得出现 404/死链。

### 3.4 卡片状态（必须设计）

`loading`（骨架/「读取指派…」）、`empty`（见上）、`error`（`assignmentError` 行 + 重试）、`offline/SSH`（禁用卡片 + 提示）、`full`（99/100 条提示清理终态）、`corrupt`（不静默清空，提示路径）、`normal`、`readonly/compact`。

### 3.5 卡片文案（中文示例，见 §8 完整 i18n）

- 标题/副标题/按钮：团队与指派 · 6 名角色成员 · 2 人执行中 · 1 人待确认（按指派记录推导）· 指派任务 · 团队面板入口
- 最近指派：待你确认 · 修复登录态回归 · 测试工程师 · opc-qa · 关联：测试验收 · 3 分钟前 · 处理 →
- 空态：还没有指派任务 · 选角色、写清验收标准，把任务交给团队；状态会记录在这里。

---

## 4. 指派抽屉（屏幕 2）

### 4.1 尺寸与响应式

| 视口 | 形态 | 规格 |
|---|---|---|
| ≥1024 | 右侧抽屉 | 宽 **608px**，全高，左侧圆角 16，左侧阴影；遮罩 `label-primary` 36% |
| 769–1023 | 右侧抽屉 | 宽 min(608, 88vw)，字段单列不换行；内容可滚动 |
| ≤768 | **底部面板** | 全宽 100vw，最大高 90vh，顶部圆角 16；header/footer sticky；字段纵向排列；打开时焦点入面板、Esc 关闭归还焦点 |
| 360 | 底部面板 | 字段全宽、按钮全宽 44 高；chips/chip 组自动换行；无横向溢出 |

- 内容区最大宽 536，左右内边距 24/48（右留关闭按钮呼吸）；header 88、footer 88–96 sticky；中间独立滚动。
- 表单字段顺序固定：交给谁 → 任务标题 → 详细说明 → 验收标准 → 优先级 + 关联阶段 → 期望产物 → 附件 → 底部提示/按钮。

### 4.2 字段规格

| # | 字段 | 控件 | 必填 | 长度/选项 | 默认 | 错误态（就地，不丢输入） |
|---|---|---|---|---|---|---|
| 1 | 交给谁 | 三 tab（按角色 / 当前成员 / 新建 Agent）+ 6 角色 chips | 是 | role ∈ 6 角色；member 自由填写；newAgent{name, role} | 按角色；未选为空 | 「请选择交给谁」；三者互斥冲突时提示 |
| 2 | 任务标题 | 单行 input（44） | 是 | trim 后 1–120；计数器 | 空 | 必填/超长，计数器变红，按钮禁用 |
| 3 | 详细说明 | textarea（≥88） | 是 | 1–4000；计数器 | 空 | 同左 |
| 4 | 验收标准 | 多行列表（1–10 条，每条 ≤500） | 是 | 可增删行；默认预填 1 条「产物落盘 + 自测通过」 | 1 条预填 | 0 条/11 条/单条超长；行内提示 |
| 5 | 优先级 | segmented P0/P1/P2 | 否 | P0/P1/P2 | **P1** | — |
| 6 | 关联流水线阶段 | 下拉 + chips（自动判断 / 5 可关联 / 不关联） | 否 | 见 §4.3 | **自动判断** | 已完成轮次提示改临时任务/发起变更；approval/release 置灰 |
| 7 | 期望产物路径 | 单行 input（38–40） | 否 | 建议 ≤10 条、每条 ≤500（待实现确认，§10 未决） | 空 | 仅提示格式，不读文件 |
| 8 | 附件 | 拖拽区/提示 | 否 | MVP 仅提示拖入当前对话 | 空 | 不阻塞提交；上传为后续增强 |

- **新建 Agent**：填写名称 + 角色，仅记录 spawn 参数；由 Lead `spawn_teammate` 执行，失败由 Lead 回填、表单保留输入。
- **提交中**：按钮禁用 + 「指派中…」；同一表单重复点击只产生一条记录（按钮禁用 + 客户端幂等标记）。
- **成功**：toast「已派发到当前对话」+ 关闭抽屉 + 卡片/状态刷新。
- **部分失败**：`assignmentSave` 成功但 `sendPromptText` 失败 → 记录保留 `dispatched`，提示「已保存，发送失败」+「重发指派单」，不重复建记录。
- **保存失败**：不发送；`bad-request`/`full`/`too-large`/`ssh-unsupported` 等错误就地展示，输入不丢。

### 4.3 关联阶段选项（需求 §3.1/§5.3）

| 选项 | 可指派 | 说明 |
|---|---|---|
| 自动判断（默认） | ✅ | 有需求时按当前 `active`/`review` 阶段推导；已完成时提示改临时任务或发起变更轮；无需求回退临时任务 |
| 需求分析 / UI 设计 / 开发实现 / 测试验收 / 验收复核 | ✅ | 5 个可关联阶段（`product/design/development/testing/acceptance`）；状态只读推导，不写 pipeline |
| 人工确认（approval） | ❌ 置灰 | 仅 Owner 在流水线面板审批；锁图标 + 提示 |
| 发布上线（release） | ❌ 置灰 | 仅 Owner 审批后由运维执行；锁图标 + 提示 |
| 不关联（临时） | ✅ | 不改变流水线，完成后 Owner 在状态卡确认；涉代码/需求变更时提示转「需求与调整」 |

- 提示固定两行：「人工确认 / 发布上线只能由 Owner 在流水线面板审批，不可指派。」「关联阶段将走双复核闸门；临时任务不改变流水线，结果只在对话汇报。」
- 视觉：置灰 chip 使用 `bg-layer-2` + 虚线边框 + 锁图标 + `aria-disabled="true"`（不可聚焦或可聚焦但不可选，二选一，实现采用原生 `disabled` + 可见说明）。

### 4.4 尺寸/tokens（落地稿实测）

- 抽屉 608 宽；字段 536 宽；tabs 36 高；角色 chips 172×32（3 列 × 2 行，gap 10）；阶段 chips 172×30（3 列 × 3 行）；input 42–44；textarea 64–76；按钮 44。
- 颜色（近似 token）：主文字 `#0f1115`、次文字 `#61666b`、链接/信息 `#2563eb`、成功 `#1a7f37/#e6faed`、警告 `#b45309/#fef5e7`、错误 `#d1242f/#fef2f2`、边框 `#e3e8ef`。对比度见 §9.4。

---

## 5. 状态列表与操作（屏幕 3）

### 5.1 列表与筛选

- 筛选：**全部 / 进行中 / 待你确认 / 已完成**（需求 §3.1）；计数来自 `assignmentList`（可附 counts，客户端也可本地算）；默认按 `updatedAt` 倒序。
- 默认展示最近 5 条；更多时「展开全部 / 收起」；客户端筛选与展开（≤100 条，无服务端分页）。
- 每行结构：Agent 头像/角色、任务标题、五段进度、状态 pill、关联阶段/临时标签、时间、操作。
- 五段进度：**已派发 → 等待 Lead → 执行中 → 待你确认 → 已完成**；打回时第四段替换为红色「已打回」，已取消在状态 pill 显示「已取消」并终止进度。
- 状态 pill：已派发（中性）、执行中（蓝）、待你确认（琥珀）、已完成（绿）、已打回（红）、已取消（灰）。颜色 + 文字双表达。

### 5.2 操作矩阵

| 操作 | 可用状态 | 结果 | 要求/说明 |
|---|---|---|---|
| 复制派单 | 任意 | 状态不变 | MVP 的「查看对话」= 复制结构化指派单 + 提示当前对话；写入剪贴板，toast |
| 催办 | dispatched / running | 状态不变 | 向当前对话发提醒；append history（同状态 + note） |
| 打回 | dispatched / running / review | `failed` | **必须填原因**（弹窗，1–4000）；二次确认；不自动重派；history |
| 通过并完成 | review | `done` | Owner 确认；history |
| 再指派 | failed / done / cancelled | **新建记录** | 预填抽屉，原记录保留；新记录 `dispatched` |
| 取消 | dispatched / running / review | `cancelled` | 二次确认；保留记录；可再指派 |
| 删除 | 仅终态（建议 P1，待确认） | 记录移除 | 二次确认；不存在 → `not-found` |
| 开始执行/提交汇报 | dispatched / running | running / review | 供 Lead 在对话汇报后由 Owner 点击推进（MVP 手动）；history |

### 5.3 打回弹窗

- 触发：行内「打回」；`role="dialog"` + `aria-modal`；焦点入原因文本框；Esc 关闭不提交。
- 字段：原因 textarea（必填，1–4000，计数器）；可选快捷原因（证据不足/未复测/偏离验收/产物缺失）。
- 按钮：取消 / 确认打回（危险样式）；未填原因禁用；提交中禁用；失败就地提示、不关闭。
- 成功后：行状态变 `failed`、toast、可「再指派」。

### 5.4 行尺寸（落地稿）

- 行高 126，圆角 10；头像 36；标题 14/600；元信息 12；进度节点 8/12；操作按钮 28、链接 12；行内边距 20；行间距 8。窄屏：进度标签可隐藏为「步骤 3/5」+ 展开，操作收进「⋯」菜单（规则见 §9）。

---

## 6. 状态矩阵（八态）

> 组件级 MUST：所有可交互元素 8 态；只读区至少 loading/empty/error/success。N/A 需理由。

| 组件 | 默认 | hover | focus | active | disabled | loading | empty | error |
|---|---|---|---|---|---|---|---|---|
| 团队卡 | 白底/1px 边框 | 边框加深（不明显） | 卡内按钮焦点环 | 卡内按钮按下 | SSH/无 root：整卡禁用 + 说明 | 读取中骨架/「读取指派…」 | 空态 CTA（见屏幕 4） | 错误行 + 重试；`corrupt` 提示路径 |
| 成员 chip | 白底/状态 pill | 边框加深 | 2px 环 + 2px offset | 按下 1px 位移 | 不适用 | — | — | 状态未知 → 空闲 + 团队面板提示 |
| 最近记录行 | 白底分隔线 | 行底色 4% | 行/操作焦点环 | 操作按钮按下 | 不可操作（只读） | — | 暂无记录 | 读取失败行 |
| 指派按钮 | 深色主按钮 | 加深 4% | 2px 环 | 位移/加深 | 提交中/无权限禁用 | 「指派中…」 | — | 保存失败 toast/内联 |
| 抽屉 | 遮罩 + 面板 | — | 焦点入面板 | — | 打开中禁用背景滚动/交互 | 保存/发送中 | — | 字段错误、保存失败、发送失败（部分失败） |
| 输入/文本域 | 白底/边框 | 边框加深 | 2px 环（title 示例） | — | 提交中只读 | 校验中 | placeholder | 红边 + 行内错误文案（`aria-invalid`/`aria-describedby`） |
| 阶段 chip | 白底 | 边框加深 | 焦点环 | 选中蓝底/✓ | approval/release 灰底虚线 + 锁 + 提示 | — | — | 已完成轮次提示；非法 stage → bad-request 提示 |
| 状态行操作 | 链接/次按钮 | 下划线/加深 | 焦点环 | 按下 | 非法操作不渲染 | 提交中禁用 | — | 失败 toast + 保留状态 |
| 状态卡筛选 | 胶囊 | 底色加深 | 焦点环 | 选中深底 | 无匹配空态 | — | 「没有符合条件的指派」 | 读取失败 + 重试 |

**窄屏**：≤768 抽屉变底部面板；卡片成员 chips 2 列/1 列；最近记录隐藏「类型/时间」列（放入标题下第二行）；状态行进度横向滚动或折叠为「步骤 3/5」；操作收进「⋯」菜单（打回/取消仍二次确认）。
**深色**：全部使用 `--dsw-alias-*`；语义色文字使用 `*-text` 变体（v1.2.73 标准）；对比度复测。

---

## 7. 结构化指派单模板（发到当前对话）

```text
【工作台指派 · 第 N 轮】
交给：<角色/成员 opc-xxx>
     （新建 Agent 时：name=<name> role=<role>，由 Lead 执行 spawn_teammate）
任务：<标题>
背景/期望：
<详细说明>
验收标准：
1. <条件一>
2. <条件二>
…（1–10 条）
关联阶段：<stageId 或「临时任务」>（自动判断结果：<推导说明>）
期望产物：<路径，可空>
优先级：<P0/P1/P2>
执行要求：
- 按角色边界执行；不要改动需求/验收标准/他人写范围。
- 阶段任务：按 pipeline_* 流程推进，最终仍走 testing → acceptance（AI 复核）→ approval（Owner 人工确认）→ release；不要越过人工闸门。
- 临时任务：不改变流水线，完成后在对话汇报产物与验证。
- 不要越过 approval / release 人工闸门；插件不会替你改流水线状态。
- 完成后由 Owner 在工作台状态卡「通过并完成」或写原因打回。
```

- 复制/发送时机：落盘成功 → 生成文本 → `sendPromptText`；失败保留记录并可「重发指派单」。
- 字段顺序固定，便于 Lead 解析与 selftest grep；不包含密钥、绝对路径之外的敏感信息。

---

## 8. i18n 表（新增 `workbench.assign.*`）

> 字典位置：`client.js` 内置中英字典（zh 约 399–560、en 约 1449–1624，`notify.*` 之前插入新段）。`locale/zh.json`/`en.json` 仅 meta，更新描述为可选 P1。**共 122 个键**（含状态/操作/错误；去重后 122）。

### 8.1 卡片

| Key | 中文 | English |
|---|---|---|
| `workbench.assign.title` | 团队与指派 | Team & assignments |
| `workbench.assign.subtitle` | 6 名角色成员 · {working} 人执行中 · {review} 人待确认（按指派记录推导） | 6 role members · {working} working · {review} awaiting you (derived from assignments) |
| `workbench.assign.derivedHint` | 状态按指派记录推导；实时状态以 Harness 团队面板为准 | Status is derived from assignments; live status is authoritative in the Harness team panel |
| `workbench.assign.assignButton` | 指派任务 | Assign task |
| `workbench.assign.teamPanel` | 团队面板入口 | Team panel entry |
| `workbench.assign.teamPanelHint` | 复制团队面板入口说明（MVP 无深链） | Copy team-panel entry guidance (no deep link in MVP) |
| `workbench.assign.teamPanelCopied` | 已复制团队面板入口说明 | Team-panel guidance copied |
| `workbench.assign.members` | 团队成员 | Team members |
| `workbench.assign.recent` | 最近指派 | Recent assignments |
| `workbench.assign.recentCount` | 共 {count} 条 · 默认显示最近 {shown} 条 | {count} total · latest {shown} shown |
| `workbench.assign.expand` | 展开全部 | Show all |
| `workbench.assign.collapse` | 收起 | Collapse |
| `workbench.assign.emptyTitle` | 还没有指派任务 | No assignments yet |
| `workbench.assign.emptyHint` | 选角色、写清验收标准，把任务交给团队；状态会记录在这里。 | Pick a role, write acceptance criteria, and hand it to the team; status stays here. |
| `workbench.assign.footerHint` | 派发后由 Lead 用原生 team 工具执行；成员与共享任务状态以团队面板为准。 | The Lead executes via native team tools; member & shared-task status stays authoritative in the team panel. |
| `workbench.assign.recordPath` | 记录保存在 {path} | Records stored in {path} |
| `workbench.assign.loadFailed` | 读取指派失败：{message} | Could not load assignments: {message} |
| `workbench.assign.sshUnsupported` | SSH 工作区暂不支持指派 | Assignments are not supported in SSH workspaces |
| `workbench.assign.fullHint` | 指派记录已满（最多 100 条）；请清理终态记录 | Assignment limit reached (100); clean up finished records |
| `workbench.assign.corrupt` | 指派数据文件损坏：{path}（未覆盖，请备份/修复） | Assignment data is corrupt: {path} (not overwritten; back up/fix it) |

### 8.2 成员与记录状态

| Key | 中文 | English |
|---|---|---|
| `workbench.assign.member.idle` | 空闲 | Idle |
| `workbench.assign.member.running` | 执行中 | Working |
| `workbench.assign.member.review` | 待你确认 | Awaiting you |
| `workbench.assign.status.dispatched` | 已派发 | Dispatched |
| `workbench.assign.status.running` | 执行中 | Running |
| `workbench.assign.status.review` | 待你确认 | Awaiting you |
| `workbench.assign.status.done` | 已完成 | Done |
| `workbench.assign.status.failed` | 已打回 | Sent back |
| `workbench.assign.status.cancelled` | 已取消 | Cancelled |
| `workbench.assign.type.stage` | 关联：{stage} | Stage: {stage} |
| `workbench.assign.type.temp` | 临时任务 | Ad-hoc task |
| `workbench.assign.action.process` | 处理 → | Handle → |
| `workbench.assign.action.view` | 查看 → | View → |
| `workbench.assign.action.copy` | 复制派单 | Copy order |
| `workbench.assign.action.reassign` | 再指派 → | Reassign → |

### 8.3 抽屉

| Key | 中文 | English |
|---|---|---|
| `workbench.assign.dialog.title` | 指派任务 | Assign task |
| `workbench.assign.dialog.subtitle` | 选角色/成员、写清任务与验收；提交后由 Lead 调度执行 | Pick a role/member, describe the task and acceptance; the Lead dispatches it |
| `workbench.assign.dialog.mvpTag` | MVP · 结构化派单 | MVP · structured order |
| `workbench.assign.dialog.assignee` | 交给谁 | Assign to |
| `workbench.assign.dialog.tab.role` | 按角色 | By role |
| `workbench.assign.dialog.tab.member` | 当前成员 | Current member |
| `workbench.assign.dialog.tab.newAgent` | 新建 Agent | New agent |
| `workbench.assign.dialog.memberPlaceholder` | 输入成员名，如 opc-dev | Member name, e.g. opc-dev |
| `workbench.assign.dialog.newAgentName` | Agent 名称，如 opc-dev-2 | Agent name, e.g. opc-dev-2 |
| `workbench.assign.dialog.newAgentRole` | Agent 角色 | Agent role |
| `workbench.assign.dialog.selected` | 已选：{name} · {member}（{status}） | Selected: {name} · {member} ({status}) |
| `workbench.assign.dialog.pickMember` | 从成员中选 | Pick from members |
| `workbench.assign.dialog.newAgentHint` | 新建 Agent 需名称 + 角色，由 Lead spawn（受团队上限约束） | New agents need a name + role and are spawned by the Lead (team limits apply) |
| `workbench.assign.dialog.titleLabel` | 任务标题 | Task title |
| `workbench.assign.dialog.titlePlaceholder` | 一句话结果，例如「修复登录态刷新丢失」 | One-line outcome, e.g. “Fix session loss on refresh” |
| `workbench.assign.dialog.detailLabel` | 详细说明 | Details |
| `workbench.assign.dialog.detailPlaceholder` | 背景 / 现状 / 期望行为 / 不做范围 | Background / current / expected / out of scope |
| `workbench.assign.dialog.acceptanceLabel` | 验收标准 | Acceptance criteria |
| `workbench.assign.dialog.acceptancePlaceholder` | 可验证条件：截图、命令、产物路径 | Verifiable conditions: screenshots, commands, artifact paths |
| `workbench.assign.dialog.acceptanceCount` | {n}/10 条 · 每条 ≤500 | {n}/10 items · ≤500 each |
| `workbench.assign.dialog.priority` | 优先级 | Priority |
| `workbench.assign.dialog.stage` | 关联流水线阶段 | Pipeline stage |
| `workbench.assign.dialog.stageAuto` | 自动判断 | Auto-detect |
| `workbench.assign.dialog.stageNone` | 不关联（临时） | No stage (ad-hoc) |
| `workbench.assign.dialog.stage.product` | 需求分析 | Requirements |
| `workbench.assign.dialog.stage.design` | UI 设计 | UI design |
| `workbench.assign.dialog.stage.development` | 开发实现 | Development |
| `workbench.assign.dialog.stage.testing` | 测试验收 | Testing |
| `workbench.assign.dialog.stage.acceptance` | 验收复核 | Acceptance review |
| `workbench.assign.dialog.stage.approval` | 人工确认 | Human sign-off |
| `workbench.assign.dialog.stage.release` | 发布上线 | Release |
| `workbench.assign.dialog.stageLocked` | 人工确认 / 发布只能由 Owner 在流水线面板审批，不可指派 | Human sign-off / release are owner gates and cannot be assigned |
| `workbench.assign.dialog.stageGateHint` | 关联阶段将走双复核闸门；临时任务不改变流水线，结果只在对话汇报 | Linked stages go through the dual-review gates; ad-hoc tasks do not change the pipeline and report in chat only |
| `workbench.assign.dialog.stageAutoHint` | 按当前 active/review 阶段推导；已完成轮次请选临时任务或发起变更 | Derived from the current active/review stage; for completed rounds choose ad-hoc or start a change round |
| `workbench.assign.dialog.artifactLabel` | 期望产物路径 | Expected artefact paths |
| `workbench.assign.dialog.artifactPlaceholder` | docs/pipeline/…（可空） | docs/pipeline/… (optional) |
| `workbench.assign.dialog.attachmentLabel` | 附件 | Attachments |
| `workbench.assign.dialog.attachmentHint` | MVP：可拖入当前对话；上传为后续增强 | MVP: drag into the current chat; uploads come later |
| `workbench.assign.dialog.attachmentDrop` | 拖入当前对话，或粘贴产物路径（可选） | Drag into the current chat, or paste artefact paths (optional) |
| `workbench.assign.dialog.footerHint` | 生成结构化指派单发到当前对话，由 Lead 执行；不直接改写流水线。 | Generates a structured order in the current chat, executed by the Lead; the pipeline is never written directly. |
| `workbench.assign.dialog.cancel` | 取消 | Cancel |
| `workbench.assign.dialog.submit` | 指派给 Agent | Assign to agent |
| `workbench.assign.dialog.submitting` | 指派中… | Assigning… |
| `workbench.assign.dialog.close` | 关闭 | Close |
| `workbench.assign.dialog.required` | 必填 | Required |
| `workbench.assign.dialog.tooLong` | 超出长度限制 | Exceeds the length limit |
| `workbench.assign.dialog.acceptanceRange` | 验收标准需 1–10 条 | Provide 1–10 acceptance items |
| `workbench.assign.dialog.saveFailed` | 指派保存失败：{message} | Could not save the assignment: {message} |
| `workbench.assign.dialog.sendFailed` | 已保存，但发送失败；可重发指派单 | Saved, but sending failed; retry the order |
| `workbench.assign.dialog.retrySend` | 重发指派单 | Retry sending |
| `workbench.assign.dialog.success` | 已派发到当前对话 | Dispatched to the current chat |

### 8.4 状态卡与操作

| Key | 中文 | English |
|---|---|---|
| `workbench.assign.statusTitle` | 团队与指派 | Team & assignments |
| `workbench.assign.summary` | 进行中 {running} · 待你确认 {review} · 已完成 {done} · 本周共 {total} 条 · 打回 {failed} | {running} running · {review} awaiting you · {done} done · {total} this week · {failed} sent back |
| `workbench.assign.filter.all` | 全部 | All |
| `workbench.assign.filter.running` | 进行中 | Running |
| `workbench.assign.filter.review` | 待你确认 | Awaiting you |
| `workbench.assign.filter.done` | 已完成 | Done |
| `workbench.assign.progress.dispatched` | 已派发 | Dispatched |
| `workbench.assign.progress.waitingLead` | 等待 Lead | Waiting for Lead |
| `workbench.assign.progress.running` | 执行中 | Running |
| `workbench.assign.progress.review` | 待你确认 | Awaiting you |
| `workbench.assign.progress.done` | 已完成 | Done |
| `workbench.assign.progress.failed` | 已打回 | Sent back |
| `workbench.assign.linkedGateHint` | 关联阶段仍走双复核；指派不改流水线 | Linked stages still use the dual review; assignments never write the pipeline |
| `workbench.assign.tempHint` | 临时任务：仅在对话汇报 | Ad-hoc task: reported in chat only |
| `workbench.assign.action.copyToast` | 已复制指派单；请在当前对话查看 | Order copied; check the current chat |
| `workbench.assign.action.remind` | 催办 | Nudge |
| `workbench.assign.action.remindToast` | 已发送催办提醒 | Nudge sent |
| `workbench.assign.action.reject` | 打回 | Send back |
| `workbench.assign.action.rejectTitle` | 打回指派任务 | Send back assignment |
| `workbench.assign.action.rejectReason` | 打回原因（必填） | Reason (required) |
| `workbench.assign.action.rejectPlaceholder` | 写清原因与期望修正… | Explain why and what should change… |
| `workbench.assign.action.rejectSubmit` | 确认打回 | Confirm send back |
| `workbench.assign.action.approve` | 通过并完成 | Approve & complete |
| `workbench.assign.action.reassignHint` | 再指派会新建记录，原记录保留 | Reassign creates a new record and keeps this one |
| `workbench.assign.action.cancel` | 取消 | Cancel |
| `workbench.assign.action.cancelConfirm` | 取消这条指派？记录会保留为已取消。 | Cancel this assignment? It stays recorded as cancelled. |
| `workbench.assign.action.confirmCancel` | 确认取消 | Confirm cancel |
| `workbench.assign.action.viewReason` | 查看原因 | View reason |
| `workbench.assign.action.delete` | 删除 | Delete |
| `workbench.assign.action.deleteConfirm` | 删除该记录？不可恢复。 | Delete this record? This cannot be undone. |
| `workbench.assign.emptyFiltered` | 没有符合筛选条件的指派 | No assignments match this filter |
| `workbench.assign.limitHint` | 最多保留 100 条；请清理终态记录 | Up to 100 records; clean up finished ones |
| `workbench.assign.waitingLong` | 已等待超过 30 分钟，可催办 | Waiting over 30 minutes; consider nudging |
| `workbench.assign.historyHint` | 复制派单 / 催办 / 打回 / 取消 / 再指派都会追加到记录；再指派=新建记录并保留原记录，打回需填写原因。 | Copy/nudge/send-back/cancel/reassign all append to history; reassign creates a new record and keeps the original, send-back requires a reason. |
| `workbench.assign.loadFailedRetry` | 重试 | Retry |
| `workbench.assign.retry` | 重新读取 | Reload |

> 词表合计 **122 键**；实现时以 `workbench.assign.*` 为唯一前缀，缺键回退中文并在验收项 74b92113c5 检查。

---

## 9. 无障碍、响应式与动效

### 9.1 键盘与 ARIA（MUST）

- 抽屉/底部面板：`role="dialog"` + `aria-modal="true"` + `aria-labelledby`（标题）+ `aria-describedby`（闸门提示）；打开时焦点移到第一个字段（任务标题）或关闭按钮（按实现），Tab/Shift+Tab 在面板内循环；Esc 关闭并把焦点归还「指派任务」按钮；关闭时恢复背景滚动。
- 所有可交互元素可键盘到达、有可见 2px 焦点环（≥3:1）；图标按钮 `aria-label`；状态 pill 有文本；`aria-live="polite"` 播报 toast/保存结果；打回弹窗未填原因时禁用提交并提示 `aria-invalid`。
- 触控目标 ≥44×44（视觉可 32–40，命中区用 padding 扩展；桌面指针密集场景至少 24×24 + 8px 间距）。
- 状态不靠颜色：成员/记录/进度均有文字；打回红色同时有「已打回」文字与原因。
- 屏幕阅读器：进度使用 `aria-label="进度：已派发，等待 Lead，执行中，待你确认，已完成；当前执行中"`；表格/列表用语义结构（`ul/li` 或 `table`），行操作按钮可读名称包含任务标题。

### 9.2 响应式

| 断点 | 工作台卡片 | 抽屉 | 状态行 |
|---|---|---|---|
| 360 | 单列；chips 1–2 列；显示最近 3 条 + 展开 | 底部面板 100vw / 90vh；按钮全宽 | 隐藏时间/类型列，进度折叠为「步骤 3/5」+ 展开；操作「⋯」 |
| 768 | 单列；chips 2–3 列；5 条 | 底部面板 | 进度横向可滚动，操作两行内 |
| 1280 | 1080 内容宽；chips 3 列；5 条 | 608 右侧抽屉 | 完整五段 + 操作 |
| 1440（稿） | 同上，左右留白 | 608 右侧抽屉 | 完整 |

- 无横向溢出；长标题/说明 `overflow-wrap:anywhere`；文本放大 200% 不截断/不重叠；深浅主题 × 窄屏至少抽查 360 + 1280。

### 9.3 动效（MUST）

- 抽屉进入 200–300ms ease-out、退出 150–200ms；行状态 pill 变化 150ms；toast 150ms。
- 只动 `transform/opacity`；`prefers-reduced-motion` 下抽屉直接显示、取消位移动画；loading 指示器允许但需可关闭/降级。
- 无自动播放/闪烁；动效不承载唯一信息。

### 9.4 对比度（浅色主题实测）

| 用途 | 色值 | 对比度（底） | 判定 |
|---|---|---|---|
| 主文字/标题 | #0f1115 | 18.9:1（白） | ✅ |
| 次文字/元信息 | #61666b | 5.8:1（白）/5.46:1（#f7f8fa） | ✅ |
| 链接/信息文字 | #2563eb | 5.17:1（白）/4.68:1（#eef4ff） | ✅ |
| 成功文字 | #1a7f37 on #e6faed | 4.66:1 | ✅ |
| 警告文字 | #b45309 on #fef5e7 | 4.65:1 | ✅ |
| 错误文字 | #d1242f on #fef2f2 | 4.79:1 | ✅ |
| 主按钮白字 | #ffffff on #0f1115 | 18.9:1 | ✅ |
| 空闲点（非文本） | #7f8287 on #f7f8fa | 3.63:1 | ✅ |
| 边框/分割 | #e3e8ef | 装饰 | 仅分隔，控件边界另用 label-secondary |

> 实现必须使用 `--dsw-alias-*` 与 v1.2.73 的 `*-text` 变体；深色主题复测同等项。

---

## 10. Host 数据契约（`assignments.js`）

### 10.1 文件与写入

- 路径：`<workspace>/.dsh/agent-assignments.json`；按工作区隔离；不进 Git（`.dsh/.gitignore` 已覆盖）。
- 写入：temp 文件 + `rename` 原子替换；per-root 串行锁；单文件 ≤1MB；≤100 条；文件不存在 = 空列表；损坏返回 `corrupt`（含路径，不静默清空/覆盖）。
- 读取：按 `updatedAt` 倒序返回；不读取 `expectedArtifacts` 指向的文件。

### 10.2 记录结构

```json
{
  "version": 1,
  "items": [
    {
      "id": "a1b2c3d4e5",
      "round": 3,
      "title": "补充验收页脚证据并复测移动端",
      "detail": "背景…\n期望…\n不做…",
      "acceptance": ["360/768 截图无截断", "npm run check/npm test 通过", "证据写入 docs/pipeline/design/evidence.md"],
      "assignedTo": { "role": "qa-engineer", "member": "opc-qa" },
      "stageId": "testing",
      "priority": "P1",
      "expectedArtifacts": ["docs/pipeline/design/evidence.md"],
      "status": "dispatched",
      "note": "",
      "createdAt": 1793070000000,
      "updatedAt": 1793070000000,
      "history": [
        { "at": 1793070000000, "status": "dispatched", "note": "", "actor": "owner" }
      ]
    }
  ]
}
```

- `id` 10–64 字符、文件内唯一；`round` 从 `pipeline.json` 的 round 读取（读不到=1，**只读不写**）。
- `title` 1–120；`detail` 1–4000；`acceptance` 1–10 条、每条 1–500；`expectedArtifacts` 建议 ≤10 条、每条 ≤500（待实现确认，§17 未决）。
- `assignedTo` 三选一互斥：`role` ∈ `product-manager/ui-designer/fullstack-developer/qa-engineer/project-manager-agent/devops`；`member` 自由填写；`newAgent{name, role}`。
- `stageId` ∈ `product/design/development/testing/acceptance` 或空；**approval/release 拒绝**（`bad-request`）。
- `status` ∈ `dispatched/running/review/done/failed/cancelled`；`note` ≤4000，打回必填；`history` ≤50，actor=`owner`。

### 10.3 状态机

```
dispatched ──开始执行/Lead 接单──▶ running ──提交汇报──▶ review ──通过并完成──▶ done
     │                               │                    │
     ├────────────── 打回（note 必填）──────────────────▶ failed ──再指派──▶ 新记录(dispatched)
     └────────────── 取消 ──────────────────────────────▶ cancelled
```

| 迁移 | 允许？ | 备注 |
|---|---|---|
| dispatched→running→review→done | ✅ | history append；Owner 可手动推进 |
| 任意→failed | ✅ | 需 note；不自动重派 |
| 任意→cancelled | ✅ | 终态；可再指派 |
| dispatched→done、done→running、review→dispatched 等 | ❌ `bad-transition` | 文件不变 |
| 终态（done/failed/cancelled）→ running/review | ❌ | 只能「再指派」新记录 |

### 10.4 四个路由 op（owner-only，无模型工具）

| op | 入参 | 出参 | 说明 |
|---|---|---|---|
| `assignmentList` | `{root}` | `{items[], path, limits:{maxItems,maxBytes}}`（可附 counts） | 倒序；文件不存在=空 |
| `assignmentSave` | `{root, title, detail, acceptance, assignedTo, stageId?, priority?, expectedArtifacts?}` | 新记录 | 校验字段/互斥/阶段；生成 id/round/时间/history 首条；status=dispatched |
| `assignmentUpdate` | `{root, id, status?, note?}` | 更新后记录 | 状态机校验；打回 note；append history；内容字段不可改（走再指派） |
| `assignmentDelete` | `{root, id}` | `{removed:id}` | 仅终态建议（待确认）；不存在→not-found |

- 接线：`index.js` 新增 `import * as assignments from './assignments.js'`，`dispatch()` switch 与 pipeline 同级增加 4 个 case；handler 包装 `assignmentRoot(ctx, body.root)`（复用 `resolveRoot` + `ssh.isSshRoot` 检查）。
- 错误码（稳定）：`bad-root` / `bad-request` / `bad-id` / `bad-transition` / `not-found` / `full` / `too-large` / `corrupt` / `ssh-unsupported`。
- **无模型工具**：不注册 agent tool，避免 Agent 自派；只有 Owner 面板 4 op。

### 10.5 错误与恢复

| 场景 | 行为 |
|---|---|
| 必填/长度/互斥/阶段非法 | `bad-request` + 字段；客户端就地提示、不落盘、不丢输入 |
| >100 条 / >1MB | `full` / `too-large`；原文件不变；提示清理终态 |
| 非法状态流转 | `bad-transition`；文件不变；客户端只展示可用操作 |
| 打回空 note | `bad-request`；打回弹窗禁用提交 |
| 不存在/非法 id | `not-found` / `bad-id` |
| SSH 工作区 | 4 op 均 `ssh-unsupported`；卡片禁用 + 提示 |
| 文件损坏 | `corrupt`（含路径），不静默清空；提示备份/修复 |
| 并发保存/更新 | per-root 串行锁；10 次并发保存 = 10 条且文件可解析 |
| 落盘成功但发送失败 | 记录保留 `dispatched`；UI「已保存，发送失败」+ 重发 |
| 写失败 | 原子写保留旧文件；稳定错误；可重试 |
| 刷新/重启 | 从 JSON 恢复；`.dsh/.gitignore` 保证不进 Git |
| 新建 Agent spawn 失败 | Lead 在对话回报；记录保留；可再指派/改 member/role |

### 10.6 不变式（验收项 1d2e016bda）

- **指派不写 pipeline**：`assignments.js` 不以任何方式写 `.dsh/pipeline.json`；`round` 仅读取，阶段状态只读推导。
- 指派 save/update/delete 前后 `.dsh/pipeline.json` 内容哈希完全一致（`sha256sum` 对比）。
- 取消/完成/打回均不触发 pipeline 状态变化；`stageId=approval|release` 被拒绝。
- 临时任务完成后流水线七阶段不变。

---

## 11. 实现注意点（给开发）

### 11.1 `client.js`（当前 v1.2.75 行号，±几行以实际为准）

| # | 位置 | 改动 |
|---|---|---|
| 1 | 状态 hooks（≈8049，`workbenchDraft` 附近） | 新增：`assignmentItems`、`assignmentBusy`、`assignmentError`、`assignmentDrawerOpen`、`assignmentMode`（role/member/new）、草稿字段（title/detail/acceptance[]/priority/stageId/artifacts/member/newAgent）、`assignmentFilter`、`assignmentExpanded`、`assignmentRejectTarget`、`assignmentRejectNote`、`assignmentSubmitting`、`assignmentToast` |
| 2 | 数据加载（≈9966 `loadWorkbench` / ≈10267 `loadPipeline` 附近） | 新增 `loadAssignments()`：`call('assignmentList', {root})`；在 `openWorkbench` / 刷新 / 保存/更新后调用；错误写 `assignmentError` |
| 3 | 卡片变量 | 新增 `const assignmentCard = h('div',{className:'ds-wb-card ds-wb-assign'}, ...)`，放在 `requirementCard`（≈16782）之后、`flowCard`（≈17361）之前 |
| 4 | JSX 卡片列表（≈17556） | 在 `requirementCard` 与 `flowCard` 之间插入 `assignmentCard`（保持需求顺序） |
| 5 | 抽屉渲染 | 在 `renderWorkbenchPage` 返回的根 `ds-wb-page` 末尾（`ds-wb-page-scroll` 之后）渲染 overlay + `role="dialog"` 面板；用独立组件 `AssignmentDrawer` 或函数；`useEffect` 管理焦点/Esc/滚动锁 |
| 6 | 事件处理 | 参考 `openWorkbench`/`closeWorkbench`（≈9950）：`openAssignmentDrawer(prefill)`、`closeAssignmentDrawer()`、`submitAssignment()`、`updateAssignmentStatus(id,status,note)`、`copyAssignmentOrder(item)`、`remindAssignment(id)`、`cancelAssignment(id)`、`reassignAssignment(item)` |
| 7 | 发送 | `sendPromptText`（≈10743）返回 boolean；保存后 false → toast「已保存，发送失败」+ 重发按钮；不要删记录 |
| 8 | API 调用 | `call(op, params)`（≈2537）；`assignmentList/Save/Update/Delete`；错误码映射到 i18n；SSH 用 `isSshRootPath(state.root)` 禁用 |
| 9 | toast | `showToast`（≈9055）+ `aria-live` 容器；保存成功/复制/催办/打回/取消 |
| 10 | i18n | zh 字典 ≈399–560、en ≈1449–1624（`notify.*` 之前）插入 §8 的 122 键；缺键回退中文 |
| 11 | CSS | `.ds-wb-assign` + `.ds-wb-assign-*` + `.ds-wb-assign-drawer` + 底部面板媒体查询，追加在现有 `.ds-wb-*`（≈22770–22850）之后；复用 `ds-wb-card`、`ds-btn`、`ds-pipe-input/textarea`、`ds-wb-chip` 风格 |
| 12 | locale meta（可选 P1） | `locale/zh.json`/`en.json` 描述补「工作台指派」；不阻塞 |

**可复用组件**：`ds-wb-card`（白底/圆角/边框）、`ds-wb-card-title`、`ds-wb-actions`、`ds-btn`/`ds-linkbtn`、`ds-pipe-input`/`ds-pipe-textarea`、`ds-wb-status-pill`、`ds-wb-chip`、`ds-wb-count`、`ds-wb-notice`；新样式只加前缀 `ds-wb-assign-*`，不修改现有类语义。

### 11.2 Host（`assignments.js` + `index.js`）

- 新模块参照 `acceptance.js`/`pipeline.js`：常量（限值/状态/角色）、`AssignmentError`、校验函数、`readAssignments`/`listAssignments`/`saveAssignment`/`updateAssignment`/`deleteAssignment`、原子写 + `withMutationLock`；不注册模型工具。
- `index.js`：import 新模块；在 `dispatch()` 的 pipeline case 前/后加 4 case；新增 `assignmentRoot(ctx, requested)`（`resolveRoot` → `ssh.isSshRoot` 抛 `ssh-unsupported`）；handler wrapper 参考 `pipelineList/pipelineSetRequirement`（≈1192–1240）。
- 不新增依赖；锁/原子写用 `node:fs` promises + `rename`；错误用现有 `SideError` 机制。
- 读 round：只读 `.dsh/pipeline.json`（pipeline.readPipeline），不写。

### 11.3 必须联调的 5 个交互

1. **保存→发送失败**：`assignmentSave` 成功、`sendPromptText` false；卡片出现 dispatched、toast 提示、重发不新建记录。
2. **状态推进/打回/再指派**：history 追加、筛选计数、刷新/重启持久；打回空原因被 UI 与 Host 双重拒绝。
3. **阶段推导**：`pipelineDoc` 当前 active/review → 自动判断 chip 预选；已完成/无需求 → 提示临时任务/变更轮。
4. **SSH/corrupt/full**：卡片禁用 + 提示；`corrupt` 不覆盖文件；`full` 提示清理。
5. **抽屉焦点/窄屏**：`role=dialog`、Esc 归还焦点、Tab 循环；≤768 底部面板 sticky header/footer、键盘不遮挡。

### 11.4 自查命令

```bash
npm run check
npm test
node .dsh/tmp/team/pipeline-selftest.mjs
node .dsh/tmp/team/review-selftest.mjs 2>/dev/null || true
git diff package.json dsh-web-filebrowser-plugin/package.json   # dependencies 不新增
```

---

## 12. MVP 缩减清单（验收按此，不按提案稿过度要求）

| 项 | 提案/初稿 | MVP 定稿（本设计） |
|---|---|---|
| 成员实时状态 | 显示空闲/执行中/阻塞（甚至离线） | **仅三态（空闲/执行中/待你确认）且由指派记录推导**；标注「实时以团队面板为准」，不显示阻塞/离线 |
| 打开团队面板 | 深链 ↗ | **团队面板入口**（复制入口说明 + toast），无死链、不报错 |
| 关联阶段选项 | 含人工确认/发布 | **approval/release 置灰**（锁 + 提示「仅 Owner 在流水线面板审批」）；可关联 5 阶段 + 自动判断 + 不关联 |
| 附件 | 上传附件 | **提示拖入当前对话**；上传为后续增强，不阻塞提交 |
| 查看对话 | 消息定位 | **复制派单 + 提示当前对话**（MVP 无消息 ID） |
| 超时 | 自动失败 | 不自动改状态；>30 分钟显示等待提示 + 催办 |
| 成员状态权威 | 插件读取团队服务 | 记录推导；团队面板权威；不做 owner 级 API |
| 卡片位置 | 项目状态与项目流程之间 | 同需求：需要你处理 → 项目状态 → 团队与指派 → 项目流程（见屏幕 1） |
| 空态 | 未画 | `assign-empty-state` 落地稿 + 空态文案 |

---

## 13. 落地稿索引与规格

### 13.1 文件

| 文件 | 对应屏幕 | 说明 |
|---|---|---|
| [assign-workbench.svg](design/assign-workbench.svg) / [.png](design/assign-workbench.png) | 工作台卡片 | 需求顺序、6 chips 三态推导、最近 5 条、团队面板入口、页脚提示 |
| [assign-dialog.svg](design/assign-dialog.svg) / [.png](design/assign-dialog.png) | 指派抽屉 | 608px 右侧抽屉；字段完整；approval/release 置灰；附件 MVP 降级 |
| [assign-status.svg](design/assign-status.svg) / [.png](design/assign-status.png) | 状态卡 | 4 行：执行中/待你确认/已完成/已打回；五段进度；复制派单/催办/打回/取消/再指派 |
| [assign-empty-state.svg](design/assign-empty-state.svg) / [.png](design/assign-empty-state.png) | 卡片空态 | 0 条记录、CTA、团队面板入口 |
| [archive-v1.2.73-agent-capabilities.md](design/archive-v1.2.73-agent-capabilities.md) | 上轮归档 | v1.2.73 专业设计质量标准（保留引用资源） |

### 13.2 尺寸/颜色/字体

- 画布：1440×1024（逻辑），PNG 2880×2048（@2x，sharp/librsvg + Noto Sans SC 渲染，中文无豆腐块）。
- 工作台：内容 max-width 1080、卡片圆角 12、内边距 20；团队卡 1080×432；成员 chip 338×48；最近行 30；项目流程 1080×136。
- 抽屉：608×1024；内容宽 536；字段 42–76；按钮 44；角色 chips 172×32；阶段 chips 172×30；底部面板 ≤768 全宽 90vh。
- 字体：页面标题 24/32；卡标题 13/20；正文 14/20；标签/按钮 13；元信息 12；行高均 ≥1.4；无 <11px 信息文本。
- 颜色/token 与对比度：见 §9.4；占位/禁用不低到不可见；深浅主题均测。

### 13.3 文案与 i18n

- 通用文案见 §8；屏幕关键文案：
  - 卡片：团队与指派 / 6 名角色成员 · 2 人执行中 · 1 人待确认（按指派记录推导）/ 最近指派 / 共 5 条 · 默认展示最近 5 条 / 指派任务 / 团队面板入口 / 记录保存在 .dsh/agent-assignments.json
  - 抽屉：指派任务 / MVP · 结构化派单 / 交给谁 / 按角色·当前成员·新建 Agent / 任务标题 / 详细说明 / 验收标准 / 优先级 / 关联流水线阶段 / 期望产物路径 / 附件 / 人工确认·发布置灰提示 / 双复核提示 / 指派给 Agent
  - 状态卡：全部/进行中/待你确认/已完成 / 已派发→等待 Lead→执行中→待你确认→已完成 / 复制派单 / 催办 / 打回 / 取消 / 通过并完成 / 再指派 / 查看原因

---

### 13.4 间距例外与实现优先级

落地稿按 4/8px 体系绘制；逐项核对如下（**允许开发按标准值落地，无需回改设计稿**）：

| 位置 | 落地稿实测（行距/列距） | 4/8 标准 | 处理 |
|---|---|---|---|
| 工作台成员 chips | 8 / 12 | 8 / 12 | ✅ 一致，保留 |
| 抽屉角色 chips | 8 / 10 | 8 / 12 | 实现按 **列距 12** 落地；10px 仅为视觉稿压缩，不作为例外保留 |
| 抽屉阶段 chips | 6 / 10 | 8 / 12 | **例外**：落地稿为在 1024 高度内展示全部字段压缩为 6px；实现按 **8px** 落地（推荐、允许），若保留 6px 必须在代码注释与本表记录理由（紧凑抽屉、非信息层级间距），并计入间距债务 |
| 最近指派行距 | 3（行分隔） | 8（区块间距） | 实现用 8px 行间距或 1px 分隔线；3px 仅为视觉分隔，不作 token |

- 规则：**新增设计不得再用 6px**；若历史/密集控件保留 6px，需在实现 PR 或设计记录标注「例外 + 理由 + 影响范围」。
- 特别说明：**若实现把成员 chips 间距设为 6px，同样属于例外**（仅限紧凑/小屏场景），必须在实现注释与验收记录写明理由；推荐实现直接按 8px，视觉稿无需回改。
- 验收：按 8px 判定；6px 不计为阻断，但必须在设计/实现记录中说明；开发者可自行改为 8px，无需回改本设计稿或等待复审。


---

## 14. 验收对照（12 条 acceptance items）

| # | 验收项（id） | 设计落点 | 验证方式（自动/人工） |
|---|---|---|---|
| 1 | 工作台「团队与指派」卡…（`64983c295b`） | §3（卡片顺序/解剖/5 条/空态/推导状态/团队入口） | 刷新工作台核对顺序与文案；6 chips；清空/新工作区看空态；最近 5 条可展开；团队入口点击不报错（复制说明） |
| 2 | 提交后落盘 + 对话收到结构化指派单 + toast/卡片（`ae5ecf6a53`） | §4.2 提交态、§7 模板、§10.4 save | 提交后读 `.dsh/agent-assignments.json`（status=dispatched、字段/round/history）；检查对话消息字段；toast 与卡片刷新；落盘成功/发送失败重发 |
| 3 | 抽屉字段与校验（`8d70f5e331`） | §4.2 字段表/错误态；§4.4 尺寸 | 空提交、超长、验收 0/11 条、计数器、错误就地不丢输入、P1 默认、新建 Agent 名称+角色 |
| 4 | 关联阶段选择（`6db436479d`） | §4.3 | 检查自动判断 + 5 阶段 + 不关联；approval/release 置灰且提示；payload 拒绝 approval/release |
| 5 | 状态机与操作持久（`684ebc0d80`） | §5、§10.3 | GUI/op 推进 dispatched→running→review→done；打回需 note→failed；催办/取消/再指派；刷新/重启仍存在；history ≤50 |
| 6 | 指派不修改流水线（`1d2e016bda`） | §10.6 | 指派前后 `sha256sum .dsh/pipeline.json` 一致；临时任务完成/取消仍不变；approval/release 不可选 |
| 7 | Host 4 op 校验/上限/SSH/错误码（`e37210ec44`） | §10.4/§10.5 | ≥8 边界用例：必填、长度、full、too-large、bad-transition、空 note、not-found、ssh-unsupported；错误码稳定 |
| 8 | 并发与原子写（`5048eff8ea`） | §10.1/§10.5 | 10 次并发 save = 10 条、文件可解析；无半写；坏文件返回 corrupt 不覆盖 |
| 9 | i18n/无障碍/窄屏/无新依赖（`74b92113c5`） | §8、§9、§12 | 切 zh/en 巡检无缺 key；Tab/Esc/焦点环/aria；≤768 底部面板；`git diff` dependencies 不变；`prefers-reduced-motion` |
| 10 | 测试全绿（`c90a901f74`） | §11.4 | 四条命令退出码/末尾；host-smoke 扩展 assignments；既有功能回归 |
| 11 | 三张效果图落地（`19895d23f0`） | §13 | 逐项对照卡片/抽屉/状态卡；允许 §12 缩减；打回态/已完成/空态齐备；400/窄屏不溢出 |
| 12 | 文档与版本（`7c8fa9c999`） | §18 | AGENT_TEAM/PLAYBOOK 指派小节、ACCEPTANCE 批次 12、CHANGELOG 1.2.75、两个 package.json 口径 |

> **版本口径（已解决）**：需求 §9 明确发布 **1.2.75**；此前验收项 `7c8fa9c999` 的「CHANGELOG 1.2.74」文案已由 Lead/QA 拍板修正/对齐，不再作为风险。设计阶段不改验收项状态。

---

## 15. 设计自检评分（五维 rubric + 本轮自评）

> 依据 v1.2.73 专业设计标准（归档：[design/archive-v1.2.73-agent-capabilities.md](design/archive-v1.2.73-agent-capabilities.md)）：**书面结论：每维≥3、均分≥4、must 项一票否决**（即每维 ≥3、五维均分 ≥4.0 才可提交）。本表为 acceptance B2（阻断）打回后补录（2026-10-27）；设计阶段提交前必须完成本表，acceptance 复核可抽查证据。

### 15.1 五维 rubric（0–5 锚点）

| 维度 | 0–1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| **视觉层级** | 无层级/信息同权重 | 层级混乱、主次不分 | 有标题/正文/辅助三级 | 层级清晰、一屏一个主行动、扫视路径明确 | 层级即引导，可作团队范例 |
| **清晰度** | 看不懂/术语混乱 | 关键信息缺失或歧义 | 主要信息可懂 | 文案准确、状态可读、无歧义、术语一致 | 新手无需解释即可完成 |
| **一致性** | 风格混搭 | 多处 token/术语/间距不一致 | 基本沿用现有体系 | token/组件/术语统一，深浅主题一致 | 建立可复用模式并被他人沿用 |
| **反馈** | 操作无反馈 | 缺 loading/错误/成功反馈 | 关键操作有反馈 | 八态关键项齐备、错误可恢复、防重复 | 反馈节奏与动效编排到位 |
| **可访问性** | 不可键盘操作/对比度严重不足 | 多处对比度或 ARIA 缺陷 | 基本键盘可达、主要文本达标 | 对比度/焦点/ARIA/触控/降级全部达标 | 通过屏幕阅读器实测，体验完整 |

### 15.2 门槛与一票否决

- 每维 **≥3**、五维均分 **≥4.0** 才可提交；**≥4.5** 为优秀。
- **must 一票否决**（任一失败即不可提交）：
  1. **对比度**：正文 <4.5:1，或大字号 <3:1，或关键非文本（控件边界/焦点/状态）<3:1；
  2. **44×44**：触控目标无 44×44 方案，且无「24×24 + 8px 间距」例外说明；
  3. **八态**：focus / disabled / loading / empty / error 任一关键态缺失且无 N/A 理由；
  4. **键盘/ARIA**：键盘不可达、焦点不可见、抽屉无 `role=dialog` / `aria-modal` / Esc 归还焦点；
  5. **来源**：缺调研来源、伪造来源或无法回溯（本项沿用需求 §7 的 7 个来源）；
  6. **迭代**：缺「渲染 → 检查 → 修正」（渲染→检查→修正）记录或没有复评；
  7. **死链**：本地链接缺失、团队面板入口出现死链/报错。
- 每维必须附证据（文件/截图/实测数值/grep）；无证据降一档，关键项按 0 计；自评分不能替代 Owner 评审，acceptance 按同一 rubric 抽查。

### 15.3 本轮自评表（2026-10-27，v1.2.75 指派器）

| 维度 | 分数 | 证据 | 扣分点 |
|---|---|---|---|
| 视觉层级 | **4** | 4 套落地稿 [assign-workbench.svg](design/assign-workbench.svg) / [assign-dialog.svg](design/assign-dialog.svg) / [assign-status.svg](design/assign-status.svg) / [assign-empty-state.svg](design/assign-empty-state.svg)：卡片顺序清晰、抽屉字段分组、状态卡五段进度、空态 CTA 明确 | 状态卡 4 行信息密度偏高，窄屏需折叠 |
| 清晰度 | **5** | 字段/默认值/错误态齐全（§4.2）；六态状态 pill + 五段进度文案（§5）；i18n **122 键** zh/en（§8）；结构化派单模板字段固定（§7） | — |
| 一致性 | **4** | 复用 `ds-wb-*` / `ds-btn` / `ds-pipe-*` 与 `--dsw-alias-*`；字号/间距/圆角与 v1.2.73 标准一致（§9、§13.2） | 落地稿阶段 chips 行距 6px 为压缩例外（§13.4），实现需改 8px |
| 反馈 | **4** | 八态矩阵（§6）；提交中/成功/部分失败/打回/催办/取消均有文案与 toast（§4.2、§5.2）；`aria-live` 播报（§9.1） | 静态稿无法展示运行态；需实现后复测 toast/失败重发 |
| 可访问性 | **4** | 对比度实测：主文字 18.9:1、次文字 5.8:1、链接 5.17:1、成功 4.66:1、警告 4.65:1、错误 4.79:1、空闲点 3.63:1（§9.4）；44px 命中、焦点环、Esc/焦点归还、`prefers-reduced-motion`（§9.1/§9.3） | 未做真实读屏测试；≤768 底部面板仅规则未出稿 |
| **均分** | **4.2 / 5.0** | must 项全部通过（见 §15.4） | 结论：**可提交 acceptance 复核** |

### 15.4 must 项自检

| must 项 | 结果 | 证据 |
|---|---|---|
| 对比度 | ✅ | §9.4 实测表；正文/大字/非文本均达标，含禁用态可辨识说明 |
| 44×44 | ✅ | §9.1：抽屉按钮 44；卡片 36 视觉 + 命中区扩展至 44；桌面密集 ≥24×24 + 8px 间距 |
| 八态 | ✅ | §6 三组件×八态矩阵；屏幕覆盖默认/待确认/完成/打回/空态；loading/error 有规格 |
| 键盘/ARIA | ✅ | §9.1：`role=dialog`、`aria-modal`、焦点入/出、Esc、`aria-live`、可读名称 |
| 来源 | ✅ | 需求 §7 的 7 个来源（URL + 2026-10-27 + 结论）；§1 决策表；无伪造 |
| 迭代 | ✅ | §16 迭代记录：R1→R2 共修正 12 处，4 张 PNG 复检通过 |
| 死链 | ✅ | 本地链接检查 0 缺失；团队面板入口为「复制说明」而非死链（§3.3/§12） |

### 15.5 结论与复评

- **自评结论：均分 4.2/5.0，每维 ≥3，must 0 失败 → 设计可提交**；acceptance 复核可按上表抽查 4 套落地稿、对比度实测、i18n 122 键与迭代记录。
- 复评规则：acceptance 按同一 rubric 抽查，若与原评偏差 >1 分需说明；B2 打回项（本表补录）修复后，复评分记录于本节。
- 评分记录：2026-10-27 · v1.2.75 · 设计自评 4.2 · acceptance 复核结论：待复核。

---

## 16. 迭代记录（渲染 → 检查 → 修正）


本稿以提案 3 屏为基线，按需求修正后重新渲染检查（sharp + Noto Sans SC，@144dpi → 2880×2048）：

| 轮次 | 发现（对照需求/风格） | 修正 | 结果 |
|---|---|---|---|
| R1 工作台 | ① 卡片顺序为「项目状态 → 需要你处理」，与需求「需要你处理 → 项目状态」不符；② 最近仅 4 条，需求默认 5 条；③ 成员显示阻塞/离线，需求 MVP 仅三态推导；④ 「打开团队面板 ↗」暗示死链 | 重排卡片；压缩行高到 30 放 5 条；改三态推导 + 团队面板为准说明；改「团队面板入口」复制说明（无箭头） | 顺序/数量/状态/入口均符合 |
| R1 抽屉 | ① 发布上线为普通可选，需求必须置灰；② 附件为上传语义，需求 MVP 降级；③ 6 角色 chips 中误置灰项目经理/运维（角色本身可指派，置灰的是 approval/release 阶段） | 阶段改 3×3（自动判断 + 5 + 不关联 + 2 置灰锁）；附件改「拖入对话/后续增强」；恢复 6 角色可选 | 与 §4.3/§12 一致 |
| R1 状态卡 | ① 操作仅「查看对话」，需求 MVP 复制派单；② 缺取消；③ 团队入口死链 | 改「复制派单」并按状态补取消/打回/通过并完成/再指派；团队入口改说明；页脚补「再指派=新记录、打回需原因」 | 操作矩阵完整 |
| R2 | ① 空态成员仍显示执行中/待确认（与 0 条记录矛盾）；② 工作台副标题/长度溢出；③ 抽屉 624px 超出画布 | 空态全部空闲；缩短文案；抽屉改 608px | 全部修正，PNG 复检通过 |

> 证据：最终 4 张 PNG（与 SVG 同目录）；本表为设计过程记录。实现阶段可据此核对布局与状态。

---

## 17. 风险与未决

| # | 风险/未决 | 影响 | 缓解/决定 |
|---|---|---|---|
| 1 | 成员状态是推导值，非实时 | Owner 误判空闲 | 明确「以团队面板为准」+ 入口说明；不显示阻塞/离线；后续 B 路线再升级 |
| 2 | 派单消息被 Lead/模型漏读 | Agent 做偏 | 结构化模板 + 必填验收 + 回执/状态卡；派单后可催办 |
| 3 | 临时任务绕过流水线 | 质量风险 | 默认自动判断引导关联阶段；临时任务强制验收/产物；涉代码/需求提示变更 |
| 4 | 自动判断规则不准确 | 关联错阶段 | 只读推导当前 active/review；已完成/无需求提示临时任务/变更；允许手动改 |
| 5 | 附件降级不被接受 | 体验落差 | 明确「拖入对话」；上传作为后续增强（不阻塞提交） |
| 6 | 抽屉小屏 + 键盘遮挡 | 移动可用性 | 底部面板 sticky footer、滚动；≤768 规则见 §9.2 |
| 7 | 深链/团队面板真的无 API | 入口价值 | 复制说明 + 文案；不出现死链（验收项 1） |
| 8 | ~~版本/验收项文案不一致~~ **已解决（1.2.75）** | — | Lead/QA 已拍板：发布 1.2.75；`7c8fa9c999` 的 1.2.74 文案已对齐/修正 |
| 9 | `expectedArtifacts` 上限未定 | 实现/验收不一致 | 需求 §10.2 未决；建议 ≤10 条/≤500，开发与测试对齐后写入 |
| 10 | `assignmentDelete` 权限（仅终态 vs 任意） | 误删进行中任务 | 建议仅终态 + 二次确认；由 Owner/Lead 拍板 |
| 11 | 打回/再指派语义 | 记录丢失 | 再指派=新建记录、保留原记录；打回需 reason；本设计已按此出稿 |
| 12 | Host 改动需重启、客户端需重建 bundle | 验收误判 | 交付说明写明重启 + 强刷；GUI 复测在重启后 |

---

## 18. 版本与归档

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.2.73 | 2026-10-27 | 专业设计质量标准与自检体系（已归档到 [design/archive-v1.2.73-agent-capabilities.md](design/archive-v1.2.73-agent-capabilities.md)） |
| **v1.2.75** | **2026-10-27** | 工作台 Agent 指派器 MVP 正式设计：卡片/抽屉/状态卡/空态落地稿、i18n 122 键、Host 契约、实现注意点、12 条验收对照 |

- 版本口径（Lead 已拍板）：发布 **1.2.75**；插件 `package.json` 1.2.73 → **1.2.75**，根保持 **1.2.75**（不回退）；CHANGELOG `## 1.2.75 — 2026-10-27`（含此前 Unreleased 的编辑器标签右键菜单）；交付后根 +1 至 **1.2.76**，下一轮插件对齐 1.2.76。
- 本设计不改代码/需求/验收项；实现与验收由开发/测试阶段完成。
