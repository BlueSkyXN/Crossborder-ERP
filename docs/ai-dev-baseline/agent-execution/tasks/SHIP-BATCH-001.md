# SHIP-BATCH-001 发货批次/转单/打印模板数据

phase: `P6_PRODUCTION_GAP`
depends_on: `QA-BROWSER-001`
next: `PAYABLE-001`

## 目标

补齐源报告中后台 WMS/运单管理要求的发货批次、转单号和打印模板数据基础，使后台可以把多个待发货运单归入批次、记录转单信息、批量追加轨迹，并生成可供后续真实打印接入使用的数据。

## 来源

- ChatGPT Admin 报告要求批次发货、转单、打印体系。
- Gemini Admin 报告把 WMS 和运单处理列为后台核心模块。
- 当前系统仅支持单票人工发货和单票轨迹维护，没有 shipment batch、transfer order、面单/拣货单/交接清单数据结构。

## 必须做

- 先审计现有 `waybills`、Admin Web 运单页面、API E2E 和权限结构。
- 新增发货批次模型/API，支持创建批次、添加/移除待发货运单、锁定/发货批次。
- 支持转单号、承运商批次号、发货备注和批量轨迹事件。
- 生成打印模板数据或预览接口，至少覆盖面单、拣货单、发货交接清单的基础字段。
- Admin Web 增加批次列表、详情、创建批次、归批、批量发货和模板数据入口。
- 补后端测试、API E2E 和必要的浏览器 smoke 覆盖。
- 更新 README、gap map、backlog、agent run 和 current-state。

## 不要做

- 不接真实打印机、硬件、物流 API 或第三方转单接口。
- 不做复杂仓库拣货路径优化。
- 不把未验证的外部物流能力写成已完成。
- 不改动 SQLite-first/no-Docker 边界。

## 验收

```bash
npm run e2e
npm run e2e:browser
(cd backend && uv run python manage.py check)
(cd backend && uv run python manage.py makemigrations --check --dry-run)
(cd backend && uv run pytest)
pnpm lint
pnpm build
git diff --check
```

补充验收：

- 发货批次不能包含不属于可发货状态的运单。
- 批次发货需要保持幂等，不能重复扣款或重复创建关键轨迹。
- 打印模板数据只作为结构化预览，不声明真实硬件打印完成。
