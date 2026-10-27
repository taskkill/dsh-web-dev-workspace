# 工程调研与借鉴决策：v1.2.83「设计先确认」

> 角色：development 阶段「工程调研」子任务｜日期：2026-10-27（Asia/Shanghai）｜访问日期：2026-10-27
> 上游：[requirements.md](requirements.md)（第 11 轮，§3 范围 / §4 约束 / §6 行为规格）、[design.md](design.md)（§16 设计确认闸门与设计稿预览）。
> 本文只做调研、决策与风险结论，**不改任何代码**；实现落点见 §4.4，供开发/测试对齐。
> 结论先行：**不引入任何第三方依赖，不复制第三方代码/样式/图标/字体/素材；只借鉴 iframe sandbox 隔离、预览弹层信息结构、评审闸门状态机等公开模式，自己实现。** 候选 3 个 GitHub 项目均维护活跃、许可证明确（MIT / MIT / BSD-3-Clause），无 blocked 候选；`raw.githubusercontent.com` 直连在本次会话失败，许可证原文改由 GitHub API `/license` 端点读取并解码确认，不构成候选受阻。

---

## 1. 背景与范围

### 1.1 本轮要解决的三件事

| 维度 | 现状问题（v1.2.82 基线） | 本轮目标 |
|---|---|---|
| **门** | 快速模式把 design 也自动通过，Owner 没有机会拦 | design 移出自动通过名单；未 approved 时 `pipeline_start_stage('development')` 由 Host 拒绝 |
| **面** | 设计产物里图片能看，HTML 只能打开源码 | 流水线/工作台设计卡给缩略图 + 大图 + HTML 渲染预览；`.html/.htm` 默认预览 |
| **证据** | 设计交付可以只给 HTML，Owner 看到的是 `<div>` | 设计提示词要求至少一张可直接看的截图；HTML 只作为可预览补充 |

三件事分别落在 `pipeline.js`（状态机与文案）、`client.js`（预览与入口）、模型提示词/文档（纪律）。本文只研究与决策，不实现。

### 1.2 调研问题

1. 在 Web 应用内安全预览用户/Agent 产出的 HTML，业界成熟做法是什么？`sandbox` 该如何收紧？
2. 设计稿画廊、缩略图、全屏预览弹层的信息结构，有哪些可借鉴的成熟模式？
3. 评审闸门状态机（提交 → 待评审 → 通过/打回 → 重提）有哪些必须由系统强制、不能只靠 UI 提示的约束？
4. 哪些实现值得引入依赖或复制代码？许可证是否允许？
5. 本轮的 security / performance 影响能否控制在「零新增依赖、可忽略」？

### 1.3 范围边界（明确不做）

- 不引入第三方 UI 库、iframe 封装库、lightbox、字体、图标包、运行时服务；不改 `package.json` 依赖与构建步骤。
- 不新增 Host 路由、不新增服务端渲染、不做 HTML → 截图（当前环境无无头浏览器，字体管线不保证）。
- 不改变七阶段数量/顺序、acceptance/approval/release 语义、`.dsh/pipeline.json` 数据结构。
- 不扩大 SSH 能力边界：不新增 SSH 写/执行/转发；预览只读，SSH 根按设计 §16.5 D4 降级为源码并提示。
- 不复制第三方受版权保护的源码、CSS、SVG/图标、字体、文案、界面素材；不把设计稿 CSS/JS 注入主文档。

### 1.4 基线审计（调研时工作区事实）

| 事实 | 证据（文件/位置） | 对本轮的意义 |
|---|---|---|
| raw 读取是只读 GET | `dsh-web-filebrowser-plugin/index.js` `handleGet()`：只接受 `op=raw`，非 raw 返回 `bad-op` 400；本地走 `createReadStream`，SSH 走 `ssh.openRead` | HTML 预览可直接复用，**不需要新路由** |
| raw 已能正确服务 HTML | 同文件 `CONTENT_TYPES` 含 `.html`/`.htm` → `text/html; charset=utf-8`；响应带 `cache-control: no-store`、`x-content-type-options: nosniff`、`referrer-policy: no-referrer`、`content-disposition: inline` | iframe `src` 会按 HTML 渲染，而不是显示源码 |
| raw 有内联预览上限 | 同文件 `MAX_RAW_BYTES = 128 * 1024 * 1024`；仅 inline 预览受限，download 不受限 | 预览侧仍需自己的体积上限，避免超大 DOM 卡死 |
| 已有只读元数据接口 | `op=stat` → `statPath()`，返回 `{ root, path, type, bytes, version }`，本地与 SSH 均支持 | 可作为 iframe 预检：先判存在/类型/大小，再决定是否渲染 |
| 已有审批通道 | `pipeline.js` `reviewPipelineStage`；阶段状态 `review / approved / failed`；`startStage` 已有上一阶段 approved 守卫 | 设计闸门复用现有状态机，不新增审批 API |
| 当前工作区已排除 design 自动通过（v1.2.82 发布版仍是自动通过） | `pipeline.js` `PIPELINE_MANUAL_GATE_STAGES = ['design', 'approval', 'release']`，`fastApproval` 仅对 product/development/testing/acceptance 生效 | 与本文结论一致；发布版基线与开发中工作区需区分 |
| 既有预览浏览器 iframe 的 sandbox **很宽** | `client.js` 约 7446–7458 行：`allow-scripts allow-same-origin allow-forms allow-popups ...`（用户主动打开的网页浏览器） | **不能**把该 sandbox 复用到设计稿预览；设计稿必须默认最严 |
| 现有 `.html` 打开进编辑（v1.2.82） | `client.js` `modeOf()` 把 html 归 `text`；`openFile()` 建 tab 时非 markdown 默认 `view='edit'` | 本轮要改为默认 preview，源码为次级入口 |
| 现有设计产物只列图片 | `client.js` 工作台 `designShots` 只收 `isImagePath()`；`designArtifacts` 其余进 `designDocs` | 需增加 HTML 预览入口；不能只加图片 |

