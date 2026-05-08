# Source Report Gap Map

本文件把 `/Volumes/TP4000PRO/Program/oldsystem` 下的 ChatGPT/Gemini 两套分析报告与当前仓库实现做一次真实映射。结论用于后续 Agent 任务选择，不把未完成能力包装成已完成。

## 结论

当前实现（截至本分支审计）已完成 SQLite-first 的 P0 交易闭环：

- 后端具备 `iam`、`members`、`warehouses`、`parcels`、`waybills`、`finance`、`products`、`purchases` 等核心 app。
- Admin Web、User Web、Mobile H5 已覆盖登录、仓库地址、包裹预报、扫描入库、申请打包、审核计费、余额支付、发货轨迹、确认收货、商品/购物车/手工代购最小链路。
- `npm run e2e` 已覆盖 API 级 P0 主流程，并已把线下汇款审核入账纳入主链路资金来源。

但如果目标是“完整满足两套原始报告的生产级 ERP”，当前仍不完整。`ADDR-001` 已补齐基础地址簿；`FILE-001` 已补齐本地文件上传、元数据、鉴权下载和包裹图片引用基础；`FIN-001` 已补齐用户线下汇款、后台审核入账和三端财务入口；`MSG-001` 已补齐用户工单、附件、后台客服回复和三端入口。剩余差距集中在会员后台、内容 CMS、无主包裹用户认领、批量导入、发货批次/转单、应付供应商、积分推广、浏览器级 E2E 和生产化运维边界。

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
| 后台 MVP 范围 | ChatGPT Admin L924-L936 要求后台基础框架、通用列表、基础配置、会员、商品、代购、包裹仓储、运单、批次发货、财务核心、内容基础 | 部分完成；线下汇款已补，批次、内容和完整会员仍未完成 |
| 后台后端服务 | ChatGPT Admin L1005-L1023 要求 RBAC、文件、会员、消息、包裹、运单、批次、转单、财务应收/应付、内容、打印、操作日志 | 部分完成；文件、消息已补，批次、转单、应付、内容、打印、审计未完成 |
| 用户 Web MVP | ChatGPT User Web L773-L789 要求用户账户、控制台、仓库地址、商品、购物车、订单、代购、包裹、运单、支付、财务、地址、消息 | 部分完成；地址簿、文件上传、独立财务页和消息工单已补，真实在线充值未完成 |
| 用户 Web 第二阶段 | ChatGPT User Web L795-L803 要求批量导入、直邮、无主包裹、线下汇款、推广返利、积分、物流对接、帮助中心 | 线下汇款已补；其余大多未完成或仅保留人工/字段 |
| 用户 Web 后端任务 | ChatGPT User Web L879-L902 要求账户、仓库、商品、购物车、订单、代购、包裹、运单、支付、财务、汇款、积分、推广、地址、消息、无主、文件、审计 | P0 主链路、地址、文件、汇款、消息工单已完成；积分/推广/无主用户认领/审计仍缺 |
| 移动端 MVP | ChatGPT Mobile L892-L907 要求五栏导航、登录、首页搜索、分类、商品详情、购物车、确认订单、集运地址、预报、包裹、打包、运单、追踪、我的、设置 | 部分完成；分类为复用页，地址、财务和消息入口已补，多语言等未完整 |
| 移动端二阶段 | ChatGPT Mobile L913-L922 要求注册/找回、微信登录、代购订单列表、财务、地址、多语言、消息、客服、无主认领 | 财务、地址和消息工单已补；其余大多未完成 |
| Gemini Admin 核心模块 | Gemini Admin L168-L175 明确 WMS、会员、商品、应收、应付、图片、网站管理、基础设置 | 应收/商品/WMS 部分完成；应付、图片、网站管理缺 |
| Gemini User Web 需求 | Gemini User Web L290-L303 明确 dashboard、商品、手工代购、预报、包裹、无主、运单、流水、充值、推广、地址、客服 | 部分完成；地址、流水、线下汇款和客服工单已补，无主用户认领、推广仍缺 |
| Gemini Mobile 需求 | Gemini Mobile L289-L303 明确登录、搜索、分类、商品、购物车、确认订单、仓库地址、包裹、追踪、无主、我的、设置 | 部分完成；地址、财务入口和客服工单已补，无主、多语言未完整 |

## Current Implementation Inventory

| 层 | 已确认实现 | 证据 |
| --- | --- | --- |
| Backend apps | `common`、`addresses`、`iam`、`members`、`warehouses`、`parcels`、`waybills`、`finance`、`products`、`purchases`、`tickets` | `backend/config/settings/base.py` |
| Backend routes | 上述 app 均挂到 `/api/v1/`，并暴露 OpenAPI/Swagger | `backend/config/urls.py` |
| Members | 用户 email/phone/status、会员档案、会员编号、仓库识别码 | `backend/apps/members/models.py` L4-L47 |
| Parcels | 包裹、包裹明细、入库图片 file_id、入库记录、无主包裹模型 | `backend/apps/parcels/models.py` L6-L130 |
| Waybills | 运单状态、收件快照、费用、轨迹事件 | `backend/apps/waybills/models.py` L6-L108 |
| Finance | 钱包、支付单、余额流水、后台充值记录、线下汇款凭证和审核字段 | `backend/apps/finance/models.py` |
| Products/Purchases | 商品分类、商品、SKU、购物车、代购订单、采购任务 | `backend/apps/products/models.py` L6-L78；`backend/apps/purchases/models.py` L6-L120 |
| Admin Web routes | 控制台、会员、仓库、包裹、运单、财务、代购、商品、角色权限入口 | `admin-web/src/features/auth/menu.tsx` L23-L96 |
| User Web routes | dashboard、addresses、finance、tickets、parcels、waybills、products/cart/purchases | `user-web/src/routes/index.tsx` |
| Mobile H5 routes | home/category、ship、forecast、parcels、packing、waybills、cart、me、addresses、finance、tickets、purchases/manual | `mobile-h5/src/routes/index.tsx` |
| CI | PR 和 main push 执行 backend check/OpenAPI/pytest、frontend lint/build | `.github/workflows/ci.yml` L3-L74 |
| E2E | `npm run e2e` 调用 API 级 P0 pytest 流程 | `package.json` L6-L11 |

