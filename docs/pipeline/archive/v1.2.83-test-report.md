# 测试报告 —— 设计先确认：设计稿截图 / HTML 预览 + 开发前人工闸门（v1.2.83）

- 角色：测试工程师（QA）；日期：2026-10-27 20:0x（Asia/Shanghai）；阶段：testing（第 4/7，第 11 轮）。
- 被测版本：插件 `dsh-web-filebrowser-plugin/package.json` **1.2.83**；根 `package.json` **1.2.83**（按工作区规定，交付后由 release 阶段 +1 至 1.2.84，本轮测试时点尚未 bump，符合阶段顺序）。
- 基线 commit：`2d3ebe0 fix(workbench): 打包交付不再清空流水线快照，修复跳回需求录入`（并行热修已在 HEAD，未回退；本报告把它作为回归项）。
- 上游：`docs/pipeline/requirements.md`（§7/§8，10 条验收项）、`docs/pipeline/design.md` §16、dev 阶段 summary。
- 结论：**自动化 10 套全绿、零失败**；`qa-static-v1283` **STATIC PASS（246 断言）**。10 条验收项建议 **5 pass / 0 fail / 5 blocked**（blocked 均为 GUI 视觉/交互与人工回归，需 Owner 按 `docs/ACCEPTANCE.md` 批次 20 复测）。无阻断缺陷。**建议进入 acceptance 阶段。**

> 本报告覆盖 v1.2.82 的旧 `test-report.md`。按工作区归档惯例，旧报告应移入 `docs/pipeline/archive/v1.2.82-test-report.md`；本次 testing 的写入范围限定为 `docs/pipeline/test-report.md` + `.dsh/tmp/` + `.dsh/evidence/`，未新建归档文件，建议 release 阶段随交付归档。

---

## 1. 基线与环境

| 项 | 值 |
|---|---|
| 工作区 | `/data/dsh/home/dsh-web-powerfilebrowser/dsh-web-filebrowser` |
| 被测版本 | 插件 1.2.83 / 根 1.2.83（CHANGELOG `## 1.2.83 — 2026-10-27`） |
| 基线 commit | `2d3ebe0`（含 v1.2.83「打包不再清空流水线快照」热修） |
| 运行环境 | Node v24.22.0；npm 11.19.1；Linux；无 `node_modules`（本项目测试仅用 Node 内置能力，未安装依赖） |
| 测试时间 | 2026-10-27 20:01（Asia/Shanghai） |
| 浏览器/GUI | 本 QA 会话无浏览器外观与人工点击能力 → GUI 视觉/交互不伪造 pass，逐项标 blocked |
| 证据日志 | `.dsh/evidence/testing-v1.2.83.log`（全部命令、退出码、耗时、输出）；`.dsh/evidence/testing-v1.2.83-normal-flow.log`（normal 全流程回归原文） |
| 静态断言脚本 | `.dsh/tmp/qa-static-v1283.mjs`（本轮新增，246 断言，不随包发布） |
| 并行热修回归 | `.dsh/tmp/qa-static-v1283-packfix.mjs`（既有，18/18） |

---

## 2. 本轮变更面（`git diff --stat` / `git status`，未提交）

**已跟踪改动（16 文件，+2711 / −450，含本报告自身 +154/−54）**

