# 智能体团队 + 交付流水线（双复核模式）

> 目标：一个需求从下发到客户交付，由**不同角色的智能体按边界各司其职**；**项目经理 Agent** 独立做项目级验收复核，**项目经理（你，Owner）** 只做确认、评审与发布闸门。AI 复核 + 人工确认 = **双复核**。
>
> 完整的「从需求到交付」操作手册见 [PLAYBOOK.md](PLAYBOOK.md)。
>
> 插件提供两样东西：**流水线状态与人工闸门**（`.dsh/pipeline.json` + 侧栏「流水线」视图 + 模型工具），以及**每个阶段可复用的角色提示词**。真正的团队通信仍然用 Harness 原生 Agent Teams 工具（`spawn_teammate` / `team_task_*` / `send_message` / `wait_agent`），插件不重复实现。

## 1. 角色与边界

| 角色 | 只做什么 | 不做什么 | 主要产出 | 依赖的插件能力 |
|---|---|---|---|---|
| **产品经理** | 需求分析、**同类调研与借鉴决策（web_search/web_fetch ≥3 来源）**、范围与优先级、验收标准 | 不写业务代码、不做视觉设计、不发布、不伪造来源 | `docs/pipeline/requirements.md`（含「调研与借鉴」+ 借鉴决策表）；`acceptance_add` 写入验收项 | 验收台、待办、记忆、web_search/web_fetch |
| **UI 设计师** | 信息架构、界面/交互设计、**专业设计质量（调研 ≥2 参照、9 项 MUST、八态矩阵、五维自评 ≥4、渲染迭代）**、设计稿与组件说明 | 不改后端逻辑、不做部署、不只写文字描述 | `docs/pipeline/design.md`（含调研/状态矩阵/tokens/自检评分/迭代记录）+ 高保真稿（`docs/pipeline/design/`；有 UI 时必须提供，工作台显示缩略图） | 图片/PDF 预览、内置浏览器、web_search/web_fetch |
| **全栈开发** | 按需求和设计实现代码、自测、**不熟悉功能先检索 GitHub 活跃候选（≥2）并评估许可证/安全/性能**、修复构建错误 | 不改需求与验收标准、不自批、不发布、不复制无许可证代码 | 代码、`docs/pipeline/engineering-research.md`（候选对比/许可证/出处）、构建/测试通过记录 | 编辑器、任务面板、Problems、Git、web_search/web_fetch |
| **测试工程师** | 编写/执行测试用例、回归、回填验收清单 | 不改业务代码（缺陷交回开发）、不发布 | `docs/pipeline/test-report.md`；`acceptance_update` 回填 pass/fail | 任务面板、验收台、证据上传 |
| **项目经理 Agent**（新增） | 测试通过后做**项目级验收复核**：逐项核对需求覆盖、验收清单与证据、测试报告与复测、Git 变更与已审、DoD；产出复核报告并给放行/打回建议 | 不改代码/需求/设计/验收标准、不自批、不发布、不代替 Owner 做决定 | `docs/pipeline/acceptance-review.md`；`acceptance_evidence_add` 补证据；`pipeline_submit_stage(acceptance)` | 流水线、验收台、证据、任务面板、Git 审阅 |
| **项目经理（你，Owner）** | 需求确认、阶段评审、**人工确认（第二道复核）**、最终验收、批准发布 | 不写代码 | 闸门结论、评审备注 | 流水线面板、验收台、审阅标记 |
| **运维** | 构建产物、发布/上传、环境与回滚记录 | 不在批准前发布、不擅自改业务代码、不重新验收 | `docs/pipeline/release.md` + 发布记录（URL/环境） | 交付打包、预览分享、任务面板 |

## 2. 流水线阶段与闸门（七阶段双复核）

**研究与借鉴纪律（v1.2.73）**：三个执行角色都先「调研 → 借鉴 → 实现」，再提交评审——产品经理用 `web_search`/`web_fetch` 找 ≥3 个同类需求/行业标准并给出借鉴决策表；UI 设计师调研 ≥2 个设计系统并用硬标准 + 五维评分自检；全栈开发遇到不熟悉功能先检索 GitHub 活跃开源候选，核对许可证、已知问题与 CVE 后再决定「借鉴代码 / 只借鉴模式 / 自己实现」。验收复核关会同时检查这些证据，缺失即建议打回。

顺序固定，每个阶段只能由对应角色执行；**任何阶段的「待评审」都必须由你在面板上通过，agent 不能自己审批**。

| # | 阶段 | 执行者 | 进入条件 | 通过后 |
|---|---|---|---|---|
| 1 | 需求分析 `product` | 产品经理 | 需求已保存 | design 解锁 |
| 2 | UI 设计 `design` | UI 设计师 | product 通过 | development 解锁 |
| 3 | 开发实现 `development` | 全栈开发 | design 通过 | testing 解锁 |
| 4 | 测试验收 `testing` | 测试工程师 | development 通过 | acceptance 解锁 |
| 5 | **验收复核 `acceptance`** | **项目经理 Agent** | testing 通过 | approval 解锁 |
| 6 | **人工确认 `approval`** | **你（Owner）** | acceptance 通过 | release 解锁（只有这里能批准发布） |
| 7 | 发布上线 `release` | 运维 | approval 通过 | 记录发布信息，可再次下载成果 |

