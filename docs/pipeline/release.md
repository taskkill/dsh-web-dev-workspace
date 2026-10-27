# 发布说明：工作台 UI 修正（v1.2.77）

- 阶段：release（第 5 轮，运维 `opc-ops`）
- 环境：**local workspace / 自托管插件**（本工作区即发布产物；无公网 URL、无服务器上传、无 Docker 镜像）
- 本地访问入口：Dev Workspace GUI `http://127.0.0.1:3080`（本机回环地址，仅供本机验收，不是公网发布）
- 版本：`v1.2.77`（根 `package.json` 与 `dsh-web-filebrowser-plugin/package.json` 均为 1.2.77；`CHANGELOG.md` 顶部 `## 1.2.77 — 2026-10-27`）
- 发布基线：git HEAD `ddbd843`（`chore: 根 package.json 版本 +1 至 1.2.77（插件保持发布版 1.2.76）`；上一发布版 `0d841f4` = v1.2.76）；本次 7 个文件为工作区未提交改动，**Git 提交由 Lead 执行**，提交后的 commit hash 以实际提交为准
- 发布时间 / 发布人：2026-10-27 15:33（Asia/Shanghai，`2026-10-27T07:33Z`） / 运维 agent `opc-ops`
- 前置闸门（硬闸门，已满足）：
  - `acceptance`（双复核第一关，项目经理 Agent）= **approved**，`reviewedAt = 2026-10-27T07:29:17.869Z`，报告 `docs/pipeline/acceptance-review.md`（第 5 轮）：**建议放行、阻断 0**（4 条 pass 静态证据认可；9 条 GUI blocked 为环境限制；专业质量 ③ 通过、①② 按 pipeline 记录 N/A）；
  - `approval`（双复核第二关，Owner 人工确认）= **approved**，`reviewedAt = 2026-10-27T07:32:55.807Z`，`reviews[0] = {decision:'approve', actor:'owner'}` —— **Owner 在 Dev Workspace 面板人工确认，模型未审批、未代批**；
  - `release` = **active**，`startedAt = 2026-10-27T07:32:56.258Z`；`gateMode = fast`、第 5 轮（`round=5`）、`roundScope=full`。

> 验收状态如实记录：v1.2.77 验收清单 **13 条 = 4 pass / 0 fail / 9 blocked**。9 条 blocked = v1.2.76 遗留 8 条 GUI 项（三区/hero/折叠/fail 自动展开/视觉/option-a/无障碍/响应式）**回归复测** + 本轮新增视觉项 `4939bdcb62`（视觉更清爽），均为纯 GUI/视觉/交互、属环境限制（本机无浏览器自动化），需 Owner **重启 Harness + 重建客户端 bundle + 强刷**后按 `docs/ACCEPTANCE.md` **批次 14** 复测回填；**在 Owner 回填前不得视为已验收通过**。

## 1. 发布内容（变更摘要）

- **纯客户端 UI 修正**：`dsh-web-filebrowser-plugin/client.js` **+68 / −20**，五项定向修复：
  1. **长 tooltip/溢出修复**：移除需求摘要 `title=requirement.detail` 与修订行 `title=entry.detail`，改为 ≤80 字摘要；`.ds-wb-adjust-summary` 增加 `white-space:normal` / `word-break:break-word` / `overflow-wrap:anywhere` + 2 行 clamp；页面/分区/卡/hero/折叠/项目格等容器补 `min-width:0`，360–1440 无横向溢出；
  2. **项目区宽屏对齐 option-a**：`≥1024px` 三列（项目状态/团队与指派/需求与调整同行、各 1fr，需求卡不再强制跨全宽），`≤1023px` 两列 + 需求卡全宽，`≤700px` 单列；项目卡按钮换行、团队 chips 2 列 + 列表限高滚动；
  3. **需求修订默认折叠**：「修订记录 (N)」button + `aria-expanded`/`aria-controls`/`hidden`/chevron，默认收起、点击/键盘展开、刷新恢复折叠；
  4. **视觉细化**：页面浅灰蓝底更明显（55% layer-2 mix）、白卡 1px 边框（近 #E3E8EF）+ `0 1px 3px` 轻阴影 + 12 圆角 + 12–13px 标题层级；
  5. 新增 2 个 i18n 键（本轮新增 25 键合计、`workbench.assign.*` 122 键未破坏、zh/en 各 1204 键成对）。
