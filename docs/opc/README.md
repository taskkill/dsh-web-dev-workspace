# OPC 团队工作区（索引）

> **一人公司 = Owner（你） + 五角色 Agent 团队 + Lead（总经理/技术负责人）。**
> 公司约定看 [00-charter.md](00-charter.md)；角色手册看 `01`–`05`；端到端流程看 [PLAYBOOK](../PLAYBOOK.md)。

## 名册（本会话当前编制）

| 角色 | 会话内 Agent 目标 | 作业手册 | 现在在做什么 |
|---|---|---|---|
| 产品经理 | `pipeline-dev` | [01-product.md](01-product.md) | 维护需求分析 SOP |
| UI 设计师 | `preview-dev` | [02-design.md](02-design.md) | 维护设计 SOP |
| 全栈开发 | `tasks-dev` | [03-engineering.md](03-engineering.md) | 维护开发 SOP |
| 测试工程师 | `acceptance-dev` | [04-qa.md](04-qa.md) | 维护测试 SOP |
| 运维 | `delivery-dev` | [05-ops.md](05-ops.md) | 维护发布 SOP |
| 总经理/技术负责人（Lead） | `lead` | [00-charter.md](00-charter.md) | 编排与闸门调度 |
| Owner（你） | — | 本文 | 需求 / 审批 / 客户交付 |

> 成员名是技术标识；**角色以本表为准**。新会话里 Lead 会用 `spawn_teammate` 重新组建同样编制的五名角色成员（Harness 团队上限 8 人，正好 5 角色 + Lead + 2 个机动位）。

## 开一个新项目

**最省事**：打开侧栏「流水线」，把需求填进输入框，点一次 **「开工：保存需求并派发」**。之后你只需要在顶部横幅出现「第 N 关待你审批」时点 **通过 / 打回**——通过后会自动进入下一阶段，全部通过后在验收面板导出报告、打包交付、复制预览链接给客户。

如果你想用一句话在对话里启动，也可以发：

把下面模板填好发到对话：

```text
OPC 立项：<一句话需求>
要求：按 docs/opc/00-charter.md 与 docs/PLAYBOOK.md 走完整六阶段；
先做 product 阶段，需求和验收项产出后停下来等我审批，审批前不要进入下一阶段。
交付目标：<给谁用/验收标准/上线环境>。
```

Lead 收到后会：

1. 把需求写进流水线（`pipeline_set_requirement`），并按需补充验收项骨架；
2. 启动 product 阶段，把角色提示词派给「产品经理」；
3. 按闸门节奏逐个阶段推进：**每次提交都停下等你审批**；
4. approval 通过后派给「运维」发布，最后把报告 / 证据 / 交付包 / 链接汇总给你。

## Lead 的编排要点（内部约定）

- **任务与依赖**：一个阶段 = 一条共享任务（`team_task_create`），用 `blocked_by` 表达「设计通过才能开发」；写入范围在任务里声明（例如 `docs/pipeline/design.md`、`src/`）。
- **派发**：`send_message` 把 `pipeline_stage_prompt(<stage>)` 的完整内容 + 任务 id + 工作区发给对应角色成员；角色完成后 `pipeline_submit_stage` 提交（或由 Lead 代提交，产物必须已落盘）。
- **等待**：用 `wait_agent` 等角色回合结束，再 `team_task_list` 检查产物；不要空转轮询。
- **闸门**：review 状态只通知 Owner；Owner 通过后 Lead 才启动下一阶段。
- **失败**：被打回时把评审备注转给对应角色；连续两次打回由 Lead 缩小范围或换方案并告知 Owner。
- **上下文**：每个阶段优先新子代理/新会话执行；Lead 只保留阶段结论与产物路径。

## 角色速查（谁在哪一步、用什么）

| 阶段 | 角色 | 面板 / 工具 | 产物（默认路径） |
|---|---|---|---|
| product | 产品经理 | 流水线 + `acceptance_add` | `docs/pipeline/requirements.md` + 验收项 |
| design | UI 设计师 | 流水线 + 编辑器/浏览器 | `docs/pipeline/design.md` + `docs/pipeline/design/` |
| development | 全栈开发 | 任务面板 + Problems + Git | 代码 + 构建/测试记录 |
| testing | 测试工程师 | 任务面板 + 验收台 + 证据 | `docs/pipeline/test-report.md` + `.dsh/evidence/` |
| approval | **Owner** | 流水线面板「通过/打回」 | 审批结论 |
| release | 运维 | 交付打包 + 预览分享 + `pipeline_record_release` | `docs/pipeline/release.md` + 发布记录 |

## 常用命令（Owner 可以直接说）

- 「看一下流水线状态」→ `pipeline_status`
- 「把当前阶段打回，原因：……」→ 你在面板操作，或让 Lead 转达
- 「导出验收报告并打包交付」→ 验收面板按钮
- 「给客户一个预览链接，端口 5173」→ 验收视图「预览分享」

## 维护

- 角色 SOP 有变更：对应角色更新自己的手册，Lead 在收尾时汇总一条工作区记忆。
- 本目录文件随插件发布，属于团队资产；`.dsh/` 里的运行状态不进 Git。
