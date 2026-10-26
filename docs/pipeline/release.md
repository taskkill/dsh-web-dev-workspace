# 发布说明：双复核模式（v1.2.72）

- 阶段：release（第 7 关，运维 `opc-ops`）
- 环境：**local workspace / 自托管插件**（本工作区即发布产物；无公网 URL、无远程服务器上传、无 Docker 镜像）
- 本地访问入口：Dev Workspace GUI `http://127.0.0.1:3080`（本机回环地址，仅供本机验收，不是公网发布）
- 版本：`v1.2.72`（根 `package.json` 与 `dsh-web-filebrowser-plugin/package.json` 均为 1.2.72；`CHANGELOG.md` 含 `## 1.2.72 — 2026-10-26`）
- 发布基线：git HEAD `a504f99`（v1.2.71）；本次 30 个文件为工作区未提交改动，**Git 提交由 Lead 执行**，提交后的 commit hash 以实际提交为准
- 发布时间 / 发布人：2026-10-26 15:50（Asia/Shanghai，`2026-10-26T07:50Z`） / 运维 agent `opc-ops`
- 前置闸门（硬闸门，已满足）：
  - approval = **approved**，`reviewedAt = 2026-10-26T07:49:26.354Z`，`reviews[0] = {decision:'approve', actor:'owner'}` —— **Owner 在 Dev Workspace 面板人工确认，模型未审批、未代批**；
  - release = **active**，`startedAt = 2026-10-26T07:49:26.743Z`；`gateMode = fast`（五个中间阶段自动通过，approval/release 永远人工）。

## 1. 发布内容（变更摘要）

- **流水线 7 阶段**：`product → design → development → testing → acceptance（项目经理 Agent 验收复核）→ approval（Owner 人工确认）→ release`；`PIPELINE_STAGES` 为唯一事实源，跳关启动一律 `bad-order`；fast 模式仅五个中间阶段自动通过，**approval 与 release 永不自动**。
- **新增项目经理 Agent 角色与验收复核关**：ID `project-manager-agent`、手册 `docs/opc/05-review.md`、交付物 `docs/pipeline/acceptance-review.md`（逐项核对 + 复测证据 + DoD + 建议放行/打回）；复核 Agent 不能自批、不能发布。
- **旧 6 阶段文档迁移**：读取时归一化为 7 关；缺失的 acceptance 补 pending，若旧文档 approval/release 已 approved 则迁移为 approved 并写「升级迁移：验收复核为更新新增，旧流程已完成」备注；变更轮 scope（full/development 执行、release/product/design/product-design 按语义跳过）同步支持新阶段。
- **客户端 / 中英文文案**：流水线视图与工作台渲染 7 关，新增「AI 复核 / 人工确认」标签、fast 提示、approval 就绪/等待文案（zh/en 各 1052 键，0 缺失）；默认阶段数改为 7。
- **文档与版本**：新增 `docs/opc/05-review.md`，`05-ops.md` 改名 `docs/opc/06-ops.md`（无断链），AGENT_TEAM / PLAYBOOK / opc README / 插件 README / CHANGELOG / ACCEPTANCE 批次 10 同步；`review.js` 的 `REVIEW_STAGE_IDS` 补 acceptance（修复 DEF-01）。

## 2. 发布前自测 gate（发布前最后一次执行，2026-10-26 15:49 CST）

| # | 命令 | 退出码 | 耗时 | 结果 |
|---|---|---|---|---|
| 1 | `npm run check` | **0** | 513 ms | 20 个模块 `node --check` 全过 |
| 2 | `npm test`（`node scripts/selftest/host-smoke.mjs`） | **0** | 554 ms | **PASS: 17/17 host smoke checks** |
| 3 | `node .dsh/tmp/team/pipeline-selftest.mjs` | **0** | 677 ms | **36/36 checks passed** |
| 4 | `node .dsh/tmp/team/review-selftest.mjs` | **0** | 789 ms | **22/22 checks passed** |

- 工具版本：Node **v24.22.0**、npm **11.19.1**；无安装/构建步骤（纯 JS 插件，Host 直接加载工作区代码）。
- 复用测试阶段结论：12 条 v1.2.72 验收项 **12/12 pass**；历史遗留 1 条 blocked（`3ffcb9eebb` 批次 5 GUI 复测，需 Owner 重启后执行，非本轮引入）。
- 测试报告：`docs/pipeline/test-report.md`；验收复核：`docs/pipeline/acceptance-review.md`（项目经理 Agent，结论「建议放行」）。

