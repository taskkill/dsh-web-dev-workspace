# 需求：设计先确认 —— 设计阶段出截图/HTML 预览，Owner 确认后才进开发（v1.2.83，第 11 轮）

- 提出人：Owner；日期：2026-10-27（Asia/Shanghai）；优先级：P0；目标版本：**v1.2.83**（第 11 轮）。
- 一句话需求：把「UI 设计」从「提交即自动通过」改成**必须 Owner 看过图、点过通过**的闸门——设计稿要能以截图/渲染预览被直接看到，确认前不许进入开发。
- 上游：`.dsh/pipeline.json` 第 11 轮需求全文；v1.2.82（commit `e0b137f`）交付与验收复核；根 `package.json` 已按工作区规定为 1.2.83（commit `c545d78`，插件仍为发布版 1.2.82）。
- 本轮性质：**流程闸门 + 预览能力 + 模型侧纪律**三件事；不改七阶段顺序、不改验收/确认/发布闸门语义、不改数据格式。
- 文档定位：本文只做需求分析与验收化，不替代 `.dsh/pipeline.json` 中的需求原文；历史轮次见 `docs/pipeline/archive/`（v1.2.79 第 7 轮工作台 UI 重构）。

---

## 0. 摘要

| 项 | 内容 |
|---|---|
| 问题 | ① 快速模式把 design 也自动通过，Owner 从没机会看设计稿；② 工作台/流水线的 HTML 设计产物只能打开源码，看不到渲染效果；③ 打开 `.html` 文件默认也是源码。 |
| 方案 | 设计阶段改为强制人工闸门（fast 只覆盖 product/development/testing/acceptance）；设计产物内嵌预览（图片缩略图+大图、HTML iframe 三档宽度、源码为次级入口）；设计 review 时高亮「待你确认」；`.html/.htm` 默认渲染预览；design 提示词与 Lead 纪律要求必须交截图。 |
| 交付面 | `dsh-web-filebrowser-plugin/pipeline.js`（闸门/提示/文案）、`dsh-web-filebrowser-plugin/client.js`（流水线卡/工作台卡/文件预览）、文档与版本文件。 |
| 不做 | 不改阶段数量与顺序、不改 approval/release 语义、不加第三方库/字体/运行时、不自动生成 HTML 截图（无无头浏览器）、不改 SSH 与数据结构。 |
| 验收项 | 10 条（design-gate 3 / design-preview 3 / html-preview 1 / model-discipline 1 / version-docs 1 / regression 1），见 §9；由 testing 阶段回填。 |

---

## 1. 背景与现状审计

Owner 在 v1.2.82 交付后提出：**设计稿出完要先给截图（或可预览的 HTML），确认后才进开发**。现状不是「没有设计阶段」，而是三处机制共同导致 Owner 看不到、也拦不住：

| # | 现状问题 | 代码证据（本轮基线 v1.2.82） | 影响 |
|---|---|---|---|
| ① | 快速模式把 **design 一起自动通过** | `pipeline.js` `submitStage()` 的 `fastApproval`（约 1136–1161 行）：`gateMode === 'fast' && id !== 'approval' && id !== 'release'` 时直接写 `status='approved'` 并返回 `nextStageId` | 设计阶段从不进入 `review`，面板上没有「待确认」，Lead 提交即推进开发；Owner 的确认被跳过 |
| ② | 阶段顺序守卫其实**已经存在** | `pipeline.js` `startStage()`（约 1059–1090 行）：非首阶段要求上一阶段 `approved`，否则抛 `bad-order`「必须等上一阶段…approved」 | 闸门不需要新造，只要把 design 从自动通过名单里排除，开发就会被自然拦住；需要把提示文案说清「去确认设计稿」 |
| ③ | 设计产物里**图片能看，HTML 只能看源码** | `client.js` `pipeline` 的 `renderArtifact()`（约 19705–19751 行）：图片走 `ds-pipe-shot` 缩略图，**其余（含 .html）一律 `openFileAt()` 进编辑器源码** | 高保真 HTML 设计稿不渲染，Owner 实际看到的是 `<div>`；「设计评审」退化为读代码 |
| ④ | 工作台设计卡**只列图片，文档一律开源码** | `client.js` 工作台 `designShots`（约 17553 行）只收 `isImagePath()`；`designDocs`（约 18392–18410 行）按钮点击 `openFile()` | 与 ③ 同样：有截图才看得见，HTML 稿没有预览入口 |
| ⑤ | 打开 `.html/.htm` **默认进源码** | `client.js` `modeOf()`（约 2948–2954 行）把 html 归 `text`；`openFile()`（约 13867–13909 行）建 tab 时 `view = mode === 'markdown' ? 'preview' : 'edit'` | 设计与开发调试都得手动「脑内渲染」；Owner 想看效果没有入口 |
| ⑥ | 快速模式文案写着**五个中间阶段**都自动通过 | `client.js` i18n `pipeline.fastHint`（约 748 行 zh / 1978 行 en）；`pipeline.js` `PIPELINE_SECTION`（约 196 行）；工具描述同源 | 改闸门后文案不同步会直接误导 Owner 与模型，属于必须同批修的面 |
| ⑦ | 设计交付要求**允许「可预览 HTML」替代截图** | `pipeline.js` `STAGE_GUIDES.design` deliverables（约 1496–1500 行）写「高保真稿/截图（SVG/PNG/可预览 HTML）」 | 设计 Agent 可以只交 HTML，而 HTML 在现状下 owner 只能看源码 → 与 ① 叠加就是「既没人拦、也没图看」 |
| ⑧ | 无图 warning 文案**把 HTML 说成截图** | `pipeline.js` `collectArtifactWarnings()` 的 `design-no-image`（约 849–861 行）：「未提交图片产物（PNG/JPG/SVG/HTML 截图）」 | 「HTML 截图」自相矛盾（HTML 不是截图），且不提示「HTML 需可预览」 |

