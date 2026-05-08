# FILE-001 本地文件服务

phase: `P6_PRODUCTION_GAP`
depends_on: `ADDR-001`
next: `FIN-001`

## 目标

补齐生产化缺口中的本地文件上传基础，为包裹图片、汇款凭证、客服消息图片、商品/内容图片提供统一文件元数据、上传限制和访问控制。当前仍遵守 no-Docker、SQLite-first、不接对象存储的边界。

## 来源

- ChatGPT Admin 后端任务要求文件服务、图片上传、凭证上传、Excel 导入相关能力。
- ChatGPT User Web 后端任务要求文件服务支撑地址、消息、汇款、无主包裹等业务。
- `docs/source-report-gap-map.md` 已把文件上传列为 P0 生产化基础缺口。

## 必须做

- 新增后端 files/media app、model、migration、serializer、service、API 和测试。
- 支持本地 media 存储，限制文件大小、类型和业务用途。
- 上传接口必须按当前用户/后台角色隔离访问，不能直接暴露任意路径。
- 至少补一个业务引用示例或预留引用接口，避免只有孤立上传。
- 更新 README/部署边界/Agent run 记录。

## 不要做

- 不接真实对象存储、CDN、杀毒服务或图片 AI 审核。
- 不引入 Docker/PostgreSQL/MySQL/Redis。
- 不把对象存储描述为已验证能力。

## 验收

```bash
cd backend && uv run python manage.py makemigrations --check --dry-run
cd backend && uv run pytest
pnpm lint
pnpm build
npm run e2e
git diff --check
```

补充验收：

- 非授权用户不能读取或删除他人文件。
- 超限大小、非法 MIME/扩展名必须被拒绝。
- 文件元数据和本地 media 路径不泄漏服务器任意文件路径。
