# INIT-001 创建 monorepo

phase: `P0_FOUNDATION`  
depends_on: 无  
next: `BE-001`

## 目标

创建真实项目根结构，让后续后端、后台、用户 Web、移动 H5 都有明确落点。

## 必读

- `../README.md`
- `../../03-technical-architecture.md`
- `../../11-agents-md-template.md`

## 必须做

- 创建 `backend/`、`admin-web/`、`user-web/`、`mobile-h5/`、`docs/`、`infra/`。
- 将 `ai-dev-baseline/` 复制或保留到 `docs/ai-dev-baseline/`。
- 创建根 `README.md`，写清项目目标、技术栈、启动方式占位。
- 创建根 `AGENTS.md`，内容来自 `../../11-agents-md-template.md`。
- 创建 `.env.example`。
- 创建 `docker-compose.yml`，包含 PostgreSQL 和 Redis。

## 不要做

- 不写业务模型。
- 不写大量前端页面。
- 不更换技术栈。

## 验收

```bash
docker compose config
docker compose up -d postgres redis
```

人工检查：

- 目录结构符合 `../../03-technical-architecture.md`。
- 后续任务能在对应目录继续开发。