**根因判断**：设计评审缺三件东西——**门**（design 不由 fast 自动通过）、**面**（产物以人可看的形式呈现）、**证据**（模型必须给可直接看的截图）。三者缺一，Owner 的「确认」就落不了地。

**本轮修复点**：`fastApproval` 排除 design（①）；`startStage` 提示文案指向设计确认（②）；流水线/工作台设计卡图片缩略图+大图、HTML 内嵌预览+三档宽度+源码次级入口（③④）；`.html/.htm` 默认预览+工具栏切换（⑤）；快速模式文案改「四个自动/三个人工」（⑥）；design 提示词要求截图并禁止只交 HTML（⑦）；warning 文案修正（⑧）。

---

## 2. 目标用户与核心场景

| 用户 | 场景 | 期望结果 |
|---|---|---|
| **Owner（你）** | 收到「设计稿已完成」的汇报后，打开流水线/工作台看设计 | 卡片上直接看到缩略图，点开是大图；HTML 稿直接渲染出来，可切 360/768/1280 看布局；面板醒目显示「设计稿待你确认 · 确认后进入开发」和通过/打回 |
| **Owner** | 快速模式下担心又被自动推进 | 提交后设计停在 `review`；没点通过时开发阶段启动报错，错误提示明确让人去确认设计稿 |
| **Lead / 项目经理 Agent** | 设计 Agent 提交后要向 Owner 汇报 | 有明确的纪律：把截图（present/预览入口）给 Owner 看，不贴 HTML 源码，然后停下等确认；确认前不启动 development |
| **UI 设计师 Agent** | 交付设计产物 | 提示词明确「至少一张可直接看的截图（PNG/JPG/SVG）+ 可选可预览 HTML」，不允许只交 HTML 源码 |
| **开发者 / 测试** | 需要看某个设计稿的实现细节 | 预览为默认视图，源码作为次级入口一键切换；预览加载失败时有可读错误与「看源码」退路 |
| **审计 / acceptance 复核** | 抽查设计评审是否真的发生 | 能从 pipeline.json 看到 design 的 `review/approved/failed` 状态与 Owner 的 note；产物路径可复现打开 |

**核心用户故事**

1. 作为 Owner，设计提交后我在面板看到「设计稿待你确认」，点缩略图看到大图、点 HTML 产物看到渲染页，确认没问题点「通过」，开发阶段才可启动。
2. 作为 Owner，如果设计不对，我点「打回」并写一句原因；设计 Agent 修复后重新提交，**再次**进入待确认，而不是沿用上次批准。
3. 作为 Owner，我在快速模式下也只对 product/development/testing/acceptance 放行；design/approval/release 永远等我点。
4. 作为开发者，我打开工作区里的 `.html` 文件默认看到渲染结果，需要改代码时点工具栏「源码」。
5. 作为 Lead，我汇报设计交付时只给截图/预览入口，不把 HTML 源码丢给 Owner。

---

## 3. 范围

### 3.1 做什么

1. **闸门：设计阶段必须 Owner 人工确认**
   - 快速模式（`gateMode='fast'`）自动通过名单从「五个中间阶段」收窄为 **product / development / testing / acceptance**；**design / approval / release 始终需要 Owner 在面板确认**。
   - 设计提交后阶段状态为 `review`，提交结果不带「自动通过」语义；`pipeline_start_stage('development')` 必须被拒绝并给出明确提示。
   - Owner 在面板 approve 后 development 才可启动；reject 后 design 变 `failed`，可修复后用 `pipeline_start_stage('design')` 重新开始。
   - 其它阶段的闸门语义、七阶段顺序、数据字段不变。
