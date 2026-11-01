# 议题流程 · 实现契约 v1（Host ↔ Client 冻结版）

> 依据：[plan.md](plan.md)（项目经理 Agent 汇总，Owner 已确认 P0+P1 / 5 条默认口径 / 按任务卡分派）。
> 本文是 Host（`dsh-web-filebrowser-plugin/groups.js`）与 Client（`dsh-web-filebrowser-plugin/client.js`）之间的**唯一约定**；实现不符即视为缺陷。
> 所有状态落 `.dsh/groups.json`，`version` 保持 `1`，**只增字段不改语义**，旧文件由 normalize 补默认。

## 1. 数据模型（只增字段）

```jsonc
{
  "phase": "topic",                  // topic | discuss | plan | approve | execute | closed（默认 topic）
  "topic": null,                     // 无议题 = 旧行为（不启用闸门）
  // 议题存在时：
  // { "id": "tpc_xxxx", "title": "…", "detail": "…", "createdAt": 0,
  //   "roundCount": 1, "maxRounds": 2 }
  "plan": null,
  // { "id": "pln_xxxx", "version": 1, "summary": "…",
  //   "sections": [{ "heading": "…", "body": "…" }],       // ≤ 12 节
  //   "cards": [{ "id": "crd_xxxx", "title": "…", "detail": "…",
  //              "acceptance": ["…"], "role": "fullstack-developer",
  //              "assigneeSessionId": "ses_…" | null }],    // ≤ 20 张（5MB 上限护栏）
  //   "status": "draft" | "pending" | "approved" | "rejected",
  //   "approvedAt": 0, "approvedBy": "owner", "rejectedAt": 0, "rejectNote": "…" }
  "rounds": [],                      // [{ "id": "rnd_…", "at": 0, "targets": ["ses_…"], "state": "open"|"closed" }]（≤ 20）
  "log": []                          // [{ "at": 0, "action": "topic|round|plan|approve|reject|execute|close|reopen",
                                     //    "by": "owner|member|host", "sessionId": null, "note": "" }]（≤ 50）
}
```

- **消息**：`message.purpose` = `"discussion" | "execution"`（默认 `"discussion"`）；可选 `message.planId`。
- **任务**：`task.planId`、`task.cardId` 可选（用于溯源 T8）。
- **闸门判定**：`gateBlocked = group.topic !== null && group.phase !== "execute"`。无议题时不拦截（保持旧行为）。

## 2. 阶段状态机

| 当前 phase | 动作 | 下一 phase | 说明 |
|---|---|---|---|
| topic | `groupTopicSet`（Owner 填议题） | discuss | 建 topic（roundCount=1），写 round + log；随后 Owner 用 `groupSend`（purpose=discussion）广播本轮议题 |
| discuss | `groupRoundOpen`（Owner 追加 1 轮互评） | discuss | `roundCount < maxRounds` 才允许；第 3 轮返回 `bad-phase` |
| discuss | `groupPlanSubmit`（成员/主持人写方案） | plan 或 approve | 首次 submit：status=draft，phase=plan；`groupPlanSubmit` 带 `submit:true` 时 status=pending、phase=approve |
| approve | `groupPlanConfirm`（Owner 确认） | execute | status=approved，写 log；**同一事务内**把 plan.cards 转任务卡并按 assignee 投递（execution 类，闸门此时已开） |
| approve | `groupPlanReject`（Owner 打回，必填 note） | discuss | status=rejected，rejectNote 落库，轮次重置为可追加（roundCount 保留、可再开 1 轮） |
| execute | `groupFlowClose`（Owner 关闭） | closed | 只读存档；`groupFlowReopen` → topic（清空 topic/plan，log 记 reopen） |
| 任意 | 非法跳转 | — | `bad-phase` 错误，不写盘 |

**硬闸门（P0 核心）**：`deliverTargets` 是唯一投递出口。`purpose === "execution"` 且 `gateBlocked` → 抛 `GroupError("gate-blocked", "方案未确认，执行类投递被拒绝")`，**不写 delivery、不唤醒成员**。覆盖 `sendMessage(purpose=execution)` / `createTask` / `group_handoff` / 确认后自动投递四条路径。`purpose` 默认 `discussion`，讨论投递永不拦截。

## 3. 路由 op（owner-only，加入 `GROUP_ROUTE_OPS`）

