# 发布说明：项目区去挤压（v1.2.82）

- 阶段：release（第 10 轮，运维 `opc-ops`）
- 环境：**local workspace / 自托管插件**（无公网 URL、无服务器上传、无数据迁移）
- 本地访问入口：Dev Workspace GUI `http://127.0.0.1:3080`（本机回环，仅供本机验收）
- 版本：`v1.2.82`（插件与根 `package.json` 均 1.2.82；`CHANGELOG.md` 顶部 `## 1.2.82 — 2026-10-27`）
- 发布基线：git HEAD `91bba31`（v1.2.81 交付后根版本 chore；上一发布 commit `d337436` = v1.2.81）；本轮改动为工作区未提交修改 + 3 个 v1.2.81 归档文档；实际 commit 以 `pipeline_record_release` 为准
- 发布时间 / 发布人：2026-10-27 17:12（Asia/Shanghai，`2026-10-27T09:12Z`） / 运维 agent `opc-ops`
- 前置闸门（已满足）：
  - `acceptance` = **approved**，`reviewedAt = 2026-10-27T09:10:12.647Z`，第 10 轮复核：**建议放行（附条件）、阻断 0**；
  - `approval` = **approved**，`reviewedAt = 2026-10-27T09:10:38.632Z`，`reviews[0] = {decision:'approve', actor:'owner'}` —— **Owner 面板人工确认，模型未审批**；
  - `release` 已进入 active；`gateMode=fast`、`round=10`、`roundScope=development`。

> 验收状态如实记录：清单 **36 条 = 19 pass / 0 fail / 17 blocked**（本轮 3 条 = 2 pass / 1 blocked 实机视觉；历史 16 条为 v1.2.79–81 及以前 GUI/视口项）。**Owner 按 `docs/ACCEPTANCE.md` 批次 19 复测回填前，不得视为实机布局已验收通过**；模型未伪造 pass。

## 1. 发布内容（Owner「太挤了」）

- `client.js` **+1/−5**（纯 CSS）：
  1) 删除 v1.2.81 留下的 `@media (min-width:1600px)` 项目区 3 列规则——Owner 屏幕 ≥1600 时仍触发 3 卡一排（每卡约 400px），需求标题/摘要截断、团队卡拥挤。
  2) `@media (min-width:768px)` 项目网格固定 `repeat(2, minmax(0,1fr))`，列间距 12→**16px**；需求卡 `grid-column:1/-1` 整行；≤700 单列。
- **文档/版本**：CHANGELOG 1.2.82、ACCEPTANCE **批次 19**、design.md **§15**；v1.2.81 三文档归档。
- **范围边界**：无 Host 改动、无新增依赖/字体/图标/CDN、无数据迁移；保留全部结构/功能/handler。

## 2. 发布前自测 gate（2026-10-27 17:11 CST）

| # | 命令 | 结果 |
|---|---|---|
| 1 | `npm run check` | exit 0（21 模块） |
| 2 | `npm run check:json` | exit 0 / JSON OK |
| 3 | `npm test` | 31/31 |
| 4 | `pipeline-selftest` | 38/38 |
| 5 | `review-selftest` | 22/22 |
| 6 | `assignments-selftest` | 27/27 |
| 7 | `qa-static-v1282` | STATIC PASS（152 断言） |
| 8 | `git diff --check` | 干净 |

- 证据日志：`.dsh/evidence/release-gate-v1.2.82.log`；无安装/构建步骤。

## 3. 产物清单与校验

- 写本报告前：**6 个已跟踪修改 + 3 个未跟踪归档**；`git diff --numstat` = **+84 / −65**：
  - `client.js` +1/−5；插件 package 1/1；CHANGELOG +14；ACCEPTANCE +14/−2；design +11；test-report +43/−57；acceptance-review +46/−52（本轮重写）。
  - 未跟踪：`docs/pipeline/archive/v1.2.81-{test-report,acceptance-review,release}.md`（链接已重算）。
- 依赖/边界：根/插件 `dependencies` 与 HEAD 一致；无 Host 模块/工具/路由改动；无数据改动。
- **关键文件 SHA256（发布前）**：

```text
aa14bde9386e148f0382c21d37b52deb1e435bc4af3310f4315c68a18fa0429b  dsh-web-filebrowser-plugin/client.js
f75f26425185e165ffe7de5f0e7892199ce925dcd42baef4e9269a458d192d61  dsh-web-filebrowser-plugin/package.json
52dffaa506b72d41daa7ed7fb66171c790241bd6b0656039b810093e4932aae9  package.json
ebae563a49ac53cd4d043334e4526fc12860d5ec6bc00169935c45a0739a1c4c  CHANGELOG.md
1dc48aab557618cb5d1bd75c5c22316cd8c5c8c9532379fef5a448bbf7f6614d  docs/ACCEPTANCE.md
1251764a9795f76cce00881cbe956e2864debcadb33e97adbebf6a144d74333f  docs/pipeline/test-report.md
1f9255d9f6e20cdbb30eef570931f697acac9b07098134dad1285d4e6a3544af  docs/pipeline/acceptance-review.md
04ac811ace49cd36ac1b2970cb15fc21e94d04824477d865541808097756bc6d  docs/pipeline/design.md
```

## 4. 生效方式与发布后 smoke

- **生效**：重启 Harness（或重建客户端 bundle）→ 浏览器强刷 → 打开工作台；纯客户端，无数据迁移。
- **发布后 smoke**：
  1. `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3080/` → 期望 200。
  2. `node .dsh/tmp/qa-static-v1282.mjs` → STATIC PASS（152 断言）。
  3. Owner 按 `docs/ACCEPTANCE.md` **批次 19** 复测并回填 `21b6ebc49e`。
  4. 未重启/未重建 bundle 时 GUI 仍显示旧客户端，属预期。
- **发布记录**：`.dsh/pipeline.json` releases（`pipeline_record_release`）。

## 5. 回滚

- `git revert <本次 commit>` 或 `git reset --hard 91bba31`（回滚前备份 `.dsh/pipeline.json`）；重启 Harness + 重建 bundle + 强刷。
- 无数据迁移；回滚仅影响项目区栅格；不影响 Host/编辑器/终端/Git/流水线。

## 6. 风险与限制（非阻断）

- 唯一 blocked：实机布局/视觉复测（模型无浏览器）；Owner 批次 19。
- 历史 16 条 blocked 仍在清单（v1.2.79–81 及以前 GUI/视口项）。
- 项目区固定 2 列，超宽屏不再回 3 列（v1.2.79「≥1280 三列」口径已按 Owner 要求废弃）。
- review marks 0/6；PM 已人工审阅 diff，Owner 可补标。

## 7. 发布历史（最近 3 条）

| 版本 | 环境 / URL | commit | 说明 |
|---|---|---|---|
| **v1.2.82（本次）** | local-workspace · http://127.0.0.1:3080 | 见 `pipeline_record_release` | 项目区始终 2 列 + 需求整行；批次 19 |
| v1.2.81 | local-workspace · http://127.0.0.1:3080 | `d337436` | hero 全宽 / 项目 2 列 / 交付 4 宫格 |
| v1.2.80 | local-workspace · http://127.0.0.1:3080 | `f976c4e` | 完成态/团队卡/交付卡 10 项修正 |

## 8. 备注

- 交付后根 `package.json` +1 至 **1.2.83**（chore commit），插件保持 **1.2.82**。
- 下一步：Owner 批次 19 实机复测 → 回填 blocked 项 → v1.2.82 验收闭环。
