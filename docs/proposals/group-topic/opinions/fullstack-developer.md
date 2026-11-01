# 全栈开发意见：群组议题式讨论

**① 数据模型与 API**：在 `normalizeGroup` 增 `phase`（`discuss|consensus|confirm|execute|done`，默认 discuss）、`topic{id,title,detail,rounds,state}`、`plan{id,version,cards[],summary}`；`normalizeGroupsDocument` 版本升 2。新增 op 并同步 `GROUP_ROUTE_OPS`：`groupTopicSet`、`groupRoundOpen`、`groupPlanSubmit`、`groupPlanConfirm`，均走 `mutate` 原子写；Host 侧 `index.js` 按 `GROUP_ROUTE_OPS` 透传。工具清单同步增 `group_topic_set`、`group_plan_submit`（成员上报）、`group_plan_confirm`（仅 Owner）；`group_send` 增 `purpose` 参数。

**② 硬闸门位置**：`handleRoute` 是唯一 choke point，先按 op 白名单校验 `phase`。`sendMessage` 增 `purpose`（`discussion|execution`，默认 discussion，在 `normalizeMessage` 白名单化）；真正投递在 `deliverTargets`，此处再断言「execution ⇒ phase=execute」，一处覆盖 `sendMessage`/`createTask`/`toolSend` 三条路径；`groupTaskCreate`、`groupTaskUpdate(done)`、`group_handoff` 在同一 Gate 内校验；`group_plan_confirm` 只在 Host 路由暴露、不注册为工具（防成员自确认）。

**③ 旧 groups.json 兼容**：缺失字段由 normalize 补默认（phase=discuss、topic=null），只在写回时升 version，读旧文件不迁移、不报错；保留 client.js 的 `bad-op → read` 旧路回退，旧 Host 仍可用。

**④ 工作量与风险**：约 2.5 人日（groups.js 0.5 / Host 路由 0.3 / 工具 0.3 / client 1 / selftest 0.4）。风险：client.js 1.5MB 回归面大；`mutate` 全量重写且 5MB 上限，`plan.cards` 须限长（≤20）；闸门多点易漏一处即绕过；selftest 需补 phase 分支与旧文件 fixture。
