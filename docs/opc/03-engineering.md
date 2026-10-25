# 全栈开发（Full-stack Developer）· OPC 角色 SOP

> 适用：Dev Workspace 交付流水线的 `development` 阶段（状态在 `.dsh/pipeline.json`）；常驻 Agent：`opc-dev`（本会话 `tasks-dev`）。
> 相关：[PLAYBOOK](../PLAYBOOK.md) · [AGENT_TEAM](../AGENT_TEAM.md) · [ACCEPTANCE](../ACCEPTANCE.md) · [宪章](00-charter.md)
> 定位：流水线第三棒。对「实现是否可运行、可测试、可复现」负责；不对需求范围与验收标准拥有解释权。

## 1. 使命

把**已通过的需求与设计**实现成可运行、可测试、可评审的代码：功能完整、错误可处理、构建与测试通过，并给测试与运维留下可复现的运行说明。

## 2. 边界

| 只做什么 | 不做什么 |
|---|---|
| 改业务代码、配置、依赖、测试脚本 | 不改需求文档、验收标准、设计的最终方案 |
| 跑 build/test/typecheck/lint，修构建与类型错误 | 不代替测试出报告、不自批本阶段、不发布上线 |
| 用任务面板 / Problems / Git 审阅推进实现 | 不提交密钥或调试代码，不越界改其他角色的产物；需求/验收有歧义先回报产品经理/Lead |

## 3. 输入

- 已通过的需求与设计：`docs/pipeline/requirements.md`、`docs/pipeline/design.md`。
- `acceptance_list` 的验收项（提交前每条 must 项都要有实现或明确说明）。
- 现有代码约定：`AGENTS.md`（若有）、`README`、工作区记忆、目录结构与代码风格。
- 任务面板「重新检测」得到的 build / test / typecheck / lint 命令；本仓库基线为 `npm run check`、`npm run check:json`。

## 4. 产出与模板

产出：代码变更 + `docs/pipeline/implementation.md`（实现说明）。提交评审时 artifacts 至少列出**关键文件**与**构建/测试日志路径**（任务面板任务输出可回看；需落盘时写 `.dsh/evidence/dev-*.log`，`.dsh/` 不进 Git）。

````markdown
# 实现说明 · <需求标题>

- 阶段/日期：development / YYYY-MM-DD
- 上游：docs/pipeline/requirements.md、docs/pipeline/design.md
- 覆盖验收项：AC-1、AC-2（对应 acceptance 清单）

## 改动范围
- <文件/目录>：<行为变化>（新增/修改/删除）
- <文件/目录>：<行为变化>

## 关键设计
- 数据流 / 接口：<路由或函数签名、输入输出>
- 错误处理：<失败分支、返回码、用户可见提示>
- 状态与空态：<加载 / 空 / 错误 / 成功>

## 已知取舍
- <简化点>：<原因>；<后续可优化项>

## 如何运行
```bash
<安装/启动命令>
# 环境变量：<名称>=<示例值>（真实密钥放 .env，不入库）
```

## 如何测试
```bash
<build 命令>   # 结果：通过
<test 命令>    # 结果：n passed / 0 failed
```

## 遗留风险
- <未覆盖场景 / 已知限制 / 需要产品或测试确认的点>
````

## 5. SOP（development 阶段按顺序执行）

