# 测试报告：七阶段双复核（v1.2.72）

- 阶段 testing ｜ 2026-10-26 ｜ QA `opc-qa` ｜ 需求：七阶段双复核模式 —— 新增项目经理 Agent「验收复核」关
- 环境：工作区 `/data/dsh/home/dsh-web-powerfilebrowser/dsh-web-filebrowser`；Linux；Node **v24.22.0**；npm **11.19.1**；Git HEAD **a504f99**（工作区含 22 项未提交改动，均为本轮交付内容）
- 版本：根 `package.json` **1.2.72**、`dsh-web-filebrowser-plugin/package.json` **1.2.72**、`CHANGELOG.md` 含 `## 1.2.72` 段落
- 流水线状态（`.dsh/pipeline.json`，gateMode=fast）：product/design/development = approved，**testing = active**，acceptance/approval/release = pending。说明：运行中的 Host 仍是升级前代码，落盘文档为旧 **6 关**；用新 `pipeline.js` 读取时会归一化为 **7 关**（acceptance pending），重启 Harness 后生效（OBS-01 已于 15:41 更正）。
- **结论：通过**。4 套自动化命令全部 exit 0；v1.2.72 的 12 条验收项 **12/12 pass**；无 v1.2.72 失败项；既有的 1 条 blocked 项（批次 5 GUI 复测，Owner 执行）保持不动。剩余风险：Host 改动需重启 Harness 生效，客户端 7 关/双复核的浏览器实际显示需 Owner 按 `docs/ACCEPTANCE.md` 批次 10 人工复测。

## 1. 范围

- 覆盖 `.dsh/acceptance.json` 中 v1.2.72 的 **12 条验收项**：7 阶段顺序与跳关拒绝、acceptance 角色/提示词/handbook/dispatch、normal 闸门（通过+打回）、fast 五中间阶段自动而 approval/release 永远人工、旧 6 阶段三种迁移、变更轮 scope、客户端中英文 7 关与双复核文案、systemPrompt/工具文案、命令全绿、文档与版本一致。
- 被测文件：`dsh-web-filebrowser-plugin/pipeline.js`、`client.js`、`review.js`、`locale/zh.json`、`locale/en.json`、`docs/AGENT_TEAM.md`、`docs/PLAYBOOK.md`、`docs/opc/*`、`README*.md`、`CHANGELOG.md`、`docs/ACCEPTANCE.md`、根与插件 `package.json`。
- 测试代码：`scripts/selftest/host-smoke.mjs`（`npm test`，17 用例）、`.dsh/tmp/team/pipeline-selftest.mjs`（36 用例）、`.dsh/tmp/team/review-selftest.mjs`（22 用例，经 Lead 口头授权扩展）。
- 不测（沿用现状 / Owner 人工复测）：真实发布动作与生产环境；SSH 远程工作区的流水线/验收（不支持）；浏览器 DOM 的实际渲染、深色主题与 260px 窄侧栏视觉（见第 8 节剩余风险）。

## 2. 命令与结果（最终一次执行，2026-10-26T07:31Z）

| # | 命令 | 目的 | 退出码 | 耗时 | 通过数 / 总数 | 结论 |
|---|---|---|---|---|---|---|
| 1 | `npm run check` | 20 个模块 `node --check` 语法检查 | **0** | 504 ms | 20/20 文件 | PASS |
| 2 | `npm test`（`node scripts/selftest/host-smoke.mjs`） | Host smoke：工具/路由、验收证据链、7 阶段/迁移/scope/fast/prompt | **0** | 567 ms | **17/17** | PASS |
| 3 | `node .dsh/tmp/team/pipeline-selftest.mjs` | 流水线模块深测（顺序/跳关/迁移/scope/fast/工具文案） | **0** | 684 ms | **36/36** | PASS |
| 4 | `node .dsh/tmp/team/review-selftest.mjs` | 变更审阅模块（含 acceptance 基线/已审） | **0** | 776 ms | **22/22** | PASS |
| 5 | `node --check dsh-web-filebrowser-plugin/client.js` | 客户端语法（单独复核） | **0** | 43 ms | — | PASS |

