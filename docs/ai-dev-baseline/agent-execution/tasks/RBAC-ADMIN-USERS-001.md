# RBAC-ADMIN-USERS-001 管理员账号与角色分配

## 背景

`RBAC-ROLES-001` 已补齐角色创建、编辑和权限分配，但仍缺少后台管理员账号管理和把角色分配给管理员账号的闭环。原始 ChatGPT/Gemini 后台报告均把管理员、角色、权限和菜单/按钮级权限视为后台基础能力；仅能维护角色而不能给管理员分配角色，仍不足以证明 RBAC 生产可用。

## 目标

- 后端支持管理员账号列表、创建、详情和更新。
- Admin Web 新增真实“管理员账号”面板，可创建管理员、启停账号、重置密码和分配角色。
- 使用 `iam.admin.view` 控制查看入口，使用 `iam.admin.manage` 控制写操作。
- 保护内置超级管理员账号，避免误改最高权限账号。
- 普通管理员只能分配非 `super_admin` 角色，后端和前端都禁止分配内置超级管理员角色。
- 阻止管理员修改自己的状态、角色或密码，避免自锁。

## 范围

- `backend/apps/iam` 权限种子、serializer、API view、URL 和测试。
- Admin Web auth API/types/menu/routes 和 `AdminUserManagementPage`。
- Browser Smoke 新增 `/admin-users` 面板断言。
- README、gap map、backlog、known issues、delivery audit、implementation decisions、API 契约和 Agent run。

## Done 条件

- `cd backend && uv run pytest apps/iam/tests/test_admin_auth.py -q` 通过。
- `pnpm --filter admin-web lint` 和 `pnpm --filter admin-web build` 通过。
- `node --check scripts/e2e/browser-smoke.mjs` 通过。
- `cd backend && uv run python manage.py check`、`makemigrations --check --dry-run` 和 OpenAPI validate 通过。
- `npm run e2e:browser`、`npm run e2e`、`cd backend && uv run pytest`、`pnpm lint`、`pnpm build` 和 `npm run evidence` 通过。
- `git diff --check`、`actionlint .github/workflows/ci.yml` 和 YAML parse 通过。
- PR CI 与 main CI 均通过。

## 边界

- 本任务不做管理员账号物理删除。
- 本任务不接外部 IAM、SSO、LDAP、MFA。
- 本任务仍不拆全部业务按钮的 create/update/delete/export 权限。
- PostgreSQL/MySQL/Redis/Celery/Docker 仍不真实验证。
