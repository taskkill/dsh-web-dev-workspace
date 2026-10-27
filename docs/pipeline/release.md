# 发布说明：团队三 Agent 能力升级（v1.2.73）

- 阶段：release（第 2 轮，运维 `opc-ops`）
- 环境：**local workspace / 自托管插件**（本工作区即发布产物；无公网 URL、无服务器上传、无 Docker 镜像）
- 本地访问入口：Dev Workspace GUI `http://127.0.0.1:3080`（本机回环地址，仅供本机验收，不是公网发布）
- 版本：`v1.2.73`（根 `package.json` 与 `dsh-web-filebrowser-plugin/package.json` 均为 1.2.73；`CHANGELOG.md` 含 `## 1.2.73 — 2026-10-27`）
- 发布基线：git HEAD `b3c1e77`（`b3c1e77` 为 v1.2.72 发布提交 `2d8c761` 之后的 `fix` 提交，仅把根 `package.json` 版本预置为 1.2.73，功能代码与 v1.2.72 等价）；本次 26 个文件改动为工作区未提交状态，**Git 提交由 Lead 执行**，提交后的 commit hash 以实际提交为准
- 发布时间 / 发布人：2026-10-27 11:31（Asia/Shanghai，`2026-10-27T03:31Z`） / 运维 agent `opc-ops`
- 前置闸门（硬闸门，已满足）：
  - `acceptance`（双复核第一关，项目经理 Agent）= **approved**，`reviewedAt = 2026-10-27T03:28:55.007Z`，报告 `docs/pipeline/acceptance-review.md` 结论「建议放行」、阻断 0（v1→v2→v3 三轮打回修复闭环）；
  - `approval`（双复核第二关，Owner 人工确认）= **approved**，`reviewedAt = 2026-10-27T03:31:24.293Z`，`reviews[0] = {decision:'approve', actor:'owner'}` —— **Owner 在 Dev Workspace 面板人工确认，模型未审批、未代批**；
  - `release` = **active**，`startedAt = 2026-10-27T03:31:24.674Z`；`gateMode = fast`、第 2 轮（`round=2`）、`roundScope=full`。

## 1. 发布内容（变更摘要）

- **产品经理**：`pipeline.js` product 提示词与 `docs/opc/01-product.md` §5 新增「调研与借鉴」纪律——`web_search`/`web_fetch` 检索 ≥3 个来源（URL + 访问日期 + 关键结论）、借鉴决策表、已验证模式 vs 创新假设、反抄袭边界、无网络标 `blocked`；验收标准须可溯源。
- **UI 设计师**：`pipeline.js` design 提示词与 `docs/opc/02-design.md` §5 新增专业设计质量标准——4/8px 间距、字号阶梯/行高、对比度 4.5:1（大字 3:1）、触控 44×44、八态矩阵、360/768/1280 响应式、150–300ms + reduced-motion、键盘/ARIA、五维自检 rubric（每维 ≥3、均分 ≥4）、至少一轮「渲染→检查→修正」迭代。
- **全栈开发**：`pipeline.js` development 提示词与 `docs/opc/03-engineering.md` §5 新增「先调研再借鉴」SOP——GitHub ≥2 活跃候选对比、许可证矩阵（MIT/Apache/BSD/ISC 可借鉴并留出处；MPL/LGPL 谨慎；GPL/AGPL/无许可证禁止复制）、`docs/pipeline/engineering-research.md` 模板、npm audit/OSV/CVE 与性能预算；不盲目从零实现。
- **验收复核**：`pipeline.js` acceptance 提示词新增三项强制复核（复核调研与借鉴 / 复核设计质量 / 复核工程调研与许可证，纯文档轮须写 N/A + 理由），缺失即建议打回。
- **systemPrompt**：`PIPELINE_SECTION` 新增「调研与借鉴纪律」段。
- **文档/版本**：`docs/AGENT_TEAM.md`、`docs/PLAYBOOK.md`、`README.md`、`README.zh.md`、插件 `README.md`、`docs/opc/README.md`、`docs/ACCEPTANCE.md`（批次 11）、`CHANGELOG.md`、`locale/{zh,en}.json`、插件 `package.json` 同步；`scripts/selftest/host-smoke.mjs` 增 1 个 v1.2.73 关键词用例（17→18）。
- **性质**：**纯提示词 / 手册 / 文档 / 测试轮，无运行时业务代码改动**；`client.js`、`review.js` 本轮未改；七阶段结构、fast/normal 闸门语义、迁移逻辑、工具/路由数量均不变（36 tools / 10 routes）。

