# 测试报告：工作台 UI 修正（v1.2.77）

- 阶段 testing（第 5 轮）｜ 2026-10-27 ｜ QA `opc-qa` ｜ 需求：工作台 UI 修正 —— 长 tooltip/溢出、项目区 3 列对齐、需求修订折叠、视觉细化（v1.2.77）
- 环境：工作区 `/data/dsh/home/dsh-web-powerfilebrowser/dsh-web-filebrowser`；Linux；Node **v24.22.0**；npm **11.19.1**；Git HEAD **ddbd843**（git 工作区仅 3 个改动文件——**该数字是版本控制计数，不是用例数**）
- 版本：根 `package.json` **1.2.77** ✔、`dsh-web-filebrowser-plugin/package.json` **1.2.77** ✔、`CHANGELOG.md` 含 `## 1.2.77 — 2026-10-27`
- 改动范围：**仅 `client.js`（+68/−20）** + 版本/CHANGELOG（Lead 预置）+ 本轮测试文档；**无 Host/依赖/数据改动**
- **结论：4 pass / 0 fail / 9 blocked（GUI 待 Owner）。** 静态检查 72 项全过（tooltip ≤80 字、摘要 wrap+2 行 clamp、项目区 3/2/1 列规则、修订默认折叠 + aria、视觉 tokens、i18n 25+122 键成对、diff 范围/无调试残留/版本/依赖）；回归命令全绿；blocked 9 项为纯 GUI/视觉（8 条 v1.2.76 旧项 + v1.2.77 视觉项），需 Owner 重建 bundle + 强刷后按 `docs/ACCEPTANCE.md` 批次 14 复测。**建议：通过（进入 acceptance 复核）。**

## 1. 范围

- 覆盖 `.dsh/acceptance.json` 中本轮 **13 条**：8 条 v1.2.76 遗留 GUI blocked（三区/hero/折叠/自动展开/视觉/option-a/无障碍/响应式）+ 5 条 v1.2.77 新项（tooltip/溢出、项目区 3 列、修订折叠、视觉清爽、回归安全）。
- 被测代码：`dsh-web-filebrowser-plugin/client.js`（**+68/−20**）—— ① 摘要/修订行 tooltip 改 ≤80 字；② 摘要 wrap + 2 行 clamp；③ 项目区 ≥1024 三列、≤1023 两列、≤700 单列；④ 需求修订默认折叠 + aria；⑤ 视觉细化（底色/边框/阴影/标题）。无 Host/依赖/数据改动。
- 测试代码：`.dsh/tmp/qa-static-v1277.mjs`（新增，**72 断言**）、`host-smoke`（31）、`pipeline/review/assignments` selftest。
- 不测（Owner 人工复测）：浏览器实际宽度溢出测量（360/768/1080/1440）、tooltip 悬停表现、修订折叠点击/键盘/刷新、视觉清爽与 option-a 目视比对；对应 9 条 blocked。

## 2. 命令与结果（2026-10-27T07:23Z）

| # | 命令 | 目的 | 退出码 | 耗时 | 通过数 / 总数 | 结论 |
|---|---|---|---|---|---|---|
| 1 | `npm run check` | 21 模块 `node --check`（client.js +68/−20） | **0** | 639 ms | 21/21 文件 | PASS |
| 2 | `npm run check:json` | JSON 文件校验 | **0** | 183 ms | JSON OK | PASS |
| 3 | `npm test`（host-smoke） | Host smoke 回归 | **0** | 696 ms | **31/31** | PASS |
| 4 | `node .dsh/tmp/team/pipeline-selftest.mjs` | 七阶段双复核回归 | **0** | 659 ms | **38/38** | PASS |
| 5 | `node .dsh/tmp/team/review-selftest.mjs` | 变更审阅回归 | **0** | 789 ms | **22/22** | PASS |
| 6 | `node .dsh/tmp/team/assignments-selftest.mjs` | 工作台指派器回归 | **0** | 167 ms | **27/27** | PASS |
| 7 | `node .dsh/tmp/qa-static-v1277.mjs` | v1.2.77 静态检查（tooltip/布局/修订折叠/视觉/i18n/范围/版本） | **0** | 137 ms | **STATIC PASS（72 断言）** | PASS |

