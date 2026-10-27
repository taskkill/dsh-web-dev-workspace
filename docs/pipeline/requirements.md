# 需求：工作台 Agent 指派器 MVP —— 选 Agent → 写任务 → 指派 → 状态追踪（v1.2.75，第 3 轮变更）

- 提出人：Owner（项目经理/你）；日期：2026-10-27（Asia/Shanghai）；优先级：P0；目标版本：**v1.2.75**（第 3 轮变更，`roundScope=full`，七阶段 + 双复核不变；Lead 已拍板版本口径见 §9）。
- 上游依据：`.dsh/pipeline.json` 第 3 轮需求全文；提案 [AGENT_ASSIGN.md](../proposals/AGENT_ASSIGN.md)（MVP · 方案 A）；效果图与交互说明 [mockups/](../proposals/mockups/)（3 屏：工作台卡片 / 指派弹层 / 状态卡）。
- 一句话：「在工作台里把『谁、做什么、做到什么程度、属于哪一关、产出放哪』一次说清，生成结构化指派单交给当前对话的 Lead 执行，并把状态留在项目里可追踪。」
- 本文只做需求分析与可验收化，不改写 `.dsh/pipeline.json` 中的需求本身；范围、约束与验收标准以本文 + 需求详情为准。

## 1. 背景与问题

1. **工作台只有「按阶段启动并派发」**：Owner 只能把某个阶段整体派给角色，无法在工作台内指定某个 Agent（如 `opc-dev`）做一件具体小事，也无法追踪「谁在做、做到哪、产物是什么」。
2. **Harness 原生团队面板与「当前项目」脱节**：原生面板有成员 roster 与共享任务，但不知道这次指派属于第几轮、哪个阶段、验收标准与期望产物是什么；口述派单经常漏边界、验收与产物路径，事后难追溯。
3. **临时任务没有入口**：不改变流水线的修补/补证据/调研/清理类工作，Owner 只能口头让 Lead 做，缺少结构化记录。
4. **双复核不能被绕过**：任何「指派」都不能替代流水线闸门；阶段任务仍须 testing → acceptance → Owner 人工确认 → release。

**本轮解法（MVP · 方案 A）**：工作台新增「团队与指派」卡 → 指派抽屉 → 生成**结构化指派单**用现有 `sendPromptText` 发到当前对话 → Lead 用 Harness 原生 Agent Teams 工具（`spawn_teammate` / `send_message` / `team_task_*`）执行；插件只做**项目侧派工台 + 留痕 + 状态桥**，不重复实现团队通信，不直接 spawn。指派记录存本工作区 `.dsh/agent-assignments.json`。

## 2. 目标用户与核心场景

| 用户 | 场景 | 期望结果 |
|---|---|---|
| **Owner（你）** | 项目进行中，有一件具体任务要某个 Agent 做（如「补验收页脚证据并复测移动端」） | 在工作台 30 秒内完成「选角色/成员 → 写任务与验收 → 关联阶段或临时任务 → 指派」；之后能在状态卡看到进度、催办、通过/打回、再指派 |
| **Owner（你）** | 想确认当前谁在干什么 | 卡片显示 6 角色成员与「按指派记录推导」的状态；明确提示成员实时状态以 Harness 团队面板为权威，可一键打开团队面板 |
| **Lead（编排者）** | 收到工作台指派单 | 消息结构化、字段齐全（交给/任务/背景/验收/关联阶段/期望产物/优先级/执行要求/闸门提示），可直接 `spawn_teammate` / `send_message` / `team_task_*` 执行，不需要再追问 |
| **Lead（编排者）** | 执行完成 | 在对话中汇报产物与验证；Owner 在状态卡「通过并完成」或写原因打回；催办/再指派都留痕 |
| **项目经理 Agent（acceptance）** | 验收复核 | 能核对指派记录与验收结果是否与需求/阶段一致；临时任务与阶段任务的边界有书面依据 |
| **运维 / 其它角色** | 看到指派状态 | 不越权：approval/release 永远由 Owner 在面板审批，指派只影响对话执行，不改流水线状态 |

**核心场景**：
1. Owner 点「指派任务」→ 选「测试工程师 · opc-qa」→ 填标题/说明/验收 → 关联「测试验收」→ 提交 → 当前对话收到结构化指派单 + 卡片出现 `dispatched` 记录。
2. Lead 接单执行（对话/团队工具）→ Owner 状态卡点「下一条」推进 `running` → 完成汇报后 `review` → Owner「通过并完成」→ `done`；不满意则写原因「打回」→ `failed` → 可「再指派」（预填新弹层，保留原记录）。
3. 临时任务（不关联阶段）走同样流程，但明确「不改变流水线，结果只在对话汇报」。
4. 刷新页面 / 重启 Harness 后记录仍在；Web 端与窄屏都可完成指派与状态操作。

## 3. 范围

### 3.1 做什么

1. **Host 新模块 `dsh-web-filebrowser-plugin/assignments.js` + 主路由接线**
   - 数据文件 `.dsh/agent-assignments.json`（按工作区隔离、不进 Git、原子写、单文件 ≤1MB、≤100 条、per-root 串行锁，参照 `pipeline.js` / `acceptance.js` 的既有模式）。
   - 数据模型：`{ id, round, title, detail, acceptance[], assignedTo:{role?, member?, newAgent?{name, role}}, stageId?, priority:'P0'|'P1'|'P2', expectedArtifacts[], status, note, createdAt, updatedAt, history[] }`；`status ∈ dispatched / running / review / done / failed / cancelled`；`history[]` 条目 `{at,status,note,actor}`，上限 50。
   - 4 个主路由 op：`assignmentList` / `assignmentSave` / `assignmentUpdate` / `assignmentDelete`（校验字段/上限/root；SSH 工作区返回 `ssh-unsupported`；错误码稳定）。
   - 状态机校验：`dispatched→running→review→done`；任意 → `failed`/`cancelled`（打回需 `note`）；每次状态变更 append history；非法流转返回稳定错误且不改变文件。
