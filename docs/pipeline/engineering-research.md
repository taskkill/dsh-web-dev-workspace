# 工程调研 · 工作台 Agent 指派器 MVP（v1.2.75，第 3 轮）

- 日期：2026-10-27（Asia/Shanghai）；关联需求：[docs/pipeline/requirements.md](requirements.md)；阶段：development（第 3 轮）
- 功能：工作台「团队与指派」卡 + 指派抽屉 + 状态列表 + 结构化派单（`.dsh/agent-assignments.json`、4 个 owner-only 路由 op）
- **结论：N/A（无第三方代码/依赖复用）** —— 本轮为**本地状态模块 + 本地 UI**：没有陌生的第三方库/协议需要选型，未检索、未复制任何第三方代码或素材，也未新增/替换运行时依赖。按 [docs/opc/03-engineering.md](../opc/03-engineering.md) §5 记录 N/A 理由、借鉴的**内部模式**、可靠/安全/性能自检与证据；如后续出现陌生第三方能力，必须按该手册 §5 重新执行开源调研与许可证检查。

## 1. 为什么记 N/A（判定依据）

| 判定项 | 结论 | 依据 |
|---|---|---|
| 是否遇到不熟悉的功能/库/协议 | **否（N/A）** | 实现对象是团队自有的「工作台 + `.dsh` 本地 JSON 状态」模式；存储、路由、面板组件均为本仓库既有能力 |
| 是否新增/替换第三方依赖 | **否** | `dsh-web-filebrowser-plugin/package.json` 的 `dependencies` 未变（仅 `files` 白名单补充 `assignments.js`）；根 `package.json` 仅 `scripts.check` 增加一条 `node --check` |
| 是否需要 GitHub ≥2 活跃候选对比 | **N/A** | 没有「选哪个开源库/实现」的决策点；`node:fs`/`node:crypto`/`node:path` 为 Node 标准库，不属于第三方依赖 |
| 是否复制第三方代码/素材 | **否** | 只参考本仓库既有模块的**写法**（原子写、锁、错误码风格），代码为重新实现；未引入第三方图标/字体/文案 |
| 是否需要许可证记录/署名 | **N/A（无第三方代码）** | 见 §4：无外部代码/素材需署名；仓库自身代码为 MIT（根 LICENSE） |

## 2. 候选对比（≥2 个活跃开源项目）

**不适用**：本轮没有需要选型的第三方能力。`assignmentSave/Update/Delete` 的持久化复用团队已定的「`.dsh` 单 JSON + temp+rename 原子写 + per-root 串行锁」模式；面板复用现有 `ds-wb-*` 组件与 `--dsw-alias-*` token。引入 `write-file-atomic` 等库会违反「不新增运行时依赖」约束，且现有模式已被 acceptance/pipeline 等模块验证。

## 3. 借鉴决策（内部模式 + 需求阶段已记录的公开来源）

> 来源 URL 与访问日期沿用 [requirements.md](requirements.md) §7 的真实调研（2026-10-27），本轮不重复抓取、不新增未注明来源。