## Gap Matrix

| 缺口 | 来源要求 | 当前实现判断 | 建议任务 |
| --- | --- | --- | --- |
| 地址簿和用户资料 | User Web MVP 把收件地址列为 P0，后端任务列为 `BE-019`；Mobile 二阶段列为地址管理 | `ADDR-001` 已补基础 address app/API、User Web/Mobile 地址簿、运单 `address_id` 和 snapshot 防漂移断言；更复杂用户资料仍留给 `MEMBER-001` | `ADDR-001` 已完成 |
| 会员后台管理 | Admin MVP 要求会员账号、审核/冻结、客服分配、会员等级、会员留言 | 后端有基础状态和 profile；Admin `/members` 仍为通用占位，未覆盖冻结、重置密码、等级、客服分配 | `MEMBER-001` |
| 线下汇款和充值审核 | Admin/User Web 均要求线下汇款、汇款单管理、后台审核入账 | `FIN-001` 已补用户提交汇款、`REMITTANCE_PROOF` 凭证、待审/通过/取消状态、后台审核入账防重和三端财务入口；真实线上支付仍不做 | `FIN-001` 已完成；真实支付后续 |
| 文件上传 | Admin 后端任务要求图片上传、凭证上传、Excel 导入、模板下载；User Web 后端任务要求文件服务 | `FILE-001` 已补本地上传、元数据、大小/MIME/扩展名限制、鉴权下载和包裹图片引用；对象存储、缩略图、病毒扫描、Excel 解析仍后续 | `FILE-001` 已完成；对象存储/导入增强留给后续 |
| 客服消息/工单 | Admin/User Web/Mobile 均要求留言、消息列表、客服回复 | `MSG-001` 已补 tickets/messages app、用户 `MESSAGE_ATTACHMENT` 附件校验、后台 `tickets.view` 权限、三端工单入口和 API E2E；真实在线客服/实时推送不做 | `MSG-001` 已完成；实时客服后续 |
| 内容 CMS | Admin MVP 要求帮助中心、分类、条款隐私、公告、关于我们；Gemini Admin 网站管理同样明确 | 当前没有 content app，没有三端帮助/公告内容管理 | `CONTENT-001` |
| 无主包裹用户认领 | User Web/Mobile 均要求用户搜索和认领无主包裹 | 后端/Admin 有无主包裹登记和 service，但没有用户侧 list/claim API 与前端页面 | `PARCEL-CLAIM-001` |
| 批量导入/导出 | Admin/User Web 多处要求 Excel 导入、导出、模板下载 | 当前没有导入解析、模板下载和导出服务 | `IMPORT-001` |
| 发货批次/转单/打印 | Admin MVP 要求批次发货，二阶段要求转单、打印体系 | 当前支持单票人工发货和轨迹；没有 shipment batch、transfer order、面单/拣货单模板 | `SHIP-BATCH-001` |
| 应付、供应商、成本 | Gemini Admin L124-L126、L172 和 ChatGPT Admin L942 要求应付管理 | 当前 finance 仅应收/钱包方向；没有 suppliers/payables/cost types | `PAYABLE-001` |
| 积分、推广、返利 | User Web 第二阶段和 Mobile 入口均要求积分/推广/好友返利 | 当前 member profile 有 level 字段但没有 points/referrals ledger 和规则 | `GROWTH-001` |
| 外链解析/自动采购 | User Web/Mobile 要求关键词/链接搜索，Admin 二阶段提到外部平台对接 | 当前支持自营商品和手工代购；不支持稳定外部抓取/自动采购 | `PURCHASE-AUTO-001`，需业务确认和合规确认 |
| 浏览器级 E2E | 现有 README 已说明 Playwright 后续补齐 | CI 只有 backend pytest 与 frontend lint/build；`npm run e2e` 是 API 级 | `QA-BROWSER-001` |
| PostgreSQL/MySQL/Redis | 用户已确认先 SQLite，后续补但不真实验证 | 当前只验证 SQLite，Redis/Celery 未真实验证 | 保持 `configured_unverified`，不进入当前验证 gate |

## Immediate Next Order

后续不应一次性做超大 PR，建议按依赖顺序拆小任务：

1. `MEMBER-001`：后台会员管理、等级、冻结、重置密码、客服分配占位。
2. `PARCEL-CLAIM-001`：用户无主包裹查询/认领与后台审核。
3. `CONTENT-001`：帮助、公告、条款、关于我们 CMS。
4. `IMPORT-001`：批量导入/导出基础，复用 `FILE-001` 的上传能力。
5. `QA-BROWSER-001`：在不污染本机环境的前提下引入浏览器级 E2E。

每个任务仍需独立分支、PR、更新 PR 信息、CI 通过后合并回 `main`。
