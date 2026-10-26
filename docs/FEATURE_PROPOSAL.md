# Agent-first 功能提案：Dev Workspace 下一批能力

> 基线：**v1.2.67**（HEAD `d076e36`，2026-10-25）。范围：提高 **agent 开发效率**、方便 **Owner（项目经理）验证与管理项目**的能力。
>
> 明确排除 IDE 类功能（编译、跳转、补全、LSP、调试器、语法检查面板等）——开发、运行、测试由 agent 自行完成与验证。
>
> 方法：三路只读代码审计（现状能力 / agent 侧 / owner 侧）+ Lead 复核关键结论；所有判断都能用文中 `文件:行` 复核。审计未修改插件源码、未安装依赖、未启动服务。原始调研记录在本地 `.dsh/tmp/feature-proposal/`（不随仓库发布）。
>
> 阅读顺序：§0 结论 → §2 候选池 → §3 优先级与批次 → §5 不建议做。

---

## 0. 一页结论

### 0.1 插件现在处于什么水平

| 层次 | 现状 |
|---|---|
| 单文件开发（看/改/搜/传/Git 基础/终端/预览） | **完整**，没有硬伤 |
| 运行与复测（任务检测/运行/输出/退出码/可点击问题/刷新重连） | **基本完整** |
| Owner 交付闭环（七阶段双复核 + 人工闸门 + 验收台 + 打包 + 交付记录） | **本地单项目闭环成形** |
| Agent 双向可观测（agent 能读写插件状态、Owner 能看见 agent 动作） | **薄**：只有 19 个 memory/todo/acceptance/pipeline 工具 |

19 个模型工具全部是“项目状态/文档”类（`dsh-web-filebrowser-plugin/index.js:165-174`）。**任务运行器、端口探测、预览分享、Git、交付、验收报告**在 Host 都有实现，却**没有对应模型工具**；agent 只能用 `bash`/文件工具重新推导，owner 也看不到 agent 跑过什么。

### 0.2 五个真正值得补的断点

1. **agent 的执行/环境面是空的。** 任务/端口/预览/Git/交付无工具（`index.js:165-174`）；运行记录只在内存保留 5 分钟（`tasks.js:32`）；问题解析只在客户端（`client.js:9188-9256`）；子代理会话的改动不进原生 `workspaceChanges`（`dsh-workspace-changes/README.md:44`）。
2. **“证据 → 验收项 → 报告 → 交付包”这条链是断的。** 证据上传后只是全局 `.dsh/evidence/` 目录 + 往备注追加一行文本（`client.js:10388-10401`）；验收项 schema 没有证据字段（`acceptance.js:211-235`）；导出的报告不含证据（`acceptance.js:576-623`）；交付 zip 只有产物 + `ACCEPTANCE.md`（`delivery.js:60,409`）。**结论无法自证。**
3. **复测与审阅没有留痕。** 验收项只有 `updatedAt/checkedAt`（`acceptance.js:460-500`）；阶段评审 `note/reviewedAt` 每次覆盖（`pipeline.js:975-991`），打回后重新通过，打回记录消失；Git「已审」标记存在浏览器 localStorage（`client.js:50,3554-3576`）。
4. **Owner 离开工作台就“失联”。** 没有浏览器通知、没有页面标题角标；流水线标签没有 count（`client.js:16951-16968`）；3 秒轮询只在标签可见时跑（`client.js:8117-8124`）。等待审批/被打回/任务失败，全靠自己想起来看。
5. **交付侧只有“打包下载”，没有“交付”。** 交付记录只有文件名/大小/时间（`index.js:1753-1762`），没有版本、验收快照、校验和（`sha256File` 是死代码，`delivery.js:450`）、签收；预览分享只是 dev server 的 token 代理（`preview.js:1-25`），客户看不到验收结论。

### 0.3 推荐先做这 10 项（详见 §2/§3）

| # | 功能 | 解决 | 成本 |
|---|---|---|---|
| 1 | **P8 验收项证据链** | 让“通过”可自证，报告/交付包自动带证据 | M |
| 2 | **P10 交付前体检** | 一道可测的交付检查，把缺证据/未验/未审/未发布一次列清 | S |
| 3 | **P12 提醒与待我处理** | 角标/标题/浏览器通知：owner 不在工作台也知道“该我了” | S |
| 4 | **P11 验收组织与复测历史** | 分类/批量/模板 + fail→修→pass 留痕 | M |
| 5 | **P9 复测中心** | 一键跑 build/test/lint，结果落成证据与记录 | M |
| 6 | **P3 环境与预览工具** | 端口/预览分享/HTTP 探测变成 agent 可自证的工具 | S |
| 7 | **P4 流水线工具补全** | 修订需求/派发角色/产物存在性校验/读报告 | S |
| 8 | **P1 工作区状态总线** | 一次调用拿到项目阶段/验收/运行中任务，减少状态漂移 | M |
| 9 | **P2 运行账本与任务工具** | build/test 结构化返回 + agent 运行在 owner 面板可见 | M |
| 10 | **P13 变更审阅** | 本轮/本阶段改了什么，审阅状态持久化，可回传评论 | M–L |

> 如果只做 3 个：**P8 + P10 + P12**（验收可自证、交付前能体检、该处理时会被提醒）。如果还想让 agent 立刻受益：加 **P3**。

---

## 1. 已有能力边界（避免重复提议）

> 这些已经实现，不要再当新功能提；要做只做“增强/接线”。