## 2. 发布前自测 gate（发布前最后一次执行，2026-10-27 11:31 CST）

| # | 命令 | 退出码 | 耗时 | 结果 |
|---|---|---|---|---|
| 1 | `npm run check` | **0** | 674 ms | 20 个模块 `node --check` 全过 |
| 2 | `npm test`（`node scripts/selftest/host-smoke.mjs`） | **0** | 637 ms | **PASS: 18/18 host smoke checks**（含 v1.2.73 四阶段关键词用例） |
| 3 | `node .dsh/tmp/team/pipeline-selftest.mjs`（追加核对） | **0** | 688 ms | **38/38 checks passed** |
| 4 | `node .dsh/tmp/team/review-selftest.mjs`（追加核对） | **0** | 785 ms | **22/22 checks passed** |
| 5 | `npm run check:json`（追加核对） | **0** | 183 ms | JSON OK（locale/配置文件合法） |

- 工具版本：Node **v24.22.0**、npm **11.19.1**；**无安装/构建步骤**（纯 JS 插件，Host 直接加载工作区代码），因此无独立构建产物。
- 验收清单：`.dsh/acceptance.json` v1.2.73 **12 条全部 pass / 0 fail / 0 blocked**（`d1891f12f4` 已由 QA 依 acceptance v3 报告由 blocked 转 pass）；历史遗留 blocked 项已不在清单（第 2 轮开始时清理）。
- 复测/复核依据：`docs/pipeline/test-report.md`（4+3 套命令复跑全绿）、`docs/pipeline/acceptance-review.md`（项目经理 Agent v3 终版，建议放行）。

## 3. 产物清单与校验

发布产物 = 工作区文件快照（无 zip / 无独立构建产物；按宪章 §5，`.dsh/` 运行状态不进 Git）。

- **Git 现状（本报告写入前）**：`git status --short` = 20 个已跟踪修改 + 5 个新建未跟踪 = 25 项；`git diff --stat` = 20 files changed, **+1749 / −917**；另加本报告（重写上一轮 v1.2.72 记录），交付清单共 **26 项 = 21 个已跟踪修改 + 5 个新建**。
- **提示词（1）**：`dsh-web-filebrowser-plugin/pipeline.js`（+78/−，**仅为 `PIPELINE_SECTION` 与 `STAGE_GUIDES` 的提示词文本，无逻辑代码改动**；`git diff` 全部落在模板字符串/数组字面量内）
- **三本角色手册（3）**：`docs/opc/01-product.md` §5 调研与借鉴、`docs/opc/02-design.md` §5 专业设计质量标准、`docs/opc/03-engineering.md` §5 开源调研与安全复用
- **文档同步（7）**：`docs/AGENT_TEAM.md`、`docs/PLAYBOOK.md`、`docs/opc/README.md`、`README.md`、`README.zh.md`、`dsh-web-filebrowser-plugin/README.md`、`docs/ACCEPTANCE.md`（批次 11）
- **版本与 locale（4）**：`CHANGELOG.md`、`dsh-web-filebrowser-plugin/locale/zh.json`、`dsh-web-filebrowser-plugin/locale/en.json`、`dsh-web-filebrowser-plugin/package.json`（仅 `version` 1.2.72→1.2.73）
- **测试（1）**：`scripts/selftest/host-smoke.mjs`（+110 行，新增 v1.2.73 用例）
- **流水线文档（4）**：`docs/pipeline/requirements.md`（含 11 个真实来源 + 17 行借鉴决策表）、`docs/pipeline/design.md`（9 项 MUST + 五维 rubric + 八态）、`docs/pipeline/test-report.md`、`docs/pipeline/acceptance-review.md`（v3 终版）
- **设计证据（5，新建）**：`docs/pipeline/design/design-quality-gate.svg`、`design-quality-gate.png`、`design-quality-gate-r1.png`、`design-quality-gate-r2.png`、`archive-v1.2.72-seven-stage-design.md`（上一轮设计归档）
- **本报告（1）**：`docs/pipeline/release.md`（本文件，替换 v1.2.72 记录；历史见 §8）
- **依赖核对（无新增）**：根 `dependencies` = `{"ssh2":"^1.17.0"}`；插件 `dependencies` = `{"@xterm/addon-fit":"^0.10.0","@xterm/xterm":"^5.5.0","ssh2":"^1.17.0"}`；与 HEAD `b3c1e77` **逐字一致**；无 `package-lock.json`/lockfile 改动；`git diff package.json dsh-web-filebrowser-plugin/package.json` 仅插件版本号 2 行变化（根 `package.json` 版本已在 HEAD 预置 1.2.73、工作区无改动）。
- **关键文件 SHA256**（可复现校验，`sha256sum`）：

