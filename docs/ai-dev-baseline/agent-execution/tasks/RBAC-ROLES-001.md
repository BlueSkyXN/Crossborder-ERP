# RBAC-ROLES-001 角色权限管理闭环

## 背景

`ADMIN-PANELS-001` 已把 Admin Web `/roles` 从固定占位页替换为真实角色权限矩阵，但仍是只读视图。源报告要求后台 RBAC 具备可管理产品形态，因此需要在不扩大到完整 IAM 管理后台的前提下，补齐角色创建、编辑和权限分配的最小闭环。

## 目标

- 后端支持管理员读取全部权限、创建角色、编辑角色名称/说明/权限集合。
- Admin Web `/roles` 支持可视化新增角色、编辑角色和勾选权限。
- 写操作必须由独立权限 `iam.role.manage` 控制，不能只依赖菜单可见权限。
- 保护内置 `super_admin` 角色，避免误改系统最高权限。

## 范围

- `backend/apps/iam` 的权限种子、serializer、API view、URL 和后端测试。
- `admin-web/src/features/auth` 的角色权限页面、API/types 和布局上下文。
- Browser Smoke `/roles` 断言更新。
- README、gap map、backlog、known issues、delivery audit、implementation decisions 和 Agent run 证据。

## Done 条件

- `cd backend && uv run pytest apps/iam/tests/test_admin_auth.py -q` 通过。
- `pnpm --filter admin-web lint` 和 `pnpm --filter admin-web build` 通过。
- `cd backend && uv run python manage.py check`、`makemigrations --check --dry-run` 和 OpenAPI validate 通过。
- `npm run e2e:browser`、`npm run e2e`、`cd backend && uv run pytest`、`pnpm lint`、`pnpm build` 和 `npm run evidence` 通过。
- `git diff --check`、`actionlint .github/workflows/ci.yml` 和 YAML parse 通过。
- PR CI 与 main CI 均通过。

## 边界

- 本任务不做角色删除，避免误删已分配角色导致管理员失权。
- 本任务不做后台用户分配角色、审计导出审批或 create/update/delete 权限再拆分。
- PostgreSQL/MySQL/Redis/Celery/Docker 仍不真实验证。