2. **视觉评审：设计产物可看**
   - 截图（PNG/JPG/SVG/WebP/GIF，沿用现有 `isImagePath` 集合）在**流水线设计卡**与**工作台设计卡**显示缩略图，点击打开大图（应用内图片查看器）。
   - HTML/HTM 产物不再默认打开源码：内嵌 `iframe` 渲染预览；提供 **360 / 768 / 1280** 三档宽度切换；「查看源码」作为次级入口。
   - 预览渲染必须与主应用隔离（iframe + `sandbox`），不向主文档注入设计稿 CSS/脚本。
3. **待确认态：设计 review 时醒目**
   - 设计阶段处于 `review` 时，流水线面板与工作台显示「设计稿待你确认 / 确认后进入开发」状态条（含阶段名与产物计数），提供**通过 / 打回**按钮与**预览**入口。
   - 通过/打回复用现有 `reviewPipelineStage` 通道，不新增审批路径；review note 沿用现有输入。
   - 待确认提示必须出现在 Owner 不用展开就能看到的位置（流水线设计卡 + 工作台 Now 区/hero 主操作）。
4. **HTML 文件预览**
   - 在工作区打开 `.html/.htm` 文件默认进入**渲染预览**（不再直接显示源码）；工具栏提供「预览 / 源码」切换。
   - 源码模式保留现有编辑/保存能力；预览模式通过 iframe 渲染 raw 内容，`sandbox` 收紧。
   - 文件为空、读取失败、SSH 远程根等异常有可读提示与退路，不出现白屏。
5. **模型侧纪律与文案**
   - `STAGE_GUIDES.design`：交付物要求**至少一张可直接看的截图（PNG/JPG/SVG）**，HTML 为可选补充且必须可预览；明确「只交 HTML 源码视为未完成」。
   - Lead 工作流指令（`PIPELINE_SECTION` / 角色提示）：设计提交后**必须把截图或预览入口给 Owner 看并停下等确认**，不得把 HTML 源码贴给 Owner，确认前不得启动 development。
   - `collectArtifactWarnings` 的 `design-no-image` 文案改为准确的「未提交可直接查看的截图（PNG/JPG/SVG）」并说明 HTML 不能替代截图。
   - 快速模式提示文案（面板 zh/en、`PIPELINE_SECTION`、工具描述、阶段提示）统一为「product/development/testing/acceptance 自动通过；design/approval/release 需 Owner 确认」。

### 3.2 不做什么

- **不改七阶段数量与顺序**；不改 acceptance 复核、approval 人工确认、release 发布三条闸门的语义。
- **不引入第三方 UI 库、字体、图标包、运行时服务**；不新增 npm 依赖、不改构建。
- **不自动生成 HTML 截图**：当前环境无可用无头浏览器，字体管线不保证；HTML 以「可预览」满足需求，截图优先由设计 Agent 交付 SVG/PNG。
- 不改 SSH 远程工作区能力边界；不为远程根新增服务端渲染能力。
- 不改 `.dsh/pipeline.json`、`.dsh/acceptance.json` 等数据结构；不迁移旧数据。
- 不做设计稿版本对比、评论批注、多轮 diff 等评审协作功能（后续需求）。
- 不复制第三方受版权保护的文案、商标、界面素材与整段源码。
- 不做「记住预览偏好」等持久化偏好（保持简单，必要时后续再加）。

---

## 4. 约束与非功能

- **技术栈/复用**：继续用现有 React `h()` 渲染 + 内联 CSS + `--dsw-alias-*` token；复用 `rawUrl()`、`openFile()`、`isTextMode()`、i18n 内联词典、`reviewPipelineStage` 面板通道；不新增组件库。
- **安全**：HTML 渲染只用 `iframe[src]` + `sandbox`，不引入 `dangerouslySetInnerHTML`、不 `eval`、不把设计稿脚本注入主应用；预览 iframe 默认 `sandbox=""`（禁脚本/禁同源/禁表单），`title` 必填（可访问性）。
- **性能**：缩略图 `loading="lazy"`；iframe 懒加载（`loading="lazy"`）；三档宽度只改容器/iframe 宽度，不重复拉取；设计卡最多渲染前 20 个产物（沿用现有上限）。
- **兼容**：Chrome/Safari/Firefox 现代版本；浅/深主题；360–1440 无横向溢出（大宽度预览允许容器内横向滚动）。
- **可访问性**：预览按钮可键盘到达、有可读名称；iframe 有 `title`；待确认状态条带文字（不只靠颜色）；通过/打回按钮 ≥44px 高。
- **零数据迁移**：读取旧 pipeline.json 不报错；旧交付产物（无 HTML、无截图）不导致面板崩溃。
- **质量门**：`npm run check`、`npm run check:json`、`npm test`（`scripts/selftest/host-smoke.mjs`）全绿；既有功能不回归。
- **版本口径**：插件 `1.2.82 → 1.2.83`；根 `package.json` 交付后 +1（1.2.83 → 1.2.84，工作区硬性规定）。
- **时间**：沿用分工，不设外部截止；本阶段只定义验收，不给实现排期。

