# 发布说明：交付区取消折叠（v1.2.78）

- 阶段：release（第 6 轮，运维 `opc-ops`）
- 环境：**local workspace / 自托管插件**（本工作区即发布产物；无公网 URL、无服务器上传、无 Docker 镜像）
- 本地访问入口：Dev Workspace GUI `http://127.0.0.1:3080`（本机回环地址，仅供本机验收，不是公网发布）
- 版本：`v1.2.78`（根 `package.json` 与 `dsh-web-filebrowser-plugin/package.json` 均为 1.2.78；`CHANGELOG.md` 顶部 `## 1.2.78 — 2026-10-27`）
- 发布基线：git HEAD `6ea6011`（`chore: 根 package.json 版本 +1 至 1.2.78（插件保持发布版 1.2.77）`；上一发布版 `7bed396` = v1.2.77）；本次 7 个文件为工作区未提交改动，**Git 提交由 Lead 执行**，提交后的 commit hash 以实际提交为准
- 发布时间 / 发布人：2026-10-27 15:52（Asia/Shanghai，`2026-10-27T07:52Z`） / 运维 agent `opc-ops`
- 前置闸门（硬闸门，已满足）：
  - `acceptance`（双复核第一关，项目经理 Agent）= **approved**，`reviewedAt = 2026-10-27T07:46:07.794Z`，报告 `docs/pipeline/acceptance-review.md`（第 6 轮）：**建议放行、阻断 0**（3 条 pass 静态证据认可；7 条 GUI blocked 为环境限制；专业质量 ③ 通过、①② 按 pipeline 记录 N/A）；
  - `approval`（双复核第二关，Owner 人工确认）= **approved**，`reviewedAt = 2026-10-27T07:51:33.067Z`，`reviews[0] = {decision:'approve', actor:'owner'}` —— **Owner 在 Dev Workspace 面板人工确认，模型未审批、未代批**；
  - `release` = **active**，`startedAt = 2026-10-27T07:51:33.395Z`；`gateMode = fast`、第 6 轮（`round=6`）、`roundScope=full`。

> 验收状态如实记录：v1.2.78 验收清单 **10 条 = 3 pass / 0 fail / 7 blocked**。7 条 blocked 均为 v1.2.76/v1.2.77 遗留的纯 GUI/视觉/无障碍/响应式项（三区分层、hero、视觉规范、option-a、无障碍、响应式、视觉清爽），属环境限制（本机无浏览器自动化），需 Owner **重启 Harness + 重建客户端 bundle + 强刷**后按 `docs/ACCEPTANCE.md` **批次 15** 复测回填；**在 Owner 回填前不得视为已验收通过**。v1.2.76 的 2 条折叠验收项（`b1c04ed3fb` 5 卡折叠、`576044e996` 失败自动展开）已随「取消折叠」作废并移出清单。

## 1. 发布内容（变更摘要）

- **纯客户端交付区取消折叠**：`dsh-web-filebrowser-plugin/client.js` **+10 / −182**，按 Owner「不要折叠」要求彻底移除交付区折叠：
  - 删除 fold state/handlers/JSX/aria（`workbenchFolds`/`workbenchFoldsClosed`/`foldDefinitions`/`foldAutoKeys`/`isFoldOpen`/`toggleFold`/`expandAllFolds`/`collapseAllFolds`）、「展开全部/收起全部」按钮、自动展开+红点逻辑、8 个 `workbench.fold.*` i18n 键与全部 fold CSS（`ds-wb-fold*` 零残留）；
  - 交付区改为 `.ds-wb-delivery-grid` **直接渲染 5 张原卡片**（设计稿 / 验收 / 交付前体检 / 本轮变更 / 运行中），卡内原内容与操作完整保留（打开设计稿/打开验收/导出报告/去处理/打开 Git/已审标记/打开任务）；失败/告警仍以卡内文字+颜色呈现；
  - 布局：`≥1024px` 两列（`repeat(2,minmax(0,1fr))`、gap 12、`align-items:start`、`min-width:0`）、`≤1023px` 单列；卡片标题完整不截断（无 nowrap/ellipsis）；项目流程（7 步）在 5 卡网格之前，区头保留（色条+图标+标题+hint，无展开全部动作）。
