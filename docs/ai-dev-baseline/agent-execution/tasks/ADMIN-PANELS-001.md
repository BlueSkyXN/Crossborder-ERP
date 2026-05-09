# ADMIN-PANELS-001 后台占位面板真实化

## 目标

把 Admin Web 中仍由通用 `WorkspacePage` 承载的 `/dashboard` 和 `/roles` 改为真实数据面板，避免后台关键入口仍展示固定假数据。

## 关联来源

- 用户目标：面板必须正确整合，前后端全栈不能停留在 demo。
- `docs/source-report-gap-map.md`：后台 MVP 和 Gemini Admin 均要求后台管理、RBAC、角色权限和运营工作台具备真实产品形态。
- `docs/delivery-completion-audit.md`：生产级缺口需继续收敛，不能用测试绿灯替代真实能力覆盖。

## 范围

- 后端新增只读 `GET /api/v1/admin/dashboard`，按当前管理员权限返回真实模块指标、工作队列和最近审计动作。
- Admin Web `/dashboard` 使用真实聚合接口渲染运营控制台，不再使用固定统计假数据。
- Admin Web `/roles` 使用既有 `GET /api/v1/admin/roles` 渲染角色列表和菜单权限覆盖矩阵。
- Browser Smoke 增加后台 dashboard、roles、warehouses、purchases、products、tickets、content 等面板导航断言。
- 同步 README、交付审计、gap map、backlog、known issues 和 Agent run 记录。

## 约束

- 不新增外部依赖，不引入 Docker、PostgreSQL/MySQL/Redis。
- Dashboard 只读，不新增写操作和新业务规则。
- Dashboard 输出按当前管理员权限裁剪，避免把无权限模块聚合暴露给角色用户。

## 验证

```bash
cd backend && uv run pytest apps/iam/tests/test_admin_auth.py -q
pnpm --filter admin-web lint
pnpm --filter admin-web build
npm run e2e:browser
npm run e2e
cd backend && uv run pytest
git diff --check
actionlint .github/workflows/ci.yml
```

## Done

- `/dashboard` 和 `/roles` 不再走固定假数据 `WorkspacePage`。
- 后端 dashboard API 有认证、权限和角色可见性测试。
- Browser Smoke 能在真实浏览器中打开新增真实面板并断言关键文本。
- PR CI 通过并合并到 `main`。
