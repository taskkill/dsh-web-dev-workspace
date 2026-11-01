# 群组议题式讨论 · 方案卡（项目经理 Agent 汇总）

> 输入：6 份角色意见（product-manager / ui-designer / fullstack-developer / qa-engineer / devops / project-manager-agent）＋ SESSION_GROUP.md §3、§5.4–5.5、§7、§15.6。本卡只汇总，不审批、不改需求；Owner 确认后才转任务卡执行。

## 1. 需求目标与边界

**目标**：群组内新增「议题→讨论→方案→Owner 确认→执行」。6 个角色会话围绕议题讨论，项目经理 Agent 汇总为方案卡，Owner 确认后自动拆成任务卡分派（D2/D3）。默认 1 轮发言，Owner 可手动追加 1 轮互评（D1）；按 OPC 团队一键建 6 个角色会话（D4）；确认前执行类投递被 Host/工具层硬闸门拒绝（D5）（产品①、设计①）。

**与七阶段流水线的边界**：议题流程是横向协作频道，不是第八阶段；方案卡的 approve 只开群内执行闸门，不等同流水线 approval；acceptance/approval 仍由 `pipeline_submit_stage` 与 Owner 面板决定，群组只读展示阶段状态（SESSION_GROUP §3）。

**不做（MVP）**：并行多模型对比（产品②反对）；跨工作区群组；成员自动链式互聊/自动开下一轮；Agent 审批或代 Owner 确认；群组改写验收项或流水线状态；自动推进流水线阶段（§15.6 权限边界）。

## 2. 数据与阶段状态机

**phase（唯一权威，6 态）**：`topic → discuss → plan → approve → execute → closed`。非法跳转拒绝（QA②）；打回 `approve → discuss`（轮次重置、保留历史）；closed 后 reopen 生成新轮次并重关闸门（QA③）。

**轮次**：讨论默认 1 轮；Owner 可追加 1 轮互评；第 3 轮拒绝（D1、QA②）。单议题唤醒 ≤8 会话、默认超时 10 分钟；自动通知仍受每群 10 分钟 3 次上限（§5.3、§15.6）。

**数据**（groups.json 保持 version:1、只增字段，由 normalize 补默认，读旧文件不迁移不报错——运维②；开发①原建议升 v2，按兼容优先取版本 1）：新增 `phase`、`topic{id,title,detail,rounds,state}`、`plan{id,version,summary,cards[],approvedBy,approvedAt,roundIds}`；消息增 `purpose: discussion|execution`（默认 discussion）；任务增 `planId`、`stageId`（只读展示）。`plan.cards` ≤20 条，防 5MB 上限（开发④）。

**硬闸门（P0）**：`handleRoute` 按 op 白名单校验 phase；`deliverTargets` 统一断言「execution ⇒ phase=execute」，覆盖 sendMessage/createTask/toolSend 三条路径；`groupTaskCreate`、`groupTaskUpdate(done)`、`group_handoff` 同 Gate 校验；`group_plan_confirm` 仅 Host 路由、不注册为成员工具，防自确认（开发②、QA④）。新增 op：`groupTopicSet / groupRoundOpen / groupPlanSubmit / groupPlanConfirm`（开发①）；成员工具保持 6 个，`group_send` 增 purpose（§15.6）。

## 3. UI 结构

- **阶段条**：吸顶于群组头下，四步「议题→讨论→方案→执行」，`aria-current="step"`；phase 与运行态（active/paused/archived）分开展示（设计①④）。
- **方案卡**：时间线尾部卡片，显示要点、任务分解数、产物；不另开页（设计①）。
- **确认/打回**：底部吸顶操作条；主按钮「确认并执行」二次确认并预览「将生成 N 张任务卡」；「打回」必填原因（设计①）。
- **角色成员标识**：成员面板显示角色徽标（产品/设计/开发/测试/项目经理/运维）＋状态点；一键建群生成的 6 会话带默认角色标签（D4、产品②）。
- **窄屏与规范**：<900px 单栏；360px 操作条全宽、按钮 ≥44×44；间距 4/8 倍数，正文 14/20；对比 ≥4.5:1，焦点环 2px+offset 2px（设计③）。轮询 3 秒，阶段变化用骨架屏/乐观更新（设计④）。

