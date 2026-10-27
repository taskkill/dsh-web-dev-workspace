# 发布说明：工作台布局修正（v1.2.81）

- 阶段：release（第 9 轮，运维 `opc-ops`）
- 环境：**local workspace / 自托管插件**（无公网 URL、无服务器上传、无数据迁移）
- 本地访问入口：Dev Workspace GUI `http://127.0.0.1:3080`（本机回环，仅供本机验收）
- 版本：`v1.2.81`（插件与根 `package.json` 均 1.2.81；`CHANGELOG.md` 顶部 `## 1.2.81 — 2026-10-27`）
- 发布基线：git HEAD `1105b83`（v1.2.80 交付后根版本 chore；上一发布 commit `f976c4e` = v1.2.80）；本轮改动为工作区未提交修改 + 3 个 v1.2.80 归档文档，Git 提交由 Lead 执行，实际 commit 以 `pipeline_record_release` 为准
- 发布时间 / 发布人：2026-10-27 17:01（Asia/Shanghai，`2026-10-27T09:01Z`） / 运维 agent `opc-ops`
- 前置闸门（已满足）：
  - `acceptance` = **approved**，`reviewedAt = 2026-10-27T08:59:15.857Z`，报告 `docs/pipeline/acceptance-review.md`（第 9 轮）：**建议放行（附条件）、阻断 0**；
  - `approval` = **approved**，`reviewedAt = 2026-10-27T09:00:10.289Z`，`reviews[0] = {decision:'approve', actor:'owner'}` —— **Owner 面板人工确认，模型未审批**；
  - `release` = **active**；`gateMode=fast`、`round=9`、`roundScope=development`（product/design 按变更范围跳过）。

> 验收状态如实记录：清单 **33 条 = 17 pass / 0 fail / 16 blocked**（本轮 5 条 = 4 pass / 1 blocked，唯一 blocked 为实机布局/视觉；历史 15 条为 v1.2.79/80 及以前 GUI/视口项）。**Owner 按 `docs/ACCEPTANCE.md` 批次 18 复测回填前，不得视为实机布局已验收通过**；模型未伪造 pass。

## 1. 发布内容（Owner 三张截图反馈的布局修正）

- `client.js` **+5/−2**（纯 CSS，纯客户端）：
  1) **hero/Now 全宽**：`.ds-wb-page-inner` 显式 `align-items: stretch`（此前从旧 grid 规则继承 `align-items: start`，改 flex 后子项按内容宽度收缩，hero 只占约 712px）；`.ds-wb-zone { width:100%; min-width:0 }`。
  2) **项目区 2 列 + 需求整行**：`@media (min-width:768px)` 网格 2 列、`.ds-wb-project-cell-wide { grid-column:1/-1 }`；3 列只在 `@media (min-width:1600px)`；≤700 单列。团队 chips 与需求摘要不再挤在 3×350。
  3) **交付区 4 宫格**：`.ds-wb-delivery-grid > .ds-wb-design { grid-column:1/-1 }`（设计稿整行）；`:last-child { grid-column:auto }`（运行中恢复普通单元格）；验收/体检/变更/运行中 2×2，无空块、无全宽长条；≤1023 单列。
- **文档/版本**：CHANGELOG 1.2.81、ACCEPTANCE **批次 18**、design.md **§14**；v1.2.80 的 test-report/acceptance-review/release 归档至 `docs/pipeline/archive/`。
- **范围边界**：无 Host 改动、无新增依赖/字体/图标/CDN、无数据迁移；保留全部结构/功能/handler。

## 2. 发布前自测 gate（2026-10-27 17:00 CST）

| # | 命令 | 退出码 | 耗时 | 结果 |
|---|---|---|---|---|
| 1 | `npm run check` | 0 | 557 ms | 21 个模块通过 |
| 2 | `npm run check:json` | 0 | 107 ms | JSON OK |
| 3 | `npm test` | 0 | 627 ms | 31/31 |
| 4 | `node .dsh/tmp/team/pipeline-selftest.mjs` | 0 | 644 ms | 38/38 |
| 5 | `node .dsh/tmp/team/review-selftest.mjs` | 0 | 781 ms | 22/22 |
| 6 | `node .dsh/tmp/team/assignments-selftest.mjs` | 0 | 181 ms | 27/27 |
| 7 | `node .dsh/tmp/qa-static-v1281.mjs` | 0 | 140 ms | STATIC PASS（152 断言） |
| 8 | `git diff --check` | 0 | — | 干净 |

