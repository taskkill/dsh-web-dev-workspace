# 发布说明：工作台 UI 全面重构 —— 指挥舱（v1.2.79）

- 阶段：release（第 7 轮，运维 `opc-ops`）
- 环境：**local workspace / 自托管插件**（本工作区即发布产物；无公网 URL、无服务器上传、无 Docker 镜像、无数据迁移）
- 本地访问入口：Dev Workspace GUI `http://127.0.0.1:3080`（本机回环地址，仅供本机验收，不是公网发布）
- 版本：`v1.2.79`（根 `package.json` 与 `dsh-web-filebrowser-plugin/package.json` 均为 1.2.79；`CHANGELOG.md` 顶部 `## 1.2.79 — 2026-10-27`）
- 发布基线：git HEAD `e794ff9`（`chore: 根 package.json 版本 +1 至 1.2.79（工作区硬性规定；插件保持发布版 1.2.78）`；上一发布版 `a2797dc` = v1.2.78）；本次改动为工作区未提交改动 + 新建文档/效果图，**Git 提交由 Lead 执行**，提交后的 commit hash 以 `pipeline_record_release` 记录为准
- 发布时间 / 发布人：2026-10-27 16:23（Asia/Shanghai，`2026-10-27T08:23Z`） / 运维 agent `opc-ops`
- 前置闸门（硬闸门，已满足）：
  - `acceptance`（双复核第一关，项目经理 Agent）= **approved**，`reviewedAt = 2026-10-27T08:19:44.442Z`，报告 `docs/pipeline/acceptance-review.md`（第 7 轮）：**建议放行（附条件）、阻断 0**；
  - `approval`（双复核第二关，Owner 人工确认）= **approved**，`reviewedAt = 2026-10-27T08:22:17.354Z`，`reviews[0] = {decision:'approve', actor:'owner'}` —— **Owner 在 Dev Workspace 面板人工确认，模型未审批、未代批**；
  - `release` = **active**，`startedAt = 2026-10-27T08:22:18.018Z`；`gateMode = fast`、第 7 轮（`round=7`）、`roundScope=full`。

> 验收状态如实记录：当前验收清单 **20 条 = 6 pass / 0 fail / 0 pending / 14 blocked**。本轮新增 10 条 = **3 pass / 7 blocked**（7 条为纯 GUI/视觉/真实视口项，环境限制：模型无浏览器、不能重启 Host），历史遗留 7 条 blocked 为 v1.2.76/v1.2.77 的 GUI 项。**在 Owner 按 `docs/ACCEPTANCE.md` 批次 16 复测回填前，不得视为视觉/响应式/点击已验收通过**；模型未伪造 pass。

## 1. 发布内容（变更摘要）

**纯客户端工作台 UI 全面重构（指挥舱 / Command Deck）**：`dsh-web-filebrowser-plugin/client.js` **+848 / −77**（含工作台 JSX、`.ds-wb-v1279` CSS ≈34KB、i18n +19 键 ×2、删 2 个死键；client.js 1,223,438 → 1,246,554 B，+1.9%），无 Host/依赖/数据改动。

