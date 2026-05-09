# 04 API 与数据库契约

## API 总原则

- 使用 REST。
- 统一前缀：`/api/v1`。
- 后台接口使用 `/api/v1/admin/...`。
- 用户 Web 和移动 H5 共用用户端 API，不重复设计两套业务接口。
- 后台管理员认证和用户认证分离。
- 所有列表接口支持统一分页。
- 状态枚举由后端统一定义，前端只展示。
- 金额字段使用字符串返回，避免 JavaScript 精度问题。

## 响应格式

成功：

```json
{
  "code": "OK",
  "message": "success",
  "data": {}
}
```

失败：

```json
{
  "code": "VALIDATION_ERROR",
  "message": "字段校验失败",
  "data": {
    "field_errors": {
      "tracking_no": ["快递单号不能为空"]
    }
  }
}
```

分页：

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 0
    }
  }
}
```

## 通用错误码

| code | 场景 |
| --- | --- |
| `OK` | 成功 |
| `UNAUTHORIZED` | 未登录 |
| `FORBIDDEN` | 无权限 |
| `NOT_FOUND` | 资源不存在 |
| `VALIDATION_ERROR` | 参数错误 |
| `STATE_CONFLICT` | 状态不允许操作 |
| `DUPLICATE_REQUEST` | 重复请求 |
| `INSUFFICIENT_BALANCE` | 余额不足 |
| `BUSINESS_ERROR` | 普通业务错误 |
| `INTERNAL_ERROR` | 服务端错误 |

## 鉴权

第一版推荐 JWT：

```text
Authorization: Bearer <access_token>
```

后台和用户端使用不同登录接口：

```text
POST /api/v1/auth/login
POST /api/v1/admin/auth/login
```

约束：

- 用户 token 不能访问后台接口。
- 管理员 token 不能直接访问用户私有接口，除非后台接口显式提供代查能力。
- 后台敏感操作需要 RBAC 权限。

## 查询参数约定

列表通用参数：

```text
page=1
page_size=20
keyword=xxx
status=IN_STOCK
date_start=2026-05-01
date_end=2026-05-31
ordering=-created_at
```

约束：

- `page_size` 默认 20，最大 100。
- 日期使用 ISO 格式。
- 状态使用英文枚举。

## 核心用户端 API 草案

### 账号

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/me
PUT  /api/v1/me/profile
GET  /api/v1/me/dashboard
```

### 仓库

```text
GET /api/v1/warehouses
GET /api/v1/warehouses/{id}/address
```

### 包裹

```text
POST /api/v1/parcels/forecast
GET  /api/v1/parcels
GET  /api/v1/parcels/{id}
GET  /api/v1/parcels/packable
GET  /api/v1/unclaimed-parcels
POST /api/v1/unclaimed-parcels/{id}/claim
```

### 运单

```text
POST /api/v1/waybills
GET  /api/v1/waybills
GET  /api/v1/waybills/{id}
PUT  /api/v1/waybills/{id}
POST /api/v1/waybills/{id}/pay
POST /api/v1/waybills/{id}/confirm-receipt
GET  /api/v1/waybills/{id}/tracking-events
GET  /api/v1/waybills/tracking?waybill_no=xxx
```

### 代购和商品

```text
GET  /api/v1/products
GET  /api/v1/products/{id}
POST /api/v1/cart-items
GET  /api/v1/cart-items
PATCH /api/v1/cart-items/{id}
DELETE /api/v1/cart-items/{id}
POST /api/v1/purchase-orders
GET  /api/v1/purchase-orders
GET  /api/v1/purchase-orders/{id}
POST /api/v1/purchase-orders/manual
POST /api/v1/purchase-orders/{id}/pay
```

### 财务

```text
GET  /api/v1/wallet
GET  /api/v1/wallet/transactions
GET  /api/v1/payment-orders
GET  /api/v1/payment-orders/{id}
```

### 地址和文件

```text
GET    /api/v1/addresses
POST   /api/v1/addresses
PUT    /api/v1/addresses/{id}
DELETE /api/v1/addresses/{id}
POST   /api/v1/files
```

