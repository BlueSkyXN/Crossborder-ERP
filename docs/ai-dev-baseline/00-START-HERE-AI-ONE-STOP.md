# 00 START HERE：AI 一条龙开发入口

本文件是项目总入口。真正让 Codex/Agent 自动接手开发时，优先从 `agent-execution/` 开始；本文件负责解释项目目标和硬约束。

更新：如果是让 Agent 自动继续开发，优先读取 `agent-execution/`。该目录已经包含 `current-state.yaml`、`task-graph.yaml`、`workflow-path.md` 和 `tasks/*.md`，比复制提示词更适合新手接力。

## 一句话任务

基于现有 ChatGPT/Gemini 三端分析、截图资料和 Gemini 前端复现包，独立实现一个跨境代购与集运 ERP。第一版必须跑通“集运主链路 + 最小代购链路 + 钱包支付 + 三端联调 + 测试部署交付”，不能只搭工程框架。

## Agent 必读顺序

让 Codex/Agent 按这个顺序读：

```text
agent-execution/README.md
agent-execution/current-state.yaml
agent-execution/task-graph.yaml
agent-execution/workflow-path.md
00-START-HERE-AI-ONE-STOP.md
12-source-evidence-map.md
13-integrated-product-spec.md
14-module-implementation-spec.md
02-domain-model-state-machines.md
03-technical-architecture.md
04-api-database-contract.md
15-frontend-style-from-screenshots-and-repro.md
07-delivery-plan-sprints.md
09-agent-task-backlog.md
10-agent-prompts.md
08-qa-security-deployment.md
```

如果时间很紧，至少读：

```text
agent-execution/README.md
agent-execution/current-state.yaml
agent-execution/task-graph.yaml
agent-execution/tasks/<current_task>.md
00-START-HERE-AI-ONE-STOP.md
13-integrated-product-spec.md
14-module-implementation-spec.md
02-domain-model-state-machines.md
04-api-database-contract.md
```

## 最重要的开发约束

1. 这是一个独立实现，不是复刻旧系统。
2. ChatGPT/Gemini 分析和截图是业务证据，不是 UI/代码/数据库复制对象。
3. 第一版必须端到端交付，不接受只做脚手架。
4. 所有任务必须能追溯到模块、API、数据模型、页面、验收点。
5. 未确认事项必须标记 `TODO_CONFIRM`，不能让 AI 脑补。
6. 每个模块都要同时考虑：后端模型、API、后台页面、用户 Web、移动 H5、测试、验收。

## 最终产品形态

```text
backend      Django + DRF 模块化单体
admin-web    React + Vite + Ant Design
user-web     React + Vite
mobile-h5    React + Vite
database     PostgreSQL
cache/task   Redis + Celery
deploy       Docker Compose + staging 文档
```

第一版交付后，应能演示：

```text
后台配置仓库/渠道/包装/增值服务
  -> 用户登录并复制专属仓库地址
  -> 用户提交包裹预报
  -> 后台扫描入库并录入重量体积图片
  -> 用户选择在库包裹申请打包
  -> 后台审核运单并设置费用
  -> 后台给用户充值
  -> 用户余额支付运单
  -> 后台发货并添加轨迹
  -> 用户查看轨迹并确认收货
  -> 用户提交手工代购
  -> 后台采购到货并转成 Parcel
  -> Parcel 继续走集运主链路
```

## MVP 主线

P0 必做：

- 账号与权限
- 会员资料和收件标识
- 仓库、国家地区、渠道、包装、增值服务
- 包裹预报
- 扫描入库
- 包裹列表和详情
- 无主包裹简版
- 申请打包发货
- 运单审核、计费、支付、发货、签收
- 钱包、人工充值、余额支付、流水
- 物流轨迹人工录入
- 最小代购和到货转包裹
- 后台、用户 Web、移动 H5 三端联调
- 自动化测试和部署文档

第一版不做：

- 自动采购
- 淘宝/1688/拼多多真实接口
- 真实在线支付回调
- 多租户 SaaS
- PDA/电子秤/打印机深度集成
- 推广返利
- 高级 BI
- 旧系统 UI 复刻

## 推荐给 Agent 的第一条指令

实习生不需要复制长提示词。只要让 Agent 读取 `agent-execution/`，Agent 应按其中的状态文件和任务图继续。

确认无误后，再让 Agent 执行：

```text
读取 ai-dev-baseline/agent-execution/，根据 current-state.yaml 和 task-graph.yaml 执行当前任务。
```

## 实习生怎么指挥 AI

不要说：

```text
帮我开发这个 ERP。
```

要说：

```text
读取 ai-dev-baseline/agent-execution/，按 current-state.yaml 的 current_task 和 task-graph.yaml 的依赖继续。
```

## 判断 AI 是否跑偏

看到下面情况，要立刻打断：

- AI 新增了文档里没有的核心状态。
- AI 把 `Package` 当核心包裹对象，而不是 `Parcel`。
- AI 把 `Shipment` 当核心运单对象，而不是 `Waybill`。
- AI 没有 service 层，直接在 view/page 里改状态。
- AI 做了自动采购、真实支付、多租户等第一版排除功能。
- AI 只写页面，没有 API 和测试。
- AI 只搭框架，没有端到端业务闭环。
- AI 没有说明验证命令。

## 一条龙完成路线

```text
INIT-001/BE-001：项目和后端基础
  -> BE-002/BE-003：后台和用户认证
  -> BE-004：仓库和基础配置
  -> BE-005：包裹预报和入库
  -> BE-006：运单和打包
  -> BE-007：钱包和余额支付
  -> BE-008：物流轨迹
  -> BE-009：最小代购
  -> FEA-001~004：后台可操作
  -> FEU-001：用户 Web 主链路
  -> FEM-001：移动 H5 主链路
  -> E2E-001：端到端测试
  -> DOC-001：交付文档
```

完成定义：`08-qa-security-deployment.md` 的上线前检查全部通过。
