# PAYABLE-001 供应商/成本/应付基础

phase: `P6_PRODUCTION_GAP`
depends_on: `SHIP-BATCH-001`
next: `GROWTH-001`

## 目标

补齐源报告中后台财务要求的供应商、成本类型和应付基础，使系统在现有应收、钱包和支付单之外，能够记录对外采购、物流、仓储等供应商成本和应付款状态。

## 来源

- Gemini Admin 报告明确后台需要应付管理、供应商和成本方向能力。
- ChatGPT Admin 报告把财务核心拆到应收/应付，并要求后台可处理成本和付款。
- 当前系统已有会员钱包、支付单、线下汇款和余额支付，但没有 supplier、payable、cost type 或核销记录。

## 必须做

- 先审计现有 `finance`、`purchases`、`waybills`、Admin Web 财务页、权限和 API E2E。
- 新增供应商、成本类型和应付款基础模型/API。
- 支持创建应付款、标记待审核/已确认/已核销或取消等基础状态。
- 金额字段必须使用 Decimal，并补金额精度、状态转换和重复核销防护测试。
- Admin Web 增加供应商和应付基础入口，保持与现有财务页面风格一致。
- 更新 README、gap map、backlog、agent run 和 current-state。

## 不要做

- 不接真实银行、支付渠道、ERP 外部财务系统或自动打款。
- 不把供应商结算规则脑补成最终业务规则；不确定的规则标记 `TODO_CONFIRM`。
- 不改动现有会员钱包/应收支付单语义，必须保持应收与应付边界清晰。
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

- 应付款核销必须幂等或显式拒绝重复核销，不能重复记账。
- 财务人员权限与仓库/采购权限边界必须明确测试。
- PostgreSQL/MySQL/Redis 仍不真实验证。
