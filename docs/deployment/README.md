# 部署说明

本文记录当前可验证交付方式和后续 staging/Docker 化边界。当前用户约束为暂不考虑 Docker，因此本项目第一版以 no-Docker local-first 方式验收。

## 当前已验证方式

已验证：

- 后端使用 `uv` 和项目本地 `.venv/`。
- 数据库使用 `backend/db.sqlite3`。
- 任务执行使用 `CELERY_TASK_ALWAYS_EAGER=true`。
- 缓存使用 Django local memory cache。
- 三端前端使用 pnpm workspace。
- 后端响应已本地验证基础安全 header，包括 `nosniff`、`Referrer-Policy`、`Cross-Origin-Opener-Policy`、`X-Frame-Options` 和 `Permissions-Policy`。
- 后端提供 `/api/v1/health/ready` readiness endpoint，当前检查 SQLite/default database 连接。
- 后端提供 `backup_sqlite` 显式 SQLite 本地备份命令，默认输出到 ignored 的 `backend/backups/`。
- 后端提供 `purge_deleted_files` 显式本地软删除文件清理命令。
- 后端提供 `purchase-links/parse` 外部商品链接解析入口，当前仅做本地 URL 解析和人工代购 fallback。

启动命令：

```bash
(cd backend && uv sync --locked --dev)
pnpm install --frozen-lockfile
(cd backend && uv run python manage.py migrate)
(cd backend && uv run python manage.py seed_demo)
(cd backend && uv run python manage.py runserver)
pnpm --filter admin-web dev
pnpm --filter user-web dev
pnpm --filter mobile-h5 dev
```

验证命令：

```bash
npm run e2e
npm run e2e:browser
(cd backend && uv run pytest)
(cd backend && uv run python manage.py backup_sqlite --dry-run)
(cd backend && uv run python manage.py purge_deleted_files --older-than-days 30 --dry-run)
pnpm lint
pnpm build
```

`npm run e2e:browser` 是 `QA-BROWSER-001`/`QA-BROWSER-002` 的浏览器 smoke 与真实业务旅程：

- 不新增 Playwright/Vitest 依赖，不下载浏览器二进制。
- 默认查找系统 Chrome/Chromium；如不可发现，可用 `BROWSER_E2E_CHROME=/path/to/chrome` 指定。
- 使用 `.tmp/browser-e2e/` 下的临时 SQLite、media、日志和 Chrome profile。
- 自动启动 `127.0.0.1:8000`、`3001`、`3002`、`3003` 的测试服务。
- 测试 Admin Web、User Web、Mobile H5 登录和关键页面，并通过真实表单完成 User Web 包裹预报、Admin Web 扫描入库、User Web 回看在库状态。
- 检查 console error/warning、runtime exception 和 `>=400` network response。
- 退出时清理临时数据库、media、日志、Chrome profile 和进程，不使用用户日常 Chrome profile。

## Docker Compose

当前仓库不提供已验证的 `docker-compose.yml`，也不要求执行 `docker compose up -d`。原因：

- 用户已明确当前阶段暂不考虑 Docker。
- PostgreSQL/MySQL/Redis 也暂不做真实验证。
- 本轮目标是先用 SQLite 和本地同步任务跑通 P0 业务闭环。

后续如果恢复 Docker 化，建议 compose 拆分为：

| 服务 | 说明 |
| --- | --- |
| `backend` | Django/DRF API，执行 migrate/collectstatic |
| `postgres` | 首选生产数据库，需重新验证迁移、事务和 JSON 行为 |
| `redis` | Celery broker/cache/限流，需补真实异步任务验证 |
| `admin-web` | Admin Web 静态资源或 Nginx location |
| `user-web` | User Web 静态资源或 Nginx location |
| `mobile-h5` | Mobile H5 静态资源或 Nginx location |
| `nginx` | 统一反代 `/api/`、三端静态资源和 media |

在完成真实 compose 验证前，Docker 相关能力只能标记为 `configured_unverified`。

## Staging 配置

staging 至少需要以下环境变量：

