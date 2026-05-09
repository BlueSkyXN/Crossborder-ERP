# CONFIG-EXTERNAL-SERVICES-001 外部服务配置边界检查

## 输入

- 用户要求 SQLite + demo 数据作为当前真实验证路径，同时后续补 PostgreSQL/MySQL/Redis/Celery 支持但不真实验证。
- 当前完成度审计显示 PostgreSQL/MySQL/Redis/Celery 仍是核心未验证边界，不能据此宣布整体生产级 ERP 完成。

## Agent 决策

- 不新增数据库或 Redis 依赖，不启动外部服务，不做 Docker。
- 保留 Django settings 的 `DATABASE_URL` 接入，并把解析逻辑抽到 helper 中用测试覆盖。
- 增加 `npm run inspect:services`，该脚本不执行 Django setup，避免缺少 PostgreSQL/MySQL driver 时在 Django app 初始化阶段失败。
- 管理命令 `inspect_configured_services` 只用于当前已能完成 Django setup 的 settings；跨库 DSN 边界证明以仓库脚本为准。

## 修改

- 新增 `apps.common.configuration`，集中描述 SQLite/PostgreSQL/MySQL/Redis/Celery 配置状态。
- `config.settings.base` 改为通过 helper 解析 `DATABASE_URL`。
- 新增 `inspect_configured_services` management command 和仓库级 `scripts/config/inspect_configured_services.py`。
- 新增 `npm run inspect:services`。
- `.env.example` 增加 PostgreSQL/MySQL/Redis 示例，并标明配置-only 边界。
- 更新任务图、current-state、README、deployment、gap map、backlog、known issues、delivery audit、implementation decisions 和本 Agent run。

## 验证

- `cd backend && uv run pytest apps/common/tests/test_runtime_configuration.py -q`：3 passed，1 个 Django 覆盖 `DATABASES` 的既有 warning。
- `cd backend && uv run python manage.py inspect_configured_services --format json`：passed，输出 SQLite `verified_sqlite`、Celery eager `verified_eager`、`external_connections_opened=false`。
- `npm run inspect:services`：passed，输出 SQLite `verified_sqlite`、`django_setup_performed=false`、`external_connections_opened=false`。
- `DATABASE_URL='postgres://erp:secret@localhost:5432/crossborder' REDIS_URL='redis://localhost:6379/0' CELERY_TASK_ALWAYS_EAGER=false npm run inspect:services`：passed，输出 PostgreSQL/Redis/Celery `configured_unverified` 且不执行 Django setup。
- `DATABASE_URL='mysql://erp:secret@localhost:3306/crossborder' REDIS_URL='rediss://cache.example.test:6380/0' CELERY_TASK_ALWAYS_EAGER=false npm run inspect:services`：passed，输出 MySQL/Redis/Celery `configured_unverified` 且不执行 Django setup。
- `DATABASE_URL= npm run inspect:services`：passed，空 `DATABASE_URL` 回退到默认 SQLite `verified_sqlite`，`django_setup_performed=false`。
- `cd backend && uv run pytest`：184 passed，1 个 Django 覆盖 `DATABASES` 的既有 warning。
- `pnpm lint`：passed。
- `pnpm build`：passed。
- `npm run e2e`：passed。
- `npm run e2e:browser`：passed，使用 `.tmp/browser-e2e` 隔离 SQLite、media 和 Chrome profile。
- `cd backend && uv run python manage.py check`：passed。
- `cd backend && uv run python manage.py makemigrations --check --dry-run`：No changes detected。
- `cd backend && uv run python manage.py spectacular --file /tmp/crossborder-config-external-services001-openapi.yaml --validate`：passed。
- `npm run evidence`：passed。
- `git diff --check`：passed。
- `actionlint .github/workflows/ci.yml`：passed。
- YAML parse：passed。

## 未验证边界

- PostgreSQL/MySQL/Redis/Celery 未真实连接、未迁移、未跑并发/缓存/broker/异步任务测试。
- 默认依赖仍不安装 PostgreSQL/MySQL/Redis/Celery driver，避免污染本地和 CI 依赖。
- SQLite 仍是当前唯一真实验证数据库。
- Docker 仍暂缓。

## 下一步

- 后续如继续生产化，应单独做 PostgreSQL/MySQL/Redis 真实连接/迁移验证、对象存储、外部监控和部署验证。
