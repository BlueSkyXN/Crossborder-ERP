# RBAC-IAM-ACTIONS-001 IAM 写操作细权限拆分

## 输入

- 完成度审计显示，任务图已到 `QA-BROWSER-005`，但生产级缺口仍包含业务/IAM 写操作继续拆 create/update/delete 子权限。
- 当前用户约束仍是 no-Docker、SQLite-first、不安装全局依赖、不启动 PostgreSQL/MySQL/Redis。
- 外部支付、物流、对象存储、真实数据库和 Docker 暂不适合作为下一步真实验证任务。

## Agent 决策

- 先处理后台最高风险的 IAM 角色和管理员账号，而不是一次性改全部业务模块，降低变更面。
- 保留 `iam.role.manage` 和 `iam.admin.manage` 作为兼容总权限，新增 create/update/delete 细权限用于更精细授权。
- 后端权限校验支持“细权限或总权限”任一命中，前端按细权限控制新增、编辑、删除按钮。

## 修改

- `backend/apps/iam/services.py`：新增 `iam.role.create/update/delete` 和 `iam.admin.create/update/delete` 权限码，并自动 seed 到权限表和超级管理员。
- `backend/apps/iam/permissions.py`：允许 `method_permissions` 指定多个可选权限。
- `backend/apps/iam/views.py`：角色和管理员账号的 POST/PATCH/DELETE 分别绑定细权限，并保留 `*.manage` fallback。
- `backend/apps/iam/tests/test_admin_auth.py`：补仅 create、仅 update、仅 delete 权限的隔离测试，验证细权限互不串权。
- `admin-web/src/features/auth/RolePermissionPage.tsx`、`AdminUserManagementPage.tsx`：按 create/update/delete 细权限分别控制新增、编辑、删除入口。
- 更新任务图、current-state、README、gap map、production backlog、known issues、delivery audit 和 implementation decisions。

## 验证

- `cd backend && uv run pytest apps/iam/tests/test_admin_auth.py apps/iam/tests/test_admin_business_action_permissions.py -q`：passed，41 passed。
- `pnpm --filter admin-web lint`：passed。
- `pnpm --filter admin-web build`：passed。
- `ruby -e 'require "yaml"; YAML.load_file("docs/ai-dev-baseline/agent-execution/current-state.yaml"); YAML.load_file("docs/ai-dev-baseline/agent-execution/task-graph.yaml"); puts "yaml ok"'`：passed；Ruby 提示 `/Volumes/TP4000PRO` world-writable PATH warning，属当前外置盘环境既有 warning。
- `npm run evidence`：passed，检查 62 个任务和 61 份 Agent run 摘要。
- `git diff --check`：passed。
- `cd backend && uv run pytest`：passed，211 passed，1 个 Django 覆盖 `DATABASES` 的既有 warning。
- `cd backend && uv run python manage.py check`：passed。
- `cd backend && uv run python manage.py makemigrations --check --dry-run`：passed，No changes detected。
- `cd backend && uv run python manage.py spectacular --file /tmp/crossborder-rbac-iam-actions001-openapi.yaml --validate`：passed。
- `actionlint .github/workflows/ci.yml`：passed。
- `pnpm lint`：passed。
- `pnpm build`：passed。
- `npm run e2e`：passed。
- `npm run e2e:browser`：passed，使用 `.tmp/browser-e2e` 隔离 SQLite、media 和 Chrome profile。

## 未验证边界

- 本任务只拆 IAM 角色和管理员账号的新增、编辑、删除权限；其他业务模块仍保持模块级 `*.manage` / `*.export`。
- 未实现审批流、外部 IAM、SSO、LDAP、MFA、导出审批或更复杂职责分离。
- 新权限码通过 `seed_iam_demo_data()` / `seed_demo` 写入权限表；已有 SQLite/demo 数据库若要把细权限分配给非 `is_super_admin` 管理员，需要重新执行初始化权限数据。
- PostgreSQL/MySQL/Redis/Celery/Docker 仍不真实验证。
