# 发布说明：工作台 UI 三区重构（v1.2.76）

- 阶段：release（第 4 轮，运维 `opc-ops`）
- 环境：**local workspace / 自托管插件**（本工作区即发布产物；无公网 URL、无服务器上传、无 Docker 镜像）
- 本地访问入口：Dev Workspace GUI `http://127.0.0.1:3080`（本机回环地址，仅供本机验收，不是公网发布）
- 版本：`v1.2.76`（根 `package.json` 与 `dsh-web-filebrowser-plugin/package.json` 均为 1.2.76；`CHANGELOG.md` 顶部 `## 1.2.76 — 2026-10-27`）
- 发布基线：git HEAD `97316d2`（`chore: 根 package.json 版本 +1 至 1.2.76（插件保持发布版 1.2.75）`；上一发布版 `eff0c76` = v1.2.75）；本次 24 个文件为工作区未提交改动，**Git 提交由 Lead 执行**，提交后的 commit hash 以实际提交为准
- 发布时间 / 发布人：2026-10-27 14:49（Asia/Shanghai，`2026-10-27T06:49Z`） / 运维 agent `opc-ops`
- 前置闸门（硬闸门，已满足）：
  - `acceptance`（双复核第一关，项目经理 Agent）= **approved**，`reviewedAt = 2026-10-27T06:45:23.481Z`，报告 `docs/pipeline/acceptance-review.md` **v2 复验**：**建议放行、阻断 0**（v1 的唯一阻断 B1「需求摘要 60 字规则」已按 v1-A 口径修订并复测关闭；OBS-1/OBS-2/OBS-9 已修复；其余 OBS 为非阻断）；
  - `approval`（双复核第二关，Owner 人工确认）= **approved**，`reviewedAt = 2026-10-27T06:48:37.348Z`，`reviews[0] = {decision:'approve', actor:'owner'}` —— **Owner 在 Dev Workspace 面板人工确认，模型未审批、未代批**；
  - `release` = **active**，`startedAt = 2026-10-27T06:48:37.725Z`；`gateMode = fast`、第 4 轮（`round=4`）、`roundScope=full`。

> 验收状态如实记录：v1.2.76 验收清单 **12 条 = 4 pass / 0 fail / 8 blocked**。8 条 blocked 均为**纯 GUI/视觉/交互项**（三区渲染、hero 首屏与三态操作、5 卡折叠、fail 自动展开/红点、视觉/对比度、option-a 基准、无障碍键盘、响应式/窄屏），属环境限制（本机无浏览器自动化），需 Owner **重建客户端 bundle + 强刷**后按 `docs/ACCEPTANCE.md` **批次 13** 复测回填；**在 Owner 回填前不得视为已验收通过**。

## 1. 发布内容（变更摘要）

- **纯客户端工作台三区重构（方案 A）**：`dsh-web-filebrowser-plugin/client.js` **+556 / −14**——工作台由上到下固定为「**现在 / 项目 / 交付**」三区（分区头 `section aria-labelledby` + 3–4px 类目色条 + 图标 + 13px 半粗标题 + 右侧计数/操作），现在区置顶含 hero；项目区含项目状态/进度、团队与指派、需求与调整三卡；交付区含 7 步项目流程 + 设计稿/验收/交付前体检/本轮变更/运行中 5 张紧凑折叠行。
- **hero 当前阶段卡 + 三态主操作**：状态 pill、一句摘要、7 点进度/「x/7 关已完成」、负责角色；approval 待确认时主操作「通过/打回」+ 辅助链接，阶段 pending/failed 时「启动并派发/指派任务」，全部完成时完成态；首屏可见（1440×1024）。
- **交付区 5 卡默认折叠 + 计数/状态摘要 + 「展开全部/收起全部」+ 会话内记忆**；关键失败（验收 fail>0、体检 fail）自动展开并显示红点/失败计数，手动收起后保留告警，修复后恢复默认收起。
- **需求与调整摘要化**：标题 + 轮次/范围 chips + ≤2 行（约 160 字）纯文本摘要 +「查看完整需求/追加说明/修改需求/新轮变更」四操作；**页面不再直出完整需求 detail 长文**（B1-A 口径：无整段全文渲染，摘要允许节选）。
- **视觉规范**：浅灰蓝底 + 白卡轻阴影（`0 1px 2px`）+ 圆角 12 + 内边距 16/20 + 分区色条；卡片标题 12px 半粗正常大小写、主要数字 15–16px、正文 12–13px；4/8 间距体系；正文对比度实测 4.86–17.76:1、状态 4.65–4.79:1、非文本 ≥3:1；hover/focus 可见。
- **i18n / 无障碍 / 响应式**：新增 **23 个** `workbench.*` 中英键成对（词典总计 1202/1202，既有 `workbench.assign.*` 122 键未动）；折叠头 button 语义 + `aria-expanded`/`aria-controls`、44px 触控、焦点环、`prefers-reduced-motion` 降级；≤700px 单列、内容 max-width 1080、360/768/1280 无横向溢出、200% zoom 可操作。
- **范围边界**：**无 Host 改动**（`pipeline.js`/`review.js`/`acceptance.js`/`index.js`/`assignments.js` 本轮零改动）、**无新增运行时依赖**（依赖与 HEAD 逐字一致）、**无数据格式/迁移改动**（不写 `.dsh/pipeline.json`/`.dsh/acceptance.json`）；既有 10 张工作台卡与编辑器标签右键菜单（Owner 标签菜单）完整保留。
- **文档/设计**：`docs/pipeline/requirements.md`（6 来源调研 / 23 行借鉴决策表 / 已验证 vs 创新假设）、`design.md`（三区 IA/tokens/对比度实测/折叠状态矩阵/响应式/无障碍/五维自评 4.2 与 must 8 项 0 失败/2 套落地稿及 R1/R2 迭代）、`test-report.md`、`acceptance-review.md`（v2）、`engineering-research.md`（§8 第 4 轮 N/A 补记）；`docs/ACCEPTANCE.md` 批次 13；`CHANGELOG.md` 1.2.76；设计落地稿 `docs/pipeline/design/workbench-redesign-{final,expanded}.{svg,png}` ×4 + 上一轮设计归档；新建提案 `docs/proposals/workbench-redesign/`（README + before/option-a/b/c ×SVG/PNG 8 文件）。

