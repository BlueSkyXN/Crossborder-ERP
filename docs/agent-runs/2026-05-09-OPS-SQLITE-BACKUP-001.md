# OPS-SQLITE-BACKUP-001 SQLite 本地备份命令

## 背景

项目当前唯一真实验证数据库是 SQLite。生产化缺口中包含备份策略，本轮先补可在本地和 CI 中验证、不依赖外部服务的 SQLite 备份命令。

## 关键实现

- 新增 `backup_sqlite` management command。
- 默认备份 `default` database alias，并输出到 ignored 的 `backend/backups/`。
- 支持 `--output-dir`、`--filename`、`--force` 和 `--dry-run`。
- 使用 SQLite backup API 复制源库，避免手工复制正在使用的数据库文件。
- 对非 SQLite、`:memory:`、源库不存在、目标与源库相同、目标文件已存在等场景返回 `CommandError`。
- 测试覆盖成功备份可读取、dry-run 不落盘、覆盖保护、显式覆盖、非文件 SQLite 和非 SQLite 配置。

## 验证

- `cd backend && uv run pytest apps/common/tests/test_backup_sqlite.py -q`：5 passed。
- `cd backend && uv run python manage.py backup_sqlite --dry-run`：passed，未创建备份文件。
- `cd backend && uv run pytest`：137 passed。
- `npm run e2e`：passed。
- `npm run e2e:browser`：passed，沿用 system Chrome 和 `.tmp/browser-e2e/` 临时 profile。
- `pnpm lint`：passed。
- `pnpm build`：passed。
- `cd backend && uv run python manage.py check`：passed。
- `cd backend && uv run python manage.py makemigrations --check --dry-run`：passed，No changes detected。
- `cd backend && uv run python manage.py spectacular --file /tmp/crossborder-ops-sqlite-backup-openapi.yaml --validate`：passed。
- `git diff --check`：passed。
- `actionlint .github/workflows/ci.yml`：passed。
- Ruby YAML parse：`yaml ok`，仅出现已知 `/Volumes/TP4000PRO` world-writable PATH warning。

## 未验证边界

- 未覆盖 PostgreSQL/MySQL 生产备份。
- 未接对象存储、远程备份、备份加密、轮转、恢复演练或告警。
- 未自动执行备份，避免未确认策略前产生隐式数据副本。
