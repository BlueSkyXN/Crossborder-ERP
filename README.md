# CrossBorder ERP

本项目是一个独立实现的跨境代购与集运 ERP。第一版目标是跑通集运主链路、最小代购链路、钱包支付、三端联调、测试和部署交付。

本项目同时用于证明：复杂 ERP 全栈系统可以在极低人工介入下，由 AI Agent 按规格、任务图、测试和交付证据持续推进。证明口径见 `docs/ai-development-proof.md`。

## 当前状态

- 项目阶段：`P6_PRODUCTION_GAP`
- 当前已完成：SQLite-first P0 主链路、`AUDIT-001` 差距地图、`ADDR-001` 地址簿、`FILE-001` 本地文件服务、`FIN-001` 线下汇款与财务中心、`MSG-001` 客服消息与工单入口、`MEMBER-001` 后台会员管理增强、`PARCEL-CLAIM-001` 无主包裹用户认领
- 下一任务：`CONTENT-001` 内容 CMS
- 规格入口：`docs/ai-dev-baseline/agent-execution/README.md`
- 实施决策：`docs/implementation-decisions.md`
- AI 驱动证明：`docs/ai-development-proof.md`
- 演示脚本：`docs/demo-script.md`
- 部署说明：`docs/deployment/README.md`
- 已知问题和下一阶段：`docs/known-issues-and-roadmap.md`

## 隔离原则

为避免干扰本机环境，本项目默认遵守：

- 不安装全局 Python 或 Node 依赖。
- Python 依赖使用项目本地 `.venv/`。
- Node 依赖安装在本项目目录内的 `node_modules/`。
- 当前阶段暂不考虑 Docker。
- 当前阶段不依赖本机 PostgreSQL/MySQL/Redis；后端基础开发先用项目本地 SQLite 文件和同步任务模式承接。
- 不自动启动数据库、Redis 或前端开发服务器，除非任务明确需要验证。

## 技术栈

| 层 | 选型 |
| --- | --- |
| Backend | Python 3.12+、Django、Django REST Framework |
| Backend dependency | `uv`，项目本地 `.venv/` |
| Database | SQLite first；PostgreSQL/MySQL 配置兼容后置且暂不真实验证 |
| Cache/Task | 本地内存/同步任务 first；Redis/Celery 配置后置且暂不真实验证 |
| API Doc | drf-spectacular / OpenAPI |
| Admin Web | React + Vite + TypeScript + Ant Design |
| User Web | React + Vite + TypeScript + CSS Modules + shared tokens |
| Mobile H5 | React + Vite + TypeScript + Ant Design Mobile |
| Frontend routing | React Router |
| Frontend package manager | pnpm workspace |
| Request/data | TanStack Query + Axios |
| State | Zustand |
| Test | pytest、DRF APIClient、`npm run e2e`；Vitest/Playwright 后续补齐 |
| Deploy | 暂缓，当前阶段 no-Docker local-first |

## 目录结构

```text
backend/        Django/DRF 后端
admin-web/      后台管理端
user-web/       用户 Web
mobile-h5/      移动 H5
packages/       OpenAPI 类型、共享类型、UI token
docs/           规格、实施决策、部署文档
infra/          后续部署、Nginx、脚本
```

## 本地端口

为避免占用常见默认端口，开发环境使用：

| 服务 | 地址 |
| --- | --- |
| Backend | `http://localhost:8000` |
| Admin Web | `http://localhost:3001` |
| User Web | `http://localhost:3002` |
| Mobile H5 | `http://localhost:3003` |
| Local DB | `backend/db.sqlite3` |
| Redis/Celery | 当前阶段同步/禁用外部 Redis |

## 本地启动

当前交付口径是 no-Docker local-first。首次启动建议按下面顺序执行：

```bash
(cd backend && uv sync --locked --dev)
pnpm install --frozen-lockfile
(cd backend && uv run python manage.py migrate)
(cd backend && uv run python manage.py seed_demo)
```

启动后端和三端前端：

```bash
(cd backend && uv run python manage.py runserver)
pnpm --filter admin-web dev
pnpm --filter user-web dev
pnpm --filter mobile-h5 dev
```

访问地址：

| 端 | 地址 |
| --- | --- |
| Backend API | `http://localhost:8000/api/v1` |
| OpenAPI | `http://localhost:8000/api/v1/schema/` |
| Swagger UI | `http://localhost:8000/api/v1/docs/` |
| Admin Web | `http://localhost:3001` |
| User Web | `http://localhost:3002` |
| Mobile H5 | `http://localhost:3003` |

PostgreSQL/MySQL/Redis/Docker 相关配置在后续明确需要时再引入；在真实环境验证前只标记为配置兼容或 `configured_unverified`。

## 环境变量

