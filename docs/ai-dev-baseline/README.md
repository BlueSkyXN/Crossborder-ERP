# 跨境代购与集运 ERP AI 开发交付基线包

版本：v0.3  
用途：给新手实习生和 Codex 等 Agent 接力开发使用。  
目标：把现有分析材料收敛成可开发、可验收、可排期、可由 AI 持续推进的完整项目规格。

## 这套文档解决什么问题

当前目录已经有后台、用户 Web、移动端、开源调研、净室边界等分析材料。这些材料信息量很大，但不能直接交给开发照着写，因为会出现：

- 三端命名不统一，例如 `package`、`parcel`、`shipment`、`waybill` 混用。
- MVP 范围不冻结，AI 容易一次性做成超大 ERP。
- 状态机不统一，后台、用户端、移动端展示状态可能不一致。
- API、数据库、权限、页面任务没有形成同一套开发输入。
- 新手开发者不知道下一步该问 AI 什么，也不知道如何验收 AI 写出的代码。

所以本目录不是普通分析报告，而是开发接力用的“规格锚点”。

## 一句话使用方式

实习生接手后，不要让 AI 直接读散落的 ChatGPT/Gemini 分析文档开写，也不要靠复制一大段提示词推进。正确做法是让 AI 读取执行目录：

```text
ai-dev-baseline/agent-execution/
```

这个目录里已经固化了：

- `current-state.yaml`：当前应该做哪个任务。
- `task-graph.yaml`：任务依赖、阶段、next 路径。
- `workflow-path.md`：人工可读的阶段路线图。
- `tasks/*.md`：每个任务的输入、输出、验收。

实习生只需要告诉 AI 读取这个目录，AI 应自行根据 `current-state.yaml` 和 `task-graph.yaml` 找到下一步。

## 阅读顺序

实习生第一次接手时，按下面顺序读：

1. `agent-execution/README.md`：Agent 自动执行入口。
2. `agent-execution/current-state.yaml`：当前任务状态。
3. `agent-execution/task-graph.yaml`：机器可读任务依赖图。
4. `agent-execution/workflow-path.md`：人工可读任务路径。
5. `agent-execution/tasks/`：每个任务的独立规格。
6. `00-START-HERE-AI-ONE-STOP.md`：项目总目标和硬约束。
7. `12-source-evidence-map.md`：说明 ChatGPT/Gemini 分析、截图、前端复现包如何被吸收到最终规格。
8. `13-integrated-product-spec.md`：最终产品范围，三端定位，P0/P1/P2。
9. `14-module-implementation-spec.md`：按模块拆分后端、API、后台、用户 Web、移动 H5、测试和验收。
10. `02-domain-model-state-machines.md`：统一实体命名和状态机。
11. `03-technical-architecture.md`：技术栈、架构、目录结构、种子数据和本地启动目标。
12. `04-api-database-contract.md`：接口、数据库、错误码、分页、鉴权规则。
13. `15-frontend-style-from-screenshots-and-repro.md`：从截图和 Gemini 复现包提炼出来的前端风格、布局和交互规则。

辅助文档：

- `00-project-charter.md`：项目目标、边界、净室原则。
- `01-requirements-baseline.md`：MVP 功能冻结表。
- `05-frontend-ux-spec.md`：三端 UI/UX 基础规格。
- `06-agent-development-workflow.md`：基于 Codex/Agent 的日常开发循环。
- `07-delivery-plan-sprints.md`：Sprint 计划。
- `08-qa-security-deployment.md`：测试、安全、部署和上线检查。
- `09-agent-task-backlog.md`：旧版任务总表，已被 `agent-execution/tasks/` 拆分。
- `10-agent-prompts.md`：提示词模板，仅作为备用。
- `11-agents-md-template.md`：未来代码仓库根目录 `AGENTS.md` 模板。
- `16-end-to-end-agent-runbook.md`：端到端执行说明。
- `17-copy-this-to-codex.md`：复制式提示词备用，不作为主流程。

## 对后续 Agent 的总规则

这不是给实习生复制的提示词，而是 Agent 读取本文件后必须遵守的规则：

```text
你正在基于 ai-dev-baseline/ 继续开发“跨境代购与集运 ERP”。
必须遵守：
1. 默认从 agent-execution/README.md 开始，不靠复制提示词推进。
2. 以 agent-execution/current-state.yaml 判断当前任务。
3. 以 agent-execution/task-graph.yaml 判断依赖和 next 任务。
4. 以 agent-execution/tasks/<task_id>.md 执行单个任务，不得一次性扩大范围。
5. 以 13-integrated-product-spec.md 的最终产品范围为准，不得擅自扩大第一版功能。
6. 以 14-module-implementation-spec.md 的模块拆分推进，不要只搭框架。
7. 以 02-domain-model-state-machines.md 的实体命名和状态机为准，不得创造新的核心实体、状态和业务流。
8. 以 03-technical-architecture.md 和 04-api-database-contract.md 为工程约束。
9. 前端必须参考 15-frontend-style-from-screenshots-and-repro.md，但不得复刻旧系统视觉、文案、接口、数据库结构、素材和专有实现。
10. 12-source-evidence-map.md 是追溯 ChatGPT/Gemini 分析、截图和前端复现包的证据入口；遇到不确定字段再回看原始材料。
11. 遇到文档标记为“待确认”的内容，只能标记 TODO_CONFIRM 或给出问题清单，不能脑补成最终规则。
12. 每次改代码后，必须说明关联需求、影响文件、验证方式和剩余风险。
```

## 当前推荐交付形态

第一版不做复杂微服务，采用模块化单体后端加三端前端：

```text
backend      Django + Django REST Framework
admin-web    React + Vite + Ant Design
user-web     React + Vite
mobile-h5    React + Vite + mobile UI components
database     PostgreSQL
cache/task   Redis + Celery
deploy       Docker Compose first, production can evolve later
```

## 端到端交付定义

不是“把项目框架搭起来”就结束。第一版完整交付必须至少跑通：

```text
管理员配置仓库、渠道、包装、增值服务
  -> 用户注册/登录并获取专属仓库地址
  -> 用户提交包裹预报
  -> 仓库人员后台扫描入库，录入重量/体积/图片
  -> 用户查看在库包裹并申请打包发货
  -> 后台审核运单并生成费用
  -> 用户余额支付
  -> 后台发货并录入物流轨迹
  -> 用户查看轨迹并确认签收
```

同时第一版保留最小代购能力：

```text
用户提交手工代购/自营商品订单
  -> 后台审核
  -> 采购人员处理采购
  -> 到货后转成 Parcel
  -> 接入集运主链路
```

## 原始材料索引

这些材料是输入来源，但不是直接开发规格。已在 `12-source-evidence-map.md` 中做过整合：

- `ChatGPT分析/admin分析.md`
- `ChatGPT分析/userweb分析.md`
- `ChatGPT分析/usermobile分析.md`
- `Gemini分析/admin产品分析.md`
- `Gemini分析/userweb产品分析.md`
- `Gemini分析/usermobile产品分析.md`
- `截图/平台截图-admin.pdf`
- `截图/平台截图-userweb.pdf`
- `截图/平台截图-usermobile.pdf`
- `截图/admin/`
- `截图/userweb/`
- `截图/usermobile/`
- `可学习的ERP风格-Gemini复现/erp`
- `跨境代购与集运物流 ERP 系统 调研/同类开源项目调研.md`
- `跨境代购与集运物流 ERP 系统 调研/外界对金蚁ERP的分析.md`

后续开发优先读本目录，只有需要追溯截图证据或不确定字段时再回看原始材料。