> 说明：本文以 **v1.2.82 发布版** 为问题基线；调研时工作区开发并行进行（`pipeline.js` 已见人工闸门，`client.js` 已见 HTML 预览雏形），最终以提交/验收为准。本文只做调研与决策，不修改代码。

---

## 2. 候选对比表

### 2.1 检索方式

- 2026-10-27 通过 **GitHub REST API** 读取：`/repos/{owner}/{repo}`（stars、license、pushed_at、archived）、`/commits?per_page=1`（最新 commit）、`/releases/latest`（最新发布）、`/license`（许可证原文，base64 解码确认）。
- 通过 `web_search` 发现方向，通过 `web_fetch` 读取官方文档正文（VSCode Webview API、Storybook Story rendering/Viewport、MDN iframe/sandbox、GitHub Docs required reviews）。
- Stars 为 2026-10-27 当日快照，会持续变化；不把 star 数当质量结论，只作「量级」参考。表中 GitHub 时间为 UTC；访问/判断日期按 Asia/Shanghai 记为 2026-10-27。

### 2.2 候选项目（≥2，本轮取 3 个）

| # | 项目 | GitHub | 最近提交（2026-10-27） | 最近发布 | Stars 量级 | License（SPDX） | 活跃度 | 与本轮借鉴点 | 决策 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **microsoft/vscode** | https://github.com/microsoft/vscode | `e809cab7f21792c5a874c45233e13906a8c2e541`（2026-10-27T11:06Z） | `1.143.1`（2026-10-22 UTC；沪 10-23） | 约 **19.4 万**（194,374） | **MIT**（`LICENSE.txt` 原文确认） | `pushed_at` 2026-10-27，`archived=false`，持续日更 | Webview 被定义为主应用内的 iframe；**JavaScript 默认禁用**，需显式 `enableScripts: true`；`localResourceRoots` 限制本地资源；CSP、输入清洗、隔离上下文 | **只借鉴模式，不引入/不复制**：默认最小能力、显式放开、CSP 思维；本项目不是 VSCode 扩展，不需要 webview 消息通道与资源 URI 机制 |
| 2 | **storybookjs/storybook** | https://github.com/storybookjs/storybook | `04d17e424c9594da257f7aea5de830b209aeca53`（2026-10-27T11:26Z） | `v10.6.4`（2026-10-26） | 约 **9.1 万**（91,389） | **MIT**（`LICENSE` 原文确认） | `pushed_at` 2026-10-27，`archived=false`，日更 | 故事在**专用 preview iframe（Canvas）** 中渲染，与应用 UI 隔离；head/body 注入只进 preview iframe；Viewport 工具栏只改 iframe 尺寸 | **只借鉴模式，不引入**：隔离画布 + 尺寸工具栏 + 产物切换的信息结构；Storybook 是开发期工具，引入它会把构建/依赖/运行时整体带进来，远超本轮需求 |
| 3 | **jupyterlab/jupyterlab** | https://github.com/jupyterlab/jupyterlab | `7dfda76f13ea6c84f3665fbad4307ee1a2442a1c`（2026-10-27T09:18Z） | `v4.6.4`（2026-09-21） | 约 **1.5 万**（15,377） | **BSD-3-Clause**（`LICENSE` 原文确认） | `pushed_at` 2026-10-27，`archived=false`，活跃 | `HTMLViewer` 用 `IFrame` 渲染 HTML：`sandbox` 公共集 `['allow-same-origin']`、**untrusted 集 `[]`**、trusted 集 `['allow-scripts','allow-popups']`，并设 `loading:'lazy'`；源码注释明确说明 iframe 可执行脚本/同源请求的风险 | **只借鉴模式，不引入/不复制**：默认最严 + 信任分级 + lazy；本项目比它更严（`sandbox=""`，连 `allow-same-origin` 也不放），且不需要「信任文件」开关 |

### 2.3 逐项判断（采用 / 不采用理由）

**候选 1：microsoft/vscode（MIT）**

- 事实：VSCode 官方文档把 webview 描述为「VSCode 内的 iframe」；「JavaScript is disabled in webviews by default, but it can easily re-enable by passing in the `enableScripts: true` option」；安全章节要求「minimum set of capabilities」、CSP、只走 https、清洗所有用户输入；webview 资源访问默认只限扩展安装目录与当前工作区，`localResourceRoots` 可进一步收紧到 `[]`。
- 借鉴：**默认拒绝 + 显式放开**的能力模型；预览 iframe 不放开脚本；资源访问范围要最小；不把「能渲染」当成「必须渲染」。
- 不采用：不引入 VSCode webview 宿主、`acquireVsCodeApi`、消息通道、`localResourceRoots` 等扩展机制；本项目运行在 DSH Web GUI，已有自己的 raw 只读通道。
- 结论：**模式借鉴，零代码复制，零依赖**。

**候选 2：storybookjs/storybook（MIT）**

- 事实：官方文档明确「stories render in a particular “preview” iframe (also called the Canvas) inside the larger Storybook web application」；`preview-head.html` / `preview-body.html` 注入的是 preview iframe，而不是 Storybook 应用 UI；Viewport 功能「allows you to adjust the dimensions of the iframe your story is rendered in」，内置 320/414/834/1024 等宽度档。
- 借鉴：**预览是一个隔离的框，不是整页替换**；尺寸档位放在工具栏、只改容器/iframe 尺寸；产物切换与画布分离；注入只进预览框。
- 不采用：不引入 Storybook（构建链、依赖、Node 运行时、React 版本约束都不合适）；不复制其 UI 组件/样式/文案。
- 结论：**模式借鉴，零代码复制，零依赖**。

**候选 3：jupyterlab/jupyterlab（BSD-3-Clause）**