| 领域 | 已有 |
|---|---|
| 文件/搜索/编辑器 | 工作区枚举与切换、文件 CRUD、拖入上传、单文件下载、属性、收藏、全文搜索、快速打开、命令面板、多标签编辑、Markdown 分屏、PDF/图片预览、刷新恢复标签/草稿/光标 |
| 运行/终端 | 命令自动检测、运行/停止、流式输出、退出码、运行历史（内存）、刷新重连、Problems 可点击、失败发回 agent；本地/SSH 终端（刷新恢复、快捷命令） |
| Git/SSH | status/stage/commit/stash/branch/checkout/diff/graph/compare/fetch/pull/push、逐文件还原、逐文件「已审」；SSH 远程目录与终端 |
| 工作区状态 | 记忆（工具+面板+快照注入）、待办（工具+面板）、验收台（工具+四状态+备注+证据上传+报告导出+发回 agent）、交付打包/记录、七阶段双复核流水线+人工闸门+快速模式+变更轮/重跑某阶段+发布记录 |
| Owner 体验 | 工作台（阶段/审批/验收/交付/运行中/设计稿/问题与状态/需求录入与修订）、悬浮对话、编辑器 Agent 动作、“发回”通道、面板 toast、侧栏徽标（Git/待办/任务/验收 fail） |
| Harness 原生 | Agent Teams roster/共享任务板/团队工具（已由 `dsh-experimental-agent-team-profile` 加载）——**不要在插件里重做团队面板** |

**不能做/做不到的边界**：第三方插件禁止写 Harness session 记录（`dsh-session/README.md:68-70`），所以插件无法把编辑器保存写进官方 changed-files/review，也无法记录 agent 的每次工具调用；所有“审计”只能覆盖项目状态事件。子代理会话的回合改动不进原生 `workspaceChanges`，所以“本阶段改了什么”需要自建阶段基线。

---

## 2. 候选功能池（18 项）

> 编号用于讨论与验收。每项含：痛点（证据）→ 做什么（MVP）→ 落点 → 成本/影响 → 可测验收。
> 成本：**S** ≤1 天、**M** 2–5 天、**L** >1 周（单人粗估，不含联调）。影响：**强/中/弱**（对 owner 或 agent 的实际日收益）。

### 2.1 让 agent 更强（执行 / 环境 / 状态 / 协同）

#### P1 工作区状态总线（`workspace_status` + 动态简报）

- **痛点**：agent 每轮重建“项目到哪一步”要串 `pipeline_status` + `acceptance_list` +（不存在的）任务状态，至少 2–3 次调用；owner 在面板通过/打回后，agent 下一轮仍按旧状态工作；快速模式会在提交后自动推进（`pipeline.js:897-938`）。当前 pipeline/验收刻意不注入 prompt（`acceptance.js:958-960`、`pipeline.js:1937-1948`）。
- **做什么**：新 Host 模块聚合只读状态；工具 `workspace_status` 返回 `{workspace, requirement, pipeline:{currentStageId,status,counts,gateMode,round}, acceptance:{counts, failing≤5}, tasks:{running,lastRun}, docs:{requirements,design,testReport}, generatedAt, truncated}`。另注册 `systemPrompt.context`（≤600 字，只放低频字段）自动简报：需求标题、当前阶段、验收通过/失败数、运行中任务数；无项目时不注入。
- **落点**：Host `workspace-state.js` + `ctx.tools.register` + `ctx.systemPrompt.context`；复用 `pipeline.listPipeline`/`acceptance.readAcceptance`/任务 manager。
- **成本/影响**：M / 强。
- **验收**：① 计数与 `pipeline_status`/`acceptance_list` 完全一致；② 面板通过阶段后，下一次请求的 prompt 出现新阶段（无需再调工具）；③ 输出 ≤4 KB，无项目零注入；④ 任务开始/结束 ≤5 秒反映。

#### P2 运行账本与任务工具（`task_*`）

- **痛点**：Host 已有完整任务运行器（`tasks.js:130-157`），但没有任务工具，agent 只能 `bash`，整段日志进上下文；问题解析只在客户端（`client.js:9188-9256`）；运行记录只在内存 5 分钟（`tasks.js:32`）；owner 在任务面板看不到 agent 用 `bash` 跑过什么。
- **做什么**：`task_detect` / `task_run`（等待至多 60 秒，返回退出码/耗时/问题数组/输出尾）/ `task_output` / `task_stop` / `task_list`；问题解析上移 Host 供工具与面板共用；运行记录持久化 `.dsh/runs.json`（≤100 条，含 `source: tool|panel`）。**只允许 detect 白名单命令**，自由命令需 owner 在设置显式开启，避免成为绕过沙箱的隐藏 shell。
- **落点**：Host 工具 + `problems.js` 解析器；需先做一次 manager/services 共享重构（工具注册在 `index.js:165-174`，manager 在 `index.js:175-185` 创建）。
- **成本/影响**：M / 强。
- **验收**：① >60 秒命令先返回 `running`+`taskId`，随后 `task_output` 取到尾部和退出码；② 制造 tsc 错误时工具返回问题数组，**任务面板显示同一批问题**；③ `.dsh/runs.json` 有记录、≤100 条、Host 重启可读；④ 未 detect 的命令与 SSH 工作区返回稳定错误码。

#### P3 环境与预览工具（`env_ports` / `preview_share` / `http_probe`）

