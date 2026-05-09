# Source Report Gap Map

本文件把 `/Volumes/TP4000PRO/Program/oldsystem` 下的 ChatGPT/Gemini 两套分析报告与当前仓库实现做一次真实映射。结论用于后续 Agent 任务选择，不把未完成能力包装成已完成。

## 结论

当前实现（截至本分支审计）已完成 SQLite-first 的 P0 交易闭环：

- 后端具备 `iam`、`members`、`warehouses`、`parcels`、`waybills`、`finance`、`products`、`purchases` 等核心 app。
- Admin Web、User Web、Mobile H5 已覆盖登录、仓库地址、包裹预报、扫描入库、申请打包、审核计费、余额支付、发货轨迹、确认收货、商品/购物车/手工代购最小链路。
- `npm run e2e` 已覆盖 API 级 P0 主流程，并已把线下汇款审核入账纳入主链路资金来源。

但如果目标是“完整满足两套原始报告的生产级 ERP”，当前仍不完整。`ADDR-001` 已补齐基础地址簿；`FILE-001` 已补齐本地文件上传、元数据、鉴权下载和包裹图片引用基础；`FIN-001` 已补齐用户线下汇款、后台审核入账和三端财务入口；`MSG-001` 已补齐用户工单、附件、后台客服回复和三端入口；`MEMBER-001` 已补齐后台会员管理、冻结/解冻、等级和客服服务信息维护；`PARCEL-CLAIM-001` 已补齐无主包裹用户脱敏查询、认领和后台审核转包裹；`CONTENT-001` 已补齐内容 CMS、帮助公告和条款展示基础；`IMPORT-001` 已补齐 CSV 模板、批量预报导入、错误明细和基础导出；`IMPORT-XLSX-001` 已补齐 Excel `.xlsx` 模板下载和批量预报解析；`QA-BROWSER-001` 已补齐不下载浏览器、不使用用户 profile 的三端浏览器 smoke 基础；`QA-BROWSER-002` 已补齐会员预报、后台扫描入库、会员回看在库的真实浏览器业务旅程；`SHIP-BATCH-001` 已补齐发货批次、转单号和打印模板数据预览基础；`PAYABLE-001` 已补齐供应商、成本类型和应付状态流基础；`GROWTH-001` 已补齐积分流水、邀请关系、返利记录统计和三端入口基础；`AUDITLOG-001` 已补齐后台关键写操作审计日志和查询面板；`AUDIT-RETENTION-001` 已补齐审计日志脱敏 CSV 导出和显式本地留存清理命令。剩余差距集中在生产化运维边界、需要业务/合规确认的外部集成，以及视觉回归/组件级测试/更大范围浏览器流。

## Source Scope

| 来源 | 文件 | 本轮读取方式 |
| --- | --- | --- |
| ChatGPT Admin | `/Volumes/TP4000PRO/Program/oldsystem/ChatGPT分析/admin分析.md` | `probe` 为 L 级，使用目录、关键行和定向读取 |
| ChatGPT User Web | `/Volumes/TP4000PRO/Program/oldsystem/ChatGPT分析/userweb分析.md` | `probe` 为 L 级，使用目录、MVP 段和任务拆分段 |
| ChatGPT Mobile | `/Volumes/TP4000PRO/Program/oldsystem/ChatGPT分析/usermobile分析.md` | `probe` 为 L 级，使用目录、MVP 段和任务拆分段 |
| Gemini Admin | `/Volumes/TP4000PRO/Program/oldsystem/Gemini分析/admin产品分析.md` | `probe` 为 M 级，使用 `toc` 和定向读取 |
| Gemini User Web | `/Volumes/TP4000PRO/Program/oldsystem/Gemini分析/userweb产品分析.md` | `probe` 为 M 级，使用 `toc` 和定向读取 |
| Gemini Mobile | `/Volumes/TP4000PRO/Program/oldsystem/Gemini分析/usermobile产品分析.md` | `probe` 为 M 级，使用 `toc` 和定向读取 |

本轮只发现并纳入 `ChatGPT分析/` 和 `Gemini分析/` 两套源报告；未发现可审计的 Claude/Grok 分析目录，因此不把它们作为证据来源。

## Source Requirements

