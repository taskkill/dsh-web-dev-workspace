# 发布说明：工作台 Agent 指派器 MVP（v1.2.75）

- 阶段：release（第 3 轮，运维 `opc-ops`）
- 环境：**local workspace / 自托管插件**（本工作区即发布产物；无公网 URL、无服务器上传、无 Docker 镜像）
- 本地访问入口：Dev Workspace GUI `http://127.0.0.1:3080`（本机回环地址，仅供本机验收，不是公网发布）
- 版本：`v1.2.75`（根 `package.json` 与 `dsh-web-filebrowser-plugin/package.json` 均为 1.2.75；`CHANGELOG.md` 顶部 `## 1.2.75 — 2026-10-27`）
- 发布基线：git HEAD `322064c`（`chore: 根 package.json 版本 +1 至 1.2.75`；上一发布版 `0e764b2` = v1.2.73，中间 `27e0b26` 为根版本 +1 至 1.2.74）；本次 35 个文件为工作区未提交改动，**Git 提交由 Lead 执行**，提交后的 commit hash 以实际提交为准
- 发布时间 / 发布人：2026-10-27 13:48（Asia/Shanghai，`2026-10-27T05:48Z`） / 运维 agent `opc-ops`
- 前置闸门（硬闸门，已满足）：
  - `acceptance`（双复核第一关，项目经理 Agent）= **approved**，`reviewedAt = 2026-10-27T04:33:41.698Z`，报告 `docs/pipeline/acceptance-review.md` **v2 复验**：**建议放行、阻断 0**（v1 的 B1/B2 与 OBS-01..05 已修复并独立核验关闭；6 条 GUI 项因环境限制保持 blocked，复核报告未伪造 pass）；
  - `approval`（双复核第二关，Owner 人工确认）= **approved**，`reviewedAt = 2026-10-27T05:48:04.124Z`，`reviews[0] = {decision:'approve', actor:'owner'}` —— **Owner 在 Dev Workspace 面板人工确认，模型未审批、未代批**；
  - `release` = **active**，`startedAt = 2026-10-27T05:48:04.493Z`；`gateMode = fast`、第 3 轮（`round=3`）、`roundScope=full`。

> 验收状态如实记录：v1.2.75 验收清单 **12 条 = 6 pass / 0 fail / 6 blocked**。6 条 blocked 均为**纯 GUI/视觉项**（卡片渲染、抽屉交互、提交 toast/卡片刷新、键盘/窄屏、效果图落地），属环境限制（本机无浏览器自动化），需 Owner 重启 Harness 后按 `docs/ACCEPTANCE.md` **批次 12** 人工复测回填；**不得视为已验收 pass**。

## 1. 发布内容（变更摘要）