关键输出末尾：

```text
npm test                     → PASS: 17/17 host smoke checks
pipeline-selftest            → 36/36 checks passed
review-selftest              → 22/22 checks passed
npm run check                → 无错误（exit 0）
node --check client.js       → 无错误（exit 0）
```

## 3. 静态检查

### 3.1 「六阶段 / 六关 / six-stage」残留分类

| 范围 | 命中数 | 结论 |
|---|---|---|
| 现行代码：`pipeline.js` / `client.js` / `review.js` / 其余插件 JS / `locale/*.json` / `index.js` / `dsh-web-filebrowser-io` / `dsh-web-filebrowser-git` / `README*.md` / 插件 README | **0** | PASS |
| 现行文档：`docs/AGENT_TEAM.md` L74/L104（旧版本迁移说明）、`docs/PLAYBOOK.md` L205（「旧版本六阶段项目怎么办」FAQ）、`docs/opc/00-charter.md` L105（v1.2.33 版本历史） | 4 处「六阶段」，均明确指向**旧版本/历史事实** | 可接受（历史说明） |
| 本轮文档：`docs/ACCEPTANCE.md`（批次 4/6/9 历史标注、批次 10 说明）、`docs/pipeline/requirements.md`（需求背景与旧→新差异）、`docs/pipeline/design.md`（对照实现注意点） | 均为「旧→新」「历史批次」语境 | 可接受（历史背景） |
| `CHANGELOG.md` | 9 处，历史版本记录 | 可接受（历史事实，规格明确允许） |
| `.dsh/` 运行时文件（`.dsh/pipeline.json`、`.dsh/acceptance.json`、`.dsh/tmp/*`） | 有，但属本地运行状态/工作草稿，不进 Git、不随交付 | 不计入 |

命令：`grep -rn "六阶段\|六关\|six-stage\|six stages" <scope>`；现行三文件单独复核结果 `pipeline.js:0 client.js:0 review.js:0`。

### 3.2 客户端中英文 locale 键

- `client.js` 内 `zh` / `en` 词典各 **1052** 个键，**0 缺失、0 单向**（`missing in en: 0`，`missing in zh: 0`）。
- 新增/变更键均中英文成对存在：`pipeline.stage.acceptance`、`pipeline.role.acceptance`、`pipeline.tag.ai`、`pipeline.tag.human`、`pipeline.fastHint`、`pipeline.approvalReady`、`pipeline.approvalWaiting`、`pipeline.hint`、`pipeline.stage.approval`、`pipeline.role.approval`、`workbench.reqScope.*`、`todo.dispatchChangeMessage`。
- 两处视图均已补 acceptance：工作台 `stageTitles` L16391 / `roleLabels` L16423，流水线 `roleLabels` L17492 / `stageTitles` L17501；默认阶段数 `stages.length === 0 ? 7`（L16385）；双复核标签 L17621-17623、`approvalWaiting` L17639、`approvalReady` L17647；`buildIntakePrompt` 已改为五阶段并补 acceptance（L10070/10073）。
- `locale/zh.json`、`locale/en.json` 插件描述均为「七阶段双复核 / seven-stage dual-review」。
- 中文界面无「六阶段/六关」、英文无「six-stage/six stages」（见 3.1）。
- 非阻断观察：`git.retry`、`git.noCommits` 在 zh/en 词典各重复出现 2 次；核对 `git show HEAD:dsh-web-filebrowser-plugin/client.js` 确认 HEAD 中同样重复，**为本轮之前既有现象，非本版本引入**，不影响行为（后出现的键覆盖前值），建议后续清理。

### 3.3 版本与文档一致性

