# 测试报告 —— 验收台分区可收起：证据库/复测/交付默认折叠 + 全部收起 + 分组折叠（v1.2.84）

- 角色：测试工程师（QA）；日期：2026-10-27 21:5x–22:0x（Asia/Shanghai）；阶段：testing（第 4/7，第 12 轮）。
- 被测版本：插件 `dsh-web-filebrowser-plugin/package.json` **1.2.84**；根 `package.json` **1.2.86**（工作区规定：交付后根版本 +1，当前已是交付前目标值）。
- 基线 commit：`1d85de4 v1.2.85 仓库/包瘦身：移除生成位图与 npm 包内 node_modules`（工作树未提交，本报告按未提交工作树测试）。
- 上游：`docs/pipeline/requirements.md`（§7 验收标准、§8 10 条验收项）、`docs/pipeline/design.md` §17（决策 D1–D8 / §17.9 a11y / §17.12.2 QA 断言）、`docs/ACCEPTANCE.md` 批次 22、`docs/pipeline/engineering-research.md` §5–§7（安全/性能/可访问性契约）。
- 结论：**质量门 3/3 全绿；静态断言 20/20；真实 GUI E2E 44/44；10 条验收项 pass 10 / fail 0 / blocked 0；未发现产品缺陷。建议进入 acceptance 阶段。**
- 旧报告已按工作区归档惯例原样归档到 `docs/pipeline/archive/v1.2.83-test-report.md`（v1.2.83 报告，20 578 B），本文件为第 12 轮新报告。

---

## 1. 测试环境与数据快照

| 项 | 值 |
|---|---|
| 工作区 | `/data/dsh/home/dsh-web-powerfilebrowser/dsh-web-filebrowser` |
| 被测版本 | 插件 `1.2.84` / 根 `1.2.86` / CHANGELOG `## 1.2.84 — 2026-10-27` / ACCEPTANCE「批次 22」 |
| 基线 commit | `1d85de4`（v1.2.85 仓库/包瘦身） |
| 运行时 | Node **v24.22.0**、npm **11.19.1**、Linux |
| Harness / GUI | 本机 DSH web 进程在 `127.0.0.1:3080` 运行（未重启、未改 Host）；页面 `lang=en`（英文界面） |
| 无头浏览器 | Playwright 缓存的 `chromium_headless_shell-1148` → **HeadlessChrome/131.0.6778.33**；`--headless --no-sandbox`；视口 1400×1000（deviceScaleFactor=2）；驱动 `.dsh/tmp/qa-v1284/cdp.mjs`（自 `gui-check/cdp.mjs` 加固：CDP 命令 25 s 超时 + JS dialog 自动 dismiss） |
| 字体 | Noto Sans SC（`FONTCONFIG_FILE=/tmp/fonts/fonts.conf`），中文数据分类名无豆腐块 |
| 客户端 bundle | 直接抓取本机实际下发的 `@local/dsh-web-dev-workspace/client.js` bundle，包含 `dsh-web-filebrowser:acceptance-collapse`、`No shares · none`、`Detail collapsed · selection kept, activate to expand` 等新文案 → 确认为 v1.2.84 新构建（QA 未重启/未重建，仅验证既有 3080 实际加载的版本） |
| 数据快照（只读） | `.dsh/acceptance.json` **64 条**（pending 10 / pass 31 / fail 0 / blocked 23），**36 个分类分组**；`.dsh/evidence/` 直接条目在测试前 30 个（≤40 上限），无 verification 记录 → 复测徽标 `No runs`，无 preview share / delivery → 交付徽标 `No shares · none` |
| 测试时间 | 2026-10-27 21:50–22:0x（Asia/Shanghai） |

> **只读边界**：QA 只写 `localStorage` 折叠偏好、UI 选中/筛选/模板开合与刷新，不点击状态按钮、删除、证据上传/删除、复测运行、打包、下载、预览分享等会改真实数据的操作；未修改 `client.js` / `package.json` / `CHANGELOG.md` / `docs/ACCEPTANCE.md` / `.dsh/acceptance.json` / `.dsh/pipeline.json`。

---

## 2. 本轮变更面核对（测试时点）

`git diff --stat`：**10 个已跟踪文件，+2059 / −843**（不含本报告写入）。

| 文件 | 变更 | 说明 |
|---|---|---|
| `dsh-web-filebrowser-plugin/client.js` | **+669 / −394** | 折叠区块渲染、分组/详情头、工具区单按钮、CSS、14 对 zh/en i18n、localStorage 读写 |
| `dsh-web-filebrowser-plugin/package.json` | +1 / −1 | 1.2.83 → **1.2.84** |
| `package.json` | +1 / −1 | 1.2.85 → **1.2.86** |
| `CHANGELOG.md` | +34 | 1.2.84 条目 |
| `docs/ACCEPTANCE.md` | +20 / −3 | 批次 22（11 条复测项） |
| `docs/pipeline/requirements.md` | +424 / −? | 第 12 轮需求 + 10 条验收项 |
| `docs/pipeline/design.md` | +664 | §17 设计（决策/a11y/QA 断言/视觉基线） |
| `docs/pipeline/engineering-research.md` | +691 / −? | 安全/性能/a11y 工程契约 |
| `README.md` / `README.zh.md` | 各 +1 | 一句说明同步 |

