#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

print_blockers() {
  local exit_code=$?
  if [[ "$exit_code" -ne 0 ]]; then
    cat <<'EOF'

[E2E-001] 阻塞项
- npm run e2e 未通过。
- 请先查看上方 pytest 失败断言、HTTP status 和 API response body。
- 若失败发生在依赖安装阶段，请先确认 backend/.venv 已由 uv sync --locked --dev 创建。
EOF
  fi
  exit "$exit_code"
}

trap print_blockers EXIT

cat <<'EOF'
[E2E-001] 端到端验收

测试账号
- Admin: admin@example.com / password123
- Member: user@example.com / password123

手工三端启动命令
- (cd backend && uv run python manage.py migrate)
- (cd backend && uv run python manage.py seed_demo)
- (cd backend && uv run python manage.py runserver)
- pnpm --filter admin-web dev
- pnpm --filter user-web dev
- pnpm --filter mobile-h5 dev

E2E 命令
- npm run e2e

失败时阻塞项
- 当前无预置阻塞；若命令失败，将在退出前打印阻塞提示。
EOF

cd "$ROOT_DIR/backend"
uv run pytest tests/e2e/test_p0_flow.py -s
