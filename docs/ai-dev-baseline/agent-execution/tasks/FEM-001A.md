# FEM-001A 移动 H5 登录、底部导航、寄件首页

phase: `P1_IDENTITY_CONFIG`  
depends_on: `BE-003`, `BE-004`  
next: `BE-005`

## 目标

实现移动 H5 基础入口、登录态、底部五栏和寄件首页仓库地址。

## 必读

- `../../13-integrated-product-spec.md`
- `../../15-frontend-style-from-screenshots-and-repro.md`
- `../../04-api-database-contract.md`

## 必须做

- 初始化或完善 `mobile-h5`。
- 登录页。
- 底部五栏：首页、分类、寄件、购物车、我的。
- 寄件首页：集运/直邮 Tab、仓库 Tab、地址详情、一键复制、发布预报/申请打包入口。
- 移动视口适配。

## 不要做

- 不做原生 App。
- 不复刻旧移动端视觉。

## 验收

```bash
cd mobile-h5
npm run lint
npm run build
```

手工验收：

- 375px 宽移动视口下无明显重叠。
- 测试用户登录后能复制仓库地址。
