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
| `FIN-001` | P0 | 线下汇款和财务中心 | 用户提交汇款单和凭证；后台审核通过/取消；钱包入账；用户财务流水页面 | 已完成：钱包事务测试、汇款状态测试、三端关键页面 |
| `MSG-001` | P1 | 客服消息/工单 | 用户留言、图片附件、后台回复/处理、用户查看状态 | 已完成：消息状态测试、权限隔离测试、三端入口和 API E2E |
| `MEMBER-001` | P1 | 后台会员管理 | 会员列表、筛选、冻结/解冻、重置密码、会员等级、客服分配占位 | 已完成：RBAC/权限测试、冻结 token 阻断、后台页面 build、API E2E |
| `PARCEL-CLAIM-001` | P1 | 无主包裹用户认领 | 用户侧无主包裹列表/搜索/认领；后台审核；认领后转包裹 | 已完成：防抢认领事务测试、脱敏展示测试、三端入口 |
| `CONTENT-001` | P1 | 内容 CMS | 帮助、公告、条款、关于我们、显示/排序；用户端展示 | 已完成：后台 CRUD/发布隐藏、三端入口、公开读取测试 |
| `IMPORT-001` | P1 | 批量导入/导出基础 | 预报模板下载、CSV 导入、错误明细；会员/后台导出策略 | 已完成：不新增依赖，使用标准 CSV parser |
| `IMPORT-XLSX-001` | P1 | Excel 批量预报解析 | `.xlsx` 模板下载、标准工作簿解析、错误记录复用现有导入 job | 已完成：不新增依赖，使用 Python 标准库读取 `.xlsx`；旧 `.xls` 需另存 |
| `QA-BROWSER-001` | P1 | 浏览器级 E2E | system Chrome CDP 三端 smoke，覆盖登录和关键页面 | 已完成：不下载浏览器，不使用用户 profile，CI 可重复 |
| `SHIP-BATCH-001` | P2 | 发货批次/转单/打印 | 发货批次模型、运单归批、批量轨迹、转单号、打印模板占位 | 已完成：不接硬件；打印只生成模板数据 |
| `PAYABLE-001` | P2 | 供应商/成本/应付 | 供应商、成本类型、应付款、审批/核销基础 | 已完成：与应收钱包分离，金额精度和状态测试 |
| `GROWTH-001` | P2 | 积分/推广/返利 | 积分流水、积分兑换占位、邀请关系、返利统计 | 已完成基础；规则不明确项保持 `TODO_CONFIRM` |
| `AUDITLOG-001` | P2 | 操作审计日志 | `audit_logs`、后台写操作审计、财务高风险服务层审计、Admin Web 查询入口 | 已完成基础；敏感字段脱敏，长期归档后续 |
| `PURCHASE-AUTO-001` | P3 | 外链解析/自动采购 | 外部链接解析 provider 接口、人工 fallback、合规边界 | 不抓取真实第三方前不声明自动采购完成 |

## Completed Production Gap Tasks

