# 运维意见 · 群组议题式讨论

① 上线影响：议题状态机与 D5 硬闸门在 Host 半，须重启 Harness；客户端插件改动刷新页面即可。SSH 远程工作区不支持流水线/交付，自动分派须回本地工作区。

② 版本与回滚：root 1.2.101→1.2.102、plugin 1.2.91→1.2.92；CHANGELOG 记 Symptom/Fix/Verification 并注「Host 需重启」。groups.json 保持 version:1，只增字段不改语义，旧版忽略新字段免迁移；发布前备份 groups.json 与 pipeline.json，回滚＝旧包＋备份。

③ 可观测性：记录轮次（默认 1 轮＋手动 1 轮互评）、唤醒次数（3 次/10min 限流）、分派失败率与闸门拒绝数、单议题成本上限。

④ 风险：闸门被绕过；重启窗口客户端/Host 版本不一致；groups.json 并发写损坏；讨论失控致成本超支。
