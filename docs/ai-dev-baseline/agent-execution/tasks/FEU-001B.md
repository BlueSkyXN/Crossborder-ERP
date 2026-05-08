# FEU-001B 用户 Web 包裹预报、列表、详情

phase: `P2_PARCEL_WMS`  
depends_on: `BE-005`, `FEU-001A`  
next: `FEM-001B`

## 目标

实现用户 Web 包裹预报、包裹列表、详情和申请打包入口。

## 必读

- `../../13-integrated-product-spec.md`
- `../../15-frontend-style-from-screenshots-and-repro.md`
- `../../04-api-database-contract.md`

## 必须做

- 包裹预报表单。
- 包裹列表：状态筛选、分页、空状态。
- 包裹详情：快递单号、仓库、重量体积、图片、状态。
- `IN_STOCK` 包裹显示申请打包入口。

## 不要做

- 不做批量导入。
- 不做复杂无主认领审核。

## 验收

```bash
cd user-web
npm run lint
npm run build
```

业务验收：

- 用户提交 `tracking_no = TEST123` 后列表可见。
- 后台入库后用户端状态更新为 `IN_STOCK`。
