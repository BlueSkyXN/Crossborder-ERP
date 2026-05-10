# 下一阶段研发路线与任务图

本文件把下一阶段拆成可交给 AI Agent 执行的任务图。旧 `agent-execution/task-graph.yaml` 已完成到 `RBAC-IAM-ACTIONS-001`，本文件用于后续新任务选择。

## 执行总原则

- 一次只做一张任务卡。
- 每张任务卡都必须关联 `02-requirements-spec.md` 中的需求。
- 能本地验证的任务优先。
- 真实外部依赖任务必须具备环境、账号、沙箱或人工确认。
- 不做超大 PR，不做全仓一次性重构。
- 任务完成后更新文档、测试、证据和后续状态。

## 阶段图

```text
P7_CONTROL_PLANE
  -> P8_ARCHITECTURE_BASELINE
  -> P9_TRIAL_RUN_HARDENING
  -> P10_PROVIDER_ABSTRACTION
  -> P11_VERIFICATION_DEPTH
  -> P12_RELEASE_AND_LIFECYCLE
```

## P7_CONTROL_PLANE：控制面和规格基线

| 任务 | 目标 | 范围 | 验收 |
| --- | --- | --- | --- |
| NEXT-DOCS-001 | 建立下一阶段指挥文档 | `docs/next-phase/`、`docs/README.md` | 文档存在、链接可达、无代码行为变更 |
| NEXT-TASKGRAPH-001 | 将下一阶段任务固化为机器可读 task graph | 可选新增 `docs/next-phase/task-graph.yaml` 或扩展现有 agent-execution | `npm run evidence` 仍通过，任务依赖清晰 |
| NEXT-ADR-001 | 补最小 ADR | `docs/adr/` | ADR 覆盖 monolith、provider、PostgreSQL、no big-bang refactor |

默认先完成 `NEXT-DOCS-001`，后续是否创建 YAML 任务图由人工确认。

## P8_ARCHITECTURE_BASELINE：程序架构样板

| 任务 | 关联需求 | 目标 | 影响目录 | 验收命令 |
| --- | --- | --- | --- | --- |
| ARCH-BACKEND-001 | NFR-AI-001 | 选一个低风险 app 建立 selectors/services/providers 分层样板 | `backend/apps/content/` 或 `backend/apps/addresses/`、`docs/next-phase/03-target-architecture.md` | `cd backend && uv run pytest apps/content -q`、`npm run e2e` |
| ARCH-FRONTEND-001 | NFR-AI-001 | 选一个低风险页面建立 feature 分层样板 | `admin-web/src/features/auth/` 或 `user-web/src/pages/AddressesPage.tsx` | `pnpm lint`、`pnpm build`、`npm run e2e:browser` |
| ARCH-CONTRACT-001 | NFR-DATA-001 | 整理 API error、分页、金额和权限契约检查 | `docs/ai-dev-baseline/04-api-database-contract.md`、相关 tests | 后端 API tests、OpenAPI 生成 |

建议先做 `ARCH-BACKEND-001`，且不要先动 `finance`、`waybills`、`parcels`。

## P9_TRIAL_RUN_HARDENING：试运行硬基础

| 任务 | 关联需求 | 目标 | 前置条件 | 验收命令 |
| --- | --- | --- | --- | --- |
| PROD-SETTINGS-001 | REQ-OPS-001、NFR-SEC-001 | production settings 安全硬化 | 无 | production check、common tests、`git diff --check` |
| DB-POSTGRES-001 | REQ-OPS-003、REQ-FIN-001 | PostgreSQL 真实验证 | 本地或 CI PostgreSQL 可用 | migrate、pytest、E2E、钱包并发测试 |
| AUTH-HARDEN-001 | REQ-AUTH-001、REQ-AUTH-002 | 登录限流、密码策略、token 失效 | 无 | iam/members tests、三端 build、E2E |
| STORAGE-PROVIDER-001 | REQ-STORAGE-001、REQ-STORAGE-002 | StorageProvider 和 VirusScanProvider 抽象 | 无 | files tests、E2E |
| OBSERVABILITY-001 | REQ-OPS-002、NFR-OBS-001 | 结构化日志、readiness 扩展、告警文档 | 可接在 storage provider 后 | common tests、health/readiness 验证 |
| BACKUP-RESTORE-001 | NFR-OPS-002 | 数据和文件恢复演练 | DB/storage 路线确认 | runbook、恢复验证记录 |
| DEPLOY-STAGING-001 | REQ-OPS-002 | no-Docker 或 Docker staging 部署基线 | 部署方式人工确认 | staging runbook、TLS/readiness/browser smoke |

