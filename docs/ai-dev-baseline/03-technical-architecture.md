# 03 技术架构、技术选型与目录结构

## 总体架构

第一版采用模块化单体：

```text
三端前端
  -> REST API
  -> Django/DRF 模块化单体
  -> SQLite（当前唯一真实验证）
  -> PostgreSQL/MySQL（目标数据库配置边界，configured_unverified）
  -> Redis/Celery（目标缓存/任务配置边界，configured_unverified）
  -> 本地文件存储（对象存储后续）
```

选择模块化单体的原因：

- 第一版最重要的是跑通业务闭环，不是分布式架构。
- 新手实习生更容易理解和调试。
- Codex 等 Agent 更容易在单一上下文内维护领域模型和状态机。
- 后续如果业务变大，可以按模块拆服务。

## 推荐技术栈

| 层 | 推荐 | 原因 |
| --- | --- | --- |
| 后端语言 | Python 3.12+ | 用户常用 Python，新手友好 |
| 后端框架 | Django + Django REST Framework | 适合 ERP、RBAC、后台、事务、管理型系统 |
| 数据库 | SQLite first；PostgreSQL/MySQL target | 当前只真实验证 SQLite；PostgreSQL/MySQL 先做 DSN 配置边界检查 |
| 缓存/队列 | 本地内存 first；Redis target | 当前不启动 Redis，后续真实验证后再启用 |
| 异步任务 | 同步 eager first；Celery target | 当前关键链路不依赖异步任务，Celery/Redis 只标记 `configured_unverified` |
| API 文档 | drf-spectacular / OpenAPI | 方便前端和 Agent 接力 |
| 后台前端 | React + Vite + Ant Design | 后台表格/筛选/表单效率高 |
| 用户 Web | React + Vite | 第一版无需强 SEO，可快速开发 |
| 移动 H5 | React + Vite + mobile component library | 与 Web 技术栈复用 |
| 表单 | React Hook Form + Zod | 表单复杂、校验清晰 |
| 请求 | TanStack Query + Axios/fetch wrapper | 缓存、加载态、错误态统一 |
| 状态管理 | Zustand | 轻量，适合登录态和 UI 状态 |
| 测试 | pytest、DRF APIClient、system Chrome CDP smoke | 当前不下载浏览器；Playwright/视觉回归后续 |
| 部署 | no-Docker local-first；Docker 后续 | 当前用户明确暂不考虑 Docker |

## 备选但不推荐第一版使用

| 方案 | 为什么暂不推荐 |
| --- | --- |
| 微服务 | 增加部署、链路追踪、事务和联调复杂度 |
| Kubernetes | 第一版环境成本过高 |
| FastAPI 全栈 | 可以做，但 RBAC、后台管理、ORM 事务需要更多自建 |
| 多端原生 App | 第一版 H5 更快，业务验证后再说 |
| GraphQL | 当前主要是 CRUD 和流程状态，REST 更直接 |

## 推荐仓库结构

如果从零创建项目，建议使用 monorepo：

```text
crossborder-erp/
  README.md
  AGENTS.md
  docker-compose.yml
  .env.example
  docs/
    ai-dev-baseline/
    api/
    deployment/
  backend/
    manage.py
    pyproject.toml
    config/
      settings/
        base.py
        local.py
        production.py
      urls.py
      celery.py
      asgi.py
      wsgi.py
    apps/
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
      common/
    tests/
  admin-web/
    package.json
    src/
      app/
      pages/
      features/
      components/
      api/
      routes/
      stores/
      types/
      styles/
  user-web/
    package.json
    src/
      app/
      pages/
      features/
      components/
      api/
      routes/
      stores/
      types/
      styles/
  mobile-h5/
    package.json
    src/
      app/
      pages/
      features/
      components/
      api/
      routes/
      stores/
      types/
      styles/
  packages/
    openapi/
    shared-types/
    ui-tokens/
  infra/
    docker/
    nginx/
    scripts/
```

## 后端模块职责

| Django app | 职责 |
| --- | --- |
| `common` | 统一响应、异常、分页、基类、枚举、工具 |
| `iam` | 管理员、角色、权限、后台认证 |
| `members` | 用户、会员资料、用户认证、地址 |
| `warehouses` | 仓库、仓库地址、国家地区、库位基础 |
| `parcels` | 包裹预报、入库、无主包裹、包裹图片 |
| `waybills` | 运单、打包、发货、轨迹、渠道、费用 |
| `purchases` | 代购订单、采购任务、到货转包裹 |
| `products` | 商品、分类、SKU、购物车 |
| `finance` | 钱包、流水、支付单、充值、扣款 |
| `content` | 帮助、公告、协议、静态内容 |
| `tickets` | 留言、客服、工单 |
| `files` | 文件上传、访问控制、文件元数据 |
| `audit` | 审计日志、操作记录 |

