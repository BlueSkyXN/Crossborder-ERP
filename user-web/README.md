# User Web

用户 Web 使用 React、Vite、TypeScript、React Router、TanStack Query、Axios、Zustand、CSS Modules 和共享 UI tokens。

当前已从基础入口推进到会员业务主链路，主要覆盖：

- 会员登录和本地登录态。
- 会员控制台、会员资料、账户设置、自助改密码和本地 token 找回密码。
- 专属仓库地址卡片和一键复制。
- 包裹预报、包裹列表、包裹详情、在库包裹申请打包。
- 海外收件地址簿、运单创建、运单列表、运单详情、轨迹回看和确认收货。
- 钱包、线下汇款、积分推广、客服工单、手工代购和采购单基础页面。
- Browser smoke 已覆盖会员登录、包裹预报、汇款提交、工单提交、运单创建、余额支付和确认收货。

本地开发命令：

```bash
pnpm --filter @crossborder-erp/user-web dev
pnpm --filter @crossborder-erp/user-web lint
pnpm --filter @crossborder-erp/user-web build
```