- **痛点**：端口探测只服务内置浏览器启动页（`index.js:756-781`）；预览分享只能 owner 在验收面板手动创建；没有 HTTP 探测工具判断“服务是否真的起来”。这是流水线里最贵的人工往返，却要跨开发/测试/发布三个阶段重复。
- **做什么**：`env_ports`（复用端口扫描，返回 `{port,url}`）；`preview_share({port})` / `preview_list` / `preview_close`（复用 `preview.js`，返回 token URL）；`http_probe({url})` 仅允许 loopback、5 秒上限、返回状态码/标题/字节数。
- **落点**：Host 工具；preview manager 复用；client 无需新 UI。
- **成本/影响**：S / 强。
- **验收**：① 起 vite 5173 后 `env_ports` 含 5173；② `preview_share` 返回 token URL，curl 200，`preview_close` 后 404；③ 未监听端口 `http_probe` 5 秒内返回错误不挂起；④ 分享超 8 个返回 `too-many`，工具描述提示 token 是弱凭据。

#### P4 流水线工具补全与产物校验

- **痛点**：`updateRequirement` 有完整实现和 Host op，却**没有模型工具**（`pipeline.js:1001-1050`、`index.js:1103-1112`），模型只能用 `pipeline_set_requirement` 整段覆盖，丢失 append/refine 语义；角色派发靠人复制 PLAYBOOK 模板；`pipeline_submit_stage` 的 artifacts 只校验形状，不检查文件是否存在（`pipeline.js:648-657`），闸门评审可能看到坏路径。
- **做什么**：`pipeline_update_requirement({mode:'append'|'replace'})`；`pipeline_dispatch({stageId})` 返回可直接传给 `spawn_teammate`/`team_task_create` 的参数（prompt 用 `buildStagePrompt`）；`pipeline_submit_stage` 增加产物存在性/非空/图片后缀 `warnings[]`；只读工具 `acceptance_report` / `delivery_history` / `evidence_list`，让测试/运维角色能读报告与产物清单。
- **落点**：`pipeline.js` 工具注册 + `acceptance.js` 报告复用。
- **成本/影响**：S / 中。
- **验收**：① append 后 `.dsh/pipeline.json.requirementLog` 记录类型且追加；② dispatch 返回的 prompt 含需求/上游产物/角色边界/提交要求；③ 提交不存在产物返回 warnings，真实文件无 warning；④ 报告工具内容与面板导出一致。

#### P5 阶段级变更快照（`stage_changes` / `git_summary`）

- **痛点**：团队场景没有“阶段起点”概念，而原生 changed-files 只记录非子代理会话（`dsh-workspace-changes/README.md:44`），团队角色全是子代理；闸门评审回答不了“这一关改了哪些文件、有没有越界”。
- **做什么**：阶段开始时记录基线（git：`HEAD` + `git status --porcelain`；非 git：文件清单 size/mtime，限制 5000 文件、跳过构建目录）；工具 `stage_changes` 返回 `{files:[{path,status,added,deleted}],total,source:'git'|'scan',truncated}`；`git_summary` 返回结构化分支/暂存/更改/未跟踪/增删行。基线落 `.dsh/stage-snapshots/`。
- **落点**：Host 工具 + `pipeline.startStage` 钩子；与 P13 共用基线数据。
- **成本/影响**：M / 中强。
- **验收**：① 改 2 个/新增 1 个/删除 1 个文件后列出 4 条且状态正确；② 无改动返回空；③ 下一阶段开始后基线更新、上一阶段结果仍可查；④ 非 git 目录标注 `source:'scan'`，SSH 拒绝。

#### P6 编辑器现场上下文桥（opt-in）

- **痛点**：client 知道当前文件/选区/光标/预览地址，但只在 localStorage（`client.js:46-57,3535,8330-8338`）；agent 只能在 owner 点“解释/修复/写测试”时拿到选区。README 明确承诺默认不发送（`README.zh.md:524-529`）。
- **做什么**：客户端开关（**默认关**）+ 节流同步到 Host（TTL 60 秒）；工具 `workspace_context` 返回 `{available, activePath, selection≤4KB, cursor, tabs≤16, previewUrl, view}`；不注入 prompt、不自动发消息；超时/关闭返回原因。
- **落点**：Host 工具 + client 新 op；开关进工作台设置。
- **成本/影响**：M / 中。
- **验收**：① 关闭时返回 `available:false`；开启后 1.5 秒内返回文件与选区；② >4 KB 截断、60 秒无同步返回 stale；③ 多会话/多工作区不串台；④ 关闭状态下浏览文件不产生任何 Host 快照。

#### P7 工具卡片 + 角色技能 + 可操作错误

- **痛点**：19 个插件工具在对话里都是一行通用卡（`tool.call.toolview` 未注册）；角色边界只存在于 `docs/opc/*` 与 `pipeline_stage_prompt`，非流水线任务无法主动加载；工具错误多为一句话，没有 code/下一步。
- **做什么**：① 为 `acceptance_*`/`pipeline_*`/`task_*`/`preview_share` 注册 5 类 keyed 时间线卡片（状态点 + 计数 + “打开对应面板”）；② `ctx.skills.register` 注册 3 个技能包（交付流程/验证/发布）；③ 工具错误统一 `{code, message, nextAction}`（先覆盖 8 个高频错误）。
- **落点**：client `tool.call.toolview`、Host `ctx.skills.register`、工具实现层。
- **成本/影响**：S / 中。
- **验收**：① 调 `acceptance_add` 后时间线出现结构化卡并可跳面板；② `/` 菜单出现 3 个技能；③ 未启动阶段提交返回 `code:'stage-not-active'` 且 nextAction 指向 `pipeline_start_stage`；④ 服务缺失时回退通用卡/提示段，插件仍正常加载。

### 2.2 验收台（Owner 的可信验证）

#### P8 验收项证据链（证据 → 验收 → 报告 → 交付）