## 3. 产物清单与校验

发布产物 = 工作区文件快照（无 zip / 无独立构建产物；按宪章 §5，`.dsh/` 运行状态不进 Git）。

- **本报告写入前**：`git status --short` 共 20 个已跟踪改动（19 M + 1 改名 `docs/opc/05-ops.md → docs/opc/06-ops.md`，`git diff --stat` = 20 files changed, +842 / −217）+ 9 个新建未跟踪文件；本报告 `docs/pipeline/release.md` 为第 30 个文件（由 Lead 一并提交）。
- **代码（3）**：`dsh-web-filebrowser-plugin/pipeline.js`、`client.js`、`review.js`
- **测试（1）**：`scripts/selftest/host-smoke.mjs`
- **locale / 版本（3）**：`dsh-web-filebrowser-plugin/locale/zh.json`、`locale/en.json`、`dsh-web-filebrowser-plugin/package.json`
- **文档/记录（其余）**：`CHANGELOG.md`、`README.md`、`README.zh.md`、`docs/ACCEPTANCE.md`、`docs/AGENT_TEAM.md`、`docs/FEATURE_PROPOSAL.md`、`docs/PLAYBOOK.md`、`docs/UI_IA_PLAN.md`、`docs/opc/00-charter.md`、`docs/opc/04-qa.md`、`docs/opc/06-ops.md`（改名）、`docs/opc/README.md`、`docs/opc/05-review.md`（新）、`dsh-web-filebrowser-plugin/README.md`、`docs/pipeline/requirements.md`、`docs/pipeline/design.md`、`docs/pipeline/design/*.svg` ×4、`docs/pipeline/test-report.md`、`docs/pipeline/acceptance-review.md`、`docs/pipeline/release.md`（本文件）
- **关键文件 SHA256**（可复现校验，`sha256sum`）：

```text
85c33de0ca1f9059160892ccbc3e822dd8417669e4d6faf479ab871606bd54c3  dsh-web-filebrowser-plugin/pipeline.js
026514d104c2c285066cc088178625afe26065f0ce5921b39b77917619886c11  dsh-web-filebrowser-plugin/client.js
f96b71b1e3bd8077554b61b6b2f3672948ccbcb481a02fadf11980de474da387  dsh-web-filebrowser-plugin/review.js
a36fd406da2124b7b2e7612cfc2d7c2851ad88ad867316bba3bc28556635f174  dsh-web-filebrowser-plugin/package.json
83e8183ddc854608ee2545513a153abf2d5c661c652d79bbf92d3c0dc865b061  package.json
```

- **一致性/安全核对**：改动清单与本轮交付目录一致（代码 3 + 测试 1 + locale 2 + 插件 package.json + CHANGELOG + 文档/设计稿），无超范围改动；新增行密钥扫描 0 命中（`api_key/secret/password/PRIVATE KEY` 仅历史 README/CHANGELOG 功能说明，无真实凭据）；无调试代码（`console.log`/`debugger` 无新增）、无临时文件；`.dsh/` 已被 `.gitignore` 忽略，`git ls-files .dsh` = 0；无 `.env`/证书/私钥改动。

## 4. 发布方式与生效条件（重要）

- 本插件为**工作区自托管**：发布动作 = 工作区代码/文档即产物；**Host 端改动（`pipeline.js`、`review.js` 等）必须重启 Harness 才会加载生效**，客户端改动需在 GUI **强制刷新**后生效。
- 当前运行中的 Host 仍是升级前代码，因此 `.dsh/pipeline.json` 目前是旧 **6 关**快照（无 acceptance）。重启 Harness 后首次读取会按迁移逻辑归一化为 **7 关**；因该文档 approval 已 approved，acceptance 会迁移为 approved 并带「升级迁移」备注，项目保持已完成/可继续。**这是预期行为，不是发布失败。**
- 无公网发布、无预览分享、无交付 zip：本轮发布目标仅为本地工作区插件升级，客户可见交付物另行由 Lead/Owner 决定。

## 5. 回滚方式