---

## 5. 调研与借鉴

> 调研时间 2026-10-27（Asia/Shanghai）。检索与抓取工具：`web_search` × 3 + `web_fetch` × 6。下面 6 个来源均在当日返回 HTTP 200 并读取正文；无 blocked 来源。仅借鉴功能、交互、信息结构，不复制受版权保护的文案/素材/源码。

### 5.1 来源与关键结论

| # | 来源 | URL | 访问日期 | 类型 | 关键结论（对本需求的影响） |
|---|---|---|---|---|---|
| 1 | Figma Help · Request a branch review | https://help.figma.com/hc/en-us/articles/5691414603543-Request-a-branch-review | 2026-10-27 | 竞品（设计评审工作流） | 设计变更走「请求评审 → 评审人 Approve 或 Request changes → 合并」；状态为 **In review / Changes suggested / Approved**；文中明确「评审默认不是合并的强制要求」。→ 状态机可直接映射 review/failed/approved；**但闸门必须由系统强制，不能只靠提示文案**（否则就像 Figma 默认那样形同虚设）。 |
| 2 | GitHub Docs · Approving a pull request with required reviews | https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews | 2026-10-27 | 平台标准（评审闸门） | required review 会**阻止合并**；**PR 作者不能批准自己的 PR**；批准后若启用 stale review dismissal 且分支有新提交，**批准失效需重新评审**。→ 「必须 approved 才能进下一关」「模型不能自批」「打回/变更后要重新确认」三条都可直接借鉴。 |
| 3 | Storybook Docs · Story rendering | https://storybook.js.org/docs/configure/story-rendering | 2026-10-27 | 设计系统/工具 | 故事在专用的 **preview iframe（Canvas）** 中渲染，与 Storybook 应用 UI 隔离；可注入 head/body 以加载样式。→ 设计稿预览应隔离渲染，不污染主应用；预览容器是「一个框」而不是整页替换。 |
| 4 | MDN · `<iframe>` HTML inline frame element | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe | 2026-10-27 | Web 标准 | iframe 表示嵌套浏览上下文、可嵌入另一文档；支持 `loading`、`title` 等属性。→ HTML 产物用 iframe 渲染；缩略图/iframe 懒加载；`title` 必填。 |
| 5 | MDN · HTMLIFrameElement.sandbox | https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/sandbox | 2026-10-27 | Web 标准 | `sandbox` 对嵌套内容施加**额外限制**（默认最严，按需逐项放开）。→ 设计稿预览默认 `sandbox=""`；不放开 `allow-scripts`，更不与 `allow-same-origin` 同开。 |
| 6 | FactualMinds · Human in the Loop (HITL) | https://www.factualminds.com/glossary/human-in-the-loop/ | 2026-10-27 | 行业模式（AI 审批） | 门禁按「**具体动作**」而不是「整个 agent 的自主等级」设定；人应在**证据就在眼前**时决策；典型失效是**审批疲劳**与「门禁位于写入之后」。→ 设计确认是「进入开发」这一动作前的强制门；截图/预览必须贴在门槛旁边（卡内直接可见），不能让 Owner 多点两次才看到证据。 |

### 5.2 借鉴决策表