## 核心后台 API 草案

### 后台认证和权限

```text
POST /api/v1/admin/auth/login
POST /api/v1/admin/auth/logout
GET  /api/v1/admin/me
GET  /api/v1/admin/menus
GET  /api/v1/admin/roles
POST /api/v1/admin/roles
GET  /api/v1/admin/roles/{id}
PATCH /api/v1/admin/roles/{id}
GET  /api/v1/admin/permissions
GET  /api/v1/admin/admin-users
POST /api/v1/admin/admin-users
GET  /api/v1/admin/admin-users/{id}
PATCH /api/v1/admin/admin-users/{id}
```

### 会员

```text
GET  /api/v1/admin/users
GET  /api/v1/admin/users/{id}
POST /api/v1/admin/users/{id}/freeze
POST /api/v1/admin/users/{id}/unfreeze
POST /api/v1/admin/users/{id}/reset-password
```

### 基础配置

```text
GET/POST/PUT/DELETE /api/v1/admin/warehouses
GET/POST/PUT/DELETE /api/v1/admin/countries
GET/POST/PUT/DELETE /api/v1/admin/shipping-channels
GET/POST/PUT/DELETE /api/v1/admin/packaging-methods
GET/POST/PUT/DELETE /api/v1/admin/value-added-services
GET/POST/PUT/DELETE /api/v1/admin/rate-plans
```

### 包裹和仓储

```text
GET  /api/v1/admin/parcels
GET  /api/v1/admin/parcels/{id}
POST /api/v1/admin/parcels/{id}/inbound
POST /api/v1/admin/parcels/scan-inbound
POST /api/v1/admin/parcels/{id}/mark-problem
GET  /api/v1/admin/unclaimed-parcels
POST /api/v1/admin/unclaimed-parcels
POST /api/v1/admin/unclaimed-parcels/{id}/approve-claim
POST /api/v1/admin/unclaimed-parcels/{id}/reject-claim
```

### 运单

```text
GET  /api/v1/admin/waybills
GET  /api/v1/admin/waybills/{id}
POST /api/v1/admin/waybills/{id}/review
POST /api/v1/admin/waybills/{id}/pack
POST /api/v1/admin/waybills/{id}/set-fee
POST /api/v1/admin/waybills/{id}/ship
POST /api/v1/admin/waybills/{id}/cancel
POST /api/v1/admin/waybills/{id}/mark-problem
POST /api/v1/admin/waybills/{id}/tracking-events
```

### 财务

```text
GET  /api/v1/admin/wallets
GET  /api/v1/admin/wallet-transactions
POST /api/v1/admin/users/{id}/wallet/recharge
POST /api/v1/admin/users/{id}/wallet/deduct
GET  /api/v1/admin/payment-orders
```

### 代购和商品

```text
GET/POST/PUT/DELETE /api/v1/admin/products
GET/POST/PUT/DELETE /api/v1/admin/product-categories
GET/POST/PUT/DELETE /api/v1/admin/product-skus
GET  /api/v1/admin/purchase-orders
GET  /api/v1/admin/purchase-orders/{id}
POST /api/v1/admin/purchase-orders/{id}/review
POST /api/v1/admin/purchase-orders/{id}/procure
POST /api/v1/admin/purchase-orders/{id}/mark-arrived
POST /api/v1/admin/purchase-orders/{id}/convert-to-parcel
POST /api/v1/admin/purchase-orders/{id}/mark-exception
POST /api/v1/admin/purchase-orders/{id}/cancel
```

## 核心数据库表

字段仅为 v0.1 基线，实施时可补充，但不得随意改核心命名。

### 用户与权限

| 表 | 关键字段 |
| --- | --- |
| `users` | id, email, phone, password_hash, status, created_at |
| `member_profiles` | user_id, member_no, display_name, level, warehouse_code |
| `admin_users` | id, email, password_hash, name, status |
| `roles` | id, code, name, description |
| `permissions` | id, code, name, type, resource |
| `admin_user_roles` | admin_user_id, role_id |
| `role_permissions` | role_id, permission_id |
| `audit_logs` | operator_type, operator_id, action, target_type, target_id, before, after, ip, created_at |

