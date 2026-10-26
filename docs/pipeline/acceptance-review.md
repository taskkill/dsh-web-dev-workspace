# 验收复核报告（项目经理 Agent）

- 轮次 / 阶段：第 1 轮 · acceptance（验收复核，双复核第一关）
- 复核时间：2026-10-26 15:39（Asia/Shanghai；复测 15:37，报告定稿 15:39）
- 复核人：项目经理 Agent（角色 `opc-pm`；只读复核，未改代码/需求/设计/验收标准）
- 基线：
  - 需求已 approved；`.dsh/pipeline.json`（gateMode=fast）中 product / design / development / testing 均已 approved，approval、release 为 pending（**六关旧文档**；当前运行中的 Host 仍是升级前 6 阶段代码，acceptance 阶段尚不在该文档中，重启后首次读取会自动迁移为 pending，见 §3）。
  - Git HEAD `a504f998c1dca83f5eee25045c5ba4a44d376319`；工作区 **28 个未提交文件**（20 个已跟踪改动含 1 个改名 + 8 个新建未跟踪），本轮未创建 git commit。
  - 验收清单：v1.2.72 **12 条** + 历史遗留 **1 条 blocked**（v1.2.68 批次 5 GUI 复测，Owner 执行）。
- 复核方式说明：运行中的 Host 尚未加载 v1.2.72 的 Host 代码，本关无法通过 `pipeline_submit_stage({stageId:'acceptance'})` 提交，因此按命令以**手工复核演练**执行；复核范围、证据口径与交付物与新版 acceptance 阶段完全一致，供 Owner 在人工确认关直接使用。**未伪造任何审批/发布动作。**

---

## 1. 需求覆盖

### 1.1 目标与范围映射（`docs/pipeline/requirements.md` §1–§6）