- **范围边界**：**无 Host 改动**（`pipeline.js`/`review.js`/`acceptance.js`/`index.js`/`assignments.js` 本轮零改动）、**无新增运行时依赖**（依赖与 HEAD 逐字一致）、**无数据格式/迁移改动**；既有 10 张工作台卡与编辑器标签右键菜单（Owner 标签菜单）完整保留；不新增模型工具/路由。
- **文档/记录**：`CHANGELOG.md` 1.2.77；`docs/ACCEPTANCE.md` 批次 14（含批次 13 的 8 项 GUI 回归要求）；`docs/pipeline/test-report.md`（v1.2.77，13 条/4 pass/9 blocked、72 项静态断言 STATIC PASS）；`docs/pipeline/acceptance-review.md`（第 5 轮复核报告）；本发布说明。本轮为 UI 缺陷修复，product/design 阶段按「仅代码/配置调整」跳过（无新需求/设计文档，属记录在案 N/A）。

## 2. 发布前自测 gate（发布前最后一次执行，2026-10-27 15:33 CST）

| # | 命令 | 退出码 | 耗时 | 结果 |
|---|---|---|---|---|
| 1 | `npm run check` | **0** | 665 ms | **21 个模块** `node --check` 全过（含 client.js +68/−20） |
| 2 | `npm test`（`node scripts/selftest/host-smoke.mjs`） | **0** | 703 ms | **PASS: 31/31 host smoke checks** |
| 3 | `node .dsh/tmp/team/pipeline-selftest.mjs` | **0** | 697 ms | **38/38 checks passed**（七阶段双复核回归） |
| 4 | `node .dsh/tmp/team/review-selftest.mjs` | **0** | 816 ms | **22/22 checks passed** |
| 5 | `node .dsh/tmp/team/assignments-selftest.mjs` | **0** | 170 ms | **27/27 checks passed**（指派器回归） |

- 工具版本：Node **v24.22.0**、npm **11.19.1**；**无安装/构建步骤**（纯 JS 插件）；无锁文件改动。
- 验收清单：**13 条 = 4 pass / 0 fail / 9 blocked**（blocked 为 GUI 环境项，见上）；验收复核（PM 第 5 轮）与 QA 测试报告均记录「建议放行/通过，阻断 0」。
- 复测/复核依据：`docs/pipeline/test-report.md`、`docs/pipeline/acceptance-review.md`、`.dsh/evidence/acceptance-retest-v1.2.77.log`（QA/PM 另跑 `npm run check:json` 与 `qa-static-v1277`（72 断言）均 exit 0）。

## 3. 产物清单与校验

发布产物 = 工作区文件快照（无 zip / 无独立构建产物；按宪章 §5，`.dsh/` 运行状态不进 Git）。

- **Git 现状（本报告写入前）**：`git status --short` = **6 个已跟踪修改、0 个新建未跟踪**；`git diff --stat` = 6 files changed, **+308 / −242**；另加本报告（重写上一轮 v1.2.76 记录），交付清单共 **7 个文件（均为已跟踪修改）**。
- **客户端代码（1）**：`dsh-web-filebrowser-plugin/client.js`（**+68 / −20**：tooltip ≤80 字、摘要 wrap + 2 行 clamp、容器 `min-width:0`、≥1024 三列媒体查询、修订折叠 + aria、视觉 token、2 个 i18n 键）
- **版本（1）**：`dsh-web-filebrowser-plugin/package.json`（version 1.2.76→1.2.77，仅 1 行；`dependencies`/`files` 未动）；根 `package.json` 版本已在 HEAD 预置 1.2.77、工作区无改动
- **文档（4）**：`CHANGELOG.md`（1.2.77 段）、`docs/ACCEPTANCE.md`（批次 14）、`docs/pipeline/test-report.md`、`docs/pipeline/acceptance-review.md`
- **本报告（1）**：`docs/pipeline/release.md`（本文件，替换 v1.2.76 记录；历史见 §8）
- **依赖/边界核对**：根 `dependencies` = `{"ssh2":"^1.17.0"}`；插件 `dependencies` = `{"@xterm/addon-fit":"^0.10.0","@xterm/xterm":"^5.5.0","ssh2":"^1.17.0"}`；与 HEAD `ddbd843` **逐字一致**，无 `package-lock.json`；**git diff 不含任何 Host 模块**；无新增模型工具/路由；无数据格式或 `.dsh/` 文档改动；无新建未跟踪文件（本轮全部为已跟踪文档/代码修改）。
- **关键文件 SHA256**（可复现校验，`sha256sum`）：

