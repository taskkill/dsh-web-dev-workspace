# 路线图：从「文件工作区」到「完整项目开发」

> 基线：v1.2.21（2026-10-25）。目标：**只用 Harness 对话 + Dev Workspace 插件完成一个完整项目**，不切回本地 IDE。
>
> 调研方式：3 个智能体并行（源码能力审计 / Harness 集成面测绘 / 浏览器 IDE 与 Agent 工作流基准），Lead 汇总并复核关键 API 与代码证据。原始调研记录保留在本地 `.dsh/tmp/team/`（不随仓库发布）：
> `capability-audit.md`（插件现状与 17 条内部缺口）、`harness-integration.md`（Harness 内置能力与 slot/service）、`workflow-gaps.md`（12 阶段基准与 Top-10）。
>
> 成本口径：**S** ≤ 1 天，**M** ≈ 2–5 天，**L** > 1 周（粗估，单人）；影响：**MUST / SHOULD / NICE**。

---

## 0. 一页结论

插件已经把「看 / 改 / 搜 / 传 / Git 基础 / 终端 / 预览 / 待办 / 记忆 / SSH / 移动端」做齐，**单文件级开发没有硬伤**。真正阻碍「整项目开发」的不是编辑器缺功能，而是**三个闭环**：

| # | 断掉的闭环 | 现状 | 后果 |
|---|---|---|---|
| 1 | **运行 → 验证** | 只有终端和自建「快捷命令」；没有任务/进程中心、没有 Problems 诊断、测试结果只能肉眼看终端 | 「项目跑起来没有、错在哪、测试过没过」无法结构化回答，人和 agent 都无法据此闭环 |
| 2 | **审查 → 回滚** | 能看到 Git diff 和 Harness 的 changed-files diff，但没有「本轮改了什么 / 接受 / 回滚 / 行内反馈」 | agent 改代码不可低成本审查，出错只能手动 git restore |
| 3 | **编辑现场** | 刷新即丢所有打开标签、未保存缓冲和终端；文本编辑器无 undo/多光标/跳转 | 长会话开发被迫「一次只做一小步」，整项目开发节奏被打断 |

另有三个结构性事实：

- **执行层在重复建设**：插件自建 PTY + 快捷命令，而 Harness 已有 `ctx.remote.terminal`（进程恢复/attach）、`ctx.jobs`（后台任务 roster/kill）、`workspaceFiles.watch`。先统一执行层，后续任务/测试/预览/状态栏共享同一份数据，成本反而下降。
- **编辑器在 agent-first 里首先是审查界面**：优先级应是「看清 agent 改了什么、能否反悔」>「补全/跳转」。
- **预览有隐藏前提**：直连 `localhost` 的 iframe 假设浏览器与 Host 同机；公网代理不转发 Cookie、无 WebSocket（HMR 会挂）。手机/平板/远程访问时预览会直接失效。

**如果只能做一件事**：**Problems/诊断面板 + 任务运行器**——把构建、lint、typecheck、测试的输出变成可点击、可交给 agent 的结构化数据。这是与本地 IDE 差距最直观、且同时服务人和 agent 的一项。

**建议节奏**：v1.3 运行与诊断（P0）→ v1.4 审查与恢复（P1）→ v2.0 代码智能与验证（P2）→ v2.x 交付与工程化（P3）。

---

## 1. 现状盘点（一表看清）