2. **客户端（`client.js` + `locale/zh.json`、`locale/en.json`）**
   - 工作台新增「**团队与指派**」卡（位于「项目状态」与「项目流程」之间，示例顺序：需要你处理 → 项目状态 → **团队与指派** → 项目流程）。
   - 6 角色成员 chips + 状态（按指派记录推导：空闲/执行中/待你确认；并提示实时状态以 Harness 团队面板为准）、指派按钮、最近指派（默认 5 条，可展开）、空态、打开团队面板入口。
   - 指派弹层（桌面右侧抽屉 / 窄屏底部面板）：交给谁（按角色 / 当前成员自由填写 / 新建 Agent 名称+角色）、任务标题（≤120）、详细说明（≤4000）、验收标准（1–10 条，每条≤500，默认带「产物落盘 + 自测通过」）、优先级 P0/P1/P2、关联流水线阶段（默认自动判断；人工确认/发布不可选且有提示）、期望产物路径（可空）、附件（可选，复用上传或提示可拖入对话）。必填/长度校验，错误就地提示不丢输入。
   - 提交：先 `assignmentSave` 落盘（`status=dispatched`），再生成结构化指派单用 `sendPromptText` 发到当前对话；toast 与卡片状态更新。
   - 状态卡/列表：筛选（全部/进行中/待你确认/已完成）、五段进度（已派发→等待 Lead→执行中→待你确认→已完成）、关联阶段、时间、操作（查看对话/复制派单、催办、打回需原因、通过并完成、再指派、取消）；打回/再指派不丢失原记录。
   - 关联阶段的任务：**指派动作不得改写 `.dsh/pipeline.json`**；临时任务不改变流水线；文案明确仍走七阶段双复核闸门，人工确认/发布只能 Owner 在面板审批。
   - 中英文完整 i18n；无障碍（焦点环、aria-label、Esc 关闭归还焦点、44px 命中、状态不靠颜色、`aria-live` 提示）；不新增运行时依赖。
3. **文档与版本**
   - `docs/AGENT_TEAM.md`、`docs/PLAYBOOK.md` 增加「工作台指派」小节（边界：阶段任务走闸门、临时任务 Owner 确认、指派不改流水线）。
   - `docs/ACCEPTANCE.md` 新增「批次 12 · 工作台 Agent 指派器（v1.2.75）」；`CHANGELOG.md` 新增 `## 1.2.75 — 2026-10-27`（并纳入此前 Unreleased 的编辑器标签右键菜单变更）；根与插件 `package.json` 版本按 §9 版本口径执行（目标 **1.2.75**：插件升 1.2.75、根保持 1.2.75；交付后按硬性规定根 +1 至 1.2.76）。
   - 更新 `docs/proposals/AGENT_ASSIGN.md` 状态为「已实现」或加实现说明（可选）；不删除提案与 mockups。

### 3.2 不做什么

- **不实现 owner 级团队 API / 直接 spawn / 实时成员状态**（Harness 权限模型限制；提案 B/C 路线后续）。
- **不重复实现 Agent Team 面板**（成员 roster、共享任务依赖、写范围仍以原生面板为准）。
- **不做 SSH 工作区支持**（返回 `ssh-unsupported`，客户端降级提示）。
- **不引入运行时依赖**；不新增模型工具（避免 Agent 自派任务；只有 Owner 面板的 4 个 op）。
- **不改写/旁路流水线**：不直接改 `.dsh/pipeline.json`，不允许绕过 acceptance → approval 人工闸门。
- **不做移动端专门重构**（按 mockups 规则：≤768 抽屉转全宽底部面板）。
- 不做服务端搜索/分页/消息队列；不做实时对话定位（「查看对话」= 提示/复制派单，MVP 无消息 ID 定位）。
- 不复制第三方受版权/商标/界面素材内容。

## 4. 数据模型与 Host 接口规格

### 4.1 记录字段与约束

| 字段 | 类型/约束 | 说明 |
|---|---|---|
| `id` | string，10–64 字符，文件内唯一 | 参考 acceptance 的短 id 生成（10 位 hex） |
| `round` | integer ≥1 | 保存时从 `.dsh/pipeline.json` 的 `round` 读取（读不到则 1），**只读流水线，不写** |
| `title` | string，**必填**，trim 后 1–120 字符 | 一句话结果 |
| `detail` | string，**必填**，1–4000 字符 | 背景 / 期望 / 不做范围 |
| `acceptance` | string[]，**1–10 条**，每条 trim 后 1–500 字符 | 默认客户端预填 1 条「产物落盘 + 自测通过」 |
| `assignedTo` | object | `role` / `member` / `newAgent{name, role}` 三选一（详见 4.2） |
| `stageId` | string，可空 | 仅允许 `product/design/development/testing/acceptance`；`approval`/`release` 必须拒绝（`bad-request`）；空 = 临时任务 |
| `priority` | `P0` \| `P1` \| `P2`，默认 `P1` | — |
| `expectedArtifacts` | string[]，可空 | 建议 ≤10 条、每条 ≤500 字符（**上限待实现确认**，见 §10）；路径只存字符串，不读取文件 |
| `status` | enum 6 值 | 初值 `dispatched`；状态机见 4.3 |
| `note` | string，≤4000，可空 | 打回原因/备注；打回（→failed）时必填 |
| `createdAt`/`updatedAt` | 毫秒时间戳 | 原子写时更新 |
| `history` | 数组，≤50 条 | `{at, status, note, actor}`；`actor` 固定 `owner`（面板操作） |