- **无 Host 模块改动**：`acceptance.js` / `pipeline.js` / `ssh.js` / `tasks.js` / `delivery.js` / `preview.js` / `index.js` 等均未在 diff 中（静态 S16 断言）。
- **无依赖变化**：`package.json` 与插件 `package.json` 的 diff 仅 `"version"` 一行（静态 S16 断言），无新增 npm 包、无 `vendor/` 变化。
- 未跟踪新增仅文档资产：`docs/pipeline/archive/v1.2.83-{requirements,engineering-research,test-report}.md`、`docs/pipeline/design/acceptance-collapse-*.svg` 8 张、生成脚本 `gen-acceptance-collapse-mockups.mjs`（静态 S16 断言）。
- `git diff --check` exit 0（无空白/冲突标记错误）。

---

## 3. 自动化结果（质量门）

命令均在 repo 根执行；原文见 `.dsh/evidence/v1.2.84-qa-quality-gates.log`。

| # | 命令 | 退出码 | 结果 | 结论 |
|---|---|---|---|---|
| 1 | `npm run check` | **0** | 21 个 Host/客户端/IO/Git 模块 `node --check` 全部通过 | PASS |
| 2 | `npm run check:json` | **0** | `JSON OK` | PASS |
| 3 | `npm test`（`scripts/selftest/host-smoke.mjs`） | **0** | **PASS 34/34** host smoke checks | PASS |
| 4 | `node .dsh/tmp/qa-v1284/static-assert.mjs` | **0** | **20/20** 静态断言（见 §4） | PASS |
| 5 | `node .dsh/tmp/qa-v1284/gui-e2e.mjs` | **0** | **44/44** 真实 GUI 断言（见 §5） | PASS |
| 6 | `node .dsh/tmp/qa-v1284/extra-shots.mjs` | **0** | 补充视觉基线：三区块全展开 / 360px / 691px（见 §6） | PASS |
| 7 | `git diff --check` | **0** | 空输出 | PASS |

- 测试脚本（不随包发布，`.dsh/` 已被 `.gitignore` 忽略）：
  - `.dsh/tmp/qa-v1284/static-assert.mjs` —— 20 条静态断言（结构/ARIA/i18n/CSS/storage/版本/diff）
  - `.dsh/tmp/qa-v1284/gui-e2e.mjs` —— 44 条真实 GUI 断言（headless chromium + CDP）
  - `.dsh/tmp/qa-v1284/cdp.mjs` —— 加固版 CDP 驱动（命令超时、dialog 自动处理、`waitFor`）
  - `.dsh/tmp/qa-v1284/extra-shots.mjs` —— 补充截图脚本
  - `.dsh/tmp/qa-v1284/{static-results,gui-results,extra-shots-results}.json` —— 机器可读结果

---

## 4. 静态断言结果（20/20）

扫描对象：`dsh-web-filebrowser-plugin/client.js`（含 `renderAcceptancePanel()` 渲染段切片）、两个 `package.json`、`CHANGELOG.md`、`docs/ACCEPTANCE.md`、`docs/pipeline/{requirements,design}.md`、`git diff`。

