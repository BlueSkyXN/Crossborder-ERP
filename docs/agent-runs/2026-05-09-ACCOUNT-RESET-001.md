# ACCOUNT-RESET-001 会员找回密码与重置密码闭环

## 输入

- 完成度审计显示原始 User Web / Mobile H5 报告要求找回密码，但当前仅有登录态内改密码和后台重置测试密码。
- 用户约束仍是 SQLite + demo data、no-Docker、不安装全局依赖、不下载额外服务。
- 外部短信/邮件/微信通道尚未确认，不能把真实通知能力写成已完成。

## Agent 决策

- 选择会员找回密码作为下一张本地可验证生产化任务。
- 使用 `PasswordResetToken` 保存 token hash、过期时间、消费时间、请求 IP 和 user agent。
- 请求重置接口对不存在或非激活邮箱返回统一成功外观，降低邮箱枚举风险。
- 本地/测试环境通过 `MEMBER_PASSWORD_RESET_EXPOSE_TOKEN` 返回 `dev_reset_token`，方便 SQLite demo 和自动化测试；生产应关闭并接真实通知通道。

## 修改

- 新增 `password_reset_tokens` 表和 migration。
- 新增 `POST /api/v1/auth/password-reset/request` 与 `POST /api/v1/auth/password-reset/confirm`。
- User Web 和 Mobile H5 登录页增加找回密码模式，接入重置请求和确认 API。
- Browser Smoke 登录页增加找回密码入口断言。
- 更新 `.env.example`、任务图、current-state、README、gap map、backlog、known issues、delivery audit、deployment 和 implementation decisions。

## 验证

- `cd backend && uv run pytest apps/members/tests/test_members.py -q`：12 passed。
- `cd backend && uv run python manage.py check`：passed。
- `cd backend && uv run python manage.py makemigrations --check --dry-run`：No changes detected。
- `cd backend && uv run python manage.py spectacular --file /tmp/crossborder-account-reset001-openapi.yaml --validate`：passed。
- `pnpm --filter user-web lint`：passed。
- `pnpm --filter user-web build`：passed。
- `pnpm --filter mobile-h5 lint`：passed。
- `pnpm --filter mobile-h5 build`：passed。
- `cd backend && uv run pytest`：207 passed，1 个 Django 覆盖 `DATABASES` 的既有 warning。
- `npm run e2e`：passed。
- `npm run e2e:browser`：passed，使用 `.tmp/browser-e2e` 隔离 SQLite、media 和 Chrome profile。
- `pnpm lint`：passed。
- `pnpm build`：passed。
- `npm run evidence`：passed，检查 59 个任务和 58 份 Agent run 摘要。
- `git diff --check`：passed。
- `actionlint .github/workflows/ci.yml`：passed。
- YAML parse：passed；Ruby 提示 `/Volumes/TP4000PRO` world-writable PATH warning，属当前外置盘环境既有 warning。

## 未验证边界

- 不接真实短信、邮件、微信或第三方账号。
- 不声明完成邮件送达率、验证码风控、账号找回人工审核或 MFA。
- `MEMBER_PASSWORD_RESET_EXPOSE_TOKEN` 仅用于本地/demo/test；生产环境应关闭并接真实通知通道。

## 下一步

- 后续可在真实通道确认后补邮件/短信 provider、验证码风控、通知模板、多因素认证和账号找回审核。