**计数口径（唯一权威）**：host-smoke **31/31**、pipeline-selftest **38/38**、review-selftest **22/22**、assignments-selftest **27/27**、静态断言 **72**、验收项 **13 条**（4 pass / 0 fail / 9 blocked）。报告不使用 git 变更文件数作为用例数。

## 3. 静态检查（`.dsh/tmp/qa-static-v1277.mjs`，72 断言）

### 3.1 长 tooltip 与摘要溢出

- **无原始长 tooltip**：源码无 `title: requirement.detail`；需求修订行不再使用 `title: String(entry.detail …)`（仅在流水线「变更记录」组件保留独立 tooltip，与「需求与调整」无关）。
- 摘要 tooltip = `requirementSummaryText(requirement.detail).slice(0, 80)` → **≤80 字**；修订行 tooltip = `String(entry.title ?? '').slice(0, 80)` → **≤80 字**。
- `.ds-wb-adjust-summary` 含 `white-space: normal` + `word-break: break-word` + `overflow-wrap: anywhere` + `-webkit-line-clamp: 2`；容器 `min-width: 0`；无 `ds-wb-adjust-detail` 全文渲染路径（沿用 B1-A 口径）。

### 3.2 项目区 3/2/1 列

- 基础：`.ds-wb-zone-project-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }`（≤1023 两列）。
- 宽屏：`@media (min-width: 1024px) { … repeat(3, minmax(0, 1fr)); … }`，且 `.ds-wb-zone-project-grid .ds-wb-project-cell-wide { grid-column: auto; }` → 需求卡宽屏占 **1 列**（状态/团队/需求同行）。
- 窄屏：`@media (max-width: 700px)` 单列，`.ds-wb-project-cell-wide { grid-column: auto; }`；项目卡操作按钮 `flex-wrap: wrap` + `white-space: normal`；团队 chips 2 列、列表限高。
- 容器引用：`.ds-wb-page-inner`/`.ds-wb-zone*`/`.ds-wb-card` 均 `min-width: 0`。

### 3.3 需求修订默认折叠

- `const [requirementLogOpen, setRequirementLogOpen] = useState(false)`（默认折叠）。
- 折叠头为 `button` + `aria-expanded`（true/false）+ `aria-controls="ds-wb-reqlog-body"`；body `id` 对应、`hidden` 收起；chevron 图标 `aria-hidden`。
- 文案：`workbench.requirement.logToggle`（「修订记录（{count}）/ Requirement revisions」）与 `workbench.requirement.logEmpty`（「暂无修订记录 / No revisions yet」）zh/en 成对（`logEmpty` 当前未在渲染中使用，列 **OBS-01** 死键）。

### 3.4 视觉 tokens

新样式：页面底色 `bg-layer-2 55% mix`（更明显）；卡片 `1px` 边框（`label-caption 32%`）+ `box-shadow: 0 1px 3px …9%` + 圆角 12 + padding 16；卡标题 12–13px；hero 左边框 4px 类目色；折叠行边框/阴影同步收紧；`min-width:0` 防溢出。

### 3.5 i18n / 代码 / 范围 / 版本

- i18n：`workbench.section.*` 7、`hero.*` 5、`fold.*` 8、`requirement.*` **5**（旧 3 + 新 2）= **25** 个 workbench 新键，zh/en 各 25 完全成对；旧 `workbench.assign.*` **122/122** 未破坏；词典总计 1204/1204、无单向缺失。
- 代码：`node --check client.js` exit 0；新增行无 `console.log`/`debugger`。
- 范围：`git diff` 仅 `client.js`、`CHANGELOG.md`、插件 `package.json`（版本）+ 本轮测试文档；**无 Host 模块**（index/assignments/pipeline/review/acceptance）改动；未被跟踪的仅 docs 资产。
- 依赖：两个 `package.json` 的 `dependencies` 与 HEAD **完全一致（未新增）**。
- 版本：根 1.2.77、插件 1.2.77、CHANGELOG `## 1.2.77 — 2026-10-27`。

## 4. 用例与结果