| # | 断言点 | 结果 | 实测证据 |
|---|---|---|---|
| S1 | 三区块折叠头由 `renderBlockHead` 渲染为**单一** `<button type="button">`，含 `aria-expanded` / `aria-controls`，头部不嵌套其它可聚焦控件 | PASS | `renderBlockHead` 内仅 title/badges/chevron span；无 input/按钮 |
| S2 | evidence / verify / delivery 三个区块头均渲染 | PASS | 3 处 `renderBlockHead(...)` 调用 |
| S3 | 三个区块体 id 与 `aria-controls` 一一对应，由 `hidden` 控制显隐 | PASS | `ds-acc-{evidence,verify,delivery}-body` + `hidden: blocksOpen.<x> === true ? undefined : true` |
| S4 | 分组头是 button，含 `aria-expanded` / `aria-controls` / `aria-label`（名称+数量）与计数徽标；持久化 key 用分类原值 | PASS | `ds-acc-group-head`、`groupToggle` 模板、`toggleAcceptanceGroup(key)` |
| S5 | 详情头是 button（48px），`aria-expanded`/`aria-controls` + 收起提示 + body `hidden` | PASS | `ds-acc-detail-toggle`、`detailCollapsed` 文案、CSS `min-height:48px` |
| S6 | `verificationOpen` 已删除且无内层「复测」开关；预选命令逻辑移到区块切换 | PASS | 全文件无 `verificationOpen` / `.ds-acc-verify-toggle`；`if (!open && key === 'verify' && verificationSelection.length === 0)` |
| S7 | 徽标最多 2 个、超出合并 `+n`、`title` 有完整文本、单枚 `max-width:96px` | PASS | `badges.slice(0, 2)`、`acceptance.badge.more`、96px |
| S8 | **14 对新 i18n key** 中英文成对且非空 | PASS | collapseAll / expandAll / collapseAllTitle / expandAllTitle / block.delivery / badge.retest / badge.retestEmpty / badge.share / badge.delivery / badge.deliveryEmpty / badge.more / detailToggle / detailCollapsed / groupToggle |
| S9 | `renderAcceptancePanel()` 渲染段**无硬编码中文** | PASS | 40 568 字符切片，CJK 命中 0 |
| S10 | CSS：清单 `min-height:96px`；三区块体 `max-height` 260/240/340；区块头 44 / 详情头 48 / 分组头 28 | PASS | 5 条规则逐条命中 |
| S11 | 区块头/分组头/详情头/工具按钮均 `:focus-visible` 2px brand 环；含 `prefers-reduced-motion` | PASS | 4 条 outline 规则 + reduced-motion |
| S12 | 折叠头不用 `label-caption`，次级文字用 `label-secondary`（对比度 D8） | PASS | v1.2.84 CSS 段检查 |
| S13 | localStorage 键名与默认值符合设计（三块收起、分组默认展开） | PASS | `dsh-web-filebrowser:acceptance-collapse`、`{blocks:{evidence:false,verify:false,delivery:false},groups:{}}`、`useState(read)` + `useEffect(write)` |
| S14 | localStorage 解析：**16 KiB 上限**、坏值**整份回退**、type 校验、危险键过滤、组数上限、写失败静默 | PASS | `raw.length > 16*1024`、`JSON.parse` try/catch、`dangerous = new Set(['__proto__','constructor','prototype'])`、key≤120、`kept>=256`、写 `catch {}` |
| S15 | 版本与文档：插件 1.2.84、根 1.2.86、CHANGELOG 1.2.84、ACCEPTANCE 批次 22、pipeline 文档同步 | PASS | 全部命中 |
| S16 | `git diff` 不含 Host 模块与依赖变化，工作树变更仅限允许文件；未跟踪仅 docs | PASS | `changed=10` 全部允许；包 diff 仅 version 行 |
| S17 | 「全部收起/展开」单按钮动态文案、`anyOpen` 含分组与详情、按钮不 disabled、不取消选中 | PASS | `acceptanceAnyOpen()` / `toggleAllAcceptanceBlocks()` / 两组 title 文案 |
| S18 | 详情：选中新项自动展开、手动收起保留选中、取消选中清空 | PASS | `if (item.id !== acceptanceSelected) setAcceptanceDetailOpen(true)` 等 |
| S19 | ARIA 目标唯一、分组 body id 按索引、收起保留挂载（`hidden` 而非卸载） | PASS | 3 个区块 body + detail body 各 1 个 id；`groupBodyId = 'ds-acc-group-body-' + index` |
| S20 | 渲染段无 `fetch` / 定时器 / 动态 import，折叠为纯本地状态 | PASS | forbidden token 扫描 0 命中 |

---

## 5. 真实 GUI E2E 用例表（44/44）

环境：headless chromium 131，1400×1000（@2×），本机 3080 实际下发的 v1.2.84 bundle。完整输出见 `.dsh/evidence/v1.2.84-qa-gui.log`，机器可读结果 `.dsh/evidence/v1.2.84-qa-gui-results.json`。覆盖验收项列对应 §8 的 10 条（A1–A10）。

### 5.1 默认态与三区块（A1/A4）

| # | 覆盖 | 步骤 | 预期 | 实际 | 结论 |
|---|---|---|---|---|---|
| Q0 | A1 | 打开 Dev Workspace → 侧栏 more → Acceptance；清 localStorage 后 reload 重开 | 验收台可见，64 条/36 组 | view=259×835，rows=64，groups=36 | PASS |
| Q1 | A1 | 读三区块头 DOM | 3 头 `aria-expanded=false` + body hidden + 头高≈44 | 44px，三块全部收起 | PASS |
| Q2 | A4 | 默认态量 `.ds-acc-list` | 清单 clientHeight > 300 | **492 px**（scrollHeight 19 634） | PASS |
| Q3 | A1 | 读三块徽标、证据项数 | 证据数 / `No runs` / `No shares · none`；每块 ≤2 枚且有 title | `40 evidence`（=40 items，上限 40）/ `No runs` / `No shares · none` | PASS |
| Q4 | A3 | 读工具区按钮 | 单按钮 `Collapse all`、可用、title/aria 说明作用域 | 文案/title/aria 全符合，非 disabled | PASS |
| Q5 | A5 | 读 36 个分组头 | 默认全部展开，计数徽标合计=64 | 36 组全展开，合计 64 | PASS |
| Q6 | A4 | 无选中时查详情 | 不渲染详情块 | 无 `.ds-acc-detail` | PASS |
| Q7 | A1 | 点证据头展开→再点收起 | aria/hidden 同步 | false→true→false，hidden true→false→true | PASS |
| Q8 | A1/A6 | 点复测头展开 | 无内层「复测」开关，直接显示最近结果+命令区+运行按钮 | 无 `.ds-acc-verify-toggle`；按钮 `Retest` / `Detect again` | PASS |
| Q9 | A1 | 点交付头展开 | 4 个交付按钮 + 端口输入 + 空态提示 | 4 按钮 + port 5173 输入 + 空态 | PASS |
| Q10 | A4 | 三区块同开量清单 | 清单保底 96px（不被压到 0） | 139 px（≥96） | PASS |

### 5.2 全部收起 / 展开（A3）