复制 `.env.example` 到 `.env` 后可按需调整。当前本地默认使用 SQLite 和同步任务模式：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | dev secret | 本地开发密钥，生产必须替换 |
| `DJANGO_DEBUG` | `true` | 本地调试开关 |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Django host allowlist |
| `DATABASE_URL` | `sqlite:///./backend/db.sqlite3` | 当前唯一真实验证数据库 |
| `REDIS_URL` | 空 | Redis 后续补齐，当前不真实验证 |
| `CELERY_TASK_ALWAYS_EAGER` | `true` | 当前同步执行任务 |
| `MEDIA_ROOT` | `./media` | 本地文件存储目录 |
| `PUBLIC_BASE_URL` | `http://localhost:8000` | 后端公开访问基址 |
| `ADMIN_WEB_URL` | `http://localhost:3001` | 后台管理端地址 |
| `USER_WEB_URL` | `http://localhost:3002` | 用户 Web 地址 |
| `MOBILE_H5_URL` | `http://localhost:3003` | 移动 H5 地址 |

## 测试账号

`seed_demo` 会创建以下账号：

| 类型 | 邮箱 | 密码 | 用途 |
| --- | --- | --- | --- |
| Admin | `admin@example.com` | `password123` | 超级管理员，完整后台验收 |
| Warehouse | `warehouse@example.com` | `password123` | 仓库人员，包裹/运单操作 |
| Finance | `finance@example.com` | `password123` | 财务人员，充值/流水查看 |
| Buyer | `buyer@example.com` | `password123` | 采购人员，商品/代购操作 |
| Support | `support@example.com` | `password123` | 客服人员，工单处理 |
| Member | `user@example.com` | `password123` | 会员用户，三端用户侧验收 |

## 测试命令

```bash
npm run e2e
(cd backend && uv run python manage.py check)
(cd backend && uv run python manage.py makemigrations --check --dry-run)
(cd backend && uv run pytest)
pnpm lint
pnpm build
```

当前 CI 会在 PR 和 `main` push 上执行后端 check/OpenAPI/pytest，以及三端前端 lint/build。

## 端到端验收

`E2E-001` 固化了 no-Docker、SQLite-first 的可重复验收命令：

```bash
npm run e2e
```

该命令会通过 `uv run pytest tests/e2e/test_p0_flow.py -s` 自动跑通：

- 后台确认仓库、渠道、包装和增值服务 demo 配置。
- 用户登录并读取专属仓库地址。
- 用户提交包裹预报，后台扫描入库。
- 用户申请打包，后台审核、设置费用、提交线下汇款并由后台审核入账。
- 用户余额支付，后台发货并添加轨迹。
- 用户查询轨迹并确认收货到 `SIGNED`。
- 用户提交手工代购，后台审核、采购、到货并转为 `Parcel.IN_STOCK`。
- 代购转入包裹后继续申请打包创建运单。
- 用户提交消息工单和附件，后台客服回复后用户端可读取。
- 后台会员管理可筛选会员、维护等级/客服备注、冻结/解冻并重置测试密码。
- 后台扫描未知单号生成无主包裹，用户端只看到脱敏单号并提交认领，后台审核通过后转为会员在库包裹。

如需浏览器手工复现三端界面，先启动后端和三端前端：

```bash
(cd backend && uv run python manage.py migrate)
(cd backend && uv run python manage.py seed_demo)
(cd backend && uv run python manage.py runserver)
pnpm --filter admin-web dev
pnpm --filter user-web dev
pnpm --filter mobile-h5 dev
```

访问地址：

| 端 | 地址 |
| --- | --- |
| Admin Web | `http://localhost:3001` |
| User Web | `http://localhost:3002` |
| Mobile H5 | `http://localhost:3003` |

当前没有引入 Playwright 项目依赖；`npm run e2e` 先覆盖 API 级完整业务闭环，三端浏览器路径按上述启动命令和既有页面入口手工复现。若命令失败，脚本会打印阻塞提示，优先查看 pytest 断言和最近一次 API response body。

## 演示流程

完整演示步骤见 `docs/demo-script.md`。主线包括：

```text
后台确认配置
-> 用户复制仓库地址
-> 用户提交包裹预报
-> 后台扫描入库
-> 用户申请打包
-> 后台审核计费
-> 用户提交线下汇款，后台审核入账
-> 用户余额支付
-> 后台发货并添加轨迹
-> 用户查看轨迹并确认收货
-> 用户提交手工代购
-> 后台采购到货并转包裹
-> 代购包裹继续申请打包
```

## 已知边界

- 真实在线支付、支付回调、退款和对账不在 P0 范围；当前支持后台人工充值、用户线下汇款提交、财务人工审核入账和余额支付。
- 自动采购、商品链接解析、外部电商抓取不在 P0 范围；当前支持自营商品和手工代购。
- PostgreSQL/MySQL/Redis/Celery/Docker 均未真实验证，不能作为生产可用结论。
- 本地文件上传、元数据、鉴权下载、包裹图片、线下汇款凭证和消息附件引用已完成；对象存储、缩略图、文件安全扫描、打印模板和硬件接入后续补齐。
- 后台会员管理已可真实操作会员状态和服务信息；复杂 CRM、自动客服分配、最终会员等级规则仍需业务确认。
- 无主包裹认领已支持脱敏列表、用户认领和后台人工审核；认领凭证规则、争议处理和通知外呼仍需业务确认。
- 复杂运费公式、首发国家/渠道、验证码、找回密码、多语言等保留 `TODO_CONFIRM`。
