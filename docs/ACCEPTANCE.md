# 验收清单（批次 0–15）

> 面向项目经理的复测步骤。当前代码版本 **v1.2.82**（批次 0–4 写于 v1.2.30、批次 5 写于 v1.2.68、批次 6–9 写于 v1.2.69–v1.2.71、批次 10 写于 v1.2.72、批次 11 写于 v1.2.73、批次 12 写于 v1.2.75、批次 13 写于 v1.2.76、批次 14 写于 v1.2.77；旧批次里的「六阶段/六关」是当时行为，现行**七阶段双复核**见批次 10，三 Agent 能力升级见批次 11，工作台 Agent 指派器见批次 12，工作台三区重构见批次 13，工作台 UI 修正见批次 14，交付区取消折叠见批次 15，工作台 UI 全面重构（指挥舱）见批次 16，完成态与细节修正见批次 17，布局填满/2 列/4 宫格修正见批次 18，项目区始终 2 列见批次 19）。**首次测试前请重启一次 Harness**（Host 路由/模型工具/`.dsh` 文档只在重启后生效；浏览器刷新只更新客户端）。
>
> 预置：任选一个本地工作区；`node_modules` 已安装的项目体验最好。打开侧栏确认能看到 **任务**、**验收**、**流水线** 与 **工作台**。

## 批次 0 · 稳定性

- [ ] **刷新不丢现场**：打开 2–3 个文件、改一处不保存 → 刷新页面 → 标签、未保存内容、光标行都回来。
- [ ] **终端恢复**：开一个终端并运行 `sleep 300` 之类 → 刷新页面 → 终端自动恢复且回放输出（旧 Host 会提示恢复失败，属预期）。
- [ ] **事件驱动同步**：在终端 `touch new-file.txt` 或让 agent 改文件 → 文件树应在 **1 秒内**出现/刷新（Host 不支持 watcher 时退回 5 秒轮询）。
- [ ] **断网恢复正常**：断网 → 出现黄色横幅；恢复网络 → 横幅消失并自动刷新。
- [ ] **快速打开截断提示**：大仓库（>5000 文件）按 `Ctrl/⌘ + P` → 若索引到上限，顶部出现提示而不是静默缺文件。

## 批次 1 · 任务与复测

- [ ] **命令检测**：侧栏 **任务** → 点「重新检测」→ 出现 package.json scripts / Makefile / Cargo 等分组命令。
- [ ] **运行与输出**：点「运行」→ 输出流式出现，结束后显示退出码与绿/红状态点；运行中可「停止」。
- [ ] **问题可点击**：跑一次会报错的 `tsc`/`lint` → 下方「问题」列出条目 → 点击跳到编辑器对应行。
- [ ] **复测便利**：失败任务可「把失败发给 agent」，对话里带上命令、问题清单与输出末尾。
- [ ] **刷新重连**：运行一个 dev server 任务 → 刷新 → 任务仍在运行并能继续看输出。

## 批次 2 · 验收台与审阅

- [ ] **清单 CRUD**：验收视图新增一条 → 切换 待验收/通过/不通过/阻塞 → 选中写备注并保存。
- [ ] **agent 可写**：在对话里让 agent 用 `acceptance_list` / `acceptance_add` 操作 → 面板刷新后能看到（重启 Harness 后可用）。
- [ ] **报告导出**：点「导出验收报告」→ 下载 Markdown，包含统计表与「未通过项」。
- [ ] **驳回回传**：有「不通过」项时点「把未通过项发给 agent」→ 对话收到带备注的修复请求。
- [ ] **已审标记**：Git 更改列表每行有「已审」按钮 → 标记后标题显示 `已审 n/total`；文件再次变化后标记自动失效。
- [ ] **逐文件回滚**：在 Git 更改列表用丢弃/还原按钮回滚单个文件（未跟踪文件会被删除，需确认）。

## 批次 3 · 视觉验收与交付

- [ ] **证据上传**：先选中一条验收项 → 验收视图「添加截图 / 证据」→ 上传图片 → 出现缩略图，并出现在该项证据区；点缩略图在编辑区预览。
- [ ] **预览分享**：任务里跑起 dev server（如 5173）→ 验收视图「预览分享」输入端口 → 创建 → 复制链接或打开；手机/同网设备应能打开。HMR 需 dev server 的 `base` 与链接匹配（见限制）。
- [ ] **关闭分享**：点「关闭」→ 链接失效（端口释放）。
- [ ] **构建产物 zip**：点「下载构建产物」→ 下载 `dist`/`build`/`out` 打包 zip；没有产物目录时应报错提示。
- [ ] **交付包 + 记录**：点「打包交付（zip）」→ 生成 `.dsh/deliveries/…zip`（含 `ACCEPTANCE.md` 与 `evidence/`），面板出现交付记录并可再次下载；`.dsh/deliveries.json` 中有记录。

## 批次 4 · 交付流水线（智能体团队，v1.2.68 六阶段基线）

> 需要重启 Harness 以加载 `pipeline.js` 的 Host 路由与工具；完成后刷新页面，侧栏应出现 **流水线** 标签。
> **历史批次**：本批写于六阶段时期（product → design → development → testing → approval → release）。v1.2.72 起为七阶段双复核，新增第 5 关「验收复核」；当前行为与复测步骤以**批次 10** 为准，下文阶段数按历史理解，流程与闸门仍然有效。

- [ ] **需求下发**：流水线视图填「需求标题 + 需求描述」→ 保存；清空标题时产品经理阶段应无法启动。
- [ ] **顺序校验**：未通过产品经理阶段时，「UI 设计」的启动按钮不可用；用 agent 调 `pipeline_start_stage({stageId:'design'})` 应失败。
- [ ] **角色提示派发**：点产品经理阶段「启动并派发」→ 阶段变「进行中」，对话收到含需求、角色边界（只做什么/不做什么）、交付物和 `pipeline_submit_stage` 要求的提示词。
- [ ] **提交与人工闸门**：让 agent 用 `pipeline_submit_stage` 提交 → 阶段变「待评审」；你在面板「通过」→ 下一阶段解锁；「打回」→ 变「已打回」并可重新派发（模型没有审批工具）。
- [ ] **发布闸门**：approval 阶段未通过前，发布阶段无法启动；通过后才能启动发布。
- [ ] **发布记录**：发布阶段填环境/URL/说明并保存，或让运维 agent 调 `pipeline_record_release` → 面板显示发布记录，`.dsh/pipeline.json` 中 `releases` 有记录。
- [ ] **持久化**：刷新页面后各阶段状态（v1.2.68 为六关；v1.2.72 起为七关）、摘要、产物与发布记录仍在；`.dsh/pipeline.json` 原子写、SSH 工作区提示不支持。
- [ ] **团队编排**：按 [docs/AGENT_TEAM.md](AGENT_TEAM.md) 用 `spawn_teammate` / `team_task_*` 让角色各司其职；插件只负责状态与闸门。

## 批次 5 · Agent-first 功能批（v1.2.68）

> 覆盖 `docs/FEATURE_PROPOSAL.md` 推荐的 10 项：P1/P2/P3/P4/P8/P9/P10/P11/P12/P13。
> 升级后**先重启一次 Harness**（新增 Host 路由、模型工具与 `.dsh` 文档），再刷新页面。以下每条都能在任意本地工作区复测。

