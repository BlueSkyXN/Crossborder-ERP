# 14 分模块开发规格

本文件把最终产品拆成可由 Codex/Agent 单独执行的模块。每个模块都包含后端、API、后台端、用户 Web、移动 H5、测试和验收，避免新手只让 AI 做一个开头框架。

## 模块 1：IAM 与会员

目标：系统可登录、可鉴权、可按角色控制后台功能。

后端：

- Django app：`iam`、`members`
- Models：`User`、`MemberProfile`、`AdminUser`、`Role`、`Permission`
- Services：用户注册/登录、后台登录、角色授权、会员收件标识生成

API：

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/me
POST /api/v1/admin/auth/login
GET  /api/v1/admin/me
GET  /api/v1/admin/menus
GET  /api/v1/admin/roles
```

后台：

- 登录页。
- 后台 Layout。
- 菜单权限。
- 会员列表、会员详情、冻结、重置密码。
- 角色/权限基础页。

用户 Web：

- 登录/注册。
- 控制台用户资料。
- 个人资料和收件标识展示。

移动 H5：

- 登录页。
- 我的页账户概览。
- 设置中心退出登录。

测试：

- 未登录拦截。
- 用户数据隔离。
- 后台无权限返回 `FORBIDDEN`。
- 冻结用户不可登录。

验收：

- 测试用户和管理员都能登录。
- 后台菜单按角色返回。
- 用户只能看到自己的数据。

## 模块 2：基础配置与仓库

目标：配置集运业务运行所需的仓库、渠道和费用基础。

后端：

- Django app：`warehouses`、`waybills`
- Models：`Warehouse`、`WarehouseAddress`、`ShippingChannel`、`RatePlan`、`PackagingMethod`、`ValueAddedService`
- Services：仓库地址生成、渠道启停、基础费用读取

API：

```text
GET /api/v1/warehouses
GET /api/v1/warehouses/{id}/address
GET/POST/PUT/DELETE /api/v1/admin/warehouses
GET/POST/PUT/DELETE /api/v1/admin/shipping-channels
GET/POST/PUT/DELETE /api/v1/admin/packaging-methods
GET/POST/PUT/DELETE /api/v1/admin/value-added-services
GET/POST/PUT/DELETE /api/v1/admin/rate-plans
```

后台：

- 国家地区管理。
- 仓库管理。
- 发货渠道管理。
- 包装方式。
- 增值服务。
- 计费方案简版。

用户 Web：

- 控制台仓库地址卡。
- 一键复制完整地址。

移动 H5：

- 寄件首页仓库 Tab。
- 一键复制地址。

测试：

- 停用渠道不能被新运单选择。
- 仓库地址必须拼接会员收件标识。
- 配置修改写审计日志。

验收：

- 后台配置仓库后，用户 Web 和移动 H5 都能展示并复制。

## 模块 3：包裹 Parcel / WMS

目标：包裹从用户预报到仓库入库再到在库可发货。

后端：

- Django app：`parcels`
- Models：`Parcel`、`ParcelItem`、`ParcelPhoto`、`InboundRecord`、`UnclaimedParcel`
- Services：`forecast_parcel`、`scan_inbound`、`mark_problem`、`claim_unclaimed_parcel`

API：

```text
POST /api/v1/parcels/forecast
GET  /api/v1/parcels
GET  /api/v1/parcels/{id}
GET  /api/v1/parcels/packable
GET  /api/v1/admin/parcels
POST /api/v1/admin/parcels/scan-inbound
POST /api/v1/admin/parcels/{id}/inbound
GET  /api/v1/admin/unclaimed-parcels
POST /api/v1/admin/unclaimed-parcels
```

后台：

- 待入库包裹。
- 扫描入库。
- 包裹详情。
- 在库包裹。
- 无主包裹。

用户 Web：

- 包裹预报。
- 包裹列表。
- 包裹详情。
- 申请打包入口。

移动 H5：

- 发布预报。
- 包裹详情。
- 可打包包裹选择。
- 无主认领入口可简版。

测试：

- 预报创建 `PENDING_INBOUND`。
- 入库后 `IN_STOCK`。
- 重复入库失败。
- 非本人包裹不可访问。
- `PACKING_REQUESTED` 包裹不可重复申请。

验收：

- 用户提交预报，后台能扫描入库，用户看到在库。

## 模块 4：运单 Waybill / TMS

目标：用户选择包裹申请打包，后台审核计费发货，用户支付追踪签收。

后端：

- Django app：`waybills`
- Models：`Waybill`、`WaybillParcel`、`TrackingEvent`
- Services：`create_waybill`、`review_waybill`、`set_waybill_fee`、`pay_waybill`、`ship_waybill`、`confirm_receipt`

API：

```text
POST /api/v1/waybills
GET  /api/v1/waybills
GET  /api/v1/waybills/{id}
POST /api/v1/waybills/{id}/pay
POST /api/v1/waybills/{id}/confirm-receipt
GET  /api/v1/waybills/{id}/tracking-events
GET  /api/v1/admin/waybills
POST /api/v1/admin/waybills/{id}/review
POST /api/v1/admin/waybills/{id}/set-fee
POST /api/v1/admin/waybills/{id}/ship
POST /api/v1/admin/waybills/{id}/tracking-events
```

后台：

- 运单列表。
- 运单详情。
- 审核。
- 设置费用。
- 打包/待发货。
- 发货和轨迹。
- 问题单/取消。

用户 Web：

- 申请打包。
- 运单列表。
- 运单详情。
- 支付弹窗。
- 物流轨迹。

移动 H5：

- 申请打包。
- 运单状态 Tab。
- 运单卡片。
- 追踪时间线。
- 确认收货。

测试：

- 只有 `IN_STOCK` 包裹可创建运单。
- 创建运单后包裹变 `PACKING_REQUESTED`。
- 待付款前可改费用，付款后冻结。
- 已发货必须有轨迹。
- 状态非法流转返回 `STATE_CONFLICT`。

验收：

- 集运主链路从在库包裹到签收完整跑通。

## 模块 5：财务 Wallet / Payment

目标：钱包余额、人工充值、余额支付和流水一致。

后端：

- Django app：`finance`
- Models：`Wallet`、`WalletTransaction`、`PaymentOrder`、`RechargeRequest`
- Services：`admin_recharge`、`admin_deduct`、`create_payment_order`、`pay_with_wallet`

API：

```text
GET  /api/v1/wallet
GET  /api/v1/wallet/transactions
POST /api/v1/waybills/{id}/pay
POST /api/v1/purchase-orders/{id}/pay
GET  /api/v1/admin/wallet-transactions
POST /api/v1/admin/users/{id}/wallet/recharge
POST /api/v1/admin/users/{id}/wallet/deduct
GET  /api/v1/admin/payment-orders
```

后台：

- 用户钱包详情。
- 人工充值。
- 人工扣减。
- 钱包流水。
- 支付单查询。

用户 Web：

- 余额卡。
- 财务流水。
- 余额支付弹窗。

移动 H5：

- 我的页余额。
- 支付确认。
- 财务入口可简版。

测试：

- 余额不足不能支付。
- 重复支付不重复扣款。
- 扣款和业务状态在同一事务内。
- 每次余额变化都有流水。

验收：

- 后台充值后用户余额增加；用户支付运单后余额减少，运单状态推进。

## 模块 6：代购 Purchase / Product

目标：用户能提交最小代购单，后台采购到货后转包裹。

后端：

- Django app：`products`、`purchases`
- Models：`ProductCategory`、`Product`、`ProductSku`、`CartItem`、`PurchaseOrder`、`PurchaseOrderItem`、`ProcurementTask`
- Services：手工代购、购物车、订单审核、采购、到货转包裹

API：

```text
GET  /api/v1/products
GET  /api/v1/products/{id}
POST /api/v1/cart-items
GET  /api/v1/cart-items
POST /api/v1/purchase-orders
POST /api/v1/purchase-orders/manual
GET  /api/v1/purchase-orders
GET  /api/v1/purchase-orders/{id}
GET  /api/v1/admin/purchase-orders
POST /api/v1/admin/purchase-orders/{id}/review
POST /api/v1/admin/purchase-orders/{id}/procure
POST /api/v1/admin/purchase-orders/{id}/mark-arrived
POST /api/v1/admin/purchase-orders/{id}/convert-to-parcel
```

后台：

- 商品分类。
- 商品和 SKU。
- 代购订单列表。
- 订单详情。
- 审核、采购、到货、异常、取消。

用户 Web：

- 商品列表。
- 商品详情。
- 购物车。
- 确认订单。
- 万能代购。
- 代购订单列表/详情。

移动 H5：

- 首页商品流。
- 商品详情。
- 购物车。
- 确认订单。
- 我的代购订单入口。

测试：

- 手工代购创建成功。
- 付款/审核/采购状态机正确。
- 到货转 Parcel 后可进入集运。
- 复杂外链解析不在 P0 内。

验收：

- 用户提交手工代购，后台到货后生成 Parcel，继续走集运发货。

## 模块 7：内容、客服、审计

目标：满足基础运营、客服入口和后台可追溯。

后端：

- Django app：`content`、`tickets`、`audit`、`files`
- Models：`Article`、`Notice`、`HelpCategory`、`Ticket`、`TicketMessage`、`AuditLog`、`File`

API：

```text
GET /api/v1/articles
GET /api/v1/notices
POST /api/v1/tickets
GET /api/v1/tickets
POST /api/v1/files
GET /api/v1/admin/audit-logs
```

后台：

- 帮助/公告简版。
- 留言/工单简版。
- 审计日志。
- 文件管理。

用户 Web / 移动 H5：

- 帮助和公告入口。
- 联系客服/留言入口。

测试：

- 文件类型限制。
- 非本人 ticket 不可访问。
- 状态、金额、删除、权限变化写审计。

验收：

- P0 核心操作都有可查询审计日志。

## 模块开发顺序

```text
IAM/Member
  -> Config/Warehouse
  -> Parcel
  -> Waybill
  -> Finance
  -> Purchase/Product
  -> Content/Ticket/Audit
  -> 三端联调
  -> E2E 和部署
```

不要按“先完整后台、再完整用户端、再完整移动端”的方式做。必须按业务闭环切片开发。