| # | 覆盖 | 步骤 | 预期 | 实际 | 结论 |
|---|---|---|---|---|---|
| Q11 | A3 | 点 `Collapse all` | 三区块+36 分组全收起，按钮变 `Expand all` | blocks 3/3、groups 36/36 收起；visible rows=0；按钮 `Expand all` | PASS |
| Q12 | A3 | 点 `Expand all` | 三区块+分组全展开，按钮回 `Collapse all` | 3/3 + 36/36 展开 | PASS |
| Q13 | A3 | 连续 2 轮全收起/全展开 | 状态与 storage 一致、不漂移 | 2 轮一致，storage 每次同步 | PASS |
| Q23 | A3 | 选中一行后点 `Collapse all` | 选中不被取消；详情收起且提示；行高亮仍在 | 选中保留，detail collapsed + caption，行 `data-selected=true` | PASS |
| Q24 | A3 | 再点 `Expand all` | 三区块+分组+详情（有选中）全展开 | 全部展开，详情恢复 | PASS |

### 5.3 持久化 / 坏值回退（A2）

| # | 覆盖 | 步骤 | 预期 | 实际 | 结论 |
|---|---|---|---|---|---|
| Q25 | A2 | 设混合态（证据展开、复测/交付收起、分组#0 收起、#1 展开） | 写入可解析 JSON，blocks/groups 均为 boolean，与 UI 一致 | `{"blocks":{"evidence":true,"verify":false,"delivery":false},"groups":{...36}}`，783 B | PASS |
| Q26 | A2 | reload 并重开验收台 | 三块+分组混合态保持，选中不持久化 | blocks=true,false,false；groups[0]=false、[1]=true；无 detail | PASS |
| Q27 | A2 | `localStorage=not-json` → reload | 整份回退默认（三块收起/分组展开），无控制台错误 | 回退默认；0 console errors | PASS |
| Q28 | A2 | 坏形状 `{"blocks":{"evidence":"bad"},"groups":{"constructor":true,"prototype":true}}` → reload | 回退默认、无异常、危险键不生效 | 回退默认，0 异常 | PASS |
| Q29 | A2 | 模拟 `Storage.prototype.setItem` 抛异常（隐私模式/配额） | UI 仍可切换、异常被吞、不崩溃 | 区块头正常展开，无未捕获异常 | PASS |

### 5.4 分组折叠（A5）

| # | 覆盖 | 步骤 | 预期 | 实际 | 结论 |
|---|---|---|---|---|---|
| Q14 | A5 | 读 36 个分组头 | button[type=button]，名称+数量徽标+aria-label，高 28 | 36 个按钮，例 `"version-docs, 2 item(s)"`，28px | PASS |
| Q15 | A5 | 点分组#0 收起→展开 | 组内行不可见/不占位，再点恢复 | visible rows 64→62→64，组内可见行 0 | PASS |
| Q16 | A5/A6 | 收起分组后组头 focus + Tab | 组内条目不参与 Tab，直接到下一组头 | 组头 #0 → #1（body 被跳过） | PASS |
| Q17 | A5 | 折叠组内勾选一行→批量条出现→清除 | 勾选/批量条/清除正常，不写数据 | 批量条出现并可清除 | PASS |
| Q22 | A5/A9 | 依次点 All/Open/Failed/No evidence → 回 All | 不报错、分组重建、行数随筛选变化、回 All=64 | Open 33/21、Failed 0/0、No evidence 3/2、All 64/36 | PASS |

### 5.5 清单与详情（A4）

| # | 覆盖 | 步骤 | 预期 | 实际 | 结论 |
|---|---|---|---|---|---|
| Q18 | A4 | 点第一条可见行 | 详情头 48px + 标题 + aria-expanded=true + body 可见 + 选中行高亮 | 48px，标题与行一致 | PASS |
| Q19 | A4 | 点详情头收起 | body hidden、出现「Detail collapsed · selection kept…」、选中行仍高亮 | caption 正确，`data-selected=true` 保留 | PASS |
| Q20 | A4 | 选另一条 | 详情自动重新展开、标题更新 | aria-expanded=true，标题更新 | PASS |
| Q21 | A4 | 点 Cancel 取消选中 | 详情整块消失，清单高度不塌（≥96） | detail 移除，selected 清除，list 96→96 | PASS |

### 5.6 键盘 / ARIA（A6）

| # | 覆盖 | 步骤 | 预期 | 实际 | 结论 |
|---|---|---|---|---|---|
| Q30 | A6 | 读 live DOM 三个区块头 + 36 分组头 + 详情头 | 全为 button[type=button]，`aria-expanded`/`aria-controls` 齐全、id 唯一 | 39 个头合法；detail head → `#ds-acc-detail-body` | PASS |
| Q31 | A6 | 键盘 Tab 到区块头 | 可到达，`:focus-visible` 2px 环 | outline 2px（rgb(15,17,21) 环） | PASS |
| Q32 | A6 | Enter 切换 | aria-expanded 同步、焦点留在按钮 | false→true，焦点保持 | PASS |
| Q33 | A6 | Space 切换 | 同上 | false→true，焦点保持 | PASS |
| Q34 | A6 | 收起态证据头 Tab | 隐藏 body 被跳过，到复测头 | evidence head → verify head | PASS |
| Q35 | A6 | 分组头 Enter/Space | 切换且焦点保留 | Enter false→true，Space true→false | PASS |