- **新增 Host 模块 `dsh-web-filebrowser-plugin/assignments.js`（771 行，新文件）**：工作台 Agent 指派数据层——`.dsh/agent-assignments.json` 持久化（temp+rename 原子写、per-root 串行锁）、记录校验（标题 ≤120、说明 ≤4000、验收标准 1–10 条、优先级 P0/P1/P2）、状态机（dispatched→running→review→done / failed / cancelled，history ≤50）、100 条与 1 MiB 上限、坏文件 `corrupt` 不静默清空、SSH 降级；**不读写 `.dsh/pipeline.json`**。
- **`index.js` +79 行**：新增 4 个 **Owner-only Host op**：`assignmentList` / `assignmentSave` / `assignmentUpdate` / `assignmentDelete`；SSH 工作区统一 `ssh-unsupported`；**不注册任何模型工具**（无 spawn/team API 调用）。
- **`client.js` +1683 行（纯新增，0 删除）**：工作台「团队与指派」卡片（6 角色 chips + 推导状态 + 最近 5 条 + 空态）、指派抽屉（字段/校验/计数器/就地错误/新建 Agent/关联 5 个可关联阶段，approval/release 置灰）、提交后结构化指派单 + toast + 卡片刷新、状态列表与操作（打回必须填原因/再指派/取消/催办）、`workbench.assign.*` 中英 **122/122 键**成对、无障碍（aria dialog/aria-live/键盘焦点/44px）与 ≤768px 底部面板；**既有编辑器标签右键菜单（Owner 标签菜单）完整保留**（diff 无删除行）。
- **版本/配置**：根 `package.json` `scripts.check` 增加 `node --check dsh-web-filebrowser-plugin/assignments.js`（21 个模块）；插件 `package.json` 版本 1.2.73→1.2.75、`files` 白名单补 `assignments.js`；**无新增运行时依赖**；`CHANGELOG.md` 1.2.75。
- **文档/设计/测试**：`docs/pipeline/requirements.md`（含 7 个来源调研/14 行借鉴决策表/7 条创新假设）、`design.md`（+§15 五维自检评分 4.2/5.0、八态、对比度、迭代）、`test-report.md`、`acceptance-review.md`（v2）、`engineering-research.md`（新，N/A 理由 + 内部模式借鉴/许可证/自检）；`docs/ACCEPTANCE.md` 批次 12；`docs/AGENT_TEAM.md`/`docs/PLAYBOOK.md`/`README.md`/`README.zh.md`；`docs/proposals/AGENT_ASSIGN.md` 提案 + `docs/proposals/mockups/`（README + 3 屏 SVG/PNG）；设计落地稿 `docs/pipeline/design/assign-*.svg/png` ×8 与上一轮设计归档；`scripts/selftest/host-smoke.mjs`（18→31 用例，+13 assignments）。
- **不改**：流水线 `pipeline.js`、`review.js`、`acceptance.js` 本轮零改动；七阶段双复核结构、fast/normal 闸门语义、模型工具/路由注册数量（36 tools / 10 routes）不变；指派动作不写 `.dsh/pipeline.json`（Host 层独立验证 sha256 不变）。

## 2. 发布前自测 gate（发布前最后一次执行，2026-10-27 13:48 CST）

| # | 命令 | 退出码 | 耗时 | 结果 |
|---|---|---|---|---|
| 1 | `npm run check` | **0** | 594 ms | **21 个模块** `node --check` 全过（新增 assignments.js） |
| 2 | `npm test`（`node scripts/selftest/host-smoke.mjs`） | **0** | 679 ms | **PASS: 31/31 host smoke checks**（18 既有 + 13 assignments） |
| 3 | `node .dsh/tmp/team/pipeline-selftest.mjs` | **0** | 625 ms | **38/38 checks passed**（七阶段双复核回归） |
| 4 | `node .dsh/tmp/team/review-selftest.mjs` | **0** | 753 ms | **22/22 checks passed** |
| 5 | `node .dsh/tmp/team/assignments-selftest.mjs` | **0** | 176 ms | **27/27 checks passed**（指派器模块深测） |

- 工具版本：Node **v24.22.0**、npm **11.19.1**；**无安装/构建步骤**（纯 JS 插件，Host 直接加载工作区代码）；无锁文件改动。
- 验收清单：**12 条 = 6 pass / 0 fail / 6 blocked**（blocked 为 GUI 环境项，见上）；验收复核（PM v2）与 QA 测试报告均记录「建议放行/通过，阻断 0」。
- 复测/复核依据：`docs/pipeline/test-report.md`、`docs/pipeline/acceptance-review.md`（v2）、`.dsh/evidence/acceptance-retest-v1.2.75.log`。

## 3. 产物清单与校验

发布产物 = 工作区文件快照（无 zip / 无独立构建产物；按宪章 §5，`.dsh/` 运行状态不进 Git）。