| 借鉴点 | 来源 | 采用/调整/不采用 | 理由 / 落点 |
|---|---|---|---|
| 设计评审状态机（In review / Changes suggested / Approved） | #1 | **采用** | 直接映射 pipeline 的 `review / failed / approved`；设计提交即进入 review（验收项 1） |
| 强制评审阻断合并 | #2 | **采用** | 代码层强制：design 未 approved 时 `pipeline_start_stage('development')` 抛 `bad-order`；不依赖 UI 提示（验收项 1/2） |
| 评审者不能批准自己的产出 | #2 | **采用（已有机制，复用）** | 模型无审批工具，只有 Owner 面板可 approve；本轮不改通道，只改何时需要人（验收项 2） |
| 变更后批准失效、需重新评审 | #2 | **采用** | 打回 → `failed` → 重新提交 → 再次 `review`；不存在「一次通过永久有效」（验收项 1/6） |
| 隔离的预览画布（preview iframe） | #3 | **采用** | 设计稿预览放独立 iframe，样式/脚本不进入主应用（验收项 5/7） |
| 嵌入另一文档 + 懒加载 + 可访问标题 | #4 | **采用** | `.html/.htm` 与 HTML 产物用 iframe 渲染，`loading="lazy"`、`title` 必填（验收项 5/7） |
| `sandbox` 收紧嵌套内容 | #5 | **采用** | 预览 iframe 默认 `sandbox=""`；不放开脚本，避免未审查页面动主应用数据（验收项 7） |
| 按动作设门禁、证据前置、防审批疲劳 | #6 | **采用** | 「设计→开发」是唯一新增动作门；待确认状态条与预览入口同卡呈现，不增加点击层级（验收项 2/6） |
| 评审非强制、可配置（Figma 默认） | #1 | **不采用** | 本工作区诉求就是「确认后才进开发」；Owner 是唯一人工确认者，做成可配置等于留后门 |
| 批量自动通过设计 / 定时放行 | #6（反面：审批疲劳） | **不采用** | 本轮要移除的正是 design 自动通过；疲劳问题用「一屏一图一确认」降低认知成本，而不是放宽 |
| 复制第三方设计稿/文案/界面素材 | — | **不采用** | 反抄袭边界：只借鉴功能与交互结构，不复制受版权保护内容 |

### 5.3 已验证模式 vs 创新假设

**已验证模式（有来源支撑）**

1. 评审状态机 + 强制阻断 + 不可自批 + 变更重审（#1、#2）→ 落为 design 的人工闸门与 dev 启动守卫。
2. 隔离 iframe 渲染 + sandbox 收紧 + 懒加载/标题（#3、#4、#5）→ 落为设计预览与 HTML 文件预览。
3. 按动作设门禁、证据前置、警惕审批疲劳（#6）→ 落为待确认态与卡内预览入口。

**创新假设（需验证，写验证方式与失败预案）**

| # | 假设 | 验证方式 | 失败预案 |
|---|---|---|---|
| 1 | 360/768/1280 三档足以判断设计稿布局 | design review 时逐档切换；Owner 按 ACCEPTANCE 批次 20 复测 | 若不足，补 1024 档；宽度档位常量集中定义，改动只在一处 |
| 2 | `sandbox=""` 下高保真稿视觉仍完整 | 用项目自带 HTML 稿预览，对比浏览器直开 | 若依赖脚本导致缺交互，放开 `allow-scripts` 但**禁止**同时开 `allow-same-origin`，并在预览上标注「脚本受限」 |
| 3 | 待确认状态放在流水线卡 + 工作台 Now 区两处不冗余 | Owner 复查是否一眼可见、是否重复干扰 | 若冗余，保留流水线卡为唯一强提示，工作台只留入口 |
| 4 | HTML 默认预览不会妨碍需要源码的场景 | 开发者打开 html 后切源码的成本（1 次点击）；回归清单 | 若被抱怨，工具栏默认来源可配置（后续需求，不在本轮） |
| 5 | 快速模式文案改写后旧用户不会误读 | 文案并列「四个自动 / 三个需确认」；验收项 3 逐处 grep 检查 | 若仍有旧文案残留，测试阶段以「关键词不存在」断言兜底 |

### 5.4 受阻/无网络说明

- 无 blocked：6 个来源当日均可访问并读取正文，无需伪造或降级。
- 说明：**「自动把 HTML 渲染成截图」的能力**在本环境不可用（无无头浏览器、字体管线不保证），因此需求把「截图」定义为**由设计 Agent 交付 PNG/JPG/SVG**，HTML 以「可预览」满足；这不是来源受阻，而是能力边界，已写入 §3.2。

---

## 6. 需求规格（行为细节，供设计与开发对齐）

### 6.1 闸门（design-gate）

- `submitStage`：`fastApproval` 条件改为 `gateMode==='fast' && !['design','approval','release'].includes(stageId)`；design 提交走 `status='review'` 分支（`reviewedAt=0`，无 `autoApproved`/`nextStageId`）。
- `startStage('development')`：design 非 `approved` 时抛 `bad-order`，消息包含「必须等上一阶段「UI 设计」approved」并在快速模式下补充「请在面板确认设计稿后重试」。
- 设计打回（reject）→ `failed`；修复后 `pipeline_start_stage('design')` 重新开始，重新提交再次进入 `review`。
- product/development/testing/acceptance 的快速模式行为保持不变（提交即 approved + nextStageId）。

### 6.2 视觉评审（design-preview）

