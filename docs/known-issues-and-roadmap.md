# 已知问题和下一阶段计划

## 源报告差距审计

`DOC-001` 完成的是 SQLite-first P0 主链路交付，不等于完整满足原始 ChatGPT/Gemini 两套分析报告。`AUDIT-001` 已把源报告与当前实现的差距拆到：

- `docs/source-report-gap-map.md`
- `docs/production-readiness-backlog.md`

`ADDR-001` 已补齐基础地址簿，`FILE-001` 已补齐本地文件上传基础，`FILE-SNIFF-001` 已补齐上传文件基础内容签名校验，`FIN-001` 已补齐用户线下汇款、后台审核和财务中心入口，`MSG-001` 已补齐客服工单，`MEMBER-001` 已补齐后台会员管理，`PARCEL-CLAIM-001` 已补齐无主包裹用户认领，`CONTENT-001` 已补齐内容 CMS 和帮助公告展示，`IMPORT-001` 已补齐 CSV 批量预报导入/导出基础，`IMPORT-XLSX-001` 已补齐 Excel `.xlsx` 批量预报解析，`CSV-EXPORT-SAFE-001` 已补齐 CSV 导出公式注入防护，`QA-BROWSER-001` 已补齐三端浏览器 smoke 基础，`QA-BROWSER-002` 已补齐会员预报、后台扫描入库、会员回看在库的一条真实浏览器旅程，`QA-BROWSER-003` 已加固 Browser Smoke 稳定性，`QA-BROWSER-004` 已补齐财务/客服跨面板浏览器旅程，`QA-BROWSER-005` 已补齐运单后半程浏览器旅程，`SHIP-BATCH-001` 已补齐发货批次、转单号和打印模板数据预览基础，`PAYABLE-001` 已补齐供应商、成本类型和应付状态流基础，`GROWTH-001` 已补齐积分推广返利基础，`AUDITLOG-001` 已补齐后台关键写操作审计日志，`AUDIT-RETENTION-001` 已补齐审计日志脱敏 CSV 导出和显式本地留存清理命令，`SECURITY-HEADERS-001` 已补齐基础应用安全响应头，`OPS-READINESS-001` 已补齐运维 readiness 检查，`OPS-SQLITE-BACKUP-001` 已补齐 SQLite 本地备份命令，`STORAGE-CLEANUP-001` 已补齐本地软删除文件清理命令，`PURCHASE-AUTO-001` 已补齐外部商品链接解析和人工代购 fallback 入口，`ACCOUNT-SETTINGS-001` 已补齐会员注册、账户资料设置和自助改密码基础，`ACCOUNT-RESET-001` 已补齐会员找回密码和重置密码闭环，`ADMIN-PANELS-001` 已补齐后台 dashboard/roles 真实接口面板，`RBAC-ROLES-001` 已补齐角色创建、编辑和权限分配闭环，`RBAC-ADMIN-USERS-001` 已补齐管理员账号与角色分配闭环，`RBAC-BUSINESS-ACTIONS-001` 已补齐后台业务写操作的模块级 action 权限拆分，`CONFIG-EXTERNAL-SERVICES-001` 已补齐 PostgreSQL/MySQL/Redis/Celery 的无连接 DSN 边界检查，`RBAC-DELETE-001` 已补齐角色与管理员账号安全删除闭环。后续优先按生产化边界、需业务/合规确认的外部集成和测试深度增强逐项收敛。

## 已知问题

### PostgreSQL/MySQL 未真实验证

问题：当前唯一真实验证数据库是 SQLite。
影响：事务隔离、行级锁、JSON 字段、大小写和索引行为可能与生产数据库不同。
当前临时处理：服务层已使用事务和幂等结构；`DATABASE_URL` 可解析 PostgreSQL/MySQL DSN 并由 `npm run inspect:services` 标记为 `configured_unverified`，该脚本不执行 Django setup、不连接数据库。
后续建议：单独建立 PostgreSQL/MySQL 验证任务，覆盖迁移、并发钱包扣款和关键查询。
是否阻塞 v0.1：否，当前 v0.1 按 SQLite-first 验收。

### Redis/Celery 未真实验证

问题：当前使用本地内存缓存和同步任务模式。
影响：无法覆盖真实 broker、重试、序列化、并发和失败补偿。
当前临时处理：`CELERY_TASK_ALWAYS_EAGER=true`，P0 关键流程不依赖异步任务完成；`REDIS_URL` 可由 `npm run inspect:services` 做无连接 DSN 检查并标记为 `configured_unverified`。
后续建议：接入 Redis/Celery 后增加异步任务测试和可观测性。
是否阻塞 v0.1：否。

