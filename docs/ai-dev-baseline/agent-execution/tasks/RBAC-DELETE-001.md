# RBAC-DELETE-001 角色与管理员安全删除闭环

## 背景

`RBAC-ROLES-001` 和 `RBAC-ADMIN-USERS-001` 已补齐角色创建/编辑、权限分配和管理员账号创建/启停/重置密码/角色分配，但源报告差距地图仍把角色/管理员删除列为后台 RBAC 生产化缺口。

## 目标

- 后台角色详情 API 支持删除未分配给管理员的非 `super_admin` 角色。
- 后台管理员详情 API 支持删除非 `super_admin` 且非当前登录管理员的账号。
- Admin Web `/roles` 和 `/admin-users` 显示删除操作，并对内置/当前账号保护置灰。
- Browser Smoke 至少验证删除入口可见，后端测试验证删除保护边界。

## 范围

- Django/DRF IAM 删除接口和测试。
- Admin Web 角色/管理员账号表格删除按钮。
- Browser Smoke 面板入口断言。
- README、gap map、backlog、known issues、delivery audit、任务图和 Agent run 证据。

## Done 条件

- `DELETE /api/v1/admin/roles/{id}` 可删除未分配自定义角色，并拒绝 `super_admin` 或已分配角色。
- `DELETE /api/v1/admin/admin-users/{id}` 可删除普通管理员，并拒绝内置超级管理员和当前登录管理员。
- 只读账号无删除权限。
- 后端测试、Admin Web lint/build、OpenAPI、E2E、Browser Smoke、evidence 和静态 gate 通过。

## 边界

- 不做外部 IAM、SSO、LDAP、MFA。
- 不做审批流或导出审批。
- 不拆每个业务 create/update/delete 子权限。
- 不做物理删除以外的数据归档策略；后台关键写操作仍由 audit middleware 记录。