### 5.7 响应式 / 主题（A7）

| # | 覆盖 | 步骤 | 预期 | 实际 | 结论 |
|---|---|---|---|---|---|
| Q36 | A7 | `.ds-side` 宽 345px | `.ds-acceptance-view` `scrollWidth ≤ clientWidth` | 344/344，side 344/344，overflowX=hidden | PASS |
| Q37 | A7 | 宽 260px | 无横向溢出；标题/徽标 ellipsis 不撑破 | 259/259；所有 block title/badge `textOverflow=ellipsis` | PASS |
| Q38 | A7 | 宽 691px（截图宽度） | 无横向溢出 | 690/690 | PASS |
| Q39 | A7 | `prefers-color-scheme: dark` + reload | 深色生效；头/徽标/箭头/选中行可读，正文对比 ≥4.5 | 对比：block title 17.45、badge 9.25、group 12.11、detail title 17.45、selected row 17.45、chevron 12.11 | PASS |
| Q40 | A7 | 浅色主题 | 正文/徽标/次级文字对比 ≥4.5 | block title 18.9、badge 5.8、group name 5.8 | PASS |

### 5.8 i18n / 只读回归 / 控制台（A8/A9）

| # | 覆盖 | 步骤 | 预期 | 实际 | 结论 |
|---|---|---|---|---|---|
| Q41 | A8 | 英文界面读折叠文案 | 区块标题/工具按钮/徽标/分组 aria 全英文、无中文残留 | lang=en；`Collapse all`；`Evidence library / Verification center / Delivery & preview sharing`；无 CJK | PASS |
| Q42 | A9 | 只读冒烟：刷新、模板开合、四种筛选、勾选/清除、展开证据区/命令区/交付区 | 全部可用、无 JS 错误、无内层复测开关、交付 4 按钮 | refresh/templates/filters ok；evidence 40 项；verify 2 按钮；delivery 4 按钮 | PASS |
| Q43 | A9 | 全程 console 跟踪（4 个窗口段：初始 + 3 次 reload 关键段） | 无未处理异常/console.error | 0 runtime errors | PASS |

---

## 6. 证据截图清单（工作区相对路径，18 张 PNG + 4 份日志/结果）

| 文件 | 内容 | 对应验收项 / 检查 |
|---|---|---|
| `.dsh/evidence/v1.2.84-qa-default.png` | 默认态：三区块 44px 收起、徽标、清单 492px、分组头、`Collapse all` | A1/Q1–Q4 |
| `.dsh/evidence/v1.2.84-qa-expand-evidence.png` | 证据区块展开（40 项证据列表） | A1/Q7 |
| `.dsh/evidence/v1.2.84-qa-expanded.png` | 复测中心 + 交付与预览分享展开（无内层开关、4 交付按钮、端口/创建分享） | A1/Q8–Q10 |
| `.dsh/evidence/v1.2.84-qa-expanded-all.png` | 三区块全部展开（补充基线：list 96px、徽标三枚） | A1/A4/Q10 |
| `.dsh/evidence/v1.2.84-qa-all-collapsed.png` | 全部收起：36 分组全部收起、按钮变 `Expand all` | A3/Q11 |
| `.dsh/evidence/v1.2.84-qa-all-collapsed-selection.png` | 全收起 + 选中保留：详情头收起提示、选中行高亮 | A3/Q23 |
| `.dsh/evidence/v1.2.84-qa-group-collapsed.png` | 分组#0 收起（组内行消失，其余组正常） | A5/Q15 |
| `.dsh/evidence/v1.2.84-qa-detail.png` | 详情展开：48px 详情头 + 验收条件/备注/证据/状态历史、选中行 8% 底 + 2px 左条 | A4/Q18 |
| `.dsh/evidence/v1.2.84-qa-detail-collapsed.png` | 详情收起：body hidden + 「Detail collapsed · selection kept…」+ 选中行仍高亮 | A4/Q19 |
| `.dsh/evidence/v1.2.84-qa-mixed.png` | 混合折叠态（证据展开/复测收起/交付收起/分组#0 收起），持久化前 | A2/Q25 |
| `.dsh/evidence/v1.2.84-qa-persist-after-reload.png` | reload 后混合态保持 | A2/Q26 |
| `.dsh/evidence/v1.2.84-qa-bad-value-fallback.png` | 写 `not-json` 后 reload 回退默认（三块收起、分组展开） | A2/Q27 |
| `.dsh/evidence/v1.2.84-qa-keyboard-focus.png` | 键盘 Tab 聚焦区块头，`:focus-visible` 2px 环 | A6/Q31 |
| `.dsh/evidence/v1.2.84-qa-narrow-345.png` | 侧栏 345px 无横向溢出 | A7/Q36 |
| `.dsh/evidence/v1.2.84-qa-narrow-260.png` | 侧栏 260px 无横向溢出、徽标省略 | A7/Q37 |
| `.dsh/evidence/v1.2.84-qa-narrow-360.png` | 侧栏 360px（补充）：view/side 359/359 无溢出 | A7 |
| `.dsh/evidence/v1.2.84-qa-wide-691.png` | 侧栏 691px（补充截图宽度）：690/690 无溢出 | A7 |
| `.dsh/evidence/v1.2.84-qa-dark.png` | 深色主题：区块头/徽标/箭头/选中行/详情头，对比度抽检全 ≥4.5 | A7/Q39 |
| `.dsh/evidence/v1.2.84-qa-quality-gates.log` | check / check:json / npm test 命令原文 + 退出码 | A9 |
| `.dsh/evidence/v1.2.84-qa-static.log` | 静态断言 20/20 完整输出 | A1–A8/A10 |
| `.dsh/evidence/v1.2.84-qa-gui.log` | GUI E2E 44/44 完整输出（含每条实际值） | A1–A9 |
| `.dsh/evidence/v1.2.84-qa-gui-results.json` | GUI 断言机器可读结果（44 条） | A1–A9 |