- 文件级限制：**≤100 条记录/工作区**（超出返回 `full`）、**单文件 ≤1MB**（超出返回 `too-large`）；文件不存在 = 空列表；JSON 损坏返回 `corrupt`（含路径，**不静默清空**）。
- 写入：`temp 文件 + rename` 原子替换 + per-root 串行锁；写失败保留原文件（见 §8 错误恢复）。

### 4.2 `assignedTo` 三选一

| 形式 | 必填 | 说明 |
|---|---|---|
| 按角色 | `role` ∈ product-manager / ui-designer / fullstack-developer / qa-engineer / project-manager-agent / devops | 默认；Lead 按角色选当前成员（如 `opc-qa`） |
| 当前成员 | `member`（自由填写，如 `opc-dev`） | 用于指定具体成员；跨会话可能变化（以 role 为主） |
| 新建 Agent | `newAgent{name, role}` | 只记录 spawn 参数；由 Lead `spawn_teammate` 创建；名称建议 `opc-<role>-<n>` |

- 同一记录只允许一个目标（一个 role 或一个 member 或一个 newAgent）；三者互斥，冲突返回 `bad-request`。

### 4.3 状态机与操作

```
dispatched（已派发/等待 Lead）
  → running（执行中：Lead 接单/成员开工）
  → review（待你确认：完成汇报）
  → done（已完成）

任意状态 → failed（已打回；需 note，可再指派）
任意状态 → cancelled（已取消）
```

| 操作 | 允许前置状态 | 结果 | 要求 |
|---|---|---|---|
| 下一条/开始执行 | dispatched | running | append history |
| 提交汇报 | running | review | append history（note 可写产物/验证） |
| 通过并完成 | review | done | Owner 确认；append history |
| 打回 | dispatched/running/review | failed | **note 必填**，不自动重派；append history |
| 取消 | dispatched/running/review | cancelled | append history；取消后可再指派 |
| 催办 | dispatched/running | 状态不变 | 向当前对话再发提醒；append history（同状态 + note） |
| 查看对话/复制派单 | 任意 | 状态不变 | 不写记录（客户端复制/提示） |
| 再指派 | failed/done/cancelled | **新建记录**（预填弹层） | 不删除原记录；新记录初始 dispatched |
| 删除 | 任意（**待定**，见 §10） | 记录移除 | 客户端二次确认；删除不存在 id 返回 `not-found` |

- 非法流转（如 `dispatched→done`、`done→running`、`review→dispatched`）返回 `bad-transition`，文件不变。
- 终态 `done`/`failed`/`cancelled` 不再进入 running/review（除「再指派」新记录外）。

### 4.4 4 个路由 op

| op | 入参 | 出参 | 说明 |
|---|---|---|---|
| `assignmentList` | `{root}` | `{items[], path, limits:{maxItems,maxBytes}}` | 按 `updatedAt` 倒序；可附 `counts`（可选） |
| `assignmentSave` | `{root, title, detail, acceptance, assignedTo, stageId?, priority?, expectedArtifacts?}` | 新记录 | 校验全部字段；生成 id/round/时间/history 初条；status=dispatched |
| `assignmentUpdate` | `{root, id, status?, note?}` | 更新后记录 | 状态机校验、打回需 note、append history；内容字段不可变（改内容走再指派新记录） |
| `assignmentDelete` | `{root, id}` | `{removed:id}` | 不存在 → `not-found`；客户端二次确认 |

- 接线：`index.js` 的 `dispatch()` switch 增加 4 个 case（与 pipeline/acceptance 同级）；沿用现有连接鉴权与错误封装。
- 错误码（稳定）：`bad-root` / `bad-request` / `bad-id` / `bad-transition` / `not-found` / `full` / `too-large` / `corrupt` / `ssh-unsupported`。
- **无模型工具**：本轮不新增 agent-facing 工具；避免 Agent 自派。

## 5. 交互规格（引用三张 mockups）

| # | 屏幕 | 资源 | 必须落地的关键内容 |
|---|---|---|---|
| 1 | 工作台「团队与指派」卡 | [assign-workbench.svg](../proposals/mockups/assign-workbench.svg) / [assign-workbench.png](../proposals/mockups/assign-workbench.png) | 卡片位于「项目状态」与「项目流程」之间；6 角色成员 chips（名称+角色/成员 id+状态，点击预填并打开抽屉）；指派任务按钮；最近指派默认 5 条（状态 pill / 标题 / 成员 / 类型 / 时间 / 操作），可展开；空态；「打开团队面板 ↗」；底部提示「派发后由 Lead 用原生 team 工具执行；成员与共享任务状态以团队面板为准」；记录保存路径提示 |
| 2 | 指派弹层 | [assign-dialog.svg](../proposals/mockups/assign-dialog.svg) / [assign-dialog.png](../proposals/mockups/assign-dialog.png) | 右侧抽屉 608px（≤768 全宽底部面板）；交给谁（按角色/当前成员/新建 Agent，名称+角色）；任务标题（计数器 ≤120）；详细说明（≤4000）；验收标准（1–10 条，每条 ≤500）；优先级 P0/P1/P2（默认 P1）；关联阶段（自动判断 + 5 个可关联阶段 + 不关联）；期望产物路径；附件入口；双复核提示；取消/指派给 Agent（提交中禁用防重复） |
| 3 | 派发后状态卡 | [assign-status.svg](../proposals/mockups/assign-status.svg) / [assign-status.png](../proposals/mockups/assign-status.png) | 筛选（全部/进行中/待你确认/已完成）；每行五段进度（已派发→等待 Lead→执行中→待你确认→已完成）与状态 pill（执行中/待你确认/已完成/已打回）；关联阶段/时间；操作（查看对话/催办/打回/通过并完成/再指派/取消）；打回示例完整闭环；汇总文案；操作留痕提示 |