- `ADDR-001`：本轮已补后端 address API、User Web `/addresses`、Mobile H5 `/me/addresses`、运单创建 `address_id` 和 API E2E snapshot 断言。
- `FILE-001`：已补本地 files/media app、文件元数据、类型/大小限制、鉴权下载、包裹入库图片 file id 校验和 Admin Web 上传入口。
- `FIN-001`：已补用户线下汇款提交、`REMITTANCE_PROOF` 凭证校验、后台财务审核通过/取消、钱包入账防重、User Web/Mobile H5 财务中心和 Admin Web 汇款审核入口。
- `MSG-001`：已补 tickets/messages app、`MESSAGE_ATTACHMENT` 附件校验、后台 `tickets.view` 权限、用户/后台回复状态机、Admin Web/User Web/Mobile H5 工单入口和 API E2E 工单往返。
- `MEMBER-001`：已补后台会员列表/筛选/详情、会员资料维护、冻结/解冻、测试密码重置、客服负责人和内部服务备注；Admin Web `/members` 已从占位页升级为真实管理面板。
- `PARCEL-CLAIM-001`：已补用户侧无主包裹脱敏列表/搜索/认领 API，后台认领通过/驳回审核，审核通过后转为会员 `Parcel.IN_STOCK`；User Web、Mobile H5 和 Admin Web 已补入口和操作。
- `CONTENT-001`：已补内容分类/内容条目模型、后台 CRUD、发布/隐藏、公开只读 API、Admin Web 内容管理页、User Web `/content` 和 Mobile H5 `/me/content` 展示入口；条款/隐私正式文案仍需业务/法务确认。
- `IMPORT-001`：已补包裹预报 CSV 模板下载、`IMPORT_FILE` 上传后批量导入、行级错误明细、`ParcelImportJob` 结果记录、会员包裹导出和后台 `parcels.view` CSV 导出。
- `IMPORT-XLSX-001`：已补 `.xlsx` 批量预报模板下载、标准工作簿解析、行级校验复用和 all-or-none 导入事务；未新增 Python/Node 依赖。旧版二进制 `.xls` 需另存为 `.xlsx` 或 CSV。
- `QA-BROWSER-001`：已补 system Chrome CDP 浏览器 smoke，自动启动临时 SQLite/media/profile 下的后端和三端前端，覆盖 Admin Web、User Web、Mobile H5 登录和关键页面，并纳入 CI `Browser Smoke` job；不下载浏览器，不使用用户日常 Chrome profile。
- `SHIP-BATCH-001`：已补后台发货批次模型/API，支持创建批次、待发货运单归批/移出、锁定后批量发货、批量轨迹、转单号和承运商批次号；Admin Web 运单处理页已增加批次列表、详情、归批、批量发货和面单/拣货单/交接单打印模板数据预览入口。打印仍只生成结构化模板数据，不接真实硬件。
- `PAYABLE-001`：已补后台供应商、成本类型和应付款模型/API，支持应付款待审核、确认、核销和取消状态流；Admin Web 财务页已增加应付款、供应商和成本类型入口，API E2E 和 Browser Smoke 已覆盖基础链路。真实银行付款、自动打款和外部财务系统同步仍未接入。
- `GROWTH-001`：已补会员积分流水、邀请关系、返利记录和奖励积分统计；Admin Web 会员详情可审计积分/邀请/返利并可手工调整积分，User Web 和 Mobile H5 个人中心已展示积分推广入口；API E2E、后端测试和 Browser Smoke 已覆盖基础链路。真实联盟、提现、税务、多级分销和最终积分/返利规则仍未接入。
- `AUDITLOG-001`：已补 `apps.audit`、`audit_logs` 数据表、后台 `/api/v1/admin/**` 写操作请求级审计、财务应付/汇款/钱包人工调整服务层审计、敏感字段脱敏和 Admin Web `/audit-logs` 查询入口；API E2E 和 Browser Smoke 已覆盖审计日志入口。长期归档、外部 SIEM、审计告警和细粒度权限后续补齐。

## Current Next Task

任务图中的 `IMPORT-XLSX-001` 已完成，当前没有自动确定的下一张任务卡。后续如果继续补生产级差距，建议优先从以下方向单独开任务：

- 完整浏览器旅程增强：在 system Chrome CDP smoke 之外补更完整业务流、视觉回归或组件级测试。
- 生产化边界：补对象存储、PostgreSQL/MySQL/Redis 真实验证计划、日志归档、告警和部署验证。
- 需业务/合规确认的外部集成：真实支付、真实物流 API、自动采购和外部商品抓取。

## Completion Boundary

只有当本 backlog 中被标为 P0/P1 且未被用户明确排除的项目完成，并且源报告差距地图不再有高优先必做缺口时，才能重新评估“生产级 ERP 是否完成”。在此之前，项目状态应表述为：

`P0 SQLite-first main flows complete; production report parity in progress.`
