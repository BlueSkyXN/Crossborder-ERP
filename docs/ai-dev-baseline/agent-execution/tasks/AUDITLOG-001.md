# AUDITLOG-001 操作审计日志

## 背景

源报告和 `ai-dev-baseline` 多处要求后台关键操作写入操作日志。`GROWTH-001` 完成后，源报告差距地图仍将审计日志列为生产级必补缺口。

## 目标

- 新增 `audit_logs` 数据表，记录后台关键写操作。
- 后台 `/api/v1/admin/**` 写操作默认进入请求级审计。
- 财务高风险动作补服务层审计，覆盖钱包人工调整、线下汇款审核和应付状态流。
- Admin Web 增加审计日志查询入口。
- 敏感字段不得以明文进入审计日志。

## 范围

- Backend：
  - `apps.audit`、model、migration、serializer、API、middleware。
  - `GET /api/v1/admin/audit-logs`。
  - IAM 菜单权限 `audit.logs.view`。
  - 财务服务层关键动作调用审计 helper。
- Admin Web：
  - `/audit-logs` 页面。
  - 菜单和路由接入。
- QA：
  - 后端审计单测。
  - API E2E 补审计日志断言。
  - Browser Smoke 覆盖 Admin Web 审计日志入口。

## 非目标

- 不接外部 SIEM。
- 不做长期归档和保留期策略。
- 不拆分 RBAC create/update/delete 细粒度权限。
- 不引入新外部依赖，不启动 PostgreSQL/MySQL/Redis/Docker。

## Done 条件

- `audit_logs` migration 可检查。
- 敏感字段脱敏测试通过。
- 审计日志查询权限测试通过。
- API E2E 和 Browser Smoke 能覆盖审计日志入口。
- README、gap map、backlog、known issues、current-state 和 Agent run 更新。
