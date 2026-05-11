# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - LIGHT-KINGANT-MVP

### Added
- **产品定位调整 (DOC-KINGANT-LITE-001)**: 将项目从"重型 ERP"收敛为"轻量 KINGANT-like 跨境代购/集运平台"
- **轻量化规格文档**: `docs/light-kingant/` 包含产品定位、MVP 需求、UI 规格、后端 API 规格、开发计划、差距地图
- **统一 API Client (API-CLIENT-LITE-001)**: `packages/api-client/` 包，支持 member/admin 双 token、统一错误处理、完整 API 类型定义
- **统一前端骨架 (WEB-UNIFIED-SHELL-001)**: `web-app/` 统一前端，React + Vite + TypeScript + Ant Design
  - PublicShell / MemberShell / AdminShell 三层 Shell
  - 首页（Hero + 流程说明 + 快捷入口）
  - 端口 3000
- **API Client 集成修正 (FIX-WEBAPP-INTEGRATION-001)**: web-app 使用 @crossborder-erp/api-client，消除重复 Axios client
- **会员端业务页面 (13 页)**:
  - 仓库地址（一键复制）、包裹预报、我的包裹、包裹详情
  - 运单列表、运单详情（轨迹时间线 + 余额支付 + 确认收货）
  - 钱包余额与流水、线下汇款提交
  - 万能代购（链接解析 + 表单）、代购订单列表、代购详情
  - 个人中心（资料编辑 + 修改密码）、工单消息
  - 找回密码
- **后台运营页面 (9 页)**:
  - 包裹扫码入库（连续扫码 + 无主包裹识别）
  - 包裹管理、无主包裹审核
  - 运单处理（审核 / 计费 / 发货 / 轨迹录入）
  - 发货批次管理
  - 代购订单处理（审核 / 采购 / 到货 / 转包裹）
  - 财务中心（汇款审核 / 钱包充值扣款 / 交易流水）
  - 会员管理（冻结 / 解冻 / 重置密码）
  - 审计日志
  - 控制台（动态 summary_cards + work_queue + 操作日志）
- **创建运单页 (WaybillCreatePage)**: 选择可打包包裹 → 选择地址簿或手动填写收件人 → 提交运单
- **海外收件地址页 (AccountAddressesPage)**: 支持会员新增、编辑、删除和设置默认海外收件地址，并接入创建运单页地址簿选择
- **Web App Browser Smoke**: 新增 `npm run e2e:web-app`，隔离 SQLite + 系统 Chrome/CDP 验证统一前端会员登录、仓库地址、地址簿新增、创建运单、后台登录和控制台
- **Web App IAM CRUD**: `/admin/roles` 和 `/admin/admin-users` 从占位页补为真实 CRUD 页面，复用后端 IAM 角色、权限和管理员账号接口
- **API 契约对齐 (FIX-WEBAPP-CONTRACT-001)**:
  - types.ts 完整重写，字段名严格对齐后端 Serializer（parcel_no, tracking_no, waybill_no 等）
  - member.ts 新增 logout / updateProfile / changePassword / pay(purchase)
  - admin.ts 新增 adminMembers / adminTickets / adminAuditLogs / listTransactions / ScanInboundResponse
  - 全部 29 个页面从 raw `requestData(url)` 重构为 api-client 领域方法调用
  - 页面类型定义从本地 interface 迁移到 @crossborder-erp/api-client 统一类型
  - list response 解包收口为共享 `unwrapItemsResponse`，兼容后端 `{items}` 和数组返回形态
- **路由懒加载**: React.lazy() + Suspense 包裹所有页面，实现代码分割

### Changed
- README.md 产品定位从"跨境代购与集运 ERP"更新为"轻量跨境代购与集运平台"
- 目录结构新增 web-app 和 packages/api-client 说明
- pnpm-workspace.yaml 新增 web-app
- auth store Member 类型对齐后端（email/phone/status/profile.member_no 等）
- 创建运单页取消手填地址 ID 为主的交互，优先选择真实海外地址；未维护地址时仍保留手动填写 fallback
- 清理 web-app Fast Refresh warning 和已触发的 Ant Design 6 deprecated prop/browser warning
- `e2e:web-app` 扩展覆盖角色/管理员账号临时数据创建、页面展示和清理，继续使用隔离 SQLite

## [Previous] - ERP-ENHANCE-001

### Added
- **国家/地区管理** (`regions` app): 层级模型 (Country→Province→City→District→Zone)，23 条 8 国种子数据，公共/Admin CRUD API
- **商品多语言翻译**: ProductTranslation 模型 (FK + language_code UNIQUE)，Admin 面板翻译管理
- **商品属性体系**: ProductAttribute + ProductAttributeValue，支持 TEXT/NUMBER/ENUM/BOOLEAN 类型，分类关联，可筛选标记
- **运费估算引擎**: `/api/v1/freight/estimate`，首重+续重+体积重计算，RatePlan 规则驱动
- **细粒度 CRUD 权限**: 7 模块 21 条 action 权限 (create/update/delete)，method_permissions 视图模式
- **API 限流**: DRF throttling (匿名 60/min，认证用户 120/min，登录 10/min)，LocMemCache
- **领域事件信号**: 包裹/运单/支付/会员等 8 个 Django signal，logging handler
- **前端国际化**: i18next + react-i18next，zh-CN/en 双语，三端统一接入
- **Admin 仪表盘图表**: @ant-design/charts 月度趋势折线图
- **Admin 地区管理页**: 面包屑导航层级浏览，CRUD 操作
- **Admin 商品增强**: 多语言翻译面板、属性管理面板、Tabs 切换
- **Admin 包裹标签打印**: 打印预览弹窗 + window.print
- **User Web 运费估算**: 首页运费估算卡片，表单+结果展示
- **User Web 成长体系**: 推广邀请、积分明细、返利记录独立页
- **User Web 仪表盘**: 待预报包裹动态统计，快捷入口扩展
- **Mobile H5 首页**: Swiper 轮播 Banner、双列瀑布流商品网格
- **Mobile H5 分类**: 左右分栏布局（左侧分类滚动+右侧商品网格）
- **Mobile H5 购物车**: 按店铺/分类分组，组级全选

### Changed
- 商品视图从 `write_permission` 迁移到 `method_permissions` 模式
- 仓库配置视图同步迁移到 `method_permissions`

### Infrastructure
- 新增数据库迁移: `regions/0001_initial`, `products/0002_productattribute_*`
- Backend 222 tests passing
- All 3 frontend builds passing (admin-web, user-web, mobile-h5)
