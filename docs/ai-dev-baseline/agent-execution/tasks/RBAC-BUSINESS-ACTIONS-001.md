# RBAC-BUSINESS-ACTIONS-001 后台业务写操作权限拆分

## 背景

`RBAC-ROLES-001` 和 `RBAC-ADMIN-USERS-001` 已补齐角色、权限和管理员账号管理闭环，但业务模块仍主要依赖菜单 view 权限。源报告和现有交付审计都把按钮级权限视为后续生产化缺口，因此需要先用一组业务 `manage` / `export` 权限把后台写操作与只读访问拆开。

## 目标

- 后端业务后台写接口不再只依赖 `*.view` 菜单权限。
- Admin Web 业务页面按当前管理员完整 `permissionCodes` 隐藏或禁用新增、编辑、状态流、导出和附件上传入口。
- 内置演示角色获得与职责匹配的业务 action 权限，超级管理员继续拥有全部权限。
- 只读角色可访问列表/详情，但写接口返回 `FORBIDDEN`。

## 范围

- IAM 权限种子、演示角色权限和 `HasAdminPermission` 写权限解析。
- 后台业务 app：members/growth、warehouses、parcels/export、waybills、finance/files、purchases、products、tickets、content、audit export。
- Admin Web 业务页面：会员、仓库、包裹、运单、财务、代购、商品、工单、内容和审计日志。
- 后端权限回归测试、README、deployment、gap map、backlog、known issues、delivery audit、implementation decisions 和 Agent run 证据。

## Done 条件

- 业务 view-only 角色可读取对应列表，但 POST/PATCH/DELETE/export 写入口按新 action 权限返回 `FORBIDDEN`。
- Admin Web lint/build 通过，页面写按钮不再只看菜单权限。
- `cd backend && uv run pytest`、`pnpm lint`、`pnpm build` 和 `npm run evidence` 通过。
- `cd backend && uv run python manage.py check`、`makemigrations --check --dry-run` 和 OpenAPI validate 通过。
- `git diff --check`、YAML parse 和 `actionlint .github/workflows/ci.yml` 通过。

## 边界

- 本任务先采用模块级 `*.manage` 和少量 `*.export`，不拆到每个 create/update/delete 子动作。
- 角色/管理员删除、外部 IAM/SSO/LDAP/MFA 不在本任务。
- 外部 SIEM、导出审批、真实支付、真实物流、真实自动采购、PostgreSQL/MySQL/Redis/Celery/Docker 不真实验证。
