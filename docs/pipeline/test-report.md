# 测试报告：工作台 Agent 指派器 MVP（v1.2.75）

- 阶段 testing（第 3 轮）｜ 2026-10-27 ｜ QA `opc-qa` ｜ 需求：工作台 Agent 指派器 MVP —— 选 Agent → 写任务 → 指派 → 状态追踪（v1.2.75）
- 环境：工作区 `/data/dsh/home/dsh-web-powerfilebrowser/dsh-web-filebrowser`；Linux；Node **v24.22.0**；npm **11.19.1**；Git HEAD **322064c**（工作区存在未提交改动，属本轮交付 + 文档修复；**该 git 文件数是版本控制计数，不是用例数**）
- 版本：根 `package.json` **1.2.75**、`dsh-web-filebrowser-plugin/package.json` **1.2.75**（DEF-01 已修复）、`CHANGELOG.md` 含 `## 1.2.75 — 2026-10-27`
- 流水线状态（`.dsh/pipeline.json`，第 3 轮）：product / design / development = approved，**testing = active**，acceptance / approval / release = pending（七阶段与双复核结构不变）
- **结论：6 pass / 0 fail / 6 blocked。** Host 数据层、状态机、边界、并发/原子写、i18n 静态、4 个 op 与全部自动化测试通过；DEF-01（插件版本）已修复并复测（两 package 均 1.2.75）；blocked 6 项均为**纯 GUI/视觉**验收项，需 Owner 重启 Harness + 重建客户端 bundle 后按 `docs/ACCEPTANCE.md` 批次 12 人工复测。**建议：通过（进入 acceptance 复核）。**

## 1. 范围

- 覆盖 `.dsh/acceptance.json` 中 v1.2.75 的 **12 条验收项**：工作台「团队与指派」卡、指派抽屉字段/校验、提交落盘与结构化指派单、关联阶段选择、状态机与操作、流水线只读不变式、4 个 Host op 的校验/上限/SSH/错误码、并发与原子写/坏文件恢复、i18n/无障碍/窄屏/无新依赖、测试全绿与回归、三张效果图落地、文档与版本同步。
- 被测文件：`dsh-web-filebrowser-plugin/assignments.js`（新增 771 行）、`dsh-web-filebrowser-plugin/index.js`（+4 ops）、`dsh-web-filebrowser-plugin/client.js`（纯新增 1683 行，含 122 键 i18n）、`package.json`（check 脚本 + 版本）、`CHANGELOG.md`、`docs/AGENT_TEAM.md`、`docs/PLAYBOOK.md`、`docs/ACCEPTANCE.md`、`docs/pipeline/{requirements,design}.md`、README（中英/插件）、`docs/proposals/mockups/*`。
- 测试代码：`scripts/selftest/host-smoke.mjs`（31 用例 = 原 18 + **13 个 assignments 用例**）、`.dsh/tmp/team/assignments-selftest.mjs`（新增，**27 用例**）、`pipeline-selftest`（38）、`review-selftest`（22）。
- 不测（Owner 人工复测）：浏览器 DOM 渲染/点击、抽屉键盘焦点与 Esc、窄屏底部面板、无障碍屏幕阅读器、三张效果图的视觉落地；真实发布与 SSH 工作区（不支持）。

## 2. 命令与结果（最终复跑 2026-10-27T04:21Z，DEF-01 修复后）

| # | 命令 | 目的 | 退出码 | 耗时 | 通过数 / 总数 | 结论 |
|---|---|---|---|---|---|---|
| 1 | `npm run check` | 21 个模块 `node --check`（新增 assignments.js） | **0** | 630 ms | 21/21 文件 | PASS |
| 2 | `npm run check:json` | JSON 文件校验 | **0** | 184 ms | JSON OK | PASS |
| 3 | `npm test`（host-smoke） | Host smoke：原 18 用例 + **13 个 assignments 用例** | **0** | 698 ms | **31/31** | PASS |
| 4 | `node .dsh/tmp/team/pipeline-selftest.mjs` | 七阶段双复核回归 | **0** | 690 ms | **38/38** | PASS |
| 5 | `node .dsh/tmp/team/review-selftest.mjs` | 变更审阅模块回归 | **0** | 794 ms | **22/22** | PASS |
| 6 | `node .dsh/tmp/team/assignments-selftest.mjs` | 指派器模块深测（新增） | **0** | 160 ms | **27/27** | PASS |
| 7 | `node --check dsh-web-filebrowser-plugin/client.js` | 客户端语法（+1683 行纯新增） | **0** | 37 ms | — | PASS |
| 8 | `node .dsh/tmp/qa-static-v1275.mjs` | 版本/依赖/i18n/链接/文档/表格静态复测（DEF-01 修复后） | **0** | 159 ms | STATIC PASS | PASS |
| 9 | `node .dsh/tmp/qa-static-v1275.mjs`（OBS 修复轮复跑） | 报告计数/OBS 更新后的静态复测 | **0** | 135 ms | STATIC PASS | PASS |
| 10 | `npm test`（OBS 修复轮复跑） | host-smoke 回归 | **0** | 704 ms | **31/31** | PASS |