- 流水线设计卡：图片产物渲染缩略图（沿用 `ds-pipe-shot`），点击打开应用内大图；HTML 产物的条目改为「预览」按钮 + 选中后内嵌 iframe。
- 工作台设计卡：`designShots` 缩略图点击开大图；`designDocs` 中 `.html/.htm` 显示「预览」入口（打开渲染预览），其余文档保持打开文档/源码。
- 三档宽度：360 / 768 / 1280，按钮组显式标注；默认 1280（或容器 100%，取较小值）；iframe 高度固定（≥640px），容器可横向滚动。
- 「查看源码」为次级文字按钮，打开源码视图（复用 `openFileAt` 后切 `edit`）。
- 预览失败（文件不存在/不可读）：显示可读错误 + 「查看源码」退路，不白屏。

### 6.3 待确认态（design-gate / design-preview 交界）

- 条件：`pipeline.stages.design.status === 'review'`。
- 流水线面板：设计卡顶部状态条「设计稿待你确认 · 确认后进入开发」+ 产物计数 + 通过/打回按钮 + 预览入口。
- 工作台：hero 主操作或 Now 区显示同一语义（同一 i18n 键），保证 Owner 不展开流水线也能看到。
- 通过/打回走现有 `reviewPipelineStage` 与 note 输入；不做二次确认弹窗（避免额外点击层级）。

### 6.4 HTML 文件预览（html-preview）

- `openFile`：`.html/.htm`（含 `.xhtml` 可沿用现有映射，但验收只要求 html/htm）建 tab 时 `mode` 新增 `html`，默认 `view='preview'`。
- 工具栏：`预览 / 源码` 分段切换；预览用 iframe（`src=rawUrl(root, path)`、`sandbox=""`、`title` 为文件名）；源码复用现有编辑器（只读打开、可保存）。
- 异常：空文件显示「文件为空」；读取失败显示错误；SSH 远程根无法 raw 预览时降级为源码并提示（不扩大 SSH 能力边界）。
- 预览不做脚本执行、不做同源访问；不引入新依赖。

### 6.5 模型侧纪律与文案（model-discipline）

- `STAGE_GUIDES.design.deliverables`：首条改为「至少一张可直接查看的截图（PNG/JPG/SVG，命名为 `<页面>-<状态>-<设备>.<ext>`）；可选可预览 HTML」；`doesNot` 增补「不得只交 HTML 源码而不交截图」。
- Lead 纪律（`PIPELINE_SECTION` + 设计提交后指令）：设计提交后 Lead 必须用截图/预览入口向 Owner 汇报并**停下**；禁止把 HTML 源码贴给 Owner；design 未 approved 前不得启动 development。
- `design-no-image` 文案：「设计阶段未提交可直接查看的截图（PNG/JPG/SVG）；HTML 产物只能预览，不能替代截图。」（保留 `code` 不变，避免破坏调用方断言）。
- 快速模式文案统一（zh/en + 工具描述 + 阶段提示）：「product/development/testing/acceptance 自动通过；design/approval/release 始终需要 Owner 确认」。
- `pipeline_submit_stage` 工具描述/README/docs 中凡出现「五个中间阶段」「five intermediate stages」的位置同步改。

---

## 7. 验收标准（可追溯）

