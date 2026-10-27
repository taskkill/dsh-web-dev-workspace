# 发布说明：验收台分区可收起 + 流水线触发策略（v1.2.84 / v1.2.85）

- 阶段：release（第 12 轮，运维）
- 环境：**local workspace / 自托管插件**（无公网 URL、无服务器上传、无数据迁移）
- 本地访问入口：Dev Workspace GUI `http://127.0.0.1:3080`（本机回环，仅供本机验收）
- 版本：插件 `dsh-web-filebrowser-plugin/package.json` = **1.2.85**；根 `package.json` = **1.2.87**（v1.2.84 交付 bump 至 1.2.86，随后的流水线触发策略改动按工作区硬性规定再 +1 至 1.2.87）；`CHANGELOG.md` 顶部含 `## 1.2.86`（触发策略）与 `## 1.2.84`（验收台折叠）
- 发布基线：git HEAD `1d85de4`（v1.2.85 仓库/包瘦身）；发布 commit = 本次 release 提交（以 `pipeline_record_release` 记录为准）
- 发布时间 / 发布人：2026-10-27（Asia/Shanghai） / Lead（运维角色由 Lead 执行）
- 前置闸门（已满足）：
  - `product` / `design` / `development` / `testing` / `acceptance` = **approved**（`gateMode=fast` 自动通过；design 由 Owner 在设计闸门确认，验收复核结论「建议放行、阻断 0」，见 `docs/pipeline/acceptance-review.md`）；
  - `approval` = **approved**：Owner 在 Dev Workspace 面板人工确认（2026-10-27 14:31 UTC，模型未审批）；
  - `release` 进入 active；`round=12`、`roundScope=full`；
  - 本发布同时包含一轮**未经流水线**的小改动（流水线触发策略 v1.2.85）：Owner 明确要求在对话中直接完成并同意随本次交付发布，未新增验收项（见下方「验收状态如实记录」）。

> 验收状态如实记录：清单 **64 条 = 41 pass / 0 fail / 23 blocked / 0 pending**，23 条 blocked 全部为历史遗留的 GUI / 整包项；本轮 v1.2.84 新增 10 条全部 pass、18 条 evidence 全部存在非空（QA 44/44 GUI E2E、复核 56/56 静态断言）。v1.2.85 触发策略改动按「对话框发起」流程直接交付，以 `npm test` 35/35 新增用例与 `docs/ACCEPTANCE.md` 批次 23 复测覆盖，未伪造 pass。

## 1. 发布内容

### 1.1 客户端：`dsh-web-filebrowser-plugin/client.js`（v1.2.84，验收台分区可收起）

1. **三区块折叠**：证据库 / 复测中心 / 交付与预览分享各为单一全宽 `button` 折叠头（44px，标题 + ≤2 数量徽标 + 箭头，`aria-expanded` / `aria-controls`，Enter/Space，`focus-visible`），body 用 `hidden` 保留挂载并在面板内滚动（260 / 240 / 340px 上限），默认收起。
2. **全部收起 / 全部展开**：工具区单按钮随状态切换文案，作用三区块 + 全部分组 + 详情（不取消选中），重复点击幂等。
3. **分组与详情折叠**：分类分组头为 button（名称 + 数量徽标 + 箭头），持久化 key 用分类原值；选中项详情 48px 折叠头（状态徽标 + 标题 + 箭头），收起后选中高亮保留并提示，选另一项自动重开。
4. **复测中心扁平化**：删除内层 `verificationOpen` 开关，展开即见最近结果、命令与运行按钮。
5. **持久化**：localStorage 单键 `dsh-web-filebrowser:acceptance-collapse`（16 KiB 上限、blocks 白名单、groups ≤256 / 键长 ≤120、跳过危险键、坏值整份回退、写失败静默降级）。
6. **i18n 与可访问性**：新增 14 对 zh/en key，渲染段零硬编码中文；pass/fail 标题色改用 `color-mix` 保证 4.5:1；收起内容不参与 Tab。

### 1.2 Host：流水线触发策略（v1.2.85）