| 领域 | 已有能力 | 关键限制（文档未全部披露） | 与「整项目开发」的差距 |
|---|---|---|---|
| 文件树 / 文件操作 | 工作区注册、增删改移复制、拖入上传、下载、收藏、隐藏文件、路径地址栏 | 单根目录；无多选、无目录级传输、无回收站；`list` 只回 name/type（无大小/时间）；symlink 显示为 other；每 5s 轮询（≤32 个展开目录） | 批量重构/工程搬迁、大仓浏览效率 |
| 编辑器 | 多标签、40+ 语言高亮、行号、自动换行、保存/重载/冲突保护、Markdown 分屏 | `<textarea>`+高亮层，无 undo 栈/多光标/折叠/括号匹配/格式化/跳转定义；查找替换仅当前文件、无正则；8 MiB 上限；SVG 只能当图片 | 日常手改效率、重构与导航 |
| 搜索 / 导航 | 全文搜索（正则/大小写）、快速打开、命令面板、地址栏跳转 | 搜索 500 条 / 5000 文件 / 2 MiB / 深度 24；**快速打开 5000 文件截断且客户端不提示**；只能看不能替换 | 跨文件改名/批量修改、大仓定位 |
| 终端 | xterm.js + Host PTY（本地/SSH）、面板/编辑区互转、快捷命令发现、长轮询即时输出 | **刷新即关闭**（无重连恢复）；≤8 个；1 MB 输出缓冲；scrollback 4000；Windows 无 PTY；无链接识别/搜索 | dev server/build 不能长期驻留；日志难检索 |
| Git | status/stage/commit/stash/branch/fetch/pull/push/diff/提交图/compare | 仅整文件暂存；diff 只读；**无 hunk 暂存、无 merge/rebase UI、无冲突解决**（Host 已有 pull rebase/merge 参数，UI 未暴露）；无 clone/blame/tag/amend；要求工作区=仓库根 | 合并冲突、提交前整理、从零拉项目 |
| 预览 / 浏览器 | 内置 iframe 浏览器、PC/手机视口、端口探测、收藏、公网代理 | 同源页面禁止；公网代理不转发 Cookie/登录态；无 WS（HMR 失效）；仅「浏览器与 Host 同机」可用 | 手机/远程看效果、真实前后端联调 |
| 记忆 / 待办 | 每工作区 JSON + 模型工具 + 面板 | SSH 根不可用；记忆注入预算 4000 字符 | 已足够，勿重做 |
| SSH | SFTP 浏览/编辑、远程 PTY 终端 | 无全局搜索/快速打开/Git/记忆/待办；主机密钥不校验；断连不自动重连 | 远程开发仍是二等公民 |
| Agent 协作 | 悬浮官方对话、选中代码「解释/修复/写测试」、`+` 新会话 | 单向文本；无 diff 审阅/接受/拒绝/回滚；人工保存不进 Harness 的 changed-files 卡 | agent-first 开发的审查闭环 |
| 设置 | 版本检查/一键更新、Harness 信息面板 | 偏好散落 8+ 个 localStorage key；无设置页；Harness 面板的「检查」跑的是**插件自身** `npm run check`，不是当前项目 | 多浏览器/多设备一致性 |
| 移动端 | <900px 单列、全屏、安全区、移动端悬浮对话全屏 | 缩放/键盘/长列表体验一般；预览依赖同机 | 移动端作为主力的准备度 |

---

## 2. 五个结构性判断

1. **先统一执行层，再叠面板**。目前两套进程世界：插件 PTY 与 Harness `terminal`/`jobs`。agent 起的 dev server/测试在插件里看不见，人起的进程 agent 也拿不到。统一后，「任务中心 / 输出 / 问题 / 端口 / 退出码 / 停止重启 / 通知」共享一份数据。
2. **把编辑器当审查界面**。对 agent-first 流程，最高价值不是补全，而是：本轮改动的文件清单 → diff → 接受/回滚 → 行内评论发给 agent。Harness 已提供 changed-files 卡与 review tab，插件应接入而不是重写比较器。
3. **双向可观测**。人要看得到 agent 做了什么（命令、diff、端口、计划、失败）；agent 要看得到运行结果（错误列表、测试失败、页面截图/console）。缺一半，闭环就断。
4. **浏览器/手机的隐藏前提**。预览、终端、端口自动打开都假设「浏览器与 Host 同机」。要成为日常主力，需要 Host 侧端口反代（WS + Cookie + 鉴权 + 多端口）。
5. **安全与审计不对称**。agent 工具受审批/沙箱/审计约束；插件 Host 路由以 Harness 进程权限直写磁盘。插件侧保存不会进入 session 的 changed-files / 日志（第三方插件被禁止写 session 记录）。密钥、`.env`、部署凭据需要前置设计，不能靠 memory 或聊天传递。

---

## 3. 路线图

### P0 — 运行与诊断闭环（目标 v1.3，约 2–3 周）