| 文件 | 变更 | 说明 |
|---|---|---|
| `dsh-web-filebrowser-plugin/client.js` | **+1424 / −42** | D1 流水线设计卡、D2 预览弹层、D3 工作台卡/hero、D4 `.html/.htm` 预览与预览/源码切换、CSS、33 个 zh/en i18n key |
| `dsh-web-filebrowser-plugin/pipeline.js` | **+76 / −21** | `PIPELINE_MANUAL_GATE_STAGES`、design 闸门提示、warning 文案、STAGE_GUIDES.development、工具描述/PIPELINE_SECTION、阶段提示词 |
| `scripts/selftest/host-smoke.mjs` | **+58 / −9** | 新增 fast design 闸门、manual gate stages、design-no-image、打包快照回归用例 |
| `CHANGELOG.md` | +36 | 1.2.83 条目 |
| `docs/pipeline/design.md` | +347 | §16 设计确认闸门与预览（含 8 组设计稿引用） |
| `docs/pipeline/engineering-research.md` | +376 / −72 | 3 个候选（VS Code / Storybook / JupyterLab）+ 许可证矩阵 |
| `docs/pipeline/requirements.md` | +209 / −241 | 第 11 轮需求分析与 10 条验收项 |
| `docs/ACCEPTANCE.md` | +19 / −3 | 批次 20 复测步骤 |
| `docs/AGENT_TEAM.md` | +1 / −1 | 快速模式「四个中间阶段 + design 人工闸门」 |
| `README.md` / `README.zh.md` | +2/−1 各 | 一键录入/设计先确认说明 |
| `docs/PLAYBOOK.md` | +2 / −2 | 旧「中间五阶段」口径同步（dev summary 未列出，但属 requirement §6.5 的 README/docs 同步范围） |
| `docs/opc/02-design.md` | +3 / −1 | 设计交付要求改为截图优先、HTML 仅补充 |
| `docs/opc/README.md` | +1 / −1 | 三道人工闸门文案 |
| 插件 `package.json` | +1 / −1 | 1.2.82 → **1.2.83** |

**未跟踪新增（18 项，均为本轮文档资产）**：`docs/pipeline/design/design-gate-*.svg/png` 8 对（16 文件，均 >10 KB）、`docs/pipeline/design/gen-design-gate-mockups.mjs`（生成脚本）、`docs/pipeline/archive/v1.2.79-requirements.md`（归档）。

- `git diff --check` 干净；无被跟踪的 `.log/.orig/.rej/.bak/.tmp` 或调试文件；`.dsh/`（evidence/tmp）被 `.gitignore` 忽略，未进入 git。
- 说明：dev summary 列的 docs 清单未写 `PLAYBOOK.md` / `opc/*`，实际改动包含它们且内容与本轮「旧五阶段口径同步」一致，属正常范围扩大，见 §7 O8。

---

## 3. 自动化结果

命令均在 repo 根执行；耗时取自 `.dsh/evidence/testing-v1.2.83.log`。

| # | 命令 | 退出码 | 耗时 | 结果/断言数 | 结论 |
|---|---|---|---|---|---|
| 1 | `node --check dsh-web-filebrowser-plugin/pipeline.js` | 0 | 21 ms | 语法通过 | PASS |
| 2 | `node --check dsh-web-filebrowser-plugin/client.js` | 0 | 33 ms | 语法通过 | PASS |
| 3 | `npm run check` | 0 | 526 ms | 21 个 Host/客户端模块语法通过 | PASS |
| 4 | `npm run check:json` | 0 | 109 ms | `JSON OK` | PASS |
| 5 | `npm test`（`host-smoke.mjs`） | 0 | 656 ms | **PASS 34/34**（含本轮 3 个 design 用例 + 打包快照回归） | PASS |
| 6 | `node .dsh/tmp/fe-render-smoke.mjs` | 0 | 174 ms | **51/51**（真实渲染 D1–D4、approved 态、HTML-only、三档按钮、iframe 属性） | PASS |
| 7 | `node .dsh/tmp/dev-design-gate-check.mjs` | 0 | 85 ms | 7 项行为输出全部符合（见下） | PASS |
| 8 | `node .dsh/tmp/qa-static-v1283.mjs`（本轮新增） | 0 | 244 ms | **STATIC PASS（246 断言，1 observation）** | PASS |
| 9 | `node .dsh/tmp/qa-static-v1283-packfix.mjs`（热修回归，既有） | 0 | 56 ms | **STATIC PASS 18/18** | PASS |
| 10 | `git diff --check` | 0 | 56 ms | 空输出（干净） | PASS |
| 11 | normal 模式全流程回归（内联 Node，不落盘） | 0 | — | 16 行行为断言全符合（7 阶段逐阶段 review/打回/重提/闸门） | PASS |

**关键行为输出（命令 7，原文见日志）**

