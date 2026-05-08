# 06 基于 Codex/Agent 的完整开发流程

## 给实习生的工作方式

不要让 Agent “帮我开发一个 ERP”。必须把任务拆成小块，每块有明确输入和验收。

第一次接手时，先使用 `00-START-HERE-AI-ONE-STOP.md` 建立上下文；日常开发时，任务必须从 `09-agent-task-backlog.md` 或 `14-module-implementation-spec.md` 派生，不要凭印象临时造任务。

更新：长期接力时优先使用 `agent-execution/`。该目录已经把当前任务、依赖图、阶段路径和单任务规格拆成文件，比复制提示词更稳定。

标准循环：

```text
读需求
  -> 定义本次目标
  -> 让 Agent 先查现有代码
  -> 让 Agent 给实施计划
  -> 让 Agent 修改代码
  -> 运行测试/启动验证
  -> 人工检查结果
  -> 记录问题和下一步
```

## 每个任务的输入模板

备用模板。正常情况下不需要复制给 Agent，应让 Agent 读取 `agent-execution/current-state.yaml` 和 `agent-execution/tasks/<task_id>.md`。

```text
请基于 ai-dev-baseline/ 开发任务。

任务编号：
任务目标：
关联文档：
- ai-dev-baseline/00-START-HERE-AI-ONE-STOP.md
- ai-dev-baseline/13-integrated-product-spec.md
- ai-dev-baseline/14-module-implementation-spec.md
- ai-dev-baseline/02-domain-model-state-machines.md
- ai-dev-baseline/04-api-database-contract.md
- ai-dev-baseline/15-frontend-style-from-screenshots-and-repro.md

范围：
- 必须做：
- 不要做：

验收标准：
1.
2.
3.

要求：
1. 先读取相关代码和文档，不要猜接口。
2. 给出简短实施计划后直接修改。
3. 不得扩大 MVP 范围。
4. 修改后运行测试或给出可执行验证命令。
5. 如果涉及前端，必须遵守 15-frontend-style-from-screenshots-and-repro.md，只学习布局和交互，不复刻旧视觉。
6. 最后说明改了哪些文件、如何验证、剩余风险。
```

## Agent 开发铁律

| 规则 | 原因 |
| --- | --- |
| 一次只做一个任务卡 | 防止上下文混乱和大面积返工 |
| 先读 `00-START` 和当前任务关联文档 | 保证 AI 不从散落分析里各取一套口径 |
| 先查代码再改 | 避免创造不存在的接口和模式 |
| 必须引用需求编号 | 防止脱离目标 |
| 不确定就写 TODO_CONFIRM | 防止脑补业务规则 |
| 状态机只在 service 层改 | 防止状态乱流 |
| 金额操作必须事务和测试 | 财务风险最高 |
| 后台权限要测接口和按钮 | 只隐藏按钮不等于有权限 |
| 每次完成要跑验证 | 不接受只改代码不测试 |
| 每个模块按端到端切片 | 防止只做后端或只做页面，最后无法联调 |

## 需求驱动开发方法

每个功能从需求到代码必须形成链路：

```text
需求条目
  -> 用户故事
  -> 业务规则
  -> 状态机/数据模型
  -> API
  -> 前端页面
  -> 测试用例
  -> 验收脚本
```

例子：

```text
需求：用户提交包裹预报

用户故事：
作为会员用户，我希望提交国内快递单号和商品信息，以便仓库到货后能匹配我的包裹。

业务规则：
- 用户必须登录。
- tracking_no 必填且同一用户下不能重复。
- warehouse_id 必须有效。
- 创建后 Parcel.status = PENDING_INBOUND。

API：
POST /api/v1/parcels/forecast

后端：
parcels.services.forecast_parcel()

前端：
用户 Web 包裹预报页
移动 H5 发布预报页

测试：
- 未登录返回 UNAUTHORIZED。
- 缺 tracking_no 返回 VALIDATION_ERROR。
- 成功创建后后台待入库可查。
```

## Agent 分阶段使用方式

### 阶段 A：项目初始化

让 Agent 做：

- 创建 monorepo。
- 初始化 Django 项目。
- 初始化 admin-web、user-web、mobile-h5。
- 配置 Docker Compose。
- 配置 lint/test。

不要让 Agent 做：

- 同时写大量业务页面。
- 自己改技术栈。

### 阶段 B：后端核心域

顺序：

1. `common` 统一响应、错误、分页。
2. `iam` 后台登录、RBAC。
3. `members` 用户登录和会员资料。
4. `warehouses` 仓库和基础配置。
5. `parcels` 包裹预报和入库。
6. `waybills` 运单和状态机。
7. `finance` 钱包和支付。
8. `purchases/products` 最小代购和商品。

每完成一个 app，必须补：

- models。
- migrations。
- serializers。
- services。
- views。
- urls。
- tests。
- OpenAPI 输出。

### 阶段 C：后台端

顺序：

1. 登录和 Layout。
2. 菜单权限。
3. 基础配置。
4. 会员管理。
5. 包裹入库。
6. 运单管理。
7. 财务人工充值。
8. 代购处理。

### 阶段 D：用户 Web

顺序：

1. 登录。
2. 控制台和仓库地址。
3. 包裹预报。
4. 包裹列表/详情。
5. 申请打包。
6. 运单列表/详情。
7. 余额支付。
8. 手工代购。

### 阶段 E：移动 H5

顺序：

1. 登录和底部导航。
2. 寄件首页和仓库地址。
3. 包裹预报。
4. 包裹详情。
5. 申请打包。
6. 运单列表和轨迹。
7. 我的页。

### 阶段 F：端到端验收

让 Agent 写或补：

- demo seed 数据。
- e2e 测试。
- 演示脚本。
- 部署文档。
- 已知问题清单。

## 每次任务完成后的汇报模板

要求 Agent 最后按这个格式汇报：

```text
完成内容：
- 

修改文件：
- 

验证：
- 已运行：
- 结果：

关联需求：
- 

未完成/待确认：
- 

下一步建议：
- 
```

## 实习生人工检查清单

收到 Agent 输出后检查：

- 是否改了不相关文件。
- 是否新增了文档没有定义的状态。
- 是否绕过了 service 层直接改状态。
- 是否写了测试。
- 是否真的运行了命令。
- 是否有不确定事项却没有标记。
- 前端是否有 loading/empty/error。
- API 是否符合统一响应格式。
- 财务操作是否有事务和流水。

## 失败时怎么处理

如果 Agent 做失败，不要继续让它盲修。按下面顺序：

1. 要求 Agent 复述当前失败的命令和错误。
2. 要求 Agent 定位相关文件和调用链。
3. 要求 Agent 给最小修复方案。
4. 只允许修复当前失败，不允许顺手重构。
5. 修复后重新运行同一验证命令。

提示词：

```text
刚才的任务失败了。请不要扩大修改范围。
请先说明失败命令、关键错误、涉及文件、根因判断。
然后给出最小修复计划并执行。
修复后重新运行同一验证命令。
```