- **Git 现状（本报告写入前）**：`git status --short` = **15 个已跟踪修改 + 19 个新建未跟踪 = 27 个条目 / 34 个文件**；`git diff --stat` = 15 files changed, **+3416 / −1028**；另加本报告（重写上一轮 v1.2.73 记录），交付清单共 **35 个文件 = 16 个已跟踪修改 + 19 个新建**。
- **代码（3）**：`dsh-web-filebrowser-plugin/assignments.js`（新，771 行）、`index.js`（+79/−0，4 个 Owner-only op）、`client.js`（**+1683/−0，纯新增**：团队与指派卡/抽屉/结构化派单/状态列表/i18n/无障碍/窄屏）
- **版本与配置（3）**：根 `package.json`（`scripts.check` +1 行 assignments.js；版本已在 HEAD 预置 1.2.75）、`dsh-web-filebrowser-plugin/package.json`（版本 1.2.75 + `files` 白名单）、`CHANGELOG.md`
- **测试（1）**：`scripts/selftest/host-smoke.mjs`（+356 行，新增 13 个 assignments 用例）
- **流水线文档（5）**：`docs/pipeline/requirements.md`、`design.md`、`test-report.md`、`acceptance-review.md`（v2）、`engineering-research.md`（新）
- **用户/团队文档（6）**：`docs/ACCEPTANCE.md`（批次 12）、`docs/AGENT_TEAM.md`、`docs/PLAYBOOK.md`、`README.md`、`README.zh.md`（插件 `README` 本轮未改）、`docs/proposals/AGENT_ASSIGN.md`（新提案）
- **设计稿（13，新建）**：`docs/pipeline/design/assign-dialog|assign-empty-state|assign-status|assign-workbench .{svg,png}`（8）、`docs/pipeline/design/archive-v1.2.73-agent-capabilities.md`（上轮归档）、`docs/proposals/mockups/README.md` + `assign-dialog|assign-status|assign-workbench .{svg,png}`（7）
- **本报告（1）**：`docs/pipeline/release.md`（本文件，替换 v1.2.73 记录；历史见 §8）
- **依赖核对（无新增）**：根 `dependencies` = `{"ssh2":"^1.17.0"}`；插件 `dependencies` = `{"@xterm/addon-fit":"^0.10.0","@xterm/xterm":"^5.5.0","ssh2":"^1.17.0"}`；与 HEAD `322064c` **逐字一致**；无 `package-lock.json`；两个 `package.json` 的 diff 仅为版本/`files` 白名单/check 脚本行，**无依赖变化**；无新增模型工具。
- **关键文件 SHA256**（可复现校验，`sha256sum`）：

```text
43169b3a893fa34ec2cf2665f15e25c1870dd118934e65d5e217a0c1d96b5360  dsh-web-filebrowser-plugin/assignments.js
f63718e8c4f5e129fa4974e73fa35f0198f9fad3a07300d1948fb43a85c1902d  dsh-web-filebrowser-plugin/index.js
b4eca4fd611c2232ae32fc92b260d144bb8e626091522574e7f2959f85498833  dsh-web-filebrowser-plugin/client.js
56fb2fd82dfb4c05efefdba7805bbd2c3cf84135bc685b12401a2f88589fa614  dsh-web-filebrowser-plugin/package.json
b0060cb78d23aedd1be9a6d31a224e6c78d419f9cedef6c0573e960b82c45eb8  package.json
4770214e0e9510f2badc8a864d9578dc6aab9bb4343c558935c4f6f393a6502b  docs/pipeline/engineering-research.md
ee94e10b68b04168c8c00ce42482da2b59beee0795ea78f80a8caf354bf84d9f  docs/pipeline/requirements.md
8a877c60678180e8437c0247053b16c67b15ae82586cd3047add89a0535ee423  docs/pipeline/design.md
26cdd0fa9b0bfc8c7a648db896aba22722b62c88f4b5128f6461d59f3052bd31  docs/pipeline/acceptance-review.md
```

- **一致性/安全核对**：改动清单与本轮交付一致（代码 3 + 版本/配置 3 + 测试 1 + 流水线文档 5 + 用户文档 6 + 设计稿 13 + 本报告），无超范围改动；新增行密钥扫描 **0 命中**（`api_key/secret/password/PRIVATE KEY` 无匹配）；无调试代码（`console.log`/`debugger` 在改动 JS 与 `assignments.js` 中 0 新增）、无临时文件；`.dsh/` 已被 `.gitignore` 忽略（`git ls-files .dsh` = 0）；无 `.env`/证书/私钥；`git diff --check` 干净；`client.js` diff 为 **+1683/−0 纯新增**，既有编辑器标签右键菜单未回退。

## 4. 发布方式与生效条件（重要）

- 本插件为**工作区自托管**：发布动作 = 工作区代码/文档即产物。本轮包含**两类改动**，生效方式不同：
  - **Host 新增模块 `assignments.js` + `index.js` 4 个 op（assignmentList/Save/Update/Delete）与根 `package.json` check 脚本改动 → 必须重启 Harness 才生效**（旧 Host 无这些 op，工作台新卡片调不到后端）；
  - **`client.js`（工作台卡片/抽屉/状态列表，+1683 行）→ 刷新页面 / 重建客户端 bundle 后生效**（若运行 `pnpm run dev:web` 构建的 bundle 则重新构建；纯本地刷新清缓存亦可）。