> 交互细节（尺寸、间距、tokens、状态矩阵、文案表、无障碍、渲染与迭代记录）见 [mockups/README.md](../proposals/mockups/README.md) §1–§8。实现复用现有 `ds-wb-*` / `ds-btn` / `ds-pipe-*` 样式与 i18n key 前缀 `workbench.assign.*`。

### 5.1 结构化指派单（发到当前对话，字段固定）

```text
【工作台指派 · 第 N 轮】
交给：<角色/成员 opc-xxx>（新建则写明 spawn 参数 name+role）
任务：<标题>
背景/期望：<详细说明>
验收标准：<逐条 1..n>
关联阶段：<stageId 或「临时任务」>
期望产物：<路径，可空>
优先级：<P0/P1/P2>
执行要求：按角色边界执行；阶段任务走 pipeline_* 闸门；临时任务完成后在对话汇报产物与验证；
         不要越过 approval/release 人工闸门；完成后更新工作台指派状态（由 Owner 在状态卡操作）。
```

### 5.2 提交与错误恢复

1. 表单校验通过 → `assignmentSave` 落盘（status=dispatched）→ 生成指派单 → `sendPromptText` 发到当前对话 → toast「已派发」+ 卡片/列表刷新。
2. **部分失败**：落盘成功但发送失败 → 记录保留（dispatched），UI 提示「已保存，发送失败」并提供「重发指派单」；落盘失败 → 不发送，错误就地提示且**表单内容不丢**。
3. 防重复提交：提交中按钮禁用；同一表单重复点击只产生一条记录（按钮禁用 + 幂等提示）。

### 5.3 MVP 允许的缩减（实现以此为准，验收不按 mockup 过度要求）

| 项 | 缩减后行为 |
|---|---|
| 成员实时状态 | 卡片状态**按指派记录推导**：无进行中记录=空闲、有 running=执行中、有 review=待你确认；明确提示「成员实时状态以 Harness 团队面板为准」。mockup 中的「阻塞/离线」为原生面板/未来态，MVP 不承诺实时判定 |
| 打开团队面板 | 若 Harness 无稳定深链：显示可复制的团队面板入口说明/引导手动打开，点击不报错（不得出现死链） |
| 附件 | MVP 至少提供「可拖入对话」的提示入口；复用 `.dsh/attachments` 上传为可选实现（不阻塞提交） |
| 发布上线 chip | **需求明确：人工确认/发布不可指派**；mockup 中「发布上线」选项必须置灰并提示「仅 Owner 在流水线面板审批」（以需求为准） |
| 新建 Agent | 仅记录名称+角色（spawn 参数）；真正创建由 Lead 执行；上限/spawn 失败由 Lead 回填错误，表单保留输入 |
| 超时 | 不做自动超时失败；running 超过 30 分钟仅显示「等待中」提示 + 催办 |
| 查看对话 | 无消息 ID 定位；「查看对话/复制派单」= 复制指派单/提示当前对话位置 |
| 服务端能力 | 无搜索/分页/推送；≤100 条客户端筛选与展开 |

## 6. 与流水线 / 双复核的关系

| 指派类型 | 是否走流水线 | 闸门与约束 |
|---|---|---|
| 关联阶段（product/design/development/testing/acceptance） | 是，走现有七阶段 | 不变：testing → **acceptance（AI 复核）** → **approval（Owner 人工确认）** → release；指派动作**不写** `.dsh/pipeline.json` |
| 临时任务（不关联） | 否 | 不改变流水线，完成后由 Owner 在状态卡确认（通过/打回）；涉及改需求/范围时应提示转「需求与调整」或发起变更轮 |
| 人工确认（approval）/ 发布（release） | — | **不可指派**：只能 Owner 在流水线面板操作；表单置灰并提示 |
| 新建 Agent | 由 Lead `spawn_teammate` 创建（受 Harness 团队上限约束） | 不改变闸门；插件不直接 spawn |

- 验证手段：指派前后对比 `.dsh/pipeline.json` 的 mtime/内容哈希应完全一致；取消/完成后也不得触发 pipeline 状态变化。

## 7. 调研与借鉴（本需求自身的调研证据）

> 调研执行时间：2026-10-27（Asia/Shanghai）。使用 Harness 自带 `web_search`（1 次、4 条查询）与 `web_fetch`（13 次，其中 10 次 HTTP 200、3 次失败）。下表来源均为真实抓取（HTTP 200），关键结论为抓取正文摘要；失败/未采用来源见 §7.4，未伪造任何来源。

### 7.1 来源与关键结论（7 个可引用来源）