## 2. 发布前自测 gate（发布前最后一次执行，2026-10-27 14:49 CST）

| # | 命令 | 退出码 | 耗时 | 结果 |
|---|---|---|---|---|
| 1 | `npm run check` | **0** | 655 ms | **21 个模块** `node --check` 全过（含 client.js 重构后语法） |
| 2 | `npm test`（`node scripts/selftest/host-smoke.mjs`） | **0** | 668 ms | **PASS: 31/31 host smoke checks** |
| 3 | `node .dsh/tmp/team/pipeline-selftest.mjs` | **0** | 699 ms | **38/38 checks passed**（七阶段双复核回归） |
| 4 | `node .dsh/tmp/team/review-selftest.mjs` | **0** | 777 ms | **22/22 checks passed** |
| 5 | `node .dsh/tmp/team/assignments-selftest.mjs` | **0** | 169 ms | **27/27 checks passed**（指派器回归） |

- 工具版本：Node **v24.22.0**、npm **11.19.1**；**无安装/构建步骤**（纯 JS 插件，Host/客户端直接加载工作区代码）；无锁文件改动。
- 验收清单：**12 条 = 4 pass / 0 fail / 8 blocked**（blocked 为 GUI 环境项，见上）；验收复核（PM v2）与 QA 测试报告均记录「建议放行/通过，阻断 0」。
- 复测/复核依据：`docs/pipeline/test-report.md`、`docs/pipeline/acceptance-review.md`（v2）、`.dsh/evidence/acceptance-retest-v1.2.76.log`（QA/PM 另跑 `npm run check:json` 与 `qa-static-v1276` 均 exit 0）。

## 3. 产物清单与校验

发布产物 = 工作区文件快照（无 zip / 无独立构建产物；按宪章 §5，`.dsh/` 运行状态不进 Git）。