```text
e8bf37587905b6c92de02d3509300477153eed3ef3698222279f50cc343b83c9  dsh-web-filebrowser-plugin/pipeline.js
6f45c6d8984acd07844a4c6a7c496519669b62ba83e82e789ad94281c9d4c125  docs/opc/01-product.md
93bcb712b50755ff2970a2a0f5c70f82c56e8bbc6c87e3f963f927935152f671  docs/opc/02-design.md
d9d9eb4b60d6720171b199c3c5b506a9038eed152876d587e3bee8b90d756fa2  docs/opc/03-engineering.md
5605ef01cebc93cadec70f8ddbb631b8d15366dc503975e155210f8ec7b0f0f9  dsh-web-filebrowser-plugin/package.json
c824052413417475f066176c638eff61b0f847d2a6f526fbcee47726ea0bc24e  package.json
```

- **一致性/安全核对**：改动清单与本轮交付一致（提示词 1 + 手册 3 + 文档同步 7 + 版本/locale 4 + 测试 1 + 流水线文档 4 + 设计证据 5 + 本报告），无超范围改动；新增行密钥扫描 **0 命中**（`api_key/secret/password/PRIVATE KEY` 无匹配）；无调试代码（`console.log`/`debugger` 无新增）、无临时文件；`.dsh/` 已被 `.gitignore` 忽略（`git ls-files .dsh` = 0）；无 `.env`/证书/私钥；`git diff --check` 无空白错误。

## 4. 发布方式与生效条件（重要）

- 本插件为**工作区自托管**：发布动作 = 工作区代码/文档即产物；本轮改动集中在 **Host 提示词（`pipeline.js` STAGE_GUIDES / PIPELINE_SECTION）与手册/文档**：
  - **Host 提示词 / systemPrompt 改动必须重启 Harness 才生效**（`pipeline_stage_prompt`、`pipeline_dispatch` 与注入的 systemPrompt 均从 Host 模块读取）；
  - `client.js` / `review.js` **本轮无改动**，**无需重建客户端 bundle**；重启后强刷页面即可（清缓存更稳妥）；
  - `.dsh/pipeline.json` 已是 v1.2.72 Host 写入的 **7 关**文档，无需迁移。
- 重启前的旧 Host 仍返回旧提示词（不报错、不阻断，但复测会看到旧文本）；**验收环境限制项（GUI 派发提示词显示）必须重启后复测**。
- 无公网发布、无预览分享、无交付 zip：本轮发布目标仅为本地工作区插件升级，客户交付包/分享链接由 Lead/Owner 按需另行决定。

## 5. 回滚方式

- 上一版本：**v1.2.72**（发布提交 `2d8c761`；其后的 `b3c1e77` 仅把根 `package.json` 版本预置为 1.2.73，功能代码与 v1.2.72 等价）。当前发布基线 = HEAD `b3c1e77`。
- 方式 A（推荐，保留历史）：`git revert <本次 release commit>` → **重启 Harness** → GUI 强刷；回滚后提示词/手册恢复 v1.2.72 行为。
- 方式 B（丢弃式）：`git reset --hard b3c1e77` → 重启 Harness → GUI 强刷（若需完整回到 v1.2.72 发布态，则 `git reset --hard 2d8c761`）。
- 生效前提：**Host 提示词回退后必须重启 Harness**，否则内存中仍是新提示词；客户端刷新清理缓存（本轮无 client 改动，刷新仅为稳妥）。
- **回滚前备份 `.dsh/pipeline.json`**：运行态流水线/验收/审阅数据在 `.dsh/`（不进 Git），`git reset/revert` 不会回退它们；本轮回滚只需代码/文档回退，流水线状态可保留，但备份可在异常时可恢复。
- 预计耗时 < 2 分钟；无数据库/数据迁移，无依赖变更；风险低（本轮不改运行时逻辑）。