| 变量 | staging 建议 | 当前验证状态 |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | 使用随机强密钥 | 未在真实 staging 验证 |
| `DJANGO_DEBUG` | `false` | 未在真实 staging 验证 |
| `DJANGO_ALLOWED_HOSTS` | staging API 域名 | 未在真实 staging 验证 |
| `DJANGO_SECURE_CONTENT_TYPE_NOSNIFF` | `true` | 本地已验证 |
| `DJANGO_SECURE_REFERRER_POLICY` | `same-origin` 或按域名策略调整 | 本地已验证默认值 |
| `DJANGO_SECURE_CROSS_ORIGIN_OPENER_POLICY` | `same-origin` 或按跨窗口需求调整 | 本地已验证默认值 |
| `DJANGO_X_FRAME_OPTIONS` | `DENY` | 本地已验证默认值 |
| `DJANGO_PERMISSIONS_POLICY` | 禁用未使用的浏览器能力 | 本地已验证默认值 |
| `DJANGO_SECURE_HSTS_SECONDS` | HTTPS 验证后再设置正数 | `configured_unverified` |
| `DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS` | 仅确认所有子域 HTTPS 后启用 | `configured_unverified` |
| `DJANGO_SECURE_HSTS_PRELOAD` | 仅确认 preload 要求后启用 | `configured_unverified` |
| `DJANGO_SECURE_SSL_REDIRECT` | 反向代理 HTTPS 头配置确认后启用 | `configured_unverified` |
| `DATABASE_URL` | PostgreSQL DSN | `configured_unverified` |
| `REDIS_URL` | Redis DSN | `configured_unverified` |
| `CELERY_TASK_ALWAYS_EAGER` | `false` | `configured_unverified` |
| `MEDIA_ROOT` | 持久化挂载目录 | 本地文件模式已验证 |
| `PUBLIC_BASE_URL` | staging API base URL | 未在真实 staging 验证 |
| `ADMIN_WEB_URL` | staging Admin URL | 未在真实 staging 验证 |
| `USER_WEB_URL` | staging User URL | 未在真实 staging 验证 |
| `MOBILE_H5_URL` | staging Mobile URL | 未在真实 staging 验证 |

staging 发布顺序建议：

1. 部署后端依赖。
2. 配置 `.env`。
3. 执行数据库迁移。
4. 执行 `seed_demo` 或导入初始化配置。
5. 构建三端前端。
6. 配置反向代理和静态资源。
7. 执行 `npm run e2e`、`npm run e2e:browser` 或等价 staging E2E。

健康检查建议：

| Endpoint | 用途 | 当前验证状态 |
| --- | --- | --- |
| `/api/v1/health` | 进程存活和基础 API 可达 | 本地已验证 |
| `/api/v1/health/ready` | 当前依赖可用性；现阶段检查默认数据库连接 | 本地已验证 |

readiness 失败时返回 HTTP 503 和脱敏状态，不返回数据库 DSN、异常堆栈或本地路径。PostgreSQL/MySQL/Redis/Celery 未真实验证前，不把这些依赖加入当前 readiness gate。

回滚策略：

- 代码回滚到上一个已通过 CI 的 tag/commit。
- 数据库迁移只允许按 migration 设计回滚；涉及数据修复时先备份。SQLite-first 本地环境可先执行 `uv run python manage.py backup_sqlite --dry-run` 预演，再执行真实备份。
- 静态资源保留上一个构建产物。

## SQLite 本地备份

`OPS-SQLITE-BACKUP-001` 已提供显式本地备份命令：

```bash
cd backend
uv run python manage.py backup_sqlite --dry-run
uv run python manage.py backup_sqlite
```

默认行为：

- 备份 `default` database alias。
- 默认源库为当前 `DATABASE_URL` 指向的 SQLite 文件。
- 默认输出目录为 `backend/backups/`，该目录已被 git ignore。
- 默认文件名形如 `crossborder-erp-default-YYYYMMDDTHHMMSSZ.sqlite3`。
- 目标文件已存在时拒绝覆盖，必须显式传入 `--force`。

可选参数：

```bash
uv run python manage.py backup_sqlite --output-dir /path/to/backups --filename snapshot.sqlite3
uv run python manage.py backup_sqlite --database default --force
```

边界：

- 该命令仅支持 file-backed SQLite。
- `:memory:`、PostgreSQL、MySQL 会被拒绝。
- 该命令不会自动运行，不负责远程备份、加密、轮转、恢复演练或告警。
- PostgreSQL/MySQL 生产备份仍需在真实数据库验证阶段单独设计。

## 文件存储

当前文件存储为本地 `MEDIA_ROOT`：

- 默认来自 `.env.example`：`MEDIA_ROOT=./media`。
- 本地开发不依赖对象存储。
- `FILE-001` 已提供本地上传、文件元数据、大小/MIME/扩展名限制、鉴权下载和软删除。
- 包裹入库图片已校验真实 `PARCEL_PHOTO` file id；包裹所属会员可通过鉴权 endpoint 下载被业务引用的图片。
- API 只返回 `file_id`、元数据和下载 endpoint，不返回本地 `storage_key`。
- 线下汇款凭证使用 `REMITTANCE_PROOF` 文件用途；用户只能引用自己的有效凭证，后台审核入账后才更新钱包余额。
- 消息工单附件使用 `MESSAGE_ATTACHMENT` 文件用途；用户只能引用自己的有效附件，后台客服可查看工单附件并回复。
- 无主包裹认领只向用户返回脱敏快递单号；后台审核通过后才创建会员在库包裹，认领凭证和通知外呼仍是后续业务规则。
- 内容 CMS 当前使用数据库文本内容，不接外部富文本上传；公开接口只返回已发布内容，正式条款/隐私/帮助文案仍需业务或法务确认。
- 批量导入使用 `IMPORT_FILE` 文件用途，支持 CSV 和标准 `.xlsx` parser；导入模板/导出 CSV 是即时响应，不持久化到 git 或 media，上传的源 CSV/Excel 按本地 `MEDIA_ROOT` 文件策略保存。
- 外部商品链接解析只识别 host、商品 ID 和规范化 URL，结果进入手工代购商品行；当前不抓取真实第三方页面、不自动下单、不保存平台账号或凭证。
- 软删除文件可用 `purge_deleted_files --older-than-days N --dry-run` 预演清理，再显式执行真实清理。该命令只删除已软删除且超过保留期的本地物理文件，不删除数据库记录。

