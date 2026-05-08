# FEM-001B 移动 H5 发布预报、包裹详情、申请打包入口

phase: `P2_PARCEL_WMS`  
depends_on: `BE-005`, `FEM-001A`  
next: `BE-006`

## 目标

实现移动端包裹预报和包裹详情，打通寄件高频入口。

## 必读

- `../../13-integrated-product-spec.md`
- `../../15-frontend-style-from-screenshots-and-repro.md`
- `../../04-api-database-contract.md`

## 必须做

- 发布预报页。
- 包裹列表或入口。
- 包裹详情卡片。
- `IN_STOCK` 包裹的申请打包入口。
- 移动端表单校验和底部操作栏。

## 不要做

- 不把移动端做成桌面表格。
- 不做复杂批量功能。

## 验收

```bash
cd mobile-h5
npm run lint
npm run build
```

移动验收：

- 375px 宽移动视口下表单、卡片、底部按钮不重叠。
