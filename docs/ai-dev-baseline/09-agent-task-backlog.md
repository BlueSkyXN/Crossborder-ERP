# 09 可直接交给 Agent 的任务 Backlog

本文件是给 Codex 等 Agent 使用的任务卡。实习生不要一次性丢全部任务给 Agent，应按顺序逐个执行。

## INIT-001 创建 monorepo

目标：创建项目根结构和基础 README。

输入文档：

- `03-technical-architecture.md`

必须做：

- 创建 `backend`、`admin-web`、`user-web`、`mobile-h5`、`docs`、`infra`。
- 创建根 `README.md`。
- 创建 `.env.example`。
- 创建 `docker-compose.yml`，包含 PostgreSQL 和 Redis。

不要做：

- 不写业务模型。
- 不写大量页面。

验收：

- 目录结构符合文档。
- `docker compose up -d postgres redis` 可启动。

## BE-001 初始化后端项目

目标：初始化 Django/DRF 后端。

必须做：

- 创建 Django 项目。
- 配置 settings 分层。
- 安装 DRF、drf-spectacular、pytest。
- 创建 `common` app。
- 实现 `/api/v1/health`。
- 配置统一响应和异常基线。

验收：

- `python manage.py runserver` 可启动。
- `GET /api/v1/health` 返回统一成功格式。
- `pytest` 可运行。

## BE-002 IAM 和 RBAC

目标：实现后台认证和权限骨架。

输入文档：

- `02-domain-model-state-machines.md`
- `04-api-database-contract.md`

必须做：

- `AdminUser`、`Role`、`Permission`。
- 后台登录接口。
- 当前管理员接口。
- 菜单权限接口。
- 种子超级管理员和基础角色。

验收：

- 超级管理员可登录。
- 无 token 访问后台接口返回 `UNAUTHORIZED`。
- 无权限访问返回 `FORBIDDEN`。

## BE-003 用户和会员资料

目标：实现用户认证和会员资料。

必须做：

- `User`、`MemberProfile`。
- 用户注册、登录、当前用户。
- 会员收件标识生成。
- 用户数据隔离测试。

验收：

- 测试用户可登录。
- `GET /api/v1/me` 返回会员资料。
- 用户 A 不能访问用户 B 数据。

## BE-004 仓库和基础配置

目标：实现仓库、地址、渠道、包装、增值服务。

必须做：

- `Warehouse`、`WarehouseAddress`。
- `ShippingChannel`、`PackagingMethod`、`ValueAddedService`。
- 后台 CRUD。
- 用户端仓库地址查询。
- 种子测试仓库和渠道。

验收：

- 后台能新增仓库。
- 用户端能看到专属仓库地址。

## BE-005 包裹预报和入库

目标：实现 Parcel 主流程。

必须做：

- `Parcel`、`ParcelItem`、`InboundRecord`。
- 用户提交预报。
- 后台待入库列表。
- 后台扫描入库。
- 包裹状态机校验。

验收：

- 预报后状态 `PENDING_INBOUND`。
- 入库后状态 `IN_STOCK`。
- 非法状态操作返回 `STATE_CONFLICT`。

## BE-006 运单和打包

目标：实现 Waybill 主流程。

必须做：

- `Waybill`、`WaybillParcel`。
- 用户选择在库包裹创建运单。
- 后台审核、打包、设置费用。
- 状态机校验。

验收：

- 只有 `IN_STOCK` 包裹可创建运单。
- 创建运单后包裹变为 `PACKING_REQUESTED`。
- 运单状态按文档流转。

## BE-007 钱包和余额支付

目标：实现 Wallet、PaymentOrder、WalletTransaction。

必须做：

- 后台人工充值。
- 用户支付运单。
- 幂等支付。
- 钱包流水。
- 事务保护。

验收：

- 充值增加余额并生成流水。
- 支付扣减余额并生成支付单和流水。
- 重复支付不重复扣款。

## BE-008 物流轨迹

目标：实现 TrackingEvent。

必须做：

- 后台添加轨迹节点。
- 用户查询轨迹。
- 发货时至少创建一个轨迹节点。

验收：

- 轨迹按时间排序。
- 用户不能查看别人的运单轨迹，公开查询接口除外。

## BE-009 最小代购

目标：实现 PurchaseOrder 和到货转包裹。

必须做：

- 手工代购订单。
- 后台审核、采购、到货、异常、取消。
- 到货转 Parcel。

验收：

- 用户可提交代购单。
- 后台到货后生成 Parcel。
- Parcel 可继续申请打包发货。

## FEA-001 后台基础

目标：实现 admin-web 登录和 Layout。

必须做：

- 登录页。
- API client。
- token 保存和退出。
- Layout、菜单、路由守卫。
- 403/404 页面。

验收：

- 未登录跳转登录。
- 登录后显示菜单。

## FEA-002 后台基础配置

目标：实现仓库、渠道、包装、增值服务管理。

必须做：

- 列表、筛选、分页。
- 新增、编辑、启停。
- loading/empty/error。

验收：

- 后台新增仓库后用户端可见。

## FEA-003 后台包裹入库

目标：实现待入库、扫描入库、包裹详情。

验收：

- 能搜索用户预报包裹。
- 能入库并录入重量体积。
- 入库后状态更新。

## FEA-004 后台运单和财务

目标：实现运单审核、设置费用、发货、充值。

验收：

- 后台能推进运单到待付款。
- 后台充值后用户余额变化。
- 后台发货后用户能查轨迹。

## FEU-001 用户 Web 主链路

目标：实现用户 Web 从登录到支付发货。

必须做：

- 登录。
- 控制台仓库地址。
- 包裹预报。
- 包裹列表/详情。
- 申请打包。
- 运单列表/详情。
- 余额支付。

验收：

- 用户 Web 可完整走通集运主链路。

## FEM-001 移动 H5 主链路

目标：实现移动端集运核心页面。

必须做：

- 登录。
- 底部导航。
- 寄件首页仓库地址。
- 发布预报。
- 包裹详情。
- 申请打包。
- 运单列表。
- 运单追踪。

验收：

- 移动端可完成预报、申请打包、查看运单轨迹。

## E2E-001 端到端验收脚本

目标：写 Playwright 端到端测试。

必须做：

- 使用种子账号。
- 覆盖预报、入库、申请打包、审核、充值、支付、发货、轨迹。

验收：

- `npm run e2e` 或约定命令可通过。

## DOC-001 交付文档

目标：补齐项目 README 和部署说明。

必须做：

- 本地启动。
- 测试账号。
- 数据库迁移。
- 种子数据。
- 常见问题。
- 演示脚本。

验收：

- 新人按 README 能启动项目并跑通演示流程。