- **痛点**：证据不绑定验收项（全局目录 + note 文本）；schema 无证据字段；pass 可以零证据且无提示；报告零证据；交付包零证据。Agent 也没有附加证据的工具。证据：`client.js:10388-10401`、`acceptance.js:211-235/576-623`、`delivery.js:60,409`。
- **做什么**：① `acceptance.json` 每项新增可选 `evidence:[{path,label,kind:'screenshot'|'log'|'report'|'diff'|'url',addedAt,addedBy}]`（≤10 条/项，只允许工作区内相对路径，旧 note 中 `证据：` 行读取时迁移、写回保留原文）；② 新 op `acceptanceEvidenceAdd/Remove` + 模型工具 `acceptance_evidence_add`；③ 验收台只显示当前项证据缩略图，上传默认绑定选中项；④ 无证据设为 pass 时二次确认，列表打“缺证据”标记，工作台“需要你处理”计入；⑤ 报告每项输出证据链接（≤3 个），交付 zip 增加 `evidence/`（引用文件，单文件 ≤20 MB、总量 ≤200 MB）。
- **落点**：Host schema + 路由 + 模型工具 + client 验收台/工作台 + 报告/交付。
- **成本/影响**：M / 强。
- **验收**：① 给 A 项传 2 张图，切到 B 项证据区为空、A 项仍在；② 无证据 pass 出现确认，报告新增“证据缺口”小节；③ zip 内 `evidence/` 与报告引用一致；④ 旧格式文件可读取且不重复追加；⑤ agent 调工具后面板刷新可见。

#### P9 复测中心（一键跑验证并落成证据）

- **痛点**：owner 要复测时得自己回忆该跑哪些命令、跑完还要手工抄结果；测试/运维 agent 跑完的输出不落到验收项；“最近一次测试是否通过”没有结构化记录。
- **做什么**：验收台/工作台新增 **复测** 按钮：按项目检测结果选择 build/test/lint 命令（可勾选）→ 复用任务运行器执行 → 汇总 `{commands, exitCodes, duration, problemCount, problems≤25, tail}` → 写 `.dsh/verifications/<时间戳>.json` + 日志证据 → 卡片显示“最近复测”，失败项一键发回 agent。不新增依赖，不替代任务面板。
- **落点**：Host op `verifyStart/verifyStatus`（复用 tasks manager）+ client 验收台/工作台。
- **成本/影响**：M / 强。
- **验收**：① 一次点击按选择的命令跑完，结果显示命令/退出码/耗时/问题数；② 结果与日志落 `.dsh/verifications/`，刷新后可查；③ 失败可一键发回 agent（prompt 带命令、退出码、问题列表）；④ 不改变现有任务面板行为。

#### P10 交付前体检（Preflight）

- **痛点**：approval 闸门要求 owner 自己核对“验收全 pass、变更已审、报告与证据齐全、预览可用”，但没有任何工具把条件列成清单（`PLAYBOOK.md:79-83`）；打包确认只提示“还有 N 项未完成/未通过”，粒度粗。
- **做什么**：纯客户端聚合卡片/弹窗，逐项 **pass / warn / fail** 并带“去处理”跳转：验收状态、证据缺口、变更审阅（P13 落地后）、最近测试、发布记录、预览分享、本轮是否打包/导出报告。结论“可以交付 / 建议先处理 N 项”，一键写入评审备注草稿；可选落 `.dsh/preflight.json`。
- **落点**：client 工作台 + 流水线 approval 横幅；只读调用现有 op。
- **成本/影响**：S / 强。
- **验收**：① 1 项 fail + 2 项无证据 + 1 个文件未审时列出三类且数量与各面板一致；② 全部满足显示“可以交付”；③ 预览关闭只标 warn，不阻塞；④ 体检不改任何文件（可选快照除外）。

#### P11 验收组织与复测历史

- **痛点**：`category` 被产品经理写入，但客户端**从未渲染**（全文仅一处 prompt 文案 `client.js:9611`）；`requirement` 在面板不显示；没有分组/过滤/批量；验收项没有历史，fail→修→pass 的中间过程不留痕（`acceptance.js:460-500`）；阶段评审 `note/reviewedAt` 覆盖，打回记录消失（`pipeline.js:975-991`）。
- **做什么**：① 按 `category` 分组折叠 + 状态过滤（全部/未完成/失败/阻塞/缺证据）+ 多选批量回填；② 详情显示 `requirement`；③ 内置 3 套验收模板（Web 交付/移动端/内部工具），按 title 去重；④ 验收项 `history[]` append-only（≤50 条/项）+ `retestRound` 计数；⑤ 可选阶段 `reviews[]` 保留每次通过/打回；⑥ 报告增加“复测轮次”列。
- **落点**：Host schema + 报告 + client 验收台/工作台。
- **成本/影响**：M / 强。
- **验收**：① 3 个 category 的 12 项按组显示且组头计数正确；② 批量 5 项 pass 后 `checkedAt` 均更新；③ 模板重复应用按 title 去重；④ fail→pass→fail→pass 历史 4 条、轮次 2；⑤ 历史超 50 条截断且文件 <1 MB。

#### P12 提醒与“待我处理”

