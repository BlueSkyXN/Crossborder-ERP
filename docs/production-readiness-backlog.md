# Production Readiness Backlog

本 backlog 接在已完成的 P0/SQLite-first 任务图之后，用于把原始 ChatGPT/Gemini 报告里的生产级缺口逐步收敛。当前仍遵守 no-Docker、SQLite-first、不真实验证 PostgreSQL/MySQL/Redis 的边界。

## Rules

- 每个任务从 `origin/main` 新建隔离分支。
- 每个任务必须本地验证、commit、push、创建 PR、更新 PR 信息、等待 CI、merge 到 `main`、同步本地 `main`。
- 不安装全局依赖，不启动 PostgreSQL/MySQL/Redis/Docker。
- 未真实验证的能力必须标记 `configured_unverified` 或 `not_implemented`。
- 每个正式任务只在 `docs/agent-runs/` 记录摘要证据，避免过细过程日志。

## Task Backlog

| ID | 优先级 | 范围 | 主要交付 | Done 条件 |
| --- | --- | --- | --- | --- |
| `AUDIT-001` | P0 | 源报告差距地图 | `docs/source-report-gap-map.md`、本 backlog、任务图记录 | 文档验证、PR 合并 |
| `ADDR-001` | P0 | 地址簿 | 后端 address app/API；User Web/Mobile 地址列表、新增、编辑、设默认；运单创建可选地址并保留 snapshot | SQLite migration、pytest、三端 build、API E2E 补地址路径 |
| `FILE-001` | P0 | 本地文件服务 | 本地 media 上传、文件元数据、类型/大小限制、业务引用、访问控制策略 | 上传 API 测试；不接对象存储；对象存储标记后续 |
| `FIN-001` | P0 | 线下汇款和财务中心 | 用户提交汇款单和凭证；后台审核通过/取消；钱包入账；用户财务流水页面 | 钱包事务测试、汇款状态测试、三端关键页面 |
| `MSG-001` | P1 | 客服消息/工单 | 用户留言、图片附件、后台回复/处理、用户查看状态 | 消息状态测试、权限隔离测试 |
| `MEMBER-001` | P1 | 后台会员管理 | 会员列表、筛选、冻结/解冻、重置密码、会员等级、客服分配占位 | RBAC/权限测试、后台页面 build |
| `PARCEL-CLAIM-001` | P1 | 无主包裹用户认领 | 用户侧无主包裹列表/搜索/认领；后台审核；认领后转包裹 | 防抢认领事务测试、脱敏展示测试 |
| `CONTENT-001` | P1 | 内容 CMS | 帮助、公告、条款、关于我们、显示/排序；用户端展示 | CRUD 测试、前台读取测试 |
| `IMPORT-001` | P1 | 批量导入/导出基础 | 预报模板下载、Excel 导入、错误明细；通用导出策略 | 不新增系统依赖；优先使用现有 Python 库或标准 CSV fallback |
| `SHIP-BATCH-001` | P2 | 发货批次/转单/打印 | 发货批次模型、运单归批、批量轨迹、转单号、打印模板占位 | 不接硬件；打印只生成模板数据 |
| `PAYABLE-001` | P2 | 供应商/成本/应付 | 供应商、成本类型、应付款、审批/核销基础 | 与应收钱包分离，金额精度测试 |
| `GROWTH-001` | P2 | 积分/推广/返利 | 积分流水、积分兑换占位、邀请关系、返利统计 | 规则不明确项保持 `TODO_CONFIRM` |
| `PURCHASE-AUTO-001` | P3 | 外链解析/自动采购 | 外部链接解析 provider 接口、人工 fallback、合规边界 | 不抓取真实第三方前不声明自动采购完成 |
| `QA-BROWSER-001` | P1 | 浏览器级 E2E | Playwright 或等价浏览器 E2E，覆盖三端 P0 主路 | 先确认浏览器二进制和缓存占用；CI 可重复 |

## Completed Production Gap Tasks

- `ADDR-001`：本轮已补后端 address API、User Web `/addresses`、Mobile H5 `/me/addresses`、运单创建 `address_id` 和 API E2E snapshot 断言。
- `FILE-001`：已补本地 files/media app、文件元数据、类型/大小限制、鉴权下载、包裹入库图片 file id 校验和 Admin Web 上传入口。

## Current Next Task

`FIN-001` 是当前下一项，因为 `FILE-001` 已提供汇款凭证 file id 基础，下一步可以补用户线下汇款提交、后台审核入账和用户财务流水入口。

建议 `FIN-001` 范围：

- 后端扩展 finance 汇款单、状态机、API 和测试。
- 用户提交线下汇款单并引用 `REMITTANCE_PROOF` 文件。
- 后台审核通过后钱包入账，取消后不得入账。
- User Web/Mobile H5 财务入口，Admin Web 汇款审核入口。
- 继续保持 SQLite-first，不接真实支付网关。

## Completion Boundary

只有当本 backlog 中被标为 P0/P1 且未被用户明确排除的项目完成，并且源报告差距地图不再有高优先必做缺口时，才能重新评估“生产级 ERP 是否完成”。在此之前，项目状态应表述为：

`P0 SQLite-first main flows complete; production report parity in progress.`