> 说明：截图均由无头 Chromium 1400×1000 @2× 截取后按 `.ds-side` 面板区域裁剪；中文数据分类名（如「版本与记录」）按数据原值显示，非 UI 硬编码。

---

## 7. 发现的问题与复现步骤

### 7.1 产品缺陷

**未发现产品缺陷（P0/P1/P2 = 0）。** 所有 44 条 GUI 断言与 20 条静态断言通过；`npm run check` / `check:json` / `npm test 34/34` 全绿；无控制台异常。

### 7.2 测试侧修正记录（非产品问题，如实记录）

| # | 类型 | 内容 | 处理 |
|---|---|---|---|
| T1 | 测试脚本假阴性 | 首版 Q8 断言写成 `(() => ({...})())`，返回的是箭头函数本身而非对象，`bodyVisible` 恒为 `undefined`，误报「verify body still hidden」；聚焦复跑脚本证明复测区块点击后**立即**展开（`hidden=false` 在 t+0ms 成立） | 修正为 `(() => ({...}))()` 后 Q8 PASS；不属于产品缺陷 |
| T2 | 测试脚本假阴性 | 首版 Q11 把「全部分组收起后可见行」误期望为 36（组头不是 `.ds-acc-row`），实际应为 0 | 修正断言后 PASS |
| T3 | 测试脚本假阴性 | 首版 Q21 在「三区块全展开」状态下期望清单高度恢复 >100，实际为 96（min-height 保底，符合设计 D7） | 改为与取消前对比 + ≥96 后 PASS |
| T4 | 测试脚本时序 | 无头环境下 reload 场景的 `openPanel` 曾因等待条件选错（`.ds-side-tab-more` 需先打开工作区才存在）而每次慢 30 s | 改为等待 `button[aria-label="Dev Workspace"]` 后正常；最终 44/44 一次通过 |

### 7.3 观察项（非阻断，供 acceptance / Owner 参考）

| # | 观察 | 影响 | 建议 |
|---|---|---|---|
| O1 | 默认态（三区块收起、分组默认展开）下工具按钮显示 **`Collapse all`** 而非 `Expand all` | 设计 §17.3 D3 明确采用「anyOpen（含分组/详情）→ Collapse all」；首次进入点它会同时收起 36 个分组，可能与「三块已收起」的直觉略有出入 | 与设计一致，非缺陷；`title`/`aria-label` 已写明作用域（「收起三个分区、所有分类分组与详情」）。Owner 实机确认体验即可 |
| O2 | 证据徽标数字取客户端 `loadEvidence()` 的最近 40 条直接条目，该列表包含 `.dsh/evidence/` 下的**子目录名**（如 `pack-fix/`、`v1285/`）；截图随证据目录增长会自增 | 徽标数与 `acceptance.js` 的 `listEvidenceFiles`（仅普通文件）口径不同；上限 40 时徽标恒为 40 | 属既有证据列表实现（非本轮新增语义）+ 新徽标展示；建议后续单独需求统一口径（按文件过滤/排序）；本轮不阻断 |
| O3 | 无头截图顶部偶见「Reading Harness information…」提示（工作区信息仍在加载） | 与折叠功能无关，最终截图（等待后）已稳定；个别早期截图保留该提示 | 无影响 |

---

## 8. 10 条验收项结论

