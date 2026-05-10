# Agent 执行契约

本文件是后续 AI Agent 的执行合同。任何任务都必须按这里的流程推进。

## 工作循环

1. 读取必读文档。
2. 从 `04-roadmap-and-task-graph.md` 或用户指定中确定唯一任务。
3. 写清关联需求、范围、非目标和验收命令。
4. 读取现有代码和测试，不猜接口。
5. 小步修改代码和文档。
6. 增加或更新测试。
7. 运行验证命令。
8. 写 `docs/agent-runs/YYYY-MM-DD-TASK-ID.md` 摘要证据。
9. 更新相关 backlog、roadmap 或 confirmation register。
10. 汇报修改范围、验证结果、未验证边界和下一步。

## 必读文档

```text
README.md
AGENTS.md
docs/implementation-decisions.md
docs/known-issues-and-roadmap.md
docs/production-readiness-backlog.md
docs/source-report-gap-map.md
docs/delivery-completion-audit.md
docs/next-phase/00-START-HERE.md
docs/next-phase/01-goals-and-scope.md
docs/next-phase/02-requirements-spec.md
docs/next-phase/03-target-architecture.md
docs/next-phase/04-roadmap-and-task-graph.md
docs/next-phase/05-agent-execution-contract.md
docs/next-phase/06-human-confirmation-register.md
```

## 分支和变更规则

- 每个任务从最新 `main` 新建分支。
- 一次只做一个任务。
- 不混入无关重构。
- 不改用户未要求的全局环境。
- 不安装全局依赖。
- Python 使用 backend 本地 `uv` 环境。
- Node 使用 pnpm workspace。
- 有未跟踪或未提交的他人改动时，不得回滚，必须绕开或说明。

## 任务卡模板

```md
# TASK-ID: 标题

## Objective

## Related Requirements

## Background

## Scope

## Non-goals

## Program Directories Affected

## Docs To Update

## Implementation Steps

## Data Model Changes

## API Changes

## Security / RBAC / Audit Changes

## Tests To Add Or Update

## Verification Commands

## Completion Criteria

## Known Boundaries

## Rollback Notes
```

## PR 描述模板

```md
## 背景

## 本次变更

## 关联需求

## 程序目录影响

## 规格/设计文档

## 验证命令

## 未验证边界

## 回滚方式
```

## Agent run 证据模板

```md
# YYYY-MM-DD TASK-ID

## 任务

## 关联需求

## 修改范围

## 关键设计决策

## 验证结果

## 未验证边界

## 后续建议
```

证据记录只写摘要，不粘贴完整日志、完整 diff 或长对话。

## 验证命令矩阵

通用验证：

```bash
npm run evidence
git diff --check
(cd backend && uv run python manage.py check)
(cd backend && uv run python manage.py makemigrations --check --dry-run)
(cd backend && uv run pytest)
pnpm lint
pnpm build
npm run e2e
npm run e2e:browser
```

后端局部验证：

```bash
(cd backend && uv run pytest apps/iam -q)
(cd backend && uv run pytest apps/members -q)
(cd backend && uv run pytest apps/finance -q)
(cd backend && uv run pytest apps/files -q)
(cd backend && uv run pytest apps/parcels -q)
(cd backend && uv run pytest apps/waybills -q)
(cd backend && uv run pytest apps/common -q)
```

前端局部验证：

```bash
pnpm --filter admin-web lint
pnpm --filter admin-web build
pnpm --filter user-web lint
pnpm --filter user-web build
pnpm --filter mobile-h5 lint
pnpm --filter mobile-h5 build
```

生产配置验证：

```bash
(cd backend && DJANGO_SETTINGS_MODULE=config.settings.production DJANGO_SECRET_KEY=test-secret-change-me DJANGO_ALLOWED_HOSTS=localhost uv run python manage.py check)
```

PostgreSQL 验证只有在真实 PostgreSQL 可用时才能执行并标记完成：

```bash
(cd backend && DATABASE_URL=postgres://erp:secret@127.0.0.1:5432/crossborder_test uv run python manage.py migrate)
(cd backend && DATABASE_URL=postgres://erp:secret@127.0.0.1:5432/crossborder_test uv run pytest)
```

## 完成标准

Agent 不能只说“完成”。必须满足：

- 代码实现已完成，或文档任务明确不改代码。
- 规格、设计或 roadmap 已同步更新。
- 测试已新增或解释为什么不需要新增。
- 验证命令已执行，失败项有真实原因和后续处理。
- 未验证能力已标记状态。
- 没有把 fake/local/provider 抽象说成真实接入。
- 对用户可见行为有验收说明。
- 若创建 PR，PR 描述必须反映真实 diff。

## 状态标记

所有新能力必须使用以下状态之一：

```text
not_implemented
planned
local_verified
configured_unverified
sandbox_verified
production_verified
deprecated
blocked_confirm
```

示例：

```text
PostgreSQL: configured_unverified
Storage provider: local_verified
Real object storage: not_implemented
Payment provider abstraction: planned
Real payment gateway: blocked_confirm
```

## 遇到不确定业务规则

遇到以下情况不得脑补：

- 运费公式、偏远费、赔付、禁运。
- 充值、退款、对账、供应商付款。
- 积分、返利、提现、税务、风控。
- 无主包裹认领凭证。
- 高风险操作审批。
- 真实支付、物流、通知、采购平台接入。

处理方式：

1. 在代码或文档中标记 `TODO_CONFIRM`。
2. 更新 `06-human-confirmation-register.md`。
3. 如不确认也可做简版，必须写清简版边界。

## 默认提示词

给后续 AI 的最小指令：

```text
请读取 docs/next-phase/00-START-HERE.md，并按 docs/next-phase/05-agent-execution-contract.md 执行。只选择一张任务卡，先说明关联需求、范围、非目标和验证命令，再开始修改。不得声明未验证能力完成。
```