| # | 能力 | 为什么 | 做什么 | 落点 | 成本 | 验收 |
|---|---|---|---|---|---|---|
| P0-1 | **执行中心** | 一个进程只能有一套真相 | 统一「命令/任务→进程→日志→端口→退出码」的数据模型；接入 Harness `ctx.jobs`（roster/follow/kill）与 `ctx.remote.terminal`（可恢复）；插件自建 PTY 逐步退休或仅作降级 | Host 服务 + client 面板；`ctx.jobs` / `ctx.remote.terminal` | M | 刷新/断线后任务仍在；agent 与人都能看到同一列表并能停止 |
| P0-2 | **任务面板** | 「一键跑」是日常最高频动作 | `.dsh/tasks.json` 定义 + 自动发现（`package.json` scripts、Makefile、Cargo、Maven、Compose…）；run/stop/restart、输出流、退出码、失败通知；输出面板聚合 | Host `runTask`（流式+取消）或复用执行中心；client 底部面板 | M | 从面板跑 dev/build/test，输出可滚动/搜索，失败有 toast 与徽标 |
| P0-3 | **Problems 诊断** | 与本地 IDE 差距最直观 | 运行 `tsc --noEmit`、eslint/biome（JSON 格式）、构建错误，解析为 `file:line:col + severity + message`；点击跳转编辑器行；一键「把错误发给 agent 修」 | Host op（命令 + 解析）+ client 底部「问题」面板 | M | 类型/语法/构建错误 100% 可点击；错误数进状态栏 |
| P0-4 | **测试面板** | test-fix 循环是 agent 交付质量保障 | 检测框架（vitest/jest/pytest/go test…）；按文件/单测运行、失败树、跳到失败断言行、rerun failed；失败片段一键成 prompt | 复用 P0-1/2 执行层 + JSON reporter 解析 + client 面板 | M | 单测失败可两跳内定位并发给 agent |
| P0-5 | **全局状态栏** | 让「现在什么在跑、哪里出错」常驻可见 | `shell.bottom` 注册全局条：分支/未提交、运行中任务、端口、错误数、待审批提示；点击打开对应面板 | client `shell.bottom` + 面板联动 | S–M | 不打开聊天也能一眼看到项目状态 |

> P0 完成后，**「改 → 跑 → 看错 → 改」在插件内闭环**，这是从「编辑器」变成「开发环境」的分水岭。

### P1 — 审查、恢复、编辑地基（目标 v1.4，约 3–4 周）

| # | 能力 | 为什么 | 做什么 | 落点 | 成本 | 验收 |
|---|---|---|---|---|---|---|
| P1-1 | **Agent 变更审阅** | agent-first 的核心信任机制 | 回合/会话级 change-set 面板：改动的文件、行数、diff；单文件接受/回滚；行内评论→发给 agent；接入 Harness changed-files 卡与 review tab 的「在 Dev Workspace 打开」 | client 面板 + `deliverables.file.actions` / `deliverables.review.file.actions`；回滚复用 write/git restore | M–L | 一轮 agent 改动可在 30 秒内审完并整体回滚 |
| P1-2 | **编辑现场恢复** | 刷新不再毁掉工作 | 持久化打开的标签、未保存草稿、滚动/光标位置（localStorage 或 `.dsh/session.json`）；终端改用 `ctx.remote.terminal` 支持 attach；`beforeunload` 有未保存时确认 | client 初始化恢复 + Host 持久化 op | M | 刷新后标签/草稿/终端原样回来 |
| P1-3 | **Git 补全第一档** | 迟早撞上 clone 与 merge 冲突 | hunk/行级暂存（diff 选行→`git apply --cached`）；merge/rebase UI（Host 已支持 pull 模式）；冲突文件三栏或「用某一侧」；clone 到新工作区；blame | `dsh-web-filebrowser-git/index.js` 新 op + client Git 面板 | M | 冲突可在浏览器内解决；可从面板 clone 新项目 |
| P1-4 | **全局搜索替换** | 批量改名/迁移刚需 | `searchReplace` dry-run：include/exclude glob、子目录范围、AbortSignal；逐文件 diff 预览后批量写；显示扫描上限与截断 | Host 新 op + 现有搜索面板 | S–M | 一次替换跨 50 文件，先看 diff 再落地 |
| P1-5 | **编辑器换 CodeMirror 6** | 手改代码的地基 | 在 `main` 面板内替换 `textarea`：多光标、撤销重做、折叠、括号匹配、正则查找、大文件分块高亮；保留现有 read/write 版本守卫与查找语义 | client 组件替换（vendored ESM，无构建约束） | M | 撤销/多光标/折叠可用；10k 行文件不卡 |
| P1-6 | **设置与快捷键** | 偏好应可移植 | `ctx.configForms` + `settings.section` 承载编辑器/终端/工作区偏好（替代 8+ localStorage key）；`ctx.shortcuts.register` 注册常用动作；`ctx.commandUi.register` 注册 `/workspace` 命令 | client 服务消费 | S–M | 换浏览器/设备后偏好仍在 |

