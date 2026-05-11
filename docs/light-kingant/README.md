# 轻量版 KINGANT-like 跨境代购/集运平台规格文档包

本目录用于指导 AI Agent 在现有 CrossBorder ERP 仓库上继续开发。

新的产品定位不是“重型 ERP”，也不是“纯发卡平台”，而是：

> 轻量、美观、好用的跨境代购与集运平台，借鉴 KINGANT（金蚁）这类平台的核心业务闭环，但只实现当前阶段最有价值的功能。

## 文档列表

| 文件 | 用途 |
| --- | --- |
| `00-product-positioning.md` | 产品定位、边界、轻量化原则 |
| `01-light-mvp-requirements.md` | 轻量 MVP 功能需求规格 |
| `02-unified-frontend-ui-spec.md` | 统一前端、视觉、交互规格 |
| `03-backend-api-data-spec.md` | 后端模块、API、数据模型规格 |
| `04-ai-development-plan.md` | AI Agent 分阶段开发计划和任务图 |
| `05-current-project-gap-map.md` | 现有项目与轻量 KINGANT-like 目标的差距地图 |

## 使用方式

建议 AI Agent 每轮只执行 1-2 个任务，不要一次性大改全项目。

推荐起步任务：

```text
DOC-KINGANT-LITE-001
API-CLIENT-LITE-001
WEB-UNIFIED-SHELL-001
```

第一阶段目标不是补满 KINGANT 全功能，而是做出：

```text
用户登录/注册
-> 查看仓库地址
-> 提交包裹预报
-> 后台扫码入库
-> 用户申请打包/提交运单
-> 后台审核计费
-> 用户充值/线下汇款/余额支付
-> 后台发货并添加轨迹
-> 用户查轨迹并确认收货
```

以及最小代购：

```text
用户提交商品链接/万能代购
-> 后台审核
-> 后台采购/到货
-> 转为在库包裹
-> 进入集运发货
```

## 当前明确不做

- 不做微服务。
- 不做 Kubernetes。
- 不做复杂 WMS 设备对接。
- 不做病毒扫描。
- 不做真实在线支付网关强集成；P0 使用余额、线下汇款、后台人工充值。
- 不默认启用 Redis/Celery。
- 不声明 MySQL/PostgreSQL 已生产验证。
- 不照搬 KINGANT 的 UI、文案、素材和代码，只借鉴业务结构与操作流程。
