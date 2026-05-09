# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - ERP-ENHANCE-001

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