- 根 `package.json` = **1.2.72**；`dsh-web-filebrowser-plugin/package.json` = **1.2.72**（已对齐）。
- `CHANGELOG.md` 含 `## 1.2.72 — 2026-10-26`（L5）。
- `docs/opc/05-review.md` 新增存在；`docs/opc/06-ops.md` 存在；现行代码/文档中「05-ops.md」旧引用 0（仅 requirements/ACCEPTANCE 历史说明提及改名）。
- `docs/pipeline/requirements.md`、`docs/pipeline/design.md`（含 4 张 `docs/pipeline/design/*.svg`）、`docs/pipeline/test-report.md` 齐全；`docs/ACCEPTANCE.md` 含批次 10。
- 模型工具数/路由数未变：36 tools / 10 routes（`npm test` 第一用例断言通过）。

## 4. 用例与结果

### 4.1 `npm test`（host-smoke，17/17 PASS）

新增/更新 10 个用例（其余 7 个为既有回归用例）：

| # | 用例 | 结果 |
|---|---|---|
| 1 | `pipeline constants expose seven stages in dual-review order`（7 阶段顺序、acceptance 定义、approval roleTitle「项目经理（你）」、emptyPipeline 7 关） | PASS |
| 2 | `stage order gate rejects skipping into acceptance/approval/release`（testing→acceptance、acceptance→approval、approval→release 均 bad-order；伪造 release review 的 approve 也被拒） | PASS |
| 3 | `normal mode acceptance review moves to review then approves and unlocks approval` | PASS |
| 4 | `acceptance rejection fails the gate and keeps approval/release locked`（failed→重新开始保留备注→再提交通过） | PASS |
| 5 | `fast mode auto-approves five intermediate stages, acceptance next is approval`（acceptance `nextStageId='approval'`；approval/release 不自动） | PASS |
| 6 | `legacy six-stage document with all stages pending migrates acceptance to pending` | PASS |
| 7 | `legacy in-progress document keeps acceptance pending and blocks bypassing it` | PASS |
| 8 | `legacy completed document migrates acceptance to approved with the migration note`（note 精确含「升级迁移：验收复核为更新新增，旧流程已完成」；complete=true；可发起变更轮） | PASS |
| 9 | `change round scopes include or skip acceptance correctly`（full/development 执行 acceptance；release/product/design/product-design 跳过并写跳过备注） | PASS |
| 10 | `acceptance dispatch and prompt wording describe the seven-stage dual review`（handbooks 含 `docs/opc/05-review.md`；release handbook=`docs/opc/06-ops.md`；PIPELINE_SECTION/工具描述无六阶段、stageId 枚举含 acceptance） | PASS |

### 4.2 `pipeline-selftest`（36/36 PASS）

新增/更新用例：

| # | 用例 | 结果 |
|---|---|---|
| 1 | `exports: constants, fixed stage order and empty document`（7 阶段/acceptance 定义/角色标题） | PASS |
| 2 | `empty workspace reads as a pending pipeline without creating files`（total=7、pending=7） | PASS |
| 3 | `stage order gate blocks skipping ahead`（含提前启动 acceptance/approval 拒绝） | PASS |
| 4 | `acceptance is the missing gate: testing → acceptance → approval → release` | PASS |
| 5 | `a rejected acceptance review becomes failed and keeps the other gates locked` | PASS |
| 6 | `full seven-stage flow reaches complete with the dual-review gates`（7 关全通过、approved=7） | PASS |
| 7 | `approval is the only stage reviewed directly while active, and it gates release`（索引改为 acceptance=4/approval=5/release=6） | PASS |
| 8 | `stored documents are normalized to the fixed seven-stage shape`（旧文档补 acceptance=pending；索引 4/6） | PASS |
| 9 | `stage prompts carry requirement, upstream context, boundaries and gate rules`（新增 acceptance prompt：5/7、验收复核、acceptance-review.md、建议放行/打回） | PASS |
| 10 | `release prompt states the approval precondition`（已修正前置：先 acceptance approved 再 start approval；含「验收复核」） | PASS |
| 11 | `registerPipelinePrompt registers guidance right after acceptance`（双复核/acceptance/七阶段、无六阶段） | PASS |
| 12 | `fast mode auto-approves the five intermediate stages and keeps approval/release manual` | PASS |
| 13 | `change rounds can skip stages by scope`（development 跳过 product/design；release 跳过前 5 关） | PASS |
| 14 | `change round scopes include or skip acceptance correctly`（release scope 跳过列表精确为 product/design/development/testing/acceptance，approval+release 仍执行） | PASS |
| 15 | `restartStage resets the chosen stage and everything after it`（重置列表含 acceptance） | PASS |
| 16 | `old six-stage document (all pending / in progress / completed) migrates …`（3 个迁移用例） | PASS |
| 17 | `acceptance dispatch, handbooks and seven-stage wording are complete`（role/roleTitle/title、05-review/06-ops handbook、工具描述无六阶段、stageId 枚举、PIPELINE_SECTION） | PASS |

