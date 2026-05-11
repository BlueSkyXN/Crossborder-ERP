# Mobile H5

移动 H5 使用 React、Vite、TypeScript、Ant Design Mobile、React Router、TanStack Query、Axios 和 Zustand。

当前已从基础入口推进到移动端核心链路，主要覆盖：

- 会员登录和本地登录态。
- 底部五栏：首页、分类、寄件、购物车、我的。
- 寄件首页：集运/直邮 Tab、仓库 Tab、地址详情、一键复制。
- 商品首页、分类、购物车、确认订单和余额支付。
- 发布包裹预报、申请打包、运单列表、财务入口、积分推广、客服入口和会员工作台。
- 375px/390px 移动视口基础适配。
- Browser smoke 已覆盖移动端登录、寄件首页和增长入口。

本地开发命令：

```bash
pnpm --filter @crossborder-erp/mobile-h5 dev
pnpm --filter @crossborder-erp/mobile-h5 lint
pnpm --filter @crossborder-erp/mobile-h5 build
```