- [ ] **agent 任务工具**：对话里让 agent 先调 `task_detect` 再 `task_run`（选一条 test/build 命令）→ 返回退出码/耗时/问题数组/输出尾；`task_list`/`task_output`/`task_stop` 可用；未 detect 的自由命令被拒绝（`bad-command`）。
- [ ] **运行账本**：跑完一条任务后，任务视图出现「运行账本（agent 与面板）」；`.dsh/runs.json` 有记录（≤100 条，`source` 为 `tool`/`panel`），刷新/重启 Harness 后仍在。
- [ ] **环境与预览工具**：起 dev server 后让 agent 调 `env_ports` 能看到端口；`preview_share({port})` 返回 token 链接，手机/同网可打开；`preview_close` 后 404；`http_probe` 对未监听端口 5 秒内返回错误。
- [ ] **状态总线**：让 agent 调 `workspace_status` → 阶段/验收计数/运行中任务与面板一致；在面板通过一个阶段后，下一轮对话无需再调工具也能知道新阶段（systemPrompt 简报）。
- [ ] **流水线工具**：agent 调 `pipeline_update_requirement({mode:'append',detail:'…'})` 后修订记录出现；`pipeline_dispatch({stageId})` 返回可直接用于 `spawn_teammate` 的参数；提交不存在产物时返回 warnings 但不阻断；阶段卡能看到多次通过/打回记录。
- [ ] **证据链**：选中一条验收项 → 上传截图 → 只出现在该项证据区（切换另一项为空）；无证据设为「通过」时弹确认；导出报告/打包后在报告与 zip 的 `evidence/` 中都能看到。
- [ ] **验收历史与模板**：fail → 修 → pass 后，该项显示复测轮次与状态历史；分类分组/筛选/批量通过可用；三个模板可一键追加（重复应用按 title 去重）；报告含证据缺口小节。
- [ ] **复测中心**：验收视图点「复测」→ 勾选命令运行 → 显示最近一次复测结果，`.dsh/verifications/` 有 JSON+日志；失败可一键发回 agent。
- [ ] **交付前体检**：工作台出现体检卡，列出验收/证据/审阅/测试/发布/预览/交付七项；点「把结论写入评审备注」后流水线评审框出现清单。
- [ ] **提醒**：在别的标签页停留，agent 提交阶段后侧栏「流水线」出现角标、页面标题出现 `(N)`；授权后在后台收到系统通知；打开对应面板后角标消失。
- [ ] **变更审阅**：启动一个阶段后改 2 个文件 → 工作台「本轮变更」列出文件与增删行数；标记「已审」后刷新/换浏览器仍保留（`.dsh/review.json`）；文件再次暂存后标记失效；Git 面板「已审」同步。
- [ ] **降级**：非 Git 工作区「本轮变更」显示不可用；SSH 工作区上述本地状态类功能返回不支持或降级，不影响其他面板。

## 批次 6 · 待办一键派发（v1.2.69）

> 纯客户端改动，**不需要重启 Harness**，刷新页面即可。用任意本地工作区、准备 2–3 条待办复测。

- [ ] **无项目 → 立项**：待办里有 1 条未完成任务 → 点该行「交给产品」→ 确认「立项并派发」→ 工作台产品阶段变为进行中，当前对话收到产品经理角色提示；待办出现「已派发」标签和带轮次的备注。
- [ ] **完成后 → 新一轮**：全部阶段完成的项目 → 点另一条待办「交给产品」→ 确认「发起变更并派发」→ 项目进入第 N+1 轮，产品阶段启动并派发提示；上一轮历史仍可在流水线查看。（本批写于六关时期；v1.2.72 起为七关，见批次 10。）
- [ ] **进行中 → 不覆盖**：让一个阶段处于进行中或待审批 → 点待办「交给产品」→ 弹出「当前项目进行中」提示，不改变流水线；点「打开工作台」跳到工作台。
- [ ] **边界**：已完成的待办不显示「交给产品」按钮；SSH 工作区点按钮提示不支持；没有标题的待办不会派发。

## 批次 7 · 验收台全选与反馈（v1.2.70）

> 纯客户端改动，刷新页面即可。用任意包含多条验收项的工作区复测。

- [ ] **点击有反馈**：对已是通过的项再点「通过」→ 出现 toast「已经是『通过』」；把待验收项改为其它状态 → 出现 toast「已标记为『…』」。
- [ ] **全选批量通过**：点筛选行左侧「全选」→ 列表全部勾选、批量条出现「已选 N 项」→ 点「批量通过」→ 全部项变通过并提示「已更新 N 项」；再点一次全选取消勾选。
- [ ] **按筛选全选**：先切到「缺证据」或「未完成」筛选 → 点全选 → 只勾选当前筛选结果，批量操作不影响其他项；没有证据时的批量通过会先弹证据缺口确认。

## 批次 8 · 工作台布局（v1.2.70）

> 纯客户端改动，刷新页面即可。

- [ ] **左右并排且不再被挤扁**：打开工作台 → 「交付前体检」与「本轮变更」左右并排、各占约一半宽度；「查看流水线」「打开 Git」「把结论写入评审备注」等动作保持单行，不再竖排/逐字换行；整个工作台高度比全宽堆叠时更短。
- [ ] **体检卡更清晰**：只有警告/失败的行显示「去处理」，通过/不适用的行没有多余动作；「建议先处理 N 项」与行数一致。
- [ ] **无 Git 工作区**：「本轮变更」只显示不可用说明，不再出现「打开 Git」；有 Git 时显示已审计数与「全部已审」。

## 批次 9 · 产品/设计单独变更（v1.2.71）

> Host 新增 scope 枚举；升级后**重启一次 Harness**，再刷新页面。用已完成全部阶段的项目复测（本批写于六关时期，v1.2.72 起为七关；见批次 10）。

- [ ] **仅产品调整**：工作台 → 需求与调整 → 新轮变更 → 选「仅产品调整」→ 填变更内容发起 → 产品阶段启动、角色提示派发；产品通过后本轮直接完成，设计/开发/测试/验收复核/确认/发布显示「跳过」及原因。
- [ ] **仅设计调整**：选「仅设计调整」→ 跳过需求，直接从设计阶段派发；设计通过后本轮完成，开发/测试/验收复核/确认/发布跳过。
- [ ] **产品与设计**：选「产品与设计」→ 需求 → 设计依次启动；设计通过后完成，开发/测试/验收复核/确认/发布跳过。
- [ ] **原有范围不回退**：「完整七关」（当时称「完整六关」）、「仅开发调整」「仅发布调整」行为与之前一致；变更记录里能看到本轮 scope 标签（release scope 跳过验收复核，见批次 10）。

## 批次 10 · 双复核模式（v1.2.72）

> 本批把交付流水线从六阶段升级为**七阶段双复核**：product → design → development → testing → **acceptance（验收复核，项目经理 Agent）** → **approval（人工确认，项目经理/你）** → release。
> 升级后**先重启一次 Harness**（Host 新增 acceptance 阶段、迁移逻辑与 prompt/工具文案），再**强制刷新/清缓存**（客户端 7 关与中英文文案）。用任意本地工作区复测；建议另备一份旧 6 阶段 `.dsh/pipeline.json` 样本验证迁移。