- 事实：`packages/htmlviewer/src/widget.tsx` 使用 `new IFrame({ sandbox: Private.common, loading: 'lazy' })`；`Private.common = ['allow-same-origin']`，`Private.untrusted = []`，`Private.trusted = ['allow-scripts', 'allow-popups']`；类注释写明 iframe 文档可执行 JavaScript、可发同源请求，因此用 sandbox 禁止脚本与弹窗，只保留 `allow-same-origin` 让本地 CSS/图片可访问；未信任文档还会注入「不可信文件，动作已禁用」提示条。
- 借鉴：**默认最严（untrusted = 空集）**；脚本能力只在用户明确信任后才放开；`loading="lazy"`；不可信内容要有可见提示。
- 调整：JupyterLab 为了本地相对资源保留 `allow-same-origin`；本项目设计稿是**只读静态预览**，`sandbox=""` 更严，连 `allow-same-origin` 也不放。相对 CSS/图片仍能加载（子资源请求不受 sandbox 同源限制），但脚本、Cookie/存储、表单、弹窗、顶层导航、下载全部关闭。
- 不采用：不复制其 `HTMLViewer` 代码、信任开关、提示文案；不引入 JupyterLab 依赖。
- 结论：**模式借鉴，零代码复制，零依赖**。

### 2.4 辅助标准/平台来源（非候选仓库）

| # | 来源 | URL | 访问日期 | 关键结论（落点） |
|---|---|---|---|---|
| A | MDN · `HTMLIFrameElement.sandbox` | https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/sandbox | 2026-10-27 | `sandbox` 对嵌套内容施加额外限制，默认最严；示例中 `sandbox=""` 即清空全部 allow token；`allow-scripts` 与 `allow-same-origin` 同开会绕过限制（设计 §16.2 已引用） |
| B | MDN · `<iframe>` | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe | 2026-10-27 | `loading="lazy"` 延迟到接近视口再加载，减少初始带宽；`title` 是可访问名称的通用做法；`csp` 属性可对嵌入文档施加 CSP（本轮不用，保持简单） |
| C | GitHub Docs · Approving a PR with required reviews | https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews | 2026-10-27 | required review 会阻止合并；作者不能自批；启用 stale review dismissal 后，新提交会让批准失效、需重新评审；`Request changes` 只有配合规则才阻断 |
| D | Storybook Docs · Story rendering | https://storybook.js.org/docs/configure/story-rendering | 2026-10-27 | preview iframe（Canvas）隔离渲染；head/body 注入只进 preview iframe |
| E | Storybook Docs · Viewport | https://storybook.js.org/docs/essentials/viewport | 2026-10-27 | 通过工具栏调整 iframe 尺寸，内置多种设备宽度；只改尺寸，不换渲染上下文 |
| F | VSCode Docs · Webview API（含 Security） | https://code.visualstudio.com/api/extension-guides/webview | 2026-10-27 | JS 默认禁用、`enableScripts` 显式开启；最小能力、CSP、https、清洗输入；webview 与扩展隔离 |

### 2.5 blocked / 不确定项

- **候选仓库：无 blocked。** 3 个仓库的 repo / commits / releases / license 端点均返回 HTTP 200，许可证原文可读取并解码。
- **传输限制（非候选受阻）**：`raw.githubusercontent.com` 直连在本次会话返回 `fetch failed`；已改用 `https://api.github.com/repos/{owner}/{repo}/license`（base64 内容）确认 MIT / MIT / BSD-3-Clause，未伪造。
- **动态数据**：stars、pushed_at、release 均为 2026-10-27 快照；后续会变化，引用时保留日期。
- **不确定项**：JupyterLab 的 `HTMLViewer` 未来可能调整 sandbox 默认值；本文只把它当模式证据，不作为兼容性承诺。

---

## 3. 许可证矩阵

### 3.1 通用矩阵

| 许可证 | SPDX | 允许复制/修改/分发 | 主要义务 | 本项目结论 |
|---|---|---|---|---|
| MIT | `MIT` | 是 | 保留版权声明与许可声明（副本/实质部分） | **可借鉴**；本轮未复制，若未来复制须在 `THIRD_PARTY_NOTICES` 声明 |
| Apache-2.0 | `Apache-2.0` | 是 | 保留版权、许可与 NOTICE；标明修改；专利授权与终止条款 | **可借鉴**；若复制须附 NOTICE 与变更说明；本轮未复制 |
| BSD-2-Clause | `BSD-2-Clause` | 是 | 保留版权声明与免责声明 | **可借鉴**；本轮未复制 |
| BSD-3-Clause | `BSD-3-Clause` | 是 | 同 BSD-2 + 不得用作者名背书 | **可借鉴**；本轮未复制（JupyterLab 仅模式） |
| ISC | `ISC` | 是 | 保留版权声明与许可声明 | **可借鉴**；本轮未复制 |
| MPL-2.0 | `MPL-2.0` | 是（文件级 copyleft） | 修改过的 MPL 文件须以 MPL 公开源码；保留声明 | **谨慎**；本轮未使用 |
| LGPL-2.1 / LGPL-3.0 | `LGPL-2.1-only` / `LGPL-3.0-only` | 是（弱 copyleft） | 允许动态链接；修改库本身须公开；提供替换库的方式 | **谨慎**；本轮未使用 |
| GPL-2.0 / GPL-3.0 | `GPL-2.0-only` / `GPL-3.0-only` | 是（强 copyleft） | 衍生作品整体须以 GPL 公开源码 | **禁止复制代码**；只能借鉴不受版权保护的模式/思想 |
| AGPL-3.0 | `AGPL-3.0-only` | 是（网络 copyleft） | 通过网络提供服务也触发源码提供义务 | **禁止复制代码**；只能借鉴模式 |
| 无许可证 / 未知 | `NOASSERTION` / 无 | 默认保留所有权利 | 不可复制、不可修改、不可分发 | **禁止复制代码/素材**；只能借鉴模式 |

> 许可证矩阵是工程合规基线，不构成法律意见；若未来引入依赖或复制代码，须由 Owner 确认并在发布前补充第三方声明。

### 3.2 本轮候选的许可证证据

| 候选 | SPDX | 证据 | 结论 |
|---|---|---|---|
| microsoft/vscode | MIT | GitHub API `/repos/microsoft/vscode/license` 返回 `LICENSE.txt`，base64 解码首行 `MIT License`，版权行 `Copyright (c) 2015 - present Microsoft Corporation` | 允许借鉴；本轮未复制 |
| storybookjs/storybook | MIT | `/repos/storybookjs/storybook/license` 返回 `LICENSE`，解码首行 `The MIT License (MIT)`，版权行 `Copyright (c) 2024 Storybook` | 允许借鉴；本轮未复制 |
| jupyterlab/jupyterlab | BSD-3-Clause | `/repos/jupyterlab/jupyterlab/license` 返回 `LICENSE`，解码为 BSD 3-Clause 全文，版权行 `Copyright (c) 2015-2026 Project Jupyter Contributors` | 允许借鉴；本轮未复制 |