- **保留项**：三区结构（现在/项目/交付）、hero 当前阶段卡、需求摘要化（≤2 行 + tooltip ≤80 字 + 不直出全文）、项目区 `≥1024` 三列/`≤1023` 两列/`≤700` 单列、修订记录默认折叠、视觉规范（白卡/1px 边框/轻阴影/12 圆角/12–13px 标题）、既有 10 张工作台卡与编辑器标签右键菜单（Owner 标签菜单）均保留；`workbench.assign.*` 122 键未破坏。
- **范围边界**：**无 Host 改动**（`pipeline.js`/`review.js`/`acceptance.js`/`index.js`/`assignments.js` 本轮零改动）、**无新增运行时依赖**（依赖与 HEAD 逐字一致）、**无数据格式/迁移改动**；不新增模型工具/路由。
- **文档/记录**：`CHANGELOG.md` 1.2.78；`docs/ACCEPTANCE.md` 批次 15（含批次 13/14 保留项回归要求，并说明 v1.2.76 折叠项作废）；`docs/pipeline/test-report.md`（v1.2.78，10 条/3 pass/7 blocked、60+ 静态断言 STATIC PASS）；`docs/pipeline/acceptance-review.md`（第 6 轮复核报告）；本发布说明。本轮为 UI 交互移除，product/design 阶段按「仅代码/配置调整」跳过（无新需求/设计文档，记录在案 N/A）。

## 2. 发布前自测 gate（发布前最后一次执行，2026-10-27 15:52 CST）

| # | 命令 | 退出码 | 耗时 | 结果 |
|---|---|---|---|---|
| 1 | `npm run check` | **0** | 622 ms | **21 个模块** `node --check` 全过（含 client.js +10/−182） |
| 2 | `npm test`（`node scripts/selftest/host-smoke.mjs`） | **0** | 707 ms | **PASS: 31/31 host smoke checks** |
| 3 | `node .dsh/tmp/team/pipeline-selftest.mjs` | **0** | 671 ms | **38/38 checks passed**（七阶段双复核回归） |
| 4 | `node .dsh/tmp/team/review-selftest.mjs` | **0** | 779 ms | **22/22 checks passed** |
| 5 | `node .dsh/tmp/team/assignments-selftest.mjs` | **0** | 155 ms | **27/27 checks passed**（指派器回归） |

- 工具版本：Node **v24.22.0**、npm **11.19.1**；**无安装/构建步骤**（纯 JS 插件）；无锁文件改动。
- 验收清单：**10 条 = 3 pass / 0 fail / 7 blocked**（blocked 为 GUI 环境项，见上）；验收复核（PM 第 6 轮）与 QA 测试报告均记录「建议放行/通过，阻断 0」。
- 复测/复核依据：`docs/pipeline/test-report.md`、`docs/pipeline/acceptance-review.md`、`.dsh/evidence/acceptance-retest-v1.2.78.log`（QA/PM 另跑 `npm run check:json` 与 `qa-static-v1278`（60+ 断言）均 exit 0；qa-static 1 条非阻断观察 OBS-1）。

## 3. 产物清单与校验

发布产物 = 工作区文件快照（无 zip / 无独立构建产物；按宪章 §5，`.dsh/` 运行状态不进 Git）。

- **Git 现状（本报告写入前）**：`git status --short` = **6 个已跟踪修改、0 个新建未跟踪**；`git diff --stat` = 6 files changed, **+197 / −349**；另加本报告（重写上一轮 v1.2.77 记录），交付清单共 **7 个文件（均为已跟踪修改）**。
- **客户端代码（1）**：`dsh-web-filebrowser-plugin/client.js`（**+10 / −182**：移除交付区折叠全部 state/handlers/JSX/aria/按钮/8 个 i18n 键/CSS；新增 `.ds-wb-delivery-grid` 直接渲染 5 卡、两列/单列媒体查询）
- **版本（1）**：`dsh-web-filebrowser-plugin/package.json`（version 1.2.77→1.2.78，仅 1 行；`dependencies`/`files` 未动）；根 `package.json` 版本已在 HEAD 预置 1.2.78、工作区无改动
- **文档（4）**：`CHANGELOG.md`（1.2.78 段）、`docs/ACCEPTANCE.md`（批次 15）、`docs/pipeline/test-report.md`、`docs/pipeline/acceptance-review.md`
- **本报告（1）**：`docs/pipeline/release.md`（本文件，替换 v1.2.77 记录；历史见 §8）
- **依赖/边界核对**：根 `dependencies` = `{"ssh2":"^1.17.0"}`；插件 `dependencies` = `{"@xterm/addon-fit":"^0.10.0","@xterm/xterm":"^5.5.0","ssh2":"^1.17.0"}`；与 HEAD `6ea6011` **逐字一致**，无 `package-lock.json`；**git diff 不含任何 Host 模块**；无新增模型工具/路由；无数据格式或 `.dsh/` 文档改动；无新建未跟踪文件。
- **关键文件 SHA256**（可复现校验，`sha256sum`）：