| # | 验收标准 | 验证方法 | 溯源 | 优先级 |
|---|---|---|---|---|
| 1 | 快速模式下设计提交后状态为 `review`，不自动通过；开发阶段启动被拒绝并给出指向设计确认的明确提示；Owner 面板通过后才可启动开发 | 以 `gateMode=fast` 调用 `pipeline_submit_stage({stageId:'design'})` → 断言 `status==='review'` 且无 `autoApproved`；`pipeline_start_stage({stageId:'development'})` → 断言 `bad-order` 且消息含「设计确认/上一阶段」；面板 approve 后再启动成功 | 用户场景 1/2 + #1 #2 | P0 |
| 2 | 快速模式文案明确为「四个自动 / 三个需 Owner 确认」 | grep 面板 zh/en、`PIPELINE_SECTION`、工具描述：不存在「五个中间阶段 / five intermediate stages / design 自动通过」错误表述；存在 design/approval/release 需确认的并列说明 | 用户场景 3 + #6 | P0 |
| 3 | 设计截图在流水线卡与工作台卡显示缩略图，点击可看大图 | 提交含 PNG/SVG 的 design 产物 → 两处均出缩略图；点击打开应用内图片查看器；`loading="lazy"`、`alt` 存在 | 用户场景 1 + #3 #4 | P0 |
| 4 | HTML 设计产物提供内嵌渲染预览（360/768/1280 三档），不默认打开源码，另有「查看源码」次级入口 | 提交 `.html` design 产物 → 卡片显示渲染预览；三档按钮切换 iframe 宽度；点条目不再直接进源码；「查看源码」可进源码视图 | 用户场景 1 + #1 #3 | P0 |
| 5 | 设计处于 `review` 时，流水线面板与工作台显示「待你确认 / 确认后进入开发」且含通过、打回、预览入口 | 提交 design 后不 approve，检查两处状态条与按钮；approve/打回后状态条消失 | 用户场景 1/2 + #6 | P0 |
| 6 | 打开 `.html/.htm` 默认渲染预览，工具栏可在预览/源码间切换 | 工作区打开 html 文件 → 默认预览（非源码）；切源码可编辑保存；切回预览渲染；空文件/读取失败有提示 | 用户场景 4 + #3 #4 #5 | P0 |
| 7 | design 提示词要求至少一张可直接看的截图并禁止只交 HTML；Lead 指令要求提交后给 Owner 看截图并停下；无截图 warning 文案准确 | 读 `STAGE_GUIDES.design` 与 `PIPELINE_SECTION`；提交无图 design → warnings 含 `design-no-image` 且文案不再出现「HTML 截图」 | 用户场景 5 + #1 #2 #6 | P0 |
| 8 | 版本与文档：插件 1.2.83、CHANGELOG 1.2.83、ACCEPTANCE 批次 20、docs 同步；交付后根 package.json +1 至 1.2.84 | 核对四个版本/文档位置；根版本在交付提交中 +1 | 工作区硬性规定 | P1 |
| 9 | 质量门全绿且既有功能不回归 | `npm run check`、`npm run check:json`、`npm test` 退出码 0；回归：通过/打回、启动阶段、review note、交付/验收/任务/预览分享、快速模式其它阶段、浅深主题、360/1440 布局 | 用户场景 3 | P0 |

---

## 8. 验收项清单（`acceptance_add` 逐条落库，10 条）

> 说明：本轮新增项全部为 `pending`，由 testing 阶段回填；category 用于模块分组。**不删除历史 19 条已 pass 项。**

| # | title（结论式验收点） | requirement（可复测条件） | category |
|---|---|---|---|
| 1 | 快速模式下设计提交后停在 review，不自动通过 | 准备 `gateMode='fast'` 的工作区，`pipeline_submit_stage({stageId:'design', summary, artifacts:[截图]})`；断言返回阶段 `status==='review'`、不出现 `autoApproved:true`、不返回可继续的 `nextStageId`；`.dsh/pipeline.json` 中 design 为 review、development 仍 pending | design-gate |
| 2 | design 未确认时开发阶段启动被拒绝，确认后可启动 | design 处于 review 时调用 `pipeline_start_stage({stageId:'development'})`，断言抛错 `bad-order` 且错误消息出现「上一阶段」「设计」；在面板 approve design 后再调用，断言成功进入 active | design-gate |
| 3 | 快速模式提示明确「四个自动 / 三个需确认」 | 检查面板快速模式提示（zh/en）、`pipeline_submit_stage`/`pipeline_start_stage` 工具描述、PIPELINE_SECTION：均写 product/development/testing/acceptance 自动通过、design/approval/release 需 Owner 确认；grep 不到「五个中间阶段」「five intermediate stages」等旧表述 | design-gate |
| 4 | 设计截图在流水线卡与工作台卡显示缩略图并可打开大图 | 提交含 PNG 与 SVG 的 design 产物后，流水线设计卡与工作台设计卡各出现缩略图（`loading="lazy"`、有 alt/label），点击在应用内打开该图大图；WebP/GIF 同样可显示 | design-preview |
| 5 | HTML 设计产物内嵌渲染预览且支持 360/768/1280 三档，不默认打开源码 | 提交 `.html` design 产物：设计卡出现 iframe 渲染（src 指向该文件、带 sandbox 与 title），默认不进入源码视图；三档宽度按钮切换后 iframe 宽度变化；「查看源码」次级入口可打开源码 | design-preview |
| 6 | 设计 review 时面板与工作台显示待确认状态及通过/打回/预览入口 | design 停在 review：流水线面板设计卡与工作台显示「设计稿待你确认 / 确认后进入开发」及相关按钮与预览入口；通过或打回后状态提示消失且阶段状态正确变化 | design-preview |
| 7 | 工作区打开 .html/.htm 默认渲染预览，工具栏可切预览/源码 | 打开一个本地 `.html`（含内联 CSS）：默认显示渲染预览而非源码；工具栏「源码」切到编辑视图，「预览」切回渲染；空文件/不可读文件有可读提示与源码退路；深色主题下可读 | html-preview |
| 8 | design 提示词要求交付截图且禁止只交 HTML，无截图 warning 文案准确 | 检查 design 阶段提示词：明确要求至少一张可直接查看的截图（PNG/JPG/SVG）、HTML 仅可选且需可预览、禁止只交 HTML 源码；Lead 指令要求提交后给 Owner 看截图并停下；提交无图片产物的 design，warnings 含 `design-no-image` 且文案为「截图…HTML 不能替代截图」，不出现「HTML 截图」 | model-discipline |
| 9 | 版本与文档同步到 1.2.83 且交付后根版本 +1 | 插件 `dsh-web-filebrowser-plugin/package.json` 为 1.2.83；`CHANGELOG.md` 有 1.2.83 条目；`docs/ACCEPTANCE.md` 有批次 20；`docs/pipeline/` 各文档同步本轮；交付提交中根 `package.json` 为 1.2.84 | version-docs |
| 10 | 质量门全绿且既有功能不回归 | `npm run check`、`npm run check:json`、`npm test` 均退出码 0（含 `scripts/selftest/host-smoke.mjs`）；人工回归：通过/打回、启动阶段、review note、需求查看/追加/修改/新轮、交付打包/下载、任务与指派、预览分享、快速模式 product/development/testing/acceptance 仍自动通过；360/1440 布局无溢出 | regression |