## 后端分层规则

每个业务模块建议结构：

```text
apps/parcels/
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

- `models.py` 只放数据结构和轻量方法。
- `services.py` 放写操作和状态流转，例如入库、申请打包。
- `selectors.py` 放查询组合，避免 View 里写复杂查询。
- `serializers.py` 放输入输出校验。
- `views.py` 只做请求解析、权限、调用 service/selector。
- 状态机变化必须走 service，不能在 View 或 serializer 里直接改状态。
- 财务扣款、状态变更、包裹归属必须使用数据库事务。

## 前端模块结构

以 `admin-web` 为例：

```text
src/
  app/
    App.tsx
    providers.tsx
  api/
    client.ts
    errors.ts
  routes/
    index.tsx
    guards.tsx
  features/
    auth/
    dashboard/
    members/
    warehouses/
    parcels/
    waybills/
    purchases/
    products/
    finance/
    content/
    audit/
  components/
    layout/
    data-table/
    forms/
    status-tag/
    upload/
    empty-state/
  stores/
  types/
  styles/
```

规则：

- 每个 `features/<domain>` 只负责一个业务域。
- API 调用集中在 `features/<domain>/api.ts`。
- 状态枚举从共享类型或 OpenAPI 生成，不手写多份。
- 页面组件不直接拼接 API URL。
- 表格筛选、分页、错误态、空态使用统一组件。

## 三端复用策略

| 内容 | 复用方式 |
| --- | --- |
| API 类型 | OpenAPI 生成 TypeScript 类型 |
| 状态枚举 | 后端 OpenAPI 输出，前端生成 |
| UI token | `packages/ui-tokens` 共享颜色、间距、字号 |
| 业务文案 | 第一版先各端维护，后续抽语言包 |
| 请求 client | 三端各自封装，但响应格式一致 |
| 登录态 | 用户 Web 和 mobile H5 可共享策略，后台独立 |

## 环境规划

| 环境 | 用途 |
| --- | --- |
| local | 实习生和 Agent 本地开发 |
| test | 自动化测试和集成测试 |
| staging | 演示和验收 |
| production | 正式部署 |

第一版至少要有 local 和 staging。

## 配置约定

必须提供 `.env.example`：

```text
DJANGO_SECRET_KEY=dev-secret
DATABASE_URL=sqlite:///./backend/db.sqlite3
# DATABASE_URL=postgres://erp:erp@localhost:5432/erp
# DATABASE_URL=mysql://erp:erp@localhost:3306/erp
REDIS_URL=
# REDIS_URL=redis://localhost:6379/0
CELERY_TASK_ALWAYS_EAGER=true
MEDIA_ROOT=/app/media
PUBLIC_BASE_URL=http://localhost:8000
ADMIN_WEB_URL=http://localhost:3001
USER_WEB_URL=http://localhost:3002
MOBILE_H5_URL=http://localhost:3003
```

可用 `npm run inspect:services` 检查 SQLite/PostgreSQL/MySQL/Redis/Celery 的 DSN 配置边界。该命令不执行 Django setup，不安装驱动，不打开外部连接；PostgreSQL/MySQL/Redis/Celery 在真实验证前只能标记为 `configured_unverified`。

## 种子数据要求

本地开发必须能一键创建：

- 超级管理员：`admin@example.com / password123`
- 仓库人员：`warehouse@example.com / password123`
- 财务人员：`finance@example.com / password123`
- 采购人员：`buyer@example.com / password123`
- 测试用户：`user@example.com / password123`
- 测试仓库：深圳仓、北京仓
- 测试渠道：测试空运、测试海运
- 测试包装：纸箱、编织袋
- 测试增值服务：拍照、加固、防水

## 本地启动目标

最终 README 应支持类似命令：

```bash
docker compose up -d postgres redis
cd backend
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
cd ../admin-web && npm install && npm run dev
cd ../user-web && npm install && npm run dev
cd ../mobile-h5 && npm install && npm run dev
```

是否使用 `uv`、`poetry`、`pip-tools` 可由实施者确认，但必须在 README 固化一种方式。