### P2 — 代码智能与验证（目标 v2.0，约 1–2 个月）

| # | 能力 | 为什么 | 做什么 | 落点 | 成本 | 验收 |
|---|---|---|---|---|---|---|
| P2-1 | **轻量 LSP 桥** | 跳转/引用/重命名/格式化 | Host 起语言服务器（先 TS/JS、Python，再 Go/Rust），WS/SSE 转发到编辑器；先做 diagnostics/hover/definition/format，后补补全/rename | Host LSP 桥 + CodeMirror 扩展 | L | `F12` 跳定义、`Shift+F12` 引用、格式化可用 |
| P2-2 | **Agent 可驱动浏览器验证** | UI 类任务成败靠视觉 | Host 侧无头浏览器（或接入已有 Playwright）：截图、console、DOM 查询、点击；结果作为 agent tool + 工具卡片/附件进入对话 | Host 新工具（`ctx.tools.register`）+ client `tool.call.toolview` | M–L | 「打开页面→截图→验证→继续改」由 agent 自主完成 |
| P2-3 | **预览反代** | 手机/远程/登录态/WS | Host 反向代理：WebSocket、Cookie、鉴权、多端口、HMR 透传；端口→预览一键；dev server 重启自动刷新 | Host proxy（扩展现有代理）+ client | M–L | 手机通过 Harness 地址看到带 HMR 的 dev server |
| P2-4 | **环境与密钥** | 私有依赖/DB/部署都需要 | 每工作区 secrets（只存 Host、不进 memory/提示词）、`.env` 掩码编辑、任务/终端/部署按需注入；敏感文件编辑提示或走审批 | Host secret store + client 面板 + `dsh-user-approval` 集成 | S–M | 密钥不出现在聊天/日志；任务能读到注入值 |

### P3 — 交付与工程化（v2.x，按需）

- **依赖管理**：pnpm/npm/pip 的安装/升级/漏洞面板，锁文件 diff。
- **数据库 / 迁移**：连接（凭据走 secrets）、表浏览、SQL 执行、迁移运行与状态；先做 agent tool，再做面板。
- **部署 / PR**：一键部署 + 可分享预览 URL + 历史回滚；GitHub PR 创建/checks/评论回流 agent。
- **并行工作流**：workspace/多根、git worktree UI（Harness 已有 `experimental-tool-worktree`）、devcontainer 识别与预构建。
- **多人协作 / 权限**：远程访问策略、只读分享、审批策略（依赖上游 DSH 能力）。

---

## 4. 先接后建：Harness 已有能力的整合清单

原则：**能接就接**，插件只保留 Harness 不提供的写路径（文件写、Git、SSH、任务执行编排）。

| 插件现状 | 应改用 / 接入的 Harness 能力 | 证据 | 收益 | 风险 |
|---|---|---|---|---|
| 自建 Host PTY 终端 | 客户端 `ctx.remote.terminal`（environment/shells/list/create/attach/rename/close，按 Session 作用域） | `dsh-api-terminal-controller/README.md` | 刷新/断线恢复、Windows、主题字体、idle 回收 | 会话作用域与插件「工作区」语义需对齐 |
| 无后台任务视图 | 客户端 `ctx.jobs`（roster/follow/kill） | `dsh-client-ui-jobs/README.md` | dev server/watch/build 统一可见、可停 | 只覆盖 agent 起的 job，人起的需要 Host 侧自建 |
| 自建 5s 轮询读文件 | `remote.workspaceFiles.read/readBytes/stat/watch`（只读） | `dsh-api-workspace-files/README.md` | 精确 watch、少轮询 | 无写能力，保存仍走自建路由 |
| 自建只读 diff 视图 | `deliverables.file.actions` / `deliverables.review.file.actions` + `ctx.workspaceChanges`（Host） | `dsh-client-ui-deliverables/README.md` | 复用官方 review tab；加「在 Dev Workspace 打开」按钮 | 只覆盖 agent 工具改动，人工保存不进 |
| 自建文档预览 | `documentPreviews.register` + `sidebar.right.tab.document.actions`（owner prop `absolutePath`） | `dsh-client-ui-sidebar-documentpreview/README.md` | 官方 Markdown/Office/图片预览 + 一键用插件编辑 | 接管 resource 类型会顶掉官方预览，优先用 actions |
| 面板内浏览器按钮 | `ctx.sidebarRight.openTab('browser', { params: { url } })` | `dsh-client-ui-sidebar-browser/README.md` | 复用沙箱/CSP/open-in-app | 只适合同源允许的页面 |
| 命令面板 9 条命令 | `ctx.commandUi.register` / `ctx.shortcuts.register` | 对应包 README | 与 Harness 命令/快捷键体系统一、用户可改键 | 需处理与现有快捷键冲突 |
| 8+ localStorage 偏好 | `ctx.configForms` + `settings.section` | `dsh-client-ui-settings/README.md` | 跨设备一致、官方设置页 | 需 Host 侧配置命名空间 |
| memory/todo 工具无专属卡片 | keyed 槽 `tool.call.toolview` | `dsh-client-ui-tool/README.md` | 时间线上有结构化卡片，与内置 `todo_write` 分工更清楚 | 0.2.1-rc.2 契约可能变 |
| 悬浮对话已是官方 Conversation | 保持；可加 `conversation.view` 注册（Chat / Workspace 视图切换） | `dsh-client-ui-conversation/README.md` | 中心列可切换视图且保留 composer | 与 `main` 面板并存，需处理布局记忆 |