### Docker Compose 暂缓

问题：当前没有已验证的 `docker-compose.yml`。
影响：不能声明一键容器化部署已完成。
当前临时处理：README 和部署文档使用 no-Docker local-first 命令；Docker 化方案只保留为后续拓扑。
后续建议：确认用户恢复 Docker 需求后再补 compose、镜像构建、Nginx 和 staging 验证。
是否阻塞 v0.1：否，用户当前明确暂不考虑 Docker。

### TLS、HSTS 和真实反向代理未验证

问题：`SECURITY-HEADERS-001` 已补基础响应头，但真实 HTTPS、HSTS、反向代理转发头、staging 域名和 CDN 策略尚未验证。
影响：当前可以证明应用层输出最小安全 header，但不能声明已完成生产 TLS/HSTS 安全上线。
当前临时处理：默认输出 `X-Content-Type-Options`、`Referrer-Policy`、`Cross-Origin-Opener-Policy`、`X-Frame-Options` 和 `Permissions-Policy`；`SECURE_HSTS_SECONDS` 与 `SECURE_SSL_REDIRECT` 默认关闭，仅通过环境变量开启。
后续建议：staging 域名、证书和反向代理确认后，单独验证 HTTPS redirect、HSTS preload/subdomain 策略和静态资源 header。
是否阻塞 v0.1：否。

### 外部监控、告警和真实 staging 可观测性未验证

问题：`OPS-READINESS-001` 已补 `/api/v1/health/ready`，但尚未接 Prometheus、Sentry、日志聚合、告警规则或真实 staging 探针。
影响：当前可以本地验证应用是否能检查默认数据库连接，但不能声明已完成生产监控或告警体系。
当前临时处理：readiness 只返回有限状态，数据库不可用时返回 HTTP 503 和脱敏 `checks.database: unavailable`。
后续建议：staging 部署后接入外部监控、错误追踪、日志聚合和告警阈值，再扩展 Redis/Celery/对象存储等真实依赖检查。
是否阻塞 v0.1：否。

### 生产数据库备份、远程备份和恢复演练未验证

问题：`OPS-SQLITE-BACKUP-001` 已补 SQLite 本地显式备份命令，但 PostgreSQL/MySQL 生产备份、远程备份、加密、轮转、恢复演练和告警尚未验证。
影响：当前可以保护 SQLite-first 本地验收数据，但不能声明具备完整生产级灾备体系。
当前临时处理：`backup_sqlite` 默认输出到 ignored 的 `backend/backups/`，支持 dry-run、覆盖保护和 file-backed SQLite 边界校验；命令不会自动运行。
后续建议：真实数据库验证后补 `pg_dump`/MySQL 备份策略、对象存储或离线介质、加密、定期恢复演练和告警。
是否阻塞 v0.1：否。

### 浏览器测试深度仍需增强

问题：当前 `npm run e2e:browser` 已覆盖三端 smoke，并补了会员预报/后台扫描入库/会员回看在库、User Web 线下汇款、Admin Web 汇款审核入账、User Web 创建客服工单、Admin Web 回复工单、User Web 回看客服回复、User Web 创建运单、Admin Web 审核计费、User Web 余额支付、Admin Web 发货、User Web 回看轨迹并确认收货等真实浏览器旅程；`QA-BROWSER-003` 已加固 CDP 导航等待、失败页面快照和服务日志输出。但它还不是覆盖全部业务路径的 Playwright/组件/视觉测试体系。
影响：可以自动发现三端登录、关键页面加载、后台 dashboard/roles/admin-users 等关键面板、关键包裹表单流、财务/客服/运单跨面板契约漂移、console error/warning 和网络 4xx/5xx，但还不能完整覆盖所有复杂表单、批量操作、视觉回归和跨端业务旅程。
当前临时处理：`npm run e2e` 继续覆盖 API 级 P0 主链路；`npm run e2e:browser` 使用 `.tmp/browser-e2e/` 临时 SQLite、media、Chrome profile 和测试服务，不下载浏览器，不使用用户日常 Chrome profile；导航失败时输出页面快照，脚本失败清理前输出服务日志尾部。
后续建议：在确认依赖和浏览器缓存策略后，再逐步引入 Playwright、视觉回归或组件级测试，覆盖更多真实业务旅程。
是否阻塞 v0.1：否。