**B1/B2 复验轮（2026-10-27T04:31Z）**：`npm run check` exit 0（640ms，21 模块）、`npm test` **31/31**（724ms）、`assignments-selftest` **27/27**（164ms）、`node .dsh/tmp/qa-static-v1275.mjs` → **STATIC PASS**（146ms）。

**计数口径（唯一权威）**：host-smoke **31/31**（18 既有 + 13 assignments）；assignments-selftest **27/27**；pipeline-selftest **38/38**；review-selftest **22/22**；`npm run check` 覆盖 **21** 个模块；验收项 **12 条**（6 pass / 0 fail / 6 blocked）。报告正文不再使用 git 变更文件数作为用例数。

关键输出末尾：

```text
npm test                → PASS: 31/31 host smoke checks（18 既有 + 13 assignments）
assignments-selftest    → 27/27 checks passed
pipeline-selftest       → 38/38 checks passed
review-selftest         → 22/22 checks passed
npm run check / check:json → exit 0
```

## 3. 静态检查

### 3.1 i18n（`workbench.assign.*`）

| 检查 | 结果 |
|---|---|
| zh 词典 `workbench.assign.*` 键数 | **122** |
| en 词典 `workbench.assign.*` 键数 | **122** |
| zh/en 成对（双向零缺失） | PASS（`assign zh not in en: []`、`assign en not in zh: []`） |
| client.js 中实际使用的 assign key（含动态前缀拼接） | **126** 处引用全部可解析（`dialog.stage.*` 7、`status.*` 6、`progress.*` 6、`member.*` 3 等动态基础键均存在） |
| 中文词典总键 / 英文词典总键 | 1179 / 1179（无单向缺失） |

### 3.2 客户端与依赖

- `node --check client.js` exit 0；`git diff --numstat client.js` = **+1683 / -0**（纯新增，原有功能代码零改动 → Owner 标签右键菜单、旧工作台卡片等无代码级回归风险）。
- `index.js` = **+79 / -0**（4 个 op 接线 + 注释），无删除。
- 依赖：根与插件 `package.json` 的 `dependencies` 与 HEAD **完全一致**（根 `ssh2`；插件 `@xterm/xterm`、`@xterm/addon-fit`、`ssh2`），**未新增**；`package.json` 仅改 `scripts.check`（加入 `node --check dsh-web-filebrowser-plugin/assignments.js`）与版本号。
- `pipeline.js` / `review.js` / `acceptance.js` 本轮 **零改动**（git status 为空）→ 七阶段/双复核/验收台无实现层回归。

### 3.3 文档 / 链接 / 版本

- AGENT_TEAM 含「工作台『团队与指派』（v1.2.75）」小节（含边界：阶段任务走闸门、临时任务 Owner 确认、指派不写流水线、Lead 用原生工具执行）；PLAYBOOK 含「工作台指派：指定 Agent 干活（v1.2.75）」；ACCEPTANCE 含「批次 12 · 工作台 Agent 指派器（v1.2.75）」。
- CHANGELOG 含 `## 1.2.75 — 2026-10-27`，文档化 `.dsh/agent-assignments.json`、4 个 op，并保留上一批 Editor tab context menu 记录。
- 专业质量证据（acceptance B1/B2 修复）：`docs/pipeline/engineering-research.md`（78 行，N/A 判定依据 + 内部模式借鉴表 + 出处/许可证 + 可靠/安全/性能自检 + 来源记录 + 结论）；`docs/pipeline/design.md` §15「设计自检评分」（五维 rubric 锚点、每维≥3/均分≥4/must 一票否决、本轮自评 **4.2/5.0** 逐维证据、must 7 项自检、结论可提交）。
- 相对链接：全仓 **121 个相对链接目标 / 0 死链 / 0 空目标**；本轮 9 个改动 Markdown 的表格列数全部一致（引用链接 `../proposals/mockups/*`、`design/*.svg` 均可解析）。
- 版本：根 **1.2.75** ✔；插件 **1.2.75** ✔（DEF-01 已修复：插件 package.json 1.2.73 → 1.2.75，仅版本号 1 行，dependencies 未动）；`qa-static-v1275.mjs` → **STATIC PASS**。

