# MEMBER-001 后台会员管理增强

phase: `P6_PRODUCTION_GAP`
depends_on: `MSG-001`
next: `PARCEL-CLAIM-001`

## 目标

补齐后台会员管理能力，让客服/运营可以查看会员资料、状态、等级和服务信息，并完成冻结/解冻等基础操作。继续遵守 no-Docker、SQLite-first。

## 来源

- ChatGPT/Gemini Admin 均要求会员账号、状态、等级、客服分配和会员服务记录。
- `MSG-001` 已提供客服工单入口，后续会员管理可关联客服处理场景。

## 必须做

- 后端补会员列表、详情、筛选、冻结/解冻、重置测试密码或状态变更 API。
- 保持用户数据隔离和后台 RBAC，后台接口走独立权限。
- Admin Web `/members` 从占位页升级为真实会员管理页面。
- 合理展示会员号、仓库识别码、等级、状态、注册时间和近期服务信息。
- 更新 README/部署边界/Agent run 记录。

## 不要做

- 不做真实短信、邮件、验证码和找回密码通道。
- 不做复杂 CRM、客服自动分配和营销自动化。
- 不把会员等级规则脑补为最终业务规则；不确定处标记 `TODO_CONFIRM`。

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

- 非授权后台账号不能访问会员管理 API。
- 冻结用户不能继续通过用户端 token 访问私有接口。
- 后台会员页面有 loading/empty/error/form validation/权限处理。