| 借鉴点 | 来源 | 决策 | 理由 | 落点 |
|---|---|---|---|---|
| 原子写（temp 文件 + `rename` 替换） | **内部模式** `acceptance.js` / `pipeline.js`（团队既定；其原则亦见需求 §7 #7 Node.js fs 文档） | **采用** | 防半写、写失败保留旧文件；无需新增依赖 | `assignments.js` `writeAssignments` |
| per-root 串行锁（读-改-写排队） | **内部模式** `acceptance.js` / `pipeline.js` | **采用** | 防并发丢更新/重复 id；需求 §7 #7 指出同文件并发修改需串行化 | `assignments.js` `withMutationLock` |
| 面板/卡片/抽屉视觉与组件 | **内部模式** 现有 `ds-wb-*`、`ds-btn`、`ds-pipe-input`、`--dsw-alias-*` + 本轮设计稿 `docs/pipeline/design/assign-*.svg` | **采用** | 不新增设计系统/依赖；与现有工作台一致 | `client.js` `.ds-wb-assign*` |
| HITL：人类只在派发与完成确认点介入、审批可审计 | 需求 §7 #1（Microsoft Learn · human-in-the-loop workflows，访问 2026-10-27） | **采用** | Owner 只做「派发 + 通过/打回」，状态变更 append history，打回必填原因 | 状态机 + `history` |
| 状态可见与即时反馈（五段进度、状态 pill、toast、催办） | 需求 §7 #5（NN/g · Progress Indicators，访问 2026-10-27） | **采用** | 异步任务需让 Owner 知道「走到哪一步」 | 卡片/状态列表/催办 |
| 单一 assignee + 人类保留最终责任 | 需求 §7 #3（Linear Docs · Assign and delegate issues，访问 2026-10-27） | **采用** | 避免「谁在做」歧义；Owner 仍是双复核最终确认人 | `assignedTo` 三选一互斥 |
| 对话框标签、焦点入/出、Tab 循环、Esc 关闭 | 需求 §7 #6（MDN · ARIA `dialog` role，访问 2026-10-27） | **采用** | 抽屉/底部面板的键盘与焦点规范 | `role=dialog aria-modal` + 焦点管理 |
| 多 assignee（GitHub 最多 10 个） | 需求 §7 #4（GitHub Docs · assigning issues，访问 2026-10-27，仅对比） | **不采用** | 会让原生团队工具执行与状态追踪歧义 | — |
| 自动超时失败/自动重试 | 需求 §7 #1/#5 延伸 | **不采用** | Agent 可能长时间运行；自动改状态会误判 | 仅等待提示 + 催办 |
| 第三方原子写依赖（write-file-atomic 等） | 需求 §7 #7 延伸 | **不采用** | 需求禁新增运行时依赖；自建 temp+rename 足够 | — |

## 4. 出处与许可证说明

- **无第三方代码复制**：`assignments.js` 与 `client.js` 新增部分全部为本轮新写代码；未复制任何外部项目源码、文案、图标或字体，因此无版权头/NOTICE/署名义务。
- **来源 URL + commit/版本：不适用**（本轮未引用任何第三方仓库/代码，无外部 commit 或 release 需要记录；内部参考模块为同仓库 HEAD 版本，无需外部出处）。
- **内部代码参考**：`acceptance.js`、`pipeline.js` 与本仓库同许可（MIT，见仓库 `LICENSE`），本轮参考的是模块结构/错误码/锁的**模式**，不是第三方代码；无需外部 attribution。
- **内联 SVG 图标**：抽屉关闭按钮复用仓库既有 `CloseIcon`（项目自有组件），未引入外部图标库。
- 若后续需要引入第三方代码/依赖，必须按 [03-engineering.md](../opc/03-engineering.md) §5.3 用 SPDX 标识记录许可证、保留版权与许可声明（Apache-2.0 另加 NOTICE），并经 Lead 确认；GPL/AGPL/无许可证禁止复制代码。

## 5. 可靠 / 安全 / 性能自检

| 检查项 | 结果与证据 |
|---|---|
| 关键路径测试与错误处理 | 有；稳定错误码 `bad-root/bad-request/bad-id/bad-transition/not-found/full/too-large/corrupt/ssh-unsupported`；UI 就地错误、不丢输入；打回空 note 双重拒绝 |
| 并发 | per-root 串行锁：10 次并发 `assignmentSave` → 10 条记录、文件可解析（`dev-check` 与 QA host-smoke 均覆盖） |
| 原子写 / 损坏恢复 | temp+rename；写失败保留旧文件；JSON 损坏返回 `corrupt`（含路径）且**不静默清空/覆盖**（哈希不变） |
| 上限保护 | ≤100 条（`full`）、单文件 ≤1MB（`too-large`）、history ≤50、字段长度与条数上限全部在 Host 校验 |
| 输入校验 | `assignedTo` 三选一互斥 + 角色白名单；`stageId` 白名单且 approval/release 拒绝；priority 白名单；路径 containment/符号链接防护 |
| 安全 | 面板 op 仅 owner 路由、**不注册模型工具**（Agent 不能自派）；不写 `.dsh/pipeline.json`（生命周期内哈希不变）；无密钥/真实数据写入 |
| 无新增依赖 | `dependencies` 未变；无第三方代码/素材；客户端纯增量 CSS/JS |
| UI 间距一致性 | 卡片成员 chips 网格与抽屉 chips 间距统一为 **8px**（PM 复核发现原实现为 7/6px，偏离 4/8px 体系；已改为 8px，不引发布局问题） |
| 性能预算与测量 | 本地 JSON ≤100 条/≤1MB，单次读写毫秒级；工作台轮询每 3s 增加 1 次本地 `assignmentList`（单文件读取），无可感知影响；无新构建产物/重型依赖，抽屉动画只动 `transform/opacity` 且支持 `prefers-reduced-motion` |
| 回归 | `npm run check`、`npm run check:json`、`npm test`（QA 31/31，含 13 条 assignments 用例）、`pipeline-selftest` 38/38、`review-selftest` 22/22、`.dsh/tmp/dev-check-assign.mjs` 18/18 全绿 |