- **痛点**：无浏览器通知、无页面标题角标；流水线标签没有 count（`client.js:16951-16968`），验收角标只算 fail；工作台 3 秒轮询只在标签可见时跑（`client.js:8117-8124`）。owner 在聊天里等 agent 时不知道阶段已进入待审批/被打回。
- **做什么**：① 侧栏「流水线」角标 = 待审批 + 被打回；「验收」角标 = fail +（P8 后）缺证据；② `document.title` 前加 `(N)`；③ Notification API：阶段进入 review / 被打回 / 任务失败 / 交付包生成时通知，点击聚焦对应视图；节流 5 分钟、页面可见时不弹；④ 无权限/不支持时静默降级。
- **落点**：纯 client（现有 3 秒轮询 + 状态 diff）+ i18n。
- **成本/影响**：S / 强。
- **验收**：① agent 提交阶段后 ≤10 秒角标与标题出现 1；打开流水线后消失；② 后台停留时收到系统通知，点击切到流水线；③ 5 分钟内重复进入 review 不重复弹；④ 拒绝权限不报错。

### 2.3 审阅与审计（信任与留痕）

#### P13 变更审阅（本轮/本阶段改了什么）

- **痛点**：Git 更改列表是“整个工作区现状”，owner 不知道“开发阶段开始后 agent 改了哪些文件”；「已审」标记存 localStorage（`client.js:50,3554-3576`），换浏览器丢、agent 不可见、不进报告/交付包；工作台/闸门不显示“还有 N 个文件没审”。
- **做什么**：① `.dsh/review.json` 持久化审阅状态 `{path:{sig,at,stageId,round}}`，签名沿用 status/staged/untracked，变化即失效；② 工作台/流水线新增“本轮变更”卡，以阶段 `startedAt` 为基线列出文件 + 增删行数，逐行「已审」；③ 闸门显示“未审 N”警告（不硬阻断）；④ 报告/交付记录带 `{reviewed,total}`；⑤ 第二阶段：diff 内行内评论 → 结构化 prompt 发回 agent，修复后标记解决/过期。
- **落点**：Host `review.js` + 复用 P5 基线 + client 工作台/流水线/Git 面板。
- **成本/影响**：M–L / 强。
- **验收**：① 阶段内改 3 个文件显示 3 条，标记后刷新/换浏览器仍保留；② 文件再改后「已审」失效；③ approval 显示未审数并与 Git 面板一致；④ 非 Git 工作区显示“不可用”且不影响其他卡片。

#### P14 审计时间线

- **痛点**：`.dsh/` 没有 append-only 审计；现有“流程记录”是从当前时间戳反推（`client.js:14842-14873`），打回记录会消失；验收状态、证据上传、交付、发布没有统一时间线。
- **做什么**：`.dsh/audit.json`（append-only，≤2000 条）；在验收/证据/流水线/发布/交付的关键变更点写事件 `{at,kind,actor:'owner'|'agent'|'system',round,detail,ref}`；新 op `auditList` + 工作台“时间线”卡 + 导出 Markdown/JSON。**明确披露不含 agent 的 bash/文件工具调用**（插件无权写 session 记录）。
- **落点**：Host 新模块 + client 视图。
- **成本/影响**：M / 中。
- **验收**：① 打回→重启→再提交→通过后 4 条事件都在；② 验收/证据/打包各有事件且 actor 正确；③ 导出包含时间/操作/主体/细节；④ 并发审批不损坏文件。

### 2.4 交付与项目管理

#### P15 交付清单、版本、签收 + 客户交付页

- **痛点**：交付记录只有 name/bytes/fileCount/createdAt/hasReport（`index.js:1753-1762`），无版本/验收快照/校验和/签收；`sha256File` 已实现但从未调用（`delivery.js:450`）；预览分享只是 dev proxy，客户看不到验收结论；客户两周后问“那包是哪一版、当时验收什么状态”，owner 只能猜。
- **做什么**：① 打包确认增加版本号（默认 `v<round>.<yyyymmdd-HHmm>`）与客户/渠道（可选）；② 记录扩展 `version/acceptance snapshot/sha256/evidenceCount/review`；③ 新 op `deliveryAcknowledge`（只允许 owner 面板改签收状态）；④ 生成自包含只读客户交付页（`.dsh/handoff/<round>/`，token 静态服务）：项目/版本/验收统计（未通过项红色列出）/证据缩略图/发布链接/报告下载；⑤ 客户反馈写 `.dsh/feedback.json`，工作台提示并支持一键发起变更轮次。**安全**：只服务 handoff 目录、禁止目录穿越、token 生命周期（默认 24h/手动关闭）、不暴露源码路径。
- **落点**：Host 记录扩展 + 静态页生成 + 静态 token 路由；client 验收台/工作台。
- **成本/影响**：M–L / 强。
- **验收**：① 打包两次版本、sha256 不同且与 `sha256sum` 一致；② 记录冻结当时的验收计数；③ 标记客户确认后刷新/重启仍在，模型工具无权改；④ 手机能打开交付页且看不到源码路径；关闭后 404、`../` 被拒；⑤ 客户反馈回流为变更轮次草稿。

#### P16 验收报告 v2 + 落盘留档

- **痛点**：报告只有统计 + 表 + 未通过项（`acceptance.js:576-623`），无证据/复测轮次/变更审阅/发布记录/交付清单/签收栏；报告只下载到本地，不落工作区（下次找不到）；交付 zip 里只有 `ACCEPTANCE.md`。
- **做什么**：报告 v2 结构（项目/版本/轮次/生成时间/统计/验收项表含分类/验收条件/证据数/复测轮次/证据附录/审阅/发布/交付清单/签收栏）；新 op `acceptanceReportSave` 写入 `.dsh/reports/`（保留 50 份）；导出改为“保存 + 下载”；交付包默认带 v2 报告；工作台显示最近报告。
- **落点**：Host 报告生成 + 落盘 op；client 验收台/工作台。
- **成本/影响**：S–M / 强。
- **验收**：① 报告含证据链接、发布 URL、校验和；② 连续导出两份均可查；③ 数字与验收台/流水线一致；④ zip 内报告为 v2。

