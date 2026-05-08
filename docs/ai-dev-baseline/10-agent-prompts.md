# 10 Codex/Agent 提示词模板

## 总启动提示词

```text
你现在接手“跨境代购与集运 ERP”项目开发。
请先阅读 ai-dev-baseline/00-START-HERE-AI-ONE-STOP.md，并按该文件的必读顺序阅读 ai-dev-baseline/。

重点遵守：
- 12-source-evidence-map.md 的来源证据和净室边界
- 13-integrated-product-spec.md 的最终产品范围
- 14-module-implementation-spec.md 的模块拆分和验收
- 02-domain-model-state-machines.md 的实体命名和状态机
- 03-technical-architecture.md 的技术栈和目录结构
- 04-api-database-contract.md 的 API 和数据库契约
- 15-frontend-style-from-screenshots-and-repro.md 的前端风格和禁区

本项目目标是端到端交付，不是只搭框架。
任何代码任务都必须能关联到需求、API、数据模型、前端页面或验收点。
遇到待确认问题，不要脑补，标记 TODO_CONFIRM。

请先不要写代码，先输出：
1. 你理解的最终产品范围。
2. P0 端到端交付链路。
3. 推荐仓库目录结构。
4. 从 09-agent-task-backlog.md 开始的前 5 个任务。
5. 每个任务的验收命令或验收方式。
```

## 一条龙接手提示词

```text
请把 ai-dev-baseline/ 当作本项目的开发基线包。
从 00-START-HERE-AI-ONE-STOP.md 开始读取，然后按任务编号逐步执行。

工作方式：
1. 每次只执行一个任务卡。
2. 执行前先说明关联需求、影响模块、实施步骤和验证方式。
3. 执行时同时考虑后端、API、数据库、后台、用户 Web、移动 H5、测试和交付文档，不要只做一层。
4. 不得扩大 MVP，不做自动采购、真实在线支付、多租户、旧 UI 复刻。
5. 完成后必须输出修改文件、验证命令、验证结果、剩余风险和下一步。

现在请先执行 09-agent-task-backlog.md 的 INIT-001。
```

## 让 Agent 先审阅代码

```text
请先不要修改代码。
请阅读当前项目结构和 ai-dev-baseline/00-START-HERE-AI-ONE-STOP.md，按必读顺序补充上下文，然后回答：
1. 当前项目已经完成了哪些模块？
2. 与基线包相比缺哪些关键模块？
3. 下一步最小可交付任务是什么？
4. 需要修改哪些文件？
```

## 让 Agent 实现一个后端模块

```text
任务：实现 [模块名] 后端能力。

关联文档：
- ai-dev-baseline/13-integrated-product-spec.md
- ai-dev-baseline/14-module-implementation-spec.md
- ai-dev-baseline/02-domain-model-state-machines.md
- ai-dev-baseline/04-api-database-contract.md

范围：
- 必须实现：
- 不要实现：

要求：
1. 先检查现有 Django apps、models、urls、tests。
2. 按项目已有风格实现。
3. 写 service 层，不要在 view 里直接改业务状态。
4. 补 migrations、serializers、views、urls、tests。
5. 运行相关测试。
6. 最后说明验证结果。
```

## 让 Agent 实现一个前端页面

```text
任务：实现 [端]/[页面名]。

关联文档：
- ai-dev-baseline/13-integrated-product-spec.md
- ai-dev-baseline/14-module-implementation-spec.md
- ai-dev-baseline/15-frontend-style-from-screenshots-and-repro.md
- ai-dev-baseline/05-frontend-ux-spec.md
- ai-dev-baseline/04-api-database-contract.md

范围：
- 页面目标：
- API：
- 状态：
- 操作：

要求：
1. 先检查已有路由、API client、组件和样式。
2. 使用统一 loading、empty、error。
3. 表单必须有校验。
4. 状态按钮必须按状态机显示。
5. 不复刻旧系统视觉和文案。
6. 运行前端 lint/build 或说明不能运行的原因。
```

## 让 Agent 补测试

```text
请为 [模块/接口] 补测试。

重点覆盖：
1. 正常成功路径。
2. 未登录/无权限。
3. 参数校验失败。
4. 状态机非法流转。
5. 数据隔离。
6. 如果涉及财务，必须覆盖余额不足和重复请求。

请先查现有测试结构，再按已有风格添加。
完成后运行测试并汇报结果。
```

## 让 Agent 修 bug

```text
当前问题：
[粘贴错误日志或现象]

请不要扩大修改范围。
请按顺序处理：
1. 定位失败命令和关键错误。
2. 找到相关文件和调用链。
3. 说明根因。
4. 给出最小修复计划。
5. 执行修复。
6. 重新运行同一验证命令。
7. 汇报修改文件和剩余风险。
```

## 让 Agent 做端到端联调

```text
请基于 ai-dev-baseline/08-qa-security-deployment.md 做端到端联调。

目标流程：
后台配置仓库
-> 用户提交包裹预报
-> 后台扫描入库
-> 用户申请打包
-> 后台审核并设置费用
-> 后台充值
-> 用户支付
-> 后台发货和添加轨迹
-> 用户查看轨迹并确认收货

要求：
1. 先确认种子数据和测试账号。
2. 如果没有 E2E 测试，先写最小 E2E 或手工演示脚本。
3. 发现缺口时列出阻塞项，不要脑补跳过。
4. 完成后给出可复现命令。
```

## 让 Agent 做代码审查

```text
请以代码审查方式检查当前改动。

重点看：
1. 是否违反 ai-dev-baseline/ 的 MVP 范围。
2. 是否创造了未定义实体或状态。
3. 是否绕过 service 层改状态。
4. 是否存在用户数据越权。
5. 是否存在财务事务或幂等问题。
6. 是否缺少测试。
7. 前端是否缺 loading/empty/error。

请按严重程度列出问题，给出文件和行号。
```

## 让 Agent 生成 Sprint 任务

```text
请基于 ai-dev-baseline/07-delivery-plan-sprints.md 和 09-agent-task-backlog.md，
把 [Sprint 名称] 拆成适合 Codex 执行的小任务。

每个任务必须包含：
- 任务编号
- 目标
- 关联文档
- 必须做
- 不要做
- 验收标准
- 建议验证命令
```

## 让 Agent 输出交付说明

```text
请为当前项目生成交付说明。

必须包含：
1. 项目目标。
2. 已完成功能。
3. 未完成功能。
4. 本地启动步骤。
5. 测试账号。
6. 数据库迁移和种子数据。
7. 测试命令。
8. 演示脚本。
9. 已知问题。
10. 下一阶段建议。
```