| 领域 | 关键来源证据 | 当前状态 |
| --- | --- | --- |
| 后台 MVP 范围 | ChatGPT Admin L924-L936 要求后台基础框架、通用列表、基础配置、会员、商品、代购、包裹仓储、运单、批次发货、财务核心、内容基础 | 部分完成；会员后台、线下汇款、内容基础和发货批次已补 |
| 后台后端服务 | ChatGPT Admin L1005-L1023 要求 RBAC、文件、会员、消息、包裹、运单、批次、转单、财务应收/应付、内容、打印、操作日志 | 部分完成；文件、消息、内容、批次、转单、打印模板数据、应付基础和审计日志基础已补 |
| 用户 Web MVP | ChatGPT User Web L773-L789 要求用户账户、控制台、仓库地址、商品、购物车、订单、代购、包裹、运单、支付、财务、地址、消息 | 部分完成；地址簿、文件上传、独立财务页和消息工单已补，真实在线充值未完成 |
| 用户 Web 第二阶段 | ChatGPT User Web L795-L803 要求批量导入、直邮、无主包裹、线下汇款、推广返利、积分、物流对接、帮助中心 | 线下汇款、无主包裹认领、帮助中心、CSV / `.xlsx` 批量预报导入、积分/推广/返利基础已补；物流对接仍后续 |
| 用户 Web 后端任务 | ChatGPT User Web L879-L902 要求账户、仓库、商品、购物车、订单、代购、包裹、运单、支付、财务、汇款、积分、推广、地址、消息、无主、文件、审计 | P0 主链路、地址、文件、汇款、消息工单、无主用户认领、积分/推广基础和后台审计日志已完成 |
| 移动端 MVP | ChatGPT Mobile L892-L907 要求五栏导航、登录、首页搜索、分类、商品详情、购物车、确认订单、集运地址、预报、包裹、打包、运单、追踪、我的、设置 | 部分完成；分类为复用页，地址、财务和消息入口已补，多语言等未完整 |
| 移动端二阶段 | ChatGPT Mobile L913-L922 要求注册/找回、微信登录、代购订单列表、财务、地址、多语言、消息、客服、无主认领 | 财务、地址和消息工单已补；其余大多未完成 |
| Gemini Admin 核心模块 | Gemini Admin L168-L175 明确 WMS、会员、商品、应收、应付、图片、网站管理、基础设置 | 应收/应付/商品/WMS/网站管理基础已补；生产图片增强仍缺 |
| Gemini User Web 需求 | Gemini User Web L290-L303 明确 dashboard、商品、手工代购、预报、包裹、无主、运单、流水、充值、推广、地址、客服 | 部分完成；地址、流水、线下汇款、客服工单、无主用户认领和推广/积分基础已补 |
| Gemini Mobile 需求 | Gemini Mobile L289-L303 明确登录、搜索、分类、商品、购物车、确认订单、仓库地址、包裹、追踪、无主、我的、设置 | 部分完成；地址、财务入口和客服工单已补，无主、多语言未完整 |

## Current Implementation Inventory

