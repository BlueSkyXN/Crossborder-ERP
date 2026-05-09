# GROWTH-001 积分/推广/返利基础

phase: `P6_PRODUCTION_GAP`
depends_on: `PAYABLE-001`
next: null

## 目标

补齐源报告中用户侧增长要求的积分、邀请推广和返利基础，使会员可积累可审计的积分流水，后台可查看邀请关系和基础返利统计。

## 来源

- ChatGPT User Web 第二阶段要求推广返利、积分和相关用户中心入口。
- Gemini User Web/Mobile 报告要求推广、财务流水和用户中心增长能力。
- 当前会员档案只有等级字段，没有积分流水、邀请关系或返利规则。

## 必须做

- 先审计现有 `members`、`finance`、User Web/Mobile 个人中心和权限边界。
- 新增积分流水、邀请关系和基础返利统计模型/API。
- 规则不明确处必须使用 `TODO_CONFIRM`，不得写死最终商业规则。
- 三端至少提供可查看的基础入口，后台可审计会员积分/邀请关系。
- 补后端测试、API E2E、必要前端验证和文档状态更新。

## 不要做

- 不接真实广告投放、第三方联盟、提现、税务或复杂多级分销。
- 不把临时积分/返利规则写成最终商业承诺。
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
