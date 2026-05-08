# 11 AGENTS.md 模板

用途：未来创建真实代码仓库后，把本文件内容复制到项目根目录的 `AGENTS.md`。Codex 等 Agent 进入仓库时会优先读取它，从而保持开发规则一致。

以下为模板内容。创建真实代码仓库后，可以从下一行 `# AGENTS.md` 开始复制。

# AGENTS.md

## 项目目标

本项目是一个独立实现的跨境代购与集运 ERP。

第一版目标：

- 优先跑通集运主链路。
- 保留最小代购能力。
- 实现后台、用户 Web、移动 H5、后端 API、数据库、测试、部署文档的端到端交付。

不要把目标理解为复刻旧系统 UI 或把截图逐页重做。

## 必读文档

开发前必须阅读：

- `docs/ai-dev-baseline/agent-execution/README.md`
- `docs/ai-dev-baseline/agent-execution/current-state.yaml`
- `docs/ai-dev-baseline/agent-execution/task-graph.yaml`
- `docs/ai-dev-baseline/agent-execution/workflow-path.md`
- `docs/ai-dev-baseline/00-START-HERE-AI-ONE-STOP.md`
- `docs/ai-dev-baseline/README.md`
- `docs/ai-dev-baseline/12-source-evidence-map.md`
- `docs/ai-dev-baseline/13-integrated-product-spec.md`
- `docs/ai-dev-baseline/14-module-implementation-spec.md`
- `docs/ai-dev-baseline/02-domain-model-state-machines.md`
- `docs/ai-dev-baseline/03-technical-architecture.md`
- `docs/ai-dev-baseline/04-api-database-contract.md`
- `docs/ai-dev-baseline/15-frontend-style-from-screenshots-and-repro.md`
- `docs/ai-dev-baseline/06-agent-development-workflow.md`
- `docs/ai-dev-baseline/09-agent-task-backlog.md`
- `docs/ai-dev-baseline/16-end-to-end-agent-runbook.md`

如果当前仓库还没有 `docs/ai-dev-baseline/`，先从交接材料中复制该目录。

如果时间很紧，至少先读 `docs/ai-dev-baseline/agent-execution/README.md` 和 `docs/ai-dev-baseline/agent-execution/current-state.yaml`。不要只读截图分析或只读任务卡就开始写代码。

## 技术栈

默认技术栈：

- Backend：Python + Django + Django REST Framework
- Database：PostgreSQL
- Cache/Task：Redis + Celery
- Admin Web：React + Vite + Ant Design
- User Web：React + Vite
- Mobile H5：React + Vite
- API Doc：OpenAPI
- Test：pytest、Vitest、Playwright

不得在没有明确批准的情况下擅自替换核心技术栈。

## 开发原则

- 需求驱动：每个代码改动必须关联到需求、流程、API、数据模型或验收点。
- 目标导向：优先完成端到端闭环，不追求一次性堆满功能。
- 小步修改：一次任务只做一个明确模块。
- 先查后改：修改前先读取现有代码，不猜接口、不创造不存在的约定。
- 可验证：每次完成必须运行测试或给出手工验证步骤。
- 不脑补：遇到不确定业务规则，标记 `TODO_CONFIRM`。
- 证据优先：业务范围以 `13-integrated-product-spec.md` 和 `14-module-implementation-spec.md` 为准；需要追溯时再看 `12-source-evidence-map.md` 指向的 ChatGPT/Gemini 分析、截图和复现包。
- 一条龙交付：每个模块都要考虑后端、API、数据库、后台、用户 Web、移动 H5、测试、部署/文档，不接受只完成单层框架。
- 目录驱动：优先按 `agent-execution/current-state.yaml` 和 `agent-execution/task-graph.yaml` 执行，不要求人工复制提示词。

## MVP 范围

第一版 P0：

- 账号与权限
- 会员账号
- 仓库配置
- 基础配置
- 包裹预报
- 扫描入库
- 包裹管理
- 无主包裹简版
- 申请打包发货
- 运单管理
- 运费计算
- 钱包余额和余额支付
- 物流轨迹
- 最小代购
- 文件上传
- 审计日志

第一版不做：

- 旧系统 UI 复刻
- 自动采购
- 淘宝/1688/拼多多真实接口
- 多租户 SaaS
- 复杂微服务
- PDA/电子秤/打印机深度集成
- 推广返利
- 高级 BI

## 统一命名

必须使用：

- 包裹：`Parcel`
- 运单：`Waybill`
- 代购订单：`PurchaseOrder`
- 钱包：`Wallet`
- 钱包流水：`WalletTransaction`
- 支付单：`PaymentOrder`
- 物流轨迹：`TrackingEvent`

避免混用：

- 不用 `Package` 表示包裹。
- 不用 `Shipment` 表示运单。
- 不用 `ProxyOrder` 表示代购订单。
- 不用 `BalanceLedger` 表示钱包流水。

## 状态机

状态机以 `docs/ai-dev-baseline/02-domain-model-state-machines.md` 为准。

规则：

- 不得随意新增核心状态。
- 状态变化必须通过 service 层。
- 非法状态流转返回 `STATE_CONFLICT`。
- 前端按钮必须按状态机控制显示。

## 后端规则

后端采用 Django apps 分层：

```text
backend/apps/
  common/
  iam/
  members/
  warehouses/
  parcels/
  waybills/
  purchases/
  products/
  finance/
  content/
  tickets/
  files/
  audit/
```

每个业务 app 建议包含：

```text
models.py
enums.py
selectors.py
services.py
serializers.py
views.py
urls.py
permissions.py
tests/
```

规则：

- 写操作放 `services.py`。
- 查询组合放 `selectors.py`。
- View 不直接写复杂业务逻辑。
- 财务、支付、状态流转必须使用事务。
- 后台关键操作写 `AuditLog`。

## API 规则

- 统一前缀：`/api/v1`
- 后台接口：`/api/v1/admin/...`
- 成功响应：

```json
{"code":"OK","message":"success","data":{}}
```

- 错误响应：

```json
{"code":"VALIDATION_ERROR","message":"字段校验失败","data":{}}
```

- 列表分页必须返回 `items` 和 `pagination`。
- 金额字段用字符串或 decimal 序列化，不用 float。

## 前端规则

所有页面必须有：

- loading 状态
- empty 状态
- error 状态
- 表单校验
- 权限/登录态处理
- 状态按钮控制

不允许：

- 页面直接拼接散落 API URL。
- 每个页面重复写状态枚举。
- 复制旧系统 UI、图标、图片和文案。
- 复用 KINGANT/金蚁品牌、旧截图素材、旧配色和旧文案。

前端布局和交互参考 `docs/ai-dev-baseline/15-frontend-style-from-screenshots-and-repro.md`。它只提供可学习的信息架构和组件模式，不是视觉复刻稿。

## 测试规则

涉及以下内容必须写测试：

- 登录和权限
- 用户数据隔离
- 包裹状态机
- 运单状态机
- 钱包支付
- 重复支付幂等
- 后台关键操作

完成任务后优先运行：

```bash
pytest
npm run lint
npm run build
```

具体命令以当前仓库 README 为准。

## 每次任务完成汇报

请按此格式汇报：

```text
完成内容：
- 

修改文件：
- 

验证：
- 命令：
- 结果：

关联需求：
- 

待确认/风险：
- 

下一步：
- 
```