## 6. 发布后验证（Owner 执行）

1. **重启 Harness**（加载 v1.2.73 Host 提示词与 systemPrompt），打开本工作区；
2. **强制刷新** GUI（`Ctrl+Shift+R` / 硬刷新）；
3. 按 `docs/ACCEPTANCE.md` **批次 11** 复测：
   - `pipeline_stage_prompt({stageId:'product'|'design'|'development'|'acceptance'})` 各阶段提示词含调研/借鉴/设计质量/许可证/安全关键词（批次 11 已给 grep 命令）；
   - 新开工作区会话，注入的 systemPrompt 含「调研与借鉴纪律」段；
   - 流水线面板「启动并派发」收到的角色提示词含上述条款；
   - 三本手册 §5 新章节可读、AGENT_TEAM/PLAYBOOK/README 同步、批次 11/CHANGELOG/版本一致；
   - 双复核回归：七阶段结构与 fast/normal 语义不变，acceptance 可派发、approval/release 仍人工；
4. 复测通过后，由 Lead 执行 Git 提交，并在流水线面板记录本次 release（`pipeline_record_release`：environment=`local-workspace`，url=`http://127.0.0.1:3080`（本机 GUI，非公网），notes 含版本/commit/自测/回滚 + 「Host 提示词改动需重启 Harness 生效」）。**模型不代 Owner 审批、不创建 Git 提交、不调用 Host 发布记录工具。**

## 7. 遗留风险

1. **GUI 提示词显示未实测**：本轮 Host 提示词需重启 Harness 才生效，派发/提示词显示由 Owner 按批次 11 验证（环境限制，非实现缺口）。
2. **提示词增长可能被模型忽略关键检查点**：四阶段提示词增加约 1.6–2.9k chars，selftest 关键词断言兜底，真实执行效果待后续复盘校准。
3. **设计 rubric 主观性**：本轮无 UI 变更，设计质量标准缺真实页面验证，`design.md §11` 已声明下一轮 UI 变更时校准。
4. **调研依赖联网**：来源真实性已由 QA/PM 抽查（3/3 HTTP 200、无伪造、4 条失败来源如实披露）；后续轮次无网络须按纪律标 `blocked`，不得伪造来源。
5. **OBS-04（非阻断）**：`docs/pipeline/engineering-research.md` 未落盘 N/A 记录，本轮理由由 acceptance-review §6 记录；如需文件留痕可下轮补 1 行。
6. **OBS-05（历史，非阻断）**：`docs/FEATURE_PROPOSAL.md` L309 表格竖线历史债务，本轮未改该文件；建议后续文档轮清理并纳入常备表格检查。
7. **OBS-06（非阻断）**：`.dsh/review.json` 逐文件「已审」标记 0/24（`marks` 为空），需 Owner 在面板补标或接受 acceptance 复核报告的审阅结论。
8. **回滚/运行态**：`.dsh/` 运行状态不在 Git，回滚代码不影响流水线/验收数据；按 §5 备份即可。真实生产发布/SSH 工作区/深色主题窄侧栏视觉沿用现状人工复测（不在本轮范围）。

## 8. 审批与记录留痕 / 历史发布

- **Owner 人工确认记录**：`.dsh/pipeline.json` → `stages[acceptance].status="approved"`（`reviewedAt=2026-10-27T03:28:55.007Z`，AI 复核第一关）；`stages[approval].status="approved"`（`reviewedAt=2026-10-27T03:31:24.293Z`，`reviews[0]={"decision":"approve","actor":"owner"}`）；随后 `stages[release].status="active"`（`startedAt=2026-10-27T03:31:24.674Z`）。
- **模型边界遵守**：运维未审批、未改业务代码/需求/设计/验收结论、未创建 Git 提交、未调用 `pipeline_record_release`（Host 工具在子代理不可用，由 Lead 执行）。
- **历史发布（第 1 轮，v1.2.72 双复核模式）**：commit `2d8c761`（基线 `a504f99`），30 个文件，自测 `npm run check` + `npm test` 17/17 + pipeline-selftest 36/36 + review-selftest 22/22；`.dsh/pipeline.json` 的 `releases` 已记录（environment=`local-workspace`，url=`http://127.0.0.1:3080`）。本轮 v1.2.73 的 `releases` 记录由 Lead 补写。