### 审计日志外部归档、告警和细粒度覆盖仍需增强

问题：`AUDITLOG-001` 已完成后台 `/api/v1/admin/**` 写操作请求级审计、财务高风险服务层审计和 Admin Web 查询入口；`AUDIT-RETENTION-001` 已补脱敏 CSV 导出和显式本地留存清理命令；`RBAC-ROLES-001`/`RBAC-ADMIN-USERS-001` 已补角色和管理员账号写权限；`RBAC-DELETE-001` 已补角色和管理员账号安全删除；`RBAC-BUSINESS-ACTIONS-001` 已补业务模块级 `*.manage` / `*.export` 权限。但尚未接外部 SIEM、自动归档、告警规则、导出审批或按每个 create/update/delete 子动作进一步分权。
影响：可以支撑 SQLite-first 后台关键操作追溯、导出和本地留存清理验收证明，但不能声明具备完整生产审计合规体系。
当前临时处理：`audit_logs` 记录操作人、动作、对象、请求方法/路径、状态码、IP、UA、脱敏请求数据和脱敏响应数据；密码/token 等敏感字段不落库；导出使用脱敏后的存量数据；留存清理必须显式执行。
后续建议：生产化阶段补外部归档、保留期审批、导出审批、告警规则和 create/update/delete 子权限。
是否阻塞 v0.1：否。

### 对象存储、缩略图和深度文件安全增强未完成

问题：`FILE-001` 已完成本地文件上传、元数据、鉴权下载、大小/MIME/扩展名限制和包裹图片引用，`FILE-SNIFF-001` 已补基础内容签名校验，`CSV-EXPORT-SAFE-001` 已补 CSV 导出公式样式字段转义，`STORAGE-CLEANUP-001` 已补本地软删除文件清理命令，但尚未接对象存储、CDN、缩略图、病毒扫描、EXIF 清理和图片真实解码。
影响：可以支撑 SQLite-first 本地验收和后续汇款/消息/内容凭证，并拦截明显伪装文件和基础 CSV 导出公式解释风险；但不能声明生产对象存储或完整文件安全体系已完成。
当前临时处理：使用本地 `MEDIA_ROOT`，media 目录必须持久化且不提交 git；上传阶段校验扩展名/MIME/基础文件头；CSV 导出转义公式样式字段；`purge_deleted_files --older-than-days N --dry-run` 可预演软删除文件清理。
后续建议：在 staging/生产任务中补对象存储 provider、签名 URL、生命周期、备份、缩略图、EXIF 清理和受控病毒扫描。
是否阻塞 v0.1：否。

### 旧版 `.xls` 和复杂 Excel 能力未完成

问题：`IMPORT-XLSX-001` 已支持标准 `.xlsx` 模板下载和批量预报解析，但不支持旧版二进制 `.xls`、复杂公式求值、多 sheet 合并或带宏工作簿。
影响：可以满足源报告中“Excel 模板批量导入”的 SQLite-first 验收；不能声明兼容所有历史 Excel 文件。
当前临时处理：上传 `.xls` 会记录失败 job 并提示另存为 `.xlsx` 或 CSV；`.xlsx` 解析不新增第三方依赖，复用现有行级校验和 all-or-none 事务。
后续建议：只有当业务明确需要历史 `.xls` 或复杂 Excel 功能时，再选择受控依赖并补兼容测试。
是否阻塞 v0.1：否。

### 真实支付、退款和对账未完成

问题：当前支持后台人工充值、用户线下汇款审核和余额支付，但不接真实线上支付网关。
影响：不能接入线上支付回调、退款、渠道对账和支付失败补偿。
当前临时处理：钱包、PaymentOrder、RechargeRequest 已覆盖余额扣款、线下汇款审核入账、防重复审核和流水。
后续建议：先补支付渠道抽象和回调签名，再接真实支付。
是否阻塞 v0.1：否。

### 真实供应商付款和外部财务系统未完成

问题：`PAYABLE-001` 已支持供应商、成本类型、应付款创建、确认、人工核销和取消，但不接真实银行、自动打款或外部财务系统。
影响：可以支撑后台人工记录供应商成本和应付状态，但不能声明已具备真实付款、付款审批流、银企直连、外部 ERP/财务软件同步或供应商对账能力。
当前临时处理：应付款与会员钱包、PaymentOrder、线下汇款保持分离；核销只记录人工凭证号和备注，重复核销返回状态冲突。
后续建议：业务确认供应商结算规则、付款审批、对账口径和外部系统后，再引入真实付款/同步 provider。
是否阻塞 v0.1：否。

