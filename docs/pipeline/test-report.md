# 测试报告：交付区取消折叠（v1.2.78）

- 阶段 testing（第 6 轮）｜ 2026-10-27 ｜ QA `opc-qa` ｜ 需求：按 Owner「不要折叠」彻底取消交付区折叠，5 张卡直接展示（v1.2.78）
- 环境：工作区 `/data/dsh/home/dsh-web-powerfilebrowser/dsh-web-filebrowser`；Linux；Node **v24.22.0**；npm **11.19.1**；Git HEAD **6ea6011**（git 工作区仅 3 个改动文件——**该数字是版本控制计数，不是用例数**）
- 版本：根 `package.json` **1.2.78** ✔、`dsh-web-filebrowser-plugin/package.json` **1.2.78** ✔、`CHANGELOG.md` 含 `## 1.2.78 — 2026-10-27`
- 改动范围：**仅 `client.js`（+10/−182）** + 版本/CHANGELOG（Lead 预置）+ 本轮测试文档；**无 Host/依赖/数据改动**
- **结论：3 pass / 0 fail / 7 blocked（GUI 待 Owner）。** 静态检查全过（无 fold 残留、无 fold 死键、交付区 `.ds-wb-delivery-grid` 两列/单列、5 卡直接渲染且顺序正确、标题不截断、保留项无回归、范围/版本/依赖正确）；回归命令全绿；blocked 7 项为 v1.2.76/v1.2.77 遗留的纯 GUI/视觉项，需 Owner 重建 bundle + 强刷后按 `docs/ACCEPTANCE.md` 批次 15 复测。**建议：通过（进入 acceptance 复核）。**

## 1. 范围

- 覆盖 `.dsh/acceptance.json` 中本轮 **10 条**：7 条旧 GUI blocked（三区/hero/视觉规范/option-a/无障碍/响应式/视觉清爽，保持）+ 3 条新项（交付区不折叠、两列/单列布局与标题、回归安全）。
- 说明：v1.2.76 的折叠相关验收项（`b1c04ed3fb` 5 卡折叠、`576044e996` 失败自动展开）随「取消折叠」**作废**，已不在清单中。
- 被测代码：`dsh-web-filebrowser-plugin/client.js`（**+10/−182**）—— 移除 fold state/handlers/JSX/aria、「展开全部/收起全部」、8 个 `workbench.fold.*` 键、全部 fold CSS；交付区改 `.ds-wb-delivery-grid` 直接渲染 5 张卡（≥1024 两列、≤1023 单列），flowCard 在网格之前；三区/hero/需求摘要/项目区三列/修订记录折叠保留。
- 测试代码：`.dsh/tmp/qa-static-v1278.mjs`（新增，**60+ 断言**）、`host-smoke`（31）、`pipeline/review/assignments` selftest。
- 不测（Owner 人工复测）：实际浏览器布局（5 卡直接展示/两列/单列/标题不截断/内容完整/页面高度）、视觉与 option-a 目视比对；对应 7 条 blocked（本批新项为代码/静态可证 + Owner 视觉抽查）。

## 2. 命令与结果（2026-10-27T07:40Z）

| # | 命令 | 目的 | 退出码 | 耗时 | 通过数 / 总数 | 结论 |
|---|---|---|---|---|---|---|
| 1 | `npm run check` | 21 模块 `node --check`（client.js +10/−182） | **0** | 623 ms | 21/21 文件 | PASS |
| 2 | `npm run check:json` | JSON 文件校验 | **0** | 184 ms | JSON OK | PASS |
| 3 | `npm test`（host-smoke） | Host smoke 回归 | **0** | 696 ms | **31/31** | PASS |
| 4 | `node .dsh/tmp/team/pipeline-selftest.mjs` | 七阶段双复核回归 | **0** | 688 ms | **38/38** | PASS |
| 5 | `node .dsh/tmp/team/review-selftest.mjs` | 变更审阅回归 | **0** | 799 ms | **22/22** | PASS |
| 6 | `node .dsh/tmp/team/assignments-selftest.mjs` | 工作台指派器回归 | **0** | 176 ms | **27/27** | PASS |
| 7 | `node .dsh/tmp/qa-static-v1278.mjs` | v1.2.78 静态检查（fold 残留/交付网格/保留项/范围/版本） | **0** | 143 ms | **STATIC PASS（60+ 断言）** | PASS |

**计数口径（唯一权威）**：host-smoke **31/31**、pipeline-selftest **38/38**、review-selftest **22/22**、assignments-selftest **27/27**、验收项 **10 条**（3 pass / 0 fail / 7 blocked）。报告不使用 git 变更文件数作为用例数。

## 3. 静态检查（`.dsh/tmp/qa-static-v1278.mjs`）

### 3.1 fold 全部移除（无残留）