- **Git 现状（本报告写入前）**：`git status --short` = **9 个已跟踪修改 + 14 个新建未跟踪 = 23 个文件**；`git diff --stat` = 9 files changed, **+1493 / −1210**；另加本报告（重写上一轮 v1.2.75 记录），交付清单共 **24 个文件 = 10 个已跟踪修改 + 14 个新建**。
- **客户端代码（1）**：`dsh-web-filebrowser-plugin/client.js`（**+556 / −14**：三区渲染、hero、折叠状态、需求摘要 helper、23 个 i18n 键、视觉 tokens/CSS、响应式与无障碍属性；既有功能无删减）
- **版本（1）**：`dsh-web-filebrowser-plugin/package.json`（version 1.2.75→1.2.76；`dependencies`/`files` 未动）；根 `package.json` 版本已在 HEAD 预置 1.2.76、工作区无改动
- **文档（7）**：`CHANGELOG.md`、`docs/ACCEPTANCE.md`（批次 13）、`docs/pipeline/requirements.md`、`docs/pipeline/design.md`、`docs/pipeline/test-report.md`、`docs/pipeline/acceptance-review.md`（v2）、`docs/pipeline/engineering-research.md`（+§8）
- **设计落地稿（5，新建）**：`docs/pipeline/design/workbench-redesign-final.{svg,png}`、`workbench-redesign-expanded.{svg,png}`、`archive-v1.2.75-assigner.md`（上一轮归档）
- **提案（9，新建）**：`docs/proposals/workbench-redesign/README.md` + `mockups/before|option-a|option-b|option-c .{svg,png}`（8 张对比/方案图）
- **本报告（1）**：`docs/pipeline/release.md`（本文件，替换 v1.2.75 记录；历史见 §8）
- **依赖/边界核对**：根 `dependencies` = `{"ssh2":"^1.17.0"}`；插件 `dependencies` = `{"@xterm/addon-fit":"^0.10.0","@xterm/xterm":"^5.5.0","ssh2":"^1.17.0"}`；与 HEAD `97316d2` **逐字一致**，无 `package-lock.json`；**git diff 不含任何 Host 模块**（`pipeline.js`/`review.js`/`acceptance.js`/`index.js`/`assignments.js` 均未改）；无新增模型工具/路由；无数据格式或 `.dsh/` 文档改动。
- **关键文件 SHA256**（可复现校验，`sha256sum`）：

```text
961c368d509ec03e036d3aad62e45101d7503916e3c7fc439aed23903dd420f3  dsh-web-filebrowser-plugin/client.js
5d2e3a6df35981a9becd102d27a582dc04864965ceeaaeb551051ef0273f95c8  dsh-web-filebrowser-plugin/package.json
24d9b5f1c9827c573e59dc1b366fbe7051d58bdee66a96dc4d8ab91d6786a6fa  package.json
a79ade272073f5bcad0c1915313c9fed54ed8d9d3a5723c4854df2498c32969e  docs/pipeline/requirements.md
f71eabc297b5dc1a2dbdac711ab1f004a3c861ce1cde4d907768720ef7ae30a4  docs/pipeline/design.md
15aead566004ec4a899d84e2e074f9b35015a80200c301a149ceb1f7d9c90d94  docs/pipeline/test-report.md
9a08ff247ff2d3b8c7210348f2bb8c11201f9e37c9babaefa1a2077e896d5c93  docs/pipeline/acceptance-review.md
8e6f46ed82106b0c22daa0a538b212e98e6cf1bd1576d32f765a6b06088045bc  docs/pipeline/engineering-research.md
```

- **一致性/安全核对**：改动清单与本轮交付一致（客户端 1 + 版本 1 + 文档 7 + 设计稿 5 + 提案 9 + 本报告），无超范围改动；新增行密钥扫描 **0 命中**；无调试代码（`console.log`/`debugger` 无新增）、无 `innerHTML`/`dangerouslySetInnerHTML` 新增、无临时文件；`.dsh/` 已被 `.gitignore` 忽略（`git ls-files .dsh` = 0）；无 `.env`/证书/私钥；`git diff --check` 干净；标签右键菜单与既有 10 卡保留。

## 4. 发布方式与生效条件（重要）

- 本插件为**工作区自托管**：发布动作 = 工作区代码/文档即产物。本轮为**纯客户端改动**，生效方式：
  - **重建客户端 bundle + 强刷页面**后生效（`client.js` 是三区/hero/折叠/摘要/i18n/CSS 的唯一改动点）；
  - **Host 无新增模块/无新 op/无数据迁移**（Host 模块与依赖零改动）→ **无需重启 Host 即可运行**；为对照准确与排除旧 bundle 缓存，**建议按批次 13 流程先重启一次 Harness，再重建 bundle + 强刷**；
  - 折叠展开状态为**会话内记忆**（不做 localStorage），刷新后恢复默认收起（设计已声明，属预期）。
- 无公网发布、无预览分享、无交付 zip：本轮发布目标仅为本地工作区插件升级；客户交付包/分享链接由 Lead/Owner 按需另行决定。

## 5. 回滚方式

- 上一版本：**v1.2.75**（发布提交 `eff0c76`；当前 HEAD `97316d2` 仅把根 `package.json` +1 至 1.2.76，插件版本与功能代码仍为 v1.2.75）。当前发布基线 = HEAD `97316d2`。
- 方式 A（推荐，保留历史）：`git revert <本次 release commit>` → 重建客户端 bundle → 强刷（Host 无改动，重启可选）。
- 方式 B（丢弃式）：`git reset --hard eff0c76` → 重建 bundle → 强刷；如需撤销根版本预置也一并回到 v1.2.75 发布态。
- 生效前提：**客户端代码回退后必须重建 bundle / 强刷**（否则浏览器仍执行旧 bundle）；Host 无需重启、无数据迁移。
- **回滚前备份运行态**（`.dsh/` 不进 Git，`git reset/revert` 不会回退它们）：`.dsh/pipeline.json`（流水线/验收/审阅状态）；若已有工作台指派记录（`.dsh/agent-assignments.json`，本工作区当前不存在），一并备份。
- 预计耗时 < 2 分钟；无数据库/数据迁移、无依赖变更；风险低（纯 UI 层，Host/数据零改动）。