### 3.3 本轮结论（合规）

1. **不引入任何第三方依赖**：`dependencies` / `devDependencies` 不变，构建脚本不变，无新增 lockfile 条目。
2. **不复制第三方代码**：不复制源码、CSS、SVG/图标、字体、文档文案、截图素材；只借鉴公开的交互模式与 Web 标准属性。
3. **可借鉴的依据**：MIT/MIT/BSD-3 都允许复制，但「允许」不等于「需要」；本轮功能用现有内联 `h()` + CSS + iframe 标准属性即可完成，复制会引入维护与声明成本，没有收益。
4. **禁止清单**：GPL/AGPL/无许可证代码不进入交付物；MPL/LGPL 即使只动态使用也要评估，不在本轮范围。
5. **未来复制的流程**：在 `THIRD_PARTY_NOTICES`（或等价文件）记录来源 URL、commit/版本、SPDX、版权行、修改说明；Apache-2.0 附 NOTICE；MPL 修改文件按 MPL 公开；GPL/AGPL 一律不复制。

---

## 4. build vs borrow 决策

### 4.1 决策表

| 能力 | 自建（复用现有） | 借鉴/引入 | 决策与理由 |
|---|---|---|---|
| 设计阶段人工闸门 | `pipeline.js` 现有 `submitStage` / `reviewPipelineStage` / `startStage` 状态机 | GitHub required reviews 的「阻断 + 不可自批 + 变更重审」模式 | **自建**：状态机已存在，只改自动通过名单与文案；引入任何审批库都不合适 |
| 设计稿缩略图/大图 | 现有 `isImagePath()`、`rawUrl()`、应用内图片查看器、`ds-pipe-shot` | Figma/Storybook 的「缩略图 → 大图/画布」信息层级 | **自建**：现有组件足够；不引入 lightbox |
| HTML 渲染预览 | 现有 `rawUrl()` + `op=raw` + iframe | VSCode/JupyterLab 的默认最严 sandbox；Storybook 的隔离 preview iframe | **自建**：`sandbox=""` 是浏览器原生能力；封装库没有增量价值 |
| 三档宽度 | 本地 React state + CSS 宽度 | Storybook Viewport 的尺寸工具栏 | **自建**：三个常量 + 按钮组；不引入 Storybook |
| 预览弹层 | 现有 modal 机制 + `aria-modal` / 焦点陷阱 | Figma Branch review 的「header / 主区 / 底部结论」结构 | **自建**：复用现有 modal，不新增路由 |
| 闸门展示 | 现有 pipeline/工作台卡片 + i18n | `role="status"` 提示条、证据前置 | **自建**：只在现有卡片内加状态条与按钮 |
| 错误/空态 | 现有 errorline/toast/空态样式 | 「不白屏、给退路」 | **自建**：错误卡 + 「查看源码」 |
| HTML → 截图 | —— | 无头浏览器 | **不做**：环境无可用无头浏览器，字体不保证；截图由设计 Agent 交付 PNG/JPG/SVG |

### 4.2 选型结论：Build on existing primitives

**不借代码、不借依赖，借模式。** 具体理由：

1. **能力已存在**：`rawUrl()` + `op=raw` 已能把 HTML 以 `text/html` 只读输出；`op=stat` 已能做存在/类型/大小预检；`reviewPipelineStage` 已是唯一审批通道；应用内图片查看器、modal、i18n、`ds-*` 样式均可复用。
2. **新增依赖不解决问题**：第三方 iframe/lightbox 库主要解决样式与手势，不解决「闸门必须 Host 强制」「HTML 必须隔离」「预览不能重复请求」这三个核心约束；反而增加供应链与许可证面。
3. **复制代码不划算**：VSCode 的 webview 宿主、Storybook 的 preview 架构、JupyterLab 的 HTMLViewer 都与各自运行时强耦合；抽取片段的维护成本高于自己写 20–50 行 iframe 逻辑。
4. **安全边界更清晰**：`sandbox=""`、`title`、`loading="lazy"`、`src` 只用 raw URL，是浏览器标准行为，可审计、可静态断言；封装库会隐藏属性与生命周期。

### 4.3 明确不采用的替代方案

| 替代方案 | 不采用理由 |
|---|---|
| 引入 Storybook / 任何预览框架 | 构建链、依赖、运行时、版本约束都远超本轮；Storybook 是开发期工具，不是产品内预览组件 |
| 引入 sandboxed-iframe / lightbox / gallery 库 | 只省少量样式代码，增加依赖、许可证与升级成本；核心安全属性仍需自己设置 |
| `iframe srcdoc` + 把 HTML 读进前端 | 需要先 `fetch`/读文件，重复拉取；相对 CSS/图片会按主文档 URL 解析，路径错；大文件占内存；还要处理转义 |
| `dangerouslySetInnerHTML` 注入设计稿 | 直接与「不向主文档注入设计稿 CSS/JS」冲突；XSS 面最大 |
| 复用现有 preview browser 的 iframe sandbox（`allow-scripts allow-same-origin ...`） | 该 sandbox 是为用户主动打开的网页浏览器设计的；设计稿是 Agent 产出，必须默认最严 |
| 新增 `/preview` 服务端路由或 SSR | 现有 raw 已足够；新增路由会扩大鉴权/路径/SSH 面，且违背「不扩大能力边界」 |
| 无头浏览器自动截图 | 环境无可用无头浏览器，字体管线不保证；需求已把截图定义为设计 Agent 交付 PNG/JPG/SVG |
| `.html` 默认继续源码、只加按钮 | 与「设计稿要能直接看」相反；Owner 仍会被源码挡住 |
| 设计稿 HTML 放开 `allow-scripts` | 未审查的 Agent 产出可执行脚本；若未来要放开，也只能 `allow-scripts` 且**绝不**同时 `allow-same-origin`，并显式标注「脚本受限」 |