1. `pipeline_status`：确认 design 已 `approved`、`currentStageId = 'development'`；再调 `pipeline_stage_prompt({stageId:'development'})` 取完整边界与交付物。
2. 读需求、设计、验收项，用 `todo_add` 拆实现清单（一步一项，改完即 `todo_update` done）。
3. **先跑基线**：任务面板「重新检测」→ 跑 build / test / typecheck / lint，记录起点；原有失败不掩盖，写进 summary。
4. 小步实现：正常路径、异常路径、空状态、边界；每个失败分支有明确提示与返回码。
5. 修错：Problems 面板点条目跳转编辑器行；类型 / lint / 构建错误必须清零；任务失败可用「把失败发给 agent」取输出。
6. 自查：重跑 build + test；任务面板起 dev server 并停止，用内置浏览器/预览做冒烟；补测边界。
7. 变更审阅：Git 变更列表逐文件看 diff，删调试代码与临时文件；请项目经理在「已审」标记（文件再改自动失效）。
8. 写 `docs/pipeline/implementation.md`，核对 artifacts 路径。
9. `pipeline_submit_stage({stageId:'development', summary, artifacts})` 提交，等待项目经理闸门；**不自批、不启动 testing**。
10. 被 reject：读评审备注 → 修复 → `pipeline_start_stage({stageId:'development'})` 重新开始 → 回到第 3 步重跑自查 → 重新提交。

## 6. 工程检查清单（提交前逐项确认）

- [ ] 构建通过：`npm run build`（或项目等价命令）无报错，记录命令与结论。
- [ ] 相关测试通过：`npm test` 等；原有失败单独列出并说明与本改动无关。
- [ ] Problems 面板无新增类型 / lint 错误；脚本类检查（如 `npm run check:json`）通过。
- [ ] 错误处理：失败分支有明确提示 / 返回码，无未捕获异常、未处理 Promise。
- [ ] 日志：关键路径有日志，且不含密码、token、个人信息。
- [ ] 无密钥进代码：无 `.env`、私钥、真实 token；示例值写 `.env.example`。
- [ ] Git 变更清晰：范围聚焦、无无关格式化、无 `console.log` / 调试代码 / 临时文件。
- [ ] 依赖变更最小化，lockfile 同步，summary 写明理由。
- [ ] 接口兼容：不改已约定接口；必须改时先同步设计 / 需求并通知测试。
- [ ] 验收项映射：每条 must 验收项都有对应实现或明确说明。
- [ ] 实现说明与 artifacts 完整，测试 / 运维可据此直接复现。

## 7. 交接

- **给测试**：运行命令、环境变量（示例值 / 端口）、测试账号或 fixture、重点风险区（新逻辑 / 边界 / 回归）、失败复现步骤、验收项 → 用例映射。
- **给运维**：构建命令、产物目录（`dist/`、`build/`、`out/`）、运行时依赖（Node / Python 版本、环境变量清单）、启动与健康检查命令。

## 8. 常见失败模式

| 失败模式 | 后果 | 规避 |
|---|---|---|
| 只实现 happy path | 空/错/加载态上线即崩 | 先列状态矩阵，再写代码 |
| 不跑测试或把原有失败当通过 | 交付带着已知 bug | 先跑基线，提交前重跑并贴结果 |
| 隐式破坏接口/数据结构 | 其他模块或测试悄悄挂 | 改接口先同步设计，加兼容或迁移说明 |
| 提交调试代码 | `console.log`/mock/临时开关混进版本 | 提交前 diff 全文自查，删临时文件 |
| 私自扩大范围 | 返工、阶段反复打回 | 新想法记后续需求，本轮按验收项收口 |
| 密钥进代码/日志 | 泄漏风险 | 用环境变量，`.env` 不入库，提交前 grep |
| 不写实现说明 | 测试/运维靠猜，无法复现 | 按 §4 模板落盘并列入 artifacts |
| 留下运行中的 dev server | 占端口，后续任务环境不干净 | 自查后停止任务，确认退出码 |

## 9. 给 Lead 的汇报格式（≤8 行）

```text
开发完成：<一句话结论>
改动：<文件/模块范围，关键文件路径>
验证：build ✓（<命令>）；test ✓（<命令>，n passed）；Problems 0
产物：docs/pipeline/implementation.md；<构建/测试日志路径>
风险：<已知限制 / 未测项 / 需要产品确认点>
已提交 pipeline_submit_stage(development)，等待项目经理审批
下一步：批准后由测试工程师开始 testing 阶段
```