- 重启前的旧 Host 下工作台新卡片会因 op 不存在而降级/报错（属预期）；**批次 12 的 GUI 复测必须在重启 + 刷新后执行**。
- 无公网发布、无预览分享、无交付 zip：本轮发布目标仅为本地工作区插件升级；客户交付包/分享链接由 Lead/Owner 按需另行决定。

## 5. 回滚方式

- 上一版本：**v1.2.73**（发布提交 `0e764b2`；其后 `27e0b26` 仅根 `package.json` +1 至 1.2.74、插件保持 1.2.73；`322064c` 仅根版本 +1 至 1.2.75）。当前发布基线 = HEAD `322064c`。
- 方式 A（推荐，保留历史）：`git revert <本次 release commit>` → **重启 Harness** → **强刷/重建客户端 bundle**；回滚后工作台恢复旧版（无「团队与指派」卡/指派 op）。
- 方式 B（丢弃式）：`git reset --hard 322064c` → 重启 Harness → 强刷；若需完整回到 v1.2.73 发布态，使用 `git reset --hard 0e764b2`（或 `27e0b26`，仅根版本差 1.2.74）。
- 生效前提：**Host 回退后必须重启 Harness**（旧/新 op 差异只在进程启动时读取）；客户端改动需刷新/重建 bundle 清理缓存。
- **回滚前备份运行态**（`.dsh/` 不进 Git，`git reset/revert` 不会回退它们）：
  - `.dsh/pipeline.json`（流水线/验收/审阅状态）；
  - `.dsh/agent-assignments.json`（工作台指派记录——**当前该文件不存在**，本工作区尚无指派；若回滚前已产生记录，先备份，必要时删除，避免旧版无对应 UI 的残留）。
- 预计耗时 < 3 分钟；无数据库/数据迁移、无依赖变更；风险较低（流水线/审阅/验收模块零改动，回滚主要影响工作台新功能）。

## 6. 发布后验证（Owner 执行）

1. **重启 Harness**（加载 `assignments.js` 与 4 个 op），打开本工作区；
2. **强刷页面 / 重建客户端 bundle**（`client.js` 新 UI），切到工作台；
3. 按 `docs/ACCEPTANCE.md` **批次 12** 逐项复测并回填 **6 条 blocked GUI 验收项**（其余 6 条已 pass）：
   - 卡片位置「需要你处理 → 项目状态 → **团队与指派** → 项目流程」、6 角色 chips（空闲/执行中/待你确认）+ 「指派任务」按钮 + 「打开团队面板 ↗」降级说明；
   - 最近 5 条指派与空态、状态 pill、类型（关联阶段/临时任务）、时间与操作；
   - 抽屉：三选一（角色 6 选 1 / 当前成员 / 新建 Agent）、标题 ≤120 与说明 ≤4000 计数器、验收标准 1–10 条、优先级默认 P1、期望产物、附件入口（仅提示拖入对话，不阻塞）、就地错误不丢输入、Esc 关闭且焦点归还、≤768px 底部面板；
   - 提交后：`.dsh/agent-assignments.json` 落盘（字段 id/round/title/detail/acceptance[]/assignedTo/stageId/priority/expectedArtifacts/status=dispatched/history/createdAt/updatedAt）+ 当前对话收到结构化指派单（【工作台指派 · 第 N 轮】…）+ toast + 卡片/列表即时刷新、连点只产生 1 条；
   - 关联阶段：自动判断 + product/design/development/testing/acceptance 5 选 + 不关联；**approval/release 置灰**并有「只能 Owner 在流水线面板审批」提示；提交后 stageId 与选择一致；
   - 状态机：dispatched→running→review→done；打回必须填原因（空 note 被拒）；取消/再指派/催办；history 追加；非法流转被拒且文件不变；
   - **流水线只读关键项**：`sha256sum .dsh/pipeline.json` 指派前后必须一致；`assignmentSave` 传 approval/release 必须 `bad-request`；
   - i18n/无障碍/窄屏：中英 122 键无硬编码残留、Tab 焦点环、`role="dialog" aria-modal="true"`、Esc 归还焦点、44px 命中、reduced-motion、无横向溢出；
   - 三张效果图落地（对照 `docs/proposals/mockups/`）；边界：100 条 `full`、>1MB `too-large`、坏 JSON `corrupt`、SSH `ssh-unsupported`；回归：编辑区标签右键菜单（Owner 标签菜单）、验收台、交付包、待办、记忆、流水线七阶段双复核不回退；