## 6. 发布后验证（Owner 执行）

1. **重建客户端 bundle + 强刷页面**（若使用 `dsh web` 托管 bundle，按批次 13 流程重建；为对照准确可先重启一次 Harness）；
2. 准备两个工作区：一个有需求/流水线数据（hero、需求摘要、折叠状态），一个无项目/无待办（空态）；对照 `docs/proposals/workbench-redesign/mockups/option-a.png` 与 `docs/pipeline/design.md`；
3. 按 `docs/ACCEPTANCE.md` **批次 13** 逐项复测并回填 **8 条 blocked GUI 验收项**（其余 4 条已 pass）：
   - **三区分层**：1440×1024 从上到下「现在→项目→交付」，分区色条/图标/13px 标题/右侧计数；项目区三卡两列、交付区 7 步 + 5 折叠行；顺序与归属不可乱；
   - **空态与降级**：无待办不空白堆卡；无项目显示开工空态而非假 hero；
   - **hero 三态**：approval 待确认→「通过/打回」+ 辅助链接；阶段 pending/failed→「启动并派发/指派任务」；全部完成→完成态；首屏可见（主操作 y<1024）、摘要截断不撑破、键盘可聚焦可点；
   - **需求摘要化**：只显示标题/轮次范围 chips/≤2 行摘要/四操作；`document.body.innerText` 不出现 detail 整段（无 60 字以上连续片段，标题除外）、无 markdown 残留；「查看完整需求」可看到完整需求；无需求显示空态；
   - **5 卡默认收起 + 计数**：设计稿/验收/交付前体检/本轮变更/运行中默认收起，折叠头图标+名称+计数/状态+chevron，点击或 Enter/Space 展开，原卡功能完整；「展开全部/收起全部」一键切换、0 数据不报错；
   - **fail 自动展开与红点**：验收 fail>0、体检 fail 时自动展开 + 红点/错误色 + 失败计数（同时有文字，不只靠颜色）；手动收起保留告警；fail 清零后恢复默认收起；
   - **视觉/对比度**：浅灰蓝底、白卡 1px 边框 + 轻阴影 + 圆角 12、分区色条、12/13px 标题、16px 间距、对比度 ≥4.5:1（非文本 ≥3:1）、hover/focus 可见；
   - **option-a 一致**：逐区对照 `docs/proposals/workbench-redesign/mockups/option-a.png`，before/after 5 个痛点改善；design 自评每维 ≥4、must 0 失败（微调项已记录）；
   - **i18n**：切中/英三区标题/hero/折叠/摘要/空态/失败提示均有翻译，无 key/undefined/硬编码残留；新增 23 键；既有 `workbench.assign.*` 122 键不回归；
   - **无障碍**：折叠头 button + `aria-expanded`/`aria-controls`、分区 section + `aria-labelledby`、Tab 顺序/焦点环、44px 触控、reduced-motion 降级、展开后焦点不丢；
   - **响应式**：≤700px 单列、360×800/768×1024/1280×800 无横向溢出（`scrollWidth <= clientWidth+1`）、hero 按钮换行可一次点击、200% zoom 可操作；桌面 1440 两列、max-width 1080；
   - **回归安全**：流水线七阶段双复核、团队与指派（卡/抽屉/状态卡/催办/打回/再指派）、验收台（列表/证据/导出）、交付包、变更审阅（打开 Git/已审）、运行中（打开任务）、编辑器标签右键菜单（关闭/关闭其他/关闭右侧/全部关闭/固定）均正常；`.dsh/pipeline.json` 与 `.dsh/acceptance.json` 未被 UI 改写；
   - **自动化/版本**：`npm run check`、`npm run check:json`、`npm test`（31/31）、pipeline-selftest（38/38）、review-selftest（22/22）、assignments-selftest（27/27）、qa-static-v1276 均 exit 0；批次 13/CHANGELOG/双 1.2.76 一致；