---

## 9. 版本与文档

- 插件 `dsh-web-filebrowser-plugin/package.json`：1.2.82 → **1.2.83**。
- 根 `package.json`：当前 1.2.83；**交付后 +1 至 1.2.84**（工作区硬性规定）。
- `CHANGELOG.md` 增加 1.2.83 条目（闸门 + 预览 + 纪律）。
- `docs/ACCEPTANCE.md` 增加批次 20（设计确认闸门与预览复测步骤）。
- `docs/pipeline/`：`requirements.md`（本文）、`design.md`、`test-report.md`、`acceptance-review.md`、`engineering-research.md`、`release.md` 同步本轮；旧轮文档归档到 `docs/pipeline/archive/`。
- 若面板/工具描述文案变更，同步 `README`/`README.zh` 中流水线章节（如有相关表述）。

---

## 10. 风险与开放问题

| 风险 | 影响 | 缓解 |
|---|---|---|
| 快速模式文案有多处副本（面板 zh/en、`PIPELINE_SECTION`、工具描述、阶段提示），漏改一处即误导 | 中 | 验收项 3 用 grep 反查旧表述；实现时集中到同一常量/同一句式 |
| `sandbox=""` 下依赖脚本的高保真稿视觉/交互缺失 | 中 | 预览以静态视觉为准；若确有交互稿需求，放开 `allow-scripts` 但禁止 `allow-same-origin`，并在 UI 标注 |
| iframe 直接指向 raw URL：跨域/鉴权/SSH 根不可用 | 中 | 本地根优先；SSH 根降级源码并提示；不扩大 SSH 能力边界（验收项 7 的异常分支） |
| `.html` 默认预览改变老用户「打开即改代码」习惯 | 低 | 工具栏一键切源码；回归项覆盖编辑/保存 |
| 设计 Agent 仍只交 HTML | 中 | 提示词硬要求 + `design-no-image` warning + Lead 汇报纪律（验收项 8）；闸门保证没人看就不放行 |
| 设计 review 状态条与工作台 hero 主操作重复/冲突 | 低 | 两处共用同一状态语义与 i18n 键；若冗余只保留一处强提示（创新假设 3） |
| Owner 审批疲劳（每轮都点） | 低 | 只在 design/approval/release 三个动作设门；design 一处点击即可完成（#6） |
| GUI 渲染与主题对比无法由模型完全实测 | 中 | 提供静态断言 + 截图证据；Owner 按 ACCEPTANCE 批次 20 复测，未测项标 blocked，不伪造 pass |

**开放问题（需 Owner 拍板，但不阻塞本轮实现）**

1. 高保真稿若含 JS 交互，是否允许 `allow-scripts`（不与 `allow-same-origin` 同开）？默认不允许。
2. 设计稿大图是否需要在应用内做放大/缩放（当前复用图片查看器即可）？默认不需要。
3. 后续是否需要「设计稿版本对比」？记为后续需求，本轮不做。

---

## 11. 历史与归档

- 上一版文档：v1.2.79 第 7 轮「工作台 UI 全面重构」，已归档到 `docs/pipeline/archive/`；本轮为 v1.2.83 第 11 轮，保留 v1.2.82 交付基线作为审计起点。
- 本轮只覆盖「设计确认闸门 + 预览 + 模型纪律 + 版本文档」，不重述工作台视觉重构内容。
