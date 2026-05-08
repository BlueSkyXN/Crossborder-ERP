# 02 领域模型与状态机

## 统一命名原则

后续代码、数据库、API、前端类型必须尽量使用本文件命名。不要同一概念多套名字。

| 中文 | 统一英文 | 禁止/避免混用 | 说明 |
| --- | --- | --- | --- |
| 用户 | User | MemberUser、CustomerUser | 前台注册用户 |
| 会员资料 | MemberProfile | UserInfo | 用户扩展资料、等级、收件标识 |
| 后台管理员 | AdminUser | StaffUser | 后台登录主体 |
| 角色 | Role | AdminRole | RBAC 角色 |
| 权限 | Permission | AuthRule | 菜单、按钮、API 权限 |
| 仓库 | Warehouse | Depot | 发货/收货仓 |
| 仓库地址 | WarehouseAddress | StorageAddress | 用户复制的入库地址 |
| 包裹 | Parcel | Package | 包裹是集运货物基本单位 |
| 包裹明细 | ParcelItem | PackageItem | 包裹内商品申报 |
| 入库记录 | InboundRecord | StockInRecord | 仓库入库动作记录 |
| 无主包裹 | UnclaimedParcel | OrphanPackage | 无法匹配用户的包裹 |
| 运单 | Waybill | Shipment、ShippingOrder | 用户发货申请和物流单据 |
| 运单包裹 | WaybillParcel | ShipmentPackage | 运单和包裹关联 |
| 轨迹节点 | TrackingEvent | TrackingNode | 物流轨迹事件 |
| 代购订单 | PurchaseOrder | ProxyOrder | 代购/自营订单统一用这个 |
| 代购明细 | PurchaseOrderItem | OrderItem | 代购订单商品行 |
| 采购任务 | ProcurementTask | BuyingTask | 后台采购处理任务 |
| 钱包 | Wallet | AccountBalance | 用户余额账户 |
| 钱包流水 | WalletTransaction | BalanceLedger | 余额变动记录 |
| 支付单 | PaymentOrder | PaymentRecord | 支付业务单据 |
| 充值申请 | RechargeRequest | TopupRecord | 用户充值/后台人工充值记录 |
| 增值服务 | ValueAddedService | ExtraService | 打包、拍照、加固等 |
| 包装方式 | PackagingMethod | PackageMethod | 纸箱、袋装等 |
| 发货渠道 | ShippingChannel | LogisticsLine | 国际线路/渠道 |
| 计费方案 | RatePlan | FeeRule | 渠道计费规则 |
| 审计日志 | AuditLog | OperationLog | 后台关键操作记录 |

## 核心聚合

### User/IAM 聚合

包含：

- `User`
- `MemberProfile`
- `AdminUser`
- `Role`
- `Permission`
- `AuditLog`

职责：

- 认证和授权。
- 用户数据隔离。
- 后台菜单、按钮、API 权限。
- 关键操作审计。

### Warehouse/Parcel 聚合

包含：

- `Warehouse`
- `WarehouseAddress`
- `Parcel`
- `ParcelItem`
- `InboundRecord`
- `UnclaimedParcel`

职责：

- 仓库地址展示。
- 包裹预报、入库、在库、异常认领。
- 包裹图片、重量、体积、申报信息。

### Waybill/TMS 聚合

包含：

- `Waybill`
- `WaybillParcel`
- `TrackingEvent`
- `ShippingChannel`
- `RatePlan`
- `ValueAddedService`
- `PackagingMethod`

职责：

- 用户申请打包发货。
- 后台审核、计费、打包、发货。
- 物流轨迹。
- 运单状态管理。

### Purchase 聚合

包含：

- `Product`
- `ProductCategory`
- `ProductSku`
- `CartItem`
- `PurchaseOrder`
- `PurchaseOrderItem`
- `ProcurementTask`

职责：

- 自营商品和最小代购。
- 购物车和确认订单。
- 采购审核、采购处理、到货转包裹。

### Finance 聚合

包含：

- `Wallet`
- `WalletTransaction`
- `PaymentOrder`
- `RechargeRequest`
- `OfflineRemittance`

职责：

- 用户余额。
- 后台人工充值/扣减。
- 运单支付、代购支付。
- 财务流水追踪。

## 包裹状态机

状态枚举：

| 状态 | 中文 | 说明 |
| --- | --- | --- |
| `DRAFT` | 草稿 | 用户表单未正式提交，可选 |
| `PENDING_INBOUND` | 待入库 | 用户已预报，仓库未入库 |
| `IN_STOCK` | 在库 | 已入库，可申请打包 |
| `PACKING_REQUESTED` | 已申请打包 | 已被某个运单选择，等待处理 |
| `PACKED` | 已打包 | 仓库已打包，可计费/待发货 |
| `OUTBOUND` | 已出库 | 已随运单发货 |
| `CANCELLED` | 已取消 | 预报取消或作废 |
| `PROBLEM` | 问题包裹 | 重量异常、破损、违禁等 |

正常流转：

```text
PENDING_INBOUND -> IN_STOCK -> PACKING_REQUESTED -> PACKED -> OUTBOUND
```

异常流转：

```text
PENDING_INBOUND -> CANCELLED
PENDING_INBOUND/IN_STOCK/PACKING_REQUESTED -> PROBLEM
PROBLEM -> IN_STOCK/CANCELLED
```

约束：

- 只有 `IN_STOCK` 包裹可以被用户申请打包。
- `PACKING_REQUESTED` 后不能再次被其他运单选择。
- `OUTBOUND` 包裹不能修改重量、体积和归属用户。
- 入库动作必须生成 `InboundRecord`。

