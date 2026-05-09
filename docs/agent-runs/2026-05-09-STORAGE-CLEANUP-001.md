# STORAGE-CLEANUP-001 本地文件清理命令

## 背景

当前文件服务已支持上传、鉴权下载和软删除，但本地 `MEDIA_ROOT` 缺少显式清理工具。生产化边界中对象存储、CDN、病毒扫描仍未接入，本轮先补可本地验证的软删除文件清理命令。

## 关键实现

- 新增 `purge_deleted_files` management command。
- 必须传入 `--older-than-days N`，且 N 必须大于 0。
- 默认只处理 `StoredFile.status=DELETED` 且超过保留天数的记录。
- 支持 `--dry-run`，输出 matched、would delete、missing、unsafe。
- 实际执行时只删除仍位于 `MEDIA_ROOT` 内的物理文件，不删除数据库记录。
- 已缺失文件计入 missing，异常路径计入 unsafe 并跳过。
- 测试覆盖 dry-run、真实删除、ACTIVE/未到期保护、缺失文件、路径逃逸保护、非普通文件路径和参数校验。

## 验证

- `cd backend && uv run pytest apps/files/tests/test_purge_deleted_files.py -q`：5 passed。
- `cd backend && uv run pytest`：142 passed。
- `cd backend && uv run python manage.py purge_deleted_files --older-than-days 30 --dry-run`：passed，当前匹配 0。
- `npm run e2e`：passed。
- `npm run e2e:browser`：passed，继续使用 `.tmp/browser-e2e` 隔离 SQLite、media 和 Chrome profile。
- `pnpm lint`：passed。
- `pnpm build`：passed。
- `cd backend && uv run python manage.py check`：passed。
- `cd backend && uv run python manage.py makemigrations --check --dry-run`：passed，No changes detected。
- `cd backend && uv run python manage.py spectacular --file /tmp/crossborder-storage-cleanup-openapi.yaml --validate`：passed。
- `git diff --check`：passed。
- `actionlint .github/workflows/ci.yml`：passed。
- YAML parse：passed；Ruby 仍提示 `/Volumes/TP4000PRO` 在 PATH 中 world-writable，这是当前外置盘环境的既有 warning。

## 未验证边界

- 未接对象存储生命周期、CDN、缩略图、病毒扫描或远程归档。
- 未自动执行清理，避免未确认保留期前删除文件。
- PostgreSQL/MySQL/Redis/Celery/Docker 仍未真实验证。
