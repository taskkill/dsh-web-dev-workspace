# 议题流程 · UI 规格与 a11y 自检清单（T6）

> 依据：contract.md §5、plan.md §3。实现：`client.js` `renderGroupsPage`；i18n 键前缀 `groups.flow.*`（contract §5.3）。下文「N」= `plan.cards.length`。

## 1. 阶段条

吸顶于群组头下，`<nav>` + `<ol>` 四步：

| # | zh | en | 映射 phase |
|---|---|---|---|
| ① | 议题 | Topic | topic |
| ② | 讨论 | Discussion | discuss |
| ③ | 方案 | Plan | plan、approve |
| ④ | 执行 | Execute | execute、closed |

- 尺寸：条高 56px，步 min-height 44px、`flex:1;min-width:0`，步间 1px `--dsw-alias-border-l1`；图标 16px + 文字 14/20；步间距 8px，组内 padding 0 16px。
- 当前态：文字 `--dsw-alias-brand-primary`、600、底部 2px 实线；`aria-current="step"`。
- 已完成：`✓` 图标 + `label-primary`、可点；未解锁：`label-caption`、`aria-disabled="true"`、`tabindex="-1"`、cursor default。
- 点击规则：已完成步只滚动到时间线对应锚点（`data-flow-anchor`），**从不调用 Host op、不改 phase**；当前/未解锁不可点。
- 不溢出：≥640px 图标+文字；<640px 只留图标、当前步带文字；<480px 折叠为一行「阶段 2/4 · 讨论中 ▾」，点开纵向 popover。

## 2. 方案卡

时间线最后一条消息之后（非新页面），`<section aria-label="方案">`，默认展开，`min-width:0`。

- 分区：① 头部「方案」+ 状态标签；② 摘要 `summary`（14/20，`.clamp-3`）；③ 要点 `sections`，最多示 3 节，其余「展开全部 N 节」；④ 「将生成 N 张任务卡」+ 产物；⑤ approve 态按钮区。
- 状态标签（图标+文字+色三重编码）：草稿 Draft `label-secondary`；待确认 Pending `--dsw-alias-state-warn-primary`；已确认 Approved `--dsw-alias-state-success-primary`；已打回 Rejected `--dsw-alias-state-error-primary`。
- 折叠：`<button aria-expanded>` 44×44，位于卡头右侧；approve 态强制展开且折叠按钮 disabled（原因可见）。
- 截断：标题单行 ellipsis + `title`/`aria-label` 全文；摘要 3 行、要点正文 6 行、任务卡列表 5 张（余为「还有 N 张」）；每处截断均有展开，禁止静默截断。
- 任务分解不内联：只显示计数与「查看任务板 (N)」，点击切右栏任务板，避免双份列表。

## 3. 底部吸顶操作条

- 位置：composer 上方 `position:sticky`，背景 `--dsw-alias-bg-base`、上缘 1px `border-l1`、padding 12px 16px、min-height 64px。
- 布局：左状态文案「方案待你确认」；右 `[打回]`（次按钮）+ `[确认并执行]`（主按钮），两按钮间距 ≥16px，高均 ≥44px。
- **防重复主行动**：方案卡按钮区在视口内时隐藏吸底条，移出视口（IntersectionObserver 比率 <0.5）才出现；两处共享同一状态，永不同时可见。
- 二次确认 dialog：`role="dialog" aria-modal="true"`、焦点陷阱、Esc 关闭并归还焦点；标题「确认执行方案？/Confirm execution?」；正文「确认后将生成 **N 张任务卡**并自动分派给成员，随后开始执行。10 分钟内可在时间线撤销。」；按钮「取消 / 确认执行」（≤2 个）。
- 打回：dialog 内 `<textarea required maxlength=500>` + placeholder「说明打回原因（必填）/Reason (required)」；空值时「确认打回」disabled + 原因文案；提交后回 discuss。
- 撤销：确认成功后条变成功态「已生成 N 张任务卡 · 剩余 9:59 [撤销]」，倒计时每分钟更新且仅状态变化时 `aria-live="polite"` 播报；撤销需二次确认；10 分钟后条消失，系统消息留档。
- 窄屏（<640px）：纵向堆叠，次按钮「打回」在上、主按钮在下，全宽、间距 16px。

## 4. 交互状态与降级

- 模式：旧 Host（groupGet 无 phase/flow）→ 不渲染阶段条/方案卡/操作条，「发起议题」隐藏，显示 info 横幅「议题流程需重启 Harness 后生效 / Restart Harness to enable topic flow.」；仅 Host 模式可写。
- loading：首载骨架屏（阶段条 4 个 44px 灰块 + 卡 2 行）；op 进行中按钮 `disabled` + 旋转图标，文案「确认中…/Approving…」，提交中重复点击 no-op。
- 错误（顶部 banner `role="alert"`，2 行内）：`gate-blocked`「方案未确认，执行类操作已被拒绝」；`bad-phase`「当前阶段不允许该操作」；`flow-unsupported`「当前 Host 版本不支持，请重启 Harness」；`plan-invalid`「方案内容不完整」；`topic-exists`「已有进行中的议题」；`round-limit`「已到轮次上限（2 轮）」；`not-member`「你不是该群成员」。报错后操作条保留、主按钮恢复、不丢输入。
- 乐观更新：点击后立即切目标态，失败回滚 + 错误提示；3s 轮询外部变更用 300ms 高亮过渡（`prefers-reduced-motion` 时 0ms）。

## 5. a11y / 窄屏自检清单（MUST）

- [ ] 所有按钮/步骤高 ≥44×44，图标按钮有 `aria-label`。
- [ ] 焦点环 2px `--dsw-alias-brand-primary` + `outline-offset:2px`，对比 ≥3:1。
- [ ] 正文对比 ≥4.5:1；禁用态改为 `label-caption` 且实测仍 ≥4.5:1，**禁止用 opacity 降对比**。
- [ ] 状态不单靠颜色（图标+文案+色三重编码）。
- [ ] Tab 顺序：已完成的阶段步 → 时间线 → 方案卡折叠按钮 → 卡内按钮区 → 吸底条 → composer；dialog 内焦点陷阱，关闭归还触发元素。
- [ ] `aria-live="polite"` 用于阶段变化与撤销倒计时状态；`role="alert"` 仅错误。
- [ ] <900px 单栏（列表→时间线→成员/任务）+ 顶部返回；阶段条与吸底条不横向溢出。
- [ ] 360px 无横向溢出：长标题 ellipsis、`min-width:0`、长词 `overflow-wrap:anywhere`。
- [ ] 深浅主题各跑一遍；`prefers-reduced-motion` 关闭过渡。

## 6. 与现有群组页的冲突与解决

- **时间线**：方案卡是时间线末项，不占虚拟滚动；轮次分隔照旧；无 plan 时不渲染。
- **成员面板（右栏 320px）**：阶段条只在群组头下占 56px，三栏宽度不变。
- **任务板**：只显示计数与跳转，不内联任务卡，避免与右栏重复。
- **composer**：吸底条 sticky 于 composer 之上，二者合计 ≤160px；窄屏合并为 composer 上方单行。
- **双状态语义**：群组头运行态 chip（进行中/暂停/归档）与议题 phase 分开展示，间距 16px，不合并、不互相推导。
- **同源渲染**：阶段条/方案卡/操作条均由同一份 group doc 一次派生，避免部分刷新导致不同步；SSH 工作区整页降级为说明文案。
