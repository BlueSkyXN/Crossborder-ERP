# CrossBorder ERP

本项目是一个独立实现的跨境代购与集运 ERP。第一版目标是跑通集运主链路、最小代购链路、钱包支付、三端联调、测试和部署交付。

本项目同时用于证明：复杂 ERP 全栈系统可以在极低人工介入下，由 AI Agent 按规格、任务图、测试和交付证据持续推进。证明口径见 `docs/ai-development-proof.md`。

## 当前状态

- 项目阶段：`P3_WAYBILL_FINANCE`
- 当前已完成：`FEU-001C` 用户 Web 运单申请、余额支付、轨迹和确认收货
- 下一任务：`FEM-001C` 移动 H5 运单列表、追踪、确认收货
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
cd backend && uv run python manage.py migrate
cd backend && uv run python manage.py seed_demo
cd backend && uv run python manage.py runserver
pnpm --filter admin-web dev
pnpm --filter user-web dev
pnpm --filter mobile-h5 dev
```

实际可运行命令以每个任务完成后的 README 更新为准。PostgreSQL/MySQL/Redis/Docker 相关配置在后续明确需要时再引入；在真实环境验证前只标记为配置兼容。