### 4.4 实现蓝图（供开发对齐，本文不写代码）

**数据流**

```
pipeline/workbench design artifacts
  → 预览弹层 state：selectedArtifactIndex / width(360|768|1280) / view(preview|source)
  → 图片：应用内图片查看器（rawUrl）
  → HTML：先 op=stat 预检（存在/类型/bytes）→ iframe src=rawUrl + sandbox="" + title + loading=lazy
  → 失败/空/过大/SSH：错误卡 + 「查看源码」（openFileAt 后切 edit）
```

**闸门（Host 为唯一事实源）**

- `PIPELINE_MANUAL_GATE_STAGES` 含 design；`submitStage('design')` 只写 `review`，不返回 `autoApproved`/`nextStageId`。
- `startStage('development')` 在 design 非 `approved` 时抛 `bad-order`，文案明确「请在面板确认设计稿后重试」。
- 通过/打回只走现有 `reviewPipelineStage`；reject → `failed`；修复后重新 `startStage('design')` → 再提交 → 再 `review`。
- UI 只反映状态，**不以按钮 disabled 代替 Host 守卫**；模型无 approve 工具，Owner 是唯一确认者。

**预览（客户端）**

| 项 | 规格 |
|---|---|
| iframe 属性 | `src={rawUrl(root, path)}`、`sandbox=""`、`title="设计稿预览：<文件名>"`、`loading="lazy"`、`referrerpolicy="no-referrer"`；不设 `allow`、不用 `srcdoc` |
| 宽度档 | 360 / 768 / 1280；默认 1280（容器更窄时取 100%）；**只改 iframe/设备框 CSS 宽度**，不改 `src`、不改 `key` |
| React key | 只用 artifact path（或 path+reloadKey）；**绝不能把 width 放进 key**，否则切档会重建 iframe、重复请求 |
| 预检 | 复用现有 `op=stat`（POST，只读）：`type === 'file'` 且 `bytes > 0`；建议预览上限 ≤ 8 MiB（沿用文本上限或单独常量），超限提示「文件过大，无法预览」并给源码 |
| 错误 | stat 失败 → 错误卡（not-found/不可读/目录/空文件）；iframe `onLoad` 关闭骨架；`onError`/超时 → 错误卡 + 重试 + 查看源码；不白屏 |
| 图片 | 缩略图 `img loading="lazy"`；点击用现有图片查看器打开大图；`alt` 用产物 label/文件名 |
| HTML tile | 卡片只显示图标/占位 + 「预览」，**不在卡片里内联 iframe**；同一时刻最多一个活动 iframe（弹层内） |
| 源码 | 次级文字/描边按钮；`openFileAt()` 后切 `edit`；失败/SSH/超大均保留此退路 |
| 文件预览 | `modeOf('.html/.htm')` → preview 默认；工具栏「预览 / 源码」切换；空文件显示「文件为空」；SSH 根禁用预览并提示（设计 D4） |
| 关窗 | 关闭弹层卸载 iframe；Esc 关闭；焦点回到触发按钮；`aria-modal="true"`；不新增路由/历史记录 |

**为什么用 `src` 而不是 `srcdoc`**

- `src=rawUrl` 让浏览器按文档 URL 解析相对 CSS/图片/链接，设计稿的自带资源能正常加载；`srcdoc` 的相对 URL 会按父文档解析，路径错。
- `src` 不需要把 HTML 字符串读进主文档内存，避免重复请求与转义问题。
- 两者都必须 `sandbox=""`；`src` 更简单、更可审计。

**为什么先 `stat` 再 iframe**

- `sandbox=""` 使 iframe 成为不透明源，父页面**无法读取** iframe 内的 404 响应体；如果直接渲染一个不存在的文件，浏览器可能显示 raw 返回的 JSON 错误页，Owner 看到的是 JSON 而不是可读错误。
- `op=stat` 是只读元数据请求，不读文件体；用它先判断存在/类型/大小，满足「可读错误 + 不重复拉取」：**1 次 stat + 1 次 HTML**，宽度切换 0 请求。
- 若测试阶段认为 stat 也多余，最低限度必须保留常驻「查看源码」与 iframe 超时错误卡；但不能声称能精确识别 404。

### 4.5 测试/验收挂钩（供 testing 阶段）

- 静态：`sandbox: ''` / `sandbox=""` 出现在设计预览；设计预览内**不得**出现 `allow-scripts`、`allow-same-origin`；`title:` 必填；`loading: 'lazy'`；宽度常量 360/768/1280 集中一处；`key` 不含 width；无新增 `dangerouslySetInnerHTML`；无新增依赖；`PIPELINE_MANUAL_GATE_STAGES` 含 design。
- 手动：三档宽度切换时 Network 面板无新文档请求；打开预览只发 1 次 stat + 1 次 HTML；404/空文件/超大/SSH 根都有可读提示与源码退路；浅/深主题；键盘可达；Esc 关闭焦点归位。
- 回归：`npm run check`、`npm run check:json`、`npm test`；既有图片/PDF/浏览器预览不受影响。

### 4.6 调研时实现抽查（2026-10-27 快照，不阻断）

> 开发并行进行，以下只是调研时对 `client.js` 的抽查结果，最终以提交/测试为准；列出来是为了让开发在收尾时逐条确认。

| 项 | 抽查结果 | 建议 |
|---|---|---|
| iframe 安全属性 | 已见 `sandbox: ''`、`title: tab.name`、`loading: 'lazy'`、`src: rawUrl(...)`，无 `srcdoc`/`dangerouslySetInnerHTML` | 保持；设计预览弹层的 `title` 建议用「设计稿预览：<文件名>」而非裸文件名 |
| 失败预检 | 尚未见 `op=stat` 预检；404 时浏览器可能直接显示 raw 的 JSON 错误页，父页面因不透明源无法读取 | 按 §4.4 增加 stat 预检，或明确接受 R2 残余风险并在验收记录中说明 |
| 顶层打开入口 | 工具栏 `!isTextMode(tab.mode)` 分支会给 html 显示「用浏览器打开」，即 `window.open(rawUrl, '_blank')`；HTML 与主应用同源，顶层打开会执行设计稿脚本 | **建议对 html 隐藏该入口**，或后续在 raw 的 HTML 响应上加 CSP `sandbox`；至少不能把它当作安全预览 |
| 三档宽度 | 调研时客户端尚无设计预览弹层/宽度档 | 实现时确保 width 只进 CSS、不进 `key`/`src`；网络面板验收 0 请求 |

