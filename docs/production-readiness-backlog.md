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
| `QA-BROWSER-002` | P1 | 浏览器真实业务旅程 | 会员预报、后台扫描入库、会员回看在库的跨端浏览器表单流 | 已完成：沿用 system Chrome CDP，不新增依赖和浏览器下载 |
| `QA-BROWSER-003` | P1 | Browser Smoke 稳定性 | CDP 导航等待加固、页面快照诊断、失败服务日志输出 | 已完成：不新增依赖，不下载浏览器 |
| `CI-EVIDENCE-001` | P1 | Agent 证据门禁 | 校验任务图、current-state、Agent run 摘要和未验证边界 | 已完成：标准库 Python，无新增依赖 |
| `SHIP-BATCH-001` | P2 | 发货批次/转单/打印 | 发货批次模型、运单归批、批量轨迹、转单号、打印模板占位 | 已完成：不接硬件；打印只生成模板数据 |
| `PAYABLE-001` | P2 | 供应商/成本/应付 | 供应商、成本类型、应付款、审批/核销基础 | 已完成：与应收钱包分离，金额精度和状态测试 |
| `GROWTH-001` | P2 | 积分/推广/返利 | 积分流水、积分兑换占位、邀请关系、返利统计 | 已完成基础；规则不明确项保持 `TODO_CONFIRM` |
| `AUDITLOG-001` | P2 | 操作审计日志 | `audit_logs`、后台写操作审计、财务高风险服务层审计、Admin Web 查询入口 | 已完成基础；敏感字段脱敏，长期归档后续 |
| `AUDIT-RETENTION-001` | P2 | 审计导出和本地留存 | 审计日志 CSV 导出、显式留存清理命令 | 已完成基础；外部 SIEM/告警仍后续 |
| `SECURITY-HEADERS-001` | P2 | 基础应用安全响应头 | `nosniff`、Referrer Policy、COOP、X-Frame-Options、Permissions Policy 和环境变量边界 | 已完成基础；TLS/HSTS/staging 仍后续验证 |
| `OPS-READINESS-001` | P2 | 运维 readiness 检查 | `/api/v1/health/ready`、默认数据库连接检查、503 脱敏失败响应 | 已完成基础；外部监控/告警仍后续 |
| `OPS-SQLITE-BACKUP-001` | P2 | SQLite 本地备份 | `backup_sqlite` 命令、dry-run、覆盖保护、file-backed SQLite 边界测试 | 已完成基础；生产数据库/远程备份仍后续 |
| `STORAGE-CLEANUP-001` | P2 | 本地文件清理 | `purge_deleted_files` 命令、软删除保留期、dry-run、路径安全 | 已完成基础；对象存储生命周期仍后续 |
| `PURCHASE-AUTO-001` | P3 | 外链解析/自动采购 | 外部链接解析 provider 接口、人工 fallback、合规边界 | 已完成基础；不抓取真实第三方前不声明自动采购完成 |
| `ACCOUNT-SETTINGS-001` | P3 | 会员注册与账户设置 | 前台注册入口、会员自助资料设置、会员自助改密码 | 已完成基础；不接短信/邮件/验证码/找回密码 |
| `ADMIN-PANELS-001` | P3 | 后台占位面板真实化 | Admin dashboard 真实聚合接口、角色权限真实面板、browser smoke 覆盖 | 已完成基础；角色写操作由 `RBAC-ROLES-001` 承接 |
| `RBAC-ROLES-001` | P3 | 角色权限管理闭环 | 角色创建、编辑、权限分配、独立 manage 权限、`super_admin` 保护 | 已完成基础；角色删除和后台用户分配角色由后续任务处理 |
| `RBAC-ADMIN-USERS-001` | P3 | 管理员账号与角色分配 | 管理员账号列表、新增、启停、密码重置、角色分配、独立 manage 权限 | 已完成基础；账号删除和外部 IAM 由后续任务处理 |
| `RBAC-BUSINESS-ACTIONS-001` | P3 | 业务写操作权限拆分 | 后台业务写接口、Admin Web 写按钮和导出入口按 `*.manage` / `*.export` 权限控制 | 已完成模块级拆分；create/update/delete 子权限和审批流后续 |
| `CONFIG-EXTERNAL-SERVICES-001` | P3 | 外部服务 DSN 边界检查 | `DATABASE_URL`/`REDIS_URL`/Celery eager 的无连接检查脚本、settings helper 和测试 | 已完成配置解析；不安装驱动、不连接 PostgreSQL/MySQL/Redis |
| `RBAC-DELETE-001` | P3 | 角色与管理员安全删除 | 角色删除、管理员账号删除、内置/自删/已分配保护、Admin Web 删除入口 | 已完成基础；外部 IAM 和审批流后续 |
| `FILE-SNIFF-001` | P3 | 文件上传内容签名校验 | 扩展名/MIME/文件头一致性校验，拦截伪装图片/PDF/XLS/XLSX | 已完成基础；病毒扫描、缩略图、对象存储后续 |

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
- `QA-BROWSER-002`：已在同一 Browser Smoke 中补真实跨端业务旅程：User Web 创建包裹预报，Admin Web 扫描同一快递单号入库，User Web 搜索回看在库状态和申请打包入口；仍不引入 Playwright 或浏览器下载。
- `QA-BROWSER-003`：已加固现有 CDP Browser Smoke 的导航等待、文本断言失败快照和失败服务日志输出；PR #49 合并后出现的 Admin Web 登录页偶发等待问题由同一 merge commit 重跑通过，本任务进一步降低后续误判并提升 CI 可诊断性。
- `CI-EVIDENCE-001`：已补 `scripts/ci/validate_agent_evidence.py` 和 CI `Agent Evidence` job，校验任务图、current-state、任务文件、Agent run 摘要、验证结果和未验证边界说明，避免证明材料出现缺失或占位记录。
- `SHIP-BATCH-001`：已补后台发货批次模型/API，支持创建批次、待发货运单归批/移出、锁定后批量发货、批量轨迹、转单号和承运商批次号；Admin Web 运单处理页已增加批次列表、详情、归批、批量发货和面单/拣货单/交接单打印模板数据预览入口。打印仍只生成结构化模板数据，不接真实硬件。
- `PAYABLE-001`：已补后台供应商、成本类型和应付款模型/API，支持应付款待审核、确认、核销和取消状态流；Admin Web 财务页已增加应付款、供应商和成本类型入口，API E2E 和 Browser Smoke 已覆盖基础链路。真实银行付款、自动打款和外部财务系统同步仍未接入。
- `GROWTH-001`：已补会员积分流水、邀请关系、返利记录和奖励积分统计；Admin Web 会员详情可审计积分/邀请/返利并可手工调整积分，User Web 和 Mobile H5 个人中心已展示积分推广入口；API E2E、后端测试和 Browser Smoke 已覆盖基础链路。真实联盟、提现、税务、多级分销和最终积分/返利规则仍未接入。
- `AUDITLOG-001`：已补 `apps.audit`、`audit_logs` 数据表、后台 `/api/v1/admin/**` 写操作请求级审计、财务应付/汇款/钱包人工调整服务层审计、敏感字段脱敏和 Admin Web `/audit-logs` 查询入口；API E2E 和 Browser Smoke 已覆盖审计日志入口。长期归档、外部 SIEM、审计告警和细粒度权限后续补齐。
- `AUDIT-RETENTION-001`：已补 `/api/v1/admin/audit-logs/export.csv` 脱敏 CSV 导出、Admin Web 导出入口和 `purge_audit_logs --older-than-days` 显式本地留存清理命令；外部 SIEM、自动归档、告警和导出审批后续补齐。
- `SECURITY-HEADERS-001`：已补后端基础安全响应头配置和 `/api/v1/health` 回归测试，覆盖 `X-Content-Type-Options`、`Referrer-Policy`、`Cross-Origin-Opener-Policy`、`X-Frame-Options` 和 `Permissions-Policy`；真实 TLS、HSTS、反向代理和 staging 域名仍后续验证。
- `OPS-READINESS-001`：已补 `/api/v1/health/ready` readiness endpoint，当前检查默认数据库连接；依赖不可用时返回 HTTP 503 和脱敏状态，不暴露 DSN、异常堆栈或本地路径。Prometheus/Sentry/外部告警和真实 staging 仍后续验证。
- `OPS-SQLITE-BACKUP-001`：已补 `backup_sqlite` management command，支持 dry-run、输出目录、文件名和显式覆盖，默认输出到 ignored 的 `backend/backups/`；该命令仅覆盖当前 SQLite-first 本地备份，不声明 PostgreSQL/MySQL 或远程备份完成。
- `STORAGE-CLEANUP-001`：已补 `purge_deleted_files` management command，只清理超过保留期的 `StoredFile.DELETED` 本地物理文件，支持 dry-run、missing/unsafe 统计和路径逃逸保护；对象存储生命周期、病毒扫描、缩略图和 CDN 仍后续补齐。
- `PURCHASE-AUTO-001`：已补 `purchase-links/parse` 外部商品链接解析入口，User Web 和 Mobile H5 手工代购页可把解析结果填入商品行；当前只做 host/item id/URL 规范化和人工确认备注，不抓取真实第三方页面、不自动下单。
- `ACCOUNT-SETTINGS-001`：已补会员自助改密码 API、User Web/H5 注册并自动登录入口、Web `/settings` 和 H5 `/me/settings` 账户设置页；当前不接短信/邮件验证码、找回密码或第三方登录。
- `ADMIN-PANELS-001`：已把 Admin Web `/dashboard` 和 `/roles` 从通用占位工作台替换为真实面板。Dashboard 由 `GET /api/v1/admin/dashboard` 按角色权限返回真实模块指标、工作队列和最近审计动作；角色权限页读取真实角色和权限覆盖矩阵。
- `RBAC-ROLES-001`：已补 `iam.role.manage` 写权限、权限列表 API、角色创建/编辑 API 和 Admin Web `/roles` 新增/编辑弹窗；`super_admin` 内置角色不可编辑。角色删除、后台用户分配角色和外部 IAM 仍后续补齐。
- `RBAC-ADMIN-USERS-001`：已补 `iam.admin.view` / `iam.admin.manage`，新增后台管理员账号 API 和 Admin Web `/admin-users` 页面，支持创建普通管理员、启停账号、重置密码和分配角色；内置超级管理员账号不可编辑，当前登录管理员不可修改自己的状态、角色或密码。账号删除和外部 IAM/SSO/MFA 仍后续补齐。
- `RBAC-BUSINESS-ACTIONS-001`：已补 `members.manage`、`warehouses.manage`、`parcels.manage`、`parcels.export`、`waybills.manage`、`finance.manage`、`files.manage`、`purchases.manage`、`products.manage`、`tickets.manage`、`content.manage`、`audit.logs.export`、`growth.view` 和 `growth.manage`；后台业务写接口和 Admin Web 写入口已按模块级 action 权限控制。每个 create/update/delete 子动作和审批流仍后续补齐。
- `CONFIG-EXTERNAL-SERVICES-001`：已补 `npm run inspect:services` 和 `inspect_configured_services`，可在不执行 Django setup、不安装数据库驱动、不连接外部服务的情况下检查 SQLite/PostgreSQL/MySQL/Redis/Celery 配置边界；PostgreSQL/MySQL/Redis/Celery 仍为 `configured_unverified`。
- `RBAC-DELETE-001`：已补 `DELETE /api/v1/admin/roles/{id}` 和 `DELETE /api/v1/admin/admin-users/{id}`，Admin Web `/roles` 和 `/admin-users` 已显示删除入口；内置超级管理员角色/账号、当前登录管理员和已分配角色受保护。
- `FILE-SNIFF-001`：已补上传文件扩展名、MIME 和基础内容签名一致性校验，覆盖 JPEG/PNG/WEBP/GIF/PDF/旧 `.xls`/标准 `.xlsx`，CSV 轻量拦截 NUL 二进制内容；不新增依赖，不声明病毒扫描或对象存储完成。

## Current Next Task

任务图中的 `FILE-SNIFF-001` 已完成，当前没有自动确定的下一张任务卡。后续如果继续补生产级差距，建议优先从以下方向单独开任务：

- 生产化边界：补对象存储、病毒扫描、PostgreSQL/MySQL/Redis 真实连接/迁移验证计划、告警和部署验证。
- 需业务/合规确认的外部集成：真实支付、真实物流 API、真实自动采购下单和外部商品抓取。
- 测试深度增强：在现有 system Chrome CDP smoke 和一条真实业务旅程之外，补视觉回归、组件级测试或更多复杂浏览器流。

## Completion Boundary

只有当本 backlog 中被标为 P0/P1 且未被用户明确排除的项目完成，并且源报告差距地图不再有高优先必做缺口时，才能重新评估“生产级 ERP 是否完成”。在此之前，项目状态应表述为：

`P0 SQLite-first main flows complete; production report parity in progress.`
