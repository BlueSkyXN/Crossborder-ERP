# AUDIT-001 源报告差距地图

phase: `P6_PRODUCTION_GAP`
depends_on: `DOC-001`
next: `ADDR-001`

## 目标

把 `/Volumes/TP4000PRO/Program/oldsystem` 下 ChatGPT/Gemini 两套原始分析报告与当前 `Crossborder-ERP` 实现做真实映射，明确哪些已经完成、哪些只是部分覆盖、哪些仍缺失，并形成下一阶段生产化 backlog。

## 必读

- `../../12-source-evidence-map.md`
- `../../13-integrated-product-spec.md`
- `../../14-module-implementation-spec.md`
- `../../../delivery-completion-audit.md`
- `../../../known-issues-and-roadmap.md`

## 必须做

- 读取 ChatGPT/Gemini Admin、User Web、Mobile H5 分析报告。
- 盘点当前 backend apps、三端 routes、CI/E2E、已知边界。
- 新增源报告差距地图。
- 新增生产化 backlog。
- 更新 docs 索引、已知问题和 Agent run 记录。

## 不要做

- 不声明生产级 ERP 已完成。
- 不实现业务代码。
- 不引入新依赖。
- 不真实验证 PostgreSQL/MySQL/Redis/Docker。

## 验收

```bash
git diff --check
```

最终验收：

- 文档能追溯到原始报告和当前实现证据。
- backlog 的下一任务可直接进入开发。
- PR 合并到 `main`。