| 需求点 | 对应实现 / 验收项 / 测试 | 复核结果 | 证据 |
|---|---|---|---|
| 双复核模型：固定 7 阶段 product→design→development→testing→**acceptance**→approval→release，`PIPELINE_STAGES` 为唯一事实源（§3） | `pipeline.js` 常量；验收项 1；`pipeline-selftest` 36/36、`npm test` 17/17 | **覆盖** | 独立复核脚本：7 个 id 顺序完全一致；`pipeline-selftest`「exports: constants, fixed stage order…」 |
| 第 5 关角色边界：roleTitle=项目经理 Agent、只做什么/不做什么/交付物、`docs/pipeline/acceptance-review.md`、handbook 05-review、dispatch（§4） | `pipeline.js` STAGE_GUIDES/STAGE_HANDBOOKS/工具；验收项 2 | **覆盖** | 直接以假 ctx 调用 `pipeline_dispatch.execute({stageId:'acceptance'})`：role=`project-manager-agent`、roleTitle=项目经理 Agent、title=验收复核、handbooks=`docs/opc/05-review.md`+`docs/opc/00-charter.md`，prompt 含「只做什么/不做什么/建议放行/建议打回/不能审批」；release handbook=`docs/opc/06-ops.md` |
| normal 提交→review、Owner 通过/打回；fast 五中间阶段自动通过；approval/release 永不自动；模型无审批工具（§3、§6.3） | `pipeline.js` submitStage/reviewStage；验收项 3、4 | **覆盖** | 独立复核脚本：normal 提交后 `review`、approve→`approved`、reject→`failed` 且保留备注；fast 下 acceptance `autoApproved=true,nextStageId=approval`，approval 提交仍 `review`，release 启动 `bad-order`；注册的 8 个 pipeline 工具中无任何审批工具 |
| 旧 6 阶段文档三情形迁移（全 pending / 进行中 / 旧已完成）且幂等、不可绕过（§6.1） | `pipeline.js` normalizeStoredState；验收项 5–7 | **覆盖** | 独立构造 3 份旧格式文档调用 `readPipeline`：全 pending→acceptance pending；进行中→currentStageId=acceptance、start approval `bad-order`、start acceptance 成功；旧已完成→acceptance approved + note「升级迁移：验收复核为更新新增，旧流程已完成」；二次读取无重复 |
| 变更轮 scope：full/development 执行 acceptance；release/product/design/product-design 跳过并写备注（§6.2） | `pipeline.js` CHANGE_SKIP_STAGES；验收项 8 | **覆盖** | 独立对 6 个 scope 各跑 `startChangeRound`：full/development 的 acceptance=pending（执行）；release/product/design/product-design 的 acceptance=approved 且带「跳过：…」备注；release scope 仍需 approval 已通过 |
| 客户端/中英文：7 关显示、acceptance 角色与标题、AI 复核/人工确认标签、fast 提示、复核卡动作、默认阶段数 7、无六阶段残留（§5.1.2） | `client.js`、`locale/*.json`；验收项 9 | **部分覆盖（运行时留 Owner）** | 静态证据充分：`client.js` zh/en 词典各 **1052 条键（1050 唯一）0 缺失**；两处视图 stageTitles/roleLabels 含 acceptance（L16391/16423/17492/17501）、默认阶段数 7（L16385）、AI/人工标签 L17621–17623、`node --check` exit 0；浏览器实际渲染/交互在本环境（无浏览器、Host 未重启）**无法验证**，须 Owner 按 `docs/ACCEPTANCE.md` 批次 10 复测 |
| 团队与文档：AGENT_TEAM / PLAYBOOK ⑥ / opc 手册（05-review 新增、05-ops→06-ops 改名无断链）/ README / CHANGELOG / ACCEPTANCE 批次 10（§5.1.3） | 文档集；验收项 12 | **覆盖** | 逐文件核对见 §4；`docs/opc/05-review.md` 存在且被 pipeline.js、PLAYBOOK、AGENT_TEAM、opc/README 引用；`05-ops.md` 已不存在，全仓无指向它的链接 |
| 版本与记录：两个 package.json = 1.2.72、CHANGELOG `## 1.2.72 — 2026-10-26`（§5.1.4） | 验收项 12 | **覆盖** | 根/插件 `package.json` 均 1.2.72；CHANGELOG 段落存在且描述双复核/迁移/测试 |
| 测试：`npm run check`、`npm test`、`pipeline-selftest` 全绿无回归（§5.1.5） | 验收项 11 | **覆盖** | 亲自复跑 5 条命令全 exit 0，见 §3 |
| 兼容约束：不新增依赖、不改既有存储语义、SSH 工作区不支持、`.dsh/` 不进 Git（§6.4） | diff / 依赖 / 状态 | **覆盖** | 插件 `package.json` diff 仅版本号 1.2.71→1.2.72；根 `package.json` 无改动；无新依赖；`.gitignore` 未改；SSH 降级逻辑未动（review-selftest 覆盖） |

### 1.2 requirements §7 九条验收标准覆盖