---

## 5. 安全与性能结论

### 5.1 安全结论（逐条）

| # | 结论 | 依据/落点 |
|---|---|---|
| S1 | 预览 iframe 使用 **`sandbox=""`**（空 token，默认最严） | 不放开脚本/同源/表单/弹窗/顶层导航/下载/模态；设计稿脚本不执行，无法读父文档、Cookie、localStorage、IndexedDB |
| S2 | 必填 **`title`** | iframe 的可访问名称；屏幕阅读器可识别「设计稿预览：xxx.html」；不靠周围文字猜 |
| S3 | **`loading="lazy"`** | 缩略图与 iframe 都懒加载；不打开预览就不拉 HTML；减少初始带宽与内存 |
| S4 | **不向主文档注入设计稿 CSS/JS** | 只用 `iframe[src]`；不用 `srcdoc`、`dangerouslySetInnerHTML`、`innerHTML`、`eval`；设计稿样式被限制在 iframe 内 |
| S5 | raw URL **只读** | `handleGet` 仅 `op=raw`；GET；本地 `createReadStream`；SSH 分支虽是只读 `ssh.openRead`，但设计预览按 S6 不使用；无写、无执行、无转发；响应 `no-store`/`nosniff`/`no-referrer` |
| S6 | **不扩大 SSH 能力** | 不新增 SSH 方法/路由/参数；按设计 D4，SSH 根不启用 HTML 预览、降级源码并提示；`op=stat` 只读元数据也不改变能力边界 |
| S7 | **预览不重复拉取** | 三档宽度只改 CSS 宽度，`src`/`key` 不变；切换产物才换 src；不开卡片内 iframe；缩略图 lazy；同屏最多一个活动 iframe |
| S8 | 文件预览**默认渲染**但源码可回 | `.html/.htm` 默认 preview；工具栏切源码；空/失败/SSH/超大均有退路；保存仍在源码模式 |
| S9 | 不新增 HTML 的「新标签打开」入口；若现有工具栏对 HTML 可见，应收起或明确风险 | raw HTML 与主应用同源；顶层打开会让设计稿脚本以应用源执行。预览只走 sandbox iframe；见 §4.6 抽查 |
| S10 | 失败不白屏 | stat 预检 + iframe onLoad/onError/超时 + 错误卡 + 重试 + 查看源码；错误文案说明「什么错、为什么、怎么修」 |

### 5.2 威胁模型与残余风险

| 威胁 | 向量 | 控制 | 残余风险（可接受/需后续） |
|---|---|---|---|
| XSS / 脚本执行 | 设计稿 `<script>`、事件属性、`javascript:` | `sandbox=""` 无 `allow-scripts`；不注入主文档 | 交互稿的 JS 不执行，静态视觉完整；需在 UI/文档标注「脚本受限」；未来若要放开只能 `allow-scripts` 且禁止 `allow-same-origin` |
| 同源数据读取 | iframe 读父 DOM、Cookie、storage | 无 `allow-same-origin` → 不透明源；跨源访问被拒 | 请求仍会携带同源 Cookie（服务端鉴权需要），但文档不能读 Cookie；表单被禁，无法发起有副作用的提交 |
| 表单/弹窗/顶层导航/下载 | 设计稿内 `<form>`、`window.open`、`target=_top`、`download` | sandbox 默认全部禁止 | 无（浏览器强制） |
| CSS/JS 污染主应用 | 设计稿 `<style>`、全局选择器 | iframe 隔离；不注入 | 无（跨文档样式不生效） |
| raw URL 滥用 | 构造 `op=raw` 读任意路径 | 现有 `resolveRoot`/`childPath`/`inspectTarget` 已有边界；只读；无新参数 | 沿用现有文件 API 的边界；本轮不新增攻击面 |
| SSH 能力扩大 | 预览触发远程写/执行 | 不新增 SSH 方法；SSH 根不预览；stat 只读 | 无新增；远程预览留待后续需求并单独评审 |
| 远程资源/跟踪 | 设计稿引用远程图片/字体/CSS | sandbox 不阻止子资源网络请求；`referrerpolicy="no-referrer"`；只预览工作区内产物 | **存在**：远程图片仍会暴露 IP/加载时间；不自动预览、不预取，打开才加载；如需彻底阻断，后续可加 CSP/代理，不在本轮 |
| 自定义字体缺失 | 不透明源导致 `@font-face` CORS 失败 | 设计稿优先系统字体 | **存在**：使用远程/同源自定义字体的稿可能字体降级；需设计侧知晓 |
| 超大 HTML / DOM DoS | 128MB 上限内的巨大 HTML | stat 预检建议 ≤ 8 MiB；lazy；用户主动打开；弹层可关闭 | 8–128MB 仍可能卡顿；若验收要求更严，调低阈值并在错误卡说明 |
| 点击劫持/伪装 | iframe 内绘制假按钮 | 设计稿在独立设备框内，有边框/标题；无顶层导航 | 低；Owner 应只点 iframe 外的真实按钮（通过/打回在父页面） |
| 文件名/标签 XSS | 产物路径含 `<`/`"` | React 文本节点渲染；`title` 限长；不拼 HTML | 无（React 转义） |
| 供应链 | 新增依赖 | 零新增依赖、零构建变更 | 无新增；现有依赖不变 |

### 5.3 性能结论