### 4.3 `review-selftest`（22/22 PASS）

| # | 用例 | 结果 |
|---|---|---|
| 1 | `review exports constants, empty document and file path`（`REVIEW_STAGE_IDS` 断言改为 7 阶段，acceptance 在 testing 与 approval 之间） | PASS |
| 2 | `acceptance stage baseline is captured, readable and markable`（新增：git 仓库中 `captureStageBaseline({stageId:'acceptance',round:1})` 成功 → `readReviewState` 读到 acceptance baseline（stageId/round/文件列表）→ `markReviewed` 写入后 reviewed=1；写文件在 capture 之后，正确验证「基线后变更」） | PASS |
| 3 | 其余 20 个既有用例（基线/过滤/已审失效/清空/并发/非 Git/SSH/子目录/输入校验/8 个 pipeline 工具/警告/审阅历史等） | PASS |

## 5. 12 条 v1.2.72 验收项逐条对照

| # | 验收项 id | 验收项（结论式） | 结论 | 证据（命令 / 文件 / 用例） |
|---|---|---|---|---|
| 1 | `fc83e580b0` | 流水线恰好 7 阶段且顺序固定，跳关启动一律被拒 | **pass** | `pipeline-selftest`「exports/constants」「stage order gate」「acceptance is the missing gate」；`npm test`「pipeline constants expose seven stages」「stage order gate rejects skipping…」；`PIPELINE_STAGES` 顺序 product→design→development→testing→acceptance→approval→release |
| 2 | `6038edf94f` | acceptance 关角色为「项目经理 Agent」，提示词、handbook 与 dispatch 完整 | **pass** | `pipeline-selftest`「stage prompts carry…」「acceptance dispatch, handbooks and seven-stage wording」；`npm test`「acceptance dispatch and prompt wording…」；handbooks=`docs/opc/05-review.md`+`00-charter.md`，交付物 `docs/pipeline/acceptance-review.md` |
| 3 | `03198a4859` | normal 模式下 acceptance 提交进入待评审，Owner 可通过/打回 | **pass** | `pipeline-selftest`「acceptance is the missing gate」「a rejected acceptance review…」「full seven-stage flow…」；`npm test`「normal mode acceptance review…」「acceptance rejection…」；review→approved、reject→failed 并可重开 |
| 4 | `f5b747a94c` | fast 模式下五个中间阶段自动通过，approval 与 release 永不自动 | **pass** | `pipeline-selftest`「fast mode auto-approves the five intermediate stages…」；`npm test`「fast mode auto-approves five intermediate stages…」；acceptance `autoApproved=true,nextStageId=approval`，release 提交保持 review、approval 需人工 |
| 5 | `9ccd30799a` | 旧 6 阶段文档（全 pending）升级后自动补 acceptance 且不报错 | **pass** | `pipeline-selftest`「old six-stage document (all pending)…」；`npm test`「legacy six-stage document with all stages pending…」；读后 7 关、acceptance=pending、幂等无重复 |
| 6 | `42091c8a72` | 旧 6 阶段文档（进行中）升级后 acceptance 待开始且不可绕过 | **pass** | `pipeline-selftest`「old six-stage document (in progress) cannot bypass acceptance」；`npm test`「legacy in-progress document…」；start approval → bad-order，start acceptance 可执行 |
| 7 | `6cb4e1a339` | 旧 6 阶段文档（旧已完成）迁移后 acceptance 为 approved 并带迁移备注 | **pass** | `pipeline-selftest`「old completed six-stage document…」；`npm test`「legacy completed document…」；note=`升级迁移：验收复核为更新新增，旧流程已完成`，complete=true 且可发起变更轮 |
| 8 | `606837da2a` | 变更轮 scope 正确：full/development 执行 acceptance，release 等按语义跳过 | **pass** | `pipeline-selftest`「change rounds can skip stages by scope」「change round scopes include or skip acceptance correctly」；`npm test`「change round scopes include or skip acceptance correctly」；release 跳过列表精确为 product/design/development/testing/acceptance |
| 9 | `31bc93d8a4` | 客户端中英文均显示 7 关与双复核文案，验收复核卡可启动派发/通过/打回 | **pass** | 静态验证：`client.js` 中英文词典 1052/1052 键、0 缺失；`pipeline.stage/role.acceptance`、`tag.ai/human`、`fastHint`、`approvalReady/Waiting` 双语齐备；两处视图 stageTitles/roleLabels 含 acceptance（L16391/16423/17492/17501），默认阶段数 7（L16385）；`node --check client.js` exit 0；grep 六阶段=0。运行时 UI 见剩余风险（Owner 按 ACCEPTANCE 批次 10 复测） |
| 10 | `33b2dc26ed` | systemPrompt 与工具描述为 7 阶段双复核，pipeline_status 显示 7 关与计数 | **pass** | `pipeline-selftest`「acceptance dispatch…wording」「registerPipelinePrompt…」；`npm test`「acceptance dispatch and prompt wording…」；PIPELINE_SECTION 含七阶段/双复核/五中间阶段、无六阶段；工具 stageId 枚举含 acceptance；`pipeline_status` 描述 seven-stage、stage 数 7 |
| 11 | `9a42a68dbd` | npm run check、npm test、pipeline-selftest 全绿且无既有功能回归 | **pass** | 第 2 节：`npm run check` exit 0；`npm test` 17/17；`pipeline-selftest` 36/36；另加 `review-selftest` 22/22；既有 host-smoke/selftest 回归用例全部通过 |
| 12 | `76e8476c8d` | 文档与版本号 1.2.72 一致齐全，无「六阶段」残留 | **pass** | 根/插件 `package.json` 均 1.2.72；`CHANGELOG.md` 1.2.72；`docs/opc/05-review.md` 新增、`06-ops.md` 改名；`docs/ACCEPTANCE.md` 批次 10；现行代码六阶段残留 0（历史 CHANGELOG/requirements 背景/旧批次说明可接受，见 3.1） |

