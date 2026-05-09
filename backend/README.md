# Backend

后端使用 Python 3.12+、Django、Django REST Framework、drf-spectacular、pytest 和 uv。

当前后端以 SQLite-first 验证；已包含会员、后台、仓库、包裹、无主包裹认领审核、运单、钱包、线下汇款审核、商品、代购、地址簿、本地文件服务、客服工单和后台会员管理。不启动 PostgreSQL/MySQL/Redis/Docker。

## 常用命令

```bash
uv run python manage.py check
uv run python manage.py spectacular --file openapi.yaml
uv run pytest
```

`openapi.yaml` 是本地生成产物，不需要提交。