| # | 验收标准 | 覆盖结果 | 证据 |
|---|---|---|---|
| 1 | 恰好 7 阶段、顺序固定、跳关一律被拒 | **覆盖** | 验收项 1；独立脚本（顺序 + 三处 bad-order）；`pipeline-selftest` 36/36 |
| 2 | acceptance 角色/prompt/dispatch/05-review 手册完整 | **覆盖** | 验收项 2；dispatch 实际调用与 prompt 关键词逐项命中 |
| 3 | normal 提交进 review 可过/可打回；fast 自动推进到 approval；approval/release 永不自动 | **覆盖** | 验收项 3、4；独立脚本 submit/approve/reject/fast 五阶段全通过 |
| 4 | 旧 6 阶段三种情形迁移正确、不报错、无绕过 | **覆盖** | 验收项 5–7；独立迁移脚本 3/3 情形通过 + 幂等 |
| 5 | 变更轮 scope 正确（执行/跳过 acceptance） | **覆盖** | 验收项 8；独立脚本 6/6 scope 通过 |
| 6 | 客户端 7 关、中英双语、复核卡可启动派发、无六阶段残留 | **部分覆盖** | 验收项 9 为静态证据 pass；运行时渲染/交互=环境限制，留 Owner 批次 10（见 §6 前置条件） |
| 7 | systemPrompt/工具描述 7 阶段双复核，pipeline_status 7 关与计数 | **覆盖** | 验收项 10；`PIPELINE_SECTION` 含七阶段/双复核/五中间阶段、无六阶段；4 个带 stageId 的工具枚举均含 acceptance |
| 8 | `npm run check` / `npm test` / `pipeline-selftest` 全绿无回归 | **覆盖** | 验收项 11；复跑 exit 0（另 review-selftest 22/22） |
| 9 | 文档与版本 1.2.72 一致齐全；「六阶段」仅历史记录 | **覆盖（附 1 项表述观察）** | 验收项 12；实测「六阶段」剩余命中：AGENT_TEAM L74/L104、PLAYBOOK L205（均为**旧版本迁移说明**）、00-charter L105（v1.2.33 版本历史）+ CHANGELOG 9 处；无现行行为仍称六阶段 —— 符合需求「历史版本记录允许」口径。**OBS-01**：测试报告基线行写「共 7 关」而实际 `.dsh/pipeline.json` 为 6 关旧文档（见 §4） |

**未覆盖 / 超范围改动**：
- 未覆盖：**运行时 GUI 证据**（Host 未重启、环境无浏览器）——属环境限制而非实现缺口，Owner 在人工确认关前必须完成批次 10 复测（见 §6）。
- 超范围改动：**无**。全部 28 个未提交文件均可映射到 requirements §5.1 交付物清单（代码/客户端/locale/文档/CHANGELOG/两个 package.json/测试）；测试脚本 `.dsh/tmp/team/pipeline-selftest.mjs`、`review-selftest.mjs` 只在 `.dsh/`（按宪章 §5 不进 Git）中，属需求明确的测试交付物路径。

---

## 2. 验收清单逐项核对

