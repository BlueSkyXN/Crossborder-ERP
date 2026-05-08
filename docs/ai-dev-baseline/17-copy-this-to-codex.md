# 17 直接复制给 Codex 的接手提示词

本文件是备用方案。主流程已经改为目录驱动：优先让 Agent 读取 `agent-execution/`，不要依赖复制提示词。

## 第一次接手项目

```text
请阅读 ai-dev-baseline/ 目录，并从 ai-dev-baseline/00-START-HERE-AI-ONE-STOP.md 开始。

你必须按该文件列出的必读顺序理解项目，不要先写代码。

请先输出：
1. 你理解的最终产品范围。
2. P0 端到端交付链路。
3. 技术栈和推荐仓库目录结构。
4. 后端、后台、用户 Web、移动 H5 的交付边界。
5. 从 09-agent-task-backlog.md 开始的前 5 个任务。
6. 每个任务的验收命令或验收方式。
7. 当前你认为还需要人工确认的问题。

约束：
- 这是独立实现，不是复刻旧系统。
- ChatGPT/Gemini 分析、截图、Gemini 前端复现包只能作为业务证据和交互参考。
- 第一版必须端到端交付，不接受只搭框架。
- 不做自动采购、真实在线支付回调、多租户 SaaS、PDA/硬件深度集成、推广返利、高级 BI。
- 不确定内容标记 TODO_CONFIRM，不能脑补业务规则。
```

## 确认理解后，启动第一个任务

```text
请执行 ai-dev-baseline/09-agent-task-backlog.md 的 INIT-001。

执行前必须阅读：
- ai-dev-baseline/00-START-HERE-AI-ONE-STOP.md
- ai-dev-baseline/13-integrated-product-spec.md
- ai-dev-baseline/14-module-implementation-spec.md
- ai-dev-baseline/03-technical-architecture.md
- ai-dev-baseline/06-agent-development-workflow.md

范围：
- 只做 INIT-001。
- 创建 monorepo 基础目录、根 README、AGENTS.md、.env.example、docker-compose.yml。
- 不写业务模型。
- 不写大量页面。

完成后输出：
- 完成内容
- 修改文件
- 验证命令
- 验证结果
- 关联需求
- 剩余风险
- 下一步
```

## 开发任意后端任务

把 `[任务编号]` 替换成 `BE-001`、`BE-002` 等。

```text
请执行 ai-dev-baseline/09-agent-task-backlog.md 的 [任务编号]。

执行前必须阅读：
- ai-dev-baseline/13-integrated-product-spec.md
- ai-dev-baseline/14-module-implementation-spec.md
- ai-dev-baseline/02-domain-model-state-machines.md
- ai-dev-baseline/03-technical-architecture.md
- ai-dev-baseline/04-api-database-contract.md

要求：
1. 先检查现有 Django app、models、urls、tests 和当前代码风格。
2. 按文档的统一实体命名和状态机实现，不得创造新核心状态。
3. 写操作必须放 service 层，view 不直接改业务状态。
4. 涉及钱包、支付、状态推进必须使用事务，并补测试。
5. 补 migrations、serializers、views、urls、tests、OpenAPI。
6. 运行相关测试；不能运行时说明原因和替代验证方式。
7. 最后按固定格式汇报。
```

## 开发任意前端任务

把 `[任务编号]` 替换成 `FEA-001`、`FEU-001`、`FEM-001` 等。

```text
请执行 ai-dev-baseline/09-agent-task-backlog.md 的 [任务编号]。

执行前必须阅读：
- ai-dev-baseline/13-integrated-product-spec.md
- ai-dev-baseline/14-module-implementation-spec.md
- ai-dev-baseline/04-api-database-contract.md
- ai-dev-baseline/15-frontend-style-from-screenshots-and-repro.md

要求：
1. 先检查现有路由、API client、组件库、状态管理和样式方案。
2. 必须实现 loading、empty、error、表单校验、权限/登录态处理。
3. 页面按钮必须按 02-domain-model-state-machines.md 的状态机显示。
4. 不复刻旧系统视觉、Logo、文案、图片、配色和精确布局。
5. 后台端优先高密度表格和详情操作；用户 Web 优先会员中心和业务闭环；移动 H5 优先底部五栏和触控操作。
6. 运行 lint/build；涉及关键链路时补 Playwright 或手工验收步骤。
7. 最后按固定格式汇报。
```

## 做端到端联调

```text
请执行 ai-dev-baseline/09-agent-task-backlog.md 的 E2E-001，并参考 ai-dev-baseline/16-end-to-end-agent-runbook.md。

目标流程：
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

要求：
1. 先确认测试账号、种子数据和启动命令。
2. 优先写可重复的 Playwright E2E；如果暂时不能自动化，写可复现手工脚本。
3. 发现缺口要列出阻塞项，不要跳过。
4. 完成后给出可复现命令和结果。
```

## 让 Agent 审查是否跑偏

```text
请以代码审查方式检查当前实现是否偏离 ai-dev-baseline/。

重点检查：
1. 是否违反 13-integrated-product-spec.md 的 MVP 范围。
2. 是否创造了未定义实体、状态或 API 风格。
3. 是否绕过 service 层修改状态。
4. 是否存在用户数据越权。
5. 是否存在财务事务或支付幂等问题。
6. 是否缺少后端测试、前端 build/lint 或 E2E 验收。
7. 前端是否复刻旧系统视觉、文案、Logo、图片或配色。
8. 是否只搭框架，没有端到端业务闭环。

请按严重程度列出问题，给出文件和行号，并说明最小修复建议。
```
