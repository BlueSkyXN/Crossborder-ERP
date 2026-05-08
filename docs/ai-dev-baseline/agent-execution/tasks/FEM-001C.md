# FEM-001C 移动 H5 运单列表、追踪、确认收货

phase: `P3_WAYBILL_FINANCE`  
depends_on: `BE-006`, `BE-007`, `BE-008`, `FEM-001B`  
next: `BE-009`

## 目标

实现移动端运单列表、详情、支付入口、追踪和确认收货。

## 必读

- `../../13-integrated-product-spec.md`
- `../../15-frontend-style-from-screenshots-and-repro.md`
- `../../04-api-database-contract.md`

## 必须做

- 运单状态 Tab。
- 运单卡片列表。
- 运单详情。
- 支付确认页或弹窗。
- 轨迹时间线。
- 确认收货按钮。

## 不要做

- 不用桌面表格。
- 不做真实支付 SDK。

## 验收

```bash
cd mobile-h5
npm run lint
npm run build
```

移动验收：

- 375px 宽移动视口下运单卡片、轨迹时间线、底部按钮不重叠。
