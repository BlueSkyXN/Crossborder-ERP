# AGENTS.md

## 项目目标

本项目是一个独立实现的跨境代购与集运 ERP。

本项目还用于证明：复杂 ERP 全栈系统可以在极低人工介入下，由 AI Agent 持续完成规格阅读、任务拆解、代码实现、测试验证、文档记录和交付推进。

第一版目标：

- 跑通集运主链路。
- 保留最小代购能力。
- 实现后台、用户 Web、移动 H5、后端 API、数据库、测试、部署文档的端到端交付。
- 留下 AI 驱动开发证据，证明主要工程执行由 Agent 完成。

不要把目标理解为复刻旧系统 UI 或把截图逐页重做。

## 必读文档

开发前必须阅读：

- `docs/implementation-decisions.md`
- `docs/ai-development-proof.md`
- `docs/ai-dev-baseline/agent-execution/README.md`
- `docs/ai-dev-baseline/agent-execution/current-state.yaml`
- `docs/ai-dev-baseline/agent-execution/task-graph.yaml`
- `docs/ai-dev-baseline/00-START-HERE-AI-ONE-STOP.md`
- `docs/ai-dev-baseline/13-integrated-product-spec.md`
- `docs/ai-dev-baseline/14-module-implementation-spec.md`
- `docs/ai-dev-baseline/02-domain-model-state-machines.md`
- `docs/ai-dev-baseline/03-technical-architecture.md`
- `docs/ai-dev-baseline/04-api-database-contract.md`
- `docs/ai-dev-baseline/15-frontend-style-from-screenshots-and-repro.md`

## 实施决策

已锁定：

- Backend：Python 3.12+、Django、Django REST Framework
- Backend dependency：`uv` + project-local `.venv/`
- Database：SQLite first；PostgreSQL/MySQL 仅后续配置兼容，未真实验证前不得声明已支持
- Cache/Task：本地内存/同步任务 first；Redis/Celery 仅后续配置兼容，未真实验证前不得声明已支持
- API Doc：drf-spectacular / OpenAPI
- Admin Web：React + Vite + TypeScript + Ant Design
- User Web：React + Vite + TypeScript + CSS Modules + shared tokens
- Mobile H5：React + Vite + TypeScript + Ant Design Mobile
- Frontend router：React Router
- Frontend package manager：pnpm workspace
- Request/data：TanStack Query + Axios
- State：Zustand
- Primary key：Django `BigAutoField` / bigint
- Test：pytest、DRF APIClient、Vitest、Playwright

不得在没有明确批准的情况下擅自替换核心技术栈或上述工程决策。

## 开发原则

- AI 主导：人类主要提供目标、约束、验收和业务确认；Agent 负责技术方案、实现、测试和文档。
- 需求驱动：每个代码改动必须关联到需求、流程、API、数据模型或验收点。
- 目标导向：优先完成端到端闭环，不追求一次性堆满功能。
- 小步修改：一次任务只做一个明确模块。
- 先查后改：修改前先读取现有代码，不猜接口、不创造不存在的约定。
- 可验证：每次完成必须运行测试或给出手工验证步骤。
- 不脑补：遇到不确定业务规则，标记 `TODO_CONFIRM`。
- 目录驱动：优先按 `agent-execution/current-state.yaml` 和 `agent-execution/task-graph.yaml` 执行。
- 证据留存：正式任务或阶段里程碑完成后保留简明摘要；不记录逐轮对话、完整日志或细碎维护动作。

## 环境隔离

- 不安装全局 Python 或 Node 依赖。
- Python 依赖只进入项目本地 `.venv/`。
- Node 依赖只进入项目本地 `node_modules/`。
- 当前阶段暂不考虑 Docker。
- 当前阶段不启动本机 PostgreSQL/MySQL/Redis，后端基础开发先用项目本地 SQLite 和同步任务模式。
- 未经明确任务要求，不启动长期运行的服务。

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
- 用户 Web 和移动 H5 共用用户端 API。
- 成功响应：`{"code":"OK","message":"success","data":{}}`
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
pnpm lint
pnpm build
```

具体命令以当前仓库 README 为准。
