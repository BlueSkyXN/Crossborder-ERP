# 16 Agent 端到端执行手册

本文件用于让实习生“一条龙”指挥 Codex/Agent 完成开发。它把前面所有规格转成可执行阶段和检查点。

## 第 0 步：让 Agent 建立上下文

现在不靠复制提示词建立上下文。实习生只需要让 Agent 读取：

```text
ai-dev-baseline/agent-execution/
```

Agent 应自行读取 `README.md`、`current-state.yaml`、`task-graph.yaml`、`workflow-path.md` 和当前任务文件。

人工检查：

- 是否说清楚三端：后台、用户 Web、移动 H5。
- 是否说清楚后端：Django/DRF、PostgreSQL、Redis/Celery。
- 是否说清楚 P0 集运闭环。
- 是否没有把自动采购、真实支付、多租户列为第一版。

如果 Agent 没有自动找到当前任务，让它回到 `agent-execution/current-state.yaml` 的 `current_task`。

## 第 1 步：初始化项目

执行任务：

```text
INIT-001
BE-001
```

目标：

- monorepo 目录创建。
- 后端能启动。
- 三端前端能启动。
- Docker Compose 有 PostgreSQL/Redis。
- OpenAPI 基础可访问。

验收：

```bash
docker compose up -d postgres redis
cd backend && pytest
cd admin-web && npm run build
cd user-web && npm run build
cd mobile-h5 && npm run build
```

## 第 2 步：账号、权限、仓库

执行任务：

```text
BE-002
BE-003
BE-004
FEA-001
FEA-002
```

目标：

- 后台管理员可登录。
- 用户可登录。
- 后台可配置仓库、渠道、包装、增值服务。
- 用户端可查看专属仓库地址。

验收：

- 超级管理员登录后台。
- 测试用户登录用户 Web。
- 用户 Web 和移动 H5 都能复制仓库地址。

## 第 3 步：包裹主链路

执行任务：

```text
BE-005
FEA-003
FEU-001 中的包裹相关页面
FEM-001 中的包裹相关页面
```

目标：

- 用户提交包裹预报。
- 后台待入库列表可查。
- 后台扫描入库。
- 用户看到在库包裹。

验收：

```text
用户提交 tracking_no = TEST123
后台搜索 TEST123
后台入库，录入 1.2kg、30x20x10
用户端包裹状态显示 IN_STOCK/在库
```

## 第 4 步：运单和支付主链路

执行任务：

```text
BE-006
BE-007
BE-008
FEA-004
FEU-001 中的运单/支付相关页面
FEM-001 中的运单/轨迹相关页面
```

目标：

- 用户选择在库包裹申请打包。
- 后台审核运单并设置费用。
- 后台充值。
- 用户余额支付。
- 后台发货并添加轨迹。
- 用户确认收货。

验收：

```text
Parcel IN_STOCK -> 创建 Waybill
Waybill PENDING_REVIEW -> PENDING_PAYMENT
后台给用户充值 100
用户支付运费 50
Wallet 减少 50，生成流水
Waybill -> PENDING_SHIPMENT -> SHIPPED -> SIGNED
```

## 第 5 步：最小代购

执行任务：

```text
BE-009
后台代购页面
用户 Web 手工代购页面
移动 H5 代购入口
```

目标：

- 用户提交手工代购。
- 后台审核。
- 采购处理。
- 到货转包裹。
- 包裹继续走集运链路。

验收：

```text
PurchaseOrder PENDING_REVIEW -> PENDING_PROCUREMENT -> PROCURED -> ARRIVED
后台 convert-to-parcel
生成 Parcel，状态 IN_STOCK
用户可申请打包发货
```

## 第 6 步：端到端 E2E

执行任务：

```text
E2E-001
```

目标：

- 自动或半自动跑完整演示链路。
- 覆盖后台、用户 Web、移动 H5 至少一个主流程。

验收脚本应覆盖：

```text
后台登录
创建/确认仓库
用户登录
用户提交预报
后台入库
用户申请打包
后台设置费用
后台充值
用户支付
后台发货
用户查看轨迹和确认收货
```

## 第 7 步：交付文档

执行任务：

```text
DOC-001
```

目标：

- README 让新机器能启动项目。
- 有测试账号。
- 有种子数据。
- 有部署说明。
- 有已知问题清单。
- 有下一阶段计划。

验收：

- 新手按 README 可启动。
- 演示脚本可复现。
- `08-qa-security-deployment.md` 上线前检查全部通过。

## 每轮 Agent 输出必须包含

```text
完成内容：
修改文件：
验证命令：
验证结果：
关联需求：
剩余风险：
下一步：
```

## 人工决策点

这些点必须找负责人确认：

- 是否第一版必须真实在线支付。
- 是否第一版必须支持商品链接解析。
- 首发国家/仓库/渠道。
- 运费公式。
- 注册字段和验证码。
- 是否需要中英双语。
- 是否需要真实打印模板。

在未确认前，Agent 只能做简版或预留字段。
