# 群组议题讨论 · QA 意见

① 可测试验收点
1. phase 顺序流转，非法跳转被拒。
2. 默认 1 轮发言；Owner 可追加 1 轮互评，第 3 轮拒。
3. 方案卡仅项目经理 Agent 生成，任务分解可解析。
4. 负向：方案未批准时执行类投递（handoff/建卡）必拒 forbidden，成员不被唤醒。
5. D4 一键建 6 角色会话，幂等。
6. 确认后分派 assignee 正确，delivered→review。

② 矩阵（phase×动作×期望）
|phase|动作|期望|
|---|---|---|
|issue|发议题|进 discuss|
|discuss|成员发言|记录不唤醒|
|discuss|追加互评|仅第 2 轮生效|
|discuss|提前 handoff|拒 forbidden|
|proposal|PM 出方案|进 review|
|review|Owner 批准|进 confirmed 开闸|
|confirmed|handoff|分派成功|
|executing|重复批准/回退|幂等或拒|

③ 失败路径
超时：delivery 置 failed，Owner 可打回；成员失败：单成员异常不阻塞，记 error 可重投；打回：回 discuss，留历史、轮次重置；重开：reopen 后新轮次、闸门重关。

④ 自动化落点
groups-host-selftest.mjs：状态机、闸门负向、超时/打回、D4；groups-client-selftest.mjs：phase 渲染、按钮禁用、locale 键；npm test 串跑三脚本 exit 0 为门禁。
