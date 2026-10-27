# OPC 团队工作区（索引）

> **一人公司 = Owner（你） + 六角色 Agent 团队 + Lead（总经理/技术负责人）。**
> 公司约定看 [00-charter.md](00-charter.md)；角色手册看 `01`–`06`；端到端流程看 [PLAYBOOK](../PLAYBOOK.md)。
> 当前模式：**双复核** —— 项目经理 Agent 做验收复核（第 5 关），Owner 人工确认（第 6 关）后才允许发布。

## 名册（本会话当前编制）

| 角色 | 角色标识 | 作业手册 | 现在在做什么 |
|---|---|---|---|
| 产品经理 | `opc-product` | [01-product.md](01-product.md) | 维护需求分析 SOP |
| UI 设计师 | `opc-design` | [02-design.md](02-design.md) | 维护设计 SOP |
| 全栈开发 | `opc-dev` | [03-engineering.md](03-engineering.md) | 维护开发 SOP |
| 测试工程师 | `opc-qa` | [04-qa.md](04-qa.md) | 维护测试 SOP |
| **项目经理 Agent** | `opc-pm` | [05-review.md](05-review.md) | 维护验收复核 SOP |
| 运维 | `opc-ops` | [06-ops.md](06-ops.md) | 维护发布 SOP |
| 总经理/技术负责人（Lead） | `lead` | [00-charter.md](00-charter.md) | 编排与闸门调度 |
| Owner（你） | — | 本文 | 需求 / 人工确认 / 客户交付 |

> 角色标识是技术约定；成员名由 Lead 用 `spawn_teammate` 创建。Harness 团队上限 8 人：六角色 + Lead = 7，留 1 个机动位。旧版五角色（无项目经理 Agent）仍可运行，但推荐按本表编制。

## 开一个新项目

**最省事**：打开工作区默认的**全宽工作台页**，在「需求录入」贴需求文字、拖入截图/需求文档，保持「自动推进」勾选，点 **「交给产品经理」**。产品经理梳理方案后，设计/开发/测试/AI 验收复核自动推进；你只在**人工确认**（第 6 关）与**发布**两道闸门出现，最后验收复测即可。中间五阶段（需求/设计/开发/测试/AI 验收复核）会自动通过并推进；你需要在 **人工确认** 与 **发布上线** 两道闸门点 **通过 / 打回**，最后在验收面板导出报告、打包交付、复制预览链接给客户。

如果你想用一句话在对话里启动，也可以发：

把下面模板填好发到对话：

```text
OPC 立项：<一句话需求>
要求：按 docs/opc/00-charter.md 与 docs/PLAYBOOK.md 走完整七阶段（双复核）；
先做 product 阶段，需求和验收项产出后停下来等我审批，审批前不要进入下一阶段。
交付目标：<给谁用/验收标准/上线环境>。
```

Lead 收到后会：

1. 把需求写进流水线（`pipeline_set_requirement`），并按需补充验收项骨架；
2. 启动 product 阶段，把角色提示词派给「产品经理」；
3. 按闸门节奏逐个阶段推进：**每次提交都停下等你审批**；
4. 测试通过后派给「项目经理 Agent」做验收复核，产出 `docs/pipeline/acceptance-review.md`；你在 approval 关人工确认；
5. approval 通过后派给「运维」发布，最后把报告 / 证据 / 交付包 / 链接汇总给你。

## Lead 的编排要点（内部约定）

- **任务与依赖**：一个阶段 = 一条共享任务（`team_task_create`），用 `blocked_by` 表达「设计通过才能开发」；写入范围在任务里声明（例如 `docs/pipeline/design.md`、`src/`）。
- **派发**：`send_message` 把 `pipeline_stage_prompt(<stage>)` 的完整内容 + 任务 id + 工作区发给对应角色成员；角色完成后 `pipeline_submit_stage` 提交（或由 Lead 代提交，产物必须已落盘）。
- **等待**：用 `wait_agent` 等角色回合结束，再 `team_task_list` 检查产物；不要空转轮询。
- **闸门**：review 状态只通知 Owner；Owner 通过后 Lead 才启动下一阶段。acceptance 关的 Agent 只能给放行建议，不能审批。
- **失败**：被打回时把评审备注转给对应角色；连续两次打回由 Lead 缩小范围或换方案并告知 Owner。
- **上下文**：每个阶段优先新子代理/新会话执行；Lead 只保留阶段结论与产物路径。

## 角色速查（谁在哪一步、用什么）

| 阶段 | 角色 | 面板 / 工具 | 产物（默认路径） |
|---|---|---|---|
| product | 产品经理 | 流水线 + `acceptance_add` + `web_search`/`web_fetch` | `docs/pipeline/requirements.md`（含调研与借鉴决策表）+ 验收项 |
| design | UI 设计师 | 流水线 + 编辑器/浏览器 + 设计规范调研 | `docs/pipeline/design.md`（含质量标准/状态矩阵/自检评分/迭代）+ `docs/pipeline/design/` |
| development | 全栈开发 | 任务面板 + Problems + Git + GitHub 开源调研 | 代码 + `docs/pipeline/engineering-research.md` + 构建/测试记录 |
| testing | 测试工程师 | 任务面板 + 验收台 + 证据 | `docs/pipeline/test-report.md` + `.dsh/evidence/` |
| **acceptance** | **项目经理 Agent** | 流水线 + 验收台 + 任务面板复测 | `docs/pipeline/acceptance-review.md` + 证据 |
| approval | **Owner（你）** | 流水线面板「通过/打回」 | 人工确认结论（第二道复核） |
| release | 运维 | 交付打包 + 预览分享 + `pipeline_record_release` | `docs/pipeline/release.md` + 发布记录 |

**三 Agent 能力（v1.2.73）**：产品经理先调研 ≥3 个同类需求/行业标准并写借鉴决策表；UI 设计师按 9 项设计硬标准交付、用五维 rubric 自检并完成渲染→检查→修正迭代；全栈开发遇到不熟悉功能先检索 ≥2 个活跃开源候选，按许可证矩阵决定借鉴方式，产出 `docs/pipeline/engineering-research.md` 并保证可靠/安全/高性能。验收复核关会检查这些证据，缺失即建议打回。

## 常用命令（Owner 可以直接说）

- 「看一下流水线状态」→ `pipeline_status`
- 「把当前阶段打回，原因：……」→ 你在面板操作，或让 Lead 转达
- 「把验收复核报告给我看」→ 打开 `docs/pipeline/acceptance-review.md`（或工作台卡片）
- 「导出验收报告并打包交付」→ 验收面板按钮
- 「给客户一个预览链接，端口 5173」→ 验收视图「预览分享」

## 维护

- 角色 SOP 有变更：对应角色更新自己的手册，Lead 在收尾时汇总一条工作区记忆。
- 本目录文件随插件发布，属于团队资产；`.dsh/` 里的运行状态不进 Git。
