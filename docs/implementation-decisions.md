# 实施决策记录

本文用于补齐 `ai-dev-baseline` 中还未完全锁死的工程实施选择。除非用户明确批准，后续 Agent 不得擅自替换这些决策。

## 目标

- 第一版先交付单商户可用的端到端系统。
- 优先跑通集运主链路、最小代购链路、钱包支付和三端联调。
- 所有实现必须能追溯到 `docs/ai-dev-baseline/` 中的需求、状态机、API 或任务卡。
- 项目同时作为 AI 驱动全栈 ERP 开发证明：人类主要给目标、约束和验收，Agent 负责工程执行和证据记录。

## 已锁定选型

| 项 | 决策 | 理由 |
| --- | --- | --- |
| 项目形态 | monorepo | 后端、三端前端、共享类型和部署配置统一管理 |
| 后端框架 | Django + Django REST Framework | 适合 ERP、RBAC、事务和管理型系统 |
| 后端依赖管理 | `uv` + 项目本地 `.venv/` | 快速、可锁版本、不污染全局 Python 环境 |
| Python 版本 | Python 3.12+ | 与基线一致；如本机缺少 3.12，先确认后再由 `uv` 管理 |
| 数据库 | 当前唯一真实验证数据库为 SQLite；后续补 PostgreSQL/MySQL 配置兼容但不做真实验证 | 不干扰本机环境；未验证数据库能力不得写成生产可用 |
| 主键策略 | Django `BigAutoField` / bigint | 与 Django 默认一致，减少实现复杂度；业务单号另设字段 |
| 缓存和任务 | 当前使用本地内存/同步任务；后续补 Redis/Celery 配置但不做真实 Redis 验证 | 避免依赖本机服务，先完成业务和 API 基线 |
| API 风格 | REST + `/api/v1` | 与基线契约一致 |
| API 文档 | drf-spectacular / OpenAPI | 前端类型生成和 Agent 接力需要稳定 schema |
| 鉴权 | JWT，用户端和后台端登录域分离 | 匹配 `/api/v1/auth/login` 与 `/api/v1/admin/auth/login` |
| 后台前端 | React + Vite + TypeScript + Ant Design | 高密度表格、筛选、表单效率高 |
| 用户 Web | React + Vite + TypeScript + CSS Modules + shared tokens | 避免做成后台感，保持轻量 |
| 移动 H5 | React + Vite + TypeScript + Ant Design Mobile | 提供成熟移动组件，减少自研成本 |
| 前端路由 | React Router | 与 React/Vite 常规实践匹配，支持路由守卫和嵌套路由 |
| 前端包管理 | pnpm workspace | monorepo 下依赖复用清晰，当前本机已可用 |
| 请求层 | Axios + TanStack Query | Axios 负责 HTTP client，TanStack Query 负责缓存/加载/错误态 |
| 前端状态 | Zustand | 只承载登录态和轻量 UI 状态，不替代服务端缓存 |
| 样式策略 | `packages/ui-tokens` + CSS Modules；后台和移动端使用组件库主题 | 避免复刻旧系统视觉，保证三端基础一致 |
| 测试 | pytest、DRF APIClient、Vitest、Playwright | 覆盖后端、前端和端到端主链路 |
| 本地部署 | 当前暂不考虑 Docker；先做 no-Docker local-first | 用户明确要求暂不考虑 Docker，避免拉镜像和启动容器 |

## 路由约定

### 后端

- 所有 API 统一挂在 `/api/v1`。
- 后台 API 统一挂在 `/api/v1/admin/...`。
- 用户 Web 和移动 H5 共享用户端 API。
- 后台管理员 token 不直接访问用户私有接口，除非后台 API 显式提供代查能力。
- 每个 Django app 自己维护 `urls.py`，由 `backend/config/urls.py` 汇总。

### 前端

后台管理端：

```text
/login
/
/dashboard
/members
/warehouses
/parcels
/waybills
/finance
/purchases
/products
/audit
```

用户 Web：

```text
/login
/register
/dashboard
/warehouse-address
/parcels
/parcels/:id
/waybills
/waybills/:id
/wallet
/purchase-orders
/products
/cart
```

移动 H5：

```text
/login
/
/categories
/shipping
/shipping/parcels
/shipping/waybills
/cart
/me
```

前端页面不得直接拼接散落 URL。API 调用必须放在各 `features/<domain>/api.ts` 或共享 client 中。

## 当前 no-Docker 执行口径