**已验证可用**（Lead 复核）：`ctx.remote.terminal`、`ctx.jobs`、`ctx.configForms`、`ctx.shortcuts`、`sidebarRightTabs.register({patterns, priority})`、`sidebar.right.tab.document.actions`、`ctx.sidebarRight.openTab('browser', {params})`、`deliverables.*.file.actions`。

> 注意：Harness `0.2.1-rc.2` **没有 API 稳定性承诺**。所有接入都放在 `ctx.inject([...])` 能力探测里，缺失时退回现有实现；slot 注册放进 `ctx.effect`。

---

## 5. 技术落点与风险

1. **API 稳定性**：0.2.1-rc.2 的 service/slot 契约随版本变化；插件 README 已声明可能需适配。接入点必须能力探测 + 降级，并锁定已测试版本。
2. **owner-only**：插件 Host 精确路由只对 owner 浏览器开放；多用户/远程协作需要 DSH 的 remote-access 策略，不能靠插件自己扩。
3. **审计不对称**：第三方 Host 插件被禁止写 session 记录（`appendPluginRecord`），所以「人工保存的文件」不会出现在 Harness changed-files/review/导出日志里。P1-1 的审查只能基于 Git 工作区 diff + 自建变更快照，UI 上要说明来源。
4. **沙箱边界**：agent 工具受文件策略/审批/沙箱约束；插件 Host 半以进程权限直写。两者并存时，同一文件可能被两条路径改。P1-2/P1-5 要处理「编辑中文件被 agent 改」的冲突提示（现有 5s 轮询已有基础，需升级为 watch）。
5. **无构建 + no-import 约束**：client bundle 是预打包脚本，`ui-primitives`/`ui-dockkit` 第三方不可 import（只能用 `--dsw-*` token 自绘）；CodeMirror/LSP 客户端要自带 vendored ESM。
6. **本体量**：`client.js` 已 ~17k 行且 `immediately: true` 全量加载；新增面板建议按 `require.async` 拆 chunk，否则启动和移动端内存会退化。
7. **日志与隐私**：任务/终端输出可能含密钥（`.env`、部署 token）。P0-2/P2-4 的输出面板需要脱敏规则，且不要自动进聊天。

---

## 6. 验收：怎样算「可以不再开本地 IDE」

用一套真实项目场景验收，而不是逐条功能勾选：

- [ ] 从空目录或 `git clone` 开始一个新项目（不离开浏览器）
- [ ] 安装依赖、起 dev server，**刷新页面后进程还在**
- [ ] 改代码 → HMR 生效 → 手机/另一台设备也能预览
- [ ] 制造一个类型错误，**Problems 里可点击跳转**，并一键交给 agent 修
- [ ] 跑单测 → 失败列表可跳转 → 让 agent 修 → rerun 通过
- [ ] agent 一轮改动 → **在面板内审阅 diff → 回滚其中两个文件**
- [ ] 切分支、解决一次 merge 冲突、hunk 级暂存后提交
- [ ] 跨 20+ 文件批量重命名（先看 diff 再替换）
- [ ] `F12` 跳定义、`Shift+F12` 查引用（P2 后）
- [ ] 让 agent 打开页面、截图、读 console 自证（P2 后）
- [ ] 部署到可分享 URL 并把结果贴回对话（P3 后）

