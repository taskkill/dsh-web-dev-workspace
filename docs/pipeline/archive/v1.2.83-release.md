# 发布说明：设计先确认 —— 设计稿截图 / HTML 预览 + 开发前人工闸门（v1.2.83）

- 阶段：release（第 11 轮，运维）
- 环境：**local workspace / 自托管插件**（无公网 URL、无服务器上传、无数据迁移）
- 本地访问入口：Dev Workspace GUI `http://127.0.0.1:3080`（本机回环，仅供本机验收）
- 版本：插件 `dsh-web-filebrowser-plugin/package.json` = **1.2.83**；根 `package.json` 交付后按工作区硬性规定 **1.2.83 → 1.2.84**；`CHANGELOG.md` 顶部 `## 1.2.83 — 2026-10-27`
- 发布基线：git HEAD `2d3ebe0`（并行打包热修，已提交）；本轮改动为工作区未提交修改 + 设计稿新文件 + 归档文档；实际发布 commit 以 `pipeline_record_release` 记录为准
- 发布时间 / 发布人：2026-10-27 20:15（Asia/Shanghai） / Lead（运维角色由 Lead 执行）
- 前置闸门（已满足）：
  - `design` = **approved**：本轮 Owner 在对话中确认设计稿（D1–D4 截图 + design.md §16）后进入开发；新的 design 强制闸门代码随本次发布生效（重启 Harness + 重建 bundle 后，design 提交会停在 review，必须 Owner 在面板确认）；
  - `testing` = approved（fast 模式记录），自动化 10 套全绿，`docs/pipeline/test-report.md`；
  - `acceptance` = **approved**：项目经理 Agent 独立复核**建议放行、阻断项 0**（`docs/pipeline/acceptance-review.md`，258 行；P2 证据链已闭环）；
  - `approval` = **approved**：Owner 在 Dev Workspace 面板人工确认（模型未审批）；
  - `release` 进入 active；`gateMode=fast`、`round=11`、`roundScope=full`。

> 验收状态如实记录：清单 **49 条 = 26 pass / 0 fail / 23 blocked / 0 pending**，其中本轮 13 条（本需求 10 条 + 并行打包热修 3 条）= 7 pass / 6 blocked。6 条 blocked 均为 GUI 视觉/交互项（设计卡缩略图与大图、HTML 内嵌预览三档、两处待确认态、`.html` 默认预览、GUI 回归、打包 e2e），**需 Owner 按 `docs/ACCEPTANCE.md` 批次 20 复测回填；回填前不得视为已实机验收通过**。模型未伪造 pass。

## 1. 发布内容

### 1.1 Host：`dsh-web-filebrowser-plugin/pipeline.js`

1. 新增 `PIPELINE_MANUAL_GATE_STAGES = ['design','approval','release']`；快速模式 `fastApproval` 只对 product / development / testing / acceptance 自动通过——**design 不再随快速模式自动通过**。
2. design 提交后停在 `review`，写入提示 note「设计确认闸门：Owner 查看截图 / HTML 预览并确认后才进入开发」；`pipeline_start_stage('development')` 在 design 未 approved 时返回 `bad-order`，消息明确要求 Owner 先确认设计。
3. `design-no-image` warning 文案修正：缺少可直接查看的截图时提示「HTML 只能预览，不能替代截图」，不再出现「HTML 截图」；新增 `ARTIFACT_PREVIEWABLE_EXTENSIONS`（.html/.htm）。
4. `STAGE_GUIDES.design` 要求至少一张可直接查看的截图（PNG/JPG/SVG/WebP），HTML 仅作补充；`STAGE_GUIDES.development` 要求开工前 design 已 approved。
5. `PIPELINE_SECTION`、`pipeline_status` / `pipeline_start_stage` / `pipeline_submit_stage` 工具描述、阶段提示词统一为「四个自动 / 三个人工」并加入「不贴 HTML 源码、确认前不启动开发」纪律；`pipeline_submit_stage` 提交 design 的返回文案明确要求停下等 Owner 确认。

### 1.2 客户端：`dsh-web-filebrowser-plugin/client.js`（约 +1424/−42，含 i18n/CSS）

1. **D1 流水线设计卡**：design 处于 review 时显示 warn 提示条「设计稿待你确认 · 确认后进入开发」+ 产物计数 + 缩略图 + 「预览设计稿」；HTML 产物改为「预览 HTML + 查看源码（次级）」，不再默认打开源码。
2. **D2 设计稿预览弹层**：`role=dialog`/`aria-modal`、Esc 与背板关闭、状态 pill、产物 tabs、360/768/1280 三档（只改宽度不重载）、HTML 用 `iframe sandbox="" + title + loading="lazy"` 渲染、图片应用内大图、加载/失败/空态 + 重试 + 查看源码退路；底部 review note + 「确认设计，进入开发」/「打回」复用现有 `reviewPipelineStage('design', …)`，处理中禁用并保留错误与 note。
3. **D3 工作台设计卡 / hero**：review 时「待你确认」徽标 + 提示条 + 缩略图/HTML 预览 + 预览/通过/打回/note；无截图空态与「HTML 不能替代截图」提示（无截图时通过按钮 disabled；D2 中 HTML-only 仍可确认但提示）。
4. **D4 `.html/.htm` 默认渲染预览**：`modeOf` 新增 `html` 模式，打开默认预览（iframe sandbox）而非源码；工具栏「预览 / 源码」切换，源码为可编辑保存的 text tab；空文件/读取失败/SSH 根降级均有可读提示与源码退路；HTML tab 不再提供顶层「在浏览器打开」（避免同源脚本执行风险）。
5. i18n 新增 33 个 zh/en key（parity 通过）；`pipeline.fastHint` 与 `buildIntakePrompt` 旧「五个中间阶段」口径改为「四个自动 / 三个需人工确认」。
6. 本轮同时包含并行热修 `2d3ebe0`：打包交付不再清空流水线快照（工作台不再跳回需求录入），打包中按钮文案改为「打包中… / Packing…」。

