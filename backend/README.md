# Backend

后端使用 Python 3.12+、Django、Django REST Framework、drf-spectacular、pytest 和 uv。

当前后端以 SQLite-first 验证；已包含会员、后台、仓库、包裹、无主包裹认领审核、包裹 CSV 批量预报导入/导出、运单、钱包、线下汇款审核、商品、代购、地址簿、本地文件服务、客服工单、后台会员管理和内容 CMS。不启动 PostgreSQL/MySQL/Redis/Docker。

## 批量导入/导出

`IMPORT-001` 使用 Python 标准库 `csv` 实现，不新增 Excel 解析依赖：

- `GET /api/v1/parcels/import-template` 下载包裹预报 CSV 模板。
- `POST /api/v1/files` 上传 `IMPORT_FILE` 后，用 `POST /api/v1/parcels/imports` 执行导入。
- 导入会先全量校验仓库代码、快递单号、重复单号、数量、申报价值等字段；失败会记录 `ParcelImportJob` 和行级错误，不创建部分包裹。
- `GET /api/v1/parcels/export` 导出当前会员自己的包裹；`GET /api/v1/admin/parcels/export` 走 `parcels.view` RBAC 导出后台包裹。
- `.xls/.xlsx` 仅作为上传类型预留，当前导入解析会返回“仅支持 CSV”的任务失败记录。

## 常用命令

```bash
uv run python manage.py check
uv run python manage.py spectacular --file openapi.yaml
uv run pytest
```

`openapi.yaml` 是本地生成产物，不需要提交。