```
product autoApproved: true approved
design autoApproved: undefined status: review note: 设计确认闸门：Owner 查看截图 / HTML 预览并确认后才进入开发
development blocked: bad-order | 阶段「开发实现」开始前必须等上一阶段「UI 设计」approved；当前状态是 review；设计阶段必须由 Owner 在面板查看截图 / HTML 预览并确认（approve）后才能开始开发
development started after approval: active
design warnings: [{"code":"missing",...},{"path":"","code":"design-no-image","message":"设计阶段只提交了可预览 HTML，缺少可直接查看的截图（PNG/JPG/SVG/WebP/GIF）；HTML 只能预览，不能替代截图"}]
```

**normal 模式回归要点（命令 11，原文见 `.dsh/evidence/testing-v1.2.83-normal-flow.log`）**
- 默认 `gateMode=normal`；product 提交 → review（无 autoApproved），design 在 product 未 approved 时启动被 `bad-order` 拒绝。
- design 提交 → review（无 autoApproved），development 被拒绝且消息含「上一阶段」「设计」；approve 后 development `active`。
- 打回 → design `failed`（note 保留「配色需调整」）；`startStage('design')` 重开 → `active` 且保留驳回 note；重提 → 再次 `review`，再 approve 后开发才解锁（不存在一次通过永久有效）。
- acceptance 通过后 approval 可直接在 active 态 review；approval 未 approved 时 release 被 `bad-order` 拒绝，approve 后 release 可启动。
- 最终阶段状态：`product/design/development/testing/acceptance/approval: approved`，`release: active`；design `reviews` 历史 2 条（reject + approve）完整。

---

## 4. 10 条验收项逐项结论

> GUI 视觉/交互类按事实标 **blocked**，并给出可直接复跑的命令或 Owner 批次 20 复测路径，不伪造 pass。