```text
d237db32038f84d47652de8a97695d5b754b5f8bafa96b38c452b47a93d4bfec  dsh-web-filebrowser-plugin/client.js
4406cb24a82b5afdc14780359bd8fb4472914db1271c86cc214c9d57661e93b8  dsh-web-filebrowser-plugin/package.json
c87dc858c53f52b4393551bb0099b50956767720801fd381f7d4a0140d628d01  package.json
ce3bb31a10e8535c1bdde84af6cf33837ebb82681cc82589318fe5661567939c  docs/pipeline/test-report.md
9d838835cde3c9f7197d084d6fc7a51498b26bfb011bee90d5733d935e2d6f68  docs/pipeline/acceptance-review.md
7691bf076a604f19ca002337e3aa0202b1fa9c2d2028dcd09cee2adb336efa62  docs/ACCEPTANCE.md
8f16a1b3b2ce313b8608376644895f342c9d85f58fe5fb135748e53f03cec617  CHANGELOG.md
```

- **一致性/安全核对**：改动清单与本轮交付一致（客户端 1 + 版本 1 + 文档 4 + 本报告），无超范围改动；新增行密钥扫描 **0 命中**；无调试代码（`console.log`/`debugger` 0 新增）、无 `innerHTML`/`dangerouslySetInnerHTML` 新增、无临时文件；`.dsh/` 已被 `.gitignore` 忽略（`git ls-files .dsh` = 0）；无 `.env`/证书/私钥；`git diff --check` 干净；5 卡原内容/事件与标签右键菜单保留。

## 4. 发布方式与生效条件（重要）

- 本插件为**工作区自托管**：发布动作 = 工作区代码/文档即产物。本轮为**纯客户端改动**，生效方式：
  - **重建客户端 bundle + 强刷页面**后生效（`client.js` 是唯一代码改动点，无 Host 模块/无新 op/无数据迁移）；
  - 为排除旧 bundle 缓存与对照准确，**建议先重启 Harness**（Host 无需更新，但重启可确保加载最新客户端产物）→ 重建 bundle → 强刷；
  - 取消折叠后工作台页面比 v1.2.77 **更长（5 卡全部展开）属预期**，非缺陷；保留的「修订记录 (N)」折叠（需求修订列表）与团队指派卡既有展开/收起不受影响。
- 无公网发布、无预览分享、无交付 zip：本轮发布目标仅为本地工作区插件升级；客户交付包/分享链接由 Lead/Owner 按需另行决定。

## 5. 回滚方式

- 上一版本：**v1.2.77**（发布提交 `7bed396`；当前 HEAD `6ea6011` 仅把根 `package.json` +1 至 1.2.78，插件版本与功能代码仍为 v1.2.77）。当前发布基线 = HEAD `6ea6011`。
- 方式 A（推荐，保留历史）：`git revert <本次 release commit>` → 重建客户端 bundle → 强刷（Host 无改动，重启可选），回滚后恢复 v1.2.77 的交付区折叠交互。
- 方式 B（丢弃式）：`git reset --hard 7bed396` → 重建 bundle → 强刷；如需撤销根版本预置也一并回到 v1.2.77 发布态。
- 生效前提：**客户端代码回退后必须重建 bundle / 强刷**（否则浏览器仍执行旧 bundle）；Host 无需重启、无数据迁移。
- **回滚前备份运行态**（`.dsh/` 不进 Git，`git reset/revert` 不会回退它们）：`.dsh/pipeline.json`（流水线/验收/审阅状态）；若已有工作台指派记录（`.dsh/agent-assignments.json`），一并备份。
- 预计耗时 < 2 分钟；无数据库/数据迁移、无依赖变更；风险低（纯 UI 交互移除，Host/数据零改动）。

