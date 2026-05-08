# CrossBorder ERP

本项目是一个独立实现的跨境代购与集运 ERP。第一版目标是跑通集运主链路、最小代购链路、钱包支付、三端联调、测试和部署交付。

本项目同时用于证明：复杂 ERP 全栈系统可以在极低人工介入下，由 AI Agent 按规格、任务图、测试和交付证据持续推进。证明口径见 `docs/ai-development-proof.md`。

## 当前状态

- 项目阶段：`P5_DELIVERY`
- 当前已完成：`E2E-001` 全链路端到端验收
- 下一任务：`DOC-001` 交付文档收口
- 规格入口：`docs/ai-dev-baseline/agent-execution/README.md`
- 实施决策：`docs/implementation-decisions.md`
- AI 驱动证明：`docs/ai-development-proof.md`

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
| Test | pytest、DRF APIClient、Vitest、Playwright |
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

## 后续启动目标

当前后端、后台管理端和用户 Web 已具备基础开发入口。常用本地命令：

```bash
(cd backend && uv run python manage.py migrate)
(cd backend && uv run python manage.py seed_demo)
(cd backend && uv run python manage.py runserver)
pnpm --filter admin-web dev
pnpm --filter user-web dev
pnpm --filter mobile-h5 dev
```

实际可运行命令以每个任务完成后的 README 更新为准。PostgreSQL/MySQL/Redis/Docker 相关配置在后续明确需要时再引入；在真实环境验证前只标记为配置兼容。

## 端到端验收

`E2E-001` 固化了 no-Docker、SQLite-first 的可重复验收命令：

```bash
npm run e2e
```

该命令会通过 `uv run pytest tests/e2e/test_p0_flow.py -s` 自动跑通：

- 后台确认仓库、渠道、包装和增值服务 demo 配置。
- 用户登录并读取专属仓库地址。
- 用户提交包裹预报，后台扫描入库。
- 用户申请打包，后台审核、设置费用、充值。
- 用户余额支付，后台发货并添加轨迹。
- 用户查询轨迹并确认收货到 `SIGNED`。
- 用户提交手工代购，后台审核、采购、到货并转为 `Parcel.IN_STOCK`。
- 代购转入包裹后继续申请打包创建运单。

验收账号：

| 类型 | 邮箱 | 密码 |
| --- | --- | --- |
| Admin | `admin@example.com` | `password123` |
| Member | `user@example.com` | `password123` |

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