| # | 验收项（id / 标题） | 清单状态 | 证据 / 复测 | 复核结论 |
|---|---|---|---|---|
| 1 | `fc83e580b0` 流水线恰好 7 阶段且顺序固定，跳关一律被拒 | pass | note→test-report §2/§4/§5#1；复测 `pipeline-selftest` 36/36、`npm test` 17/17；**独立脚本**验证顺序与三处 `bad-order` | **认可** |
| 2 | `6038edf94f` acceptance 角色/提示词/handbook/dispatch 完整 | pass | note→test-report §4.1#10、§4.2#9/#17；**独立调用 dispatch**：role/roleTitle/title/handbooks=05-review+00-charter、prompt 含边界/交付物/建议放行打回 | **认可** |
| 3 | `03198a4859` normal 提交进 review，Owner 可通过/打回 | pass | note→test-report §4.1#3/#4、§4.2#4/#5/#6；**独立脚本**：review→approved、reject→failed 且保留备注、approval/release 锁定 | **认可**（模块级；面板交互留 Owner） |
| 4 | `f5b747a94c` fast 五中间阶段自动通过，approval/release 永不自动 | pass | note→test-report §4.1#5、§4.2#12；**独立脚本**：acceptance autoApproved+next=approval；approval 提交仍 review；release `bad-order` | **认可** |
| 5 | `9ccd30799a` 旧全 pending 文档迁移补 acceptance 且不报错 | pass | note→test-report §4.1#6、§4.2#16；**独立迁移**：7 关、acceptance=pending、幂等无重复 | **认可** |
| 6 | `42091c8a72` 旧进行中文档迁移后 acceptance 待开始且不可绕过 | pass | note→test-report §4.1#7、§4.2#16；**独立迁移**：currentStageId=acceptance、start approval `bad-order`、start acceptance 成功 | **认可** |
| 7 | `6cb4e1a339` 旧已完成文档迁移 acceptance=approved + 迁移备注 | pass | note→test-report §4.1#8、§4.2#16；**独立迁移**：note 精确含「升级迁移：验收复核为更新新增，旧流程已完成」、项目仍 complete | **认可** |
| 8 | `606837da2a` 变更轮 scope：full/development 执行、release 等按语义跳过 | pass | note→test-report §4.1#9、§4.2#13/#14；**独立脚本** 6/6 scope：full/development acceptance 执行，release/product/design/product-design 跳过带备注 | **认可** |
| 9 | `31bc93d8a4` 客户端中英文 7 关/双复核文案、复核卡可启动派发/通过/打回 | pass | note→test-report §3.1/§3.2/§5#9；**独立静态复核**：zh/en 各 1052 条键（1050 唯一）0 缺失、非成对键 0；stageTitles/roleLabels 两处含 acceptance（L16391/16423/17492/17501）、默认 7（L16385）、标签 L17621–17623、`node --check` exit 0、插件代码与 locale 六阶段残留 0；运行时 UI 未验（环境限制） | **部分认可**：静态证据充分，运行时渲染/交互待 Owner 批次 10；**不判 fail**（非实现缺口，属环境限制） |
| 10 | `33b2dc26ed` systemPrompt 与工具描述 7 阶段双复核、pipeline_status 7 关计数 | pass | note→test-report §4.1#10、§4.2#11/#17；**独立静态复核**：PIPELINE_SECTION 含七阶段/双复核/五中间阶段/无六阶段；8 个工具注册成功、4 个 stageId 枚举含 acceptance；`pipeline_status` 描述 seven-stage/stage 数 7 | **认可** |
| 11 | `9a42a68dbd` 三套命令全绿且无既有功能回归 | pass | 亲自复跑：`npm run check` exit 0、`npm test` 17/17、`pipeline-selftest` 36/36、`review-selftest` 22/22、`node --check client.js` exit 0（见 §3） | **认可** |
| 12 | `76e8476c8d` 文档与版本 1.2.72 一致齐全、无六阶段残留 | pass | 逐文件核对（§4）：两 package.json 1.2.72、CHANGELOG 1.2.72、05-review 新增、06-ops 改名无断链、ACCEPTANCE 批次 10、README/AGENT_TEAM/PLAYBOOK/opc 同步；六阶段命中仅历史/迁移语境 | **认可（附 OBS-01 测试报告基线措辞）** |

- **统计：pass 12 / fail 0 / blocked 0 / pending 0 / 缺证据 0。**
- **fail / blocked / 待验收清单**：v1.2.72 范围内**无**。
- **证据口径说明**：12 条验收项的 `evidence` 数组均为空，但每条 note 都绑定可复核证据（`docs/pipeline/test-report.md` 章节号、selftest/npm test 用例名、源码行号、文件路径）；本复核逐条独立复跑/静态核对，**未发现无证据支撑的通过项**。`.dsh/evidence/` 无截图类文件——静态/自动化证据已足够本轮判定；运行时 GUI 证据见 §6 前置条件。
- **历史遗留 blocked 项（非本轮引入）**：`3ffcb9eebb`「批次 5 GUI 复测（需重启 Harness，owner 执行）」，category `v1.2.68`，checkedAt 2026-10-26 02:33Z（早于本轮 15:14 开始），本轮未改动。**不影响 v1.2.72 交付判定**；但若 Owner 按宪章 §6 字面要求「全局无 blocked」，需在重启后按 `docs/ACCEPTANCE.md` 批次 5–9 复测后关闭或明确豁免（见 §6）。

---

## 3. 复测记录

工作区 `/data/dsh/home/dsh-web-powerfilebrowser/dsh-web-filebrowser`，Linux，Node v24.22.0，npm 11.19.1，Asia/Shanghai 2026-10-26 15:37。完整日志：`.dsh/evidence/acceptance-retest-2026-10-26.log`。

