# Playbook：从一个需求到客户交付

> 适用版本 **v1.2.32**。插件：Dev Workspace（`@local/dsh-web-dev-workspace`）+ Harness 原生 Agent Teams。
> 角色分工与闸门细节见 [AGENT_TEAM.md](AGENT_TEAM.md)；团队编制、角色边界手册与立项话术见 [opc/](opc/README.md)；功能复测步骤见 [ACCEPTANCE.md](ACCEPTANCE.md)。

一次完整交付 = **1 个需求 → 6 个流水线阶段 → 人工闸门（每阶段评审 + 最终确认）→ 1 次发布 → 1 套交付包**。

## 极简用法（你只需要做 3 件事）

1. **说需求**：流水线输入框写需求（标题 + 描述），勾上 **「快速模式」**（中间四阶段自动通过），点一次 **「开工：保存需求并派发」**。
2. **只在两道闸门审批**：快速模式下需求/设计/开发/测试四个中间阶段自动通过并继续；你只需要在 **「PM / 客户确认」** 和 **「发布上线」** 两个节点点 **通过 / 打回**。
3. **收交付**：全部通过后，验收面板「导出验收报告 / 打包交付 / 预览分享」，把报告、包和链接交给客户。

> 下面的完整流程是给 Lead 和团队看的；你不需要记阶段名、工具名或提示词。



## 0. 开始前（2 分钟）

1. **重启一次 Harness**（加载 Host 路由与模型工具），刷新页面。
2. 打开一个**本地工作区**（SSH 工作区不支持流水线/验收/交付）。
3. 侧栏确认能看到：**任务 / 验收 / 流水线** 三个标签。
4. 清理上一轮（如果这个工作区做过交付）：
   - 让 agent 调 `acceptance_clear_passed`，或验收面板里删除旧项；
   - 流水线目前**没有重置按钮**：新项目建议开一个新工作区；同一工作区重来需先删除 `.dsh/pipeline.json`。

## 1. 角色与工位

| 角色 | 谁执行 | 在插件哪里 | 关键工具/面板 |
|---|---|---|---|
| 产品经理 | 子代理 / Lead | 流水线（需求 + 产品阶段） | `pipeline_*`、`acceptance_add` |
| UI 设计师 | 子代理 / Lead | 流水线 + 编辑器/预览 | 设计文档、图片预览、内置浏览器 |
| 全栈开发 | 子代理 / Lead | 任务、Git、编辑器 | 任务面板、Problems、Git diff |
| 测试工程师 | 子代理 / Lead | 任务、验收、证据 | 任务面板、`acceptance_update`、证据上传 |
| 项目经理（你） | 你 | 流水线、验收、Git | 通过/打回、验收勾选、审阅标记 |
| 运维 | 子代理 / Lead | 流水线 + 交付 | `pipeline_record_release`、交付包、预览分享 |

## 2. 完整时间线

### ① 下发需求（你）

流水线面板填「需求标题 + 需求描述」并保存（或让 agent 调 `pipeline_set_requirement`）。描述里至少写清：
**目标用户 / 场景 / 范围（做什么、不做什么）/ 关键验收标准 / 约束（技术栈、兼容性）**。

> 例子：*「给现有 React 管理后台加登录页：邮箱+密码、记住登录、错误提示；复用现有 UI 组件；不接真实后端，用 mock；验收：三种错误分支可见、刷新后保持登录态、移动端可用。」*

### ② 产品经理阶段

- 面板点「启动并派发」（或 agent 调 `pipeline_start_stage({stageId:'product'})`），对话会收到该角色的提示词。
- Lead 用 `spawn_teammate` 组建产品经理（或在当前会话直接执行），成员按提示词产出：
  - `docs/pipeline/requirements.md`（目标、用户故事、范围、验收标准）
  - 用 `acceptance_add` 拆出可勾选验收项（title 写结论、requirement 写验证条件、category 分组）
- 完成后调 `pipeline_submit_stage({stageId:'product', summary, artifacts:[{path:'docs/pipeline/requirements.md',label:'需求分析'}]})`。
- **闸门 1（你）**：流水线面板看摘要与产物 → 写评审备注 →「通过」或「打回」。

### ③ UI 设计阶段

- 启动 `design` → 设计师产出 `docs/pipeline/design.md`（信息架构、页面/组件、交互、视觉规范）+ 设计资源（图片/SVG/HTML 预览，放 `docs/pipeline/design/`）。
- 提交 + artifacts（例如设计说明 + 关键页面截图路径）。
- **闸门（你）**：通过 / 打回（打回备注写清要改什么）。

### ④ 开发实现阶段

- 启动 `development` → 开发按需求 + 设计实现代码。
- 过程中用：**任务面板**跑 build/test、**Problems** 点击跳错、**Git 变更列表**审阅+「已审」标记、终端/任务日志。
- 提交：`pipeline_submit_stage({stageId:'development', summary, artifacts:[...代码/构建记录路径]})`。
- **闸门（你）**：看变更（Git 已审标记）→ 通过 / 打回。

> 小需求可以合并角色，但流水线顺序不能跳：设计阶段写「无 UI 变更」也要走一遍闸门。

### ⑤ 测试验收阶段