### 1.3 文档

`docs/pipeline/requirements.md`（第 11 轮，6 来源 + 10 条验收项）、`docs/pipeline/design.md` §16（4 来源、D1–D5、八态矩阵、响应式、ARIA、自检 4.8/5、R1→R3）、`docs/pipeline/engineering-research.md`（3 个 GitHub 候选 + 许可证矩阵，零依赖零复制）、`docs/pipeline/test-report.md`、`docs/pipeline/acceptance-review.md`；`CHANGELOG.md` 1.2.83；`docs/ACCEPTANCE.md` 批次 20；`README.md` / `README.zh.md` / `docs/AGENT_TEAM.md` / `docs/PLAYBOOK.md` / `docs/opc/README.md` / `docs/opc/02-design.md` 同步设计确认闸门；8 组设计稿（SVG+PNG）新增到 `docs/pipeline/design/design-gate-*`；v1.2.79 需求、v1.2.82 测试报告/发布说明归档到 `docs/pipeline/archive/`。

## 2. 发布前验证（release 阶段复跑；根版本 +1 之前）

- `npm run check` → exit 0（21 模块语法）
- `npm run check:json` → exit 0（JSON OK）
- `npm test` → exit 0，34/34（含 fast design 闸门、manual gates、design-no-image、packfix 回归）
- `node .dsh/tmp/qa-static-v1283.mjs` → exit 0，STATIC PASS 246 断言
- `node .dsh/tmp/fe-render-smoke.mjs` → exit 0，51/51
- `node .dsh/tmp/dev-design-gate-check.mjs` → exit 0（design review 不自动通过 / development bad-order / approve 后解锁 / warning 文案）
- `node .dsh/tmp/qa-static-v1283-packfix.mjs` → exit 0，18/18
- `git diff --check` → 干净；`.dsh/tmp/`、`.dsh/evidence/` 未进入提交（.gitignore）

## 3. 发布步骤（已执行）

1. 根 `package.json` 版本 1.2.83 → **1.2.84**（工作区硬性规定，插件保持发布版 1.2.83）。
2. 归档 v1.2.82 测试报告 / 发布说明、v1.2.79 需求文档。
3. 提交本轮全部代码/文档/设计稿（排除 `.dsh` 临时与证据文件），提交信息 `v1.2.83 设计先确认：设计阶段截图/HTML 预览 + 开发前人工闸门`。
4. 调用 `pipeline_record_release` 记录本环境发布；`pipeline_submit_stage(release)` 提交发布评审。
5. Owner 在面板通过「发布上线」阶段完成归档（release 是人工闸门）。

## 4. 发布后必做（Owner）

1. **重启 Harness**（加载新的 `pipeline.js` 闸门/提示词/工具描述）→ **重建客户端 bundle** → **强刷**页面。
2. 按 `docs/ACCEPTANCE.md` 批次 20 复测并回填 6 条 blocked：
   - 快速模式下设计提交后停在「待评审」、启动开发被拒；
   - 流水线/工作台设计卡缩略图、大图、待确认提示条与通过/打回/预览；
   - HTML 设计稿在预览弹层按 360/768/1280 渲染，不默认打开源码，查看源码为次级；
   - 打开 `.html/.htm` 默认渲染预览，工具栏预览/源码切换、源码可保存；
   - 打包交付后工作台不跳回需求录入（热修回归）。
3. 若某项失败：该 blocked 项记 fail，按问题严重度决定打回 development 或作为下一轮 hotfix；发布记录与 release.md 保留不改。

## 5. 回滚方案

- 代码层：发布 commit 之前为 `2d3ebe0`；如需回滚执行 `git revert <release-commit>`（或 `git reset --hard 2d3ebe0` 后重建 bundle + 重启 Harness）。
- 版本层：回滚后插件版本可保持 1.2.82、根版本按工作区规定继续递增（不回退根版本号）。
- 数据层：本次无 pipeline/acceptance 数据结构变更；`.dsh/` 数据保持兼容（本轮只是新增状态提示与 UI，无迁移）。
- 回滚后必须重启 Harness + 重建客户端 bundle，否则旧 Host 仍加载旧闸门逻辑。

## 6. 已知限制（本发布不阻塞）

- HTML 预览统一 `sandbox=""`，**不执行脚本**（含脚本的高保真稿以静态视觉为准，可切「查看源码」）；SSH 远程工作区的设计稿预览降级为源码并提示。
- 1280 档在窄容器内横向滚动（不缩放）；iframe 高度桌面 640 / ≤1023 560 / ≤700 480；焦点陷阱仅初始聚焦 + Esc/背板关闭 + 尽力归还焦点（现有 modal 同样无完整 trap）。
- D3 工作台设计卡在「无截图」时禁用通过（D2 弹层对 HTML-only 仍可确认但提示）；404 错误检测依赖 iframe onError + 一次 stat，错误页可能显示在框内，但源码/重试入口常驻。
- 本轮 live Host 仍运行旧代码直到重启；所有 GUI blocked 项在重启 + 重建 bundle + 强刷后复测。