- 不使用 Docker 作为当前开发和验证前提。
- 不启动本机 PostgreSQL/MySQL/Redis。
- `BE-001` 先用项目本地 `backend/db.sqlite3` 完成 Django/DRF、统一响应、OpenAPI 和测试基线。
- PostgreSQL/MySQL 只允许做配置层兼容，例如 settings/env/requirements extra，不做真实连接和迁移验证。
- Celery/Redis 相关配置先支持同步执行或延后接入；任何依赖 Redis 的功能必须标记当前验证边界。
- 所有依赖 PostgreSQL/MySQL/Redis 的能力，在完成真实环境验证前只能标记为 `configured_unverified`。

## AI 驱动开发执行口径

- 默认由 Agent 根据 `agent-execution/current-state.yaml` 和 `task-graph.yaml` 自主选择下一任务。
- 人类不逐步指定代码结构、接口实现或测试写法，除非涉及业务边界确认。
- 正式任务或阶段里程碑必须保留可审计摘要：任务 ID、关联规格、关键 Agent 决策、修改范围、验证结果、未验证边界、下一步。
- 建议每个正式任务 ID 最多在 `docs/agent-runs/` 下增加一份运行记录；维护性小修不单独记录。
- 运行记录保持摘要性质，不粘贴完整日志、完整 diff 或逐轮对话。
- 不得把人类未确认的规则写成最终业务规则；不得把未真实验证的配置写成已验证能力。

## 环境隔离

- 后端默认端口：`8000`。
- 后台端默认端口：`3001`。
- 用户 Web 默认端口：`3002`。
- 移动 H5 默认端口：`3003`。
- 不写入用户全局 shell 配置、全局 Python site-packages、全局 npm package。

## 待业务确认但不阻塞 P0 的事项

这些保持 `TODO_CONFIRM`，不得脑补成最终规则：

- 注册字段、验证码和找回密码策略。
- 计费公式细节。
- 首发国家、渠道和币种。
- 汇款审核流程。
- 无主包裹认领凭证。
- 真实打印模板。
- 线上支付回调。
- 淘宝/1688/拼多多等真实外部接口。

## 当前依赖风险

| 风险 | 影响 | 当前规避 |
| --- | --- | --- |
| SQLite 与 PostgreSQL/MySQL 行为差异 | 事务隔离、锁、JSON、大小写、索引、时间字段在不同数据库上可能表现不同 | 当前只声明 SQLite 已验证；跨库能力只配置不承诺 |
| `select_for_update` 和并发扣款 | SQLite 无法真实模拟行级锁，钱包支付幂等和余额扣减可能在生产库暴露并发问题 | service 层先写事务和幂等结构；真实数据库验证后再声明可靠 |
| MySQL 原生驱动 | `mysqlclient` 可能需要本机编译依赖；`PyMySQL` 行为和性能边界不同 | 当前不安装 MySQL 驱动；后续用 optional extra 管理 |
| PostgreSQL 驱动 | `psycopg` 配置简单，但未连接真实库就无法验证迁移和字段行为 | 当前不安装或不强依赖；后续用 optional extra 管理 |
| Redis 缺失 | 缓存、分布式锁、Celery broker、异步任务、限流不能真实验证 | 当前使用本地内存缓存和同步任务；禁止依赖 Redis 完成 P0 关键一致性 |
| Celery 异步边界 | 同步 eager 模式不能暴露序列化、重试、并发和 broker 故障问题 | 当前只用于保持接口形态；真实异步任务后续单独验证 |
| 文件存储 | 本地 `MEDIA_ROOT` 与对象存储/反向代理访问控制不同 | 当前仅支持本地文件；文件权限和对象存储后置 |
| 邮件/短信/验证码 | 真实通道需要账号、回调和风控 | 当前用 no-op/console backend；验证码规则保持 `TODO_CONFIRM` |
| 支付/物流/商品外部接口 | 真实接口涉及密钥、回调、签名、失败补偿 | P0 只做人工充值、余额支付、人工轨迹和手工代购 |
| Playwright 浏览器依赖 | 首次安装浏览器二进制会占用磁盘，也可能写缓存 | E2E 阶段再明确是否安装和清理策略 |
| Node/Python 版本 | 本机 `python3` 可能不是 3.12；Node 版本较新可能带来依赖兼容问题 | Python 由 `uv` 项目本地管理；前端依赖锁定后再验证 |

## 下一步

按 `docs/ai-dev-baseline/agent-execution/current-state.yaml` 推进。当前项目骨架完成后，下一任务是 `BE-001`：

```text
初始化 Django + DRF 后端，建立统一响应、错误、分页、OpenAPI 和测试基线。
```

当前执行约束：不使用 Docker，不启动 PostgreSQL/MySQL/Redis；验证以本地 `.venv`、SQLite 和 pytest 为主。PostgreSQL/MySQL/Redis 只做配置兼容，不做真实验证。