#### P17 多项目/多工作区总览

- **痛点**：一个工作区 = 一个项目，工作台只读当前 root；owner 同时跟 3 个项目时必须逐个切换才知道“哪个在等我审批、哪个有失败项、哪个还没交付”。
- **做什么**：新 op `projectOverview` 对最近使用的工作区（默认 ≤10 个）并发读取 `.dsh/pipeline.json`/`acceptance.json`/`deliveries.json` 摘要；工作台新增“所有项目”卡（或“更多 → 项目”视图），按“需要你处理”排序，点行切换工作区并直达工作台；单 root 失败只降级该行；60 秒自动刷新。
- **落点**：Host op + client 视图；纯读。
- **成本/影响**：M / 中（项目多时才痛）。
- **验收**：① 3 个工作区状态正确；② 某 `.dsh` 损坏只该行显示“读取失败”；③ 点击切换后工作台数据一致；④ SSH root 显示“不支持”不卡死。

#### P18 视觉验收与移动端（零依赖方案）

- **痛点**：视觉验收只能手动截屏上传（`ACCEPTANCE.md:57`）；手机验收是桌面式小按钮；没有前后对比。无头浏览器截图当前不可用：系统虽有 Playwright 的浏览器缓存，但缺少系统库（`libglib-2.0.so.0`），且没有 playwright/puppeteer 包。
- **做什么（不新增依赖）**：① 内置浏览器/预览工具栏“截图存证据”：用浏览器 `getDisplayMedia`（用户手势 + localhost 安全上下文）捕获当前标签页画面 → canvas → 上传 `.dsh/evidence/` → 绑定当前验收项（P8）；权限拒绝/不支持时回退文件上传。② 同一验收项多张截图，支持前后并排/拖动对比。③ 移动端验收卡片：三个大按钮 + 拍照/相册上传（`accept=image/* capture=environment`），缩略图全屏滑动。④ 可选后续：等环境具备浏览器运行时时，再做 agent 无头截图/console 工具（当前成本 L，不做）。
- **落点**：纯 client（截图/对比/移动端）+ 现有 IO 上传 + P8 证据绑定。
- **成本/影响**：M / 中强。
- **验收**：① localhost 下截图成功并绑定选中验收项；② 拒绝权限时回退文件选择且不报错；③ 两张截图可对比；④ 手机上一条验收可“拍照→判不通过→写原因”单手完成；⑤ 无新依赖。

---

## 3. 优先级与实施批次

排名口径：**owner 每天/每轮用得到 × 可落地性（S 优先）× 对“验收可信度/交付”的直接贡献**；agent 侧候选额外看“是否不改变执行安全模型”。

| 梯队 | 内容 | 依赖 | 预估 |
|---|---|---|---|
| **第一梯队（先做）** | P8 证据链 → P10 交付前体检 → P12 提醒 → P11 验收组织/历史 → P16 报告 v2 → P3 环境/预览工具 → P4 流水线工具补全 | P8 先定证据 schema；P16 复用 P8/P11 数据 | 约 6–9 天 |
| **第二梯队** | P9 复测中心 → P1 状态总线 → P2 运行账本 → P13 变更审阅 | P9/P2 共用任务执行层；P13 复用 P5 基线 | 约 8–12 天 |
| **第三梯队** | P15 交付页/签收 → P14 审计 → P5 阶段快照 → P7 卡片/技能/错误 → P6 现场上下文 | P15 依赖 P8/P16；P13/P5 共用基线 | 约 8–12 天 |
| **按需** | P18 视觉/移动端（零依赖部分可提前）→ P17 多项目总览 → 平台整合（设置页/快捷键/LSP 之外的基础设施） | P18 依赖 P8；P17 项目多时才痛 | 按需 |

**如果只做 3 个**：P8 + P10 + P12。想让 agent 同步受益：再加 P3。
**一个判断**：先补“验收可自证”这条链，再补 agent 工具面。原因是 owner 的核心工作是判断“能不能交付”，而当前证据、复测、提醒三处断点直接影响这个判断；agent 工具面是效率提升，但可以在验收台闭环后逐一接入，且不改变现有闸门与安全模型。

**实施纪律（避免破坏当前稳定性）**

1. 数据只加可选字段、不改语义；旧文件读取容错、写回保留未知字段（沿用 `acceptance.js:211-235` 的 normalize 风格）。
2. Host 新 op 沿用现有安全模式：精确路由白名单、root realpath + 根内校验、mutation lock、原子写（`acceptance.js:298-344`、`pipeline.js:497-553`）。
3. 不新增 npm 依赖、不引入构建步骤；客户端新增 UI 复用既有 `ds-*` class 与主题 token（client.js 已 ~22k 行）。
4. 每个 op 先写自测脚本（参考 `.dsh/tmp/team/*-selftest.mjs`），GUI 复测步骤补进 `docs/ACCEPTANCE.md` 新批次；Host 变更后首次需重启 Harness。
5. i18n zh/en 同步（曾因漏键整屏显示 key）；新增工具名避免与原生 `todo_write`/`bash`/`job_*` 冲突。
6. 大文件/大输出都设上限并返回 `truncated`，避免把上下文或 `.dsh` 撑爆。

**顺带的工程性改进（不是新功能，但直接提升 agent 的开发/验证效率）**