- 启动 `testing` → QA 写 `docs/pipeline/test-report.md`，跑任务面板里的测试/构建，逐条复测验收清单。
- 用 `acceptance_update` 把结果回填 `pass` / `fail`（fail 写复现与原因，外部依赖写 `blocked`）。
- 证据（截图/日志）上传到 `.dsh/evidence/` 并附到对应验收项备注。
- 提交测试报告 + 证据路径。
- **闸门（你）**：验收面板逐项看 pass/fail、证据缩略图；通过或打回。

### ⑥ 人工确认（最终闸门，只有你能过）

- 启动 `approval`（agent 可启动，但**没有审批工具**）。
- 你核对：验收清单是否全 pass、变更是否已审、测试报告与证据是否齐全、预览是否可用。
- 面板点「通过」→ **发布阶段解锁**；不通过就写备注打回。

### ⑦ 发布上线（运维）

- 启动 `release` → 运维执行构建/上传/部署（在任务面板或终端里）。
- 发布完成后：`pipeline_record_release({environment, url, notes})`（记录环境、可访问链接、版本/回滚说明）。
- 需要给客户临时看效果时：验收视图「预览分享」输入 dev server 端口 → 生成 token 链接 → 复制给客户。
- 提交 release 阶段摘要 + 发布记录。

### ⑧ 客户交付（你）

在验收面板一键产出：

1. **导出验收报告**（Markdown，含统计与未通过项清单）；
2. **证据包**（`.dsh/evidence/` 里的截图/日志，报告备注里带路径）；
3. **打包交付**（构建产物 + `ACCEPTANCE.md` → `.dsh/deliveries/*.zip`，交付记录可再次下载）；
4. **预览分享链接**（客户可直接打开的 HTTP 链接，含 HMR）。

### ⑨ 收尾

- 客户确认后：`acceptance_clear_passed` 清理已通过项（下一轮从干净清单开始）、关闭预览分享、Git 提交/推送。
- 把结论、客户反馈、遗留风险写进对话或工作区记忆（`memory_save`），下一轮交付可直接继承。

## 3. 可以直接发给 Lead 的指令模板

派发一个阶段时，把下面这段发到对话即可（把 `<阶段>` 换成 product/design/development/testing/approval/release）：

```text
按交付流水线执行 <阶段> 阶段：
1) 先调 pipeline_status 确认当前阶段与上游产物；
2) 调 pipeline_stage_prompt({stageId:'<阶段>'}) 拿到该角色的完整边界与交付物要求；
3) 用 spawn_teammate 为该角色创建一名队友（name/description 体现角色，prompt 用上一步的提示词 + 工作区路径），
   需要并行时用 team_task_create 拆任务并用 blocked_by 表达顺序；
4) 只做该角色边界内的事；完成后自检：
   - 产出是否落在工作区、验收项是否用 acceptance_add/acceptance_update 维护；
   - 开发/测试阶段是否用任务面板跑过 build/test 并处理 Problems；
5) 最后调 pipeline_submit_stage 提交 summary 与 artifacts，等待项目经理审批。
注意：你不能审批，也不要开始下一阶段。
```

## 4. 你（项目经理）每阶段要做的三个动作

1. **看**：摘要 + 产物链接 + 验收清单 + （开发阶段）Git 变更已审标记。
2. **问**：需要时在评审备注里写打回原因；让 agent 修完重新提交。
3. **点**：通过 / 打回；只有你能让流水线前进，也只有你能批准发布。

## 5. 交付物清单（客户拿到什么）

| 交付物 | 来源 |
|---|---|
| 需求与设计说明 | `docs/pipeline/requirements.md`、`docs/pipeline/design.md` |
| 可运行/可访问的成果 | 预览分享链接、发布 URL（`pipeline.releases`） |
| 验收报告 | 验收面板「导出验收报告」（Markdown） |
| 证据 | `.dsh/evidence/` 截图/日志，报告里带路径 |
| 交付包 | `.dsh/deliveries/*.zip`（构建产物 + ACCEPTANCE.md），交付记录可查 |
| 发布记录 | `.dsh/pipeline.json` 的 `releases`（环境/URL/说明/时间） |

## 6. 常见问题

- **每次都要重启 Harness 吗？** 只有升级插件后第一次需要（Host 路由/工具）。之后刷新页面即可。
- **能跳过某个阶段吗？** 不能。小需求可以把该阶段产物写得很小（例如设计阶段写「无 UI 变更」），但仍要过闸门。
- **agent 能自己批准吗？** 不能，也没有审批工具；只有你在面板点通过。
- **上下文太长怎么办？** 每个阶段用独立子代理或新会话；用 `pipeline_status` / `pipeline_stage_prompt` 按需读取，而不是把整条流水线塞进上下文。
- **SSH 工作区能用吗？** 流水线/验收/交付目前只支持本地工作区。
- **同一工作区第二次项目？** 流水线没有重置按钮，建议新项目开新工作区；或在确认交付完成后删除 `.dsh/pipeline.json` 再开始（验收清单用 `acceptance_clear_passed` 清理）。
- **公网客户看不到预览链接？** 预览分享是 Host 随机端口的 token 链接，公网需要该端口可达（或后续接隧道）。
