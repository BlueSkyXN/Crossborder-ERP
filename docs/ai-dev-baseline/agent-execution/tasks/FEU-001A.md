# FEU-001A 用户 Web 登录、控制台、仓库地址

phase: `P1_IDENTITY_CONFIG`  
depends_on: `BE-003`, `BE-004`  
next: `FEM-001A`

## 目标

实现用户 Web 的登录、会员控制台和仓库地址复制。

## 必读

- `../../13-integrated-product-spec.md`
- `../../15-frontend-style-from-screenshots-and-repro.md`
- `../../04-api-database-contract.md`

## 必须做

- 初始化或完善 `user-web`。
- 登录页和登录态。
- 用户控制台：会员资料、余额占位、状态入口占位、仓库地址卡。
- 仓库地址一键复制。
- loading、empty、error。

## 不要做

- 不做完整商城。
- 不做复杂推广/返利入口。

## 验收

```bash
cd user-web
npm run lint
npm run build
```

手工验收：

- 测试用户登录。
- 控制台显示专属仓库地址并可复制。