1. **页面头**：eyebrow（工作区 · 项目 · 第 N 轮）+ `h1` 30px display + 轮次/快速模式/进度 chips + 当前阶段 meta + 动作组（刷新 / 打开流水线 / 团队 / 提醒 / 关闭）；sticky、compact 回退、icon 按钮 aria-label。
2. **深色指挥舱 hero**：brand→#0b1220 渐变 + 内光晕；STAGE 05/07 eyebrow；30px 阶段名 + 五态状态 pill；摘要（clamp 2、tooltip ≤80 字）；负责角色/剩余阶段/快速模式；7 段 stage rail（五态色 + sr-only 文字）；SVG 环形进度（4/7、rotate -90）；主/次 CTA 44px（通过/打回 或 启动并派发/查看流水线）；review note；门禁说明 + 查看复核报告。
3. **Now 区**：hero 在前；失败告警卡（左 `!` 圆标、计数、发给团队、查看验收）；问题卡；空态轻提示。
4. **项目区**：状态卡（大数字 `4/7` + 进度条 + 状态 pill + 启动）+ 团队与指派（角色 chips / 指派任务 / 团队面板入口）+ 需求与调整（标题/chips/2 行摘要/查看·追加·修改·新轮/修订记录 disclosure）；≥1280 三列、≥768 两列（需求全宽）、≤700 单列。
5. **交付区**：7 步连接线时间轴（当前 tint、✓、角色、状态、事件记录）+ 5 卡 bento（设计稿/验收/交付前体检/本轮变更/运行中，第 5 卡全宽 + 4 项统计）；≥1024 两列、≤1023 单列；原卡按钮/入口全部保留。
6. **设计系统**：间距 4–32、字号 11–30、圆角 10/14/18、三级阴影、160ms 动效；全部 `--dsw-alias-*` + `color-mix`；focus-visible 2px 环、44px 主操作、`prefers-reduced-motion` 全关、sr-only/aria。
7. **响应式**：360/768/1024/1280/1440；≤700 页面头非 sticky、hero 单列、按钮 44px；compact 模式单独覆盖；无横向溢出规则（`minmax(0,1fr)` / `min-width:0` / `overflow-wrap`）。
8. **外壳 CSS 轻量统一**：顶栏 48px、侧栏更安静、pane 头、活动标签指示条；**不改交互/快捷键/路由**。
9. **保留全部功能**：通过/打回、启动并派发、review note、指派器、需求四操作、验收/体检/变更审阅/运行中、通知/刷新/关闭/compact，`pipelineBusy`/`assignmentSsh` 禁用逻辑不变。
10. **文档/记录**：`CHANGELOG.md` 1.2.79；`docs/ACCEPTANCE.md` 批次 16；`requirements.md` / `design.md` / `engineering-research.md` / `test-report.md` / `acceptance-review.md` 本轮同步；旧轮归档 `docs/pipeline/archive/v1.2.78-*.md`（6 文档，相对链接已按新目录重算，0 失效）；5 套设计效果图（SVG+PNG，10 文件）。

- **范围边界**：**无 Host 改动**（`index.js`/`pipeline.js`/`review.js`/`acceptance.js`/`assignments.js`/`delivery.js` 等零改动）、**无新增运行时依赖**（根/插件 `dependencies` 与 HEAD 逐字一致）、**无数据格式/迁移改动**、无新增模型工具/路由。
- **第三方**：零新增依赖/字体/图标/CDN；engineering-research 记录 5 个候选（shadcn/ui MIT、Radix MIT、Carbon Apache-2.0、Lucide ISC、Tailwind MIT），只借鉴模式、不复制代码。

## 2. 发布前自测 gate（发布前最后一次执行，2026-10-27 16:23 CST）

| # | 命令 | 退出码 | 耗时 | 结果 |
|---|---|---|---|---|
| 1 | `npm run check` | **0** | 0.55s | 21 个模块 `node --check` 全过（含 client.js） |
| 2 | `npm run check:json` | **0** | 0.11s | JSON OK |
| 3 | `npm test`（`node scripts/selftest/host-smoke.mjs`） | **0** | 0.60s | **PASS: 31/31** |
| 4 | `node .dsh/tmp/team/pipeline-selftest.mjs` | **0** | 0.63s | **38/38** |
| 5 | `node .dsh/tmp/team/review-selftest.mjs` | **0** | 0.76s | **22/22** |
| 6 | `node .dsh/tmp/team/assignments-selftest.mjs` | **0** | 0.17s | **27/27** |
| 7 | `node .dsh/tmp/qa-static-v1279.mjs` | **0** | 0.13s | **STATIC PASS（121 断言）** |
| 8 | `git diff --check` | **0** | — | 无空白/冲突标记 |