| 指标 | 结论 | 说明 |
|---|---|---|
| 新增运行时依赖 | **0** | 不改 `package.json` / lockfile / 构建脚本；只用浏览器原生 iframe |
| 新增构建步骤 | **0** | 仍为现有 `client.js` 内联 `h()`/CSS/i18n |
| 包体增量 | 仅组件代码（JSX/CSS/i18n 文案），无第三方库 | 具体字节以开发后实测为准，本文不虚构数字 |
| 打开预览的网络 | **1 次 `op=stat` + 1 次 `op=raw`（HTML）** | 图片预览复用 raw；缩略图 lazy；不预取未打开的 HTML |
| 三档宽度切换 | **0 请求** | 只改 iframe/设备框 CSS 宽度；`src`/`key` 不变；不重建 iframe |
| 切换产物 | 1 次新 HTML 请求 | 单 iframe 换 src；旧文档随卸载释放 |
| 卡片渲染 | 不内联 iframe；HTML tile 只显示占位/图标 | 避免列表里多个活动文档；每卡最多 20 个产物（沿用现上限） |
| 图片缩略图 | `loading="lazy"` | 视口外不加载；大图点击后才用图片查看器 |
| CPU/内存 | 可忽略量级 | 无定时器/轮询/动画；仅 onLoad/onError 回调；弹层关闭即卸载 |
| 缓存 | raw `cache-control: no-store` | 重新打开会重新拉取；设计稿体积小，可接受；不为了缓存改服务端 |
| 首屏 | 无影响 | 预览是用户动作后加载；不改变工作台/流水线首屏请求 |

**结论：本轮性能影响可忽略。** 没有新增依赖/构建步骤；唯一新增网络是用户主动打开预览时的 stat + HTML；宽度切换不产生请求；卡片不内联 iframe。

### 5.4 兼容性与可访问性

- 目标浏览器：现代 Chromium / Safari / Firefox；`iframe sandbox`、`loading` 均为广泛支持特性；不支持 `loading="lazy"` 的旧浏览器只是立即加载，不影响功能。
- iframe `title` 必填；弹层 `role="dialog"` + `aria-modal="true"` + `aria-labelledby`/`aria-describedby`；Esc 关闭并归还焦点；通过/打回/预览按钮 ≥44px；状态不只靠颜色（warn 色 + 文案 + 计数）。
- 预览 iframe 内的内容对屏幕阅读器是可访问的嵌入文档；标题提供上下文。iframe 内容若依赖脚本，读屏/交互会受限，需以「脚本受限」提示与源码退路兜底。

---

## 6. 来源 URL + commit/版本 + 访问日期

> 访问日期统一为 **2026-10-27**（Asia/Shanghai）。GitHub 数据为当日 API 快照。

| # | 来源 | URL | 版本 / commit | 访问日期 | 用途 |
|---|---|---|---|---|---|
| 1 | microsoft/vscode | https://github.com/microsoft/vscode | 最新 commit `e809cab7f21792c5a874c45233e13906a8c2e541`（2026-10-27）；最新 release `1.143.1`（2026-10-22 UTC） | 2026-10-27 | 候选 1；默认最小能力/webview 隔离 |
| 2 | microsoft/vscode · LICENSE | https://github.com/microsoft/vscode/blob/main/LICENSE.txt | `LICENSE.txt`（MIT，版权 2015–present Microsoft） | 2026-10-27 | 许可证确认 |
| 3 | microsoft/vscode · Webview API | https://code.visualstudio.com/api/extension-guides/webview | 文档页（2026-10-27 抓取） | 2026-10-27 | `enableScripts` 默认关闭、CSP、最小能力、输入清洗 |
| 4 | storybookjs/storybook | https://github.com/storybookjs/storybook | 最新 commit `04d17e424c9594da257f7aea5de830b209aeca53`（2026-10-27）；最新 release `v10.6.4`（2026-10-26） | 2026-10-27 | 候选 2；preview iframe 隔离 |
| 5 | storybookjs/storybook · LICENSE | https://github.com/storybookjs/storybook/blob/next/LICENSE | `LICENSE`（MIT，版权 2024 Storybook） | 2026-10-27 | 许可证确认 |
| 6 | Storybook Docs · Story rendering | https://storybook.js.org/docs/configure/story-rendering | 文档 v10.6（2026-10-27 抓取） | 2026-10-27 | preview iframe / Canvas；注入只进预览框 |
| 7 | Storybook Docs · Viewport | https://storybook.js.org/docs/essentials/viewport | 文档 v10.6（2026-10-27 抓取） | 2026-10-27 | 只改 iframe 尺寸的工具栏模式 |
| 8 | jupyterlab/jupyterlab | https://github.com/jupyterlab/jupyterlab | 最新 commit `7dfda76f13ea6c84f3665fbad4307ee1a2442a1c`（2026-10-27）；最新 release `v4.6.4`（2026-09-21） | 2026-10-27 | 候选 3；HTMLViewer sandbox/lazy |
| 9 | jupyterlab/jupyterlab · LICENSE | https://github.com/jupyterlab/jupyterlab/blob/main/LICENSE | `LICENSE`（BSD-3-Clause，版权 2015–2026 Project Jupyter Contributors） | 2026-10-27 | 许可证确认 |
| 10 | JupyterLab · HTMLViewer 源码 | https://github.com/jupyterlab/jupyterlab/blob/main/packages/htmlviewer/src/widget.tsx | `main`（文件 blob `401dd24e0e797b1cc9beff7b389defc8ec9b09ff`） | 2026-10-27 | `sandbox` 公共/未信任/信任集合与 `loading:'lazy'` |
| 11 | MDN · `HTMLIFrameElement.sandbox` | https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/sandbox | 标准文档（Baseline widely available） | 2026-10-27 | `sandbox=""` 语义、默认最严 |
| 12 | MDN · `<iframe>` | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe | 标准文档（Baseline widely available） | 2026-10-27 | `loading="lazy"`、`title`、`csp` 属性 |
| 13 | GitHub Docs · Approving a PR with required reviews | https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews | 文档页（2026-10-27 抓取） | 2026-10-27 | required review 阻断、不可自批、变更后重审 |

**检索方法可复现**：`GET https://api.github.com/repos/{owner}/{repo}`、`/commits?per_page=1`、`/releases/latest`、`/license`。三个仓库上述端点均 HTTP 200。

