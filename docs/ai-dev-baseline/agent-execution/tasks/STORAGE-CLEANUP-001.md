# STORAGE-CLEANUP-001 本地文件清理命令

## 背景

`FILE-001` 已提供本地上传、元数据、鉴权下载和软删除，但本地 `MEDIA_ROOT` 缺少显式清理工具。当前不接对象存储、CDN、缩略图和病毒扫描，本轮只补 SQLite-first 阶段可验证的本地文件生命周期能力。

## 范围

- 新增 `purge_deleted_files` Django management command。
- 支持：
  - `--older-than-days N` 指定软删除保留期。
  - `--dry-run` 预演将清理的文件，不删除文件。
- 只处理数据库中 `status=DELETED` 且 `updated_at` 早于保留期的 `StoredFile`。
- 不删除 `StoredFile` 数据库记录。
- 路径必须仍位于 `MEDIA_ROOT` 内；异常路径只计入 unsafe，不执行删除。
- 路径必须是普通文件；目录等非普通文件路径只计入 unsafe，不执行删除。
- 已缺失的物理文件只计入 missing，不报错。

## 非范围

- 不清理 ACTIVE 文件。
- 不自动运行清理。
- 不接对象存储生命周期、CDN、缩略图、病毒扫描或远程归档。

## 验收

- `cd backend && uv run pytest apps/files/tests/test_purge_deleted_files.py -q`：5 passed
- `cd backend && uv run python manage.py purge_deleted_files --older-than-days 30 --dry-run`
- `cd backend && uv run pytest`
- `npm run e2e`
- `npm run e2e:browser`
- `pnpm lint`
- `pnpm build`
- `cd backend && uv run python manage.py check`
- `cd backend && uv run python manage.py makemigrations --check --dry-run`
- `cd backend && uv run python manage.py spectacular --file /tmp/crossborder-storage-cleanup-openapi.yaml --validate`
- `git diff --check`
- `actionlint .github/workflows/ci.yml`
- YAML 解析 `current-state.yaml` 和 `task-graph.yaml`
