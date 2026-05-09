# CSV-EXPORT-SAFE-001 CSV 导出公式注入防护

## 背景

`IMPORT-001` 已补齐包裹预报 CSV 导入/导出，`AUDIT-RETENTION-001` 已补齐审计日志 CSV 导出。本轮完成度审计发现，CSV 导出字段可能包含用户输入或审计请求内容，如果单元格以 `=`、`+`、`-`、`@` 或控制字符开头，用户用 Excel/表格软件打开时可能被解释为公式。

## 目标

- 增加共享 CSV 导出 cell sanitizer。
- 包裹导出和审计日志导出统一转义公式样式字段。
- 保持 CSV 导入、`.xlsx` 解析和现有导出权限不回退。
- 不新增依赖，不引入外部 DLP、审计审批或对象存储。

## 范围

- `apps.common` 共享 CSV 导出工具。
- 包裹 CSV 导出。
- 审计日志 CSV 导出。
- 后端测试、任务图、Agent run 和交付文档。

## Done 条件

- 以 `=`、`+`、`-`、`@`、tab、换行等开头或去除左侧空白后命中公式前缀的导出值，会以前置单引号方式输出为文本。
- 包裹导出中的 carrier/items/remark 等用户输入字段被测试覆盖。
- 审计日志导出中的 operator/action/path/user_agent 等字段被测试覆盖。
- 后端测试、E2E、OpenAPI、evidence 和静态 gate 通过。

## 边界

- 不做导出审批、外部 DLP、水印或下载审计增强。
- 不修改 CSV 导入语义；导入侧公式内容仍按普通文本业务数据处理。
- 不改变 `.xlsx` 模板生成或解析。
- 不接外部 SIEM、对象存储、病毒扫描、PostgreSQL/MySQL/Redis/Celery/Docker。