## 4. 用例与结果

### 4.1 host-smoke 新增 13 个 assignments 用例（31/31 PASS）

| # | 用例 | 结果 |
|---|---|---|
| 1 | 常量/状态/角色/阶段/优先级/空文档/路径 | PASS |
| 2 | save 落盘 + list 倒序 + 字段完整/round 来自 pipeline/0600/gitignore | PASS |
| 3 | 必填与长度、acceptance 1–10、assignedTo 三选一互斥、role 白名单、approval/release 拒绝、priority、artifacts 上限 | PASS |
| 4 | 合法状态机 + updatedAt + history（含催办） | PASS |
| 5 | 非法流转 bad-transition 且文件字节不变 | PASS |
| 6 | 打回空 note 拒绝 / 有 note→failed / cancel | PASS |
| 7 | delete 仅终态、not-found、bad-id | PASS |
| 8 | 100 条上限 → `full` | PASS |
| 9 | corrupt（含路径、不清空）/ >1MB `too-large` / 修复可读 | PASS |
| 10 | SSH 四 op 均 `ssh-unsupported`；相对 root `bad-root` | PASS |
| 11 | **指派全生命周期前后 `.dsh/pipeline.json` sha256 不变**；approval/release 拒绝 | PASS |
| 12 | 10 并发保存不丢记录、无 temp 残留 | PASS |
| 13 | 无 `assignment*` 模型工具；36 tools / 10 routes 不变；index.js 4 op 接线 | PASS |

### 4.2 assignments-selftest 27 个用例（27/27 PASS）

覆盖：常量/空板、首写建目录与 0600、round 读取不写 pipeline、列表排序与 counts、title/detail/acceptance/assignedTo/stageId/priority/expectedArtifacts 全量边界、三选一互斥、合法状态机、催办限 dispatched/running、非法流转矩阵与文件不变、failed 需 note、三态 cancel、delete 终态/not-found/bad-id、update 守卫、history cap 50、99→100/full、corrupt 不清空、>1MB too-large（读+写）、坏条目归一化丢弃、SSH/bad-root、symlink outside-root/unsafe、10 并发无丢写、pipeline 哈希不变、index.js 恰好 4 op 且 check 脚本含 assignments.js。

### 4.3 回归

- `pipeline-selftest` 38/38、`review-selftest` 22/22 全绿；host-smoke 原 18 用例（7 阶段/双复核/迁移/scope/fast/工具/路由/验收/交付/审阅）全通过。
- 原有工作台/流水线/验收台/交付/待办/记忆代码未改（client.js 纯新增、index.js 纯新增、pipeline/review/acceptance 零改动），GUI 手工回归见 §7/§8 剩余风险（Owner 按批次 12 复测）。

## 5. 12 条验收项逐条对照

