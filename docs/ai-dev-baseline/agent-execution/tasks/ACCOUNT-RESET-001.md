# ACCOUNT-RESET-001 会员找回密码与重置密码闭环

## 背景

原始 User Web / Mobile H5 报告都要求注册、登录和找回密码能力。`ACCOUNT-SETTINGS-001` 已补会员注册、账户资料设置和登录态内改密码，但此前未覆盖未登录状态下的找回密码。本任务在 SQLite-first、no-Docker、无外部短信/邮件网关边界下，补齐本地可验证的 reset token 重置密码闭环。

## 目标

- 后端提供找回密码请求和确认重置 API。
- reset token 只保存 hash，具备过期时间和一次性消费语义。
- User Web 和 Mobile H5 登录页提供找回密码入口。
- Browser Smoke 至少覆盖入口可见性，后端测试覆盖完整重置行为。
- 不引入外部邮件/短信服务，不安装新依赖。

## 范围

- `apps.members` reset token model、migration、serializer、service、view 和 URL。
- User Web / Mobile H5 auth API/types 与登录页找回密码 UI。
- Browser Smoke 登录页入口断言。
- 文档、任务图、Agent run 和完成度材料。

## Done 条件

- 请求重置时，不存在的邮箱也返回统一成功外观，避免枚举。
- token 只以 SHA-256 hash 入库；本地/测试环境可返回 `dev_reset_token` 支撑 demo。
- token 过期或已消费后不能再次重置。
- 重置成功后旧密码失效，新密码可登录。
- 后端 targeted tests、OpenAPI、前端 lint/build、E2E、Browser Smoke 和 evidence gate 通过。

## 边界

- 不接真实短信、邮件、微信或第三方账号。
- 不声明完成邮件送达率、验证码风控、账号找回人工审核或多因素认证。
- `MEMBER_PASSWORD_RESET_EXPOSE_TOKEN` 只用于本地/demo/test 取 token；生产环境应关闭并接入真实通知通道。