- `qa-static-v1277.mjs`：i18n 15 + tooltip/摘要 9 + 布局 12 + 修订折叠 9 + 视觉 7 + 代码/范围 8 + 版本/依赖 5 + 其他 ≈ **72 断言全 PASS**。
- 回归：check（21 模块）、check:json、host-smoke 31/31、pipeline-selftest 38/38、review-selftest 22/22、assignments-selftest 27/27 全绿；Host 模块零改动 → 流水线/双复核/指派器/验收/交付/审阅无实现层回归。

## 5. 13 条验收项逐条对照

### 5.1 v1.2.77 新增 5 条

| # | 验收项 id | 验收项（结论式） | 结论 | 证据 / 原因 |
|---|---|---|---|---|
| 1 | `97728928e2` | 长 tooltip 与横向溢出已修复：悬停摘要/修订行不再出现超长单行提示 | **pass**（静态可证；宽度溢出留 Owner 抽查） | 静态：无 `title: requirement.detail`；摘要 tooltip ≤80 字、修订行 tooltip ≤80 字；摘要 wrap + 2 行 clamp + `min-width:0`；`node --check` 通过。360/768/1080/1440 实际溢出测量需 Owner 批次 14 复核（剩余风险） |
| 2 | `36e2155b0c` | 项目区布局与效果图一致：宽屏 3 列（状态/团队/需求同行），窄屏正确降级 | **pass**（静态可证；目视截图为 Owner） | 静态：`@media (min-width:1024px)` 3×1fr + 需求卡 `grid-column:auto`；基础 2 列；≤700 单列；按钮 wrap、chips 2 列、`min-width:0`。与 option-a 目视比对待 Owner |
| 3 | `cf0d0671ab` | 需求修订列表默认折叠为「修订记录 (N)」，展开可读且不溢出 | **pass**（静态可证；点击/刷新为 Owner） | 静态：`useState(false)` 默认折叠；button + `aria-expanded`/`aria-controls`/`hidden`；toggle 显示计数（i18n 2 键成对）；行 title ≤80 字、容器 `min-width:0`。点击/键盘/刷新恢复需 Owner |
| 4 | `4939bdcb62` | 视觉更清爽：底色/卡边框阴影/标题层级与效果图一致 | **blocked** | 纯视觉项：静态已证 tokens（底色 55% mix、1px 边框、0 1px 3px 阴影、12–13px 标题），对比度与“清爽”需 Owner 目视/工具实测 |
| 5 | `9b9e5093af` | 回归安全：测试全绿、diff 范围正确、无 Host/依赖/数据改动 | **pass** | §2 命令全绿（check/check:json/test 31/31/pipeline 38/review 22/assignments 27/qa-static STATIC PASS）；`git diff` 仅 client.js+docs（无 Host 模块）；dependencies 未新增；无 `.dsh` 数据改动 |

### 5.2 v1.2.76 遗留 8 条（保持 blocked，待 Owner 按批次 13+14 复测）

| # | 验收项 id | 验收项 | 结论 | 说明 |
|---|---|---|---|---|
| 6 | `b4d6cd2e33` | 工作台三区分层落地 | **blocked** | v1.2.76 已静态验证；视觉/空态呈现需 Owner 复测 |
| 7 | `dc651f1f45` | hero 当前阶段卡三态与主操作 | **blocked** | 同上（首屏/点击/超长摘要表现） |
| 8 | `b1c04ed3fb` | 交付区 5 卡默认收起/展开 | **blocked** | 同上（点击展开内容完整性/滚动） |
| 9 | `576044e996` | 失败自动展开+红点 | **blocked** | 同上（构造 fail 数据后的实际表现） |
| 10 | `60c8493783` | 视觉规范落地（底色/白卡/色条/字号/间距/对比度） | **blocked** | 同上（对比度实测） |
| 11 | `1902af2ad1` | option-a 基准一致 + 设计五维自评 | **blocked** | 同上（逐区目视比对） |
| 12 | `47d54ee97e` | 无障碍（aria/焦点/44px/reduced-motion） | **blocked** | 同上（键盘/读屏运行态） |
| 13 | `61289ca00a` | 响应式 ≤700 单列/三档无溢出 | **blocked** | 同上（360/768/1280/200% zoom 实测） |