- **把灰盒自测变成可复跑**：`tasks/acceptance/delivery/pipeline/preview` 的行为自测目前只在 `.dsh/tmp/team/*.mjs`（被 `.gitignore` 忽略、不随包发布）。建议收敛到 `scripts/selftest/` 并在 `package.json` 加 `test` 脚本，让 agent 每批改动都能跑回归。
- **文档与代码对齐**：插件 README 仍写“只注册 memory/todo 工具”（实际 19 个）、只列 9 个 localStorage key（实际 ≥18）；主 README 缺任务/验收/流水线/工作台/交付专节；`ACCEPTANCE.md` 停在 v1.2.30、`ROADMAP.md` 现状表与进度表自相矛盾。这些会让下一次 agent 规划功能时重复造轮子。
- **CHANGELOG 版本标题**：目前全部堆在 `Unreleased`（仅 `1.0.0` 有标题），发布说明不可追溯；按版本建标题便于 owner 验收“这批到底改了什么”。

---

## 4. 接入 Harness 原生能力的边界（先接后建）

| 事项 | 结论 |
|---|---|
| 团队 roster/共享任务板/消息 | 已由 `dsh-experimental-agent-team-profile` 提供，**不要重做**；插件只做项目视角的只读聚合（P17） |
| agent 的 jobs/终端 | 原生已有 `ctx.jobs`/`ctx.remote.terminal`；插件任务面板与它们仍是两套。长期应统一（P2 先共享数据模型，而非立刻替换） |
| Harness approvals | composer 级动作审批，与项目级人工闸门语义不同，保持互补，不合并 |
| 技能 | 原生 `ctx.skills.register` 可用（P7），不要再造一套规则加载器 |
| 无头浏览器 | 当前环境不可用（缺系统库，且无 playwright 包）；不要为截图引入重依赖。视觉验收先走 owner 浏览器采集（P18） |
| session 记录 / changed-files | 第三方插件禁止写 session 记录，子代理改动不进原生 changed-files；因此审计只做项目状态事件（P14），变更归属用阶段基线（P5/P13） |
| 设置页/快捷键/命令面板 | 原生 `configForms`/`shortcuts`/`commandUi` 可用，属基础设施，可随批次顺带接入，不作为独立功能提案 |

---

## 5. 不建议做

| 不做 | 原因 |
|---|---|
| LSP/跳转/补全/调试器/独立 Problems 面板/CodeMirror | 明确排除的 IDE 功能；agent 用 `read`/`edit`/`grep`/`bash` 已能自证 |
| Playwright/Chromium 自动截图作为硬依赖 | 当前环境缺系统库，需新增大依赖；成本 L，收益被“owner 浏览器采集 + 手机截图 + 证据绑定”覆盖大半（P18 已给零依赖方案） |
| 在插件里重做团队面板/消息流 | 原生已有；重做会打架，且客户端没有稳定公开的 Team 写接口 |
| 插件伪造 session 记录 / changed-files | 上游禁止（`dsh-session/README.md:68-70`） |
| 自动审批/agent 自批 | 破坏人工闸门设计；快速模式已是显式选择 |
| 完整多人协作/客户账号/权限体系 | 属 Harness remote-access/authorization 范围，插件精确路由只对 owner 打开 |
| 电子签章/法律级签收 | 需要 CA/合规；插件只做“记录声明”，UI 必须写清非法律凭证 |
| CI/CD/一键部署/依赖管理/数据库面板 | ROADMAP P3 之后；凭据管理（secrets）未就绪 |
| 完整测试管理系统（用例库/参数化/CI 报告导入） | 超出验收台范围；P9 只做“一次复测 → 一条证据” |
| 把 owner 终端输出喂给 agent | 终端设计为输出不进 agent transcript，且可能含密钥 |

---

## 6. 建议的验收方式（对本提案）

- **P8/P10/P11/P12/P16**：用当前仓库或任意本地工作区造 3 类数据（全 pass、含 fail、含缺证据），逐项走一遍验收台 → 交付前体检 → 导出报告 → 打包，核对报告/zip 内容与计数一致。
- **P3/P4/P9**：起一个 dev server（如 `python3 -m http.server` 或 vite），验证端口/分享/HTTP 探测/复测；关闭后链接 404；产物缺失时 warnings 正确。
- **P1/P2/P13/P5**：用子代理改 3 个文件 + 跑一次会失败的测试，检查状态总线/运行账本/阶段变更/审阅计数是否与面板一致；Host 重启后 `.dsh/` 记录仍在。
- **P15**：打包两次比对版本与 sha256；手机浏览器打开交付页；关闭 token 后 404；尝试 `../` 路径穿越被拒。
- 每批完成后把 GUI 步骤补进 `docs/ACCEPTANCE.md`，并用 `.dsh/acceptance.json` 记录通过/失败。

---

## 7. 实施状态（v1.2.68，2026-10-25）

本轮交付完成推荐清单中的 10 项；其余候选保留为后续批次。**Host 改动需重启一次 Harness**，客户端刷新即生效。验收步骤见 `docs/ACCEPTANCE.md` 批次 5。