| # | 命令 | 退出码 | 耗时 | 结果 | 备注 |
|---|---|---|---|---|---|
| 1 | `npm run check` | **0** | 527 ms | 20 个模块 `node --check` 全过 | 与测试阶段一致的命令 |
| 2 | `npm test` | **0** | 513 ms | **PASS: 17/17 host smoke checks** | 含 7 阶段/迁移三情形/scope/fast/prompt |
| 3 | `node .dsh/tmp/team/pipeline-selftest.mjs` | **0** | 638 ms | **36/36 checks passed** | 顺序/跳关/迁移/scope/fast/工具文案 |
| 4 | `node .dsh/tmp/team/review-selftest.mjs` | **0** | 746 ms | **22/22 checks passed** | 含 acceptance 基线用例 |
| 5 | `node --check dsh-web-filebrowser-plugin/client.js` | **0** | 35 ms | 无错误 | 客户端语法单独复核 |

**独立 API 级复核（额外做的，不照抄测试报告）**：`node --input-type=module` 内联脚本 + 临时工作区（`os.tmpdir()`，不落盘到仓库），30+ 断言全部通过：

- `PIPELINE_STAGES` = product→design→development→testing→acceptance→approval→release；acceptance 定义 `project-manager-agent`/「项目经理 Agent」/「验收复核」；approval roleTitle「项目经理（你）」；`REVIEW_STAGE_IDS` 与 7 阶段一致；STAGE_HANDBOOKS 正确（05-review/06-ops）。
- `emptyPipeline()` 7 关全 pending；`readPipeline` 对旧文档三情形迁移正确且幂等，进行中迁移后 `currentStageId=acceptance`。
- 闸门：进行中 start approval `bad-order`；acceptance active 时 approval 仍 `bad-order`；normal 提交→review、approve→approved、reject→failed 保留备注；acceptance approved 后 approval 解锁、release 仍锁定。
- fast：acceptance `autoApproved=true, nextStageId='approval'`；approval 提交不自动通过（保持 review）；release 启动 `bad-order`。
- 6 种变更 scope 的 acceptance 执行/跳过与备注正确。
- `pipeline_dispatch`（假 ctx 实调）：acceptance payload 含 role/roleTitle/title/prompt/handbooks/spawn/teamTask，prompt 覆盖复核要素与「不能审批」边界；release handbook=06-ops。
- `PIPELINE_SECTION`：含七阶段/双复核/五中间阶段，无六阶段残留。

**静态检查**：

- `grep -rn "六阶段\|六关\|six stages\|six-stage"`：插件代码/README*/AGENT_TEAM/PLAYBOOK 命中 **3 处**，全部为「旧版本/迁移说明」语境（AGENT_TEAM L74/L104、PLAYBOOK L205）；00-charter L105 为 v1.2.33 版本历史；CHANGELOG 9 处历史记录。**无现行行为仍称六阶段。**
- 版本：根 `package.json` **1.2.72**、插件 `package.json` **1.2.72**；`CHANGELOG.md` 含 `## 1.2.72 — 2026-10-26`。
- `git status --porcelain`：22 个条目（20 已跟踪 + 2 未跟踪目录）；`-uall` 展开 28 个文件；`git diff --stat`：20 files changed, **+842 / −217**。
- `.dsh/pipeline.json` 当前为旧 Host 写入的 **6 关**文档（updatedAt 07:33:05Z）；**重启 Harness 后首次读取会自动迁移为 7 关**（独立脚本已在副本上验证 `currentStageId=acceptance`），迁移后 Owner 即可在 acceptance 卡执行批次 10 的 normal/fast 复测。

---

## 4. 变更与审阅