| op | 入参 | 返回 | 说明 |
|---|---|---|---|
| `groupTopicSet` | `{root, groupId, title, detail?, maxRounds?}` | `{groupId, topic, phase}` | 有活动议题时 `bad-phase` |
| `groupRoundOpen` | `{root, groupId}` | `{groupId, round, roundCount}` | 仅 discuss；第 3 轮拒绝 |
| `groupPlanSubmit` | `{root, groupId, plan:{summary, sections[], cards[]}, submit?}` | `{groupId, plan, phase}` | cards ≤20、sections ≤12；`submit:true` 进 approve |
| `groupPlanConfirm` | `{root, groupId, note?}` | `{groupId, phase, tasks:[{taskId, cardId, assigneeSessionId}], deliveries}` | 仅 approve；approve + 生成任务卡 + 投递 |
| `groupPlanReject` | `{root, groupId, note}`（必填） | `{groupId, phase}` | 仅 approve；回 discuss |
| `groupFlowClose` | `{root, groupId}` | `{groupId, phase}` | execute → closed |
| `groupFlowReopen` | `{root, groupId}` | `{groupId, phase}` | closed → topic，清 topic/plan |

`groupGet` 返回的文档已含 `phase/topic/plan/rounds/log`，客户端无需新读接口。

## 4. 成员工具（新增 3 个，保持能力受限）

- `group_topic_read`：读当前议题/phase/轮次/可执行动作（无副作用）。
- `group_plan_read`：读方案卡（summary/sections/cards/status）。
- `group_plan_write`：成员提交方案（等价 `groupPlanSubmit`，但**只能写 draft/pending，不能 confirm/reject/execute**，且必须是自己所在群）。
- `group_send` 增加 `purpose`（`discussion` 默认 / `execution`）；`execution` 走同一硬闸门。
- **确认/打回/关闭/重开/建群/加成员/删除群组：不注册为工具**（仅 Host 路由 + Owner 面板）。

## 5. Client 实现清单（P1）

1. `normalizeGroupsDoc` 补 `flow` 默认值（phase/topic/plan/rounds/log），Host 模式与客户端模式共用。
2. 群组页（`renderGroupsPage`，约 client.js:20385）：
   - 头部阶段条四步「议题 → 讨论 → 方案 → 执行」，映射六态：topic→①、discuss→②、plan/approve→③、execute/closed→④；`aria-current="step"`，未解锁步骤不可点。
   - 时间线尾部方案卡：summary + 节 + 任务卡计数 + status；approve 态展开「确认并执行 / 打回」。
   - 底部吸顶操作条（composer 上方）：主按钮「确认并执行」二次确认并提示「将生成 N 张任务卡」；打回弹输入必填原因；确认后 10 分钟撤销窗口提示。
   - 议题入口：无议题时显示「发起议题」（标题 + 说明）；有议题显示标题 + 轮次 `n/maxRounds` + 「追加一轮互评」（仅 discuss 且未达上限）。
   - 确认/打回/关闭/重开按钮仅 Host 模式可写；客户端模式（旧 Host）隐藏并提示需重启 Harness。
3. i18n：`zh` 与 `en` 同时补齐 `groups.flow.*` 全键（术语：议题 Topic / 讨论 Discussion / 方案 Plan / 确认执行 Approve & execute / 打回 Reject / 已关闭 Closed），不出现未翻译键。
4. 失败提示：`gate-blocked` → 「方案未确认，执行类操作已被拒绝」；`bad-phase` → 「当前阶段不允许该操作」。
5. a11y/窄屏：按钮 ≥44×44、焦点环 2px、<900px 单栏、阶段条不横向溢出。

## 6. 错误码（稳定，客户端按码提示）

`bad-phase` ｜ `gate-blocked` ｜ `plan-invalid` ｜ `not-member` ｜ `topic-exists` ｜ `round-limit` ｜ `flow-unsupported`（旧 Host 无此能力时客户端降级提示重启 Harness）。

## 7. 验收（QA 断言清单）

1. 无议题时旧行为不变（发消息/建任务/交接照常）。
2. 有议题且 phase≠execute：`createTask`、`group_handoff`、`groupSend(purpose=execution)` 全部 `gate-blocked`，成员不被唤醒，文件无新 delivery。
3. 讨论投递（purpose=discussion）不被拦截；`roundCount=2` 时第 3 轮 `round-limit`。
4. 非法跳转（discuss 直接 confirm 等）→ `bad-phase`，文档不变。
5. `groupPlanConfirm` 后：phase=execute、plan.status=approved、log 有 approve、任务卡数量 = plan.cards 数量且 `task.planId` 可溯源。
6. 打回：note 必填、phase 回 discuss、rejectNote 落库、再次 confirm 需重新 submit+approve。
7. 旧 `groups.json`（无 flow 字段）读取不报错、写回后 version 仍为 1。
8. `npm test` 三脚本全绿。
