# CrossBorder ERP

本项目是一个独立实现的跨境代购与集运 ERP。第一版目标是跑通集运主链路、最小代购链路、钱包支付、三端联调、测试和部署交付。

本项目同时用于证明：复杂 ERP 全栈系统可以在极低人工介入下，由 AI Agent 按规格、任务图、测试和交付证据持续推进。证明口径见 `docs/ai-development-proof.md`。

## 当前状态

- 项目阶段：`P6_PRODUCTION_GAP`
- 当前已完成：SQLite-first P0 主链路、`AUDIT-001` 差距地图、`ADDR-001` 地址簿、`FILE-001` 本地文件服务、`FIN-001` 线下汇款与财务中心、`MSG-001` 客服消息与工单入口、`MEMBER-001` 后台会员管理增强、`PARCEL-CLAIM-001` 无主包裹用户认领、`CONTENT-001` 内容 CMS、`IMPORT-001` CSV 批量导入/导出基础、`IMPORT-XLSX-001` Excel `.xlsx` 批量预报解析、`QA-BROWSER-001` 三端浏览器 smoke、`QA-BROWSER-002` 浏览器真实包裹预报/入库旅程、`QA-BROWSER-003` Browser Smoke 稳定性加固、`CI-EVIDENCE-001` Agent 证据 CI 门禁、`SHIP-BATCH-001` 发货批次/转单/打印模板数据、`PAYABLE-001` 供应商/成本/应付基础、`GROWTH-001` 积分/推广/返利基础、`AUDITLOG-001` 后台操作审计日志、`AUDIT-RETENTION-001` 审计日志导出与本地留存命令、`SECURITY-HEADERS-001` 基础安全响应头、`OPS-READINESS-001` 运维 readiness 检查、`OPS-SQLITE-BACKUP-001` SQLite 本地备份命令、`STORAGE-CLEANUP-001` 本地软删除文件清理命令、`PURCHASE-AUTO-001` 外部商品链接解析入口、`ACCOUNT-SETTINGS-001` 会员注册与账户设置闭环、`ADMIN-PANELS-001` 后台 dashboard/roles 真实面板、`RBAC-ROLES-001` 角色创建/编辑/权限分配闭环、`RBAC-ADMIN-USERS-001` 管理员账号与角色分配闭环、`RBAC-BUSINESS-ACTIONS-001` 后台业务写操作权限拆分、`CONFIG-EXTERNAL-SERVICES-001` 外部服务 DSN 边界检查、`RBAC-DELETE-001` 角色与管理员安全删除闭环
- 下一任务：任务图暂无自动下一项；后续建议按生产化边界、需要业务确认的外部集成，以及更深浏览器/视觉/组件测试单独开任务
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
| Test | pytest、DRF APIClient、`npm run e2e`、system Chrome CDP browser smoke + journey |
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
| Local DB backups | `backend/backups/`，默认 ignored |
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
| Health | `http://localhost:8000/api/v1/health` |
| Readiness | `http://localhost:8000/api/v1/health/ready` |
| OpenAPI | `http://localhost:8000/api/v1/schema/` |
| Swagger UI | `http://localhost:8000/api/v1/docs/` |
| Admin Web | `http://localhost:3001` |
| User Web | `http://localhost:3002` |
| Mobile H5 | `http://localhost:3003` |

PostgreSQL/MySQL/Redis/Docker 相关能力在真实环境验证前只标记为配置兼容或 `configured_unverified`。当前已提供无连接配置检查脚本，可用于确认 DSN 解析边界，不会启动服务或打开外部连接。

## 环境变量

复制 `.env.example` 到 `.env` 后可按需调整。当前本地默认使用 SQLite 和同步任务模式：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | dev secret | 本地开发密钥，生产必须替换 |
| `DJANGO_DEBUG` | `true` | 本地调试开关 |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Django host allowlist |
| `DJANGO_SECURE_CONTENT_TYPE_NOSNIFF` | `true` | 输出 `X-Content-Type-Options: nosniff` |
| `DJANGO_SECURE_REFERRER_POLICY` | `same-origin` | 输出 `Referrer-Policy` |
| `DJANGO_SECURE_CROSS_ORIGIN_OPENER_POLICY` | `same-origin` | 输出 `Cross-Origin-Opener-Policy` |
| `DJANGO_X_FRAME_OPTIONS` | `DENY` | 输出 `X-Frame-Options` |
| `DJANGO_PERMISSIONS_POLICY` | `camera=(),microphone=(),geolocation=(),payment=(),usb=()` | 输出 `Permissions-Policy` |
| `DJANGO_SECURE_HSTS_SECONDS` | `0` | HSTS 仅在真实 HTTPS 环境确认后启用 |
| `DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS` | `false` | HSTS 子域策略，当前未验证 |
| `DJANGO_SECURE_HSTS_PRELOAD` | `false` | HSTS preload，当前未验证 |
| `DJANGO_SECURE_SSL_REDIRECT` | `false` | HTTPS redirect，当前本地 HTTP 验证不启用 |
| `DATABASE_URL` | `sqlite:///./backend/db.sqlite3` | 当前唯一真实验证数据库 |
| `REDIS_URL` | 空 | Redis DSN 可做配置检查，当前不真实验证 |
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