- 工具版本：Node **v24.22.0**、npm **11.19.1**；**无安装/构建步骤**（纯 JS 插件）；无锁文件改动；`.dsh/` 运行状态不进 Git。
- 验收复核（PM 第 7 轮）结论「建议放行（附条件）、阻断 0」；QA 测试报告 7 套全绿、121 静态断言；证据日志 `.dsh/evidence/acceptance-retest-v1.2.79.log`。

## 3. 产物清单与校验

发布产物 = 工作区文件快照（无 zip / 无独立构建产物）。

- **Git 现状（本报告写入前）**：`git status --short` = **9 个已跟踪修改 + 15 个未跟踪条目**；`git diff --numstat` 合计 **+1683 / −968**（9 文件：client.js +848/−77、插件 package 1/1、CHANGELOG +31、ACCEPTANCE +21/−2、acceptance-review +107/−113、design +319/−413、engineering-research +77/−72、requirements +270/−295、test-report +116/−108）；未跟踪 = archive 6 文档 + 10 效果图 + 生成脚本；本报告加入后再 +1 文件。
- **客户端代码（1）**：`dsh-web-filebrowser-plugin/client.js`（+848/−77：页面头/hero/Now/Project/Delivery JSX + `.ds-wb-v1279` CSS + i18n）
- **版本（1）**：`dsh-web-filebrowser-plugin/package.json`（1.2.78→1.2.79，仅 1 行，`dependencies`/`files` 未动）；根 `package.json` 在 HEAD 已为 1.2.79（交付后 +1 至 1.2.80，chore commit）
- **文档（7）**：`CHANGELOG.md`、`docs/ACCEPTANCE.md`、`docs/pipeline/requirements.md`、`design.md`、`engineering-research.md`、`test-report.md`、`acceptance-review.md`
- **设计资产（10 + 1 脚本）**：`docs/pipeline/design/workbench-v1279-{overview-light,overview-dark,full-light,mobile-light,overview-light-r1}*.{svg,png}` + `gen-workbench-v1279-mockups.mjs`
- **归档（6）**：`docs/pipeline/archive/v1.2.78-*.md`（requirements/design/engineering-research/test-report/acceptance-review/release）
- **本报告（1）**：`docs/pipeline/release.md`
- **依赖/边界核对**：根 `dependencies` = `{"ssh2":"^1.17.0"}`；插件 `dependencies` = `{"@xterm/addon-fit":"^0.10.0","@xterm/xterm":"^5.5.0","ssh2":"^1.17.0"}`；与 HEAD `e794ff9` 逐字一致；无 `package-lock.json`；**git diff 不含任何 Host 模块**；无新增模型工具/路由；无 `.dsh/` 数据改动。
- **关键文件 SHA256**（发布前，可复现）：

```text
20ff91f65bc90c07a0f0e87b1cdb15c253485b1d46cc3256372b60c18c8377f6  dsh-web-filebrowser-plugin/client.js
7fa7591d19729b0cec07122614167bc2f3fdbe63681dd9ffb1cc81e28ce3017e  dsh-web-filebrowser-plugin/package.json
1a8434150236503ba572e5e37e5acdf0b8ae09d786923f8299142c3117ad89df  package.json
3c201a308922d9bb722d09a676bdced4ff13769d6844b022b8e5f06c88089719  CHANGELOG.md
358af96bddaf7326e0af56539912f4c0856c4478cc52d5750f6e09a67bf7ae86  docs/ACCEPTANCE.md
e9f3cc5b58ea11b31e5f97c425a28112362985d9259b2c2458d1bab13f10ba61  docs/pipeline/test-report.md
a5784a5545754bd29e4d63d08040175fd6e38437a13b4875832724a5939a8be3  docs/pipeline/acceptance-review.md
d2d14a90eaafc9f24113b347864c08db9477002784bdee4eee7d9273f678300f  docs/pipeline/requirements.md
542c0f6c09bd19236dab9b16b259d93264f648a41d4e577a0877ec9b915cc819  docs/pipeline/design.md
4b28f270ba77c617028608575d6840ddb7248309776eca84ddc260f5dfacfe56  docs/pipeline/engineering-research.md
```