4. 复测通过后由 Lead 执行 Git 提交，并在流水线面板记录本次 release（`pipeline_record_release`：environment=`local-workspace`，url=`http://127.0.0.1:3080`，notes 含版本/commit/自测/回滚 + 「纯客户端改动：重建 bundle + 强刷生效，Host 无需数据迁移」）。**模型不代 Owner 审批、不创建 Git 提交、不调用 Host 发布记录工具。**
5. **版本硬性规定**：本工作区约定交付后根 `package.json` +1，**本次发布 v1.2.76 完成后根版本 +1 至 1.2.77**（插件保持 1.2.76，由 Lead 在收尾时处理并在记录中说明）。

## 7. 遗留风险

1. **8 条 GUI/视觉/交互验收项未实测（blocked）**：三区渲染/hero 首屏/折叠可发现性/失败自动展开/视觉对比度/option-a 基准/键盘无障碍/响应式窄屏以 Owner 批次 13 为准（环境限制，非实现缺陷）；**Owner 回填前不得宣称 v1.2.76 已验收通过**。
2. **折叠可发现性**：交付区 5 卡默认收起是本轮设计目标，但「展开全部/收起全部」入口与折叠头计数/状态摘要需要 Owner 目视确认可发现（批次 13 已列为首屏测试点）。
3. **窄屏/深色主题未复测**：≤700px 单列与 360/768/1280 仅静态验证；**深色主题**与 200% zoom 的实际渲染需 Owner 实测（本工作台以浅色为主，深色 token 沿用既有 CSS，本轮未做深色专项调整）。
4. **需求摘要阈值**：摘要 ≤2 行/约 160 字，超长需求必须点「查看完整需求」才能看到全文（设计内行为）；摘要为纯文本，markdown 被剥离。
5. **折叠状态仅会话内记忆**：刷新/重进页面恢复默认收起（不做 localStorage，设计已声明）。
6. **OBS 类剩余（非阻断，PM v2 报告）**：OBS-A `test-report.md` §3.4/§4 两处旧句（文件数/「除 2 条 DEF-01 外全部 PASS」）与最终 9 文件 diff 不一致，建议下次同步；OBS-B 设计稿与实现微差（hero 色条 4 vs 5px、折叠行 gap/高度、团队卡仍显示最近记录）；OBS-C 旧 `.ds-wb-adjust-detail` 死 CSS；OBS-D 来源计数表述；OBS-E「查看完整需求」复用 `openPipeline` 与设计表述有差异、hero「其它」分支入口略重复；OBS-F `.dsh/review.json` 逐文件「已审」0/23 需 Owner 补标或知悉。
7. **回归面**：本轮为工作台大函数重构（+556/−14），静态/自动化已覆盖既有功能保留，但真实浏览器下 10 卡、指派器、验收台、标签菜单的交互回归仍需 Owner 按批次 13 抽查。
8. **回滚/运行态**：`.dsh/` 不在 Git，回滚代码不影响流水线/验收数据；按 §5 备份 `.dsh/pipeline.json`（及若存在的 `.dsh/agent-assignments.json`）。真实生产发布/SSH 工作区不在本轮范围；无公网 URL（本地自托管）。

## 8. 审批与记录留痕 / 历史发布

- **双复核留痕**：`.dsh/pipeline.json` → `stages[acceptance].status="approved"`（`reviewedAt=2026-10-27T06:45:23.481Z`，PM v2 复验「建议放行/阻断 0」，v1 B1 已按 v1-A 口径关闭）；`stages[approval].status="approved"`（`reviewedAt=2026-10-27T06:48:37.348Z`，`reviews[0]={"decision":"approve","actor":"owner"}`，Owner 面板人工确认）；随后 `stages[release].status="active"`（`startedAt=2026-10-27T06:48:37.725Z`）。
- **模型边界遵守**：运维未审批、未改业务代码/需求/设计/验收结论、未创建 Git 提交、未调用 `pipeline_record_release`（Host 工具在子代理不可用，由 Lead 执行）。
- **历史发布**：
  - v1.2.75 工作台 Agent 指派器 MVP：commit `eff0c76`（基线 `322064c`），35 个文件，自测 check + test 31/31 + pipeline 38/38 + review 22/22 + assignments 27/27；`releases` 已记录。
  - v1.2.73 团队三 Agent 能力升级：commit `0e764b2`（基线 `b3c1e77`），26 个文件，test 18/18 + pipeline 38/38 + review 22/22；`releases` 已记录。
  - v1.2.72 双复核模式：commit `2d8c761`（基线 `a504f99`），30 个文件，test 17/17 + pipeline 36/36 + review 22/22；`releases` 已记录。
  - 本轮 v1.2.76 的 `releases` 记录由 Lead 补写；交付后根版本 +1 至 1.2.77。
