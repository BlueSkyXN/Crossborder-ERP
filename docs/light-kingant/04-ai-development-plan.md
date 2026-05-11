# 04 AI Agent 开发计划

## 1. 总原则

- 不推倒重写。
- 不拆微服务。
- 不引入重型外部依赖。
- 不做病毒扫描。
- 不默认 Docker。
- 不声明 MySQL/PostgreSQL/Redis/Celery 已验证。
- 每个任务必须可本地 SQLite 验收。
- 每个任务必须更新文档和测试。
- 每轮任务尽量小，避免大面积改动。

## 2. 推荐任务图

```text
DOC-KINGANT-LITE-001
  -> API-CLIENT-LITE-001
  -> WEB-UNIFIED-SHELL-001
      -> WEB-USER-HOME-001
      -> WEB-PARCEL-FLOW-001
      -> WEB-WAYBILL-FLOW-001
      -> WEB-PURCHASE-FLOW-001
      -> WEB-FINANCE-FLOW-001
      -> WEB-ADMIN-OPS-001
  -> UX-POLISH-001
  -> E2E-KINGANT-LITE-001
```

后端轻量增强：

```text
BACKEND-DASHBOARD-LITE-001
BACKEND-PURCHASE-LITE-001
BACKEND-FREIGHT-ESTIMATE-LITE-001
BACKEND-PERMISSION-CLEANUP-001
```

## 3. 第一阶段：文档和统一前端骨架

### DOC-KINGANT-LITE-001

目标：把项目文档定位从“重型跨境 ERP”收敛为“轻量 KINGANT-like 跨境代购/集运平台”。

交付：

- README 新增产品定位段。
- docs 新增 light-kingant 文档入口。
- 明确 P0/P1/P2 边界。
- 删除或改写与当前定位冲突的“必须生产化”优先级描述。

验收：

```bash
npm run evidence
```

### API-CLIENT-LITE-001

目标：建立轻量 API client，供新统一前端使用。

交付：

```text
packages/api-client/
  src/client.ts
  src/member.ts
  src/admin.ts
  src/types.ts
```

要求：

- 支持 member token。
- 支持 admin token。
- 统一错误处理。
- 不在页面里拼接 URL。
- 可先手写类型，后续再接 OpenAPI 生成。

验收：

```bash
pnpm --filter @crossborder-erp/api-client build
pnpm build
```

### WEB-UNIFIED-SHELL-001

目标：新增 `web-app`，建立统一前端骨架。

交付：

```text
web-app/
  src/app/App.tsx
  src/routes/index.tsx
  src/shells/PublicShell.tsx
  src/shells/MemberShell.tsx
  src/shells/AdminShell.tsx
  src/pages/HomePage.tsx
  src/pages/LoginPage.tsx
  src/pages/admin/AdminLoginPage.tsx
  src/pages/admin/AdminDashboardPage.tsx
```

要求：

- `/` 可访问首页。
- `/login` 可会员登录。
- `/admin/login` 可后台登录。
- `/admin` 需后台 token。
- 移动端有基础响应式。

验收：

```bash
pnpm --filter web-app lint
pnpm --filter web-app build
pnpm build
```

## 4. 第二阶段：用户核心闭环

### WEB-USER-HOME-001

目标：做美观首页、仓库地址、帮助入口。

交付：

- 首页 Hero。
- 5 步流程。
- 常用入口卡片。
- 仓库地址页。
- 复制地址按钮。

### WEB-PARCEL-FLOW-001

目标：统一前端跑通包裹预报和我的包裹。

交付：

- 包裹预报页。
- 我的包裹页。
- 包裹状态标签。
- 申请打包入口。

### WEB-WAYBILL-FLOW-001

目标：统一前端跑通运单创建、支付、轨迹、确认收货。

交付：

- 运单列表。
- 运单详情。
- 收件地址选择。
- 余额支付。
- 轨迹时间线。

### WEB-PURCHASE-FLOW-001

目标：统一前端跑通万能代购。

交付：

- 万能代购表单。
- 商品链接解析入口。
- 代购订单列表。
- 代购详情。

### WEB-FINANCE-FLOW-001

目标：统一前端跑通财务中心。

交付：

- 余额卡片。
- 流水列表。
- 线下汇款提交。
- 汇款记录。

## 5. 第三阶段：后台轻量运营台

### WEB-ADMIN-OPS-001

目标：统一前端提供最小后台运营能力。

交付：

- 后台控制台。
- 包裹入库页。
- 运单处理页。
- 代购处理页。
- 汇款审核页。
- 商品管理入口。
- 会员管理入口。

要求：

- 先做主流程，不追求所有字段。
- 大页面必须拆组件，不允许再出现 1000+ 行单页。

### BACKEND-DASHBOARD-LITE-001

目标：如果现有 dashboard 不够，补轻量聚合接口。

指标：

- 今日入库。
- 待审核运单。
- 待付款。
- 待发货。
- 待审核汇款。
- 待处理代购。

## 6. 第四阶段：体验打磨和 E2E

### UX-POLISH-001

目标：把产品做得“好看、简单”。

交付：

- 统一状态颜色。
- 统一空状态。
- 统一按钮文案。
- 统一金额展示。
- 移动端底部导航。
- 首页视觉优化。
- 后台表格密度优化。

### E2E-KINGANT-LITE-001

目标：新增统一前端的 browser smoke。

覆盖：

```text
会员登录
-> 查看仓库地址
-> 提交包裹预报
-> 后台登录
-> 扫描入库
-> 用户申请打包
-> 后台设置费用
-> 用户线下汇款
-> 后台审核入账
-> 用户余额支付
-> 后台发货
-> 用户查看轨迹并确认收货
```

以及：

```text
用户提交万能代购
-> 后台审核/采购/到货
-> 转在库包裹
```

## 7. 不建议立即执行的任务

以下后置：

```text
MySQL 真实验证
PostgreSQL 真实验证
Redis/Celery
对象存储
真实支付网关
真实物流 API
复杂 WMS
病毒扫描
完整 BI
微服务
```

## 8. 每轮 AI Agent 执行模板

每轮开工前，AI 应先读：

```text
README.md
light-kingant-docs/README.md
light-kingant-docs/00-product-positioning.md
light-kingant-docs/04-ai-development-plan.md
```

每轮必须输出：

- 修改文件列表。
- 验证命令。
- 通过/失败结果。
- 未完成边界。
- 下一建议任务。

## 9. 推荐下一轮 Prompt

```text
请在当前 CrossBorder-ERP 仓库中执行 DOC-KINGANT-LITE-001、API-CLIENT-LITE-001、WEB-UNIFIED-SHELL-001。

目标：把项目定位调整为轻量 KINGANT-like 跨境代购/集运平台；新增 packages/api-client；新增 web-app 统一前端骨架，包含首页、会员登录、后台登录、后台控制台占位。

约束：
- 不删除 admin-web/user-web/mobile-h5。
- 不引入微服务、Docker、Redis/Celery、病毒扫描。
- 不声明 MySQL/PostgreSQL 已验证。
- 使用 SQLite-first 本地验证。
- 旧三端仍需 pnpm build 通过。
- 新 web-app 必须 pnpm build 通过。
- 更新 README 和 docs。
- 运行 npm run evidence、后端 check、pytest、pnpm lint、pnpm build。
```