- [ ] **7 关显示**：打开「流水线」→ 依次显示 (1) 需求分析 → (2) UI 设计 → (3) 开发实现 → (4) 测试验收 → (5) **验收复核**（角色「项目经理 Agent」，标签「AI 复核」）→ (6) **人工确认**（角色「项目经理（你）」，标签「人工确认」）→ (7) 发布上线；工作台「项目流程」也是 7 步、进度显示 `x/7`。
- [ ] **normal 模式通过**：完成 product/design/development/testing 后，第 5 关「启动并派发」→ 用 `pipeline_dispatch({stageId:'acceptance'})` 派给项目经理 Agent → Agent 产出 `docs/pipeline/acceptance-review.md` 并提交评审 → 卡片变「待评审」→ 你在面板「通过」→ 第 6 关才解锁；第 6 关人工确认通过后第 7 关发布才解锁。
- [ ] **normal 模式打回**：让 acceptance 提交一份「建议打回」的复核报告 → 你在第 5 关点「打回」并写原因/建议回退阶段 → 阶段变「已打回」，approval/release 仍锁定；修复后「重新派发」可用。
- [ ] **跳关拒绝**：testing 未通过时启动 acceptance、acceptance 未通过时启动 approval、approval 未通过时启动 release，均应失败（`bad-order`）；模型工具里没有审批工具，acceptance 只能提交评审。
- [ ] **fast 模式五阶段自动**：打开「快速模式」→ 依次提交 product/design/development/testing/**acceptance**，每次返回 `autoApproved=true`，acceptance 的 `nextStageId='approval'`；acceptance 卡备注「快速模式自动通过」为说明灰；**approval 与 release 仍必须人工**（approval 不会自动通过，release 在 approval 通过前不能启动）。
- [ ] **旧文档迁移 · 全 pending**：用一份旧 6 阶段（无 acceptance）全 pending 的 `.dsh/pipeline.json` → 重启/刷新后显示 7 关，acceptance 为「待开始」，其余状态不变。
- [ ] **旧文档迁移 · 进行中**：旧文档 product..testing 已 approved → 刷新后 acceptance 为「待开始」且位于 approval 之前；此时不能启动 approval；启动 acceptance 后才继续新流程。
- [ ] **旧文档迁移 · 旧已完成**：旧文档六关全 approved → 刷新后 acceptance 显示「已通过」且备注含「升级迁移：验收复核为更新新增，旧流程已完成」；项目仍显示完成，可正常发起新一轮变更。
- [ ] **变更轮 scope**：完成七关后发起变更轮 → `full` 与 `development` 仍执行 acceptance；`release`、`product`、`design`、`product-design` 跳过 acceptance 并在备注写明「跳过：…」；release scope 仍要求 approval 已通过。
- [ ] **中英文文案**：切 en/zh → 第 5 关「验收复核 / Acceptance review」「项目经理 Agent / Project manager agent」、第 6 关「人工确认 / Human sign-off」「项目经理（你）/ Project manager (you)」正确；快速模式提示为「中间五阶段（含验收复核）」；界面无「六阶段 / six-stage」残留（历史 CHANGELOG 除外）。
- [ ] **systemPrompt 与工具**：新开一个工作区会话 → 注入的流水线说明为「七阶段 + 双复核」；`pipeline_status` 返回 7 行阶段与计数；`pipeline_stage_prompt({stageId:'acceptance'})` 与 `pipeline_dispatch({stageId:'acceptance'})` 含项目经理 Agent 边界、`docs/opc/05-review.md` 手册与 `docs/pipeline/acceptance-review.md` 交付物；运维手册为 `docs/opc/06-ops.md`（原 05-ops 已改名）。
- [ ] **自动化全绿**：`npm run check`（全部模块语法）、`npm test`（host smoke）、`node .dsh/tmp/team/pipeline-selftest.mjs`（7 阶段/跳关/迁移/scope/fast/prompt）均 exit 0；`node --check dsh-web-filebrowser-plugin/client.js` 通过；`grep -n "六阶段\|六关\|six stages\|six-stage" dsh-web-filebrowser-plugin/client.js dsh-web-filebrowser-plugin/pipeline.js` 除历史注释外应为 0。
- [ ] **回归检查**：批次 0–9 抽查不回退——任务运行/预览分享/验收证据/交付包/变更审阅/待办派发照旧可用；流水线发布记录与历史轮次仍可查看。

## 批次 11 · 三 Agent 能力升级（v1.2.73）

> 本轮把「先调研、再借鉴、后实现」写进产品 / 设计 / 开发三个角色，并让 acceptance 复核关检查这些专业质量证据；**不改流水线结构、不新增运行时依赖、不改业务功能代码**。
> 升级后**先重启一次 Harness**（`pipeline.js` 的 STAGE_GUIDES 与 PIPELINE_SECTION 属 Host 改动），再刷新页面。纯提示词/手册/文档改动**无需重建客户端 bundle**；若未重启 Host，`pipeline_stage_prompt` 仍是旧提示词。
> 复测前提：v1.2.73 已部署，任意本地工作区可调 `pipeline_stage_prompt({stageId})`。

- [ ] **提示词可检索 · 四阶段**：重启 Harness 后让 agent 调 `pipeline_stage_prompt({stageId:'product'})`，提示词中可检索到 `调研` / `借鉴` / `web_search` / `web_fetch` / `来源` / `借鉴决策表` / `已验证模式` / `创新假设` / `反抄袭` / `blocked`，并要求 ≥3 个来源（URL + 访问日期 + 关键结论）。
- [ ] **提示词可检索 · design**：`pipeline_stage_prompt({stageId:'design'})` 含 `4/8px` / `字号阶梯` / `行高` / `对比度` / `4.5:1` / `3:1` / `44×44` / `状态矩阵` / `360` / `768` / `1280` / `150–300ms` / `prefers-reduced-motion` / `ARIA` / `自检评分` / `迭代`（至少一轮「渲染→检查→修正」）。
- [ ] **提示词可检索 · development**：`pipeline_stage_prompt({stageId:'development'})` 含 `GitHub` / `活跃` / `许可证` / `SPDX` / `MIT` / `Apache` / `GPL` / `AGPL` / `无许可证` / `engineering-research.md` / `npm audit` / `OSV` / `CVE` / `安全` / `性能`，要求 ≥2 个活跃候选。
- [ ] **提示词可检索 · acceptance**：`pipeline_stage_prompt({stageId:'acceptance'})` 含三项新增复核「复核调研与借鉴」「复核设计质量」「复核工程调研与许可证」，以及 `N/A` 理由与「建议打回」。
- [ ] **systemPrompt 可检索**：新开一个工作区会话 → 注入的流水线说明含「**调研与借鉴纪律**」段：product 用 web_search/web_fetch ≥3 来源 + 借鉴决策表；design 按 4/8px、对比度 4.5:1/3:1、44×44、八态、360/768/1280、150–300ms、ARIA 交付并自检评分 ≥4 + 至少一轮迭代；development 先检索 GitHub ≥2 活跃候选 + 许可证矩阵 + `docs/pipeline/engineering-research.md`；acceptance 复核上述证据、缺失即建议打回。
- [ ] **三本手册新章节**：`docs/opc/01-product.md` §5「调研与借鉴」（来源门槛 ≥3、借鉴决策表、已验证/创新假设、反抄袭、无网络 blocked）；`docs/opc/02-design.md` §5「专业设计质量标准」（9 项 MUST、八态矩阵、五维 rubric、渲染→检查→修正、自检评分）；`docs/opc/03-engineering.md` §5「不熟悉功能：先调研再借鉴」（候选对比、SPDX/许可证矩阵、GPL/AGPL/无许可证禁止复制、engineering-research.md 模板、npm audit/OSV/CVE、性能预算）。
- [ ] **grep 验收（自动）**：
  ```bash
  grep -nE "调研|借鉴|web_search|许可证|安全|对比度|状态矩阵|engineering-research" dsh-web-filebrowser-plugin/pipeline.js
  grep -nE "调研与借鉴|借鉴决策表|已验证模式|创新假设|反抄袭|web_search|blocked" docs/opc/01-product.md
  grep -nE "4/8px|对比度|4\.5:1|44×44|状态矩阵|360|768|1280|150–300ms|prefers-reduced-motion|ARIA|自检评分|rubric|渲染→检查→修正" docs/opc/02-design.md
  grep -nE "engineering-research\.md|SPDX|MIT|Apache|GPL|AGPL|npm audit|OSV|CVE|性能预算|活跃度" docs/opc/03-engineering.md
  ```
  期望全部命中；`npm run check`、`npm test`、`node .dsh/tmp/team/pipeline-selftest.mjs` 均 exit 0。
- [ ] **AGENT_TEAM / PLAYBOOK / README 同步**：`docs/AGENT_TEAM.md` 角色表三行含调研/质量/许可证职责与产物，且有「研究与借鉴纪律」段；`docs/PLAYBOOK.md` product/design/development/acceptance 段含调研/质量/许可证/安全步骤；`README.md`、`README.zh.md`、`dsh-web-filebrowser-plugin/README.md` 有 v1.2.73 能力说明。
- [ ] **验收记录与版本一致**：本文件含「批次 11」；`CHANGELOG.md` 含 `## 1.2.73 — 2026-10-27`；根 `package.json` 与 `dsh-web-filebrowser-plugin/package.json` 均 `1.2.73`。
- [ ] **无新增运行时依赖**：`git diff package.json dsh-web-filebrowser-plugin/package.json` 仅版本号变化，`dependencies` 未新增（仍仅 `ssh2`）。
- [ ] **GUI 派发提示词显示**：流水线面板对 product/design/development 点「启动并派发」→ 对话收到的角色提示词包含上述关键词；纯提示词改动无需重建 bundle（Host 重启后生效）。
- [ ] **双复核回归**：七阶段结构与 fast/normal 语义不变——fast 下五中间阶段仍自动通过、acceptance 可派发、approval/release 仍人工；acceptance 复核报告新增三项专业质量复核（调研证据 / 设计质量评分与迭代 / 工程调研与许可证，或 N/A 理由）。
- [ ] **验收复核报告**：acceptance 阶段产出 `docs/pipeline/acceptance-review.md`，结论含「建议放行」，且含 ⑦ 专业质量复核（需求调研来源/借鉴决策、设计自检评分与迭代、engineering-research.md 与许可证记录，N/A 需理由）。

## 批次 12 · 工作台 Agent 指派器（v1.2.75）

> 本轮在**工作台**新增「团队与指派」卡片 + 指派抽屉 + 状态卡，用 4 个 Owner-only Host op 持久化到 `.dsh/agent-assignments.json`；**不新增模型工具、不改流水线结构**，指派动作**不写** `.dsh/pipeline.json`。
> 升级后**先重启一次 Harness**（Host 新增 assignments.js 与 index.js 4 个 op），再刷新页面 / 重建客户端 bundle（client.js 纯新增 1683 行）。SSH 远程工作区不支持指派（降级提示）。
> 复测前提：v1.2.75 已部署，工作台可打开；建议准备一个已保存需求的本地工作区（便于验证阶段关联），并准备一条临时任务。

- [ ] **卡片出现与位置**：打开工作台 → 卡片顺序为「需要你处理 → 项目状态 → **团队与指派** → 项目流程」；卡片含 6 个角色 chips（产品经理 / UI 设计师 / 全栈开发 / 测试工程师 / 项目经理 Agent / 运维），每个显示名称或成员 id + 状态文字（空闲 / 执行中 / 待你确认），并有「成员实时状态以 Harness 团队面板为准」提示；含「指派任务」按钮与「打开团队面板 ↗」入口（无深链时降级为可复制说明，不报错不死链）。
- [ ] **最近指派与空态**：无记录时显示空态文案；有记录时默认展示最近 5 条、可展开；每条含状态 pill（文字）、标题、成员、类型（关联阶段 / 临时任务）、时间与操作；卡片底部有「派发后由 Lead 用原生 team 工具执行」提示与记录保存路径提示。
- [ ] **抽屉字段与校验**：点「指派任务」→ 右侧抽屉（≤768px 为全宽底部面板）。逐项核对：① 交给谁（按角色 6 选 1 / 当前成员自由填写 / 新建 Agent 名称+角色；三选一互斥）；② 任务标题必填 ≤120 带计数器；③ 详细说明必填 ≤4000 带计数器；④ 验收标准 1–10 条、每条 ≤500，默认预填 1 条「产物落盘 + 自测通过」；⑤ 优先级 P0/P1/P2 默认 P1；⑥ 期望产物路径可空；⑦ 附件入口存在（上传或提示拖入对话，不阻塞提交）；⑧ 空提交/超长输入被就地拦截、错误显示在字段下且已填内容不丢；⑨ Esc 关闭不误提交，焦点归还「指派任务」。
- [ ] **提交与结构化指派单**：填必填项 → 点「指派给 Agent」→ ① `.dsh/agent-assignments.json` 新增记录，字段含 id/round/title/detail/acceptance[]/assignedTo/stageId/priority/expectedArtifacts/status=dispatched/createdAt/updatedAt/history（首条 dispatched），round 与 `.dsh/pipeline.json` 当前轮一致；② 当前对话收到结构化指派单（【工作台指派 · 第 N 轮】/交给/任务/背景·期望/验收标准/关联阶段或临时任务/期望产物/优先级/执行要求：角色边界 + pipeline 闸门 + 不越 approval/release + 完成后更新状态）；③ toast「已派发」且卡片/列表立即出现新记录；④ 提交中按钮禁用，连续点击只产生 1 条记录。
- [ ] **关联阶段控件**：默认「自动判断」并展示推导建议或说明；可选择需求分析/UI 设计/开发实现/测试验收/验收复核 5 个阶段（product/design/development/testing/acceptance）+「不关联（临时任务）」；「人工确认（approval）」「发布上线（release）」**置灰不可选**并提示「只能 Owner 在流水线面板审批」；关联阶段显示「将走七阶段双复核闸门」，不关联显示「不改变流水线，结果只在对话汇报」；提交后记录 stageId 与选择一致，临时任务为空。
- [ ] **状态机与操作**：① 合法链路 dispatched→running→review→done 每步成功并刷新 updatedAt；② 打回（任意非终态→failed）**必须填原因**，空 note 被拒；failed 后可「再指派」（预填新弹层→新建记录，原记录保留）；③ 取消（任意非终态→cancelled）可用；④ 催办在 dispatched/running 可用，向当前对话发提醒并 append history（状态不变）；⑤ 每次状态变更 append history（at/status/note/actor=owner，≤50 条）；⑥ 非法流转（dispatched→done、done→running、review→dispatched 等）被拒且文件不变；⑦ 终态 done/failed/cancelled 不再进入 running/review。
- [ ] **持久化与恢复**：刷新页面、重启 Harness 后 `assignmentList` 记录仍在（`.dsh/agent-assignments.json`）；并发/重复点击不产生重复或半写记录；坏文件时页面显示错误且不静默清空（修复 JSON 后恢复可读）。
- [ ] **流水线只读（关键）**：`sha256sum .dsh/pipeline.json` 记录指派前哈希 → 完成一次关联阶段指派（提交、running/review/done、再打回/取消）后再次计算，**哈希必须一致**；临时任务全流程后七阶段状态/摘要不变；`assignmentSave` 传 stageId=approval/release 必须失败（`bad-request`），客户端对应选项置灰；acceptance/approval 双复核闸门逻辑无回归。
- [ ] **i18n / 无障碍 / 窄屏**：切中文与 English → 卡片/抽屉/状态卡所有文案都有翻译（key 前缀 `workbench.assign.*`），无残留中文硬编码或空 key；Tab 顺序进入抽屉→字段→取消→提交，焦点环可见；Esc 关闭归还焦点，`role="dialog" aria-modal="true"` + `aria-labelledby`；状态「颜色+文字+形状」三重表达，toast/错误 `aria-live`；主按钮/输入触控命中 ≥44px、`prefers-reduced-motion` 降级；≤768px 抽屉为全宽底部面板、无横向溢出。
- [ ] **效果图落地**（对照 `docs/proposals/mockups/` 三屏与 README §2–§4）：卡片 chips 3 列×2 行或等价换行 + 最近指派列；抽屉右侧 608px、字段顺序与分组正确、底部提示与主按钮；状态卡筛选（全部/进行中/待你确认/已完成）、五段进度（已派发→等待 Lead→执行中→待你确认→已完成）、状态 pill、操作矩阵；允许的 MVP 缩减（成员实时状态按记录推导、附件仅提示、发布 chip 置灰）已在文档说明。
- [ ] **边界（Host 层）**：100 条记录后保存返回 `full`；文件 >1MB 返回 `too-large`；JSON 损坏返回 `corrupt`（含路径、不清空）；SSH 工作区 4 个 op 均 `ssh-unsupported`；`git diff package.json dsh-web-filebrowser-plugin/package.json` 无新增 dependencies。
- [ ] **自动化全绿**：`npm run check`、`npm run check:json`、`npm test`（含 assignments 用例）、`node .dsh/tmp/team/pipeline-selftest.mjs`、`node .dsh/tmp/team/review-selftest.mjs`、`node .dsh/tmp/team/assignments-selftest.mjs` 均 exit 0；`node --check dsh-web-filebrowser-plugin/client.js` 通过；版本/CHANGELOG 1.2.75 一致。
- [ ] **回归检查**：流水线七阶段 / acceptance 双复核 / 验收台 / 交付包 / 待办 / 记忆 / 编辑器标签右键菜单（Owner 标签菜单）均未回退；工作台其它卡片（项目状态/项目流程/交付前体检/本轮变更）正常。

## 批次 13 · 工作台 UI 重构（v1.2.76）

> 本轮**只改客户端**（`client.js` 渲染 + CSS + i18n），把工作台重组为「**现在 / 项目 / 交付**」三区 + hero 当前阶段卡 + 5 张可折叠交付卡 + 需求摘要化；**无 Host/数据/依赖改动**。
> 复测前：重启 Harness（可选，确保 Host 为最新）→ **重建客户端 bundle**（client.js 有改动）→ 强制刷新页面。准备一个有需求/流水线数据的工作区（用于 hero、需求摘要与折叠状态），另准备无项目/无待办工作区（空态）。
> 对照设计稿：`docs/proposals/workbench-redesign/mockups/option-a.png`（before/after 对比）与 `docs/pipeline/design.md`；允许 design.md 记录在案的微调（配色近似值、3–4px 色条、字号 ±1px）。

- [ ] **三区分层**：1440×1024 打开工作台，从上到下依次为「**现在** → **项目** → **交付**」；每区有左侧 3–4px 类目色条 + 图标 + 13px 半粗标题 + 右侧计数/操作链接。现在区置顶并含 hero；项目区含「项目状态/进度、团队与指派、需求与调整」三卡（两列，需求摘要全宽）；交付区含全宽项目流程（7 步）+ 设计稿/验收/交付前体检/本轮变更/运行中 5 张紧凑折叠行。三区顺序与归属不可乱。
- [ ] **空态与降级**：无待办时现在区不占位或仅轻提示（不空白堆卡）；无项目时显示开工空态而非假 hero；不靠颜色表意（分区名文字与图标同时存在）。截图或 DOM 核对并保存证据。
- [ ] **hero 当前阶段卡（三态）**：① approval 待确认（如 acceptance 已通过）→ 显示当前阶段名 + 状态 pill + 一句摘要 + 7 点进度/「x/7 关已完成」+ 主操作「通过」「打回」+ 辅助链接（查看复核报告/流水线）；② 阶段 pending/failed → 主操作「启动并派发」/「指派任务」，不显示不适用按钮；③ 全部完成 → 显示完成态；1440×1024 首屏无需滚动即可看到 hero 与主操作（主操作 y < 1024）；摘要超长截断不撑破；主操作可键盘聚焦并点击有效。
- [ ] **需求与调整摘要化（本轮修复点）**：「需求与调整」卡只显示需求标题、轮次/范围 chips（如「第 3 轮 · 范围 full」）、**≤2 行摘要**（line-clamp/truncate）、「查看完整需求 / 追加说明 / 修改需求 / 新轮变更」四个操作；页面 DOM/`document.body.innerText` **不得出现需求 detail 长文整段**（不含连续 60 字以上片段，标题除外）；摘要为纯文本（无 `##`/代码块/链接 markdown 残留）；点「查看完整需求」可看到完整需求；无需求时显示「暂无需求/去录入」空态。
- [ ] **5 卡折叠默认收起**：设计稿/验收/交付前体检/本轮变更/运行中默认均为收起态；折叠头含图标 + 名称 + 计数/状态摘要（如「4 张」「42/42」「通过」「3 文件」「1 个」）+ chevron；点击折叠头任意处或键盘 Enter/Space 可展开，展开后原卡内容与操作完整（打开设计稿/打开验收/导出报告/去处理/打开 Git/打开任务等）；再次点击收起。
- [ ] **展开全部 / 收起全部**：交付区头部一键切换 5 行；数据为 0 时显示「无/0」不报错、不隐藏入口；折叠头触控命中 ≥44px；折叠/展开不刷新页面、不丢滚动位置（或仅轻微回顶），变化即时可见。
- [ ] **失败自动展开与红点**：将某验收项置 fail（fail>0）→ 验收折叠行默认自动展开并显示红点/错误色 + 失败计数/文字；交付前体检存在 fail/阻断（如变更未审、发布记录缺失）→ 体检行同样自动展开 + 红点；Owner 可手动收起，收起后红点/失败计数仍保留；fail 清零/问题修复后恢复默认收起且红点消失；红点同时有文字/计数，不只靠颜色。
- [ ] **视觉规范**：内容区背景浅灰蓝（近 #F6F8FB token）；白卡 + 1px 边框 + 轻阴影 `0 1px 2px` + 圆角 12 + 内边距 16/20；分区头色条 3–4px + 图标 + 13px 半粗标题；卡片标题 **12px 半粗、正常大小写**（不得残留 9.5–10.5px 全大写）；主要数字 15–16px、正文 12–13px、次要 11px；间距 4/8 体系（分区 16、卡间 12）；对比度：正文/次要/链接/状态文字 ≥4.5:1、非文本（色条/边框/圆点）≥3:1；hover/focus 可见；状态 pill 柔和底色 + 文字。
- [ ] **与 option-a 基准一致**：逐区对照 `docs/proposals/workbench-redesign/mockups/option-a.png`：分区头、hero、项目区三卡、交付区 7 步 + 5 折叠行、底部「默认收起/展开全部」提示；与 before.png 对比 5 个痛点（同质卡/字号小/无分组/主次同权/滚动长）均已改善；design.md 记录本轮设计（三区 IA、关键状态、tokens/字号/间距/对比度、折叠状态矩阵、响应式、无障碍、五维自评与迭代记录）；设计自评每维 ≥4、must 0 失败；微调项已列明理由。
- [ ] **i18n 中英文完整**：切 English/中文 → 三区标题/副说明、hero 标签与按钮、折叠卡名称/计数/展开全部/收起全部、需求摘要与四个操作、空态/失败提示均有正确翻译，无 key 名/undefined/残留中文硬编码（专有名词除外）；新增约 18–24 个 `workbench.*` 键在 `locale/zh.json` 与 `locale/en.json` 同批存在且集合一致；既有 `workbench.assign.*`（≈122）无删除/重命名，指派器卡片/抽屉/状态卡不回归。
- [ ] **无障碍**：折叠头为 button 语义且带 `aria-expanded`/`aria-controls`，展开/收起同步；分区为 section + `aria-labelledby`；hero 主操作为真实按钮；Tab 顺序与视觉一致、所有可操作元素可键盘到达、焦点环可见；折叠头/图标按钮/主操作触控命中 ≥44px；`prefers-reduced-motion: reduce` 下折叠/hero 动效降级为直接切换；状态与失败提示同时有颜色+文字；展开后焦点不丢、不跳页首。
- [ ] **响应式**：视口 ≤700px 时三区/项目区单列、交付折叠行单列、hero 按钮换行、无横向溢出（`document.documentElement.scrollWidth <= clientWidth + 1`）；360×800 / 768×1024 / 1280×800 三档复测：无横向溢出、长标题/计数/chips 换行或截断不撑破、hero 主操作一次点击可达；桌面 1440 项目区两列、内容 max-width 1080；浏览器 200% zoom 下关键按钮可操作不重叠。
- [ ] **回归安全**：手工回归流水线七阶段与双复核、团队与指派（卡片/抽屉/状态卡/催办/打回/再指派）、验收台（列表/证据/导出报告）、交付包、变更审阅（打开 Git/已审标记）、运行中（打开任务）、编辑器标签右键菜单（关闭/关闭其他/关闭右侧/全部关闭/固定）均正常；`git diff --stat` 只含 client.js + 文档（无 Host 模块/数据改动）；两个 package.json dependencies 无新增；`.dsh/pipeline.json` 与 `.dsh/acceptance.json` 未被 UI 操作改写。
- [ ] **自动化全绿**：`npm run check`、`npm run check:json`、`npm test`（31/31）、`node .dsh/tmp/team/pipeline-selftest.mjs`（38/38）、`node .dsh/tmp/team/review-selftest.mjs`（22/22）、`node .dsh/tmp/team/assignments-selftest.mjs`（27/27）、`node .dsh/tmp/qa-static-v1276.mjs` 均 exit 0。
- [ ] **文档与版本**：本文件含「批次 13」；`CHANGELOG.md` 顶部含 `## 1.2.76 — 2026-10-27`（英文，描述三区重构/hero/折叠/需求摘要/视觉/i18n/响应式/测试）；插件与根 `package.json` 均 **1.2.76**（交付后根 +1 至 1.2.77，需在 release 记录说明）；文档相对链接可解析、无死链。

## 批次 14 · 工作台 UI 修正（v1.2.77）

> 本轮为**纯客户端修正**（`client.js` +68/−20）：① 长 tooltip 溢出（摘要/修订行的原生 `title` 改为 ≤80 字摘要；摘要 `white-space`/`word-break`/`overflow-wrap` + 2 行 clamp；容器 `min-width:0`）；② 项目区宽屏 3 列对齐效果图（≥1024px 状态/团队/需求同一行，≤1023 两列、≤700 单列；需求卡宽屏不再强制跨全宽）；③ 需求修订默认折叠「修订记录 (N)」+ 视觉细化（底色更明显、卡片边框/阴影/标题层级）。
> 复测前：重启 Harness → **重建客户端 bundle**（client.js 有改动）→ 强制刷新。对照 `docs/proposals/workbench-redesign/mockups/option-a.png`；同时回归批次 13 的 8 项 GUI（三区/hero/折叠/自动展开/视觉/option-a/无障碍/响应式）。

- [ ] **长 tooltip 已修**：悬停「需求与调整」摘要 → 原生 tooltip 只显示 **≤80 字**摘要文本（不再是整段 detail）；悬停需求修订行 → tooltip ≤80 字（标题/摘要），不再出现超长单行提示；`document.body.innerText`/DOM 不出现整段 detail 全文区块（B1-A 口径仍成立）。
- [ ] **摘要换行不溢出**：摘要长文本在 **2 行内**正常换行（`white-space: normal` + `word-break` + `overflow-wrap` 生效），长英文/URL/连续字符不撑破卡片；容器 `min-width:0`，无文字越过卡片边界。
- [ ] **多宽度无横向溢出**：在 **360 / 768 / 1080 / 1440** 宽度下工作台均无横向滚动（`document.documentElement.scrollWidth <= clientWidth + 1`），hero/三区/折叠行/需求卡内容不越界；1080 为内容 max-width 上限。
- [ ] **项目区 ≥1024 三列**：宽屏（1440/1080）项目区为 **3 列**（项目状态 / 团队与指派 / 需求与调整 **同一行**、各 1fr），与 option-a 一致；需求卡不再单独占满一行。
- [ ] **窄屏降级**：1024–701px 为 **2 列**（需求卡跨全宽）；≤700px **单列**；需求卡操作按钮可换行、不溢出；团队 chips 2 列、列表限高滚动；360/768 无文字裁剪或横向溢出。
- [ ] **修订记录默认折叠**：「需求修订」默认显示为可点击的「**修订记录 (N)**」摘要行 + chevron；点击或键盘 Enter/Space 展开，`aria-expanded` 与 `aria-controls` 同步；展开后逐条可读、最多 4 条、不超出卡片；再次点击收起；刷新页面恢复默认折叠。
- [ ] **视觉更清爽**：页面浅灰蓝底更明显（55% layer-2 mix）；卡片白底 + 1px 边框（近 #E3E8EF）+ `0 1px 3px` 轻阴影 + 12 圆角；卡标题 12–13px 层级清晰；三区色条/hero/折叠行与 option-a 视觉一致；对比度 ≥4.5:1（非文本 ≥3:1）；Owner 目视清爽、无脏边/重影。
- [ ] **回归（含批次 13 的 8 项 GUI）**：三区分层、hero 三态与主操作、5 卡折叠/展开全部、失败自动展开+红点、视觉规范、option-a 落地、无障碍（aria/焦点/44px/reduced-motion）、响应式 ≤700 单列——按批次 13 步骤一并复测；流水线七阶段与双复核、工作台指派器各卡片、验收台、交付包、变更审阅、运行中、编辑器标签右键菜单无回归。
- [ ] **自动化全绿**：`npm run check`、`npm run check:json`、`npm test`（31/31）、`node .dsh/tmp/team/pipeline-selftest.mjs`（38/38）、`review-selftest`（22/22）、`assignments-selftest`（27/27）、`node .dsh/tmp/qa-static-v1277.mjs`（STATIC PASS）均 exit 0。
- [ ] **范围与版本**：`git diff` 仅 `client.js`（+68/−20）+ 文档（无 Host 模块/依赖/数据改动）；插件与根 `package.json` 均 **1.2.77**，CHANGELOG 顶部含 `## 1.2.77 — 2026-10-27`；本文件含「批次 14」；文档相对链接可解析。

## 批次 15 · 交付区取消折叠（v1.2.78）

> 本轮为**纯客户端修正**（`client.js` +10/−182）：按 Owner「不要折叠」的要求，**彻底取消交付区折叠**——移除 fold state/handlers/JSX/aria、「展开全部/收起全部」按钮、8 个 `workbench.fold.*` i18n 键与全部 fold CSS；交付区改为 `.ds-wb-delivery-grid` **直接渲染 5 张原卡片**（设计稿/验收/交付前体检/本轮变更/运行中），**≥1024px 两列、≤1023px 单列**；三区/hero/需求摘要/项目区三列保留。
> 复测前：重启 Harness → **重建客户端 bundle**（client.js 有改动）→ 强制刷新。对照 `docs/proposals/workbench-redesign/mockups/option-a.png`；同时回归批次 13/14 的保留项。
> 说明：v1.2.76 的折叠相关验收项（`b1c04ed3fb` 折叠、`576044e996` 自动展开）随「取消折叠」作废，不再复测；本批 3 条新项覆盖新交互。

- [ ] **无折叠交互**：交付区**不存在**「展开全部 / 收起全部」按钮、折叠行、chevron、`aria-expanded` 折叠逻辑；页面无「展开/收起」文案；原 `.ds-wb-fold*` 样式已移除（静态 `qa-static-v1278` 断言）。
- [ ] **5 卡直接可见**：设计稿 / 验收 / 交付前体检 / 本轮变更 / 运行中 **5 张卡片完整内容直接展示**（不再是折叠头）；卡内原内容与操作齐全：打开设计稿、打开验收/导出报告、去处理、打开 Git/已审标记、打开任务等均可用；失败/告警仍以卡内文字+颜色呈现。
- [ ] **布局两列/单列**：≥1024px 交付区为 **两列**、≤1023px **单列**；卡片间距 12–16px、无横向溢出；卡片标题**完整显示不截断**（如「交付前体检」不得显示为「交付…」）；长标题/计数换行或正常延展不撑破卡片。
- [ ] **顺序与位置**：交付区仍位于「现在 / 项目」之后；区头保留（色条+图标+标题+hint，无展开全部动作）；项目流程（7 步）在 5 卡之前；5 卡顺序为 设计稿 → 验收 → 交付前体检 → 本轮变更 → 运行中。
- [ ] **页面高度预期**：取消折叠后工作台页面比 v1.2.77 更长（5 卡全部展开），属预期；Owner 确认滚动/首屏仍可接受，无异常空白。
- [ ] **视觉一致**：卡片白底 + 1px 边框 + 轻阴影 + 12 圆角与批次 14 一致；标题 12–13px 层级清晰；对比度 ≥4.5:1；与 option-a 的两列/单列布局一致（折叠相关设计已按 Owner 要求废弃）。
- [ ] **保留项无回归**：三区分层与空态、hero 三态与主操作、需求摘要（≤2 行、tooltip ≤80 字、不直出全文）、项目区 ≥1024 三列 / ≤1023 两列 / ≤700 单列、修订记录默认折叠、指派器卡片/抽屉/状态卡、验收台、交付包、流水线七阶段与双复核、编辑器标签右键菜单均正常。
- [ ] **自动化全绿**：`npm run check`、`npm run check:json`、`npm test`（31/31）、`node .dsh/tmp/team/pipeline-selftest.mjs`（38/38）、`review-selftest`（22/22）、`assignments-selftest`（27/27）、`node .dsh/tmp/qa-static-v1278.mjs`（STATIC PASS）均 exit 0。
- [ ] **范围与版本**：`git diff` 仅 `client.js`（+10/−182）+ 文档/版本（无 Host 模块/依赖/数据改动）；插件与根 `package.json` 均 **1.2.78**，CHANGELOG 顶部含 `## 1.2.78 — 2026-10-27`；本文件含「批次 15」；文档相对链接可解析。


## 批次 16 · 工作台 UI 全面重构：指挥舱（v1.2.79）

> 本轮为**纯客户端重构**（`client.js` +839/−74，CSS ≈33KB + JSX/i18n ≈12KB）：页面头重做（eyebrow + 30px display + 上下文 chips + 动作组）、深色渐变 hero（阶段/状态/7 段 rail/环形进度/44px 主次 CTA/review note/门禁）、Now 告警卡、项目区三卡（大数字进度）、交付区 7 步连接线时间轴 + 5 卡 bento（第 5 卡全宽）、统一设计 tokens、外壳 CSS 轻量统一。**不改 Host/依赖/数据，保留全部原功能。**
> 复测前：重启 Harness → **重建客户端 bundle**（client.js 有改动）→ 强制刷新（建议无缓存）。对照效果图：`docs/pipeline/design/workbench-v1279-overview-light-1440.png`、`workbench-v1279-overview-dark-1440.png`、`workbench-v1279-full-light-1440.png`、`workbench-v1279-mobile-light-390.png`。同时回归批次 13–15 的保留项（三区/hero 三态/需求摘要/项目区/指派器/验收/交付/流水线/变更审阅/运行中）。

- [ ] **首屏 hero**：1440×900 打开工作台，**不滚动**即可看到页面头（工作台 30px + 轮次/快速模式/进度 chips + 动作组）与深色 hero（阶段名、状态 pill、摘要、负责角色、7 段 rail、环形 4/7、通过/打回或启动并派发）；hero 不折叠；Now 区告警/空态紧随其后。
- [ ] **hero 功能不回归**：review 阶段点「通过」→ 进入下一阶段；点「打回」→ 阶段 failed 并可重启；task 阶段点「启动并派发」→ 阶段 active 并收到角色提示；review note 输入后提交能带上备注；「查看复核报告 / 查看流水线」可打开；打回/通过按钮在 busy 时禁用。
- [ ] **Now / 项目区**：失败项存在时显示左图标告警卡（计数/发给团队/查看验收可用）；项目状态卡显示大数字 4/7 + 进度条 + 状态 pill + 启动按钮；团队 chips 三态与指派任务/团队面板入口可用；需求卡标题/chips/2 行摘要/查看+追加+修改+新轮四操作与修订记录 disclosure 正常。
- [ ] **交付区**：项目流程 7 步时间轴（当前步高亮、已通过 ✓、角色/状态正确、点击打开流水线）；5 卡顺序 设计稿/验收/体检/变更/运行中，≥1024 两列、≤1023 单列，第 5 卡全宽；卡标题完整不截断；各卡按钮（打开设计稿/导出报告/打包交付/发给团队/已审/打开 Git/重跑/打开任务）可用。
- [ ] **浅色视觉**：页面底与卡片分层清楚；hero 深色渐变有光晕但不刺眼；卡边 1–2px 内敛、阴影柔和、圆角 14/18；字号层级（30/16/14/13/11）可辨；品牌色只用于链接/焦点/小面积；状态色只用于点/条/pill；整体观感与效果图一致，第一眼「有主次、现代化」。
- [ ] **深色视觉**：切换深色主题 → hero 仍为深色面板、白字/链接/门禁说明对比清楚；卡片与页面底仍有明度差（surface + 1px 边）；状态 pill/进度条可辨；无「黑上黑」或文字看不清。
- [ ] **响应式**：360×800 / 768×1024 / 1024×768 / 1280×800 / 1440×900 均无横向溢出（`document.documentElement.scrollWidth <= clientWidth + 1`）；项目区 1280 三列 / 768–1279 两列（需求全宽）/ ≤700 单列；交付区 ≥1024 两列、≤1023 单列；hero ≤1023 单列、≤700 页面头非 sticky、按钮 ≥44px；长标题/chips 换行或省略不撑破。
- [ ] **无障碍与交互**：Tab 顺序与视觉一致、所有按钮/链接可键盘到达、focus 环可见；hero 主/次 CTA ≥44px；rail 每步有文字状态（不只颜色）；三 section 有 aria-labelledby；`prefers-reduced-motion: reduce` 下无过渡动画；hover 有反馈；启用「提醒」后按钮状态正确。
- [ ] **外壳轻量统一**：顶栏 48px 更克制；侧栏非活动项降权、pane 头/活动标签视觉与工作台一致；文件/搜索/Git/更多/流水线/验收/待办/任务/记忆等入口与快捷键、编辑器/终端/预览等视图**无回归**。
- [ ] **自动化全绿**：`npm run check`、`npm run check:json`、`npm test`（31/31）、`node .dsh/tmp/team/pipeline-selftest.mjs`（38/38）、`review-selftest`（22/22）、`assignments-selftest`（27/27）、`node .dsh/tmp/qa-static-v1279.mjs`（STATIC PASS，80+ 断言）均 exit 0。
- [ ] **范围与版本**：`git diff` 仅 `client.js` + `CHANGELOG.md` + 插件 `package.json` + docs（无 Host 模块/依赖/数据改动；无第三方代码/资源）；插件与根 `package.json` 均 **1.2.79**，CHANGELOG 顶部含 `## 1.2.79 — 2026-10-27`；本文件含「批次 16」；交付后根版本 +1 至 1.2.80（chore commit）。


## 批次 17 · 工作台完成态与细节修正（v1.2.80）

> 本轮为**纯客户端修正**（client.js +175/−56）：修复 Owner 对 v1.2.79 实机截图反馈的 10 个问题——团队卡 chips 被压成 3 列窄块、完成态 hero 过期文案/重复状态、需求摘要「背景」前缀与重复变更行、blocked 被计成「待验收」、空「交付物」小节、完成态体检「建议先处理」误报、提交后变更卡「已审 0/0」、运行中统计顺序、纯黑进度条、Now 区 0 项提示。
> 复测前：重启 Harness → **重建客户端 bundle** → 强制刷新。完成后可继续对照批次 16 的设计基线回归整体视觉。

- [ ] **团队与指派 chips**：项目区一屏 6 个角色 chips 为 **2 列**，名称（产品经理/UI 设计师/全栈开发/测试工程师/项目经理 Agent/运维）完整或自然省略、状态 pill（空闲/执行中/待确认）完整可读，不再出现只剩 1 个字；≤700px 仍 2 列、无横向溢出；点击 chip 仍能打开指派抽屉。
- [ ] **完成态 hero**：全部 7 关通过时 eyebrow 显示「全部 7 关已完成」、标题「本轮交付完成」；不再出现「STAGE 7 / 7 · 当前阶段」「已完成」重复 pill；侧栏显示「第 N 轮 · 全部通过」；门禁区显示「全部阶段已完成 · 可发布或发起新轮变更」且无「通过后进入人工确认」与复核报告链接；主操作「查看流水线/指派任务」可用。
- [ ] **需求摘要**：摘要以正文开头（如「Owner 评审 v1.2.78 后提出…」），不出现「背景」前缀；不再显示与需求标题相同的「第 7 轮变更 · 标题」重复行；标题/chips/查看完整需求/追加/修改/新轮变更/修订记录仍正常。
- [ ] **验收计数**：验收卡显示「通过 6 / 阻塞 14」（未通过与待验收为 0 时不显示），blocked 不再计入「待验收」；无交付包/预览分享时**不再出现空的「交付物」小节**；导出报告/打包交付/查看全部验收项可用。
- [ ] **完成态体检**：交付前体检 verdict 为「提示 N 项」（中性色）而非「建议先处理 N 项」；「最近任务：暂无记录」「预览分享：未分享」「交付包：未打包」为 N/A 灰点，不再作为必须处理项；验收/证据/发布等真实项仍正确。
- [ ] **变更卡**：提交后「本轮变更」不再显示「已审 0/0」，改显示「本轮变更已提交，无未提交改动。」；有未提交改动时仍显示已审 n/N 与逐文件列表。
- [ ] **运行中卡**：统计顺序为 **运行中 / 最近一次 / 最近结果 / 上次失败**（最近一次为宽列），数值与空态正确；「打开任务」可用。
- [ ] **视觉细节**：项目状态卡完成进度条为蓝色强调色（非纯黑）；完成态隐藏重复状态 pill、caption「全部通过」、行「第 N 轮 · 全部阶段已完成」；Now 区 hint 为「全部完成 · 暂无待处理」且无重复空态行。
- [ ] **回归与范围**：浅/深主题、360–1440 无横向溢出；通过/打回/启动并派发/review note/指派器/需求四操作/验收/交付/流水线/变更审阅/运行中/通知/刷新/关闭/compact 无回归；`git diff` 仅 client.js + CHANGELOG + 插件版本 + docs（无 Host/依赖/数据改动）。
- [ ] **自动化全绿**：`npm run check`、`npm run check:json`、`npm test`（31/31）、`node .dsh/tmp/team/pipeline-selftest.mjs`（38/38）、`review-selftest`（22/22）、`assignments-selftest`（27/27）、`node .dsh/tmp/qa-static-v1280.mjs`（STATIC PASS）均 exit 0。


## 批次 18 · 工作台布局修正：hero 全宽 + 项目区 2 列 + 交付 4 宫格（v1.2.81）

> 本轮为**纯客户端 CSS 布局修正**（client.js +5/−2）：① 页面画布显式 `align-items: stretch`，hero/Now 区填满内容宽度（此前继承旧 grid 的 start，hero 只占约 712px、右侧空一块）；② 项目区 ≥768 改 **2 列 + 需求卡整行**（≥1600 才 3 列），不再 3×350 挤成一排；③ 交付区设计稿整行展示，其余 4 卡 **2×2**，消除空块与运行中全宽长条。
> 复测前：重启 Harness → 重建客户端 bundle → 强制刷新。

- [ ] **hero/Now 填满**：1280/1440 宽度下深色 hero 与「现在」区占满内容宽度，右侧不再空一块；页面无横向滚动。
- [ ] **项目区 2 列 + 需求整行**：状态 | 团队 同一行，需求与调整整行在下方；团队 6 chips（2 列）与需求标题/摘要不再被压；≤700 单列；≥1600 才 3 列并排。
- [ ] **交付区 4 宫格**：设计稿卡整行展示；验收 | 体检 一行，变更 | 运行中 一行；没有空单元格，运行中不再是全宽长条；≤1023 单列。
- [ ] **视觉与响应式**：浅/深主题、360/768/1024/1280/1440/1600 无横向溢出；卡片标题完整；hover/focus 正常。
- [ ] **回归**：通过/打回/启动并派发/review note/指派器/需求四操作/验收/交付/流水线/变更审阅/运行中/通知/刷新/关闭/compact 无回归；`git diff` 仅 client.js + CHANGELOG + 插件版本 + docs。
- [ ] **自动化全绿**：check、check:json、npm test 31/31、pipeline 38/38、review 22/22、assignments 27/27、`node .dsh/tmp/qa-static-v1281.mjs`（STATIC PASS）均 exit 0。


## 批次 19 · 项目区去挤压：始终 2 列 + 需求整行（v1.2.82）

> 本轮为**纯客户端 CSS 修正**（client.js 删除 1600px 三列规则、列间距 16px）：Owner 屏幕 ≥1600 时 v1.2.81 仍触发 3 列（每卡约 400px），需求标题/摘要截断、团队卡拥挤。现项目区在任意 ≥768 宽度都是「状态｜团队」2 列 + 需求卡整行；≤700 单列。
> 复测前：重启 Harness → 重建客户端 bundle → 强制刷新。

- [ ] **项目区 2 列 + 需求整行**：1440/1600/1920 下都是状态 | 团队 一行、需求与调整整行在下方；需求标题/摘要完整、团队 chips 不拥挤；不再出现 3 卡一排。
- [ ] **窄屏**：≤700 单列、701–767 单列；无横向溢出。
- [ ] **回归与视觉**：hero/Now 全宽、交付区 4 宫格保持；浅/深主题；通过/打回/派发/review note/指派器/需求四操作/验收/交付/流水线/变更/运行中/通知/刷新/关闭/compact 无回归。
- [ ] **自动化全绿**：check、check:json、npm test 31/31、pipeline 38/38、review 22/22、assignments 27/27、`node .dsh/tmp/qa-static-v1282.mjs`（STATIC PASS）均 exit 0。

## 已知限制（不是缺陷）

- **预览分享**：只改写 HTML；前端在 JS 里拼接的绝对路径需要 dev server 配置 `base`；公网访问要求预览端口可达（否则用隧道）。
- **自动截图**：目前证据为手动上传（系统/手机截图、PDF、日志）；Host 侧无头浏览器截图需要额外安装 Playwright/Chromium，未内置。
- **watcher**：只监听根目录与已展开目录，SSH 工作区不监听（仍可手动/轮询刷新）。
- **重启依赖**：Host 路由（任务/验收/交付/预览/watcher/terminal list/review）与新增模型工具需要重启 Harness；仅刷新页面时旧 Host 会提示不可用或走降级路径。v1.2.72 的 acceptance 阶段、迁移逻辑与七阶段 prompt/工具文案同样必须重启 Host 才生效（客户端 7 关文案刷新即可）。
- **提示词/手册升级（v1.2.73）**：三 Agent 的调研/质量/许可证要求写在 `pipeline.js` 的 STAGE_GUIDES / PIPELINE_SECTION 与 `docs/opc/0{1,2,3}-*.md`，Host 重启后新提示词才生效；纯提示词/文档改动无需重建客户端 bundle。调研依赖 Harness 原生 `web_search` / `web_fetch`，无网络时按提示词要求标 blocked，不得伪造来源。
- **工作台指派器（v1.2.75）**：每个工作区最多 **100 条**记录、文件 ≤**1 MiB**、history ≤50 条；只有 done/failed/cancelled 可删除；SSH 远程工作区不支持指派；成员实时状态以 Harness 团队面板为准，卡片状态按指派记录**推导**；派发只生成结构化指派单，真正执行由 Lead 用原生团队工具完成；指派动作**不写** `.dsh/pipeline.json`。
- **工作台三区重构（v1.2.76）**：纯客户端改动（`client.js` + CSS + i18n），需**重建客户端 bundle + 刷新**才生效；折叠展开状态仅**会话内记忆**（刷新回默认收起，不做 localStorage）；需求摘要最多 2 行/约 160 字，完整需求需点「查看完整需求」；≤700px 单列、内容 max-width 1080；无 Host/数据/依赖改动。
- **工作台 UI 修正（v1.2.77）**：纯客户端（client.js +68/−20）；原生 tooltip 已限制为 ≤80 字摘要（完整需求仍走「查看完整需求」）；项目区宽屏 3 列、≤1023 两列、≤700 单列；「修订记录 (N)」默认折叠、刷新恢复折叠；同样需重建 bundle + 更强刷新。
- **交付区取消折叠（v1.2.78）**：纯客户端（client.js +10/−182）；交付区 5 卡（设计稿/验收/交付前体检/本轮变更/运行中）直接展示，**不再有展开/收起**；≥1024px 两列、≤1023px 单列；取消折叠后页面更长属预期；保留「修订记录 (N)」折叠（需求修订列表，与交付区无关）；无 Host/依赖/数据改动。
- **工作台项目区去挤压（v1.2.82）**：纯客户端 CSS；项目区始终 2 列 + 需求整行；仍需重启 Harness + 重建 bundle + 强刷；无 Host/依赖/数据改动。
- **工作台布局修正（v1.2.81）**：纯客户端 CSS（client.js +5/−2）；hero 全宽、项目区 2 列+需求整行、交付 4 宫格；仍需重启 Harness + 重建 bundle + 强刷；无 Host/依赖/数据改动。
- **工作台完成态与细节修正（v1.2.80）**：纯客户端（client.js +175/−56）；团队 chips 2 列、完成态文案/空态/计数修正；仍需重启 Harness + 重建 bundle + 强刷后复测；无 Host/依赖/数据改动。
- **工作台 UI 全面重构（v1.2.79）**：纯客户端（client.js +839/−74 + CSS/i18n）；深色 hero 固定在 #0b1220 锚点，浅/深主题共用；交付区 5 卡直接展示（第 5 卡全宽），≤1023 单列；效果图中的「分组侧栏」为视觉方向示意，实际外壳仍为现有横向侧栏条 + pane 头（仅 CSS 统一，不改导航/交互）；`qa-static-v1279` 为临时静态脚本（.dsh/tmp，不随包发布）；需重启 Harness + 重建 bundle + 强刷后复测。
- **双复核迁移**：旧 6 阶段 `.dsh/pipeline.json` 在读取时按 id 归一化补 acceptance（首次写回后落盘）；旧已完成项目的 acceptance 迁移备注仅代表「升级前旧流程已完成」，不代表新流程重新复核过，不能作为新交付的放行依据。
- **变更审阅签名**：`已审` 只在文件的 Git 状态（staged/unstaged/untracked/status）变化时失效；同一未暂存文件继续编辑不会自动失效（与现有 Git 面板一致）。
- **验收历史上限**：每项 history 最多 50 条、文件 1 MB；极端 300 项 × 长历史可能触顶，届时可先清理已通过项。

## 回滚与恢复

- 代码层：`git log --oneline` 查看批次提交（v1.2.23 → v1.2.82），可按批次 revert。
- 数据层：验收清单 `.dsh/acceptance.json`、交付记录 `.dsh/deliveries.json`、证据 `.dsh/evidence/`、运行账本 `.dsh/runs.json`、复测记录 `.dsh/verifications/`、变更审阅 `.dsh/review.json`、**工作台指派 `.dsh/agent-assignments.json`**、审阅标记（浏览器 localStorage）。这些都在 `.dsh/` 下且已被 `.gitignore` 忽略。