| 候选 | 状态 | 备注 |
|---|---|---|
| P1 工作区状态总线 | ✅ 已实现 | `workspace_status` 工具 + ≤600 字 systemPrompt 简报 |
| P2 运行账本与任务工具 | ✅ 已实现 | 5 个 `task_*` 工具、`.dsh/runs.json`、Host 端问题解析、任务面板运行账本 |
| P3 环境与预览工具 | ✅ 已实现 | `env_ports` / `preview_share|list|close` / `http_probe` |
| P4 流水线工具补全 | ✅ 已实现 | `pipeline_update_requirement` / `pipeline_dispatch` / 产物 warnings / 阶段 reviews / 只读报告与交付工具 |
| P5 阶段级变更快照 | ◐ 部分 | P13 已在阶段开始时捕获 Git 基线并展示本轮变更；独立 `stage_changes` agent 工具未做 |
| P6 现场上下文桥 | ○ 未做 | 需要 opt-in 开关与客户端快照同步 |
| P7 工具卡片/技能/错误 | ○ 未做 | — |
| P8 验收证据链 | ✅ 已实现 | evidence[]、缺口提示、报告/交付包证据、`acceptance_evidence_add` |
| P9 复测中心 | ✅ 已实现 | 客户端编排任务运行器；`.dsh/verifications/` 记录与证据 |
| P10 交付前体检 | ✅ 已实现 | 工作台七项检查卡 |
| P11 验收组织与历史 | ✅ 已实现 | 分类/筛选/批量/模板/历史/复测轮次/报告 |
| P12 提醒与待我处理 | ✅ 已实现 | 角标 / 标题 `(N)` / 可选浏览器通知 |
| P13 变更审阅 | ✅ 已实现 | `.dsh/review.json`、阶段基线、持久化已审标记、本轮变更卡；行内评论（第二阶段）未做 |
| P14 审计时间线 | ○ 未做 | — |
| P15 交付清单/签收/客户页 | ○ 未做 | P8 已让交付包带证据；版本/签收/静态交付页未做 |
| P16 报告 v2 + 留档 | ◐ 部分 | 报告已含证据附录/缺口/复测轮次；`.dsh/reports/` 留档与校验和未做 |
| P17 多项目总览 | ○ 未做 | — |
| P18 视觉验收/移动端 | ○ 未做 | 零依赖截图与对比、移动端大按钮未做 |

**门禁与安全边界未变**：审批仍只能由人在面板完成；任务工具只接受 detect 白名单命令；插件仍不写 Harness session 记录。

**v1.2.69 追加**：工作区待办新增「交给产品」一键派发——把待办标题/备注写成需求、启动产品经理阶段并把角色提示发到当前对话；已完成项目走新一轮变更，进行中/待审查项目不覆盖而是引导去工作台。它是纯客户端功能（复用现有 pipeline 路由），刷新页面即可用；验收步骤见 `docs/ACCEPTANCE.md` 批次 6。

---

## 附录 A 原始候选映射

| 本提案 | 来源候选（审计编号） |
|---|---|
| P1 | A1 状态总线 |
| P2 | A2 运行账本/任务工具 |
| P3 | A3 环境与预览 |
| P4 | A4 流水线工具 + A5 只读产物 |
| P5 | A7 阶段变更快照 + A11 git 摘要 |
| P6 | A6 现场上下文桥 |
| P7 | A8 工具卡片 + A9 技能 + A13 错误 |
| P8 | O1 证据绑定 + O11 证据采集（工具部分） |
| P9 | 新增（合并 O11 任务输出为证据） |
| P10 | O2 Preflight |
| P11 | O3 分类/批量/模板 + O5 复测历史 |
| P12 | O4 提醒 |
| P13 | O6 变更审阅 + O13 行内评论 |
| P14 | O7 审计时间线 |
| P15 | O8 交付清单/签收 + O9 客户交付页 |
| P16 | O10 报告 v2 |
| P17 | O12 多项目总览 |
| P18 | O11 证据采集（截图部分）+ O14 移动端 + 本提案补充的零依赖截图 |

## 附录 B 关键证据索引

- 工具注册面：`dsh-web-filebrowser-plugin/index.js:165-174`；模块注册 `memory.js:750-995`、`todo.js:737-940`、`acceptance.js:718-955`、`pipeline.js:1594-1930`
- 执行层：`tasks.js:130-157`（运行器）、`tasks.js:32`（5 分钟内存保留）、`client.js:9188-9256`（客户端问题解析）、`index.js:756-781`（端口探测）、`preview.js:118-285`（预览分享）
- 验收：`acceptance.js:211-235`（schema）、`460-500`（状态变更）、`576-623`（报告）、`client.js:10388-10401`（证据=note 文本）
- 流水线：`pipeline.js:845`（startStage）、`897-938`（fast 提交后自动推进）、`975-991`（评审覆盖）、`1001-1050`（updateRequirement）、`1134`（restartStage）、`1343`（buildStagePrompt）
- 交付：`delivery.js:60,389-448`（打包）、`450`（sha256File 死代码）、`index.js:1672-1762`（交付记录）
- 提醒/审阅：`client.js:8117-8124`（工作台轮询）、`16951-16968`（侧栏徽标）、`50,3554-3576,5297-5304`（已审 localStorage）
- 文档：`docs/ROADMAP.md`（旧路线图）、`docs/PLAYBOOK.md:79-100`（交付流程）、`docs/ACCEPTANCE.md:57`（截图限制）、`docs/AGENT_TEAM.md:20-44`（闸门）
- Harness 原生：`dsh-session/README.md:68-70`（session 写限制）、`dsh-workspace-changes/README.md:44`（子代理不记录）、`dsh-experimental-client-ui-agent-team/README.md:10-13`（团队面板已存在）、`dsh-client-ui-tool/README.md:12,36-46`（toolview 槽）

## 附录 C 调研记录

本地只读研究记录（不随仓库发布）：`.dsh/tmp/feature-proposal/current-capabilities.md`（现状审计）、`agent-efficiency.md`（agent 侧 13 项）、`owner-verification.md`（owner 侧 14 项）。
