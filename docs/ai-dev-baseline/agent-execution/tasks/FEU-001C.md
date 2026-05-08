# FEU-001C 用户 Web 申请打包、运单、支付、轨迹

phase: `P3_WAYBILL_FINANCE`  
depends_on: `BE-006`, `BE-007`, `BE-008`, `FEU-001B`  
next: `FEM-001C`

## 目标

实现用户 Web 从在库包裹申请打包，到运单支付、轨迹和确认收货。

## 必读

- `../../13-integrated-product-spec.md`
- `../../15-frontend-style-from-screenshots-and-repro.md`
- `../../04-api-database-contract.md`

## 必须做

- 可打包包裹选择。
- 创建 Waybill。
- 运单列表和详情。
- 待付款运单支付弹窗。
- 轨迹时间线。
- 确认收货。

## 不要做

- 不接真实支付网关。
- 不做复杂优惠券/返利。

## 验收

```bash
cd user-web
npm run lint
npm run build
```

业务验收：

- 用户选择 `IN_STOCK` 包裹创建 Waybill。
- 后台设置费用后用户可余额支付。
- 用户可查看轨迹并确认收货。