## 6. 发布后验证（Owner 执行）

1. **重启 Harness → 重建客户端 bundle → 强制刷新页面**；
2. 对照 `docs/proposals/workbench-redesign/mockups/option-a.png`，在 1440/1280/1024/768/360 宽度复测；
3. 按 `docs/ACCEPTANCE.md` **批次 15** 逐项复测并回填 **7 条 blocked GUI 验收项**（3 条新项已 pass/静态认可，其中视觉部分建议抽查）：
   - **无折叠交互**：交付区不存在「展开全部/收起全部」按钮、折叠行、chevron、`aria-expanded` 折叠逻辑；页面无「展开/收起」交付区文案；原 `.ds-wb-fold*` 样式已移除；
   - **5 卡直接可见**：设计稿/验收/交付前体检/本轮变更/运行中 5 卡完整内容直接展示（不再是折叠头）；卡内原操作齐全（打开设计稿/验收/导出报告/去处理/打开 Git/已审/打开任务）；失败/告警以卡内文字+颜色呈现；
   - **布局两列/单列**：≥1024px 两列、≤1023px 单列；卡片间距 12–16px、无横向溢出；标题完整不截断（「交付前体检」不得显示为「交付…」）；**重点核对 1024–1100px 两列偏窄**；
   - **顺序与位置**：交付区仍在「现在/项目」之后；区头保留（色条+图标+标题+hint，无展开全部动作）；项目流程 7 步在 5 卡之前；5 卡顺序 设计稿→验收→交付前体检→本轮变更→运行中；
   - **页面高度预期**：取消折叠后页面比 v1.2.77 更长（5 卡全展开）为预期；确认滚动/首屏仍可接受，无异常空白；
   - **视觉一致**：白卡 + 1px 边框 + 轻阴影 + 12 圆角与批次 14 一致；标题 12–13px 层级清晰；对比度 ≥4.5:1（非文本 ≥3:1）；与 option-a 的两列/单列布局一致；
   - **保留项无回归**：三区分层/空态、hero 三态与主操作、需求摘要（≤2 行、tooltip ≤80 字、不直出全文）、项目区三列/两列/单列、修订记录默认折叠、指派器（卡/抽屉/状态卡）、验收台、交付包、流水线七阶段与双复核、编辑器标签右键菜单（关闭/关闭其他/关闭右侧/全部关闭/固定）；
   - **自动化/版本**：`npm run check`、`npm run check:json`、`npm test`（31/31）、pipeline-selftest（38/38）、review-selftest（22/22）、assignments-selftest（27/27）、qa-static-v1278（STATIC PASS）均 exit 0；批次 15/CHANGELOG/双 1.2.78 一致；
4. 复测通过后由 Lead 执行 Git 提交，并在流水线面板记录本次 release（`pipeline_record_release`：environment=`local-workspace`，url=`http://127.0.0.1:3080`，notes 含版本/commit/自测/回滚 + 「纯客户端：重建 bundle + 强刷生效，Host 无需数据迁移」）。**模型不代 Owner 审批、不创建 Git 提交、不调用 Host 发布记录工具。**
5. **版本硬性规定**：本工作区约定交付后根 `package.json` +1，**本次发布 v1.2.78 完成后根版本 +1 至 1.2.79**（插件保持 1.2.78，由 Lead 在收尾时处理并在记录中说明）。

## 7. 遗留风险

