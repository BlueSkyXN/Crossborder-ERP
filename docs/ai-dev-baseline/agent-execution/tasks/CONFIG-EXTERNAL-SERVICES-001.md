# CONFIG-EXTERNAL-SERVICES-001 外部服务配置边界检查

## 背景

当前项目按 SQLite-first 验收，且用户明确要求暂不使用 Docker、不启动 PostgreSQL/MySQL/Redis，但需要为后续 PostgreSQL/MySQL/Redis/Celery 保留配置支撑并清楚标记未真实验证边界。

## 目标

- 保持 SQLite 为唯一真实验证数据库。
- `DATABASE_URL` 支持 SQLite/PostgreSQL/MySQL DSN 解析。
- `REDIS_URL` 和 `CELERY_TASK_ALWAYS_EAGER` 支持无连接配置检查。
- 提供可重复命令证明 PostgreSQL/MySQL/Redis/Celery 只是 `configured_unverified`，不误写成生产可用。

## 范围

- 后端配置 helper、默认 settings 接入和只读 inspect management command。
- 仓库级 `npm run inspect:services`，用于不执行 Django setup 的 DSN 边界检查。
- 无连接配置解析测试。
- README、deployment、gap map、backlog、known issues、delivery audit、implementation decisions 和 Agent run 证据。

## Done 条件

- `npm run inspect:services` 默认输出 SQLite `verified_sqlite`。
- 使用 PostgreSQL/MySQL/Redis 示例环境变量运行 `npm run inspect:services` 时输出 `configured_unverified`、`django_setup_performed=false` 和 `external_connections_opened=false`。
- 后端测试覆盖 SQLite/PostgreSQL/MySQL URL 解析、Redis URL 状态、Celery eager/Redis broker 状态。
- 全量本地 gate 和 CI 通过。

## 边界

- 不安装 PostgreSQL/MySQL/Redis/Celery 新依赖。
- 不启动或连接 PostgreSQL/MySQL/Redis。
- 不验证迁移、事务隔离、行级锁、JSON 字段、缓存、broker、异步任务或生产备份。
- Docker 仍暂缓。