## 4. 任务分解（10 张，可直接转任务卡）

| # | 标题 / 负责角色 | 验收标准 |
|---|---|---|
| T1 | Host 数据模型与 normalize 兼容 / 开发 | 旧 groups.json 读取不报错、phase 默认 topic；新字段白名单化；写回 version 1；host-selftest 旧文件 fixture 通过。 |
| T2 | 议题与方案 op + 原子写 / 开发 | 4 个新 op 注册且 owner-only；非法 phase 跳转返回结构化错误；并发写不损坏文件。 |
| T3 | 执行类投递硬闸门 / 开发 | 未 approved 时 sendMessage(execution)/createTask/handoff 均返回 forbidden 且成员不被唤醒；approved 后放行；负向用例进 selftest。 |
| T4 | 成员工具与 purpose / 开发 | 工具身份校验、非成员调用被拒；group_send purpose 默认 discussion；group_plan_confirm 不在工具清单。 |
| T5 | 一键建 6 角色会话 / 开发 | 一次点击建 6 个带角色标签的成员；重复点击幂等不重复建群；SSH 工作区降级提示（运维①）。 |
| T6 | 阶段条 + 方案卡 + 确认/打回 UI / 设计+开发 | 6 态映射正确；确认有二次确认与任务数预览、打回必填原因；a11y/locale/窄屏 checklist 通过。 |
| T7 | 方案卡状态与打回语义 / 开发 | 确认/打回记录写群消息与任务历史（人/时间/摘要）；打回回 discuss 且保留历史、重关闸门。 |
| T8 | 确认后任务卡分解与分派 / 开发 | 解析方案卡生成任务卡，assignee 正确、可溯源 planId；delivered→review 流转正确；支持撤卡（产品②）。 |
| T9 | 自测扩展 / 测试 | groups-host/client-selftest 覆盖 phase 矩阵、闸门负向、超时/打回/D4；`npm test` exit 0。 |
| T10 | 版本、CHANGELOG 与回滚 / 运维 | root 1.2.101→1.2.102、plugin 1.2.91→1.2.92；CHANGELOG 注「Host 需重启」；groups.json/pipeline.json 备份与回滚步骤演练通过。 |

## 5. 风险与工作量

**分批**：P0（T1–T4，Host 状态机+闸门，约 3.5–4 人日，需重启 Harness）；P1（T5–T8，UI 与分派，约 3–3.5 人日，刷新页面即可）；P2（T9–T10，自测/发布，约 1.5–2 人日）；合计 8–9.5 人日（口径：产品③ 8–9、开发④ 2.5、QA 1.5）。

**风险**：闸门多点易漏（开发④）→ 单 Gate + 负向测试；client.js 1.5MB 回归面大 → 保留双模式回退；groups.json 并发写/损坏（运维④）→ 原子写+发布前备份；重启窗口版本不一致（运维④）→ 发布说明+回滚包；误确认即执行（设计④）→ 二次确认+任务数预览+可撤销；讨论失控成本（产品②/运维③）→ 轮次/唤醒/超时上限。

## 6. 待 Owner 确认项

1. 是否以 `topic/discuss/plan/approve/execute/closed` 六态为唯一权威命名（UI 仍显示四步条）？
2. groups.json 采用「保持 version:1、只增字段」的兼容方案，还是接受升 v2 迁移？
3. 未 approved 时执行类投递被拒，除 forbidden + 群内系统消息外，是否还需顶部提示/通知？
4. 确认后自动分派的任务卡，是否给予短暂撤销窗口（如 10 分钟）？
5. 上线节奏：P0 先发（需重启 Harness）再补 P1，还是整体完成一次性发布？