## 4. 生效方式与发布后 smoke 验证

- **生效条件（纯客户端）**：重启 Harness（或按现有方式重建客户端 bundle）→ 浏览器**强刷/无缓存刷新** → 打开工作台。Host 无新模块/无数据迁移，无需迁移脚本。
- **发布后 smoke（本机回环）**：
  1. `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3080/` → 期望 200（GUI 可打开）。
  2. `node .dsh/tmp/qa-static-v1279.mjs` → STATIC PASS（121 断言，发布前已跑）。
  3. Owner 按 `docs/ACCEPTANCE.md` **批次 16** 在浅/深主题、360/768/1024/1280/1440 视口逐项复测；回填 7 条本轮 blocked 项。
  4. 若 Harness 未重启/未重建 bundle，GUI 仍显示旧客户端（预期），不是发布失败。
- **发布记录**：写 `.dsh/pipeline.json` 的 `releases`（`pipeline_record_release`），包含环境/URL/版本/commit/生效/回滚；本报告随 commit 入库。

## 5. 回滚方案

- **代码层**：`git revert <本次 commit>`（或 `git reset --hard e794ff9`，视是否保留发布记录而定；发布前建议备份 `.dsh/pipeline.json`）。
- **回滚后操作**：重启 Harness → 重建客户端 bundle → 强刷页面；无数据迁移可回滚。
- **数据层**：本轮**未改** `.dsh/pipeline.json` 之外的业务数据格式；未写 `.dsh/acceptance.json`/交付记录/指派数据；回滚仅影响 UI。
- **回滚范围**：client.js + CHANGELOG + 插件版本 + docs + 设计资产；不会影响编辑器/终端/Git/流水线 Host 行为。

## 6. 已知风险与限制（均非阻断）

- **GUI 复测未完成**：7 条本轮 blocked + 7 条历史 blocked 需 Owner 批次 16 复测；模型无浏览器/不能重启 Host，未伪造 pass。DoD 第 1 项「所有 must 项 pass」当前为**有条件通过**。
- **深色 hero 在深色主题**：hero 固定 #0b1220 锚点 + 内光晕，深色效果图已出；Owner 目视确认。
- **效果图分组侧栏为方向示意**：实际外壳为横向侧栏条 + pane 头（本轮仅 CSS 统一，不改导航）。
- **第 5 张运行中卡全宽**为 bento 节奏设计；若 Owner 希望 5 卡等宽，一行 CSS 可回退。
- `color-mix`/`backdrop-filter` 需现代 Chromium；旧浏览器仅装饰降级。
- **review marks 0/8**：面板「已审」未标记，PM 已逐文件审阅 diff；Owner 可在面板补标。
- 页面因 5 卡直接展示 + hero 较高而变长，属预期；首屏只保证 hero + Now。

## 7. 发布历史（最近 3 条，完整见 `.dsh/pipeline.json`）

| 版本 | 环境 / URL | commit | 说明 |
|---|---|---|---|
| **v1.2.79（本次）** | local-workspace · http://127.0.0.1:3080 | 见 `pipeline_record_release` | 工作台 UI 全面重构（指挥舱）；纯客户端；批次 16 待 Owner 复测 |
| v1.2.78 | local-workspace · http://127.0.0.1:3080 | `a2797dc` | 交付区取消折叠（5 卡直接展示，两列/单列） |
| v1.2.77 | local-workspace · http://127.0.0.1:3080 | `7bed396` | 长 tooltip 修复 + 项目区三列 + 修订记录折叠 |

## 8. 备注

- 本轮为纯 UI 重构，无 Host 行为/数据格式变化；发布后如需回退，按 §5 执行。
- 交付后根 `package.json` 版本 +1 至 **1.2.80**（chore commit），插件保持 **1.2.79**（工作区硬性规定）。
- 下一步：Owner 按批次 16 复测 → 回填 blocked 验收项 → 若均通过则 v1.2.79 可视为验收闭环。