```text
930fa63858b3873c23316986ac3f6335baf932058379e69c2ca0ac28f7afbe62  dsh-web-filebrowser-plugin/client.js
3116ad335236cdcb1d0476158cb9f5628d05f1491a13ea3e8627b29f09df9028  dsh-web-filebrowser-plugin/package.json
0a83e55879db51040801ad26a87abacabd7cbe0efe988b5368060df278051012  package.json
69c440c24289aaac307bfd701faa1006bbf30f1d2d976fafa5d0e691857f7c6c  docs/pipeline/test-report.md
31e577efe7f12ded065d115d047d553db26d9888b3f654653628b89b93d5d5f8  docs/pipeline/acceptance-review.md
fcfb3bec0223f21e265fbfdf90ff3647784908cab8caf7ec4f16f0bab97ae8b8  docs/ACCEPTANCE.md
5caf0d4b17ca6dd22453fcab36c38996e0cef21150989496e1d64c97d8fa6699  CHANGELOG.md
```

- **一致性/安全核对**：改动清单与本轮交付一致（客户端 1 + 版本 1 + 文档 4 + 本报告），无超范围改动；新增行密钥扫描 **0 命中**；无调试代码（`console.log`/`debugger` 0 新增）、无 `innerHTML`/`dangerouslySetInnerHTML` 新增、无临时文件；`.dsh/` 已被 `.gitignore` 忽略（`git ls-files .dsh` = 0）；无 `.env`/证书/私钥；`git diff --check` 干净；标签右键菜单与既有 10 卡保留。

## 4. 发布方式与生效条件（重要）

- 本插件为**工作区自托管**：发布动作 = 工作区代码/文档即产物。本轮为**纯客户端改动**，生效方式：
  - **重建客户端 bundle + 强刷页面**后生效（`client.js` 是唯一代码改动点，无 Host 模块/无新 op/无数据迁移）；
  - 为排除旧 bundle 缓存与对照准确，**建议先重启 Harness**（Host 无需更新，但重启可确保加载最新客户端产物）→ 重建 bundle → 强刷；
  - 修订记录折叠状态为**会话内默认收起**（刷新恢复折叠，不做 localStorage，属设计内行为）。
- 无公网发布、无预览分享、无交付 zip：本轮发布目标仅为本地工作区插件升级；客户交付包/分享链接由 Lead/Owner 按需另行决定。

## 5. 回滚方式

- 上一版本：**v1.2.76**（发布提交 `0d841f4`；当前 HEAD `ddbd843` 仅把根 `package.json` +1 至 1.2.77，插件版本与功能代码仍为 v1.2.76）。当前发布基线 = HEAD `ddbd843`。
- 方式 A（推荐，保留历史）：`git revert <本次 release commit>` → 重建客户端 bundle → 强刷（Host 无改动，重启可选）。
- 方式 B（丢弃式）：`git reset --hard 0d841f4` → 重建 bundle → 强刷；如需撤销根版本预置也一并回到 v1.2.76 发布态。
- 生效前提：**客户端代码回退后必须重建 bundle / 强刷**（否则浏览器仍执行旧 bundle）；Host 无需重启、无数据迁移。
- **回滚前备份运行态**（`.dsh/` 不进 Git，`git reset/revert` 不会回退它们）：`.dsh/pipeline.json`（流水线/验收/审阅状态）；若已有工作台指派记录（`.dsh/agent-assignments.json`），一并备份。
- 预计耗时 < 2 分钟；无数据库/数据迁移、无依赖变更；风险低（纯 UI 修正，Host/数据零改动）。