- **JS 状态/逻辑**：源码不含 `workbenchFolds`/`workbenchFoldsClosed`/`foldAutoKeys`/`foldDefinitions`/`isFoldOpen`/`toggleFold`/`expandAllFolds`/`collapseAllFolds`（断言逐一通过）。
- **类名/样式**：不含 `ds-wb-folds`/`ds-wb-fold`/`ds-wb-fold-head`/`-body`/`-count`/`-dot`/`-chevron`/`-auto`/`-title`；折叠区头「展开全部/收起全部」按钮与 `aria-expanded` 折叠逻辑已移除；`ds-wb-fold-head:focus-visible` 规则同步删除。
- **i18n**：`workbench.fold.*` 在 zh/en 词典均为 **0** 个（8 个死键已删除）；源码无 `workbench.fold.` 引用；其余键组保持：section **7**、hero **5**、requirement **5**、assign **122**，zh/en 词典总计 **1196/1196** 无单向缺失。

### 3.2 交付区直接渲染 5 卡（`.ds-wb-delivery-grid`）

- `const deliveryCards = [designCard, acceptanceCard, preflightCard, reviewCard, runningCard].filter((card) => card !== null)` → **顺序正确**、空卡过滤。
- 渲染：`zone-body` 内先 `flowCard`，后 `deliveryCards.length === 0 ? null : h('div', { className: 'ds-wb-delivery-grid' }, deliveryCards)` → **flowCard 在网格之前**、无折叠 body。
- 区头：`zoneHead('delivery', GlobeIcon, …, null)` → 无「展开全部/收起全部」动作。
- CSS：`.ds-wb-delivery-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: start; min-width: 0; }`（≥1024 两列）；`@media (max-width: 1023px) { .ds-wb-delivery-grid { grid-template-columns: minmax(0, 1fr); } }`（≤1023 单列）；无 `.ds-wb-fold-title`（标题不再被 nowrap/ellipsis 截断）。

### 3.3 保留项无回归（静态断言）

- 三区 `nowSection/projectSection/deliverySection` 顺序保留；hero 键/结构保留；需求摘要 `requirementSummaryText` + `line-clamp 2` 保留；项目区 `@media (min-width: 1024px)` 三列 + 需求卡 `grid-column:auto` 保留；`ds-wb-reqlog-toggle` 需求修订折叠保留（与交付区折叠无关）。

### 3.4 代码 / 范围 / 版本

- `node --check client.js` exit 0；新增行无 `console.log`/`debugger`。
- `git diff` 仅 `client.js`、`CHANGELOG.md`、插件 `package.json`（版本）+ 本轮测试文档；**无 Host 模块**（index/assignments/pipeline/review/acceptance）改动；未被跟踪的仅 docs 资产。
- 依赖：两个 `package.json` 的 `dependencies` 与 HEAD **完全一致（未新增）**。
- 版本：根/插件均 **1.2.78**；CHANGELOG `## 1.2.78 — 2026-10-27`。

## 4. 用例与结果

- `qa-static-v1278.mjs`：i18n 11 + fold 残留 20 + 交付网格 12 + 保留项 8 + 代码/范围/版本/依赖 10 ≈ **60+ 断言**，**STATIC PASS**；1 条非阻断观察（OBS-01：删除 fold CSS 后残留一个空 `@media (max-width: 1023px) {}` 死块）。
- 回归：check（21 模块）、check:json、host-smoke 31/31、pipeline-selftest 38/38、review-selftest 22/22、assignments-selftest 27/27 全绿；Host 模块零改动 → 流水线/双复核/指派器/验收/交付/审阅无实现层回归。

## 5. 10 条验收项逐条对照

### 5.1 v1.2.78 新增 3 条

| # | 验收项 id | 验收项（结论式） | 结论 | 证据 / 原因 |
|---|---|---|---|---|
| 1 | `2f1de591d0` | 交付区不折叠：5 张卡片直接展示（无展开/收起交互） | **pass**（静态可证；视觉抽查留 Owner） | `qa-static-v1278`：无 `workbenchFolds*`/`foldAutoKeys`/`expandAllFolds`/`collapseAllFolds`/`ds-wb-fold*`/`workbench.fold.*` 残留；无「展开全部/收起全部」区头动作；`deliveryCards` 直接渲染 5 卡（design/acceptance/preflight/review/running 顺序正确）。Owner 按批次 15 目视复核 |
| 2 | `be688825c6` | 交付区布局为两列/单列网格，卡片标题完整不截断 | **pass**（静态可证；实际宽度/标题为 Owner 抽查） | 静态：`.ds-wb-delivery-grid` 2 列 + `@media(max-width:1023px)` 单列；`min-width:0`/卡片间距 12；无 `.ds-wb-fold-title`（原 nowrap/ellipsis 标题截断规则已删）。360/768/1440 实测留 Owner |
| 3 | `1dd7983e03` | 回归安全：取消折叠后测试全绿、无 Host/依赖/数据改动 | **pass** | §2 命令全绿（check/check:json/test 31/31/pipeline 38/review 22/assignments 27/qa-static STATIC PASS）；diff 仅 client.js+docs/版本（无 Host 模块）；dependencies 未新增；无 `.dsh` 数据改动 |

### 5.2 遗留 7 条 GUI blocked（保持，待 Owner 按批次 13/14/15 复测）