| 层 | 已确认实现 | 证据 |
| --- | --- | --- |
| Backend apps | `common`、`addresses`、`iam`、`members`、`warehouses`、`parcels`、`waybills`、`finance`、`products`、`purchases`、`tickets`、`content` | `backend/config/settings/base.py` |
| Backend routes | 上述 app 均挂到 `/api/v1/`，并暴露 OpenAPI/Swagger | `backend/config/urls.py` |
| Members | 用户 email/phone/status、会员档案、会员编号、仓库识别码、客服负责人、内部服务备注 | `backend/apps/members/models.py` |
| Growth | 积分流水、邀请关系、返利记录、奖励积分统计；规则未定项用 `TODO_CONFIRM` 标注，且不进入钱包余额 | `backend/apps/members/models.py`；`backend/apps/members/services.py` |
| Parcels | 包裹、包裹明细、批量导入任务记录、入库图片 file_id、入库记录、无主包裹模型 | `backend/apps/parcels/models.py` |
| Waybills | 运单状态、收件快照、费用、轨迹事件、发货批次、转单号 | `backend/apps/waybills/models.py` |
| Finance | 钱包、支付单、余额流水、后台充值记录、线下汇款凭证和审核字段、供应商、成本类型、应付款状态流和人工核销字段 | `backend/apps/finance/models.py` |
| Audit | 后台写操作请求级审计、财务高风险服务层审计、脱敏请求/响应数据、后台审计日志查询 API | `backend/apps/audit/models.py`；`backend/apps/audit/middleware.py` |
| Products/Purchases | 商品分类、商品、SKU、购物车、代购订单、采购任务 | `backend/apps/products/models.py` L6-L78；`backend/apps/purchases/models.py` L6-L120 |
| Admin Web routes | 控制台、会员、仓库、包裹、运单、财务、代购、商品、内容管理、角色权限入口 | `admin-web/src/features/auth/menu.tsx` |
| User Web routes | dashboard、addresses、finance、tickets、content、parcels、unclaimed-parcels、waybills、products/cart/purchases | `user-web/src/routes/index.tsx` |
| Mobile H5 routes | home/category、ship、forecast、parcels、unclaimed-parcels、packing、waybills、cart、me、content、addresses、finance、tickets、purchases/manual | `mobile-h5/src/routes/index.tsx` |
| CI | PR 和 main push 执行 backend check/OpenAPI/pytest、frontend lint/build、Browser Smoke | `.github/workflows/ci.yml` |
| E2E | `npm run e2e` 调用 API 级 P0 pytest 流程；`npm run e2e:browser` 调用 system Chrome CDP 三端 smoke 和一条包裹预报/入库/回看业务旅程 | `package.json`；`scripts/e2e/` |

## Gap Matrix

