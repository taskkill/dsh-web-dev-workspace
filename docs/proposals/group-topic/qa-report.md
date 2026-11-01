# QA 验证报告：群组议题流程（T9）

- 环境：dsh-web-filebrowser @ f61afde ｜ Node v24.22.2 ｜ 2026-11-01 ｜ 契约 docs/proposals/group-topic/contract.md
- 命令：`npm run check` exit 0；`npm test` exit 0（39/39 host smoke + client 82 断言 + host-group 全 PASS，复跑一致）；`node scripts/selftest/groups-client-selftest.mjs` exit 0（新增 43 条）；`node scripts/selftest/groups-host-selftest.mjs` exit 0（含 flow 断言 33 条）

## §7 逐条结论

| # | 验收项 | 结论 | 证据 |
|---|---|---|---|
| 1 | 无议题旧行为不变 | pass | host：`flow: task creation without a topic keeps legacy behaviour` |
| 2 | 未批准时四类执行投递 gate-blocked、不写 delivery、不唤醒 | pass | host 四条 flow 断言；独立探针：4 路径均 `gate-blocked`，messages/tasks 不变、deliveries 0、唤醒 0 |
| 3 | 讨论不拦截；第 3 轮 round-limit | pass | `flow: discussion delivery is allowed during discuss`、`third round rejected with round-limit` |
| 4 | 非法跳转 bad-phase、文档不变 | pass | host 断言；探针：discuss 直接 confirm → `bad-phase`，groups.json sha256 前后一致 |
| 5 | confirm 后 execute/approved/log/任务=卡片且 planId 溯源 | pass | `confirm approves and enters execute`、`confirm creates one task per card`、`plan tasks trace back to the plan` |
| 6 | 打回：note 必填、回 discuss、rejectNote、重提版本递增 | pass | `reject requires a note`、`reject returns to discuss`、`resubmitted plan bumps the version` |
| 7 | 旧文件补默认 flow、version 仍 1 | pass | `legacy document reads with default flow fields`、`keeps version 1` |
| 8 | `npm test` 三脚本全绿 | pass | `PASS: 39/39 host smoke checks`、`PASS: session-group client selftest`、`PASS: session-group host selftest`，exit 0 |

## 缺陷与严重度

- BUG-01（P1，已修复并复测）：验证初期 `host-smoke.mjs` 硬编码 42 个工具，task-8 新增 `group_topic_read/group_plan_read/group_plan_write` 后实际 45，导致 `npm test` 红。修复期间由 Lead 将期望更新为 45；我复测 `npm test` exit 0，两次一致。
- BUG-02（P3，观察未修）：`pickGroupsTeam()` 用 `GROUP_MAX_MEMBERS`=8 截断，候选 >6 时会选 8 个而非 OPC 6 角色；不影响契约 §7。

## 新增 Client 断言（不弱化旧断言）

- 六态→四步映射（`groupPhaseStep` 0/1/2/2/3/3，未知回 0）；plan 状态/节≤12/卡≤20/验收≤10、roundCount 不出现 3/2；purpose 默认 discussion、task 的 planId/cardId 溯源。
- 静态接线：阶段条 `data-state`/`aria-current`/locked、方案卡、确认/打回、action bar、7 个 flow op、错误码文案、client 模式降级；i18n `groups.flow.*` zh+en 各 80 键成对、无未翻译、引用键全覆盖。

## 遗留风险

- Client 侧为纯函数+静态断言，未跑真实 DOM：a11y（44×44、焦点环）、<900px 单栏未验证，建议人工冒烟。
- BUG-02 为交互口径偏差（P3），建议后续把一键选团队限定为 OPC 6 角色；不影响闸门与放行。