| # | 验收项 id | 验收项（结论式） | 结论 | 证据 |
|---|---|---|---|---|
| 1 | `64983c295b` | 「团队与指派」卡按规范出现（6 chips/推导状态/按钮/最近 5 条/空态） | **blocked** | 纯 GUI 项（卡片布局/位置/chips/空态）：代码静态存在（`workbench.assign.*` 122 键成对、client.js 纯新增）但需 Owner 重启 Harness + 刷新后人工核对；见 §8 |
| 2 | `ae5ecf6a53` | 提交后落盘 dispatched 记录 + 当前对话收到结构化指派单 + 卡片/toast 同步 | **blocked** | Host 侧已自动验证（save 全字段/round/history/dispatched = assignments-selftest）；「发到当前对话 + toast + 卡片刷新 + 防重复/部分失败重发」属浏览器 GUI，需 Owner 人工复测 |
| 3 | `8d70f5e331` | 抽屉字段与校验完整（必填、计数器、就地错误、验收 1–10、P1、新建 Agent） | **blocked** | GUI 项；Host 校验边界已由 27 用例覆盖（title/detail/acceptance/assignedTo/priority），抽屉交互需人工复测 |
| 4 | `6db436479d` | 关联阶段选择正确（自动 + 5 阶段 + 不关联；approval/release 置灰有提示） | **blocked** | Host 侧 allowlist 已自动验证（5 阶段/auto/空/approval·release 拒绝）；抽屉置灰与提示文案属 GUI，需人工复测 |
| 5 | `684ebc0d80` | 状态机与操作可用且持久（链路/打回 note/催办/取消/再指派/history/重启恢复） | **pass** | assignments-selftest + host-smoke：合法链路 dispatched→running→review→done、bad-transition 矩阵、failed 需 note、cancel、催办限 dispatched/running、history cap 50、持久化重读；状态卡按钮为展示层（剩余风险） |
| 6 | `1d2e016bda` | 指派不修改流水线（pipeline.json 哈希不变、阶段只读、approval/release 不可指派、双复核不被绕过） | **pass** | host-smoke「assigning never writes .dsh/pipeline.json」+ assignments-selftest sha256 前后一致；save 传 approval/release → `bad-request`；pipeline-selftest 38/38；AGENT_TEAM 记录边界文案 |
| 7 | `e37210ec44` | 4 个 Host op 的校验/上限/SSH/错误码稳定（≥8 边界用例） | **pass** | 27 用例覆盖 bad-request/bad-id/bad-transition/not-found/full/too-large/corrupt/ssh-unsupported/bad-root/三选一/stage 白名单；错误码稳定且失败不改文件 |
| 8 | `5048eff8ea` | 并发与原子写（10 并发不丢、无半写、坏文件可恢复且不静默清空） | **pass** | 10/12 并发保存均完整、id 唯一、JSON 可解析、无 `.tmp` 残留；corrupt 含路径且不清空、修复恢复；temp+rename 代码核对通过 |
| 9 | `74b92113c5` | i18n 中英文完整、无障碍、窄屏、无新依赖 | **blocked** | 静态已自动通过：122/122 键成对、126 处引用可解析、client 语法、依赖未新增；键盘焦点/Esc/44px/`prefers-reduced-motion`/窄屏底部面板需 Owner GUI 人工复测（代码存在 `role="dialog"`/aria-modal/媒体查询，未浏览器实测） |
| 10 | `c90a901f74` | 测试全绿 + 无回归 + host-smoke 覆盖指派 | **pass** | §2：check/check:json/test 31/31/pipeline 38/38/review 22/22/assignments 27/27 全部 exit 0；host-smoke 新覆盖 4 op 必填/上限/状态机/SSH/并发/流水线不变 |
| 11 | `19895d23f0` | 三张效果图关键布局/状态/操作落地（允许 §5.3 MVP 缩减） | **blocked** | 视觉/交互落地只能浏览器目视；设计稿与实现注意点已写入 design.md §3–§9，需 Owner 按批次 12「效果图落地」核对 |
| 12 | `7c8fa9c999` | 文档与版本同步：指派小节、ACCEPTANCE 批次 12、CHANGELOG 1.2.75、版本一致 | **pass**（DEF-01 修复后复测转 pass） | AGENT_TEAM/PLAYBOOK 指派小节 ✔、ACCEPTANCE 批次 12 ✔（本轮新增）、CHANGELOG 1.2.75 ✔、相对链接 121/0 死链 ✔；**DEF-01 已修复：根 + 插件 package.json 均 1.2.75**（插件 diff 仅版本号，dependencies 未动）；`node .dsh/tmp/qa-static-v1275.mjs` → **STATIC PASS**（159ms）。history：pending→fail→pass（retestRound=1）。证据：§2/§3.3/§7 |

**合计：pass 6 / fail 0 / blocked 6（GUI 待 Owner）。**

## 6. 数据层覆盖矩阵（assignments.js）

