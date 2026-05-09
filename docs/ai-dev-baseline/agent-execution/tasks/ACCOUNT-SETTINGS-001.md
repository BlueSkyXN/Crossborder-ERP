# ACCOUNT-SETTINGS-001 会员注册与账户设置闭环

## 背景

源报告在用户 Web 和 Mobile H5 范围内反复提到登录/注册、会员中心、账户设置和“我的/设置”。当前后端已具备注册和资料更新 API，但前台缺少注册入口、自助账户设置页和会员自助改密码能力。

本任务继续遵守 no-Docker、SQLite-first、不新增外部依赖、不接短信/邮件/验证码/第三方登录的边界。

## 目标

- Backend 新增会员自助改密码 endpoint，要求已登录、旧密码正确、新密码不少于 8 位。
- User Web 登录页支持注册并自动登录，新增 `/settings` 账户设置页，可更新昵称/手机号和改密码。
- Mobile H5 登录页支持注册并自动登录，新增 `/me/settings` 账户设置页，可更新昵称/手机号和改密码。
- Browser Smoke 覆盖 Web/H5 账户设置入口可见性。
- 文档同步更新源报告 gap、生产化 backlog、当前状态和 Agent run。

## 非目标

- 不实现短信、邮件、验证码、找回密码或第三方 OAuth/微信登录。
- 不接真实身份校验、实名制或风控。
- 不改变 PostgreSQL/MySQL/Redis/Celery/Docker 的未真实验证边界。

## 验收

- 会员注册、资料更新、改密码后旧密码失效和新密码可登录均有后端测试覆盖。
- User Web 和 Mobile H5 lint/build 通过。
- `npm run e2e` 和 `npm run e2e:browser` 通过。
- PR CI 和 main CI 通过后合并。