- 上一版本：**v1.2.71**，即 git HEAD `a504f99`（仍在 Git 历史中，未提交任何本轮改动）。
- 方式 A（推荐，保留历史）：`git revert <本次 release commit>` → 重启 Harness → GUI 强刷。
- 方式 B（丢弃式）：`git reset --hard a504f99` → 重启 Harness → GUI 强刷。
- 生效前提：**Host 代码回退后必须重启 Harness**，旧 bundle/旧 Host 代码才会被重新加载；客户端强刷清理缓存。
- 预计耗时 < 2 分钟；无数据库/数据迁移，运行态仅 `.dsh/` 本地 JSON（可重建）。
- 注意：若已按 v1.2.72 重启并完成迁移，`.dsh/pipeline.json` 会变成 7 关文档；回滚到 v1.2.71（旧 6 阶段代码）后该文档含旧代码不认识的 acceptance 阶段，**该场景未在本轮验证**，回滚前建议先备份 `.dsh/pipeline.json`，必要时重置流水线文档后重新登记（不影响工作区代码与验收历史）。

## 6. 发布后验证（Owner 执行）

1. **重启 Harness**（加载 v1.2.72 Host 代码与迁移逻辑），打开本工作区；
2. **强制刷新** GUI（`Ctrl+Shift+R` / 硬刷新），确认流水线视图与工作台显示 **7 关**、第 5 关为「验收复核 / 项目经理 Agent」、第 6 关为「人工确认 / 项目经理（你）」，中文/英文均为 7 关；
3. 按 `docs/ACCEPTANCE.md` **批次 10** 完成 GUI 复测（normal 通过 + 打回、fast 五中间阶段自动且 approval/release 人工、三份旧文档迁移、变更 scope）；
4. 复测通过后关闭或明确豁免历史 blocked 项（批次 5，`3ffcb9eebb`）与 OBS-01/02/03；
5. 验证通过后由 Lead 执行 Git 提交，并在流水线面板记录本次 release（`pipeline_record_release`，environment=`local-workspace`，url=`http://127.0.0.1:3080`（本机 GUI，非公网））。**模型不代 Owner 审批、不创建 Git 提交、不调用 Host 发布记录工具。**

## 7. 遗留风险

1. **运行时 UI 未实测**：本环境无浏览器、Host 未重启，7 关渲染/交互只能由 Owner 按批次 10 复测；静态证据充分（`npm run check`、`npm test`、词典 1052 键 0 缺失、`node --check client.js`）。
2. **本轮 approval 在旧 6 关 Host 面板完成**：acceptance 关尚未在运行态出现，`docs/pipeline/acceptance-review.md` 为按新版口径执行的**手工复核演练**（未伪造提交）；重启后迁移会把 acceptance 标记为「升级迁移」approved。**真正跑通 7 阶段 acceptance 关的是下一个项目**，本版本交付物是代码/文档本身。
3. **历史 blocked 1 项**：`3ffcb9eebb`（批次 5 GUI 复测，Owner 重启后执行），非本轮引入，不影响 v1.2.72 交付判定。
4. **OBS 类观察**（非阻断）：OBS-01 测试报告基线措辞已被 QA 更正；OBS-02 插件 `package.json` 的「已审」标记需 Owner 在面板补齐或豁免；OBS-03 `client.js` 既有重复 locale 键（本轮之前已存在，行为无影响）。
5. **无公网 URL**：发布目标为本地自托管插件，不涉及生产环境/公网访问；GUI `127.0.0.1:3080` 仅本机可达。
6. 回滚到旧 6 阶段代码后读取已迁移 7 关运行态文档的行为未验证（见 §5 注意事项）。

## 8. 审批与记录留痕

- Owner 人工确认记录：`.dsh/pipeline.json` → `stages[approval].status = "approved"`，`reviewedAt = 2026-10-26T07:49:26.354Z`，`reviews[0] = {"decision":"approve","actor":"owner"}`；随后 `stages[release].status = "active"`。
- 模型边界遵守：运维未审批、未改业务代码/需求/验收结论、未创建 Git 提交、未调用 `pipeline_record_release`（Host 工具在子代理不可用，由 Lead 执行）。
- 发布记录：本文件 + Lead 在流水线面板写入的 `releases` 记录（environment=`local-workspace`，版本 1.2.72，回滚方式见 §5，「重启 Harness 生效」见 §4）。