| # | 来源 | URL | 访问日期 | 类型 | 关键结论（用于本需求） |
|---|---|---|---|---|---|
| 1 | Microsoft Learn · Design human-in-the-loop workflows | https://learn.microsoft.com/en-us/training/modules/governance-guardrails-operations/4-design-human-workflows | 2026-10-27 | 人机协作审批 | 人类应放在**高影响决策点**（合并/部署/敏感权限），而不是每一步；审批应**显式、可审计、责任角色明确**；生产部署应**串行**（防并发冲突）；用证据/小范围/回滚减少治理疲劳。→ 支撑「Owner 只在派发与完成确认点介入」「打回需 note、history 留痕」「per-root 串行写」「状态卡给证据」 |
| 2 | Microsoft HAX Toolkit · Guidelines for Human-AI Interaction（18 条） | https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/（清单：https://www.microsoft.com/en-us/haxtoolkit/library/） | 2026-10-27 | 人机交互规范 | 18 条循证指南覆盖初次交互/交互中/出错/长期；与本功能直接相关：G1 说清系统能做什么、G2 说清做得多好、G7 高效触发、G8 高效关闭、G9 高效纠错、G11 解释原因、G16 说明后果、G18 通知变化。→ 支撑表单能力说明、状态解释、打回/再指派、闸门后果提示、toast/状态更新 |
| 3 | Linear Docs · Assign and delegate issues | https://linear.app/docs/assigning-issues | 2026-10-27 | 任务指派 UX | 每个 issue 同一时间**只指派给一个人**（清晰 ownership）；可把任务**委托给 agent 而人类 assignee 保留所有权与责任**；指派受团队权限约束；支持列表/卡片直接指派与快捷操作。→ 支撑「一个目标（role/member/newAgent 互斥）」「Owner 保留最终确认责任」「卡片/抽屉内快速指派」 |
| 4 | GitHub Docs · Assigning issues and pull requests（对比参考） | https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/assigning-issues-and-pull-requests-to-other-github-users | 2026-10-27 | 任务指派 UX | assignee 用于说明「谁在做」；GitHub 支持多个 assignee（最多 10）。→ 与 Linear 单指派对比后**决定不采用多指派**（见 §7.2），避免团队工具执行歧义 |
| 5 | NN/g · Progress Indicators Make a Slow System Less Insufferable | https://www.nngroup.com/articles/progress-indicators/ | 2026-10-27 | 状态反馈 UX | 「系统状态可见性」是最重要可用性原则之一；操作要立即反馈；>1 秒的操作需要进度指示；循环动画适合 2–10 秒，更长需给出估计；反馈减少不确定感、提升满意度。→ 支撑五段进度、状态 pill 文案、toast、催办、「等待 Lead」提示 |
| 6 | MDN · ARIA `dialog` role | https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/dialog_role | 2026-10-27 | 无障碍 | 对话框需 `role="dialog"` + `aria-labelledby`/`aria-describedby` 标签；出现时把焦点移入默认控件，关闭后焦点归还触发点；Tab 顺序应在对话框内循环；模态时外部内容不可交互。→ 支撑右侧抽屉/底部面板的键盘与焦点规范、Esc 归还焦点 |
| 7 | Node.js Docs · File system（`fs`/`fs.promises` 与 `rename`） | https://nodejs.org/api/fs.html | 2026-10-27 | 本地持久化/原子写 | Node fs 文档指出：promise API 的文件操作**不同步、非线程安全**，对同一文件并发修改可能导致数据损坏，需要串行化；`fs.rename` 提供替换目标路径的原子操作，常见「写临时文件再 rename」可避免半写文件。→ 支撑 `per-root 串行锁 + temp+rename 原子写`、「不加锁冲突」与错误恢复 |

### 7.2 借鉴决策表（采用 / 调整 / 不采用 + 理由）

| 借鉴点 | 来源 | 决策 | 理由 | 落点 |
|---|---|---|---|---|
| 一个任务单一 assignee，边界清晰 | #3 | **采用** | 避免「到底谁做」歧义；与 Lead 用原生工具执行更匹配 | `assignedTo` 三选一互斥；状态卡单目标展示 |
| 委托给 Agent、人类保留责任 | #3 | **采用（映射为 Owner 确认）** | 插件只派工不担责；双复核最终仍由 Owner 拍板 | 完成/打回必须 Owner 操作；approval/release 不可指派 |
| 人类只在关键决策点审批、可审计 | #1 | **采用** | 派发与完成确认是 Owner 的关键点；其余交给 Lead/Agent 执行 | 4 个 op 记 history；打回需 note；history≤50 |
| 审批显式、可审计，串行执行 | #1 | **采用** | 状态变更与写文件都要可追溯、避免并发冲突 | 状态机校验 + per-root 串行锁 + history |
| 状态可见、立即反馈、进度可读 | #5 | **采用** | 指派是异步长流程，Owner 需要知道到哪一步 | toast、五段进度、状态 pill 文字、催办 |
| 对话框标签 + 焦点管理 + Esc 归还 | #6 | **采用** | 抽屉/底部面板是模态交互，无障碍硬要求 | `role=dialog`、`aria-modal`、焦点入/出、Tab 循环 |
| 并发写串行化 + 临时文件 rename | #7 | **采用** | 防数据损坏、防半写；无需新增依赖 | 原子写 + per-root 锁 + 1MB/100 条上限 |
| HAX G1/G2/G9/G11/G16/G18 | #2 | **采用（简化落地）** | 让 Owner 知道能力边界、如何纠错、操作后果与状态变化 | 表单提示、阶段闸门提示、打回/再指派、toast/aria-live |
| 多 assignee（GitHub 最多 10） | #4 | **不采用** | MVP 一个任务一个执行目标，多目标会让原生团队工具执行与状态追踪歧义 | — |
| 直接调用团队服务实时读取成员状态（提案 B） | #3/#2 延伸 | **不采用（本轮）** | 无 owner 级 TeamService API；会破坏「Lead 组队」权限模型 | 状态由记录推导 + 团队面板为权威 + 入口提示 |
| 插件内直接 spawn / 建共享任务（提案 C） | #3 延伸 | **不采用** | 与 Harness 团队面板重复且可能越权 | 只生成结构化指派单，Lead 执行 |
| 自动超时失败/自动重试 | #1/#5 延伸 | **不采用** | Agent 可能长时间运行；自动失败会造成误判与状态抖动 | 只显示等待提示 + 催办；不自动改状态 |
| 新增第三方原子写依赖（write-file-atomic 等） | #7 延伸 | **不采用** | 需求禁止新依赖；用现有 fs.temp+rename 足够 | 实现内建原子写 |
| 独立任务数据库/队列 | #3 延伸 | **不采用** | MVP 规模 ≤100 条，本地 JSON 足够；避免新依赖与迁移复杂度 | `.dsh/agent-assignments.json` |