| 维度 | 覆盖 | 证据 |
|---|---|---|
| 4 个 op | list/save/update/delete + index.js 4 case | host-smoke、selftest、静态 |
| 字段约束 | title≤120、detail≤4000、acceptance 1–10×≤500、artifacts ≤10×≤500、note≤4000、history≤50 | 两套用例 |
| assignedTo | role（6 白名单）/member/newAgent 三选一互斥 | 两套用例 |
| stageId | 5 阶段 + auto + 空；approval/release 拒绝；未知拒绝 | 两套用例 |
| 状态机 | 合法链路、终端态、催办、非法流转矩阵 | 两套用例 |
| 上限/损坏 | 100 条 `full`、1MB `too-large`、`corrupt` 含路径不清空 | 两套用例 |
| 安全/降级 | SSH `ssh-unsupported`、相对 root `bad-root`、symlink `outside-root`/`unsafe`、0600 + `.gitignore` | 两套用例 |
| 原子写/并发 | temp+rename、per-root 锁、10 并发无丢写、无 temp 残留 | 两套用例 |
| 流水线不变式 | save/update/fail/cancel/delete 前后 sha256 一致；round 只读 | 两套用例 |

## 7. 缺陷 / 阻塞

| ID | 标题 | 严重度 | 状态 | 说明 / 修复建议 |
|---|---|---|---|---|
| DEF-01 | 插件 `dsh-web-filebrowser-plugin/package.json` 版本仍为 **1.2.73**，与根 **1.2.75** 不一致 | **P2（交付版本口径，阻断验收项 12）** | **已修复并复测通过** | Lead 已把插件版本升至 1.2.75（dependencies 未动，diff 仅 1 行）；复测 `node .dsh/tmp/qa-static-v1275.mjs` → **STATIC PASS**、`npm run check` exit 0（630ms）、`npm test` 31/31（698ms）、assignments-selftest 27/27、pipeline-selftest 38/38、review-selftest 22/22；item 12 转 pass（history pending→fail→pass）。 |
| BLOCKED-GUI | 6 条纯 GUI/视觉验收项：64983c295b、ae5ecf6a53、8d70f5e331、6db436479d、74b92113c5、19895d23f0 | — | blocked（Owner 人工） | Host 侧逻辑已全部自动验证通过，不作为实现缺陷。**Owner 复测步骤**：① 重启 Harness（加载 assignments.js + index.js 4 op）；② 重新构建/刷新客户端 bundle；③ 打开工作台按 `docs/ACCEPTANCE.md`「批次 12」逐项核对（卡片/抽屉/提交/阶段选择/无障碍窄屏/效果图）；④ 结果回填验收项。 |
| OBS-01（非阻断） | `.dsh/agent-assignments.json` 不在本轮交付清单，属运行时状态（`.dsh/` 已 gitignore） | P3 | 观察 | 与验收台/审阅一致，无需提交；交付包不包含该状态。 |
| B1（acceptance v2 打回） | 工程调研记录缺失：本轮实现涉及第三方复用判定，但缺 `docs/pipeline/engineering-research.md` | P1（验收阻断） | **已修复并复验通过** | 已新增 `docs/pipeline/engineering-research.md`（78 行）：§1 N/A 判定依据、§2 候选对比（不适用说明）、§3 内部模式借鉴表、§4 出处与许可证、§5 可靠/安全/性能自检、§6 来源记录、§7 结论；含「未复制第三方代码/未新增依赖」证据。复验：文件存在且章节齐全；依赖与 HEAD 一致（qa-static STATIC PASS）。 |
| B2（acceptance v2 打回） | 设计自评分缺失：design.md 无五维 rubric 自评与 must 项自检 | P1（验收阻断） | **已修复并复验通过** | design.md 新增 §15「设计自检评分（五维 rubric + 本轮自评）」：§15.1 五维锚点、§15.3 自评表（均分 **4.2/5.0**、逐维证据与扣分点）、§15.4 must 7 项自检、§15.5 结论可提交；并修正 §11.1/§16 的 v1.2.74 过期提醒（grep 命中均为「已解决」上下文）。复验：章节/数值/must 项齐全，qa-static STATIC PASS。 |
| OBS-02（PM 复核发现） | 插件 `dsh-web-filebrowser-plugin/package.json` 的 `files` 白名单缺 `assignments.js`（独立发布插件包会漏文件；根包用 `dsh-web-filebrowser-plugin/**` 不受影响） | P2（打包完整性） | **已修复并复验通过** | 开发已在 `files` 数组补 `assignments.js`；复测：`node -e "…files.some(f=>f.includes('assignments'))"` → **true**。 |
| OBS-03（PM 复核发现） | `docs/proposals/AGENT_ASSIGN.md` 状态仍为「提案（尚未实现）」 | P3（文档状态） | **已修复** | 复测：文件头部已改为「状态：**已按 MVP 实现（v1.2.75）**」，并补实现/验收链接；grep「提案（尚未实现）」无命中。 |
| OBS-04（PM 复核发现） | `docs/pipeline/design.md` §11.1 标注「当前 v1.2.74 行号」、§16 版本口径提醒引用旧 1.2.74（设计文档过期提醒） | P3（文档准确性） | **已修复** | 设计已改为 v1.2.75 口径；复测 `grep -n "v1.2.74\|1.2.74" docs/pipeline/design.md` 仅剩「版本口径（已解决）」「~~版本/验收项文案不一致~~ **已解决（1.2.75）**」两处已解决说明，不再是过期提醒。 |
| OBS-05（PM 复核发现，非阻断） | 成员 chips 间距实现例外：`.ds-wb-assign-members { gap: 7px }`，与 4/8px 体系不完全一致 | P3（视觉规范） | **已修复** | 开发已把 `.ds-wb-assign-members` 的 `gap` 由 7px 改为 **8px**（client.js 2 行 CSS）；复测 grep 确认 `gap: 8px`，chips 回到 4/8px 体系；design §15.3 记录该处已按 8px 落地。 |