**门槛判定**：前 6 项 = 可放弃本地 IDE 做中小型项目；前 9 项 = 日常主力；全部 = 完整替代。

---

## 7. 不建议现在做

- **完整调试器（DAP/断点/变量）**：成本极高、agent-first 下收益被「可观测日志 + 测试」覆盖，放到最后。
- **浏览器内 WebContainer 运行时**：受 cross-origin isolation/移动端内存限制，Host 已有 Node/Python，无需再赌。
- **自建多人协作 / 权限系统**：应由 Harness 远程访问与审批策略承担。
- **重写文件树为虚拟化大仓方案**：等真实大仓痛点出现再做（先修 5000 文件截断提示 + 持久索引）。
- **PR 自动 reviewer（Bugbot 类）**：先把审查闭环和测试闭环做扎实。

---

## 8. 里程碑建议

| 版本 | 主题 | 范围 | 判定 |
|---|---|---|---|
| **v1.3** | 跑起来、看得到 | P0-1…P0-5 | 终端/任务/错误/测试/状态栏闭环 |
| **v1.4** | 可审查、不丢失 | P1-1…P1-6 | 刷新不丢现场；agent 改动可审可回滚；Git 冲突可解 |
| **v2.0** | 代码智能与验证 | P2-1…P2-4 | LSP 导航 + agent 截图验证 + 反代预览 + 密钥 |
| **v2.x** | 交付与工程化 | P3 | 部署/PR/DB/依赖/并行工作流 |

---

## 9. 参考来源

- 本地调研（不随仓库发布）：`.dsh/tmp/team/capability-audit.md`、`.dsh/tmp/team/harness-integration.md`、`.dsh/tmp/team/workflow-gaps.md`（含 11 条基准链接）。
- Harness 包文档（本机 `0.2.1-rc.2`）：`dsh-client-ui-deliverables`、`dsh-client-ui-jobs`、`dsh-api-terminal-controller`、`dsh-client-ui-sidebar-right`、`dsh-client-ui-sidebar-documentpreview`、`dsh-client-ui-settings`、`dsh-client-shortcuts`、`dsh-client-ui-commands`、`dsh-client-ui-tool`、`dsh-api-workspace-files`、`dsh-client-ui-sidebar-browser`。
- 外部基准：VS Code for the Web / code-server / GitHub Codespaces / Gitpod / StackBlitz WebContainers / Replit Agent / VS Code agents（review-code-edits、browser-tools、integrated-browser）/ Cursor 1.0 changelog（链接见 `workflow-gaps.md` §4）。

---

## 10. 实施进度（2026-10-25）

按「项目经理验收 + 客户交付」口径推进，v1.2.25 时：

| 批次 | 状态 | 已完成 | 剩余 |
|---|---|---|---|
| 0 稳定性 | 进行中（4/5） | 会话恢复（标签/草稿/光标行）、终端刷新恢复（Host roster + 空闲回收）、ErrorBoundary + 断网横幅/恢复刷新、快速打开截断提示 | 事件驱动同步（`fs.watch` 替代 5s 轮询） |
| 1 复测闭环 | 完成 | 任务面板（检测/运行/流式输出/退出码/停止）、输出解析为可点击问题（tsc 两种格式/eslint/通用）、刷新后任务重连 | 失败自动摘要发回 agent 已在验收台提供入口 |
| 2 验收台 | 完成（v1） | 验收清单（四状态 + 备注 + 增删改）、Markdown 报告导出、未通过项发回对话、Git 更改逐文件「已审」标记（随变更自动失效）、逐文件回滚复用 Git discard、交付打包入口 | 行内评论/逐 hunk 审阅（可后续增强） |
| 3 视觉验收与交付 | 完成 | 构建产物 ZIP、验收报告 + 产物交付包、报告导出、证据上传（截图/PDF 存 `.dsh/evidence/` + 缩略图 + 自动附备注）、token 化预览分享链接（HTTP + WS 升级，供手机/局域网/客户访问）、交付记录 `.dsh/deliveries.json` + 面板下载 | 自动截图（需 Host 无头浏览器，按需安装）；公网分享仍需隧道或端口可达 |