## 6. 来源记录（沿用需求阶段调研，访问日期均为 2026-10-27）

- [Microsoft Learn · Design human-in-the-loop workflows](https://learn.microsoft.com/en-us/training/modules/governance-guardrails-operations/4-design-human-workflows) —— 人类在高影响决策点介入、审批显式可审计、串行执行。
- [NN/g · Progress Indicators Make a Slow System Less Insufferable](https://www.nngroup.com/articles/progress-indicators/) —— 状态可见性、即时反馈、进度指示。
- [Linear Docs · Assign and delegate issues](https://linear.app/docs/assigning-issues) —— 单一 assignee、可委托给 Agent 但人类保留责任。
- [MDN · ARIA `dialog` role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/dialog_role) —— `role=dialog` + 可访问名称、焦点入/出、Tab 循环。
- [Node.js Docs · File system](https://nodejs.org/api/fs.html) —— 同文件并发修改需串行化；temp+rename 原子替换。
- [GitHub Docs · Assigning issues and PRs](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/assigning-issues-and-pull-requests-to-other-github-users) —— 多 assignee 对比参考（本需求不采用）。
- [Microsoft HAX Toolkit · Guidelines for Human-AI Interaction](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/) —— 能力边界、纠错、后果与状态变化提示。

> 以上来源已在 [requirements.md](requirements.md) §7.1 完整记录 URL + 访问日期 + 关键结论；本轮未新增未注明来源，未伪造。

## 7. 结论

- **工程调研：N/A（理由完整）**；无第三方代码/依赖复用，无许可证或版权风险。
- 可靠/安全/性能自检通过；无新增运行时依赖、无流水线写入、无模型工具。
- 证据：`npm run check` / `npm run check:json` / `npm test`（31/31）/ `pipeline-selftest`（38/38）/ `review-selftest`（22/22）/ `dev-check-assign`（18/18）。
- 后续风险：团队实时成员状态仍以 Harness 团队面板为准（本 MVP 按记录推导）；若下一轮引入第三方库或复制代码，按 §5 重新调研并补许可证记录。

## 8. 第 4 轮补充（v1.2.76 · 工作台 UI 重构）

- **结论：N/A 仍适用**。本轮为纯客户端 UI 重构（`client.js` 三区布局/hero/折叠/摘要/CSS/i18n），未引入第三方库、组件库或模板，未检索/复制外部代码或素材，未新增运行时依赖（`dependencies` 与 HEAD 逐字一致）。
- 参考来源沿用需求阶段公开资料（NN/g 渐进披露/视觉层级/卡片、W3C 对比度），仅借鉴模式不复制代码；无需署名/NOTICE。
- 可靠/安全/性能自检：大函数重构后全部既有卡片与事件保留（无删功能）；无 `innerHTML`/`dangerouslySetInnerHTML`（无新增 XSS 面）；折叠默认收起、展开按需渲染；无新增网络/存储调用；`prefers-reduced-motion` 降级；未改 Host/数据格式。
- 证据：`npm run check`、`npm run check:json`、`npm test`（31/31）、`pipeline-selftest`（38/38）、`review-selftest`（22/22）、`assignments-selftest`（27/27）、`qa-static-v1276`（STATIC PASS）。