**合计：pass 4 / fail 0 / blocked 9。**

## 6. 回归范围与结果

- Host 层：check（21 模块）、check:json、host-smoke 31/31、pipeline-selftest 38/38、review-selftest 22/22、assignments-selftest 27/27 全绿；**Host 模块零改动**（无 index/assignments/pipeline/review/acceptance diff），七阶段双复核/指派器/验收/交付/审阅无实现层回归。
- 客户端：`client.js` +68/−20 为定向修正（tooltip/布局 CSS/修订折叠/视觉 tokens），`node --check` 通过；旧 25+122 i18n 键与既有渲染函数保留。
- 数据：无 `.dsh/pipeline.json`/`.dsh/acceptance.json` 改动；无新增依赖；无调试残留。

## 7. 缺陷 / 阻塞

| ID | 标题 | 严重度 | 状态 | 说明 |
|---|---|---|---|---|
| — | v1.2.77 功能缺陷 | — | **无** | 静态 72 断言 + 全部回归命令通过 |
| OBS-01（非阻断） | `workbench.requirement.logEmpty` 已在 zh/en 词典定义但渲染未使用（死 i18n 键） | P3 | 观察 | 不影响功能/文案；可后续启用（无修订记录时显示空态）或删除 |
| BLOCKED-GUI | 9 条 GUI/视觉验收项：`4939bdcb62` + v1.2.76 的 8 条（b4d6cd2e33、dc651f1f45、b1c04ed3fb、576044e996、60c8493783、1902af2ad1、47d54ee97e、61289ca00a） | — | blocked（Owner 人工） | 需 Owner：① 重启 Harness（确保 Host 最新）；② **重建客户端 bundle**（client.js 有改动）；③ 强制刷新；④ 按 `docs/ACCEPTANCE.md` **批次 14**（并回归批次 13 的 8 项）逐项核对；⑤ 结果回填验收项。静态与自动化已验证，非实现缺陷。 |

## 8. 剩余风险

1. **GUI 未由 QA 浏览器实测**：9 条 blocked 覆盖 tooltip 悬停、360/768/1080/1440 实际溢出、项目区 3 列目视、修订折叠点击/键盘/刷新、视觉清爽与对比度、以及批次 13 的 8 项；自动化只能证明代码/CSS 规则存在。
2. **tooltip 为原生 title**：已限制 ≤80 字摘要，但不同浏览器/输入设备的 tooltip 展示样式不可控；完整内容仍走「查看完整需求」。
3. **3 列布局边界**：1024px 临界点两侧（1023/1024）需 Owner 实测确认无挤压/裁剪；≤700 单列与项目卡按钮换行需 360 实测。
4. **修订记录上限**：列表最多渲染 4 条（原逻辑），完整历史需在流水线/需求面板查看；`logEmpty` 未启用（OBS-01）。
5. 真实发布/SSH 工作区/深色主题沿用现状人工复测。

## 9. 结论与建议

- 自动化：`npm run check`（639ms）、`check:json`（183ms）、`npm test` 31/31（696ms）、pipeline-selftest 38/38（659ms）、review-selftest 22/22（789ms）、assignments-selftest 27/27（167ms）、`qa-static-v1277` **STATIC PASS**（137ms，72 断言）全部通过。
- 静态：tooltip ≤80 字/无原始 detail tooltip、摘要 wrap+2 行 clamp、项目区 3/2/1 列（需求卡宽屏单列）、修订默认折叠+aria、视觉 tokens、i18n 25+122 键成对、diff 仅 client.js+docs、无 Host/依赖/数据改动、版本/CHANGELOG 1.2.77。
- 验收：**4 pass / 0 fail / 9 blocked**；无功能缺陷，仅 1 条 P3 观察（死 i18n 键）。
- **建议：通过**，提交 testing 阶段；由 Owner 重建 bundle + 强刷，按 `docs/ACCEPTANCE.md` 批次 14（含回归批次 13 的 8 项）完成 GUI/视觉人工复测，随后进入 acceptance 复核与 approval 人工确认。未改业务代码、未审批、未创建 git 提交。