| # | 验收项（category） | 结论 | 主要证据 | 备注 / 限制 |
|---|---|---|---|---|
| 1 | 证据库、复测中心、交付与预览分享默认收起，点区块头即可展开/收起并显示数量徽标（acceptance-collapse） | **pass** | Q1–Q10、S1–S3/S7；截图 default / expanded-all / expand-evidence | 证据徽标=40 为「最近 40 条」上限口径（见 O2） |
| 2 | 折叠状态持久化到 localStorage，刷新与重开面板后保持，损坏或不可用时回退默认且不崩溃（acceptance-collapse） | **pass** | Q25–Q29、S13–S14；截图 mixed / persist-after-reload / bad-value-fallback | 隐私模式用 `Storage.prototype.setItem` 抛错模拟，未开真实无痕窗口 |
| 3 | 「全部收起 / 全部展开」一次作用于所有可折叠区块（含分组与详情）且持久化（acceptance-collapse） | **pass** | Q11–Q13、Q23–Q24、S17；截图 all-collapsed / all-collapsed-selection | 单按钮动态文案，重复两轮幂等 |
| 4 | 验收项清单默认展开并占满剩余高度；选中详情随选中展开、可收起、取消选中即收起（acceptance-collapse） | **pass** | Q2、Q6、Q10、Q18–Q21、S10/S18/S19；截图 default/detail/detail-collapsed | 三块收起时清单 492px；三块全开时保底 96–139px |
| 5 | 分类分组头可折叠且带数量徽标，折叠不影响勾选、批量、状态操作与筛选（acceptance-collapse） | **pass** | Q5、Q14–Q17、Q22、S4；截图 group-collapsed | 勾选/批量条/清除为只读选择，未执行批量三操作写数据 |
| 6 | 折叠头为 button 且 aria-expanded/aria-controls 同步，Enter/Space 可切换，焦点可见，收起内容不参与 Tab（acceptance-a11y） | **pass** | Q30–Q35、S1–S6/S11；截图 keyboard-focus | 焦点环 2px；隐藏 body 跳过 Tab 已实测 |
| 7 | 360px 侧栏与 691px 截图宽度下无横向溢出，浅/深主题可读（acceptance-layout） | **pass** | Q36–Q40 + 补充 360/691（359/359、690/690）；截图 narrow-345/260/360、wide-691、dark | 深色对比抽检 9.25–17.45，浅色 5.8–18.9（均 ≥4.5） |
| 8 | 中英文折叠文案齐全、无硬编码中文、缺失回退合理（acceptance-i18n） | **pass** | S8（14 对 key 成对非空）、S9（渲染段 0 CJK）、Q41（英文界面无中文残留） | GUI 当前语言为 en；**zh 运行时切换未实测**（静态键值成对 + 英文渲染已验证）；「删一个 en 键回退」未在运行时执行（`t()` 既有回退机制未改动） |
| 9 | 验收台既有操作与全局功能无回归，质量门全绿（acceptance-regression） | **pass** | `check`/`check:json`/`test 34/34`（§3）、S16（diff 仅 client.js/版本/文档，Host 与依赖未动）、Q42（刷新/模板/筛选/勾选/证据区/命令区/交付按钮只读冒烟）、Q43（0 console error） | 受 QA 只读边界限制：状态修改、删除、证据上传/删除、复测运行、打包/下载、预览分享创建/关闭等**写操作未在真实数据上执行**；依据为「相关 handler 未被 diff 触及 + 质量门全绿 + 只读冒烟」 |
| 10 | 版本与文档同步到 1.2.84 且交付后根版本 1.2.86，只改允许文件（version-docs） | **pass** | S15/S16；`git diff --stat`（§2） | 根版本 1.2.86 已是当前值；`git diff` 无 Host/依赖变更 |

**统计：pass 10 · fail 0 · blocked 0。**

---

## 9. 安全 / 性能 / 可访问性核查

| 维度 | 结论 | 证据 |
|---|---|---|
| localStorage 解析安全 | 16 KiB 上限、`JSON.parse` try/catch、根/字段类型白名单、`__proto__`/`constructor`/`prototype` 跳过、分类 key ≤120/最多 256 条、任何不符整份回退、写失败静默 | S14；Q27–Q29 |
| 无新增网络/Host 面 | 折叠仅 `setState` + `localStorage.setItem`；渲染段无 `fetch`/定时器/动态 import；diff 无 Host 模块 | S16/S20；Q43 |
| 注入/XSS | 折叠头标题/徽标/分类名全部走 React 文本节点与 `title`，渲染段无 `innerHTML`/`dangerouslySetInnerHTML`/`insertAdjacentHTML`/`eval` | 静态扫描渲染切片；全文件 `dangerouslySetInnerHTML` 0 命中 |
| DOM id 安全 | 区块 id 固定字面量；分组 id 用数字索引（不拼分类名）；`aria-controls` 断言命中唯一 id | S19；Q30 |
| a11y | 三头+分组头+详情头均为 `button[type=button]`；`aria-expanded`/`aria-controls` 同步；Enter/Space 切换且焦点保留；`:focus-visible` 2px；隐藏 body 跳过 Tab；触控高度 44/48/28（28 为设计声明的既有指针密集例外） | Q30–Q35、S10/S11、design §17.9 |
| 对比度 | 深色 block title 17.45 / badge 9.25 / group 12.11 / detail title 17.45 / selected row 17.45 / chevron 12.11；浅色 title 18.9 / badge 5.8 / group 5.8（全部 ≥4.5:1） | Q39/Q40 |
| 响应式 | 侧栏 260 / 345 / 360 / 691 / 默认 259 宽度下 `view.scrollWidth == clientWidth`，无横向滚动；长标题/徽标 ellipsis | Q36–Q38 + 补充截图 |
| 性能 | 折叠不新增请求、不卸载 DOM（`hidden`）、无动画/定时器；未做 16ms 级基准与长任务录制（见 §11 残余风险） | S20/工程契约 §6 |
| 版本/依赖 | 插件 1.2.84、根 1.2.86、CHANGELOG/ACCEPTANCE 批次 22；无 npm 依赖变化 | S15/S16 |

---

## 10. 回归覆盖与未覆盖项

**已覆盖（本 QA 轮次）**