**受限期说明**：`raw.githubusercontent.com` 直连在本次会话 `fetch failed`；许可证原文通过 GitHub API `/license` 的 base64 内容读取，未使用不可靠的二手信息；无候选 blocked。

---

## 7. 不复制第三方代码声明与风险

### 7.1 声明

本轮交付物（含本文及后续实现）**不包含任何第三方源代码、CSS、SVG/图标、字体、图片、设计素材或文档文案的复制**。具体地：

1. 不引入第三方 npm 包、CDN、字体、图标库、运行时服务；`package.json` 依赖与构建步骤不变。
2. 不复制 VSCode / Storybook / JupyterLab 的代码片段；不复制其界面布局、文案、图标、配色。
3. 只借鉴**不受版权保护的模式与标准属性**：`iframe sandbox`（HTML 标准）、隔离预览画布（通用架构模式）、评审状态机（通用流程模式）、「证据先于确认」的信息层级（通用交互原则）。
4. 设计稿效果图由本项目自行生成（`docs/pipeline/design/`），不包含第三方素材。
5. 若未来确需复制 MIT/BSD/Apache/ISC 代码，按 §3.3 流程补充声明；GPL/AGPL/无许可证代码一律不复制。

### 7.2 如何复核

- `git diff`：**本次调研提交只修改本文**；实现轮次的 diff 另计（当前工作区还包含 requirements/design/pipeline.js 等其它阶段的改动），实现 diff 只应出现 `client.js` / `pipeline.js` / 文案/版本/文档，不应出现第三方文件。
- `package.json` / lockfile：依赖零变化。
- 静态搜索：`client.js` 设计预览内无 `allow-scripts` / `allow-same-origin`；无新增 `dangerouslySetInnerHTML` / `eval` / `srcdoc`。
- 许可证扫描：交付物中无第三方版权头、无第三方 LICENSE 文件被误加入。

### 7.3 风险登记册

| # | 风险 | 影响 | 可能性 | 缓解 | 剩余风险 |
|---|---|---|---|---|---|
| R1 | `sandbox=""` 使交互稿 JS 不执行，预览看起来「不完整」 | 中（评审误判） | 中 | UI 标注「脚本受限/静态预览」；保留源码入口；设计交付要求至少一张静态截图 | 交互稿无法在预览中演示，需 Owner 知情 |
| R2 | iframe 内 404/错误页不可读（不透明源） | 中（白屏/JSON） | 中 | `op=stat` 预检 + iframe onLoad/onError/超时 + 错误卡 + 查看源码 | stat 与 iframe 之间文件被删的竞态（极低）；仍可能显示一次性错误页 |
| R3 | raw HTML 与主应用同源，若被顶层打开会以应用源执行脚本 | 高（若发生） | 低 | 不新增「新标签打开 HTML」入口；对 HTML 收起现有「用浏览器打开」；只允许 sandbox iframe；源码可看 | 用户手动复制 raw URL 到地址栏仍可能触发（既有行为，非本轮新增） |
| R4 | 设计稿引用远程资源，泄露 IP/Referer 或加载失败 | 低-中（隐私/保真） | 中 | `referrerpolicy="no-referrer"`；只预览工作区产物；不预取；打开才加载 | 远程图片仍会发起请求；彻底阻断需 CSP/代理（后续） |
| R5 | 超大 HTML 造成卡顿 | 中（性能） | 低 | stat `bytes` 预检，建议 ≤8 MiB；超限给源码；lazy | 8–128MB 仍可能卡；阈值可按实测调整 |
| R6 | 自定义字体在 opaque origin 下 CORS 失败 | 低（视觉降级） | 中 | 设计稿优先系统字体；错误/降级可见 | 字体降级可能影响像素级评审 |
| R7 | 快速模式文案不同步，残留「五个中间阶段」误导 | 中（流程误读） | 中 | 统一 i18n/工具描述/阶段提示；测试用关键词断言 | 旧版本缓存/旧文档可能仍显示旧文案 |
| R8 | 设计闸门被 UI 绕过（只 disabled、Host 不拦） | 高（流程失效） | 低 | Host `startStage` 守卫 + `fastApproval` 排除；测试直接调工具验证拒绝 | 无（Host 强制） |
| R9 | 预览重复请求（把 width 放进 key / 重渲染换 src） | 低（性能） | 中 | key 只用 path；宽度只改 CSS；网络面板验收 | 无（可静态断言） |
| R10 | 第三方许可证/来源记录缺失（未来复制时） | 中（合规） | 低 | 本文 §3.3 流程；`THIRD_PARTY_NOTICES` | 依赖人工执行 |

### 7.4 最终结论

- **Build, don't borrow code.** 复用现有 raw 只读通道、stat 元数据、审批状态机、modal/图片查看器与 `ds-*` 样式；不引入依赖、不复制代码。
- **Borrow patterns only.** 默认最严 sandbox（VSCode/JupyterLab）、隔离 preview iframe（Storybook）、尺寸工具栏（Storybook Viewport）、强制评审 + 不可自批 + 变更重审（GitHub required reviews）、证据先于确认（Figma/评审工作流）。
- **Security posture.** `sandbox=""` + `title` + `loading="lazy"`；不注入主文档；raw 只读；不扩大 SSH；三档宽度零请求；失败有可读提示与源码退路。
- **Performance.** 零新增依赖/构建；预览按需加载；宽度切换不重拉；影响可忽略。
- **No blocked.** 3 个候选仓库、许可证与官方文档均可访问；传输限制已用 API 端点绕开，未伪造任何数据。

---

## 8. 历史（上一版调研）

本文件上一版为 **v1.2.79 工作台 UI 全面重构**的工程调研（commit `50cbc34`），结论是零依赖、只借鉴 shadcn/ui、Radix Primitives、Carbon、Lucide、Tailwind 的模式。该轮已交付，全文保留在 git 历史中：

```bash
git show 50cbc34:docs/pipeline/engineering-research.md
```

本轮（v1.2.83）按新需求重写为「设计先确认」调研；上一轮的候选与结论不再作为本轮依据，避免把 UI 组件库选型混入本轮 iframe 安全/闸门决策。
