# RBAC-ADMIN-USERS-001 管理员账号与角色分配

## 输入

- 用户要求继续完成原始两套 AI 报告要求，不能停在 demo 或只读面板。
- `RBAC-ROLES-001` 已完成角色和权限集合管理，但管理员账号与角色分配仍是已知缺口。
- 源报告明确提到管理员账号、角色、权限、菜单和按钮级权限控制。

## Agent 决策

- 新增 `iam.admin.view` 菜单权限和 `iam.admin.manage` 按钮权限，和角色管理权限分开。
- 允许创建普通后台管理员、启停账号、重置密码和分配非 `super_admin` 角色；后端同样拒绝 `super_admin` 角色分配，避免绕过 UI 提权。
- 内置 `super_admin` 账号不可编辑，当前登录管理员不可修改自己的状态、角色或密码，降低自锁风险。
- 不做管理员物理删除，避免审计关联和历史操作人丢失。

## 修改

- 后端新增 `/api/v1/admin/admin-users` 和 `/api/v1/admin/admin-users/{id}`。
- 后端新增管理员账号 serializer、写入校验和事务保存逻辑。
- Admin Web 新增“管理员账号”菜单和真实管理页，支持新增、编辑、角色勾选、状态切换和密码重置。
- Browser Smoke 新增 `/admin-users` 面板文本断言。
- 项目文档和任务图更新到 `RBAC-ADMIN-USERS-001`。

## 验证

- `cd backend && uv run pytest apps/iam/tests/test_admin_auth.py -q`：24 passed。
- `pnpm --filter admin-web lint`：passed。
- `pnpm --filter admin-web build`：passed。
- `node --check scripts/e2e/browser-smoke.mjs`：passed。
- `cd backend && uv run python manage.py check`：passed。
- `cd backend && uv run python manage.py makemigrations --check --dry-run`：passed，No changes detected。
- `cd backend && uv run python manage.py spectacular --file /tmp/crossborder-rbac-admin-users001-openapi.yaml --validate`：passed。
- `npm run evidence`：passed，tasks checked 53，agent run summaries checked 52。
- YAML parse：passed。
- `git diff --check`：passed。
- `actionlint .github/workflows/ci.yml`：passed。
- `cd backend && uv run pytest`：165 passed。
- `pnpm lint`：passed。
- `pnpm build`：passed。
- `npm run e2e`：1 passed。
- `npm run e2e:browser`：passed，覆盖 User Web、Admin Web、Mobile H5，并包含 Admin Web `/admin-users` 面板断言。
- CI 和 main 合并状态以本轮 PR 最终回读为准。

## 未验证边界

- 管理员账号删除、外部 IAM/SSO/LDAP/MFA 未实现。
- 全部业务按钮的 create/update/delete/export 权限拆分仍未完成。
- PostgreSQL/MySQL/Redis/Celery/Docker 不真实验证。