### 仓库与包裹

| 表 | 关键字段 |
| --- | --- |
| `warehouses` | id, code, name, country, city, status |
| `warehouse_addresses` | id, warehouse_id, address_line, receiver_name, phone, postal_code |
| `parcels` | id, parcel_no, user_id, warehouse_id, tracking_no, status, weight_kg, length_cm, width_cm, height_cm, inbound_at |
| `parcel_items` | id, parcel_id, name, quantity, declared_value, product_url, remark |
| `parcel_photos` | id, parcel_id, file_id, photo_type |
| `inbound_records` | id, parcel_id, operator_id, weight_kg, dimensions_json, remark, created_at |
| `unclaimed_parcels` | id, warehouse_id, tracking_no, status, description, claimed_by_user_id |

### 运单与物流

| 表 | 关键字段 |
| --- | --- |
| `waybills` | id, waybill_no, user_id, warehouse_id, status, channel_id, destination_country, recipient_snapshot, fee_total, paid_at, shipped_at, signed_at |
| `waybill_parcels` | waybill_id, parcel_id |
| `tracking_events` | id, waybill_id, event_time, location, status_text, description, source |
| `shipping_channels` | id, code, name, status, billing_method |
| `rate_plans` | id, channel_id, name, rule_json, status |
| `value_added_services` | id, code, name, price, status |
| `packaging_methods` | id, code, name, price, is_default |

### 代购和商品

| 表 | 关键字段 |
| --- | --- |
| `product_categories` | id, parent_id, name, sort_order, status |
| `products` | id, category_id, title, description, status, main_image_file_id |
| `product_skus` | id, product_id, sku_code, spec_json, price, stock |
| `cart_items` | id, user_id, product_id, sku_id, quantity |
| `purchase_orders` | id, order_no, user_id, status, source_type, total_amount, service_fee, paid_at |
| `purchase_order_items` | id, purchase_order_id, product_id, sku_id, name, quantity, unit_price, actual_price |
| `procurement_tasks` | id, purchase_order_id, assignee_id, status, purchase_amount, external_order_no, tracking_no |

### 财务

| 表 | 关键字段 |
| --- | --- |
| `wallets` | id, user_id, currency, balance, frozen_balance |
| `wallet_transactions` | id, wallet_id, user_id, type, direction, amount, balance_after, business_type, business_id, remark |
| `payment_orders` | id, payment_no, user_id, business_type, business_id, amount, status, method, paid_at |
| `recharge_requests` | id, user_id, amount, status, method, reviewed_by, reviewed_at |
| `offline_remittances` | id, user_id, amount, status, proof_file_id, reviewed_by, reviewed_at |

### 内容、客服、文件

| 表 | 关键字段 |
| --- | --- |
| `articles` | id, category_id, title, content, status, sort_order |
| `notices` | id, title, content, status, published_at |
| `help_categories` | id, name, sort_order |
| `tickets` | id, user_id, type, status, title |
| `ticket_messages` | id, ticket_id, sender_type, sender_id, content, file_id |
| `files` | id, storage_key, original_name, content_type, size, owner_type, owner_id |

## 数据库设计规则

- 主键统一使用 bigint 或 UUID，项目启动时二选一并固化。
- 所有业务单号使用独立字段，例如 `parcel_no`、`waybill_no`、`payment_no`。
- 金额使用 `decimal(18, 2)` 或更高精度，不使用 float。
- 重量使用 `decimal(10, 3)`。
- 体积字段可用 length/width/height 三字段，复杂信息放 JSON。
- 软删除只用于配置、内容等低风险对象；财务、支付、状态流水不得删除。
- 所有核心表必须有 `created_at`、`updated_at`。
- 后台状态变更必须写 `audit_logs`。
- 状态枚举值使用英文大写，展示文案由前端映射或后端返回 display 字段。
