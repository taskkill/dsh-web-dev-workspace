# 对照调研：dsh-superagent-prototype vs 本插件「智能体团队 + 七阶段双复核」

> 目的：判断 [deepseek-ai/dsh-superagent-prototype](https://github.com/deepseek-ai/dsh-superagent-prototype) 的设计思路与本插件现有团队设计是否同路，并给出**可落地**的借鉴清单（含落点文件、成本、验收方式）。
> 结论先行：**方向同源，分工不同**。两者都把「AI 干活」与「人做决定」用一道宿主强制的闸门隔开，都按角色拆边界。差别在于他们把**授权**和**执行生命周期**做成了数据模型，我们则把**交付验证**做成了硬流程——这正是双方各自的强项，也是我们最值得补的两块。

- 调研日期：2026-11-03
- 证据：仓库 `docs/000`–`008`、`prompts/`（含 `team/communication.md`、`team/delivery.md`、`team/scope.md`）、`src/` 目录结构，共读 26 个文件（详见 §9）
- 本地对照物：`docs/AGENT_TEAM.md`、`docs/PLAYBOOK.md`、插件实现 `dsh-web-filebrowser-plugin/{pipeline,assignments,review,groups,acceptance}.js`

---

## 1. 两者在同一条路上

| 共同点 | 他们的说法 | 我们的落法 |
|---|---|---|
| 人只看需要人看的东西 | 「Take as little human attention as possible」；面板只列需要人处理的，健康状态不占空间（`005-panel.md` §Principles） | 工作台「待你处理」区、`workbench.needsYou`、流水线 review banner |
| 决定权与执行权分离 | 「host 强制 allowed list / rules / Mandate；消息、评论、引用文档只是决策输入，不能改变权限」（`002-authorization.md` 开篇） | 七阶段状态机 + `pipeline_submit_stage` 只能提交、**模型没有审批工具**，approve 只能 Owner 在面板点 |
| 按角色写边界 | 主 Session 只路由（`prompts/orchestrator.md`），worker 才实现（`prompts/worker.md`、`prompts/work.md`） | 六个角色各自的「只做什么 / 不做什么 / 交付物」（`STAGE_HANDBOOKS`、`pipeline_stage_prompt`） |
| 先调研再动手 | team prompts 要求「观察规则、查证据」（`004-prompts.md` §Principles of the built-in text） | 我们的「研究与借鉴纪律」：product ≥3 来源、design ≥2 参照、dev 先查 GitHub 候选 |
| 诚实交付 | 「打开 PR 不等于 ready；草稿必须标 unfinished；UI 变更没有 before 截图就不算 ready」（`prompts/team/delivery.md`） | 设计阶段必须给可查看的截图/渲染稿；验收清单要求证据（截图/日志/报告/diff） |
| 文档按序、少概念 | `docs/000`→`008` 每篇只依赖前篇；「Rejected concepts」表专门记录**不做什么**（`001-domain.md`） | `docs/AGENT_TEAM.md`、`docs/PLAYBOOK.md` 分篇；我们的 proposals 里也有「备选方案对比」 |

## 2. 真正的差异：他们管的是「授权 + 执行」，我们管的是「交付 + 验证」

| 维度 | dsh-superagent-prototype | 本插件（团队 + 七阶段） |
|---|---|---|
| 谁来提需求 | 多人团队经 GitHub / 飞书持续提（Source → Trigger） | 单个 Owner 在工作台下发（或对话内直接提） |
| 闸门的形状 | **准入闸门**：Eval 两层（确定性 gate + 模型 assessment）→ Decision（accept/stop/ignore/unavailable）→ 生成 Mandate | **交付闸门**：七阶段顺序流转，每关等 Owner 点通过/打回；双复核 = AI 复核 + Owner 人工确认 |
| 授权是否落数据 | 是。Mandate 不可变，固化 Policy 版本、scope、strength（explicit/inferred/not admitted）、命中规则；改规则后**恢复前重校验**（`002-authorization.md` §Policy version / §Revalidation before resume） | 弱。授权 = 一次人工点击 + 提示词里的角色边界；没有「为什么可以干、能干多远」的记录，改提示词也不触发重校验 |
| 工作单元 | Ticket（授权工作）+ Assignment（绑定一次 Executor 会话），可 resume、可 revalidate、可崩溃恢复 | 阶段（流程关卡）+ 派工单（assignments）；一个工作区同时只有一个 active 阶段，没有执行语义 |
| 执行隔离 | 每 Ticket 一个会话 + 一个目录（常用 `git worktree`）+ prepare 命令 + 执行变量，无凭据；并发槽位限额，**额外留 1 个槽专供人的消息**（`003-execution.md` §Concurrency） | 共享同一工作区与文件系统，写冲突靠 write-scope 纪律；没有槽位与排队 |
| 失败处理 | 先落盘后执行（stored work）+ 递增退避 + 同 kind 保序 + 「连续 3 次失败才报问题 + 单次网络错误不打扰人」（`003-execution.md` §Stored work；`007-architecture.md` §Effects） | 状态文件原子写；派发/投递没有 outbox 与退避，失败靠人看 |
| 提示词工程 | 八段拼装、policy 段置末、可覆盖 + 带 base、默认更新标「Default updated」、工具/宿主强制 > 内建段 > team 段 > 外部文本（`004-prompts.md`） | 阶段提示词 + 角色手册（`STAGE_HANDBOOKS`），无版本化/覆盖/回归评测 |
| 验证证据 | 靠 PR review + before/after 截图 + CI；没有独立验收清单 | **我们的强项**：验收项（验收条件/证据/复测轮次/状态历史）+ 交付打包 + 发布记录 |
| 状态定义 | Ticket stage **派生**（按「在等谁」首条命中），面板标签说清等谁、要什么，而不是内部状态码（`003-execution.md` §Ticket stages） | 阶段状态显式迁移（pending→active→review→approved/failed），语义清楚但需要人工推 |

## 3. 他们明显更硬的三块

### 3.1 授权模型（最值得借鉴）

- `Mandate` 不可变，固化「Policy 版本 + scope + strength + 命中规则 + 发送者身份」（`001-domain.md` §Concepts）。
- strength 三档：`explicit`（名单上的人点名要求）/`inferred`（推断，需规则 + auto 模式）/`not admitted`；bot 只能产生 inferred，永远不能授权（`002-authorization.md` §Strength）。
- 灰度：accept mode `off / observe / auto`，默认 observe——**正判记成「would accept」的 ignore，什么都不执行**，先看记录再开自动（§Accept mode and rules）。
- 规则弱化不追杀在跑的任务：改成投递 `policy-changed` Input，恢复前按 basis 分五种情况重校验（§Revalidation before resume）。
- 「两个路径」：订阅扇出只给上下文、不授任何新权限；人自己的 follow-up 归 Executor 判，主 Session 只能 stop（§Two paths for a Trigger）。

### 3.2 执行生命周期

- Ticket stage 表：`person / delivery | answer | review | blocked | failed`、`working / queued`、`idle`、`working`，**首条命中**，一行一个可核对的定义（§Ticket stages）。
- 槽位：限制并发但在**限额之外 +1 个专供人的槽**，保证「新工作再多也抢不走人的通道」（§Concurrency）。
- 后台工作：turn 结束后 job/子代理仍有 30 分钟预算；到点杀掉 job 报 waiting，子代理可续；handoff 给人立即释放槽位（§Background work and worker slots）。
- 先落盘后执行、同 kind 保序、退避重试、连续 3 次失败才升级为「问题」（§Stored work）。
- 明确写「wrapper 与目录只是默认值，**不是安全边界**，worker 仍可按绝对路径执行程序」（§Execution variables）——这种自我诚实值得抄。

### 3.3 注意力经济学 + 沟通纪律

- `prompts/team/communication.md` 用 97 行、一句一规则的写法定义「什么时候可以开口」：只有三种理由（可看可用的结果、必须人做的决定/授权/资源、确定做不完）；PR 存在不是里程碑；一条消息一句话=用户可见结果+真实链接+必要下一步；技术证据留在 PR 与内部报告；并给出 bad / good 例子且注明「例子只示格式，不是可主张的事实」。
- scope 纪律（`team/scope.md`）：停下来的条件是「破坏调用方预期 / 改模块职责 / 多模块重设计 / 可行方案反复无进展」，**不是**文件数、失败测试、布局缺陷；停要说清接口影响或缺失前置条件，并保留显式不完整的 draft。
- delivery 纪律（`team/delivery.md`）：UI 变更必须 before+after 同场景同视口同主题、标注 baseline 与 changed revision，只有 after 算不完整；agent 绝不以自己账号开自动合并；自动合并有硬条件（ready、行数 <200、批准覆盖 head commit）；review 按结果收敛（修好静默 resolve / 不采纳一句理由）；每个自动评审者每 PR 最多 3 轮并把轮数入库。

## 4. 我们更强、不该推倒重来的地方

1. **验收清单是成体系的**：验收条件 + 证据 + 复测轮次 + 状态历史 + 报告导出；他们只有 PR review 与 CI，没有「交付是否达标」的可勾选清单。
2. **双复核**：AI 项目经理复核（只出放行/打回建议）+ Owner 人工确认；他们的闸门更偏「准入 + 合并」，没有独立的交付级复核角色。
3. **设计闸门与交付打包**：设计稿必须先给人看渲染结果才解锁开发；交付包 / 发布记录（`.dsh/deliveries.json`、`releases`）。他们没有这些。
4. **不重造运行时**：我们明确把团队通信交给 Harness 原生 Agent Teams（`spawn_teammate` / `team_task_*`），插件只做状态机 + 闸门 + 产物。他们自建 Executor、SQLite、面板 6 tab——那是「一个独立产品」的体量（`src/` 约 170 个文件、测试 4 万+ 行），不是插件该有的成本。
5. **触发范围纪律**：对话内直接提的需求不启动流水线（工作区记忆里的约定），避免为普通问答背上整条交付链。

## 5. 借鉴决策表

| # | 借鉴点 | 决策 | 理由 |
|---|---|---|---|
| 1 | 授权落成数据（Mandate：scope/policyVersion/strength/rules） | **借鉴数据模型** | 解决「改提示词后旧结论还算不算数」的漂移；成本低 |
| 2 | 阶段能力宿主强制（不是提示词说说） | **借鉴原则并实现** | 我们的边界目前只写在提示词里，`AGENT_TEAM.md` §7 自己也承认「最终约束靠工具与你的评审」 |
| 3 | 结构化 Attention（待人工决定）实体 + 过期/驳回规则 | **借鉴** | 工作台已有「待你处理」区，增量是把「问题」变成有生命周期的一等记录 |
| 4 | 证据硬规则 + 证据过期刷新（before/after、缺证据不算 ready） | **借鉴并强化** | 与现有验收证据机制天然契合，成本低 |
| 5 | accept mode 三档（off/observe/auto） | **借鉴思路** | 我们的 `gateMode` 只有 normal/fast 二元，缺「先观察再自动」的灰度 |
| 6 | 每工作单元独立目录 + prepare 命令（git worktree） | **借鉴一半** | 解决共享文件系统写冲突；但由 Harness 会话/插件侧编排，不自建 Executor |
| 7 | 槽位 + 给人保留的额外槽 | **借鉴** | 团队上限已有，缺「Owner 干预不被自动任务挤掉」的保证 |
| 8 | 沟通经济学（静默工作、只报三种理由、一句结论、证据留文档） | **借鉴** | 直接降低 Owner 的 token 与注意力成本；可写成角色手册的一节 |
| 9 | 先落盘后执行 + 保序 + 连续 3 次失败才升级 | **借鉴** | 派发/投递的可靠性缺口 |
| 10 | 「Rejected concepts」表 + 文档一致性测试 | **借鉴** | 防概念膨胀；他们用 `tests/docs.spec.ts` 守住文档索引不漂移 |
| 11 | 派生式 stage（按「在等谁」首条命中） | **部分借鉴** | 保留显式准入迁移（人工闸门需要明确事件），但面板标签改成「在等谁、要什么」 |
| 12 | 自建 Executor / SQLite / 6 tab 面板 / Source 集成 | **不借鉴** | 与 Harness 原生会话、团队面板、本插件定位重复，成本远超收益 |
| 13 | admission 三格矩阵（列名×是否点名×接受范围） | **不借鉴** | 单 Owner 场景是过度设计；我们需要的是「阶段 × 谁能批」而不是「谁能提」 |
| 14 | 八段提示词拼装 + 全量可覆盖 | **暂不借鉴** | 我们阶段提示词短、角色手册集中；先做版本化与评测，覆盖体系等有第二用户再说 |

## 6. 落地清单（按优先级）

> **首批已完成（v1.2.105）**：T1 系统提示瘦身（2946 → 1012 字符，每请求省约 1.3k token）、T2 沟通纪律（进阶段提示，不进系统提示）、T3 证据闸门（testing 阶段 `pass` 无证据直接失败）、T4 规则版本戳（`mandate.version` + `stale`）、T5 文档守卫（`scripts/selftest/docs-spec.mjs` 接入 `npm test`）。契约见 [AGENT_TEAM.md](../AGENT_TEAM.md) §2 与 §8。
> **第二批已完成（v1.2.107）**：A 驳回 3 次升级 Owner（`STAGE_REJECT_LIMIT`）、B 停滞检测（`STALLED_STAGE_MS = 6h`，健康时零输出）、C UI 变更 before / after 证据（design / testing / acceptance 三关 + 质量锚点测试）。常驻 token 增量 0，全部为加法。
> **明确推迟**：阶段能力硬约束（P0-2）需要先定义写入白名单（acceptance 阶段仍要写 `docs/pipeline/acceptance-review.md`），否则会误伤复核报告；需求修订去重（D）与暂停开关（E）等确认痛点再做。

### P0（合计约 1.5–2 人日，建议下一版做）

| 项 | 做什么 | 落点 | 验收 |
|---|---|---|---|
| P0-1 阶段授权 Mandate 化 | 每个 stage 记录 `mandate: { policyVersion, scope, strength, matchedRules[], handbookVersion }`；`pipeline_submit_stage` 写入；改手册/需求后对未完成阶段做「重校验」提示 | `pipeline.js`（stage normalize + submit + `PIPELINE_VERSION` 兼容）、`client.js` 阶段详情折叠区 | 单测：旧 `pipeline.json` 升级补默认；改手册后 status 显示「规则已变，需复核」；提交记录含版本号 |
| P0-2 阶段能力硬约束 | acceptance/approval 阶段工具只读（禁 `write`/`edit`/`bash` 写操作）；release 才能 `preview_share`/发布；development 不能提交 acceptance | `agent-tools.js` 按 stage 过滤 + `pipeline.js` 内部校验（越权抛稳定错误码） | 负向探针：acceptance 阶段 `edit` 被拒；`pipeline_submit_stage` 跨阶段被拒；selftest 覆盖 |
| P0-3 结构化 Attention | agent 阻塞时写 `.dsh/attention.json`（问题、选项、发起人、过期、dismiss）；工作台「待你处理」优先列它；只能 Owner resolve/dismiss | 新增 `attention.js` + 面板卡 + 模型工具 `attention_ask/attention_list` | 至少一条 GUI 手测：agent 提问 → 出现在待你处理 → Owner 答/忽略 → 记录关闭 |
| P0-4 证据硬规则 | UI 变更必须 before/after 同场景截图（design 与 testing 阶段）；缺证据时 `pipeline_submit_stage` 给**阻断级**错误（不是 warning）；证据带 revision，改动后标记过期 | `pipeline.js` 证据校验、`pipelines/*.md` 检查项、`acceptance-review` 手册 | 缺 before 的 UI 提交被拒；过期证据在验收报告「证据缺口」小节列出 |

### P1（约 4–6 人日）

- **P1-1 accept mode 三档**：`gateMode: normal | observe | fast`；observe 下阶段提交只记「would approve」不入状态，面板可回看；先 observe 再 fast。
- **P1-2 派工隔离**：assignments 增 `branch/worktree`，Host 侧 `git worktree add` 到 `.dsh/worktrees/<task-id>`，完成后合并/丢弃；写冲突从「纪律」变「结构」。
- **P1-3 槽位与保留槽**：团队/队友上限之外 +1 个「Owner 干预槽」；排队状态在面板显示「在等谁」。
- **P1-4 沟通纪律**：角色手册加「对 Owner 说话」一节（静默工作、三种开口理由、一句结论、证据留 `docs/pipeline/*`）；`pipeline_submit_stage.summary` 约束为结论式（≤4000 已限，加「不写过程流水账」）。
- **P1-5 Git 合并纪律**：agent 不自批自合；release 阶段记录「由谁合并/发布」；review 按结果收敛；与人工作重复时让位并指回人的 PR。
- **P1-6 持久 outbox**：派发/投递先落盘再执行，递增退避，连续 3 次失败才进「问题」列表。

### P2（约 2–3 人日）

- **P2-1 文档纪律**：`docs/` 增加「Rejected concepts」小节与索引检查；`scripts/selftest/docs-spec.mjs` 校验「每个模型工具都有文档、术语表与实际工具一致」。
- **P2-2 派生标签**：面板阶段标签从状态码改为「在等谁 + 要什么」（如「等你审批 · 第 5 关验收复核」）。
- **P2-3 提示词版本化 + 回归评测**：`STAGE_HANDBOOKS` 带 revision 与改动记录；固定样本（需求/设计/测试各一组）跑评测，比较新旧手册的输出质量。
- **P2-4 设置变更记 origin**（panel/tool/sync）与历史快照，沿用现有原子写。

## 7. 明确不做（Rejected concepts）

| 不做 | 理由 |
|---|---|
| 自建 Executor / 每 Ticket 一个 DSH Session 的执行器 | 与 Harness 原生 Agent Teams、会话面板重复；我们是插件，不是运行时 |
| SQLite 状态库 + 迁移体系 | 现有 `.dsh/*.json` 原子写 + 按工作区隔离已够；引入 DB 会破坏「可读可 diff」的工作区约定 |
| inbound Source（GitHub/飞书监听） | 不是本插件的职责；用户在工作台下发需求即可 |
| 六 tab 面板重排 | 现有工作台 IA（待处理 / 项目状态 / 团队与指派 / 流程）已经回答「现在要我做什么」 |
| admission 三格矩阵 | 单 Owner 场景过度设计 |
| 把「何时可以合并」写进 Policy | 他们自己就把这类条件放在 agent 指令而非授权里（`002-authorization.md` §Policy version 末段） |

## 8. 一句话回答原问题

**设计思路同源（角色分工 + 宿主强制闸门 + 人的注意力最贵），但不是同一件事**：他们做的是「多人团队的准入授权 + 可恢复执行」，我们做的是「单 Owner 的交付流程 + 验收证据」。可以直接借鉴的是**授权数据化、阶段能力硬约束、结构化 Attention、证据硬规则、沟通经济学、执行可靠性**六件小事（P0 约 2 人日）；不该照搬的是**自建运行时与全量提示词覆盖体系**。

## 9. 来源（访问日期 2026-11-03）

- 仓库主页：<https://github.com/deepseek-ai/dsh-superagent-prototype>（README、MIT 许可证、`src/` 文件清单）
- `docs/000-philosophy.md`、`docs/001-domain.md`、`docs/002-authorization.md`、`docs/003-execution.md`、`docs/004-prompts.md`、`docs/005-panel.md`、`docs/007-architecture.md`、`docs/008-cookbook.md`
- `prompts/team/communication.md`、`prompts/team/delivery.md`、`prompts/team/scope.md`、`prompts/{orchestrator,worker,work,dispatch}.md`
- 本仓库对照：`docs/AGENT_TEAM.md`、`docs/PLAYBOOK.md`、`dsh-web-filebrowser-plugin/pipeline.js`（`PIPELINE_STAGES`、`PIPELINE_GATE_MODES`、`PIPELINE_MANUAL_GATE_STAGES`）