1. `pipeline.js` 的 `PIPELINE_SECTION` 开头新增「**触发条件**」：只有从 Dev Workspace「工作台」发起的交付需求（收件箱 / 需求修订提示）或 Owner 明确要求时才走七阶段；对话框直接提出的需求按默认 Harness 方式直接完成——不调 `pipeline_*`、不建/改写 `.dsh/pipeline.json`、不写验收清单、不派角色队友。
2. `pipeline_set_requirement` / `pipeline_update_requirement` / `pipeline_start_stage` / `pipeline_dispatch` / `pipeline_status` 的工具描述补同一路由限定语（英文，随工具定义下发）。
3. `acceptance.js` 的验收清单指引补「触发条件」：验收清单只属于工作台发起的交付。
4. `workspace-state.js` 的 `## 工作区状态` 简报首行加「流程约定」，已有项目的工作区里续聊也不会默认拉起整条流水线。
5. `scripts/selftest/host-smoke.mjs` 新增「pipeline trigger policy」用例，断言系统提示、工具描述、验收指引与状态简报都含该规则。

### 1.3 文档

`docs/pipeline/requirements.md` / `design.md`（§17）/ `engineering-research.md` / `test-report.md` / `acceptance-review.md`（第 12 轮）；`CHANGELOG.md`（1.2.84 + 1.2.86 触发策略条目）；`docs/ACCEPTANCE.md` 批次 22 / 23；`README.md` / `README.zh.md` / `dsh-web-filebrowser-plugin/README.md` / `docs/AGENT_TEAM.md` / `docs/PLAYBOOK.md` 同步触发策略；设计稿 8 张 SVG + 生成器；v1.2.83 的 requirements / design 相关 / engineering-research / test-report / acceptance-review / release.md 已归档到 `docs/pipeline/archive/`。

## 2. 发布前验证（release 阶段复跑）

- `npm run check` → exit 0（21 模块语法）
- `npm run check:json` → exit 0（JSON OK）
- `npm test` → exit 0，**35/35**（34 既有 + 新增 pipeline trigger policy 用例）
- `git diff --check` → 干净
- 上游证据：QA 静态断言 20/20、GUI E2E 44/44（0 console error）；项目经理 Agent 复核静态 56/56、建议放行、阻断 0

## 3. 发布步骤（已执行）

1. 归档上一轮发布说明 → `docs/pipeline/archive/v1.2.83-release.md`。
2. 提交本轮全部代码/文档/设计稿（排除 `.dsh/` 与生成 PNG）。
3. 调用 `pipeline_record_release` 记录本环境发布（environment / URL / 版本与回滚）。
4. 调用 `pipeline_submit_stage(release)` 提交发布评审。
5. Owner 在 Dev Workspace 面板通过「发布上线」阶段完成归档（release 是人工闸门）。

## 4. 发布后必做（Owner）

1. **重启 Harness**（让 v1.2.85 触发策略提示词/工具描述生效）。
2. **重建客户端 bundle**（v1.2.84 的 `client.js` 改动）→ **强刷**页面。
3. 按 `docs/ACCEPTANCE.md` 复测并回填：
   - **批次 22**：三区块默认收起与展开、徽标口径、全部收起/展开、持久化与坏值回退、分组折叠、清单与详情、键盘与 ARIA、响应式与主题、i18n、既有功能无回归；
   - **批次 23**：对话框需求直接完成（不建流水线）、工作台需求仍走七阶段、已有项目不误触发、触发规则可见。
4. 若某项失败：该验收项记 fail；P0/P1 问题打回 development 或作为 hotfix 跟进，发布记录与本文档保留不改。

## 5. 回滚方案

- 代码层：`git revert <release-commit>`（或 `git reset --hard 1d85de4`），随后重启 Harness + 重建客户端 bundle + 强刷页面。
- 版本层：回滚后插件版本保持已发布版 `1.2.85`；根版本按工作区规定继续递增，不回退根版本号。
- 数据层：本次无 `pipeline` / `acceptance` 数据结构变更；`.dsh/` 数据保持兼容（v1.2.84 只新增客户端折叠偏好，v1.2.85 只改提示词与工具描述）。
- 回滚后必须重启 Harness，否则旧 Host 仍加载新提示词；客户端需重建 bundle，否则折叠 UI 不清除。

## 6. 已知限制（本发布不阻塞）

- **折叠体量**：三区块收起时区块体在面板内滚动（260 / 240 / 340px 上限），清单保底 96px；360px 侧栏下长标题可能换行（既有行布局，非本轮引入）；徽标超长按 96px 省略但 `title` 有全文；折叠无高度动画为设计决定。
- **复测中心扁平化**：属既有行为改动（删除内层「复测」开关），由批次 22「既有功能无回归」覆盖。
- **触发策略生效条件**：提示词由 Host 注册，必须重启 Harness 才生效；无需重建客户端 bundle。工作台收件箱 / 需求修订提示是唯一自动触发源，其余对话按默认 Harness 流程。
- **闸门**：本阶段提交后进入 review，需 Owner 在面板通过后归档；模型不审批、不跳过闸门。