1. **7 条 GUI/视觉/无障碍/响应式验收项未实测（blocked）**：5 卡直接展示/两列单列/标题完整/页面变长/视觉对比度/无障碍/视口，均以 Owner 批次 15（含批次 13/14 保留项回归）为准（环境限制，非实现缺陷）；**Owner 回填前不得宣称 v1.2.78 已验收通过**。
2. **页面高度增加**：取消折叠后 5 卡全部展开，工作台比 v1.2.77 更长，属需求预期；Owner 需确认滚动/首屏可接受、无异常空白。
3. **1024–1100px 两列偏窄**：≥1024px 即切两列，1024–1100px 临界区间卡片可能偏窄（`minmax(0,1fr)`/`min-width:0` 兜底），需 Owner 重点核对 1024/1280 截图。
4. **OBS 类剩余（非阻断）**：OBS-1 删除 fold CSS 后残留空 `@media (max-width:1023px){}` 死块（无功能影响，建议下次清理）；OBS-2 词典仍有 2 个 v1.2.77 遗留死键 `workbench.reqLog`/`workbench.requirement.logEmpty`（无渲染引用，建议清理或启用空态）；OBS-3 `test-report.md` 环境行「git 工作区仅 3 个改动文件」与实际 5 个不符（计数口径待修正）；OBS-4 验收项 `47d54ee97e` 仍写「折叠 aria-expanded/aria-controls」旧口径（该部分已随取消折叠作废，建议下次更新条目文字）；OBS-5 需求「不折叠任何其他内容」/批次 15「页面无『展开/收起』文案」与保留项（修订记录折叠、团队指派卡既有展开/收起）存在字面冲突，本轮按「仅交付区取消折叠」实现（建议 Lead/Owner 明确豁免口径）；OBS-6 product/design 阶段跳过、requirements/design 未更新本轮、`engineering-research.md` §8 仍标注 v1.2.76（N/A 仍适用，建议补逐轮记录）；OBS-7 `.dsh/review.json` 逐文件「已审」0/5 需 Owner 补标或知悉。
5. **回归面**：client.js 为纯删除 + 交付网格新增（+10/−182），5 卡原渲染函数/内容/事件保留，但真实浏览器交互回归（指派器/验收台/交付包/审阅/运行中/标签菜单/修订折叠）仍需 Owner 按批次 15 抽查。
6. **回滚/运行态**：`.dsh/` 不在 Git，回滚代码不影响流水线/验收数据；按 §5 备份 `.dsh/pipeline.json`（及若存在的 `.dsh/agent-assignments.json`）。真实生产发布/SSH 工作区/深色主题沿用现状人工复测；无公网 URL（本地自托管）。

## 8. 审批与记录留痕 / 历史发布

- **双复核留痕**：`.dsh/pipeline.json` → `stages[acceptance].status="approved"`（`reviewedAt=2026-10-27T07:46:07.794Z`，PM 第 6 轮复核「建议放行/阻断 0」）；`stages[approval].status="approved"`（`reviewedAt=2026-10-27T07:51:33.067Z`，`reviews[0]={"decision":"approve","actor":"owner"}`，Owner 面板人工确认）；随后 `stages[release].status="active"`（`startedAt=2026-10-27T07:51:33.395Z`）。
- **模型边界遵守**：运维未审批、未改业务代码/需求/设计/验收结论、未创建 Git 提交、未调用 `pipeline_record_release`（Host 工具在子代理不可用，由 Lead 执行）。
- **历史发布**：
  - v1.2.77 工作台 UI 修正：commit `7bed396`（基线 `ddbd843`），7 个文件，自测 check + test 31/31 + pipeline 38/38 + review 22/22 + assignments 27/27；`releases` 已记录。
  - v1.2.76 工作台 UI 三区重构：commit `0d841f4`（基线 `97316d2`），24 个文件；v1.2.75 工作台 Agent 指派器 MVP：commit `eff0c76`（基线 `322064c`），35 个文件；v1.2.73 团队三 Agent 能力升级：commit `0e764b2`（基线 `b3c1e77`），26 个文件；v1.2.72 双复核模式：commit `2d8c761`（基线 `a504f99`），30 个文件；`releases` 均已记录。
  - 本轮 v1.2.78 发布提交：commit `a2797dc`（基线 `6ea6011`），7 个文件（+261/−417），自测 check + test 31/31 + pipeline 38/38 + review 22/22 + assignments 27/27 + qa-static-v1278 STATIC PASS；`releases` 已由 Lead 记录（environment=`local-workspace`，url=`http://127.0.0.1:3080`）。
- **交付后版本规则**：按工作区硬性规定「每次修改完成后根 `package.json` 版本 +1」，发布审批通过后由 Lead 提交 `chore` 将根从 1.2.78 升至 **1.2.79**（代表下一轮迭代号）；插件 `package.json` 保持本次发布的 1.2.78；下一轮发布时插件对齐 1.2.79。