## 无主包裹状态机

状态枚举：

| 状态 | 中文 | 说明 |
| --- | --- | --- |
| `UNCLAIMED` | 待认领 | 仓库登记但未匹配用户 |
| `CLAIM_PENDING` | 认领审核中 | 用户提交认领申请 |
| `CLAIMED` | 已认领 | 后台审核通过并绑定用户 |
| `REJECTED` | 认领驳回 | 后台驳回 |
| `ARCHIVED` | 已归档 | 长期无人认领或作废 |

正常流转：

```text
UNCLAIMED -> CLAIM_PENDING -> CLAIMED -> Parcel.IN_STOCK
```

约束：

- 审核通过后必须创建或绑定 `Parcel`。
- 驳回必须记录原因。
- 用户端展示无主包裹时要脱敏快递单号和图片。

## 运单状态机

状态枚举：

| 状态 | 中文 | 说明 |
| --- | --- | --- |
| `PENDING_REVIEW` | 待审核 | 用户提交发货申请 |
| `PENDING_PACKING` | 待打包 | 后台审核通过，等待仓库打包 |
| `PENDING_PAYMENT` | 待付款 | 已生成费用，等待用户支付 |
| `PENDING_SHIPMENT` | 待发货 | 已付款，等待出库 |
| `SHIPPED` | 已发货 | 已出库并有物流信息 |
| `SIGNED` | 已签收 | 用户确认或物流签收 |
| `CANCELLED` | 已取消 | 用户或后台取消 |
| `PROBLEM` | 问题单 | 费用、地址、违禁、物流异常等 |

正常流转：

```text
PENDING_REVIEW -> PENDING_PACKING -> PENDING_PAYMENT -> PENDING_SHIPMENT -> SHIPPED -> SIGNED
```

取消流转：

```text
PENDING_REVIEW/PENDING_PACKING/PENDING_PAYMENT -> CANCELLED
```

问题流转：

```text
PENDING_REVIEW/PENDING_PACKING/PENDING_PAYMENT/PENDING_SHIPMENT/SHIPPED -> PROBLEM
PROBLEM -> PENDING_REVIEW/PENDING_PACKING/PENDING_PAYMENT/PENDING_SHIPMENT/CANCELLED
```

约束：

- `PENDING_REVIEW` 可允许用户修改地址、渠道、备注。
- 进入 `PENDING_PAYMENT` 后费用必须冻结。
- `PENDING_SHIPMENT` 后不能取消，除非后台强制并生成退款/调整流水。
- `SHIPPED` 必须至少有一个 `TrackingEvent`。
- `SIGNED` 后不能再修改包裹、费用和地址。

## 代购订单状态机

状态枚举：

| 状态 | 中文 | 说明 |
| --- | --- | --- |
| `PENDING_PAYMENT` | 待付款 | 用户提交订单，待支付 |
| `PENDING_REVIEW` | 待审核 | 已支付或后台确认，待审核价格/信息 |
| `PENDING_PROCUREMENT` | 待采购 | 审核通过，采购人员待处理 |
| `PROCURED` | 已采购 | 已采购，等待到货或补物流 |
| `ARRIVED` | 已到货 | 商品到仓，可转包裹 |
| `COMPLETED` | 已完成 | 已转入包裹或订单结束 |
| `CANCELLED` | 已取消 | 用户/后台取消 |
| `EXCEPTION` | 异常单 | 缺货、改价、链接失效等 |

正常流转：

```text
PENDING_PAYMENT -> PENDING_REVIEW -> PENDING_PROCUREMENT -> PROCURED -> ARRIVED -> COMPLETED
```

异常流转：

```text
PENDING_REVIEW/PENDING_PROCUREMENT/PROCURED -> EXCEPTION
EXCEPTION -> PENDING_REVIEW/PENDING_PROCUREMENT/CANCELLED
```

约束：

- 改价必须重新确认费用。
- 采购凭证、实采金额、物流单号属于后台采购信息。
- 到货后应创建或关联 `Parcel`，进入集运流程。

## 支付单状态机

状态枚举：

| 状态 | 中文 | 说明 |
| --- | --- | --- |
| `PENDING` | 待支付 | 支付单创建 |
| `PROCESSING` | 支付处理中 | 在线支付可用，余额支付一般跳过 |
| `PAID` | 已支付 | 支付成功 |
| `FAILED` | 支付失败 | 扣款失败或回调失败 |
| `CANCELLED` | 已取消 | 业务取消 |
| `REFUNDED` | 已退款 | 全额退款 |
| `PARTIAL_REFUNDED` | 部分退款 | 部分退款 |

约束：

- 支付请求必须有幂等键。
- 一个业务单据同一支付阶段只能有一个有效 `PaymentOrder`。
- `PAID` 后必须有对应 `WalletTransaction` 或第三方支付流水。

## 钱包流水类型

| 类型 | 中文 | 余额方向 |
| --- | --- | --- |
| `ADMIN_RECHARGE` | 后台充值 | 增加 |
| `ADMIN_DEDUCT` | 后台扣减 | 减少 |
| `WAYBILL_PAYMENT` | 运费支付 | 减少 |
| `PURCHASE_PAYMENT` | 代购支付 | 减少 |
| `REFUND` | 退款 | 增加 |
| `ADJUSTMENT` | 余额调整 | 增加或减少 |

约束：

- 钱包余额不能直接修改，必须通过流水聚合计算或事务内同步更新。
- 所有扣款必须检查余额。
- 流水金额使用 decimal，不使用 float。
- 每条流水必须关联业务单据或后台操作原因。
