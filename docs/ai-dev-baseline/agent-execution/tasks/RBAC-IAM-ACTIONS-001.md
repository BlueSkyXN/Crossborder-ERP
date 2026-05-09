# RBAC-IAM-ACTIONS-001 IAM 写操作细权限拆分

## 背景

`RBAC-ROLES-001`、`RBAC-ADMIN-USERS-001` 和 `RBAC-DELETE-001` 已完成角色、管理员账号和删除保护闭环，但当前 IAM 高风险写操作仍主要由 `iam.role.manage` / `iam.admin.manage` 总权限控制。生产后台通常需要把新增、编辑、删除拆给不同岗位，降低误授权风险。

## 目标

- 保留 `iam.role.manage` / `iam.admin.manage` 作为向后兼容的总管理权限。
- 新增 `iam.role.create`、`iam.role.update`、`iam.role.delete`、`iam.admin.create`、`iam.admin.update`、`iam.admin.delete`。
- 后端按 HTTP method 和动作校验细权限，允许细权限或总管理权限任一命中。
- Admin Web 角色和管理员账号页面按新增、编辑、删除细权限控制按钮。
- 不新增依赖，不使用 Docker，不启动 PostgreSQL/MySQL/Redis。

## 范围

- `backend/apps/iam/permissions.py`
- `backend/apps/iam/services.py`
- `backend/apps/iam/views.py`
- `backend/apps/iam/tests/test_admin_auth.py`
- `admin-web/src/features/auth/RolePermissionPage.tsx`
- `admin-web/src/features/auth/AdminUserManagementPage.tsx`
- README、gap map、production backlog、known issues、delivery audit、implementation decisions 和 Agent run 证据

## Done 条件

- 后端测试覆盖：仅有 create 权限不能 update/delete；仅有 update 权限不能 delete；仅有 delete 权限可删除未受保护对象。
- 既有 `*.manage` 权限保持兼容。
- `pnpm --filter admin-web lint` 通过。
- `pnpm --filter admin-web build` 通过。
- `npm run evidence`、YAML parse、`git diff --check` 和 `actionlint .github/workflows/ci.yml` 通过。
- PR CI 与 main CI 均通过。

## 边界

- 本任务只拆 IAM 角色/管理员账号的 create/update/delete 细权限。
- 业务模块的 create/update/delete 细权限、审批流、导出审批和外部 IAM/SSO/MFA 仍需后续单独任务。
- PostgreSQL/MySQL/Redis/Celery/Docker 仍不真实验证。