### 7.3 已验证模式 vs 创新假设

- **已验证模式（有来源支撑）**：单 assignee 清晰 ownership 与委托给 agent（#3）；人类在高影响决策点审批、审批显式可审计、串行执行（#1）；状态可见性与即时反馈（#5）；对话框焦点管理与标签（#6）；文件并发写需串行化、temp+rename 原子替换（#7）；HAX 能力边界/纠错/后果提示（#2）。
- **创新假设（本项目自研/组合，需交付验证）**：
  1. **结构化指派单 → 当前对话 → Lead 原生执行**能显著减少口述漏项（需实际使用验证；模板字段可能后续增删）；
  2. **「已派发/等待 Lead」拆两段**能让 Owner 看见「消息已发但未接单」；
  3. 成员状态由**指派记录推导**足以支撑 Owner 判断（实时状态以团队面板为准）；
  4. 关联阶段任务与流水线状态**解耦**（指派不写 pipeline，状态由 Owner 推进）能避免双写冲突；
  5. 「自动判断关联阶段」的推导规则（当前/下一阶段）在真实轮次中是否准确；
  6. 100 条 / 1MB / history 50 的本地 JSON 上限对 1 人公司 + Agent 团队足够；
  7. 附件「仅提示拖入对话」的降级是否被 Owner 接受。

### 7.4 未采用/抓取失败的来源（诚实披露）

| URL | 结果 | 处理 |
|---|---|---|
| https://support.atlassian.com/jira-software-cloud/docs/assign-issues/ | HTTP 404（页面不存在） | 未采用；任务指派 UX 依据改用 #3/#4 |
| https://help.asana.com/s/article/assign-tasks | HTTP 404（页面不存在） | 未采用；同上 |
| https://www.npmjs.com/package/write-file-atomic | HTTP 403（站点拦截） | 未采用；原子写依据改用 #7（Node.js 官方文档） |
| https://uxpatternsguide.com/patterns/step-progress/ | HTTP 200 但正文被截断，未提取到可引用结论 | 未采用；进度反馈依据改用 #5（NN/g） |

> 结论：网络可用，可引用来源 7 个（≥3），全部记录 URL + 访问日期 + 关键结论；失败项已如实披露，不存在伪造来源，无「无网络」`blocked`。

## 8. 错误处理、边界与数据安全

| 场景 | 期望行为 |
|---|---|
| 必填缺失（title/detail/acceptance/assignedTo） | Host 返回 `bad-request` 且指出字段；客户端字段下就地提示、不丢输入、不落盘 |
| 长度越界（title>120、detail>4000、单条验收>500、验收>10 条） | Host 拒绝（`bad-request`）；客户端计数器与提示，超限不可提交 |
| 记录数 >100 / 文件 >1MB | 分别返回 `full` / `too-large`；客户端提示清理终态记录；原文件不变 |
| 非法状态流转（dispatched→done、done→running、review→dispatched 等） | `bad-transition`，文件不变；客户端只展示可用操作 |
| 打回但未填原因 | `bad-request`；客户端打回弹窗必填 note，未填不能提交 |
| 不存在的 id / id 非法 | `not-found` / `bad-id` |
| SSH 工作区 | 四个 op 均返回 `ssh-unsupported`；卡片禁用并提示「SSH 工作区暂不支持指派」 |
| 数据文件损坏 | 读取返回 `corrupt`（含路径），不静默清空、不覆盖；客户端提示联系 Owner 修复/备份 |
| 并发保存/更新 | per-root 串行锁保证不丢更新、不产生重复 id；并发 10 次保存应得到 10 条且文件可解析 |
| 落盘成功但发送失败 | 记录保留 dispatched；提示「已保存，发送失败」+「重发指派单」；不重复建记录 |
| 写文件失败（权限/磁盘） | 原子写保留旧文件；返回稳定错误；客户端不丢输入，可重试 |
| 刷新/重启 | 记录从 `.dsh/agent-assignments.json` 恢复；`.dsh/.gitignore` 保证不进 Git |
| 关联阶段但不改流水线 | 指派前后 `.dsh/pipeline.json` 内容哈希一致；approval/release 不可作为 stageId |
| 新建 Agent spawn 失败 | Lead 在对话回报错误；指派记录保留，Owner 可「再指派」或改 member/role |

## 9. 验收标准（需求 10 条细化为可独立复测）

