# FILE-SNIFF-001 文件上传内容签名校验

## 背景

`FILE-001` 已完成本地文件上传、元数据、大小/MIME/扩展名限制、鉴权下载和业务引用，`STORAGE-CLEANUP-001` 已完成本地软删除文件清理。但完成度审计显示文件安全仍是生产化边界之一，当前上传校验仍主要依赖客户端声明的 MIME 和文件名。

## 目标

- 文件上传在大小、扩展名、MIME 校验之外，增加轻量内容签名校验。
- 图片、PDF、旧 `.xls`、标准 `.xlsx` 使用文件头判断是否与扩展名匹配。
- CSV 保持无依赖解析边界，只拦截明显二进制 NUL 内容。
- 继续保持 SQLite-first、no-Docker、不新增依赖、不接对象存储或病毒扫描。

## 范围

- Django/DRF files service 校验逻辑。
- 受影响上传测试和导入测试。
- README、gap map、backlog、known issues、delivery audit、implementation decisions、任务图和 Agent run 证据。

## Done 条件

- `.jpg/.jpeg/.png/.webp/.gif/.pdf/.xls/.xlsx/.csv` 上传时校验扩展名、MIME 和内容头的一致性。
- 伪装成图片或 `.xlsx` 的明显错误内容会在上传阶段被拒绝。
- 标准 CSV、标准 `.xlsx`、PDF 和图片测试仍通过。
- 后端测试、E2E、OpenAPI、evidence 和静态 gate 通过。

## 边界

- 不做病毒扫描、图片解码、缩略图生成、EXIF 清理或内容安全审核。
- 不接对象存储、CDN、签名 URL 或远程归档。
- CSV 只做轻量二进制拦截，不尝试识别所有编码或恶意公式。
- 旧版 `.xls` 仍仅允许上传并由导入流程提示另存，不声明完整解析能力。
