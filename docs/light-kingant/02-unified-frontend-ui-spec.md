# 02 统一前端与 UI/UX 规格

## 1. 总体方向

当前项目已有 `admin-web`、`user-web`、`mobile-h5`。为了轻量、好维护、美观，建议新增一个统一前端：

```text
web-app/
```

`web-app` 同时承载：

- 用户 Web。
- 移动响应式用户端。
- 后台 Admin。

旧三端保留，作为迁移参考，不在第一阶段删除。

## 2. 路由设计

### 2.1 公共与用户端

```text
/                         首页
/login                    登录
/register                 注册
/help                     帮助中心
/estimate                 运费估算
/warehouse-address        仓库地址
/parcels/forecast         包裹预报
/parcels                  我的包裹
/waybills                 我的运单
/waybills/:id             运单详情
/purchase/manual          万能代购
/purchases                我的代购订单
/wallet                   财务中心
/remittances/new          提交线下汇款
/tickets                  工单消息
/account                  个人中心
/account/addresses        海外收件地址
```

### 2.2 后台

```text
/admin/login              后台登录
/admin                    控制台
/admin/parcels/inbound    包裹入库
/admin/parcels            包裹管理
/admin/unclaimed          无主包裹
/admin/waybills           运单处理
/admin/shipping-batches   发货批次
/admin/purchases          代购订单
/admin/finance            财务中心
/admin/members            会员管理
/admin/products           商品管理
/admin/content            内容管理
/admin/settings           基础设置
/admin/audit-logs         审计日志
/admin/roles              角色权限
/admin/admin-users        管理员账号
```

## 3. 视觉风格

目标：干净、现代、像 SaaS 产品，不像传统后台模板。

### 3.1 设计关键词

- 明亮。
- 简洁。
- 卡片式。
- 低噪音。
- 操作路径清晰。
- 状态颜色统一。
- 移动端友好。

### 3.2 颜色建议

不强制指定具体品牌色，但建议：

- 主色：蓝 / 青 / 紫中选一种。
- 成功：绿色。
- 警告：橙色。
- 错误：红色。
- 背景：浅灰。
- 卡片：白色。

### 3.3 字体与间距

- 页面最大宽度：用户端 `1200px`。
- 卡片圆角：`12px` 或以上。
- 页面间距：桌面 `24px`，移动 `16px`。
- 表格密度：中等，不要过密。

## 4. 用户端页面规格

### 4.1 首页

布局：

```text
Hero
核心流程 5 步
常用功能入口卡片
运费估算小组件
公告/帮助
页脚
```

移动端：

- Hero 简化。
- 功能入口 2 列卡片。
- 底部导航。

### 4.2 包裹预报页

表单字段：

- 仓库。
- 快递单号。
- 承运商。
- 商品名称。
- 数量。
- 申报价值。
- 备注。

交互：

- 提交后跳转我的包裹。
- 显示状态标签。

### 4.3 我的包裹页

组成：

- 状态 Tab。
- 搜索框。
- 包裹卡片/表格。
- 批量选择。
- 申请打包按钮。

桌面端：表格优先。
移动端：卡片优先。

### 4.4 运单详情页

组成：

- 运单状态条。
- 包裹列表。
- 费用明细。
- 支付按钮。
- 轨迹时间线。
- 收件地址快照。

### 4.5 财务中心

组成：

- 余额卡片。
- 充值/汇款按钮。
- 流水列表。
- 汇款记录。

P0 在线充值按钮可以展示为“暂未接入”或隐藏，只保留线下汇款和余额。

## 5. 后台页面规格

### 5.1 控制台

卡片：

- 今日入库。
- 待审核运单。
- 待付款运单。
- 待发货。
- 待审核汇款。
- 待处理代购。

图表：

- 近 7 日入库/发货趋势。
- 状态分布。

### 5.2 包裹入库

重点：快。

布局：

```text
大输入框：快递单号
仓库选择
重量/尺寸
入库按钮
匹配结果
最近入库记录
```

扫码枪作为键盘输入，回车触发查询/入库。

### 5.3 运单处理

布局：

- 状态 Tab。
- 筛选区。
- 运单表格。
- 操作按钮：审核、计费、发货、轨迹、取消。
- 详情抽屉。

### 5.4 财务后台

Tab：

- 汇款审核。
- 钱包流水。
- 后台充值/扣减。
- 应付款。

### 5.5 代购后台

Tab：

- 待审核。
- 待采购。
- 已采购。
- 已到货。
- 已完成。
- 异常/取消。

操作：

- 审核。
- 标记采购。
- 标记到货。
- 转包裹。

## 6. 组件规范

建议抽组件：

```text
AppShell
AdminShell
MobileBottomNav
PageHeader
StatCard
StatusTag
MoneyText
DataTable
SearchBar
ActionButtonGroup
Timeline
EmptyState
CopyButton
ConfirmModal
```

## 7. API Client 规范

所有请求集中到：

```text
packages/api-client
```

要求：

- 区分 adminToken 和 memberToken。
- 统一 baseURL。
- 统一错误处理。
- 页面不直接拼接 API URL。
- 后续可从 OpenAPI 生成类型。

## 8. 构建与验收

新增命令建议：

```bash
pnpm --filter web-app dev
pnpm --filter web-app build
pnpm --filter web-app lint
```

根目录命令：

```bash
pnpm build
pnpm lint
npm run e2e
npm run e2e:browser
```

在旧三端未删除前，CI 仍应保留旧三端 build。