## 8. 剩余风险

1. **GUI 未由 QA 浏览器实测**：6 条 blocked 项覆盖卡片/抽屉/结构化指派单/toast/键盘焦点/窄屏/视觉落地；代码与 i18n 静态验证通过，最终以 Owner 批次 12 人工复测为准。
2. **成员状态推导的局限**：MVP 按指派记录推导（空闲/执行中/待你确认），实时状态以 Harness 团队面板为准；不承诺阻塞/离线实时判定。
3. **阶段任务与流水线解耦**：指派不写 pipeline（已自动验证哈希不变），但阶段任务仍需 Owner 在流水线面板走闸门；若 Agent 误以为指派即推进，需要提示词/流程约束。
4. **新建 Agent 只记录 spawn 参数**：真正创建由 Lead `spawn_teammate` 执行；受 Harness 团队上限约束，创建失败需 Lead 回填（表单保留输入）。
5. **上限与历史**：100 条/1MB/history 50；长期使用需清理终态记录（仅终态可删）。
6. **版本口径**：DEF-01 已修复（根 + 插件均 1.2.75，dependencies 未动），已复测 STATIC PASS。
7. **acceptance v2 打回项已全部关闭**：B1（engineering-research.md N/A 记录）、B2（design.md §15 五维自评 4.2/5.0）已修复并复验；OBS-02（插件 files 白名单）、OBS-03（提案状态）、OBS-04（design 1.2.74 提醒）、OBS-05（chips gap 8px）均已修复/关闭，剩余无阻断。
8. 真实发布/SSH 工作区/深色主题沿用现状人工复测。

## 9. 结论与建议

- 自动化：`npm run check`（21 模块）、`check:json`、`npm test`（31/31，含 13 个 assignments 用例）、`pipeline-selftest`（38/38）、`review-selftest`（22/22）、`assignments-selftest`（27/27）、`node --check client.js` 全部 exit 0。
- 静态：i18n 122/122 成对且 126 处引用可解析；client.js +1683/-0；index.js +79/-0；依赖未新增；链接 121/0 死链；改动文档表格一致；AGENT_TEAM/PLAYBOOK/ACCEPTANCE 批次 12/CHANGELOG 1.2.75 齐全。
- 验收：**6 pass / 0 fail / 6 blocked（GUI 待 Owner）**；DEF-01、acceptance v2 打回的 B1/B2、OBS-02/03/04/05 **全部已修复并复验通过**，剩余**无阻断**；blocked 均为纯 GUI/视觉项（Host 逻辑已自动验证）。计数口径：host-smoke 31、assignments-selftest 27、pipeline-selftest 38、review-selftest 22、验收项 12 条。
- **建议：通过**，提交 testing 阶段；由 Owner 重启 Harness + 重建 bundle，按 `docs/ACCEPTANCE.md` 批次 12 完成 GUI/视觉人工复测，随后进入 acceptance 复核与 approval 人工确认。未改业务代码、未审批、未创建 git 提交。
