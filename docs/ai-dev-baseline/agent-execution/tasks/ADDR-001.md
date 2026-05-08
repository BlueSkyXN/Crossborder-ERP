# ADDR-001 地址簿与运单地址复用

phase: `P6_PRODUCTION_GAP`
depends_on: `AUDIT-001`
next: 待 `ADDR-001` 完成后按 `docs/production-readiness-backlog.md` 选择

## 目标

补齐源报告中反复出现的收件地址簿能力，让用户 Web 和 Mobile H5 可以维护常用国际收件地址，并让运单创建优先复用地址，同时保留手工填写 fallback。

## 来源

- ChatGPT User Web：收件地址为 MVP 必做，见 `userweb分析.md` L788、L897。
- Gemini User Web：`WEB-REQ-013` 要求个人资料与地址簿，见 `userweb产品分析.md` L302。
- ChatGPT Mobile：地址管理在二阶段但与运单/个人中心强相关，见 `usermobile分析.md` L918、L1002。

## 必须做

- 新增后端 `addresses` app、migration、serializer、service、API 和测试。
- 用户只能访问自己的地址。
- 支持新增、编辑、删除/停用、设默认、列表。
- User Web 增加地址管理入口和页面。
- Mobile H5 增加地址管理入口和页面。
- 运单创建支持选择地址，保存 `recipient_snapshot`，并验证地址修改后历史运单 snapshot 不漂移。
- 更新 README/相关文档和 Agent run 记录。

## 不要做

- 不接真实物流地址校验服务。
- 不接清关证件上传。
- 不引入 PostgreSQL/MySQL/Redis/Docker。

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

- 地址 CRUD API 权限隔离通过。
- User Web 和 Mobile H5 均能创建地址并在创建运单时复用。
- 运单 `recipient_snapshot` 不随地址后续修改变化。