配置边界检查：

```bash
npm run inspect:services
DATABASE_URL='postgres://erp:secret@localhost:5432/crossborder' \
REDIS_URL='redis://localhost:6379/0' \
CELERY_TASK_ALWAYS_EAGER=false \
npm run inspect:services
```

`inspect:services` 不执行 Django setup，不安装数据库驱动，不连接 PostgreSQL/MySQL/Redis；它只输出 SQLite `verified_sqlite` 或 PostgreSQL/MySQL/Redis/Celery `configured_unverified`。

```bash
npm run e2e
npm run e2e:browser
npm run evidence
(cd backend && uv run python manage.py check)
(cd backend && uv run python manage.py makemigrations --check --dry-run)
(cd backend && uv run pytest)
pnpm lint
pnpm build
(cd backend && uv run python manage.py backup_sqlite --dry-run)
(cd backend && uv run python manage.py purge_deleted_files --older-than-days 30 --dry-run)
```

当前 CI 会在 PR 和 `main` push 上执行 Agent 证据门禁、后端 check/OpenAPI/pytest、三端前端 lint/build，以及 `Browser Smoke` 三端登录、关键页面 smoke 和一条浏览器真实包裹预报/入库旅程。

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
- 用户余额支付后，后台创建发货批次，生成面单/拣货单/交接清单模板数据，锁定后批量发货并批量追加轨迹。
- 用户查询轨迹并确认收货到 `SIGNED`。
- 用户提交手工代购，后台审核、采购、到货并转为 `Parcel.IN_STOCK`。
- 代购转入包裹后继续申请打包创建运单。
- 用户提交消息工单和附件，后台客服回复后用户端可读取。
- 后台会员管理可筛选会员、维护等级/客服备注、冻结/解冻并重置测试密码。
- 后台可登记邀请关系、返利记录和积分调整；用户端可读取积分、邀请码、邀请数和返利统计。
- 后台关键写操作会进入审计日志，后台可查询操作人、动作、对象、请求、状态和脱敏后的请求/响应数据。
- 后台可导出脱敏后的审计日志 CSV，并可用 `purge_audit_logs --older-than-days N --dry-run` 预演本地留存清理。
- 后端响应会输出基础安全 header：`nosniff`、`Referrer-Policy`、`Cross-Origin-Opener-Policy`、`X-Frame-Options` 和 `Permissions-Policy`；HSTS/TLS 仍需真实 HTTPS 环境确认后启用。
- 后端提供 `/api/v1/health/ready` readiness endpoint，当前检查默认数据库连接；失败时返回 503 且不暴露 DSN、异常堆栈或本地路径。
- 后端提供 `backup_sqlite` 显式本地备份命令，可用 `--dry-run` 预演并默认输出到 ignored 的 `backend/backups/`；它不替代 PostgreSQL/MySQL 生产备份策略。
- 后端提供 `purge_deleted_files` 显式本地文件清理命令，只处理已软删除且超过保留期的 `StoredFile` 物理文件；它不替代对象存储生命周期或病毒扫描。
- 用户端提供 `purchase-links/parse` 外部商品链接解析入口，可识别常见平台并转手工代购人工确认；不抓取真实第三方页面，也不声明自动下单完成。
- 后台扫描未知单号生成无主包裹，用户端只看到脱敏单号并提交认领，后台审核通过后转为会员在库包裹。
- 后台创建内容草稿，发布后用户端可读取帮助/公告/条款，隐藏后公开接口不可再读取。
- 用户上传 CSV 或 `.xlsx` 批量导入包裹预报，并验证用户/后台 CSV 导出。
- 主链路发货阶段会覆盖发货批次、转单号、承运商批次号、打印模板数据和批量发货幂等性。
- 后台创建供应商、成本类型和应付款，完成待审核、确认、核销状态流，并验证重复核销返回状态冲突。

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

