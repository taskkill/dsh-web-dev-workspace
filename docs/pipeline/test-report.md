# 测试报告 —— 项目区去挤压：始终 2 列 + 需求整行（v1.2.82）

- 角色：测试工程师；日期：2026-10-27（Asia/Shanghai）；阶段：testing（第 10 轮）。
- 被测版本：插件/根 `package.json` **1.2.82**；基线 commit `91bba31`（v1.2.81 交付后根版本 chore）。
- 结论：**自动化 7 套全绿**；`qa-static-v1282` **STATIC PASS（152 断言）**；新增 3 条验收 **2 pass / 1 blocked**（实机视觉）；无阻断缺陷。**建议进入 acceptance**。

## 1. 执行摘要

| # | 命令 | 退出码 | 结果 |
|---|---|---|---|
| 1 | `npm run check` | 0 | 21 个模块语法通过 |
| 2 | `npm run check:json` | 0 | JSON OK |
| 3 | `npm test` | 0 | PASS: 31/31 |
| 4 | `pipeline-selftest` | 0 | 38/38 |
| 5 | `review-selftest` | 0 | 22/22 |
| 6 | `assignments-selftest` | 0 | 27/27 |
| 7 | `qa-static-v1282` | 0 | **STATIC PASS（152 断言）** |

> 日志：`.dsh/evidence/testing-v1.2.82.log`。

## 2. 变更审计

| 文件 | 变更 | 说明 |
|---|---|---|
| `client.js` | **+1 / −6** | 删除 `@media(min-width:1600px)` 3 列规则；2 列网格 gap 12→16 |
| 插件 `package.json` | 1 行 | 1.2.81 → **1.2.82** |
| `CHANGELOG.md` / `docs/ACCEPTANCE.md` / `design.md` | +~10 / +~18 / +~11 | 1.2.82、批次 19、§15 |
| `docs/pipeline/archive/` | 新增 3 | v1.2.81 的 test-report/acceptance-review/release 归档（链接已重算） |

- 无 Host/依赖/数据改动；`git diff --check` 干净。

## 3. 修正验证（qa-static-v1282）

| # | 问题 | 证据 |
|---|---|---|
| 1 | ≥1600 仍 3 列 → 需求/团队挤 | 已无 `@media(min-width:1600px)` 项目规则；`@media(min-width:768px)` 项目网格 `repeat(2, minmax(0,1fr)); gap:16px` |
| 2 | 需求卡未整行 | `.ds-wb-project-grid .ds-wb-project-cell-wide { grid-column:1/-1 }` 保留 |
| 3 | 回归 | v1.2.81 的 152 条断言基线保留（153 项检查中 1 项替换为「无 1600 覆盖」），页面画布/交付 4 宫格/完成态等全部通过 |

## 4. 验收项（本轮新增 3 条）

| 验收点 | 状态 | 说明 |
|---|---|---|
| 任意 ≥768 宽度项目区 2 列 + 需求整行；≤700 单列 | **pass（静态）** | 断点/整行/gap 规则 |
| 质量门/版本：7 套全绿 + 152 断言 + 1.2.82/批次 19 | **pass** | §1/§2 |
| 实机 GUI 复测：1440/1600/1920 均为 2 列 + 需求整行、无横向溢出 | **blocked** | 模型无浏览器；Owner 按批次 19 复测 |

## 5. 需求覆盖（round 10）

| 需求点 | 证据 | 状态 |
|---|---|---|
| 移除 1600 三列、始终 2 列 + 需求整行 | qa 断言 | ✅ 静态 |
| 列间距 16px、需求标题/摘要完整 | CSS 规则 | ✅ 静态 |
| 既有布局/功能不回归 | 152 断言 + 7 套 | ✅ |
| 版本/文档 | 1.2.82、批次 19、§15 | ✅ |
| 实机视觉 | 批次 19 | ⏳ blocked（Owner） |

## 6. GUI 复测步骤（Owner）

详见 [ACCEPTANCE.md 批次 19](../ACCEPTANCE.md#L275)：

1. 重启 Harness → 重建 bundle → 强刷。
2. 1440/1600/1920：项目区应为「状态｜团队」2 列 + 需求卡整行；需求标题/摘要完整，团队 chips 不拥挤。
3. ≤700/701–767 单列；浅/深主题；hero/交付 4 宫格保持；功能回归。

## 7. 观察（P3）

| # | 说明 | 处理 |
|---|---|---|
| OBS-1 | 实机需 Owner 重启后目视（模型无浏览器） | 批次 19，未伪造 pass |
| OBS-2 | 项目区固定 2 列，超宽屏不再回到 3 列（v1.2.79 口径已废弃） | 按 Owner「太挤了」调整 |
| OBS-3 | 历史 16 条 blocked 仍在清单 | 可按批次 19 一并复测/更新/作废 |

## 8. 结论

- 7 套全绿、152 断言 PASS；diff 仅 6 行 CSS + 版本/文档；**无阻断缺陷**。
- 新增 3 条验收：**2 pass / 1 blocked（实机视觉）**；建议进入 acceptance。
