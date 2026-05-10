# 下一阶段目标架构

本文件定义下一阶段程序架构和设计原则。核心判断：当前系统适合渐进式生产化，不适合推倒重写。

## 架构总原则

目标架构：

```text
Admin Web / User Web / Mobile H5
        |
        v
Django + DRF modular monolith
        |
        v
Providers and infrastructure adapters
```

原则：

1. 保留 Django monolith。
2. 按领域 app 渐进整理，不做一次性全仓重排。
3. 状态机、金额变更、权限判断和审计在后端收敛。
4. 外部系统必须经 provider 接口，不允许在 view、serializer、page 中散落硬编码。
5. 每个 provider 至少包含 disabled/local/fake 之一，真实 sandbox/production 单独验证。
6. 未验证能力必须明确状态，不得写成已完成。
7. 前端保持三端产品形态，不复刻旧系统 UI。

## 当前结构事实

当前后端已按 Django apps 拆分：

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
  addresses/
  regions/
```

当前前端已存在：

```text
admin-web/
user-web/
mobile-h5/
```

当前验证体系包括：

```text
pytest
npm run e2e
npm run e2e:browser
pnpm lint
pnpm build
npm run evidence
```

## 后端目标分层

后续新增或重构 app 时，优先采用以下分层。现有 app 不要求一次性改完，只在任务涉及范围内小步迁移。

```text
backend/apps/<domain>/
  models.py
  enums.py
  selectors.py
  services.py 或 services/
  providers/
  serializers.py
  views.py
  urls.py
  permissions.py
  tests/
```

职责说明：

| 层 | 职责 |
| --- | --- |
| `models.py` | 数据模型、约束、索引、轻量领域属性 |
| `enums.py` | 状态、类型、渠道等枚举 |
| `selectors.py` | 读查询、列表筛选、权限内数据范围 |
| `services.py` | 写操作、状态变化、事务、幂等、审计触发 |
| `providers/` | 外部系统适配，包含 disabled/local/fake/sandbox/production |
| `serializers.py` | 输入输出校验和字段序列化 |
| `views.py` | HTTP 边界、权限、调用 selectors/services |
| `permissions.py` | 权限码、对象权限、后台 action 权限 |
| `tests/` | 单元、API、状态机、权限、并发或 provider 测试 |

重构规则：

- 先选低风险 app 做样板，例如 `content`、`addresses`、`regions`。
- 不先动 `finance`、`waybills`、`parcels` 等高风险主链路 app。
- 保持 URL、响应结构和前端行为兼容，除非任务明确要求破坏性变更。
- 每次移动逻辑必须增加或保留测试证明行为不变。

## Provider 架构

统一 provider 状态：

| 状态 | 含义 |
| --- | --- |
| `disabled` | 功能关闭，调用时返回明确错误 |
| `local` | 本地实现，可用于 SQLite/local 验证 |
| `fake` | 测试或演示实现，可预测、无外部连接 |
| `configured_unverified` | 配置存在，但未真实连接或未跑验收 |
| `sandbox_verified` | 第三方沙箱或 staging 验证完成 |
| `production_verified` | 生产真实验证完成 |

Provider 最低接口要求：

```text
code
status
validate_configuration()
health_check()
```

外部领域建议：

| 领域 | 目标目录 | 初始实现 |
| --- | --- | --- |
| Storage | `backend/apps/files/providers/storage/` | `LocalStorageProvider`、`DisabledStorageProvider`、`FakeObjectStorageProvider` |
| Virus scan | `backend/apps/files/providers/virus_scan/` | `DisabledVirusScanProvider`、`FakeVirusScanProvider` |
| Payment | `backend/apps/finance/providers/payments/` | `OfflinePaymentProvider`、`FakePaymentProvider`、`DisabledPaymentProvider` |
| Logistics | `backend/apps/waybills/providers/logistics/` | `ManualLogisticsProvider`、`FakeLogisticsProvider`、`DisabledLogisticsProvider` |
| Notification | `backend/apps/common/notifications/` 或 `backend/apps/notifications/` | `DisabledNotificationProvider`、`ConsoleNotificationProvider`、`FakeNotificationProvider` |
| Procurement | `backend/apps/purchases/providers/procurement/` | `ManualProcurementProvider`、`DisabledProcurementProvider` |
| Observability | `backend/apps/common/observability/` | disabled/local logging、可选 Sentry adapter |

## 数据和运行时架构

下一阶段目标不是删除 SQLite，而是明确生产目标验证层：

| 层 | 当前口径 | 下一阶段目标 |
| --- | --- | --- |
| SQLite | local verified | 继续作为本地开发和轻量验收 |
| PostgreSQL | configured_unverified | 真实连接、迁移、pytest、E2E、并发钱包验证 |
| MySQL | configured_unverified | 除非明确需要，否则保持后置 |
| Redis/Celery | configured_unverified | 真实 broker 和异步任务验证 |
| Docker | 当前暂缓 | 只有用户确认后进入任务 |
| Staging | not_implemented | no-Docker 或 Docker 二选一，必须真实验收 |

## 前端目标分层

现有三端已按 `features`、`pages`、`api` 分散组织。下一阶段不要重写 UI，只做可维护性增强。

建议结构：

```text
src/
  app/
  routes/
  api/
  features/<domain>/
    api.ts
    types.ts
    components/
    pages/
  pages/
  styles/
```

规则：

- 页面不得直接拼接 API URL。
- 登录态、权限、loading、empty、error、表单校验必须保留。
- 后台高密度页面优先保持 Ant Design 表格和表单效率。
- 用户 Web 和 Mobile H5 共享接口契约，但不强行共享全部 UI。
- 引入组件测试、Playwright 或视觉回归前，先确认依赖和浏览器缓存策略。

## 架构决策

后续可补 ADR，但当前先锁定以下决策：

| ADR | 决策 |
| --- | --- |
| ADR-0001 | 保留 Django modular monolith，不拆微服务 |
| ADR-0002 | 外部依赖必须 provider 化 |
| ADR-0003 | 生产目标数据库优先 PostgreSQL，SQLite 仅作为 local-first |
| ADR-0004 | 不做 big-bang refactor |
| ADR-0005 | 未验证能力必须用状态标记，不得宣传完成 |

## 回滚原则

- 文档任务可直接 revert 文档变更。
- 架构样板重构必须保持小范围，出现主链路失败先回滚重构，不继续扩大。
- provider 抽象必须默认保持当前 local 行为，不能因为真实 provider 未配置导致本地主链路不可用。
- production settings 不能破坏 local/test 默认启动。
