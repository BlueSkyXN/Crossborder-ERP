# 03 后端 API 与数据规格

## 1. 总体原则

继续保留 Django/DRF 模块化单体。

当前不做：

- 微服务。
- Redis/Celery 强依赖。
- 对象存储强依赖。
- 病毒扫描。
- 真实支付网关。
- 真实物流 API。

继续使用：

- SQLite-first。
- 本地文件。
- 同步任务。
- DRF API。
- OpenAPI。
- pytest。

## 2. 后端模块边界

现有模块基本可保留：

```text
members       会员
iam           后台账号/RBAC
warehouses    仓库、渠道、包装、增值服务
parcels       包裹预报、入库、无主包裹
waybills      运单、发货批次、轨迹
finance       钱包、汇款、应付
products      商品、分类、SKU、属性
purchases     代购订单、采购任务
tickets       工单消息
content       公告、帮助、条款
files         本地文件
regions       国家地区
```

新增不宜过多。P0 不建议新增复杂 `wms`、`crm`、`billing` app。

## 3. 推荐轻量改造

### 3.1 products

保持现有商品/SKU，但补轻量字段：

```python
class FulfillmentType(models.TextChoices):
    PURCHASE = "PURCHASE", "代购商品"
    FORWARDING = "FORWARDING", "集运服务"
    PHYSICAL = "PHYSICAL", "实物商品"
    SERVICE = "SERVICE", "服务项"
```

`Product` 可新增：

```text
fulfillment_type
is_recommend
sort_order
```

P0 不做数字卡密库存；如业务最终确认需要发卡，再单独做 `digital_stock`。

### 3.2 purchases

现有 `PurchaseOrder` 可继续承担万能代购和商品代购。

建议增加：

```text
source_url_normalized
platform_name
external_item_id
buyer_note
admin_cost_amount
```

但 P0 可先不改模型，先补 UI 和 API 使用体验。

### 3.3 parcels

保持已有包裹模型。

P0 重点：

- 预报。
- 入库。
- 无主包裹。
- 在库包裹申请打包。

不新增库位、PDA、波次。

### 3.4 waybills

保持已有运单和发货批次模型。

P0 重点：

- 审核。
- 计费。
- 支付。
- 发货。
- 轨迹。

P1：

- 批量转单导入。
- 打印模板优化。

### 3.5 finance

继续使用：

- Wallet。
- WalletTransaction。
- PaymentOrder。
- RechargeRequest。
- Payable。

P0 只做：

- 后台人工充值。
- 用户线下汇款。
- 余额支付。
- 流水展示。

P1 再做：

- 充值渠道配置。
- 在线支付 provider 抽象 UI。
- 退款申请。

## 4. API 规格

### 4.1 用户 API

#### Auth

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/me
PATCH /api/v1/me
POST /api/v1/auth/password-reset/request
POST /api/v1/auth/password-reset/confirm
```

#### Warehouse

```text
GET /api/v1/warehouses
GET /api/v1/warehouses/{id}/address
```

#### Parcel

```text
POST /api/v1/parcels/forecast
GET  /api/v1/parcels
GET  /api/v1/parcels/packable
GET  /api/v1/parcels/{id}
```

#### Waybill

```text
POST /api/v1/waybills
GET  /api/v1/waybills
GET  /api/v1/waybills/{id}
POST /api/v1/waybills/{id}/pay
POST /api/v1/waybills/{id}/confirm-receipt
```

#### Purchase

```text
POST /api/v1/purchases/manual
GET  /api/v1/purchases
GET  /api/v1/purchases/{id}
POST /api/v1/purchase-links/parse
```

#### Finance

```text
GET  /api/v1/wallet
GET  /api/v1/wallet/transactions
POST /api/v1/remittances
GET  /api/v1/remittances
```

#### Tickets / Content

```text
GET  /api/v1/content/pages
GET  /api/v1/content/pages/{slug}
POST /api/v1/tickets
GET  /api/v1/tickets
GET  /api/v1/tickets/{id}
POST /api/v1/tickets/{id}/messages
```

### 4.2 Admin API

#### Auth / Dashboard

```text
POST /api/v1/admin/auth/login
GET  /api/v1/admin/dashboard
```

#### Parcel Ops

```text
GET  /api/v1/admin/parcels
POST /api/v1/admin/parcels/scan-inbound
GET  /api/v1/admin/unclaimed-parcels
POST /api/v1/admin/unclaimed-parcels/{id}/approve
POST /api/v1/admin/unclaimed-parcels/{id}/reject
```

#### Waybill Ops

```text
GET  /api/v1/admin/waybills
POST /api/v1/admin/waybills/{id}/review
POST /api/v1/admin/waybills/{id}/set-fee
POST /api/v1/admin/waybills/{id}/ship
POST /api/v1/admin/waybills/{id}/tracking-events
```

#### Shipping Batch

```text
GET  /api/v1/admin/shipping-batches
POST /api/v1/admin/shipping-batches
POST /api/v1/admin/shipping-batches/{id}/add-waybills
POST /api/v1/admin/shipping-batches/{id}/lock
POST /api/v1/admin/shipping-batches/{id}/ship
GET  /api/v1/admin/shipping-batches/{id}/print-preview
```

#### Purchase Ops

```text
GET  /api/v1/admin/purchases
POST /api/v1/admin/purchases/{id}/review
POST /api/v1/admin/procurement-tasks/{id}/mark-procured
POST /api/v1/admin/procurement-tasks/{id}/mark-arrived
```

#### Finance

```text
GET  /api/v1/admin/remittances
POST /api/v1/admin/remittances/{id}/approve
POST /api/v1/admin/remittances/{id}/cancel
POST /api/v1/admin/wallets/recharge
POST /api/v1/admin/wallets/deduct
GET  /api/v1/admin/payables
```

#### Config

```text
GET/POST/PATCH /api/v1/admin/warehouses
GET/POST/PATCH /api/v1/admin/shipping-channels
GET/POST/PATCH /api/v1/admin/packaging-methods
GET/POST/PATCH /api/v1/admin/value-added-services
GET/POST/PATCH /api/v1/admin/products
GET/POST/PATCH /api/v1/admin/content/pages
```

## 5. 状态机要求

P0 不强制引入独立状态机库，但 service 中必须遵守：

- 所有状态变更进入 service。
- 所有金额变更进入事务。
- 所有后台关键写操作进入审计。
- 重复操作要返回冲突或幂等结果。

## 6. MySQL 兼容注意

当前不声明 MySQL verified，但开发时避免：

- PostgreSQL-only SQL。
- JSONField 深度查询作为核心逻辑。
- partial index。
- deferrable constraint。
- skip_locked 作为必要逻辑。
- 数据库触发器。

## 7. 文件和安全

P0 保持：

- 本地文件存储。
- 文件用途绑定。
- 扩展名/MIME/基础文件头校验。
- 鉴权下载。

不做病毒扫描。

## 8. 审计

后台关键动作必须记录：

- 入库。
- 审核运单。
- 设置费用。
- 汇款审核。
- 钱包充值/扣减。
- 发货。
- 代购审核/采购/到货。
- 权限变更。
- 导出。
