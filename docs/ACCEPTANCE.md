# 验收清单（批次 0–11）

> 面向项目经理的复测步骤。当前代码版本 **v1.2.73**（批次 0–4 写于 v1.2.30、批次 5 写于 v1.2.68、批次 6–9 写于 v1.2.69–v1.2.71、批次 10 写于 v1.2.72；旧批次里的「六阶段/六关」是当时行为，现行**七阶段双复核**见批次 10，三 Agent 能力升级见批次 11）。**首次测试前请重启一次 Harness**（Host 路由/模型工具/`.dsh` 文档只在重启后生效；浏览器刷新只更新客户端）。
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

## 已知限制（不是缺陷）

- **预览分享**：只改写 HTML；前端在 JS 里拼接的绝对路径需要 dev server 配置 `base`；公网访问要求预览端口可达（否则用隧道）。
- **自动截图**：目前证据为手动上传（系统/手机截图、PDF、日志）；Host 侧无头浏览器截图需要额外安装 Playwright/Chromium，未内置。
- **watcher**：只监听根目录与已展开目录，SSH 工作区不监听（仍可手动/轮询刷新）。
- **重启依赖**：Host 路由（任务/验收/交付/预览/watcher/terminal list/review）与新增模型工具需要重启 Harness；仅刷新页面时旧 Host 会提示不可用或走降级路径。v1.2.72 的 acceptance 阶段、迁移逻辑与七阶段 prompt/工具文案同样必须重启 Host 才生效（客户端 7 关文案刷新即可）。
- **提示词/手册升级（v1.2.73）**：三 Agent 的调研/质量/许可证要求写在 `pipeline.js` 的 STAGE_GUIDES / PIPELINE_SECTION 与 `docs/opc/0{1,2,3}-*.md`，Host 重启后新提示词才生效；纯提示词/文档改动无需重建客户端 bundle。调研依赖 Harness 原生 `web_search` / `web_fetch`，无网络时按提示词要求标 blocked，不得伪造来源。
- **双复核迁移**：旧 6 阶段 `.dsh/pipeline.json` 在读取时按 id 归一化补 acceptance（首次写回后落盘）；旧已完成项目的 acceptance 迁移备注仅代表「升级前旧流程已完成」，不代表新流程重新复核过，不能作为新交付的放行依据。
- **变更审阅签名**：`已审` 只在文件的 Git 状态（staged/unstaged/untracked/status）变化时失效；同一未暂存文件继续编辑不会自动失效（与现有 Git 面板一致）。
- **验收历史上限**：每项 history 最多 50 条、文件 1 MB；极端 300 项 × 长历史可能触顶，届时可先清理已通过项。

## 回滚与恢复

- 代码层：`git log --oneline` 查看批次提交（v1.2.23 → v1.2.73），可按批次 revert。
- 数据层：验收清单 `.dsh/acceptance.json`、交付记录 `.dsh/deliveries.json`、证据 `.dsh/evidence/`、运行账本 `.dsh/runs.json`、复测记录 `.dsh/verifications/`、变更审阅 `.dsh/review.json`、审阅标记（浏览器 localStorage）。这些都在 `.dsh/` 下且已被 `.gitignore` 忽略。