**合计：pass 12 / fail 0。** 原有 blocked 项 `3ffcb9eebb`（批次 5 GUI 复测，Owner 执行）保持 blocked 与历史不动。

## 6. 回归范围与结果

- `npm test` 既有用例（7 个）：apply() 工具 36/路由 10、子注册工具集、验收证据链、Git 审阅降级/基线、交付包证据、流水线产物 warnings、表单/验收更新——全部 PASS。
- `pipeline-selftest` 既有用例（26 个）：常量/空工作区/需求校验/跳关/打回重开/approval 闸门/边界/发布记录/损坏文档/归一化/并发锁/prompt/工具/SSH 拒绝/提示词 section/变更轮/需求日志/scope/restartStage/symlink——全部 PASS（其中 6 阶段断言按 7 阶段更新）。
- `review-selftest` 既有 21 个用例全部 PASS；新增 acceptance 基线用例 PASS（同时验证 dev 对 `review.js` 的修复：`REVIEW_STAGE_IDS` 已含 acceptance，acceptance 启动不再出现 bad-stage）。
- 代码改动范围核对：pipeline.js / client.js / review.js 仅由 development 修改；QA 只改测试与文档（task-4 write scope + Lead 口头授权的 `review-selftest.mjs`），未改业务代码、未审批、未创建 git 提交。