| 缺口 | 来源要求 | 当前实现判断 | 建议任务 |
| --- | --- | --- | --- |
| 地址簿和用户资料 | User Web MVP 把收件地址列为 P0，后端任务列为 `BE-019`；Mobile 二阶段列为地址管理 | `ADDR-001` 已补基础 address app/API、User Web/Mobile 地址簿、运单 `address_id` 和 snapshot 防漂移断言；更复杂用户资料仍留给 `MEMBER-001` | `ADDR-001` 已完成 |
| 会员后台管理 | Admin MVP 要求会员账号、审核/冻结、客服分配、会员等级、会员留言 | `MEMBER-001` 已补后台会员 API、RBAC、冻结/解冻、测试密码重置、等级和客服服务信息维护；复杂 CRM/自动分配仍后续 | `MEMBER-001` 已完成；复杂 CRM 后续 |
| 线下汇款和充值审核 | Admin/User Web 均要求线下汇款、汇款单管理、后台审核入账 | `FIN-001` 已补用户提交汇款、`REMITTANCE_PROOF` 凭证、待审/通过/取消状态、后台审核入账防重和三端财务入口；真实线上支付仍不做 | `FIN-001` 已完成；真实支付后续 |
| 文件上传 | Admin 后端任务要求图片上传、凭证上传、Excel 导入、模板下载；User Web 后端任务要求文件服务 | `FILE-001` 已补本地上传、元数据、大小/MIME/扩展名限制、鉴权下载和包裹图片引用；`IMPORT-001`/`IMPORT-XLSX-001` 已复用 `IMPORT_FILE` 支撑 CSV 和 `.xlsx` 导入；对象存储、缩略图、病毒扫描仍后续 | `FILE-001`/`IMPORT-001`/`IMPORT-XLSX-001` 已完成基础；对象存储增强留给后续 |
| 客服消息/工单 | Admin/User Web/Mobile 均要求留言、消息列表、客服回复 | `MSG-001` 已补 tickets/messages app、用户 `MESSAGE_ATTACHMENT` 附件校验、后台 `tickets.view` 权限、三端工单入口和 API E2E；真实在线客服/实时推送不做 | `MSG-001` 已完成；实时客服后续 |
| 内容 CMS | Admin MVP 要求帮助中心、分类、条款隐私、公告、关于我们；Gemini Admin 网站管理同样明确 | `CONTENT-001` 已补 content app、后台 CRUD/发布隐藏、公开只读 API、Admin Web 内容管理、User Web/Mobile H5 展示；正式条款/隐私文案仍需业务/法务确认 | `CONTENT-001` 已完成；文案确认后续 |
| 无主包裹用户认领 | User Web/Mobile 均要求用户搜索和认领无主包裹 | `PARCEL-CLAIM-001` 已补用户侧脱敏列表/搜索/认领 API，后台审核通过/驳回，审核通过后转会员 `Parcel.IN_STOCK`，三端入口已补 | `PARCEL-CLAIM-001` 已完成 |
| 批量导入/导出 | Admin/User Web 多处要求 Excel 导入、导出、模板下载 | `IMPORT-001` 已补包裹预报 CSV 模板下载、用户上传 `IMPORT_FILE` 后批量导入、行级错误明细、导入结果记录、会员包裹导出和后台 RBAC 包裹导出；`IMPORT-XLSX-001` 已补 `.xlsx` 模板下载和解析；旧版二进制 `.xls` 仍需用户另存为 `.xlsx` 或 CSV | `IMPORT-001`/`IMPORT-XLSX-001` 已完成 |
| 发货批次/转单/打印 | Admin MVP 要求批次发货，二阶段要求转单、打印体系 | `SHIP-BATCH-001` 已补 `ShippingBatch`、运单归批/移出、锁定后批量发货、批量轨迹、转单号、承运商批次号和面单/拣货单/交接单结构化预览；不接真实打印硬件 | `SHIP-BATCH-001` 已完成基础 |
| 应付、供应商、成本 | Gemini Admin L124-L126、L172 和 ChatGPT Admin L942 要求应付管理 | `PAYABLE-001` 已补供应商、成本类型、应付款、待审核/确认/核销/取消状态流和重复核销防护；真实银行付款和外部财务系统未接 | `PAYABLE-001` 已完成基础 |
| 积分、推广、返利 | User Web 第二阶段和 Mobile 入口均要求积分/推广/好友返利 | `GROWTH-001` 已补积分流水、邀请关系、返利金额/奖励积分统计、Admin Web/User Web/Mobile H5 基础入口；提现、税务、真实联盟和最终规则仍不做 | `GROWTH-001` 已完成基础；复杂规则后续 |
| 操作日志/审计 | ChatGPT Admin L1023、Gemini Admin L129、基线 `audit_logs` 契约要求关键后台操作可追溯 | `AUDITLOG-001` 已补 `audit_logs`、请求级审计中间件、财务高风险服务层审计、Admin Web `/audit-logs` 查询入口；`AUDIT-RETENTION-001` 已补脱敏 CSV 导出和显式本地留存清理命令；外部 SIEM、自动归档、告警和细粒度权限仍后续 | `AUDITLOG-001`/`AUDIT-RETENTION-001` 已完成基础 |
| 外链解析/自动采购 | User Web/Mobile 要求关键词/链接搜索，Admin 二阶段提到外部平台对接 | 当前支持自营商品和手工代购；不支持稳定外部抓取/自动采购 | `PURCHASE-AUTO-001`，需业务确认和合规确认 |
| 浏览器级 E2E | 源报告要求三端具备可实际操作产品形态；API E2E 不能发现真实浏览器运行时问题 | `QA-BROWSER-001` 已补 system Chrome CDP smoke，覆盖 Admin Web/User Web/Mobile H5 登录和关键页面，并纳入 CI；`QA-BROWSER-002` 已补会员预报、后台扫描入库、会员回看在库的真实浏览器业务旅程；视觉回归、组件级测试和更多复杂浏览器流仍可增强 | `QA-BROWSER-001`/`QA-BROWSER-002` 已完成；更深测试后续 |
| PostgreSQL/MySQL/Redis | 用户已确认先 SQLite，后续补但不真实验证 | 当前只验证 SQLite，Redis/Celery 未真实验证 | 保持 `configured_unverified`，不进入当前验证 gate |

## Immediate Next Order

后续不应一次性做超大 PR，建议按依赖顺序拆小任务：

1. 生产化运维边界：补 PostgreSQL/MySQL/Redis 真实验证计划、对象存储、告警和部署验证。
2. 需要业务/合规确认的外部集成：真实支付、真实物流 API、自动采购和外部商品抓取。
3. 测试深度增强：在现有 `npm run e2e:browser` 基础上，逐步覆盖视觉回归、组件级测试和更多复杂浏览器流。

每个任务仍需独立分支、PR、更新 PR 信息、CI 通过后合并回 `main`。