- **变更规模**：28 个未提交文件（20 已跟踪：19 个修改含插件 `package.json` + 1 个改名 05-ops→06-ops；8 未跟踪：`docs/opc/05-review.md`、`docs/pipeline/{requirements,design,test-report}.md`、`docs/pipeline/design/*.svg` ×4）。全部属 requirements §5.1 交付物范围，**无超范围改动**。
- **已审数**：`.dsh/review.json` 中阶段基线 4 个已捕获（product/design/development/testing），`marks` 为空 → 面板「已审」标记 0/28。以 testing 基线比对，基线后唯一新增改动为 `dsh-web-filebrowser-plugin/package.json`（1.2.71→1.2.72，`reviewed 0/1`）。
- **关键文件逐个审阅结论**：
  - `dsh-web-filebrowser-plugin/pipeline.js`（+166/−）：7 阶段常量与顺序、acceptance 指南/手册、迁移逻辑（仅当旧文档缺 acceptance 且 approval/release 已 approved 时补 approved+固定 note）、fast 显式排除 approval/release、CHANGE_SKIP_STAGES、release 提示双复核前提、8 个工具描述/枚举、PIPELINE_SECTION —— **与需求一致，无遗留六阶段表述**。
  - `dsh-web-filebrowser-plugin/client.js`（+107/−）：zh/en 文案（fastHint/approvalReady/approvalWaiting/reqScope/hint/dispatch prompt）、两处 stageTitles+roleLabels、默认阶段数 7、AI/人工标签与说明灰备注、approval 等待文案 —— **与设计说明 §3/§4/§7 一致**。
  - `dsh-web-filebrowser-plugin/review.js`（+8/−）：`REVIEW_STAGE_IDS` 7 阶段（修复 DEF-01：acceptance 启动可捕获基线）—— **正确且必要**。
  - `dsh-web-filebrowser-plugin/package.json`：仅 `version` 1.2.71→1.2.72；根 `package.json` 未改但已是 1.2.72；**无新依赖**。
  - `locale/zh.json`、`locale/en.json`：插件描述改「七阶段双复核 / seven-stage dual-review」，无其他改动。
  - `scripts/selftest/host-smoke.mjs`（+429/−）：新增 7 阶段/迁移/scope/fast/prompt 用例，既有 7 个回归用例保留 —— **测试增强，非业务代码**。
  - 文档（AGENT_TEAM/PLAYBOOK/opc/README/00-charter/04-qa/README*/插件 README/CHANGELOG/ACCEPTANCE/requirements/design/test-report）：与实现一致，无断链；`docs/opc/05-ops.md` 已不存在、无链接指向它。
- **异常扫描**：无调试代码（`console.log`/`debugger` 无新增；grep 命中的 `TODO_*` 常量、`tokenizer`、CSS `--dsw-*` token 均为既有合法代码）；无临时文件进工作区（仅 `.dsh/` 本地产物）；无密钥/令牌/私钥；无 `.env`/凭据改动。
- **审阅观察（非阻断）**：
  - **OBS-01**：`docs/pipeline/test-report.md` 基线行写「acceptance/approval/release = pending；共 7 关」，但实际 `.dsh/pipeline.json` 为旧 Host 的 6 关文档（无 acceptance）。属基线表述与实际运行状态不一致，**不影响任何功能结论**；建议 testing 阶段改 1 行（写明「旧 Host 实际 6 关，重启后迁移为 7 关」）。
  - **OBS-02**：`dsh-web-filebrowser-plugin/package.json` 在 testing 基线（15:29:43）之后、testing 期间（mtime 15:30:17）才由 1.2.71 改为 1.2.72，导致面板「本轮变更」显示 1 个未标「已审」文件；内容正确（仅版本号）且其后 5 条复测全绿。建议 Lead/Owner 在面板补标或接受本复核结论（本报告 §4 已完成该文件审阅）。
  - **OBS-03**：`client.js` zh/en 各有 2 组重复键（`git.retry`、`git.noCommits`），`git show HEAD` 确认同样是 6 次出现 → **本轮之前既有**，行为无影响，建议后续清理（与 QA 结论一致，已独立验证）。

---

## 5. DoD 检查（宪章 §6）