| # | 验收项（category） | verdict | 证据 / 复现 |
|---|---|---|---|
| 1 | 快速模式下 design 提交后停在 review，不自动通过（design-gate） | **pass** | `node .dsh/tmp/dev-design-gate-check.mjs` → `design autoApproved: undefined status: review` + note「设计确认闸门」；`npm test` 用例 `fast mode auto-approves four intermediate stages and keeps the design review gate manual`；静态 246 断言中的 8 条（`.dsh/tmp/qa-static-v1283.mjs`）。日志 `.dsh/evidence/testing-v1.2.83.log` |
| 2 | design 未确认时 development 启动被拒绝，确认后可启动（design-gate） | **pass** | 同一命令 → `development blocked: bad-order ... 上一阶段「UI 设计」... 设计阶段必须由 Owner ... 确认`；approve 后 `development started after approval: active`；normal 流程回归同样验证 review/failed 两种状态均被拒。日志同上 |
| 3 | 快速模式提示明确「四个自动 / 三个需确认」（design-gate） | **pass** | `qa-static-v1283` 覆盖 `PIPELINE_SECTION`（四个中间阶段 / 设计确认（design）/ 永远是人工闸门 / 无「五个中间阶段」）、zh/en `pipeline.fastHint`、三个工具描述（status/start/submit 均含 design、无 five intermediate）、`README.md`/`README.zh.md`/`docs/AGENT_TEAM.md` 新口径。证据：`node .dsh/tmp/qa-static-v1283.mjs` 输出（246 断言） |
| 4 | 设计截图在流水线卡与工作台卡显示缩略图并可打开大图（design-preview） | **blocked** | 自动化已覆盖 DOM/属性：`fe-render-smoke` 51/51（`D1 banner rendered`、`D1 preview button`、`D3 design card`、`D3 warn badge`、`D3 hero banner`）；静态断言覆盖 `ds-pipe-shot`/`ds-wb-shot`、`loading="lazy"`、`alt`、`isImagePath` 含 webp/gif。**缩略图实际显示、点击打开应用内大图需 Owner 在 GUI 按批次 20 复测** |
| 5 | HTML 设计产物内嵌渲染预览且支持 360/768/1280，不默认打开源码（design-preview） | **blocked** | `fe-render-smoke` 验证 `D2 iframe present`、`sandbox empty`、`title present`、`loading lazy`、`frame width 1280`、`three device buttons`、`device labels 360,768,1280`；静态验证三档状态、0 请求切换、`查看源码` 走 `openFileAt`。**实际 iframe 渲染效果、逐档切换视觉需 Owner 批次 20 复测** |
| 6 | design review 时面板与工作台显示待确认状态及通过/打回/预览入口（design-preview） | **blocked** | `fe-render-smoke` 验证 D1 banner、D2 banner/tabs/footer/confirm/reject、D3 design actions/hero banner、approved 后 `no review banner`；静态验证两处同用 `pipeline.designPendingTitle`、通过/打回走 `reviewPipelineStage`、note 输入。**两处提示是否「一眼可见」需 Owner 批次 20 复测** |
| 7 | 工作区打开 `.html/.htm` 默认渲染预览，工具栏可切预览/源码（html-preview） | **blocked** | `fe-render-smoke` 验证 `D4 preview container/bar/iframe`（sandbox 空、title、lazy、raw src）、空文件空态、预览/源码切换按钮；静态验证 `modeOf→'html'`、`openFile` 默认 `view preview`、`switchTabToSource`/`showHtmlPreview`（保存后再预览）、SSH 降级。**默认渲染、可编辑保存、深色主题需 Owner 批次 20 复测** |
| 8 | design 提示词要求交付截图且禁止只交 HTML，warning 文案准确（model-discipline） | **pass** | `qa-static-v1283` 覆盖 `STAGE_GUIDES.design`（至少一张 / 不能替代截图 / 不只交 HTML 源码 / mission 闸门）、`STAGE_GUIDES.development`（design 必须 approved / 未确认不得开工）、design/development 阶段提示词、Lead 纪律；`dev-design-gate-check` 输出 `design-no-image` 准确文案（无「HTML 截图」）。日志 `.dsh/evidence/testing-v1.2.83.log` |
| 9 | 版本与文档同步到 1.2.83 且交付后根版本 +1（version-docs） | **pass** | 插件/根 `package.json` 1.2.83；CHANGELOG `## 1.2.83 — 2026-10-27`；`docs/ACCEPTANCE.md` 批次 20；`docs/pipeline/design.md` §16；8 对 `design-gate-*` SVG/PNG 非空；`engineering-research.md` 3 候选 + MIT/BSD-3-Clause 结论；静态断言逐项通过。根 +1 至 1.2.84 属 release 阶段动作，届时核对（工作区硬性规定） |
| 10 | 质量门全绿且既有功能不回归（regression） | **blocked**（自动化部分全绿） | 自动化部分：`npm run check` / `check:json` / `npm test 34/34` / `fe-render-smoke 51/51` / `qa-static 246` / packfix 18/18 / normal 全流程回归 全部 exit 0；Host 回归覆盖 review/打回/启动/assignments（13 用例）/tasks/acceptance/delivery/preview 代码路径。**人工 GUI 回归（通过/打回点击、需求四操作、交付打包下载、任务与指派面板、预览分享、浅深主题、360/1440 布局）需 Owner 批次 20 复测**，见 §6 |

**统计：pass 5（#1/#2/#3/#8/#9）· fail 0 · blocked 5（#4/#5/#6/#7/#10）。**

---

## 5. 安全 / 性能 / 可访问性核查