本地软删除文件清理：

```bash
cd backend
uv run python manage.py purge_deleted_files --older-than-days 30 --dry-run
uv run python manage.py purge_deleted_files --older-than-days 30
```

边界：

- 不清理 ACTIVE 文件。
- 不自动执行清理。
- 路径必须仍位于 `MEDIA_ROOT` 内，且目标必须是普通文件；异常路径或目录会计入 unsafe 并跳过。
- 已缺失的物理文件会计入 missing，不作为命令失败处理。

后续生产化要求：

- media 目录必须持久化。
- 对象存储需要签名 URL、生命周期策略和备份策略。
- 缩略图、病毒扫描、图片处理和 CDN 仍需后续补齐。

## 安全响应头

`SECURITY-HEADERS-001` 已把基础安全响应头纳入后端设置和测试：

| Header | 当前默认 | 验证状态 |
| --- | --- | --- |
| `X-Content-Type-Options` | `nosniff` | 本地已验证 |
| `Referrer-Policy` | `same-origin` | 本地已验证 |
| `Cross-Origin-Opener-Policy` | `same-origin` | 本地已验证 |
| `X-Frame-Options` | `DENY` | 本地已验证 |
| `Permissions-Policy` | `camera=(),microphone=(),geolocation=(),payment=(),usb=()` | 本地已验证 |

HSTS 和 HTTPS redirect 当前只暴露环境变量，不默认启用。原因是本地和 CI 仍通过 HTTP 验证，贸然开启会破坏 no-Docker local-first 验收。上线前需要先确认真实 HTTPS、反向代理转发头、域名和子域策略，再设置：

```bash
DJANGO_SECURE_HSTS_SECONDS=31536000
DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=true
DJANGO_SECURE_HSTS_PRELOAD=true
DJANGO_SECURE_SSL_REDIRECT=true
```

上述 HTTPS/HSTS 配置在真实 staging 验证前仍只能标记为 `configured_unverified`。

## 审计日志留存

当前审计日志存储在 `audit_logs` 表。后台 `/audit-logs` 支持导出脱敏 CSV；本地或运维脚本可以用显式命令预演和清理旧日志：

```bash
cd backend
uv run python manage.py purge_audit_logs --older-than-days 180 --dry-run
uv run python manage.py purge_audit_logs --older-than-days 180
```

该命令不会自动运行。留存天数、归档介质、外部 SIEM 和告警策略仍需生产部署阶段确认。

## 常见问题

### 端口被占用怎么办？

后端默认 `8000`，三端默认 `3001/3002/3003`。如端口被占用，先停掉旧进程，或在对应 Vite/Django 命令中临时指定端口。

### `npm run e2e` 会污染本地 SQLite 吗？

不会。该命令通过 pytest 使用 `config.settings.test` 的 in-memory SQLite test database。

### `npm run e2e:browser` 会污染本机 Chrome 或 SQLite 吗？

不会。该命令使用 `.tmp/browser-e2e/` 下的临时 SQLite、media 和 Chrome profile，退出时会清理该目录和启动的测试进程。它会调用系统 Chrome/Chromium 二进制，但不使用用户日常 Chrome profile，也不下载新的浏览器。

### 为什么没有直接交付 Docker Compose？

当前用户明确要求暂不考虑 Docker。本项目文档保留 Docker 化拓扑和 staging 边界，但不把未验证能力写成已完成。

### PostgreSQL/MySQL/Redis 是否可用？

当前没有真实验证。SQLite 是当前唯一验证数据库；Redis/Celery 当前以本地内存和同步任务模式承接。

### 线上支付和自动采购是否可演示？

线上支付不能作为 P0 已完成功能演示。P0 支持后台人工充值、用户线下汇款提交、财务人工审核入账、余额支付、手工代购、人工采购状态推进、基础客服工单、后台会员状态管理、无主包裹人工审核认领、内容 CMS 发布展示和 CSV / `.xlsx` 批量预报导入/导出。
