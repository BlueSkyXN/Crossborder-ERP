# Backend

后端使用 Python 3.12+、Django、Django REST Framework、drf-spectacular、pytest 和 uv。

当前阶段执行 `BE-001`，只验证 SQLite、本地 `.venv` 和 pytest，不启动 PostgreSQL/MySQL/Redis/Docker。

## 常用命令

```bash
uv run python manage.py check
uv run python manage.py spectacular --file openapi.yaml
uv run pytest
```

`openapi.yaml` 是本地生成产物，不需要提交。