| # | 结论式验收点 | 复测方式（命令/文件/GUI） | 边界用例 |
|---|---|---|---|
| 1 | 工作台出现「团队与指派」卡，位于项目状态与项目流程之间，含 6 角色 chips、推导状态、指派按钮、最近 5 条/空态 | 刷新工作台；DOM/截图核对卡片顺序与文案；6 chips；空态（清空 `.dsh/agent-assignments.json` 或新工作区）；最近记录默认 5 条可展开；「打开团队面板」入口存在且不报错 | 0 条记录空态；>5 条时默认折叠/展开；状态推导=空闲/执行中/待你确认三态 + 「以团队面板为准」提示 |
| 2 | 指派表单字段与校验完整；人工确认/发布不可选并有提示；新建 Agent 支持名称+角色 | 打开抽屉：必填校验、标题 120 字符 / 详细 4000 字符 / 验收 1–10 条（每条 500 字符）、计数器、错误就地提示不丢输入、P1 默认、阶段 chips（自动判断 + 5 阶段 + 不关联；approval/release 置灰+提示）、新建 Agent 名称+角色 | 空提交、超长输入、验收 0 条/11 条、附件入口不阻塞 |
| 3 | 提交后 `.dsh/agent-assignments.json` 有 `status=dispatched` 记录，当前对话收到含全部字段的结构化指派单 | 提交后读文件（jq/node 解析）核对字段/round/时间/history；检查对话消息包含交给/任务/背景/验收/关联阶段/期望产物/优先级/执行要求/闸门提示；toast 与卡片刷新 | 落盘成功/发送失败时记录保留 + 重发；连续点击只产生一条 |
| 4 | 状态流转可用且持久：dispatched→running→review→done；打回需 note→failed 可再指派；催办/取消可用；刷新/重启记录仍在；history 完整 | 依次用 GUI 或直接调用 4 个 op 推进/打回/取消/催办；重载页面与重启 Host 后 `assignmentList` 数据仍在；history 追加且≤50；再指派生成新记录、原记录保留 | 非法流转拒绝；打回空 note 拒绝；终态不可回退；并发状态更新不丢 |
| 5 | 关联阶段不修改 `.dsh/pipeline.json`；临时任务不改变流水线；双复核闸门不被绕过 | 指派前后 `sha256sum .dsh/pipeline.json` 一致；临时任务完成后流水线七阶段状态不变；阶段任务仍显示 acceptance/approval 闸门提示；approval/release 不可选 | 关联阶段 + 自动判断；临时任务；取消/打回均不写 pipeline |
| 6 | 数据校验/上限/SSH 降级/错误提示正确（≥6 个边界用例） | 用 node 调 `.dsh` 路由或 selftest 覆盖：必填缺失、长度越界、>100 条 `full`、>1MB `too-large`、非法流转 `bad-transition`、打回空 note、不存在 id `not-found`、SSH root `ssh-unsupported`；错误码稳定 | 至少 8 个用例；错误信息可操作 |
| 7 | 中英文完整、无障碍与移动端可用；不新增运行时依赖 | 切换 zh/en 检查卡片/抽屉/状态卡文案无缺失（key 前缀 `workbench.assign.*`）；键盘 Tab/Shift+Tab 焦点环、Esc 关闭归还焦点、`role=dialog aria-modal`、44px 命中、状态有文字+颜色、`prefers-reduced-motion`；≤768 抽屉为底部面板 | 空 key 回退；焦点不逃逸；触屏命中 |
| 8 | 不破坏现有工作台/流水线/验收/交付/团队流程；`npm run check`、`npm test`、`pipeline-selftest`、`review-selftest` 全绿 | 依次执行四条命令并记录退出码/输出末尾；host-smoke 扩展 assignments 用例（ops/校验/上限/状态机/SSH）；现有功能手工回归（工作台/流水线/验收/交付） | 无既有用例回归；无新依赖（`git diff package.json` dependencies 不变） |
| 9 | 三张效果图的关键布局/状态/操作在实现中落地（允许 MVP 缩减） | 对照 mockups 三屏逐项核对：卡片位置/成员 chips/最近记录/抽屉字段与提示/状态卡筛选/五段进度/状态 pill/操作按钮；允许 §5.3 缩减项（实时状态→推导+提示；发布 chip 置灰；附件降级） | 打回态/已完成态/空态均有；400/窄屏不溢出 |
| 10 | 文档同步：AGENT_TEAM/PLAYBOOK 指派小节、ACCEPTANCE 批次 12、CHANGELOG 1.2.75、版本一致 | `grep -n "工作台指派\|指派" docs/AGENT_TEAM.md docs/PLAYBOOK.md`；`grep -n "批次 12" docs/ACCEPTANCE.md`；CHANGELOG 顶部 `## 1.2.75 — 2026-10-27`；核对两个 `package.json` 版本与 §9 版本口径一致 | 文档无死链；版本与 CHANGELOG/验收记录一致 |

**版本口径说明（Lead 已拍板，2026-10-27）**：当前仓库根为 **1.2.75**（工作区硬性规定：上一轮交付后根 +1，编辑器标签右键菜单提交后再次 +1）、插件为 **1.2.73**。本轮发布版本定为 **1.2.75**：**插件 `package.json` 升至 1.2.75、根保持 1.2.75 不回退**；交付提交中 CHANGELOG 用 `## 1.2.75 — 2026-10-27`（并把此前 Unreleased 的编辑器标签右键菜单变更一并纳入本轮发布）；交付完成后按硬性规定把根 `package.json` +1 至 **1.2.76**。下一轮发布时插件对齐 1.2.76。

## 10. 风险与未决问题