| 项 | 结论 | 证据 |
|---|---|---|
| iframe 沙箱 | D2 设计稿预览与 D4 HTML 文件预览均 `sandbox: ''`（恰好两个），D2/D4 iframe 块内无 `allow-scripts` / `allow-same-origin` / `allow-forms`；不执行设计稿脚本、不获取同源权限 | `qa-static-v1283`「安全」小节；`fe-render-smoke` `D2/D4 iframe sandbox empty` |
| 顶层打开 HTML | HTML tab 工具栏按 `tab.mode !== 'html'` 排除「在浏览器打开」（避免脚本在 Harness 源下执行）；其它非文本类型保留该按钮 | 静态断言 + 代码 `client.js`（`isTextMode(tab.mode) && tab.mode !== 'html'`） |
| 注入面 | diff 未新增 `dangerouslySetInnerHTML`、`eval(`、`debugger`；HTML 仅经 `rawUrl` 喂 iframe | `qa-static-v1283` 安全断言 |
| 依赖 | 未新增/变更 npm 依赖（root `ssh2`；插件 `@xterm/*` + `ssh2` 与 HEAD 一致）；未引入第三方 UI 库/字体/运行时 | 静态断言（对 HEAD 比对 dependencies） |
| 懒加载 | 设计缩略图 `loading="lazy"`、D2/D4 iframe `loading="lazy"` | `qa-static-v1283` + `fe-render-smoke` |
| 0 请求切档 | 360/768/1280 只 `setDesignPreview({device})` 改宽度，切片内无 `rawUrl`/网络调用，不重复拉取 | 静态断言 `D2 切宽度只改状态、不重复拉取（0 请求）` |
| 产物上限 | 流水线产物渲染沿用 `artifacts.slice(0, 20)`；设计卡最多前 20 个 | 静态断言 + 代码 |
| 可访问性 | D2 `role="dialog"` / `aria-modal` / `aria-labelledby` / review 时 `aria-describedby`；iframe 必有 `title`；状态条 `role="status"`（不只颜色表意）；产物 tab `role="tab"` + `aria-selected`；宽度按钮 `aria-pressed`；按钮 ≥44px；Esc 关闭 + 初始焦点 + 关闭后焦点还原；`focus-visible` | `qa-static-v1283`；`fe-render-smoke` |
| 性能 | 纯前端状态切换；无新请求/轮询/依赖；D2 默认 1280（只改容器宽） | 同上 |

---

## 6. 回归清单（自动化覆盖 vs 需 Owner GUI 复测）

| 回归项 | 自动化覆盖 | 需 Owner 批次 20 GUI 复测 |
|---|---|---|
| 通过 / 打回（阶段 review 决策） | ✅ `npm test`（normal 流程 approve/reject、failed 后重开、review history）；normal 回归脚本 | ☑ 面板按钮实际点击、提示条消失 |
| 启动阶段 / 顺序守卫 | ✅ `npm test`（stage order gate、change scopes）、normal 回归 | — |
| review note | ✅ normal 回归（reject note 保留、重提 note 追加）；静态 note 输入复用 | ☑ 输入框实际交互 |
| 需求查看/追加/修改/新轮 | ✅ `npm test`（change round scopes、requirement 相关 Host 用例） | ☑ 工作台四个操作按钮 |
| 验收 / 交付打包 / 下载 | ✅ `npm test` 34/34（acceptance 证据链、delivery bundle）；`packfix` 18/18（打包不清空流水线快照，热修 `2d3ebe0` 未回退） | ☑ 打包→下载闭环、不跳回需求录入 |
| 任务与指派 | ✅ `npm test`（assignments 13 个用例，含并发/上限/SSH 拒写/不写 pipeline.json） | ☑ 面板交互 |
| 预览分享 | ❌ 无自动化（需 GUI + 端口/网络） | ☑ 必测 |
| 快速模式其它四阶段仍自动通过 | ✅ `npm test` fast 用例 + `dev-design-gate-check`（product/development `autoApproved: true`） | — |
| 浅 / 深主题、360 / 1440 无溢出 | ❌ 无法在无头环境断言视觉 | ☑ 必测（含 1280 预览横向滚动） |
| 打包热修不回退 | ✅ `npm test` `packaging keeps the pipeline snapshot...` + `packfix` 18/18 + HEAD `2d3ebe0` | ☑ 实际打包确认 |

---

## 7. 缺陷 / 观察（含 dev 已知 deviations 处理结论）

**无阻断缺陷（P0/P1=0）。** 以下观察均为非阻断，Owner 批次 20 复测时顺带确认：