### 积分推广返利最终规则未确认

问题：`GROWTH-001` 已支持积分流水、邀请关系、返利记录、奖励积分统计和三端入口，但积分获取/兑换比例、返利比例、结算周期、提现、税务、风控和多级分销规则尚未确认。
影响：可以支撑 SQLite-first 人工登记和基础审计演示，但不能声明已具备正式联盟推广、提现结算或最终商业规则。
当前临时处理：积分和返利记录均保留 `TODO_CONFIRM` 备注；返利不写入钱包余额、不生成 `PaymentOrder`，与线下汇款和会员钱包保持隔离。
后续建议：确认商业规则后，再单独补规则引擎、自动发放、提现/结算、税务和风控。
是否阻塞 v0.1：否。

### 真实自动采购和商品抓取未完成

问题：`PURCHASE-AUTO-001` 已补外部商品链接解析入口，但不抓取真实第三方页面，不自动下单，不同步外部订单。
影响：可以把淘宝、天猫、1688、拼多多、京东等链接转成手工代购商品行和人工确认备注，但不能作为全自动代购平台交付。
当前临时处理：采购状态由后台人工推进；链接解析只做 host、商品 ID、URL 规范化和人工确认提示。
后续建议：在业务/合规确认后，再补真实平台 provider、外部订单同步、采购凭证和失败补偿。
是否阻塞 v0.1：否。

### 复杂业务规则仍需确认

问题：计费公式、首发国家/渠道、短信/邮件验证码、真实通知送达、微信登录、多语言、真实打印模板版式和硬件接入等仍为 `TODO_CONFIRM`。
影响：不能作为最终商业规则上线。
当前临时处理：P0 使用简化字段和人工操作完成闭环。
后续建议：由业务负责人逐项确认后进入独立任务。
是否阻塞 v0.1：否。

### 无主包裹认领规则仍需确认

问题：当前已支持脱敏列表、用户提交认领和后台审核转包裹，但认领凭证标准、争议处理、通知外呼和超时释放策略尚未确认。
影响：可以支撑 SQLite-first 人工审核演示，但不能作为最终风控/客服 SOP。
当前临时处理：使用 `claim_note` 和 `claim_contact` 作为人工审核材料；后台可通过或驳回。
后续建议：确认凭证字段、通知渠道、重复争议策略和审核 SLA 后单独增强。
是否阻塞 v0.1：否。

### 内容文案和复杂 CMS workflow 仍需确认

问题：`CONTENT-001` 已提供内容分类、内容条目、发布/隐藏和三端展示，但服务条款、隐私政策、禁运说明、赔付说明等最终文案仍是演示占位或基础文本。
影响：可以支撑帮助公告和内容发布演示，但不能作为正式商业/法务文案上线。
当前临时处理：公开接口只返回 `PUBLISHED` 内容；草稿/隐藏内容不会被用户端读取。
后续建议：由业务/法务确认正式文案，并按需要再补多语言、SEO、富文本和内容审批流。
是否阻塞 v0.1：否。

## 下一阶段计划

### P1 稳定化

- 在现有 system Chrome CDP smoke 和多条真实业务旅程基础上，补更多浏览器业务旅程、Playwright/组件级测试或视觉回归。
- 补前端组件级测试和关键表单校验测试。
- 增加服务端分页、筛选、排序和列表性能优化。
- 在现有模块级业务 action 权限基础上，按需要继续拆分 create/update/delete 子权限和审批流。
- 增强审计日志外部归档、告警、导出审批和合规报表。

### P1 生产化基础

- PostgreSQL 验证和迁移兼容性检查。
- Redis/Celery 验证和异步任务基线。
- 对象存储、缩略图、病毒扫描、EXIF 清理和图片处理。
- Staging 部署脚本、Nginx 反代、TLS/HSTS 验证和静态资源发布。
- 日志、远程备份、恢复演练、错误监控、外部告警和更完整安全 header/监控策略。

### P2 业务增强

- 真实支付网关、回调、退款和对账。
- 复杂运费公式、渠道分区和偏远费。
- 真实外部电商抓取、自动采购下单和外部订单同步。
- 积分兑换、推广返利结算、提现和风控。
- 物流 API 轨迹同步、真实面单打印和更复杂批次发货。
- 短信/邮件验证码、真实通知送达、微信登录、多语言、内容审批流和更复杂客服能力。
