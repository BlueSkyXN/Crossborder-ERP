# 演示脚本

本脚本用于手工演示 P0 集运主链路和最小代购链路。自动化验收可直接运行：

```bash
npm run e2e
```

## 准备

启动命令：

```bash
(cd backend && uv run python manage.py migrate)
(cd backend && uv run python manage.py seed_demo)
(cd backend && uv run python manage.py runserver)
pnpm --filter admin-web dev
pnpm --filter user-web dev
pnpm --filter mobile-h5 dev
```

访问地址：

| 端 | 地址 |
| --- | --- |
| Admin Web | `http://localhost:3001` |
| User Web | `http://localhost:3002` |
| Mobile H5 | `http://localhost:3003` |

测试账号：

| 类型 | 邮箱 | 密码 |
| --- | --- | --- |
| Admin | `admin@example.com` | `password123` |
| Warehouse | `warehouse@example.com` | `password123` |
| Finance | `finance@example.com` | `password123` |
| Buyer | `buyer@example.com` | `password123` |
| Member | `user@example.com` | `password123` |

## 集运主链路

1. 后台登录 Admin Web。
2. 进入 `/warehouses`，确认至少存在 `深圳仓`、测试空运渠道、纸箱包装和加固服务。
3. 用户登录 User Web，进入 `/warehouse-address` 或 `/dashboard`，复制专属仓库地址。
4. 用户进入 `/parcels`，提交包裹预报：
   - 仓库：深圳仓
   - 快递单号：使用唯一值，例如 `DEMO-CN-001`
   - 承运商：`DEMO Express`
   - 商品：任意测试商品
5. 后台进入 `/parcels`，搜索该快递单号并执行扫描入库。
6. 用户刷新 `/parcels`，确认包裹状态为在库。
7. 用户在包裹页选择在库包裹，申请打包创建运单。
8. 后台进入 `/waybills`，审核运单并设置费用。
9. 后台进入 `/finance` 或运单相关操作，给 `user@example.com` 人工充值。
10. 用户进入 `/waybills`，对待付款运单执行余额支付。
11. 后台对已付款运单执行发货，并添加一条运输轨迹。
12. 用户进入运单详情或追踪页，查看轨迹。
13. 用户确认收货，运单状态变为已签收。

预期结果：

- 包裹从 `PENDING_INBOUND` 流转到 `IN_STOCK`，再进入打包流程。
- 运单从 `PENDING_REVIEW` 流转到 `SIGNED`。
- 钱包产生后台充值和运单支付流水。
- 轨迹列表至少包含发货和运输中/签收事件。

## 最小代购链路

1. 用户登录 User Web 或 Mobile H5。
2. 进入手工代购入口：
   - User Web：`/purchases` 或 `/purchase-orders`
   - Mobile H5：`/me/purchases/manual`
3. 提交一个手工代购单：
   - 商品名称：`演示代购商品`
   - 单价：`9.90`
   - 数量：`2`
   - 服务费：`1.10`
4. 如钱包余额不足，后台先给用户人工充值。
5. 用户对代购单执行余额支付，订单进入待审核。
6. 后台登录 Admin Web，进入 `/purchases`。
7. 后台审核代购单，进入待采购。
8. 后台录入采购信息和国内快递单号，标记已采购。
9. 后台标记到货。
10. 后台选择仓库、重量和体积，将到货代购单转成包裹。
11. 用户进入 `/parcels` 或 Mobile H5 的包裹入口，确认新包裹为在库。
12. 用户可继续对该包裹申请打包创建运单。

预期结果：

- 代购单从 `PENDING_PAYMENT` 流转到 `COMPLETED`。
- 到货转包裹后生成 `Parcel.IN_STOCK`。
- 转出的包裹可继续进入集运运单流程。

## 移动 H5 快速验收

1. 打开 `http://localhost:3003`。
2. 使用 `user@example.com / password123` 登录。
3. 在首页查看商品并加入购物车。
4. 在 `/cart` 提交订单并使用钱包支付。
5. 在 `/me` 查看代购订单、手工代购、包裹和运单入口。
6. 在 `/me/purchases/manual` 提交手工代购单。

## 自动化对照

`npm run e2e` 已自动覆盖：

- 配置确认。
- 仓库地址读取。
- 包裹预报到签收。
- 手工代购到货转包裹。
- 代购包裹继续申请打包。

浏览器手工演示用于补充三端页面路径和交互检查。
