# 发布说明 · 群组议题流程（v1.2.102）

> 状态：发布准备完成（本地记录），未对外发包、未打 tag。依据：`plan.md` T10、`contract.md`、`qa-report.md`。

## 范围

- Host `dsh-web-filebrowser-plugin/groups.js`：6 态状态机 + 7 个 owner-only op + 硬闸门 `gate-blocked`（4 条执行类投递路径）+ 3 个成员工具。
- Client `dsh-web-filebrowser-plugin/client.js`：四步阶段条、方案卡、确认/打回操作条、`groups.flow.*` zh+en i18n、旧 Host 降级提示。
- 数据：`groups.json` 保持 `version: 1`，只增字段、旧文件免迁移。

## 版本

- root `1.2.101 → 1.2.102`（工作区约定：每次改动 +1）。
- plugin `1.2.91 → 1.2.92`（plugin 版本只在插件代码变化时 +1；本次 Host 与 client 均改，故同步 bump；root 与 plugin 并行递增，读版本时 root 优先）。
- 生效方式：**Host 半须重启一次 Harness**；客户端改动刷新页面即可。

## 发布前备份

```bash
mkdir -p .dsh/backups && cp .dsh/groups.json ".dsh/backups/groups.json.$(date +%Y%m%d-%H%M)" && { [ -f .dsh/pipeline.json ] && cp .dsh/pipeline.json ".dsh/backups/pipeline.json.$(date +%Y%m%d-%H%M)" || true; }
```

现网 `.dsh/groups.json` 存在（`{"version":1,"groups":[]}`）；`.dsh/pipeline.json` 当前不存在，命令已用 `[ -f ]` 容错，创建后同法备份。

## 回滚

1. 还原上一版本包（root/plugin 回到 `1.2.101` / `1.2.91`，或上一 commit `f61afde`），重启 Harness。
2. 恢复备份：`cp .dsh/backups/groups.json.<时间戳> .dsh/groups.json`（若有 pipeline 备份同法恢复）。
3. 刷新页面，确认群组页回到旧交互、无阶段条。
4. `groups.json` 只增字段，旧 Host 可直接读新文件，**无需逆向迁移**；生产回滚须经项目经理确认后再执行。

## 已知限制

- 未重启 Harness 的旧 Host：新 UI 降级为「议题流程需重启 Harness 后生效」，不能发起议题。
- 跨工作区群组不支持；群组状态按工作区独立（`.dsh/groups.json`）。
- 页面每 3s 轮询同步，非实时推送；SSH 远程工作区整页降级为说明文案，自动任务卡分派须在本地工作区。
- 撤销窗口 10 分钟；一键选团队已限定为 OPC 6 角色（BUG-02 已修复，`GROUP_TEAM_ROLES = 6`）。
- a11y / <900px 窄屏仅静态断言，发布后建议人工冒烟。