## 6. 发布后验证（Owner 执行）

1. **重启 Harness → 重建客户端 bundle → 强制刷新页面**；
2. 对照 `docs/proposals/workbench-redesign/mockups/option-a.png` 与 `docs/pipeline/design.md`，用 360/768/1080/1440 多宽度、1280 截图与 1024 临界点复测；
3. 按 `docs/ACCEPTANCE.md` **批次 14** 逐项复测并回填 **9 条 blocked GUI 验收项**（4 条 pass 已认可，其中 GUI 残留部分也建议抽查）：
   - **长 tooltip 已修**：悬停需求摘要/修订行 → 原生 tooltip 只显示 ≤80 字摘要（不再整段 detail）；DOM/innerText 无整段 detail 全文区块（B1-A 口径仍成立）；
   - **摘要换行/多宽度无横向溢出**：360/768/1080/1440 均 `scrollWidth <= clientWidth+1`，长英文/URL/连续字符不撑破卡片；1080 为内容 max-width 上限；
   - **项目区 ≥1024 三列**（1440/1080 状态/团队/需求同行、各 1fr，需求卡不再单独占满行，与 option-a 一致）；**1024–701px 两列**（需求卡全宽）、**≤700px 单列**；按钮换行、团队 chips 2 列、列表限高滚动；**重点核对 1024–1100px 三列偏紧**（OBS-8）；
   - **修订记录默认折叠**：「修订记录 (N)」+ chevron，点击/Enter/Space 展开、`aria-expanded`/`aria-controls` 同步、展开最多 4 条不溢出、刷新恢复折叠；
   - **视觉更清爽**：浅灰蓝底 55% layer-2、白卡 1px 边框 + `0 1px 3px` 阴影 + 12 圆角、12–13px 标题层级、对比度 ≥4.5:1（非文本 ≥3:1）、无脏边/重影；
   - **回归批次 13 的 8 项 GUI**：三区分层、hero 三态与主操作、5 卡折叠/展开全部、fail 自动展开+红点、视觉规范、option-a、无障碍（aria/焦点/44px/reduced-motion）、响应式 ≤700 单列；
   - **功能回归**：流水线七阶段双复核、工作台指派器（卡/抽屉/状态卡）、验收台、交付包、变更审阅、运行中、编辑器标签右键菜单（关闭/关闭其他/关闭右侧/全部关闭/固定）正常；`.dsh/pipeline.json` 与 `.dsh/acceptance.json` 未被 UI 改写；
   - **自动化/版本**：`npm run check`、`npm run check:json`、`npm test`（31/31）、pipeline-selftest（38/38）、review-selftest（22/22）、assignments-selftest（27/27）、qa-static-v1277（STATIC PASS）均 exit 0；批次 14/CHANGELOG/双 1.2.77 一致；
4. 复测通过后由 Lead 执行 Git 提交，并在流水线面板记录本次 release（`pipeline_record_release`：environment=`local-workspace`，url=`http://127.0.0.1:3080`，notes 含版本/commit/自测/回滚 + 「纯客户端：重建 bundle + 强刷生效，Host 无需数据迁移」）。**模型不代 Owner 审批、不创建 Git 提交、不调用 Host 发布记录工具。**
5. **版本硬性规定**：本工作区约定交付后根 `package.json` +1，**本次发布 v1.2.77 完成后根版本 +1 至 1.2.78**（插件保持 1.2.77，由 Lead 在收尾时处理并在记录中说明）。

## 7. 遗留风险