若当前仍不允许 Docker，`DEPLOY-STAGING-001` 默认走 no-Docker staging 方案。

## P10_PROVIDER_ABSTRACTION：外部系统 provider

| 任务 | 关联需求 | 目标 | 最低实现 | 不得声明 |
| --- | --- | --- | --- | --- |
| PAYMENT-PROVIDER-001 | REQ-FIN-002 | 支付 provider 抽象 | Offline/Fake/Disabled | 真实支付完成 |
| LOGISTICS-PROVIDER-001 | REQ-LOGISTICS-001 | 物流 provider 抽象 | Manual/Fake/Disabled | 真实面单和轨迹回调完成 |
| NOTIFICATION-PROVIDER-001 | REQ-NOTIFY-001 | 通知 provider 抽象 | Disabled/Console/Fake | 真实短信、邮件、微信送达 |
| PROCUREMENT-PROVIDER-001 | REQ-PROC-001 | 自动采购 provider 边界 | Manual/Disabled，公开链接解析 | 未授权抓取和自动下单 |
| AUDIT-APPROVAL-001 | REQ-IAM-001、REQ-AUDIT-001 | 高风险操作审批流基础 | 导出审批或财务调整审批样板 | 完整合规体系 |

Provider 任务的默认完成状态只能是 `local_verified`，除非提供真实 sandbox 或 production 证据。

## P11_VERIFICATION_DEPTH：测试和验证深度

| 任务 | 关联需求 | 目标 | 前置条件 | 验收 |
| --- | --- | --- | --- | --- |
| TEST-PLAYWRIGHT-001 | REQ-QA-002 | 引入可维护 Playwright E2E | 允许新增依赖和浏览器缓存策略 | 不删除现有 browser smoke，新增关键旅程 |
| TEST-COMPONENT-001 | REQ-QA-002 | 前端组件级测试基线 | 确认测试框架 | 至少覆盖高风险表单和权限按钮 |
| PERF-BASELINE-001 | REQ-QA-003 | 性能基线 | 数据规模目标确认 | P95、并发、导入导出、钱包并发报告 |
| SECURITY-REVIEW-001 | NFR-SEC-002 | 安全审查 | production settings/auth/storage 完成 | threat model、漏洞清单、修复任务 |

## P12_RELEASE_AND_LIFECYCLE：发布和生命周期

| 任务 | 目标 | 验收 |
| --- | --- | --- |
| RELEASE-RUNBOOK-001 | 发布、回滚、备份、恢复和事故流程 | runbook 和演练记录 |
| INCIDENT-BASELINE-001 | 最小事故响应流程 | 告警、分级、恢复和复盘模板 |
| LIFECYCLE-ROADMAP-001 | 试运行后迭代路线 | 基于真实反馈更新需求池 |

## 推荐执行顺序

默认顺序：

1. `NEXT-DOCS-001`
2. `NEXT-ADR-001`
3. `PROD-SETTINGS-001`
4. `AUTH-HARDEN-001`
5. `STORAGE-PROVIDER-001`
6. `OBSERVABILITY-001`
7. `ARCH-BACKEND-001`
8. `DB-POSTGRES-001`
9. `PAYMENT-PROVIDER-001`
10. `LOGISTICS-PROVIDER-001`
11. `NOTIFICATION-PROVIDER-001`
12. `AUDIT-APPROVAL-001`
13. `TEST-PLAYWRIGHT-001`
14. `PERF-BASELINE-001`
15. `DEPLOY-STAGING-001`

如果没有 PostgreSQL、staging、支付、物流、通知等外部环境，先跳过真实验证任务，选择本地可验证的 provider 抽象、认证安全、测试增强或审批样板。

## 单任务完成标准

每张任务卡必须包含：

```text
Task ID
Objective
Related requirements
Scope
Non-goals
Program directories affected
Docs to update
Implementation steps
Data model changes
API changes
Security/RBAC/Audit changes
Tests to add/update
Verification commands
Completion criteria
Known boundaries
Rollback notes
```