| # | 验收项 id | 验收项 | 结论 | 说明 |
|---|---|---|---|---|
| 4 | `b4d6cd2e33` | 工作台三区分层落地 | **blocked** | 静态已验；视觉/空态呈现需 Owner |
| 5 | `dc651f1f45` | hero 当前阶段卡三态与主操作 | **blocked** | 同上（首屏/点击/摘要截断表现） |
| 6 | `60c8493783` | 视觉规范落地（底色/白卡/色条/字号/间距/对比度） | **blocked** | 同上（对比度实测） |
| 7 | `1902af2ad1` | option-a 基准一致 + 设计五维自评 | **blocked** | 同上（逐区目视比对，折叠相关已按取消折叠调整） |
| 8 | `47d54ee97e` | 无障碍（aria/焦点/44px/reduced-motion） | **blocked** | 同上（键盘/读屏运行态）。**注**：其折叠 aria-expanded/controls 部分已随「取消交付区折叠」作废，Owner 复测时只需复核其余无障碍项（section aria-labelledby、hero/按钮语义、焦点环、44px、reduced-motion） |
| 9 | `61289ca00a` | 响应式 ≤700 单列/三档无溢出 | **blocked** | 同上（360/768/1280/200% zoom 实测） |
| 10 | `4939bdcb62` | 视觉更清爽（底色/卡边框阴影/标题层级） | **blocked** | 同上（批次 14 视觉项；取消折叠后布局更长需一并目视） |

**合计：pass 3 / fail 0 / blocked 7。**

## 6. 回归范围与结果

- Host 层：check（21 模块）、check:json、host-smoke 31/31、pipeline-selftest 38/38、review-selftest 22/22、assignments-selftest 27/27 全绿；**Host 模块零改动**（无 index/assignments/pipeline/review/acceptance diff）。
- 客户端：`client.js` +10/−182 为「删除折叠 + 新增 delivery grid + 保留原卡」的定向改动，`node --check` 通过；5 卡渲染函数与内容均保留（仅去掉折叠包装）。
- 数据：无 `.dsh/pipeline.json`/`.dsh/acceptance.json` 改动；无新增依赖；无调试残留。

## 7. 缺陷 / 阻塞

| ID | 标题 | 严重度 | 状态 | 说明 |
|---|---|---|---|---|
| — | v1.2.78 功能缺陷 | — | **无** | 静态 60+ 断言 + 全部回归命令通过 |
| OBS-01（非阻断） | 删除 fold CSS 后残留一个空 `@media (max-width: 1023px) {}` 死块 | P3 | 观察 | 无功能影响；建议后续清理（可在下次 CSS 整理时删除） |
| BLOCKED-GUI | 7 条遗留 GUI/视觉验收项：b4d6cd2e33、dc651f1f45、60c8493783、1902af2ad1、47d54ee97e、61289ca00a、4939bdcb62 | — | blocked（Owner 人工） | 需 Owner：① 重启 Harness；② **重建客户端 bundle**；③ 强制刷新；④ 按 `docs/ACCEPTANCE.md` **批次 15**（并回归批次 13/14 保留项）逐项核对；⑤ 结果回填验收项。静态与自动化已验证，非实现缺陷。 |

## 8. 剩余风险

1. **GUI 未由 QA 浏览器实测**：5 卡直接展示/两列/单列/标题不截断/内容完整/页面变长、以及 7 条遗留视觉/无障碍/响应式项，均需 Owner 目视与视口实测。
2. **页面高度增加**：取消折叠后 5 卡全部展开，工作台页面比 v1.2.77 更长（预期行为）；Owner 需确认滚动与首屏可接受。
3. **旧折叠验收项作废**：`b1c04ed3fb`/`576044e996` 已随取消折叠移出清单；如后续恢复折叠需重新立验收项。
4. **空 CSS 块**（OBS-01）：无功能影响，可后续清理。
5. 真实发布/SSH 工作区/深色主题沿用现状人工复测。

## 9. 结论与建议

- 自动化：`npm run check`（623ms）、`check:json`（184ms）、`npm test` 31/31（696ms）、pipeline-selftest 38/38（688ms）、review-selftest 22/22（799ms）、assignments-selftest 27/27（176ms）、`qa-static-v1278` **STATIC PASS**（143ms，60+ 断言）全部通过。
- 静态：fold state/handlers/JSX/CSS/i18n 全部移除（无残留、无死键）；交付区 `.ds-wb-delivery-grid` 2 列/≤1023 单列；5 卡直接渲染顺序正确、flowCard 在前、标题不再被 fold-title 截断；三区/hero/需求摘要/项目区三列/修订折叠保留；diff 仅 client.js+docs/版本、无 Host/依赖/数据改动、版本 1.2.78。
- 验收：**3 pass / 0 fail / 7 blocked**；无功能缺陷，仅 1 条 P3 观察（空 CSS 块）。
- **建议：通过**，提交 testing 阶段；由 Owner 重建 bundle + 强刷，按 `docs/ACCEPTANCE.md` 批次 15（含回归批次 13/14 保留项）完成 GUI/视觉人工复测，随后进入 acceptance 复核与 approval 人工确认。未改业务代码、未审批、未创建 git 提交。
