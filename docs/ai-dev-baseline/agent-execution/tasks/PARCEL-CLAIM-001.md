# PARCEL-CLAIM-001 无主包裹用户认领

phase: `P6_PRODUCTION_GAP`
depends_on: `MEMBER-001`
next: `CONTENT-001`

## 目标

补齐用户侧无主包裹查询、脱敏展示和认领流程，并让后台可以审核认领后转为会员包裹。继续遵守 no-Docker、SQLite-first。

## 来源

- ChatGPT/Gemini User Web 和 Mobile 报告均要求用户可查看/认领无主包裹。
- 当前后端已有 `UnclaimedParcel` 基础模型和后台登记能力，但用户侧查询/认领/审核闭环未完成。

## 必须做

- 后端补用户侧无主包裹列表/搜索/认领 API，返回信息必须脱敏。
- 后端补后台认领审核 API，审核通过后关联会员并转入包裹流程。
- 增加防抢认领事务测试和权限隔离测试。
- User Web/Mobile H5 补无主包裹入口和认领表单。
- 更新 README、gap map、backlog 和 Agent run 记录。

## 不要做

- 不接真实短信、邮件或客服外呼。
- 不把认领规则脑补为最终业务规则；匹配凭证、异常处理等复杂规则标记 `TODO_CONFIRM`。
- 不新增 Docker/PostgreSQL/MySQL/Redis 真实验证。

## 验收

```bash
cd backend && uv run python manage.py makemigrations --check --dry-run
cd backend && uv run pytest
pnpm lint
pnpm build
npm run e2e
git diff --check
```

补充验收：

- 用户只能看到脱敏无主包裹信息。
- 同一无主包裹不能被多个用户重复认领。
- 后台审核必须走 RBAC。