状态：`pending`（待开始）→ `active`（进行中）→ `review`（待评审）→ `approved`（已通过）｜`failed`（已打回，可重新派发）。

**双复核模式**：第 5 关由 AI 项目经理 Agent 复核，结论是「建议放行 / 建议打回」；第 6 关由你确认。两道关都过才允许发布；Agent 没有审批工具，第 6 关只能你点。

**快速模式**（`gateMode=fast`）：前五个中间阶段（product/design/development/testing/acceptance）提交后自动通过并推进；**approval 与 release 永远保持人工闸门**，快速模式也不会自动通过它们。普通模式（normal）下每个阶段都停在「待评审」等你点。

## 3. 一次完整交付怎么走

1. **下发需求**：侧栏「流水线」→ 填需求标题 + 描述（目标/范围/验收标准）→ 保存。
2. **启动产品经理阶段**：点「启动并派发」。插件会标记阶段 active，并把**带角色边界的提示词**发到当前对话（含需求 + 本阶段交付物 + 工具要求）。
3. **团队执行**：Lead（当前对话）可以用 `spawn_teammate` 为这个角色创建一名队友，或用 `team_task_create` 拆任务；角色完成后调用 `pipeline_submit_stage({ stageId, summary, artifacts })` 提交评审。
4. **你评审**：阶段变为「待评审」；在面板写评审备注 →「通过」或「打回」。打回会变成 `failed`，可重新派发。
5. **重复 2–4** 直到测试通过。
6. **项目经理 Agent 复核**：启动 `acceptance`，Agent 逐项复核并产出 `docs/pipeline/acceptance-review.md`（逐项核对表 + 复测证据 + DoD + 放行/打回建议）后提交。
7. **你确认**：`approval` 阶段点「通过」，发布阶段才会解锁；不通过就写备注打回。
8. **运维发布**：启动 release 阶段 → 运维执行构建/上传 → 在面板记录环境与链接（发布记录进 `.dsh/pipeline.json` 的 `releases`）。
9. **客户交付**：验收台导出报告/证据、预览分享链接、打包产物；交付记录留在 `.dsh/deliveries.json`。
10. **收尾**：清理已通过验收项、关闭预览分享、Git 提交/推送、沉淀 1 条工作区记忆。

## 4. 与 Harness Agent Teams 的配合方式

插件只做「状态机 + 闸门 + 产物」，团队协作仍用原生能力：

- **Lead 组织团队**：`spawn_teammate({ name, description, prompt })`，把阶段的角色提示词作为初始任务；同一工作区共享文件系统，产物直接落盘。`pipeline_dispatch({stageId})` 会直接返回可用的 spawn / teamTask 参数。
- **拆任务与依赖**：`team_task_create` + `blocked_by` 表达「设计完成才能开发」等顺序；`team_task_update` 认领/完成。
- **推进与等待**：`send_message` 或等 `wait_agent`；成员状态用 `list_agents`。
- **验收与闸门**：只有人（你）能在流水线面板点「通过」；agent 侧只允许 `pipeline_submit_stage` 提交。项目经理 Agent 只给放行建议，不审批。
- **边界落点**：角色提示词里写清「只做什么/不做什么/交付物/工具」；测试阶段回填 `acceptance_*`；验收复核阶段只读验收结论并补证据；运维阶段只读验收结论，不重复实现审批。

### 工作台「团队与指派」（v1.2.75）

工作台新增 **「团队与指派」** 卡片（位于「项目状态」与「项目流程」之间），让你在工作台里指定 Agent 干活并追踪状态：

1. **选谁**：按角色（6 个常驻角色）/ 当前成员（填成员名，如 `opc-dev`）/ 新建 Agent（名称 + 角色，由 Lead `spawn_teammate` 创建，受团队上限约束）。
2. **写任务**：标题、详细说明、验收标准（1–10 条）、优先级、期望产物；可关联流水线阶段（product/design/development/testing/acceptance）或作为「临时任务」（不关联）。
3. **提交**：先写入 `.dsh/agent-assignments.json`（4 个 Owner-only op，无模型工具），再把**结构化指派单**发到当前对话；Lead 用原生 `spawn_teammate` / `send_message` / `team_task_*` 执行，不能由 Agent 自派。
4. **闸门不变**：关联阶段的任务仍走七阶段双复核（acceptance AI 复核 → Owner 人工确认 → release）；**指派动作不写 `.dsh/pipeline.json`**；approval/release 两关不可指派、只能你在面板审批；临时任务不改变流水线，完成后由你确认。
5. **状态**：`dispatched（已派发）→ running（执行中）→ review（待你确认）→ done（已完成）`，打回需原因（failed 可再指派），取消 / 复制派单 / 催办可用；记录持久化、刷新重启不丢。成员**实时状态以 Harness 原生团队面板为准**，卡片状态按指派记录推导。