- [x] **验收清单**：本轮 12/12 pass、0 fail/blocked/pending；历史 blocked 1 项非本轮引入（见 §2）—— 本关可判，通过。
- [x] **测试报告**：`docs/pipeline/test-report.md` 覆盖正常/异常/边界与回归，证据可复现（5 条命令复跑全绿）—— 本关可判，通过（附 OBS-01 基线措辞更正建议）。
- [x] **验收复核报告**：本文件（`docs/pipeline/acceptance-review.md`）即为交付物，结构齐全 —— 本关可判，通过。
- [x] **变更审阅**：28 个变更文件全部逐项审阅（关键文件 diff 已看，文档结构已核对），无调试/临时/密钥/未预期改动；按产品「已审」标记口径为 0/28（OBS-02，Owner 侧操作）—— 本关可判，**有条件通过**（内容无未审关键文件）。
- [x] **文档**：需求/设计/测试/验收复核齐全；AGENT_TEAM、PLAYBOOK、opc、README*、CHANGELOG、ACCEPTANCE、两个 package.json 版本一致 —— 本关可判，通过。
- [ ] **发布**：approval 人工确认尚未发生，发布记录待 release 阶段补齐 —— **本关不可判**。
- [ ] **交付**：交付包（zip）+ 证据 + 链接待 release/交付阶段 —— **本关不可判**。
- [ ] **Owner 最终确认**：approval 阶段（双复核第二关）—— **本关不可判**，模型不审批。

**未完成项说明**：三项未完成均为流程后续阶段（approval/release），不是本关遗留缺陷；本关可判的 5 项中 4 项通过、1 项（变更审阅）有条件通过。

---

## 6. 放行建议

- **建议：放行**（进入 approval 人工确认关；阻断项 **0**）。
- **阻断项**：无。未发现 fail/blocked/无证据通过项/未审关键文件/文档矛盾/版本不一致/现行「六阶段」残留。
- **放行前置条件（Owner 在 approval 关必须执行，否则 release 不应启动）**：
  1. **重启 Harness**（加载 v1.2.72 Host 代码与迁移逻辑）+ 强制刷新页面；
  2. 按 `docs/ACCEPTANCE.md` **批次 10** 完成 7 关显示 / 中英文 / normal 通过+打回 / fast 五阶段自动且 approval/release 人工 / 三份旧文档迁移 / 变更 scope 的 GUI 复测；完成后关闭或明确豁免历史 blocked 项（批次 5–9）；
  3. 对 **OBS-01**（测试报告基线行措辞）与 **OBS-02**（插件 package.json 的「已审」标记）作出处理决定。
- **建议回退阶段**：**不适用**（无阻断）。若 Owner 对上述 OBS 采取严格要求，可回退 `testing` 仅补「1 行报告更正 + 面板已审标记」，**无需回退 development**（代码/证据无缺陷）。
- **遗留风险**：
  1. **运行时 UI 未实测**：本环境 Host 未重启、无浏览器，第 9 条与批次 10 的浏览器渲染/交互只能由 Owner 验证（环境限制，非实现缺口）；
  2. 旧文档迁移备注（acceptance=approved + 升级迁移 note）**不代表新流程重新复核过**，不得作为本次放行依据；本轮交付是本轮新做的 seven-stage 代码与文档；
  3. `.dsh/pipeline.json` 当前仍是 6 关旧快照；重启后首次读取才迁移并落盘，Owner 复测时应先确认 acceptance 卡出现且 `currentStageId=acceptance`；
  4. fast 模式下 approval/release 人工闸门已由自动化双向覆盖，但仍建议 Owner 在面板亲测一次「fast 下 approval 不自动通过、release 不能提前启动」；
  5. `.dsh/review.json` 的逐文件「已审」标记依赖面板操作，当前为 0（不影响交付判定，但 DoD 字面需 Owner 补齐或豁免）；
  6. SSH 远程工作区不支持流水线（沿用现状）；真实发布/生产环境不在本轮范围。
- **下一步**：Owner 在 approval 关凭本报告 + 关键证据决定通过/打回；模型不审批、不发布；release 通过后由运维记录环境/URL/版本/回滚方式并打包交付。