### 10.1 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 指派消息被 Lead/模型忽略细节 | Agent 做偏、返工 | 结构化模板 + 必填验收 + 派单回执（「已接单」）+ 状态卡追踪（提案 §8 / 本需求 §5.1） |
| 成员名跨会话变化 | 记录指向旧成员 | `assignedTo.role` 为准、member 可选；新会话提示「成员已重建」并允许按角色重派 |
| 临时任务滥用绕过流水线 | 质量风险 | 默认「自动判断」引导关联阶段；临时任务强制验收与产物；涉代码/需求提示转需求变更；acceptance 复核检查 |
| 深链接团队面板不可用 | 「打开团队面板」失效 | MVP 降级为可复制入口/手动打开提示；不出现死链（§5.3） |
| 指派状态与流水线双写冲突 | 状态不一致 | 指派显式不写 pipeline；阶段状态只读推导；Owner 审批仍走闸门 |
| 新建 Agent 名称/上限冲突 | spawn 失败 | Lead spawn 失败回填表单错误、不丢输入；名称建议 `opc-<role>-<n>` |
| 数据文件损坏/并发写 | 记录丢失/解析失败 | 原子写 + per-root 串行锁 + `corrupt` 错误不静默清空 + 上限/备份提示 |
| 100 条/1MB 上限 | 满后无法新增 | 返回 `full`/`too-large`；提示清理终态记录；删除二次确认 |
| mockup 与需求不一致（发布 chip、实时状态文案） | 实现走偏或被误判 | 以本需求为准（§5.3），实现时调整 mockup 文案；验收按需求与 MVP 缩减 |
| Host 改动需重启 Harness、客户端需重建 bundle/刷新 | 看不到新卡/新 op | 交付说明写明重启 + 刷新；GUI 复测在重启后进行 |
| 版本口径（已拍板：发布 1.2.75，插件升 1.2.75、根保持 1.2.75，交付后根 +1 至 1.2.76） | 版本倒退或验收误判 | 按 §9 版本说明执行；提交前核 diff；不得把根版本回退 |
| i18n key 漏配 | 英文界面缺文案 | 统一 `workbench.assign.*` 清单；验收项 7 覆盖 zh/en |

### 10.2 未决问题（需 Owner/Lead 拍板）

1. **版本操作顺序（已拍板）**：发布 1.2.75；插件 `package.json` 1.2.73 → 1.2.75，根保持 1.2.75（不回退）；CHANGELOG 1.2.75 并纳入 Unreleased 的标签右键菜单；交付后根 +1 至 1.2.76。下一轮插件对齐 1.2.76。
2. **`assignmentDelete` 权限范围**：允许删除任意状态，还是仅终态（done/failed/cancelled）？建议仅终态删除 + 客户端二次确认，避免删掉进行中任务且无留痕。
3. **「再指派」语义**：新建记录（保留原记录）还是复用原记录重置为 dispatched？需求倾向「不丢失原记录」→ 建议新建记录；请确认。
4. **「自动判断」阶段推导规则**：按当前 `pipeline` 阶段还是下一阶段？pipeline 无需求/已完成时是否回退为临时任务？建议：有需求 → 当前 active/review 阶段；已完成 → 提示选临时任务或发起变更轮。
5. **附件实现**：复用 `.dsh/attachments` 上传，还是仅提示「拖入对话」？建议 MVP 先「提示拖入对话」不阻塞，上传作为后续增强。
6. **是否允许 Agent 侧模型工具读指派**（如只读 `assignmentList`）？需求边界「不允许 Agent 自派」；建议本轮不加模型工具，保持 4 个 owner 路由 op。
7. **`expectedArtifacts` 条数/长度上限**：建议 ≤10 条、每条 ≤500 字符；请实现与验收对齐（当前需求未给具体值）。
8. **「查看对话」交互**：无消息 ID 定位时，采用「复制指派单 + 提示当前对话」是否可接受？建议可接受并在文案说明。

## 11. 交付物与优先级

- **P0**：Host `assignments.js` + 4 op + 数据模型/上限/状态机/SSH 降级；工作台卡 + 抽屉 + 状态卡核心流程；结构化指派单；不改流水线；i18n/无障碍基础；测试全绿。
- **P1**：最近指派展开/筛选/催办/再指派细节；mockup 全状态覆盖；移动端底部面板；文档同步。
- **交付物路径**：`dsh-web-filebrowser-plugin/assignments.js`（新增）、`dsh-web-filebrowser-plugin/index.js`（4 个 case 接线）、`dsh-web-filebrowser-plugin/client.js`、`locale/zh.json`、`locale/en.json`；`docs/AGENT_TEAM.md`、`docs/PLAYBOOK.md`、`docs/ACCEPTANCE.md`、`CHANGELOG.md`、两个 `package.json`；测试 `scripts/selftest/host-smoke.mjs`（扩展）与既有 selftest 脚本。
- **Owner 验收路径**：重启 Harness → 刷新工作台 → 走一遍「指派→对话收到指派单→状态推进→打回/再指派→刷新仍存在」→ 用 §9 的边界用例核对 → 按 ACCEPTANCE 批次 12 逐条点。

## 12. 兼容与迁移

- 新数据文件：首次读取不存在 = 空列表；无需迁移旧版本（本轮全新功能）；`.dsh/.gitignore` 已忽略全部 `.dsh` 状态，保证不进 Git。
- 旧客户端/旧 bundle：不识别新 op → 工作台旧版不显示卡片；升级后需重建 bundle + 刷新页面；Host 与客户端需同版本交付。
- 不影响既有 `.dsh/pipeline.json` / `.dsh/acceptance.json` / `.dsh/todos.json` / `.dsh/review.json` / `.dsh/deliveries.json` 结构。
- SSH 工作区：四个 op 返回 `ssh-unsupported`，客户端卡片禁用 + 提示；不写任何 `.dsh` 文件。