## 5. 数据与产物

| 数据 | 位置 | 说明 |
|---|---|---|
| 流水线状态 | `.dsh/pipeline.json` | 需求、七阶段状态、摘要、产物、发布记录；原子写、按工作区隔离 |
| 验收清单 | `.dsh/acceptance.json` | 产品经理写、测试回填、项目经理 Agent 复核、你评审 |
| 阶段文档 | `docs/pipeline/*.md` | 需求分析、设计说明、测试报告、**验收复核报告**、发布记录（建议路径，可在产物里引用任意文件） |
| 设计资源/证据 | `.dsh/evidence/`、`.dsh/pipeline/design/` | 截图/设计稿/证据；`.dsh/` 默认不进 Git |
| 交付记录 | `.dsh/deliveries.json` | 交付包路径与时间 |

> 旧版本（六阶段）的 `.dsh/pipeline.json` 升级后自动兼容：缺少的 acceptance 阶段会补为 pending；旧版已经到 approval/release 的项目，acceptance 会迁移为已通过并带「升级迁移」备注，已完成项目不会被判为未完成。

## 6. 模型工具（agent 侧）

| 工具 | 用途 |
|---|---|
| `pipeline_status` | 读取七阶段状态、当前阶段、需求与上游摘要 |
| `pipeline_stage_prompt({stageId})` | 取该角色的完整提示词（边界/交付物/工具要求） |
| `pipeline_set_requirement({title, detail})` | 产品经理补充/修订需求（owner 也可在面板改） |
| `pipeline_update_requirement({mode, detail, title?, type?})` | 追加/修订需求并写入修订记录（append / replace / refine / edit） |
| `pipeline_dispatch({stageId})` | 返回该阶段角色提示词 + 可直接用于 `spawn_teammate` / `team_task_create` 的参数（不实际启动） |
| `pipeline_start_stage({stageId})` | 标记阶段开始（顺序校验；一般由面板触发） |
| `pipeline_submit_stage({stageId, summary, artifacts})` | 提交本阶段评审（唯一正常的「完成」动作）；返回非阻断的产物 `warnings[]` |
| `pipeline_record_release({environment, url, notes})` | 运维在发布阶段实际发布后，记录环境、链接与说明（不会自己发布） |
| `workspace_status({})` | 一次读取需求/七阶段/验收计数/运行中任务/项目文档（≤4KB）；systemPrompt 另有 ≤600 字简报 |
| `task_detect / task_run / task_output / task_stop / task_list` | 用与面板相同的任务运行器跑 build/test/lint；只接受 detect 白名单命令；运行记录落 `.dsh/runs.json` |
| `env_ports / preview_share / preview_list / preview_close / http_probe` | 查端口、创建/关闭预览分享链接、探测 loopback 服务 |
| `acceptance_list / acceptance_add / acceptance_update / acceptance_delete / acceptance_clear_passed` | 读写验收清单（状态变化记 history/retestRound） |
| `acceptance_evidence_add({id\|title, path, label?, kind?})` | 给验收项附加证据（截图/日志/报告/diff/链接） |
| `acceptance_report({})` | 读取验收报告 Markdown（>8KB 截断） |
| `evidence_list({limit?})` | 只读 `.dsh/evidence` 证据文件 |
| `delivery_history({limit?})` | 只读 `.dsh/deliveries.json` 交付记录 |
| `memory_* / todo_*` | 工作区记忆与待办（与面板共享同一份数据） |
| `web_search / web_fetch` | Harness 原生联网调研工具：同类产品/PRD、设计系统与规范、GitHub 开源项目、许可证与 CVE 查询（三个执行角色必用；来源需记录 URL+访问日期） |

系统提示里还有流水线/验收/记忆/待办的说明与一段工作区状态简报，让 agent 知道「不能自批、必须等 Owner 闸门」，并在每轮看到当前阶段与验收计数。

## 7. 已知限制

- 同一工作区同一时间只允许一个阶段 `active`；顺序严格。
- 审批只能由人在面板完成（没有模型工具能批准）；acceptance 阶段的 Agent 只能提交评审与放行建议。
- 旧版六阶段文档会自动迁移；迁移后的 acceptance 仅代表「升级前的旧流程已完成」，不代表新流程重新复核过。
- SSH 远程工作区暂不支持流水线/验收/证据/变更审阅/任务工具（文件与 `.dsh` 在本地）。
- 任务/环境工具只接受 `task_detect` 的白名单命令，不提供任意 shell；`http_probe` 只允许 loopback。
- 每个阶段建议用独立子代理或会话执行，避免上下文互相污染；角色提示词已包含边界，但最终约束靠工具与你的评审。
- 自动化程度取决于团队编排：本仓库提供状态机与闸门，具体「谁来做」由 Lead 用原生团队工具决定。
