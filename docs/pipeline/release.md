# 发布说明：工作台完成态与细节修正（v1.2.80）

- 阶段：release（第 8 轮，运维 `opc-ops`）
- 环境：**local workspace / 自托管插件**（本工作区即发布产物；无公网 URL、无服务器上传、无数据迁移）
- 本地访问入口：Dev Workspace GUI `http://127.0.0.1:3080`（本机回环，仅供本机验收）
- 版本：`v1.2.80`（插件与根 `package.json` 均 1.2.80；`CHANGELOG.md` 顶部 `## 1.2.80 — 2026-10-27`）
- 发布基线：git HEAD `2ada4a4`（v1.2.79 交付后根版本 chore；上一发布 commit `50cbc34` = v1.2.79）；本轮改动为工作区未提交修改 + 3 个 v1.2.79 归档文档，**Git 提交由 Lead 执行**，实际 commit 以 `pipeline_record_release` 为准
- 发布时间 / 发布人：2026-10-27 16:51（Asia/Shanghai，`2026-10-27T08:51Z`） / 运维 agent `opc-ops`
- 前置闸门（已满足）：
  - `acceptance` = **approved**，`reviewedAt = 2026-10-27T08:40:20.584Z`，报告 `docs/pipeline/acceptance-review.md`（第 8 轮）：**建议放行（附条件）、阻断 0**；
  - `approval` = **approved**，`reviewedAt = 2026-10-27T08:50:21.840Z`，`reviews[0] = {decision:'approve', actor:'owner'}` —— **Owner 面板人工确认，模型未审批**；
  - `release` = **active**，`startedAt = 2026-10-27T08:50:22.250Z`；`gateMode=fast`、`round=8`、`roundScope=development`（product/design 按变更范围跳过）。

> 验收状态如实记录：清单 **28 条 = 13 pass / 0 fail / 15 blocked**（本轮 8 条 = 7 pass / 1 blocked，唯一 blocked 为实机视觉复测；历史 14 条为 v1.2.79 及以前 GUI/视口项）。**Owner 按 `docs/ACCEPTANCE.md` 批次 17 复测回填前，不得视为实机视觉已验收通过**；模型未伪造 pass。

## 1. 发布内容（Owner 实机截图反馈的 10 项修正）

- `client.js` **+120/−55**（纯客户端 CSS/JSX/i18n）：
  1) **团队与指派**：项目网格内 6 个角色 chips 改 **2 列**（≤700 仍 2 列），chip 内边距/字号/status pill 微调，名称与状态完整，不再只剩 1 个字。
  2) **完成态 hero**：eyebrow「全部 7 关已完成」、标题「本轮交付完成」、隐藏重复状态 pill、侧栏「第 N 轮 · 全部通过」、门禁「全部阶段已完成 · 可发布或发起新轮变更」并隐藏复核链接；完成态 meta 去重。
  3) **需求摘要**：去掉「背景/目标/范围…」前缀；最新变更标题与需求标题同轮相同时隐藏重复 changeLine。
  4) **验收计数**：blocked 独立成「阻塞 N」pill，待验收只计 pending，零值 pill 不渲染；无交付包/预览分享时不渲染空「交付物」小节。
  5) **完成态体检**：verdict 改「提示 N 项」+ 中性色；任务记录/预览分享/交付包缺失降级 N/A（暂无记录/未分享/未打包），「最近测试」改「最近任务」。
  6) **变更卡**：提交后隐藏「已审 0/0」，显示「本轮变更已提交，无未提交改动。」。
  7) **运行中**：统计顺序改 运行中 / 最近一次（宽列）/ 最近结果 / 上次失败。
  8) **进度条**：使用 `--dsw-alias-state-business-primary` 强调色（原 brand 在本主题为墨黑）。
  9) **Now 区**：完成态 hint 改「全部完成 · 暂无待处理」，去掉重复空态行。
  10) **项目状态卡**：完成态隐藏重复状态 pill、caption「全部通过」、行「第 N 轮 · 全部阶段已完成」。
- **i18n**：新增 12 键 zh/en 成对、删除 1 个死键（`hero.remainingDone`）。
- **文档/版本**：CHANGELOG 1.2.80、ACCEPTANCE **批次 17**、design.md **§13** 修正表、test-report/acceptance-review 本轮同步；v1.2.79 的 test-report/acceptance-review/release 归档至 `docs/pipeline/archive/`。
- **范围边界**：无 Host 改动、无新增依赖/字体/图标/CDN、无数据迁移；保留 v1.2.79 全部结构/功能/handler。

## 2. 发布前自测 gate（2026-10-27 16:50 CST）

| # | 命令 | 退出码 | 耗时 | 结果 |
|---|---|---|---|---|
| 1 | `npm run check` | **0** | 571 ms | 21 个模块通过（含 client.js） |
| 2 | `npm run check:json` | **0** | 116 ms | JSON OK |
| 3 | `npm test` | **0** | 628 ms | PASS: 31/31 |
| 4 | `node .dsh/tmp/team/pipeline-selftest.mjs` | **0** | 672 ms | 38/38 |
| 5 | `node .dsh/tmp/team/review-selftest.mjs` | **0** | 802 ms | 22/22 |
| 6 | `node .dsh/tmp/team/assignments-selftest.mjs` | **0** | 162 ms | 27/27 |
| 7 | `node .dsh/tmp/qa-static-v1280.mjs` | **0** | 144 ms | STATIC PASS（143 断言） |
| 8 | `git diff --check` | **0** | — | 干净 |