4. 复测通过后由 Lead 执行 Git 提交，并在流水线面板记录本次 release（`pipeline_record_release`：environment=`local-workspace`，url=`http://127.0.0.1:3080`，notes 含版本/commit/自测/回滚 + 「Host 新增 assignments.js 与 4 op 需重启 Harness；client.js 改动需刷新/重建 bundle」）。**模型不代 Owner 审批、不创建 Git 提交、不调用 Host 发布记录工具。**

## 7. 遗留风险

1. **6 条 GUI/视觉验收项未实测（blocked）**：卡片/抽屉/提交链路/toast/键盘焦点/窄屏/效果图落地以 Owner 批次 12 为准（环境限制，非实现缺陷）；**在 Owner 回填前不得宣称 v1.2.75 已验收通过**。
2. **成员实时状态为推导值**：卡片 chips 状态按指派记录推导（非 Harness 团队面板实时），UI 已标注「以 Harness 团队面板为准」。
3. **团队入口降级**：无团队面板深链时「打开团队面板 ↗」降级为可复制说明（不报错、不死链），属设计内 MVP 缩减。
4. **附件降级**：附件入口仅提示「上传或拖入对话」，不阻塞提交，附件实际传递依赖对话能力。
5. **指派执行依赖 Lead**：工作台只产出结构化指派单，真正执行由 Lead 用原生团队工具完成；临时任务存在绕过流水线的滥用风险（文档已要求涉代码/需求时转变更轮）。
6. **数据上限**：每工作区 100 条记录 / 文件 ≤1 MiB / history ≤50，长期需清理终态记录；`.dsh/agent-assignments.json` 当前不存在（本工作区尚无指派记录），属运行态正常。
7. **OBS 类剩余（非阻断，PM v2 报告）**：OBS-a `design.md §15.3` 扣分点表述「实现需改 8px」可改为「已按 8px 落地」；OBS-b `test-report.md` B1 标题与 N/A 结论措辞可统一；OBS-c `.dsh/review.json` 逐文件「已审」0/34 需 Owner 补标或知悉；OBS-d 指派文件为空态正常。
8. **回滚/运行态**：`.dsh/` 不在 Git，回滚代码不影响流水线/验收数据；按 §5 备份 `.dsh/pipeline.json` 与（若存在）`.dsh/agent-assignments.json`。真实生产发布/SSH 工作区/深色主题与窄侧栏视觉沿用现状人工复测（不在本轮范围）。

## 8. 审批与记录留痕 / 历史发布

- **双复核留痕**：`.dsh/pipeline.json` → `stages[acceptance].status="approved"`（`reviewedAt=2026-10-27T04:33:41.698Z`，PM v2 复验「建议放行/阻断 0」）；`stages[approval].status="approved"`（`reviewedAt=2026-10-27T05:48:04.124Z`，`reviews[0]={"decision":"approve","actor":"owner"}`，Owner 面板人工确认）；随后 `stages[release].status="active"`（`startedAt=2026-10-27T05:48:04.493Z`）。
- **模型边界遵守**：运维未审批、未改业务代码/需求/设计/验收结论、未创建 Git 提交、未调用 `pipeline_record_release`（Host 工具在子代理不可用，由 Lead 执行）。
- **历史发布**：
  - v1.2.73 团队三 Agent 能力升级：commit `0e764b2`（基线 `b3c1e77`），26 个文件，自测 check + test 18/18 + pipeline 38/38 + review 22/22；`releases` 已记录（environment=`local-workspace`，url=`http://127.0.0.1:3080`）。
  - v1.2.72 双复核模式：commit `2d8c761`（基线 `a504f99`），30 个文件，test 17/17 + pipeline 36/36 + review 22/22；`releases` 已记录。
  - 本轮 v1.2.75 的 `releases` 记录由 Lead 补写。