## 7. 失败 / 缺陷 / 阻塞

| ID | 标题 | 严重度 | 状态 | 说明 |
|---|---|---|---|---|
| — | v1.2.72 功能缺陷 | — | **无** | 12 条验收项 0 fail；4 套命令全绿 |
| DEF-01（已修复） | `review.js` 的 `REVIEW_STAGE_IDS` 缺 `acceptance`，acceptance 启动时 `captureStageBaseline` 抛 `bad-stage` 被吞（仅 console.error），验收复核轮无「本轮变更」基线 | P1（复核输入缺失，不影响状态写） | **已修复并复测通过** | QA 在阶段 1 发现 → Lead 加派 dev 修复（`REVIEW_STAGE_IDS` 7 阶段）→ `review-selftest` 22/22 + 新增 acceptance baseline 用例通过；`startStage('acceptance')` 不再有 stderr 错误 |
| OBS-01（非阻断） | `client.js` 中英文词典各存在 2 个重复键（`git.retry`、`git.noCommits`） | P3 | 观察项（非本轮引入） | `git show HEAD:...client.js` 确认 HEAD 已重复；后值覆盖前值、行为无影响，建议后续清理 |
| BLOCKED（既有） | 批次 5 GUI 复测（重启 Harness 后 Owner 执行） | — | 保持 blocked | 原 note/history 未改动；与 v1.2.72 无关 |
| 待 Owner 人工 | 批次 10 双复核 GUI 复测（7 关显示、中英文、normal/fast 交互、迁移 UI） | — | 交付后人工步骤 | 已写入 `docs/ACCEPTANCE.md` 批次 10；QA 子代理环境无浏览器/Host 重启权限 |

## 8. 剩余风险

1. **Host 改动需重启 Harness 才生效**（acceptance 阶段、迁移逻辑、七阶段 prompt/工具文案）；客户端 7 关文案需刷新/重建 bundle。未重启时会看到旧行为，易误判实现失败。自动化只覆盖模块 API 与静态文件。
2. **UI 实际渲染未由 QA 浏览器实测**：第 9 条验收项以静态证据（locale 键、stageTitles/roleLabels、默认 7、标签与动作逻辑、grep、语法）判定 pass；7 关视觉、深色主题、260px 窄侧栏、验收复核卡「启动并派发/通过/打回」的浏览器交互需 Owner 按 `docs/ACCEPTANCE.md` 批次 10 复测。
3. **迁移语义**：旧文档迁移仅在读取时归一化，首次写回才落盘；旧已完成项目的 acceptance 迁移备注只代表「升级前旧流程已完成」，不代表新流程重新复核，不得作为新交付的放行依据。
4. **fast 模式语义**：五中间阶段自动通过只在「提交」时发生；approval/release 已通过自动化用例双向排除，但 Owner 仍应在面板确认两类闸门在 fast 模式下保持人工。
5. **人工复核输入**：验收复核 Agent 需复跑关键命令并核对证据文件真实存在；本报告与 `.dsh/acceptance.json` 已一致，证据以命令与文件路径记录。
6. 真实发布/生产环境与 SSH 工作区不在本轮范围（沿用现状限制）。

## 9. 结论与建议

- 自动化：`npm run check`、`npm test`（17/17）、`pipeline-selftest`（36/36）、`review-selftest`（22/22）全部 exit 0；静态检查（六阶段残留、locale 键成对、版本/文档、client 语法）通过。
- 验收：v1.2.72 **12/12 pass，0 fail**；已修复 DEF-01，观察项 OBS-01 非阻断。
- **建议：通过**，可进入第 5 关 acceptance（项目经理 Agent 验收复核）与第 6 关 approval（Owner 人工确认）。
- 发布前提醒：重启 Harness 使 Host 改动生效；完成 `docs/ACCEPTANCE.md` 批次 10 人工复测；发布记录阶段记录版本 1.2.72 与回滚方式。
