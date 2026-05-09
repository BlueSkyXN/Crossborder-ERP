# CI-EVIDENCE-001 Agent 证据门禁

## 背景

项目用于证明纯 AI 驱动开发的 ERP 全栈系统。此前每轮正式任务已有 `docs/agent-runs/` 摘要证据，但 CI 尚未自动检查任务图、current-state 和 Agent run 记录是否保持一致，也无法防止提交占位式证明材料。

## 目标

- 在 CI 中增加轻量级 Agent 证据门禁。
- 校验任务图、current-state、任务文件和 Agent run 摘要之间的一致性。
- 校验已完成任务具备摘要证据、验证命令和未验证边界说明。
- 不新增依赖，不引入外部服务，使用 Python 标准库即可运行。

## 范围

- `scripts/ci/validate_agent_evidence.py`
- `package.json`
- `.github/workflows/ci.yml`
- 为通过门禁补齐少量既有 Agent run 记录中的验证结果表述

## Done 条件

- `npm run evidence` 通过。
- `actionlint .github/workflows/ci.yml` 通过。
- `git diff --check` 通过。
- PR CI 与 main CI 均通过。

## 边界

- 该门禁只校验证明材料结构和基础内容，不证明业务功能本身正确。
- 业务功能仍必须依赖 pytest、E2E、Browser Smoke、lint/build 和真实代码审查。
