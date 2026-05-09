# CONTENT-001 内容 CMS

phase: `P6_PRODUCTION_GAP`
depends_on: `PARCEL-CLAIM-001`
next: `IMPORT-001`

## 目标

补齐后台内容管理与用户端基础展示，用于帮助中心、公告、条款、隐私政策和关于我们等静态/半静态内容。继续遵守 no-Docker、SQLite-first。

## 来源

- ChatGPT Admin 报告要求内容基础、帮助中心、公告、条款隐私和关于我们。
- Gemini Admin 报告将网站管理列为后台核心模块之一。
- User Web/Mobile 报告要求帮助、客服信息、条款和基础内容展示。

## 必须做

- 后端新增 content app/model/API，支持内容分类、slug、标题、正文、状态、排序和发布时间。
- 后台补内容列表、创建、编辑、发布/隐藏入口，并走 RBAC。
- User Web/Mobile H5 补公告/帮助/条款等只读入口。
- 增加 CRUD、前台读取、slug 唯一性和权限测试。
- 更新 README、gap map、backlog 和 Agent run 记录。

## 不要做

- 不接富文本编辑器外部上传能力；图片/附件如需使用，必须复用现有 `FILE-001` 文件服务。
- 不做 SEO、站点地图、多语言内容和复杂 CMS workflow。
- 不新增 PostgreSQL/MySQL/Redis/Docker 真实验证。

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

- 未发布/隐藏内容不能被用户端读取。
- 后台内容接口必须走 `content.view` 或等价 RBAC 权限。
- 用户端展示不得暴露后台草稿或内部字段。