`QA-BROWSER-001` 另固化了浏览器级 smoke：

```bash
npm run e2e:browser
```

该命令不新增 Playwright/Vitest 依赖，也不会下载浏览器二进制。它会：

- 使用系统 Chrome/Chromium；如系统路径不可发现，可设置 `BROWSER_E2E_CHROME`。
- 在 `.tmp/browser-e2e/` 下创建临时 SQLite、media、日志和 Chrome profile。
- 自动启动后端、Admin Web、User Web、Mobile H5 的测试服务。
- 通过 Chrome DevTools Protocol 覆盖 Admin Web、User Web、Mobile H5 登录和关键页面 smoke；Admin Web 额外覆盖财务应付款、会员积分推广和审计日志入口，User Web/Mobile H5 额外覆盖个人中心积分推广入口。
- 通过真实浏览器表单完成 User Web 包裹预报、Admin Web 扫描同一快递单号入库、User Web 搜索回看在库状态和申请打包入口。
- 检查浏览器 console error/warning、runtime exception 和 `>=400` network response。
- 对直接导航先等待目标 URL 和 document ready；文本断言失败时输出页面快照，并在脚本失败时打印后端和三端 Vite 服务日志尾部。
- 退出时清理临时 profile、数据库、media、日志和测试进程，不使用用户日常 Chrome profile。

该 smoke 是浏览器基础可用性和一条关键业务旅程 gate，不替代后续视觉回归、组件级测试或更大范围业务旅程覆盖。

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
-> 后台创建发货批次、生成模板数据、锁定后批量发货并添加轨迹
-> 用户查看轨迹并确认收货
-> 用户提交手工代购
-> 后台采购到货并转包裹
-> 代购包裹继续申请打包
```

## 已知边界

- 真实在线支付、支付回调、退款和对账不在 P0 范围；当前支持后台人工充值、用户线下汇款提交、财务人工审核入账和余额支付。
- 供应商、成本类型和应付基础已完成；真实银行付款、自动打款、外部财务系统同步、供应商结算规则和付款审批流仍未接入。
- 自动采购和外部电商抓取不在 P0 范围；当前支持自营商品、手工代购和外部商品链接解析转人工确认。
- PostgreSQL/MySQL/Redis/Celery/Docker 均未真实验证，不能作为生产可用结论。
- 批量导入支持 CSV 和 `.xlsx`；旧版二进制 `.xls` 需另存为 `.xlsx` 或 CSV 后导入。
- 本地文件上传、元数据、鉴权下载、包裹图片、线下汇款凭证和消息附件引用已完成；对象存储、缩略图、文件安全扫描和真实打印硬件接入后续补齐。
- 发货批次、转单号、承运商批次号和面单/拣货单/交接清单结构化模板数据已完成；真实物流 API、第三方转单接口和打印机硬件未接入。
- 后台会员管理已可真实操作会员状态和服务信息；复杂 CRM、自动客服分配、最终会员等级规则仍需业务确认。
- 无主包裹认领已支持脱敏列表、用户认领和后台人工审核；认领凭证规则、争议处理和通知外呼仍需业务确认。
- 内容 CMS 已支持后台分类/内容、发布/隐藏和三端公开展示；正式服务条款、隐私政策和帮助文案仍需业务/法务确认。
- 会员注册、账户资料设置和自助改密码已完成；短信/邮件验证码、找回密码、微信登录、多语言和复杂运费公式等保留 `TODO_CONFIRM`。
- 后台 `/dashboard`、`/roles` 和 `/admin-users` 已使用真实接口与真实数据；角色创建、编辑、权限分配、管理员创建、启停、密码重置和角色分配已完成，业务写操作已按模块级 `*.manage` / `*.export` 权限拆分，角色/管理员删除和 create/update/delete 子权限继续后续增强。
- 后台关键写操作审计日志已完成基础覆盖，并支持 CSV 导出和显式本地留存清理命令；外部 SIEM、自动告警、审计导出审批和更细导出审批流仍属后续生产化增强。
- 浏览器级 smoke 已覆盖三端登录、关键页面基础可用性和一条包裹预报/入库/回看旅程；视觉回归、组件级测试和更大范围业务旅程仍需后续增强。
