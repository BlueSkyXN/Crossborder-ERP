# Agent Execution 入口

本目录是给 Codex/Agent 自动接手开发用的执行入口。实习生不需要复制提示词，只需要让 Agent 读取：

```text
ai-dev-baseline/agent-execution/
```

Agent 进入后必须按本目录的文件顺序工作。

## Agent 固定读取顺序

1. `README.md`：理解本目录如何使用。
2. `../00-START-HERE-AI-ONE-STOP.md`：理解项目总目标和硬约束。
3. `../12-source-evidence-map.md`：理解 ChatGPT/Gemini 分析、截图、前端复现包如何转成规格。
4. `../13-integrated-product-spec.md`：理解最终产品范围。
5. `../14-module-implementation-spec.md`：理解模块级交付边界。
6. `../02-domain-model-state-machines.md`：理解实体命名和状态机。
7. `../03-technical-architecture.md`：理解技术栈和目录结构。
8. `../04-api-database-contract.md`：理解 API 和数据库契约。
9. `../15-frontend-style-from-screenshots-and-repro.md`：理解前端风格和禁区。
10. `current-state.yaml`：判断当前应该执行哪个任务。
11. `task-graph.yaml`：读取任务依赖、阶段和验收。
12. `tasks/<current_task>.md`：执行当前任务。

## Agent 如何决定下一步

规则：

1. 先看 `current-state.yaml` 的 `current_task`。
2. 打开 `tasks/<current_task>.md`。
3. 检查 `depends_on` 是否已经完成。
4. 如果依赖未完成，先回到 `task-graph.yaml` 找缺失依赖。
5. 如果依赖完成，执行当前任务。
6. 当前任务完成后，根据 `task-graph.yaml` 的 `next` 字段进入下一个任务。
7. 任何任务都不得跳过验收。

## 状态更新规则

开发过程中，Agent 每完成一个任务，应更新真实项目里的执行状态文件。如果项目还没有自己的状态文件，可以先维护本目录的 `current-state.yaml`。

状态只能使用：

```text
pending
in_progress
blocked
done
```

如果任务被阻塞，必须写清：

- `blocked_reason`
- 需要谁确认
- 不确认是否可以做简版
- 简版会不会影响 P0 闭环

## 不需要复制提示词

本目录已经把执行路径固化为文件：

- 阶段路径：`workflow-path.md`
- 机器可读任务图：`task-graph.yaml`
- 当前状态：`current-state.yaml`
- 单任务说明：`tasks/*.md`

实习生只需要告诉 Agent：

```text
读取 ai-dev-baseline/agent-execution/，按里面的 current-state.yaml 和 task-graph.yaml 继续开发。
```

## 完成定义

第一版不是“框架搭起来”，必须跑通：

```text
后台配置仓库/渠道/包装/增值服务
-> 用户登录并复制仓库地址
-> 用户提交包裹预报
-> 后台扫描入库
-> 用户申请打包
-> 后台审核运单并设置费用
-> 后台给用户充值
-> 用户余额支付
-> 后台发货并添加轨迹
-> 用户查看轨迹并确认收货
-> 用户提交手工代购
-> 后台采购到货并转 Parcel
-> Parcel 继续走集运主链路
```

最终以 `tasks/E2E-001.md` 和 `tasks/DOC-001.md` 完成作为交付闭环。
