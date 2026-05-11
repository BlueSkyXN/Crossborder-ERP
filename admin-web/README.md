# Admin Web

后台管理端使用 React、Vite、TypeScript、Ant Design、React Router、TanStack Query、Axios 和 Zustand。

当前已从基础壳推进到真实运营后台，主要覆盖：

- 管理员登录和本地登录态。
- 后台 dashboard 真实聚合数据。
- 会员、包裹、入库、无主包裹、运单、发货批次、采购、财务、客服工单、审计日志等运营页面。
- 角色权限和管理员账号管理，支持角色创建、权限分配、管理员创建、启停、密码重置和安全删除。
- Browser smoke 已覆盖后台登录、包裹入库、汇款审核、工单回复、运单审核计费、发货和关键面板导航。

本地开发命令：

```bash
pnpm --filter @crossborder-erp/admin-web dev
pnpm --filter @crossborder-erp/admin-web lint
pnpm --filter @crossborder-erp/admin-web build
```
