# QA-BROWSER-001 浏览器级 E2E 基础

phase: `P6_PRODUCTION_GAP`
depends_on: `IMPORT-001`
next: `SHIP-BATCH-001`

## 目标

在不污染本机环境的前提下，把当前 API 级 `npm run e2e` 之外的三端真实浏览器验收固化为可重复任务。优先覆盖 Admin Web、User Web、Mobile H5 的登录和 P0 主入口可用性，逐步补关键业务路径。

## 来源

- 当前 `npm run e2e` 是 DRF APIClient 级闭环，不能发现真实浏览器布局、路由、按钮遮挡和前端运行时问题。
- ChatGPT/Gemini 报告均要求后台、用户 Web、移动端达到可实际操作的 ERP 产品形态。
- 用户要求避免干扰本地环境，因此需要先确认浏览器二进制、缓存、profile 和端口占用边界。

## 必须做

- 先审计仓库内是否已有 Playwright/Vitest/browser 相关依赖和脚本，不随机下载或全局安装。
- 明确浏览器二进制和缓存落点；如需安装，必须只使用项目依赖或可控缓存目录。
- 补最小浏览器 E2E 脚本，至少覆盖三端登录、关键导航和一个包裹/内容/财务等已实现页面的 smoke。
- 保持 no-Docker、SQLite-first；测试前后清理或说明端口、进程、缓存影响。
- 更新 README、部署/测试说明、Agent run 和 gap map。

## 不要做

- 不一次性重写全部测试体系。
- 不把 API 级 E2E 删除；浏览器 E2E 是补充，不替代当前稳定闭环。
- 不使用用户日常 Chrome profile 存储测试状态。
- 不引入云端浏览器服务。

## 验收

```bash
pnpm lint
pnpm build
npm run e2e
git diff --check
```

补充验收：

- 新增浏览器脚本能在本地重复运行。
- 三端启动和测试端口清晰，不残留必要外进程。
- 若浏览器二进制无法安装或缓存不可控，必须在文档中如实标记阻塞边界。
