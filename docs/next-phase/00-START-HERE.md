# 下一阶段 AI 指挥文档入口

创建日期：2026-05-10

适用仓库：`Crossborder-ERP`

本目录用于指挥后续 AI Agent 继续推进跨境代购与集运 ERP。它不是替代已有的 `docs/ai-dev-baseline/`，而是在当前 P0 SQLite-first 主链路已经完成、`agent-execution/current-state.yaml` 暂无自动下一任务的基础上，补一层“下一阶段控制面”。

## 事实基线

后续 Agent 必须先接受以下事实，再选择任务：

- 当前项目已经具备 Django/DRF 后端、Admin Web、User Web、Mobile H5、SQLite-first 主链路、API E2E、system Chrome browser smoke、审计、RBAC、文件上传、钱包、线下汇款、客服、内容、批量导入、发货批次、应付、积分推广等基础能力。
- `docs/ai-dev-baseline/agent-execution/current-state.yaml` 当前显示 `current_task: null`，`pending_tasks: []`，说明旧任务图已经走完，不能再假装还有自动 next 任务。
- 当前状态仍不能声明生产级完成。PostgreSQL/MySQL/Redis/Celery、真实支付、真实物流、对象存储、病毒扫描、TLS/HSTS、staging、监控告警、恢复演练、审批流、复杂业务规则仍存在未验证边界。
- 另一份 AI 建议的核心方向是正确的：保留 Django monolith，采用领域模块、provider 抽象、生产化验证、IPD 阶段门和 Agent 任务卡，不做推倒重写和大规模一次性搬目录。

## 文档地图

| 文件 | 用途 | 后续 Agent 应如何使用 |
| --- | --- | --- |
| `00-START-HERE.md` | 本入口，说明阅读顺序和当前边界 | 每次接手先读 |
| `01-goals-and-scope.md` | 下一阶段目标、范围、非目标和成功标准 | 判断任务是否应该做 |
| `02-requirements-spec.md` | 需求规格、功能需求、非功能需求和验收口径 | 开发前追溯需求 |
| `03-target-architecture.md` | 目标架构、目录分层、provider 设计和状态标记 | 设计实现方案时引用 |
| `04-roadmap-and-task-graph.md` | 分阶段研发路线、任务依赖和建议优先级 | 选择下一张任务卡 |
| `05-agent-execution-contract.md` | Agent 执行规则、任务模板、证据模板和验证矩阵 | 指挥 AI 实施单任务 |
| `06-human-confirmation-register.md` | 人工确认项清单，防止 AI 脑补业务规则 | 遇到不确定规则时引用 |

## 强制阅读顺序

后续 AI Agent 在改代码前按顺序阅读：

1. `README.md`
2. `AGENTS.md`
3. `docs/implementation-decisions.md`
4. `docs/known-issues-and-roadmap.md`
5. `docs/production-readiness-backlog.md`
6. `docs/source-report-gap-map.md`
7. `docs/delivery-completion-audit.md`
8. `docs/next-phase/00-START-HERE.md`
9. `docs/next-phase/01-goals-and-scope.md`
10. `docs/next-phase/02-requirements-spec.md`
11. `docs/next-phase/03-target-architecture.md`
12. `docs/next-phase/04-roadmap-and-task-graph.md`
13. `docs/next-phase/05-agent-execution-contract.md`
14. `docs/next-phase/06-human-confirmation-register.md`

如任务涉及旧 P0 模块、状态机、API 或前端风格，再回看：

- `docs/ai-dev-baseline/13-integrated-product-spec.md`
- `docs/ai-dev-baseline/14-module-implementation-spec.md`
- `docs/ai-dev-baseline/02-domain-model-state-machines.md`
- `docs/ai-dev-baseline/03-technical-architecture.md`
- `docs/ai-dev-baseline/04-api-database-contract.md`
- `docs/ai-dev-baseline/15-frontend-style-from-screenshots-and-repro.md`

## 默认任务选择原则

如果人类没有指定任务，后续 Agent 只能从 `04-roadmap-and-task-graph.md` 中选择一张任务卡，并且优先级如下：

1. 文档和 Agent 控制面修复，只改文档，不改业务代码。
2. 不依赖外部真实账号、可本地 SQLite 验证的安全和架构基线。
3. 小步样板重构，先选低风险 app 或低风险页面。
4. provider 抽象，必须包含 disabled/local/fake 实现，不能硬接真实第三方。
5. 真实 PostgreSQL、Redis、staging、支付、物流、对象存储等任务，必须有可运行环境或明确沙箱条件，否则只能写计划和边界，不能标记完成。

## 禁止事项

- 禁止推倒重写当前项目。
- 禁止把当前 Django monolith 拆成微服务。
- 禁止一次性全仓目录搬家。
- 禁止把 SQLite-first 版本包装成生产可用。
- 禁止把 DSN 可解析写成 PostgreSQL/MySQL/Redis 已验证。
- 禁止把 fake provider、manual provider、disabled provider 写成真实接入完成。
- 禁止 AI 自己决定运费、赔付、禁运、返利、退款、审批、税务、供应商付款等业务规则。
- 禁止复刻旧系统 UI、品牌、图片、专有实现和文案。

## 完成口径

后续每张任务卡完成时，必须同时满足：

- 关联需求已说明。
- 设计边界已说明。
- 代码和文档同步更新。
- 测试或手工验证已执行。
- 未验证边界明确标记。
- `docs/agent-runs/` 有摘要证据。
- `current-state`、任务图或后续计划按真实状态更新。
