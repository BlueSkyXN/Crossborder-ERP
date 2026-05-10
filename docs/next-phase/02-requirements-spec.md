# 下一阶段需求规格

本文件用需求规格驱动后续研发。后续任务必须引用至少一个 `REQ-*` 或 `NFR-*`，否则不应进入实现。

## 需求状态定义

| 状态 | 含义 |
| --- | --- |
| `planned` | 已规划，尚未实现 |
| `in_progress` | 正在实现 |
| `local_verified` | 本地 SQLite/local/fake 环境已验证 |
| `configured_unverified` | 配置可解析，但未真实连接或未真实运行 |
| `sandbox_verified` | 第三方沙箱或 staging 已验证 |
| `production_verified` | 生产真实验证并有证据 |
| `blocked_confirm` | 需要人工确认业务、合规或环境 |
| `not_implemented` | 未实现 |

## 功能需求

| ID | 优先级 | 需求 | 当前状态 | 验收要点 |
| --- | --- | --- | --- | --- |
| REQ-OPS-001 | P0 | production settings 必须强制显式配置 secret、allowed hosts、debug、secure cookie、proxy SSL、reset token 暴露策略 | planned | production 模式缺关键 env 会失败；local/test 行为不被破坏 |
| REQ-OPS-002 | P0 | staging 或等价试运行环境必须具备可重复部署、迁移、回滚、readiness 和日志入口 | planned | 有 runbook、部署脚本、验收记录；只写配置文件不算完成 |
| REQ-OPS-003 | P0 | 数据库必须从 SQLite-first 升级到 PostgreSQL 真实验证路径 | configured_unverified | 真实 PostgreSQL 下 migrate、pytest、E2E、钱包并发测试通过 |
| REQ-OPS-004 | P1 | Redis/Celery 必须以真实 broker 验证异步任务、重试、失败补偿 | configured_unverified | Redis service 可用；任务序列化、重试、失败状态有测试 |
| REQ-AUTH-001 | P0 | 会员和后台登录必须具备限流、防枚举和统一错误边界 | planned | 登录失败限流测试；错误信息不泄露账号存在性 |
| REQ-AUTH-002 | P0 | 密码策略必须覆盖弱密码拒绝、重置 token 一次性消费、改密后旧 token 失效 | partially_local_verified | backend tests 覆盖策略；前端错误态可用 |
| REQ-AUTH-003 | P1 | 后台高风险登录或操作支持 MFA/provider 抽象 | planned | disabled/fake provider 可切换；无真实策略前不强制 production_verified |
| REQ-STORAGE-001 | P0 | 文件存储必须从直接 local media 演进到 StorageProvider 抽象 | planned | Local/Disabled/Fake provider 测试通过；现有上传下载行为不退化 |
| REQ-STORAGE-002 | P0 | 文件安全必须有 VirusScanProvider 或受控替代状态 | planned | Disabled/Fake provider、扫描状态、失败处理和文档边界 |
| REQ-STORAGE-003 | P1 | 图片处理、缩略图、EXIF 清理和签名 URL 需要单独验证 | not_implemented | 真实依赖或 fake 实现分开标记 |
| REQ-FIN-001 | P0 | 钱包支付在 PostgreSQL 下必须验证事务、幂等和并发扣款 | planned | 并发测试证明不会重复扣款或余额为负 |
| REQ-FIN-002 | P1 | 真实支付先实现 provider 抽象，不直接硬编码渠道 | planned | Offline/Fake/Disabled provider；真实网关单独任务 |
| REQ-FIN-003 | P1 | 退款、对账、汇款审核、供应商付款必须有审批或人工确认路径 | blocked_confirm | 规则进入 `06-human-confirmation-register.md` |
| REQ-LOGISTICS-001 | P1 | 物流能力必须 provider 化，保留 manual provider | planned | Manual/Fake/Disabled provider；真实面单/轨迹回调单独验证 |
| REQ-NOTIFY-001 | P1 | 通知能力必须 provider 化，支持 disabled、console/local、fake | planned | 找回密码、工单、发货、支付等事件可接通知，但不误称真实送达 |
| REQ-PROC-001 | P2 | 自动采购只能先做合规边界和 provider 抽象 | planned | 不保存第三方平台密码；不绕过风控；不做未授权抓取 |
| REQ-IAM-001 | P1 | 业务模块 create/update/delete 细权限和审批流按风险分步推进 | planned | 高风险动作先做；按钮、API、审计一致 |
| REQ-AUDIT-001 | P1 | 审计日志要扩展导出审批、外部归档或告警路径 | planned | 导出审批或替代控制；外部 SIEM 未接则标记 not_implemented |
| REQ-QA-001 | P0 | 现有 pytest、API E2E、browser smoke 必须持续通过 | local_verified | 每个任务说明影响和验证命令 |
| REQ-QA-002 | P1 | 引入 Playwright 或组件测试前必须确认依赖和浏览器缓存策略 | blocked_confirm | 不直接删除现有 system Chrome smoke |
| REQ-QA-003 | P1 | 性能基线覆盖列表、导出、导入、钱包支付、登录 | planned | 只给 baseline，不承诺虚假高并发 |

## 非功能需求

| ID | 优先级 | 需求 | 验收要点 |
| --- | --- | --- | --- |
| NFR-SEC-001 | P0 | 安全配置默认保守，生产环境缺关键配置应启动失败 | production check 测试 |
| NFR-SEC-002 | P0 | 密码、token、支付、管理员操作不得进入明文日志或审计明文 | 单元测试和脱敏测试 |
| NFR-DATA-001 | P0 | 金额字段保持 Decimal 或字符串序列化，不使用 float | 现有契约保持，新增接口测试 |
| NFR-DATA-002 | P0 | 所有金额变更必须在事务中完成 | service 层测试覆盖 |
| NFR-OPS-001 | P0 | readiness 不暴露 DSN、堆栈、本地路径 | 503 脱敏测试 |
| NFR-OPS-002 | P1 | 备份恢复要记录命令、输出、恢复验证和边界 | runbook 和演练证据 |
| NFR-OBS-001 | P1 | 后端日志至少包含 request id、path、status、duration、actor 边界 | 日志格式测试或手工验证 |
| NFR-AI-001 | P0 | 每个任务必须留下需求、设计、验证、未验证边界证据 | `docs/agent-runs/` 摘要 |
| NFR-AI-002 | P0 | Agent 不得扩展 MVP 或生产承诺，除非有明确任务和证据 | PR 描述和文档边界检查 |

## 验收标准模板

每条后续任务至少写清：

```text
关联需求：REQ-xxx / NFR-xxx
用户或系统角色：
前置条件：
输入：
输出：
权限：
审计：
错误和异常：
数据保留：
验证命令：
未验证边界：
```

## 需求追踪规则

- 需求变更必须更新本文件。
- 设计变更必须更新 `03-target-architecture.md` 或对应架构文档。
- 任务排期变更必须更新 `04-roadmap-and-task-graph.md`。
- 人工确认项必须更新 `06-human-confirmation-register.md`。
- 完成证据必须写入 `docs/agent-runs/`，只记录摘要，不粘贴完整日志。