- 质量门：`npm run check` / `npm run check:json` / `npm test`（34/34）。
- 验收台折叠相关全部交互：默认态、三区块展开/收起、全部收起/展开（含分组/详情）、混合持久化、坏值回退、写失败降级、分组折叠、详情展开/收起/自动展开/取消、四种筛选、键盘 ARIA、260/345/360/691 响应式、浅/深主题、英文 i18n、只读操作冒烟、控制台 0 错误。
- 版本与文档、diff 边界（无 Host/依赖/数据改动）。

**未覆盖（原因）**

| 项 | 原因 | 补偿证据 |
|---|---|---|
| 验收项状态修改、删除、备注保存 | 会改真实 `.dsh/acceptance.json`（QA 只读边界） | 相关 handler 未在 diff 中；Host smoke 覆盖 acceptance 数据层用例 |
| 证据上传/删除、复测运行、打包/下载、预览分享创建/复制/打开/关闭、交付记录/交付包下载 | 同上（写数据/占用端口/产生交付物） | diff 未触及这些 handler；`npm test` 覆盖 delivery/acceptance/preview Host 路径；Q42 验证入口存在且可展开、无 JS 错误 |
| 工作台/流水线/任务/文件树/SSH/Git 面板冒烟 | 本轮为纯 client.js 验收台渲染改动，其它面板无 diff | 静态 S16（无 Host 模块改动）+ 质量门；建议 Owner 按批次 22「既有功能无回归」复测清单确认 |
| zh 运行时界面切换 | GUI 当前 locale 为 en，切换语言属于设置交互（不在只读范围） | S8 静态 14 对 key 成对 + Q41 英文无中文；`t()` 机制未改动 |
| 100%/200% 缩放、真实多标签并发、真实无痕模式、`prefers-reduced-motion` 实际效果、16ms 切换耗时 | 无头环境/超出本轮只读范围 | `prefers-reduced-motion` CSS 静态断言；设计未要求高度动画；建议 Owner 实机顺带目检 |

---

## 11. 残余风险

1. **中文界面运行时验证**：zh 文案只做了静态成对断言，未在 GUI 中实际切换到中文后目检；若 `t()` 的 zh 映射与 en 渲染存在运行时差异，理论上仍可能漏检（概率低：两 locale 同文件、14 对 key 均非空）。
2. **写操作回归未实测**：验收项状态/批量/删除/备注、证据上传删除、复测运行、打包下载、预览分享均为真实写操作，本轮按边界未执行；建议 Owner 在批次 22 复测时按清单点一遍。
3. **证据徽标口径**（O2）：`40 evidence` 为「最近 40 条直接条目（含子目录名）」上限值，与 Host `listEvidenceFiles` 的「仅普通文件」口径不同；后续若统一口径需另立需求。
4. **无头 vs 实机**：截图与对比度来自 headless Chromium + Noto 字体，真实显示器/系统主题/字体设置下视觉可能有细微差异；建议 Owner 实机按 `docs/ACCEPTANCE.md` 批次 22 复测一次。
5. **性能未量化**：未实测「切换 <16ms」与长任务；依据为无动画/无请求/无卸载的代码结构 + GUI 交互无卡顿观感，属设计目标而非实测数据。
6. **多标签并发写 localStorage**：设计接受「最后写入者生效、无 storage 事件同步」，本轮未测；不影响单标签使用。
7. **证据目录自增长**：QA 证据截图本身进入 `.dsh/evidence`（40 上限）——非产品问题，但会让徽标显示 40、并可能挤掉更早的证据条目；建议后续清理/归档策略。

---

## 12. 结论与建议

- **质量门：3/3 exit 0**（`npm run check`、`npm run check:json`、`npm test 34/34`）。
- **静态断言：20/20 PASS；真实 GUI E2E：44/44 PASS**（0 console error）。
- **10 条验收项：pass 10 / fail 0 / blocked 0**（第 8、9 条附运行范围说明，见 §8）。
- **缺陷：未发现产品缺陷**；测试侧 4 条脚本假阴性/时序问题已修正并在最终一轮全绿（§7.2），3 条非阻断观察项见 §7.3。
- **建议：进入 acceptance（第 5/7 阶段）**；acceptance 复核可引用本报告、§6 截图与 `.dsh/evidence/v1.2.84-qa-*.log`。
- **Owner 复测入口**：`docs/ACCEPTANCE.md` 批次 22（11 条）；重点人工确认 O1（默认 `Collapse all` 文案直觉）、真实写操作回归、中文界面、实机浅深主题。重启 Harness / 重建 bundle 本轮未执行（既有 3080 已是 v1.2.84 bundle，QA 已验证实际下发的 bundle 含新文案）。
- **归档**：旧 v1.2.83 报告已原样保存为 `docs/pipeline/archive/v1.2.83-test-report.md`；本报告覆盖 `docs/pipeline/test-report.md`。
- **可复跑命令**：
  - `node .dsh/tmp/qa-v1284/static-assert.mjs`（20 断言，exit 0）
  - `FONTCONFIG_FILE=/tmp/fonts/fonts.conf node .dsh/tmp/qa-v1284/gui-e2e.mjs`（44 断言，exit 0；会写 `.dsh/evidence/v1.2.84-qa-*.png`）
  - `FONTCONFIG_FILE=/tmp/fonts/fonts.conf node .dsh/tmp/qa-v1284/extra-shots.mjs`（补充 3 张视觉基线）