1. **9 条 GUI/视觉/交互验收项未实测（blocked）**：tooltip 悬停/宽度溢出/3 列目视/修订折叠交互/视觉对比度 + 批次 13 遗留 8 项回归，均以 Owner 批次 14 为准（环境限制，非实现缺陷）；**Owner 回填前不得宣称 v1.2.77 已验收通过**。
2. **1024–1100px 三列偏紧**：宽屏三列在 1024 临界点可能拥挤（minmax/按钮换行/`min-width:0` 已兜底），需 Owner 用 1280 截图与 1024 临界点重点核对（OBS-8）。
3. **原生 tooltip 不可控**：浏览器/设备 tooltip 样式不可定制，已限 ≤80 字，完整需求走「查看完整需求」；流水线「变更记录」组件的长 tooltip（`ds-pipe-change-title`）不在本轮范围（OBS-7）。
4. **修订列表渲染上限**：最多渲染 4 条（原逻辑），label 的 N 为总数；`workbench.reqLog`/`workbench.requirement.logEmpty` 两个 i18n 键本轮无渲染使用（死键，OBS-2）。
5. **OBS 类剩余（非阻断）**：OBS-1 test-report 环境行「git 工作区仅 3 个改动文件」与最终 5 文件口径不符（建议下次修正）；OBS-3 product/design 本轮按「仅代码/配置调整」跳过，requirements/design 未更新（可接受，建议后续视觉类改动补设计确认）；OBS-4 `engineering-research.md` §8 仍标注 v1.2.76（N/A 仍适用，建议补一行 v1.2.77）；OBS-5 修订折叠头 `min-height:32px` 低于 44px 触控目标（本轮验收只要求 aria/键盘，不阻断，建议后续提到 44px）；OBS-6 `.dsh/review.json` 逐文件「已审」0/5 需 Owner 补标或知悉。
6. **回归面**：client.js 为定向修正（+68/−20，10 卡与标签菜单保留），但真实浏览器交互回归（指派器/验收台/交付包/审阅/运行中/标签菜单）仍需 Owner 按批次 14 抽查。
7. **回滚/运行态**：`.dsh/` 不在 Git，回滚代码不影响流水线/验收数据；按 §5 备份 `.dsh/pipeline.json`（及若存在的 `.dsh/agent-assignments.json`）。真实生产发布/SSH 工作区/深色主题沿用现状人工复测；无公网 URL（本地自托管）。

## 8. 审批与记录留痕 / 历史发布

- **双复核留痕**：`.dsh/pipeline.json` → `stages[acceptance].status="approved"`（`reviewedAt=2026-10-27T07:29:17.869Z`，PM 第 5 轮复核「建议放行/阻断 0」）；`stages[approval].status="approved"`（`reviewedAt=2026-10-27T07:32:55.807Z`，`reviews[0]={"decision":"approve","actor":"owner"}`，Owner 面板人工确认）；随后 `stages[release].status="active"`（`startedAt=2026-10-27T07:32:56.258Z`）。
- **模型边界遵守**：运维未审批、未改业务代码/需求/设计/验收结论、未创建 Git 提交、未调用 `pipeline_record_release`（Host 工具在子代理不可用，由 Lead 执行）。
- **历史发布**：
  - v1.2.76 工作台 UI 三区重构：commit `0d841f4`（基线 `97316d2`），24 个文件，自测 check + test 31/31 + pipeline 38/38 + review 22/22 + assignments 27/27；`releases` 已记录。
  - v1.2.75 工作台 Agent 指派器 MVP：commit `eff0c76`（基线 `322064c`），35 个文件，test 31/31 + pipeline 38/38 + review 22/22 + assignments 27/27；`releases` 已记录。
  - v1.2.73 团队三 Agent 能力升级：commit `0e764b2`（基线 `b3c1e77`），26 个文件；v1.2.72 双复核模式：commit `2d8c761`（基线 `a504f99`），30 个文件；`releases` 均已记录。
  - 本轮 v1.2.77 发布提交：commit `7bed396`（基线 `ddbd843`），7 个文件（+380/−324），自测 check + test 31/31 + pipeline 38/38 + review 22/22 + assignments 27/27 + qa-static-v1277 STATIC PASS；`releases` 已由 Lead 记录（environment=`local-workspace`，url=`http://127.0.0.1:3080`）。
- **交付后版本规则**：按工作区硬性规定「每次修改完成后根 `package.json` 版本 +1」，发布审批通过后由 Lead 提交 `chore` 将根从 1.2.77 升至 **1.2.78**（代表下一轮迭代号）；插件 `package.json` 保持本次发布的 1.2.77；下一轮发布时插件对齐 1.2.78。
