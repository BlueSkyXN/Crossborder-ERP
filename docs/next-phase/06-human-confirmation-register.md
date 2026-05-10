# 人工确认清单

本文件集中记录后续不能由 AI 自行决定的业务、环境、合规和上线规则。Agent 遇到未确认项时，必须引用本文件或新增条目，不能脑补。

## 使用规则

- `blocker`：不确认就不能进入真实试运行或真实生产接入。
- `task_blocker`：不确认就不能完成某一任务，但可以做 fake/local/provider 抽象。
- `non_blocker`：不阻塞本地开发，但必须保留边界。

## 确认项

| ID | 等级 | 问题 | 默认安全处理 | 影响任务 |
| --- | --- | --- | --- | --- |
| CONF-ENV-001 | task_blocker | 当前是否仍暂缓 Docker？ | 默认 no-Docker local-first，staging 走 systemd/Nginx 文档方案 | DEPLOY-STAGING-001 |
| CONF-ENV-002 | task_blocker | PostgreSQL 可用环境在哪里，是否允许本机或 CI 启动服务？ | 无真实服务时只保持 `configured_unverified` | DB-POSTGRES-001 |
| CONF-ENV-003 | task_blocker | Redis/Celery 是否允许真实运行验证？ | 默认同步任务和本地缓存，不声明真实异步 | REQ-OPS-004 |
| CONF-ENV-004 | blocker | staging 域名、证书、反向代理和静态资源发布方式是什么？ | 无真实环境时只写 runbook，不标记验收完成 | DEPLOY-STAGING-001 |
| CONF-AUTH-001 | blocker | 后台是否必须启用 MFA，采用 TOTP、短信、邮件还是企业微信？ | 先做 provider 抽象和 disabled/fake，不强制本地启用 | AUTH-HARDEN-001 |
| CONF-AUTH-002 | blocker | 生产是否允许保留 demo 账号，还是必须禁用或强制改密？ | 默认生产禁用 `password123` 和 demo token 暴露 | PROD-SETTINGS-001、AUTH-HARDEN-001 |
| CONF-STORAGE-001 | blocker | 对象存储选型是什么，S3 兼容、OSS、COS、MinIO 还是本地持久盘？ | 先保留 LocalStorageProvider | STORAGE-PROVIDER-001 |
| CONF-STORAGE-002 | task_blocker | 病毒扫描采用 ClamAV、云安全 API 还是人工审核？ | 先做 Disabled/Fake provider，不声明生产文件安全完成 | STORAGE-PROVIDER-001 |
| CONF-PAY-001 | blocker | 支付渠道选型是什么，线下汇款、支付宝、微信、Stripe、PayPal 还是其他？ | 保留 Offline/Fake/Disabled provider | PAYMENT-PROVIDER-001 |
| CONF-PAY-002 | blocker | 退款、手续费、对账周期、支付失败补偿和风控规则是什么？ | 不实现真实退款和对账，只记录 TODO_CONFIRM | PAYMENT-PROVIDER-001 |
| CONF-FIN-001 | blocker | 供应商付款是否需要审批，审批层级和付款凭证要求是什么？ | 只保留人工核销，不接真实银行 | AUDIT-APPROVAL-001 |
| CONF-LOG-001 | blocker | 物流渠道、面单接口、轨迹回调、异常件处理规则是什么？ | 保留 ManualLogisticsProvider | LOGISTICS-PROVIDER-001 |
| CONF-LOG-002 | blocker | 运费公式、首重、续重、体积重、偏远费、关税和币种规则是什么？ | 使用演示规则，不写成最终规则 | 物流、计费、运费估算任务 |
| CONF-BIZ-001 | blocker | 禁运品、赔付、保价、丢件、破损和退款规则是什么？ | 不自动判责，只保留人工流程 | 试运行前业务规则 |
| CONF-BIZ-002 | task_blocker | 无主包裹认领凭证、争议处理、超时释放和通知规则是什么？ | 保留人工审核和 TODO_CONFIRM | PARCEL-CLAIM 增强 |
| CONF-GROWTH-001 | task_blocker | 积分获取、兑换比例、返利比例、结算周期、提现和税务规则是什么？ | 返利不进入钱包，不生成真实付款 | GROWTH 增强 |
| CONF-NOTIFY-001 | blocker | 通知渠道采用 SMTP、短信供应商、微信、站内信还是组合？ | 保留 console/fake，不声明真实送达 | NOTIFICATION-PROVIDER-001 |
| CONF-PROC-001 | blocker | 自动采购是否有平台授权、账号、合规边界和人工复核要求？ | 不抓取、不自动下单、不保存第三方账号密码 | PROCUREMENT-PROVIDER-001 |
| CONF-AUDIT-001 | task_blocker | 审计日志保留期、导出审批、外部归档和告警策略是什么？ | 保留本地导出和本地留存命令 | AUDIT-APPROVAL-001 |
| CONF-QA-001 | task_blocker | 是否允许新增 Playwright 依赖和下载浏览器二进制？ | 默认保留 system Chrome CDP smoke | TEST-PLAYWRIGHT-001 |
| CONF-QA-002 | non_blocker | 性能基线目标是什么，数据量、并发数、P95 阈值如何定？ | 先做小规模 baseline，不承诺高并发 | PERF-BASELINE-001 |

## 待确认规则的文档写法

遇到未确认规则时，统一写：

```text
TODO_CONFIRM: <需要确认的问题>。当前实现仅用于 local/demo，不代表最终业务规则。
```

不要写：

```text
系统支持完整退款规则。
系统已接入真实物流。
系统已完成生产文件安全。
```

除非已有真实验证证据。

## 确认后处理

人工确认后，Agent 必须同步更新：

1. 本文件的对应条目。
2. `02-requirements-spec.md` 的需求状态。
3. `04-roadmap-and-task-graph.md` 的任务优先级或依赖。
4. 相关业务规格、架构文档和测试计划。
5. 对应 `docs/agent-runs/` 证据。
