# RBAC-BUSINESS-ACTIONS-001 后台业务写操作权限拆分

## 输入

- `RBAC-ROLES-001` 和 `RBAC-ADMIN-USERS-001` 已完成，但 backlog、gap map 和交付审计仍把业务按钮级 RBAC 记录为后续缺口。
- 目标是先把后台业务写操作从菜单 view 权限中拆出，不扩大到完整外部 IAM 或 per-action 权限矩阵。

## Agent 决策

- 采用模块级 `*.manage` 权限作为第一层业务写操作 gate，导出保留独立 `parcels.export` 和 `audit.logs.export`。
- `HasAdminPermission` 增加 `write_permission` 和 `method_permissions`，让同一 view 可以用 view 权限读取、用 manage/export 权限写入或导出。
- Admin Web 继续复用 layout 下发的完整 `permissionCodes`，在页面内隐藏或禁用业务写按钮、表单保存、导出和附件上传入口。
- `files.manage` 单独控制后台文件上传，避免只有包裹/工单 manage 权限时绕过文件 API 权限边界。

## 修改

- IAM seed 新增 `members.manage`、`warehouses.manage`、`parcels.manage`、`parcels.export`、`waybills.manage`、`finance.manage`、`files.manage`、`purchases.manage`、`products.manage`、`tickets.manage`、`content.manage`、`audit.logs.export`、`growth.view` 和 `growth.manage`。
- 后端业务后台写接口接入 `write_permission`，审计/包裹导出接入 `method_permissions`。
- Admin Web 会员、仓库、包裹、运单、财务、代购、商品、工单、内容、审计页按 action 权限控制写入口。
- 补充跨模块权限测试和各业务 app 的 view-only 写操作拒绝测试。
- 更新任务图、current-state、README、deployment、gap map、backlog、known issues、delivery audit、implementation decisions 和本 Agent run。

## 验证

- `cd backend && uv run pytest apps/iam/tests/test_admin_business_action_permissions.py apps/iam/tests/test_admin_auth.py apps/audit/tests/test_audit_logs.py apps/content/tests/test_content.py apps/files/tests/test_files.py apps/finance/tests/test_finance.py apps/members/tests/test_admin_members.py apps/members/tests/test_growth.py apps/parcels/tests/test_parcels.py apps/products/tests/test_products.py apps/purchases/tests/test_purchases.py apps/tickets/tests/test_tickets.py apps/warehouses/tests/test_warehouses.py apps/waybills/tests/test_waybills.py -q`：141 passed。
- `pnpm --filter admin-web lint`：passed。
- `pnpm --filter admin-web build`：passed。
- `cd backend && uv run pytest`：181 passed。
- `pnpm lint`：admin-web、user-web、mobile-h5 lint passed。
- `pnpm build`：admin-web、user-web、mobile-h5 production build passed。
- `npm run e2e`：passed，覆盖 P0 主链路、代购、工单、会员、积分、内容、应付和审计链路。
- `npm run e2e:browser`：passed，使用 `.tmp/browser-e2e` 隔离 SQLite、media 和 Chrome profile，覆盖三端 smoke、包裹预报/入库/回看旅程和后台真实面板入口。
- `npm run evidence`：Agent evidence gate passed，tasks checked 54，agent run summaries checked 53。
- `cd backend && uv run python manage.py check`：System check identified no issues。
- `cd backend && uv run python manage.py makemigrations --check --dry-run`：No changes detected。
- `cd backend && uv run python manage.py spectacular --file /tmp/crossborder-rbac-business-actions001-openapi.yaml --validate`：passed。
- `git diff --check`：passed。
- `ruby -e 'require "yaml"; YAML.load_file("docs/ai-dev-baseline/agent-execution/current-state.yaml"); YAML.load_file("docs/ai-dev-baseline/agent-execution/task-graph.yaml"); puts "yaml ok"'`：yaml ok；Ruby 提示 `/Volumes/TP4000PRO` world-writable PATH warning，属当前外置盘环境既有 warning。
- `actionlint .github/workflows/ci.yml`：passed。

## 未验证边界

- 本轮不拆每个 create/update/delete 子权限，先以模块级 `*.manage` 收敛主要业务写操作。
- 不实现角色/管理员删除、外部 IAM/SSO/LDAP/MFA、导出审批或外部 SIEM。
- PostgreSQL/MySQL/Redis/Celery/Docker、真实支付、真实物流和真实自动采购仍不真实验证。

## 下一步

- 继续按生产化边界、外部集成确认和更深浏览器/组件/视觉测试方向拆独立任务。
