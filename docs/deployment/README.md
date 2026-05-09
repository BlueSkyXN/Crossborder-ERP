# 部署说明

本文记录当前可验证交付方式和后续 staging/Docker 化边界。当前用户约束为暂不考虑 Docker，因此本项目第一版以 no-Docker local-first 方式验收。

## 当前已验证方式

已验证：

- 后端使用 `uv` 和项目本地 `.venv/`。
- 数据库使用 `backend/db.sqlite3`。
- 任务执行使用 `CELERY_TASK_ALWAYS_EAGER=true`。
- 缓存使用 Django local memory cache。
- 三端前端使用 pnpm workspace。

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
(cd backend && uv run pytest)
pnpm lint
pnpm build
```

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
7. 执行 `npm run e2e` 或等价 staging E2E。

回滚策略：

- 代码回滚到上一个已通过 CI 的 tag/commit。
- 数据库迁移只允许按 migration 设计回滚；涉及数据修复时先备份。
- 静态资源保留上一个构建产物。

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
- 批量导入使用 `IMPORT_FILE` 文件用途和 CSV parser；导入模板/导出 CSV 是即时响应，不持久化到 git 或 media，上传的源 CSV 按本地 `MEDIA_ROOT` 文件策略保存。

后续生产化要求：

- media 目录必须持久化。
- 对象存储需要签名 URL、生命周期策略和备份策略。
- 缩略图、病毒扫描、图片处理和 CDN 仍需后续补齐。

## 常见问题

### 端口被占用怎么办？

后端默认 `8000`，三端默认 `3001/3002/3003`。如端口被占用，先停掉旧进程，或在对应 Vite/Django 命令中临时指定端口。

### `npm run e2e` 会污染本地 SQLite 吗？

不会。该命令通过 pytest 使用 `config.settings.test` 的 in-memory SQLite test database。

### 为什么没有直接交付 Docker Compose？

当前用户明确要求暂不考虑 Docker。本项目文档保留 Docker 化拓扑和 staging 边界，但不把未验证能力写成已完成。

### PostgreSQL/MySQL/Redis 是否可用？

当前没有真实验证。SQLite 是当前唯一验证数据库；Redis/Celery 当前以本地内存和同步任务模式承接。

### 线上支付和自动采购是否可演示？

线上支付不能作为 P0 已完成功能演示。P0 支持后台人工充值、用户线下汇款提交、财务人工审核入账、余额支付、手工代购、人工采购状态推进、基础客服工单、后台会员状态管理、无主包裹人工审核认领、内容 CMS 发布展示和 CSV 批量预报导入/导出。