- 证据日志：`.dsh/evidence/acceptance-retest-v1.2.81.log`；无安装/构建步骤（纯 JS 插件），无锁文件改动。

## 3. 产物清单与校验

- **Git 现状（本报告前）**：6 个已跟踪修改 + 3 个未跟踪归档；`git diff --numstat` = **+105 / −65**；本报告加入后 7 个已跟踪修改。
  - `client.js` +5/−2；插件 package 1/1；CHANGELOG +20；ACCEPTANCE +16/−2；design +13；test-report +50/−60；acceptance-review +64/−99（本轮重写）。
  - 未跟踪：`docs/pipeline/archive/v1.2.80-{test-report,acceptance-review,release}.md`（链接已重算）。
- **依赖/边界**：根/插件 `dependencies` 与 HEAD 一致；无 Host 模块/工具/路由改动；无数据文件改动。
- **关键文件 SHA256（发布前）**：

```text
2183e30feab9e56f64ad967f389ed68bcdfa7e59d62de8dcc10afa6bed2fdcdd  dsh-web-filebrowser-plugin/client.js
345a8cf5ede4e1d23ff929f8f302d7e64e8e4500f2811ea05b7d0a31b62d6688  dsh-web-filebrowser-plugin/package.json
b9abd2aef364390ace900544185949407dd7c3ab0f2fe6d6dfa3049f3dd25ca7  package.json
070bd6927149e5b568dd194638d1b69bd8c2f2cd162372d62243fe035e1028b1  CHANGELOG.md
f535662ee034fedf697b34e47d3aa90c2632c3bb80c876ea6d1a71f10b99d28e  docs/ACCEPTANCE.md
d07178434255c56685d409027457f571d710be059fec955da44ea24af10dfbc5  docs/pipeline/test-report.md
c03e20e32ac7235c43f3ffb105edf97aceab54d1ec28fd7278ddc70ec03bfd74  docs/pipeline/acceptance-review.md
ddcd51e6c509329570cf03780e394586b0cf4bc57d1014b57ce2fdddcc0e147e  docs/pipeline/design.md
```

## 4. 生效方式与发布后 smoke

- **生效**：重启 Harness（或重建客户端 bundle）→ 浏览器强刷 → 打开工作台；纯客户端，无数据迁移。
- **发布后 smoke**：
  1. `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3080/` → 期望 200。
  2. `node .dsh/tmp/qa-static-v1281.mjs` → STATIC PASS（152 断言）。
  3. Owner 按 `docs/ACCEPTANCE.md` **批次 18** 复测并回填 `9b18175f4d`。
  4. 未重启/未重建 bundle 时 GUI 仍显示旧客户端，属预期。
- **发布记录**：`.dsh/pipeline.json` releases（`pipeline_record_release`）。

## 5. 回滚

- `git revert <本次 commit>` 或 `git reset --hard 1105b83`（回滚前备份 `.dsh/pipeline.json`）；重启 Harness + 重建 bundle + 强刷。
- 无数据迁移；回滚仅影响工作台栅格/宽度；不影响 Host/编辑器/终端/Git/流水线。

## 6. 风险与限制（非阻断）

- 唯一 blocked：实机布局/视觉复测（模型无浏览器）；Owner 批次 18。
- 历史 15 条 blocked 仍在清单（v1.2.79/80 及以前 GUI/视口项），可按 Owner 决定复测/更新/作废。
- 项目区在 1600px 以下为 2 列（与 v1.2.79「≥1280 三列」口径不同，按 Owner「3 个一排太挤」调整）。
- 设计稿卡整行展示；若没有设计产物，首行自动变为验收|体检。
- 面板 review marks 0/6；PM 已人工审阅 diff，Owner 可补标。

## 7. 发布历史（最近 3 条）

| 版本 | 环境 / URL | commit | 说明 |
|---|---|---|---|
| **v1.2.81（本次）** | local-workspace · http://127.0.0.1:3080 | 见 `pipeline_record_release` | hero 全宽 / 项目 2 列+需求整行 / 交付 4 宫格；批次 18 |
| v1.2.80 | local-workspace · http://127.0.0.1:3080 | `f976c4e` | 完成态/团队卡/交付卡 10 项修正 |
| v1.2.79 | local-workspace · http://127.0.0.1:3080 | `50cbc34` | 工作台 UI 全面重构（指挥舱） |

## 8. 备注

- 交付后根 `package.json` +1 至 **1.2.82**（chore commit），插件保持 **1.2.81**。
- 下一步：Owner 批次 18 实机复测 → 回填 blocked 项 → v1.2.81 验收闭环。