- 证据日志：`.dsh/evidence/acceptance-retest-v1.2.80.log`；**无安装/构建步骤**（纯 JS 插件），无锁文件改动。

## 3. 产物清单与校验

- **Git 现状**（本报告前）：**6 个已跟踪修改 + 3 个未跟踪归档**；`git diff --numstat` = **+274 / −161**；本报告加入后 7 个已跟踪修改。
  - `client.js` +120/−55；插件 `package.json` 1/1（1.2.79→1.2.80）；`CHANGELOG.md` +29；`docs/ACCEPTANCE.md` +20/−2；`docs/pipeline/design.md` +21；`docs/pipeline/test-report.md` +83/−103；`docs/pipeline/acceptance-review.md` +96/−124（本轮重写）。
  - 未跟踪：`docs/pipeline/archive/v1.2.79-{test-report,acceptance-review,release}.md`（3 文档，链接已重算）。
- **依赖/边界**：根 `dependencies` = `{"ssh2":"^1.17.0"}`；插件 `dependencies` = `{"@xterm/addon-fit":"^0.10.0","@xterm/xterm":"^5.5.0","ssh2":"^1.17.0"}`；与 HEAD 一致；无 Host 模块/模型工具/路由改动；无数据文件改动。
- **关键文件 SHA256（发布前）**：

```text
221d6423a03dee0a0c41ca819448988dd8ac625fea20580d168f4260078618f3  dsh-web-filebrowser-plugin/client.js
8ee01c75fe756e7a8ee25a95b63ac682692d13e1dfd98d653eba49939954625b  dsh-web-filebrowser-plugin/package.json
0fdc51bbc408c3faa15fee477a53fe5d0b8ffd479e2d9d0e3eaf2f39ee3438d0  package.json
f85185872939cd4c252056654fd0150aa0ad483fc7eaec4dd1df1232b7156f8f  CHANGELOG.md
5623ba1aa6481972303748968ba1f8ea04e6268de325cc9221b433edd020a994  docs/ACCEPTANCE.md
7f90f7fb721a2031c558bd9c5c9b1f87c01bdd02b5cb9c0784ec84360d6637fa  docs/pipeline/test-report.md
b8cc60d6b8d7aa439a6064983717204ce9a3d2b4398cb11427fd796898dbcb42  docs/pipeline/acceptance-review.md
c8222791b86ba1f8b65bf5871891afe995a12ef94e8a8fdf585584f08e7330b0  docs/pipeline/design.md
```

## 4. 生效方式与发布后 smoke

- **生效**：重启 Harness（或按现有方式重建客户端 bundle）→ 浏览器强刷 → 打开工作台；纯客户端，无数据迁移。
- **发布后 smoke**：
  1. `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3080/` → 期望 200。
  2. `node .dsh/tmp/qa-static-v1280.mjs` → STATIC PASS（143 断言）。
  3. Owner 按 `docs/ACCEPTANCE.md` **批次 17** 复测 10 项并回填 `1c1b66989d`。
  4. 未重启/未重建 bundle 时 GUI 仍显示旧客户端，属预期。
- **发布记录**：`.dsh/pipeline.json` releases（`pipeline_record_release`）。

## 5. 回滚

- `git revert <本次 commit>` 或 `git reset --hard 2ada4a4`（回滚前备份 `.dsh/pipeline.json`）；重启 Harness + 重建 bundle + 强刷。
- 无数据迁移；回滚仅影响工作台 UI 文案/空态/CSS；不影响 Host/编辑器/终端/Git/流水线。

## 6. 风险与限制（非阻断）

- 唯一 blocked：实机视觉复测（模型无浏览器）；Owner 批次 17。
- 历史 14 条 blocked 仍在清单（v1.2.79 及以前 GUI/视口项），可按 Owner 决定复测/更新/作废。
- 完成态 Now 区仍保留区头（只改 hint/空态）；若需整区隐藏可再调。
- 第 5 张运行中卡全宽沿用 v1.2.79 设计；一行 CSS 可回退。
- 面板 review marks 0/6；PM 已人工审阅 diff，Owner 可补标。

## 7. 发布历史（最近 3 条）

| 版本 | 环境 / URL | commit | 说明 |
|---|---|---|---|
| **v1.2.80（本次）** | local-workspace · http://127.0.0.1:3080 | 见 `pipeline_record_release` | 完成态/团队卡/交付卡 10 项修正；批次 17 |
| v1.2.79 | local-workspace · http://127.0.0.1:3080 | `50cbc34` | 工作台 UI 全面重构（指挥舱） |
| v1.2.78 | local-workspace · http://127.0.0.1:3080 | `a2797dc` | 交付区取消折叠（5 卡直接展示） |

## 8. 备注

- 交付后根 `package.json` +1 至 **1.2.81**（chore commit），插件保持 **1.2.80**。
- 下一步：Owner 批次 17 实机复测 → 回填 blocked 项 → v1.2.80 验收闭环。
