# ACCOUNT-SETTINGS-001 会员注册与账户设置闭环

## 输入

源报告要求用户 Web 和 Mobile H5 覆盖登录/注册、会员中心、我的/设置等账户能力。当前继续遵守 no-Docker、SQLite-first、不新增外部依赖、不接短信/邮件/验证码/第三方登录的边界。

## 关键实现

- Backend 新增 `POST /api/v1/me/password`，已登录会员可提交当前密码和新密码完成自助改密。
- 后端校验旧密码、新密码最小长度和新旧密码不能相同；冻结用户仍由既有会员认证层阻断。
- User Web 登录页新增注册模式，注册成功后自动登录；新增 `/settings` 账户设置页，可维护昵称、手机号和登录密码。
- Mobile H5 登录页新增注册模式，注册成功后自动登录；新增 `/me/settings` 账户设置页，并在我的页增加账户设置入口。
- Browser Smoke 改为精确点击登录 submit 按钮，并覆盖 User Web `/settings` 与 Mobile H5 `/me/settings` 的设置入口可见性。
- README、部署说明、gap map、production backlog、known issues、delivery audit、任务图和演示脚本已同步。

## 验证

- `cd backend && uv run pytest apps/members/tests/test_members.py -q`：9 passed。
- `cd backend && uv run pytest`：147 passed。
- `cd backend && uv run python manage.py check`：passed。
- `cd backend && uv run python manage.py makemigrations --check --dry-run`：No changes detected。
- `cd backend && uv run python manage.py spectacular --file /tmp/crossborder-account-settings001-openapi.yaml --validate`：passed。
- `pnpm --filter user-web lint`：passed。
- `pnpm --filter mobile-h5 lint`：passed。
- `pnpm --filter user-web build`：passed。
- `pnpm --filter mobile-h5 build`：passed。
- `pnpm lint`：passed。
- `pnpm build`：passed。
- `npm run e2e`：passed。
- `npm run e2e:browser`：passed，继续使用 `.tmp/browser-e2e` 隔离 SQLite、media 和 Chrome profile。

## 未验证边界

- 未接短信、邮件验证码、找回密码、微信登录或第三方 OAuth。
- 未做真实身份校验、风控、设备管理或强制所有旧 token 失效。
- PostgreSQL/MySQL/Redis/Celery/Docker 仍未真实验证。