| # | 类型 | 内容 | 处理结论 |
|---|---|---|---|
| O1 | 已知 deviation | **D2 1280 档在窄容器内横向滚动**（`.ds-dp-canvas` overflow auto），非布局溢出 | design §16.7 与 requirement §4 允许「大宽度预览容器内横向滚动」；接受，批次 20 目检 |
| O2 | 已知 deviation | **D2 iframe 固定高度 640/560/480px**（桌面/平板/窄屏） | 与 design §16.7 一致（≥640/降档）；接受 |
| O3 | 已知 deviation | **D2 未做完整焦点陷阱**：有 Esc、初始焦点、关闭后焦点还原，但 Tab 可离开弹层 | 验收标准只要求键盘可达/可读名称/`title`/≥44px，不要求 trap；建议后续 a11y 增强，本轮接受 |
| O4 | 已知 deviation | **D3 无截图时「通过」按钮禁用**，但 D2 弹层对 HTML-only 仍可确认（仅提示 + `design-no-image` warning） | 与「HTML 不能替代截图」的提示策略一致（Host 不阻断提交，只警告）；接受，批次 20 确认交互是否符合 Owner 预期 |
| O5 | 已知 deviation | **iframe 404/不可读检测有限**：`onError` 对部分缺失文件不触发；已有「查看源码/重试」退路 | 接受；SSH 根另有降级源码路径 |
| O6 | 文档小缺口 | `dsh-web-filebrowser-plugin/README.md:271` 仍写 “fast mode that only auto-approves the **five intermediate stages**”（需求 §6.5 要求 README/docs 同步旧口径）。根 README/README.zh/AGENT_TEAM/PLAYBOOK/opc 均已改；CHANGELOG 第 315 行的旧表述属历史发布记录，**不应改** | 非阻断（不在 10 条验收项显式 docs 清单内），建议 release 前顺手修正该行或记为 follow-up |
| O7 | i18n 洁净度 | 新增 33 个 key 中 `workbench.designHtmlOnly` 未被引用（实际用的是 `pipeline.designPreviewHtmlOnly`） | 无害死 key；建议后续清理，不阻断 |
| O8 | 记录差异 | dev summary 写 `client.js +1461/−38`，实测 `git diff --numstat` 为 **+1424/−42**；另 dev summary 的 docs 清单未列 `PLAYBOOK.md` / `opc/*`（实际已改且内容正确） | 属 bookkeeping 差异，不影响验收；以实测为准 |
| O9 | 基线说明 | 本报告覆盖 v1.2.82 `test-report.md`；`docs/pipeline/archive/` 尚未有 v1.2.82 报告归档 | 建议 release 阶段归档（本次写入范围不含 archive/） |

---

## 8. 结论

- **自动化质量门：10 套全绿、0 失败**（`node --check`×2、`npm run check`、`check:json`、`npm test 34/34`、`fe-render-smoke 51/51`、`dev-design-gate-check`、`qa-static-v1283 246 断言`、`packfix 18/18`、normal 全流程回归、`git diff --check` 干净；表 3 共 11 行命令全部 exit 0）。
- **验收项建议：pass 5 / fail 0 / blocked 5**（blocked 全部是 GUI 视觉/交互与人工回归：#4/#5/#6/#7/#10）。没有可归因于本轮的 fail。
- **阻断缺陷：0**。观察项 O1–O9 均非阻断（O6 建议 release 前修一行文档）。
- **建议：进入 acceptance（第 5/7 阶段）**；acceptance 复核时可引用本报告与 `.dsh/evidence/testing-v1.2.83.log`。Owner 复测入口：`docs/ACCEPTANCE.md` **批次 20**（重启 Harness → 重建客户端 bundle → 强刷）。
- 证据路径（工作区相对）：
  - `.dsh/evidence/testing-v1.2.83.log` —— 全部命令退出码/耗时/输出
  - `.dsh/evidence/testing-v1.2.83-qa-static.log` —— `qa-static-v1283` 完整输出（246 断言）
  - `.dsh/evidence/testing-v1.2.83-normal-flow.log` —— normal 七阶段全流程回归原文
  - `.dsh/tmp/qa-static-v1283.mjs` —— 本轮 246 条静态断言（可复跑：`node .dsh/tmp/qa-static-v1283.mjs`）
  - `.dsh/tmp/fe-render-smoke.mjs` / `.dsh/tmp/dev-design-gate-check.mjs` —— 既有渲染/Host 行为验证
