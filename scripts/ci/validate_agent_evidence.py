#!/usr/bin/env python3
"""Validate AI agent execution evidence and completion boundaries.

This script intentionally uses only the Python standard library so the CI gate
can run before backend/frontend dependencies are installed.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]

TASK_GRAPH = ROOT / "docs/ai-dev-baseline/agent-execution/task-graph.yaml"
CURRENT_STATE = ROOT / "docs/ai-dev-baseline/agent-execution/current-state.yaml"
AGENT_RUNS = ROOT / "docs/agent-runs"


@dataclass(frozen=True)
class Task:
    task_id: str
    phase: str
    file: str


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise AssertionError(f"missing required file: {rel(path)}") from None


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def parse_task_graph(text: str) -> list[Task]:
    tasks: list[Task] = []
    current: dict[str, str] | None = None

    for line in text.splitlines():
        id_match = re.match(r"\s*-\s+id:\s*([A-Z0-9-]+)\s*$", line)
        if id_match:
            if current:
                tasks.append(
                    Task(
                        task_id=current.get("id", ""),
                        phase=current.get("phase", ""),
                        file=current.get("file", ""),
                    )
                )
            current = {"id": id_match.group(1)}
            continue

        if current is None:
            continue

        phase_match = re.match(r"\s+phase:\s*([A-Z0-9_]+)\s*$", line)
        if phase_match:
            current["phase"] = phase_match.group(1)
            continue

        file_match = re.match(r"\s+file:\s*(\S+)\s*$", line)
        if file_match:
            current["file"] = file_match.group(1)

    if current:
        tasks.append(
            Task(
                task_id=current.get("id", ""),
                phase=current.get("phase", ""),
                file=current.get("file", ""),
            )
        )

    return tasks


def parse_block_list(text: str, key: str) -> list[str]:
    values: list[str] = []
    in_block = False
    for line in text.splitlines():
        if re.match(rf"^{re.escape(key)}:\s*(\[\])?\s*$", line):
            in_block = True
            if "[]" in line:
                return values
            continue
        if in_block and line and not line.startswith(" "):
            break
        if in_block:
            item = re.match(r"\s*-\s+([A-Z0-9-]+)\s*$", line)
            if item:
                values.append(item.group(1))
    return values


def parse_scalar(text: str, key: str) -> str | None:
    match = re.search(rf"^{re.escape(key)}:\s*(.*?)\s*$", text, re.MULTILINE)
    if not match:
        return None
    value = match.group(1).strip()
    if value in {"null", "~", ""}:
        return None
    return value.strip('"').strip("'")


def task_file_path(task: Task) -> Path:
    return ROOT / "docs/ai-dev-baseline/agent-execution" / task.file


def agent_run_task_id(path: Path) -> str | None:
    match = re.match(r"\d{4}-\d{2}-\d{2}-(.+)\.md$", path.name)
    if not match:
        return None
    return match.group(1)


def has_verification(text: str) -> bool:
    verification_markers = (
        "## 验证",
        "验证结果",
        "验证已完成",
        "已执行验证",
        "Verification",
        "verification",
    )
    command_markers = (
        "uv run",
        "pytest",
        "pnpm",
        "npm run",
        "actionlint",
        "git diff --check",
        "manage.py",
        "browser smoke",
        "Browser Smoke",
    )
    result_markers = ("passed", "通过", "No changes detected", "均通过", "success", "完成")
    return (
        any(marker in text for marker in verification_markers)
        and any(marker in text for marker in command_markers)
        and any(marker in text for marker in result_markers)
    )


def has_boundary(text: str) -> bool:
    boundary_markers = (
        "未验证边界",
        "## 边界",
        "关键边界",
        "已知边界",
        "不真实验证",
        "不声明",
        "不接",
        "不安装",
        "本轮未",
        "后续",
        "configured_unverified",
    )
    return any(marker in text for marker in boundary_markers)


def has_placeholder_language(text: str) -> bool:
    lowered = text.lower()
    forbidden = (
        "todo: fill",
        "todo fill",
        "tbd",
        "placeholder evidence",
        "placeholder summary",
        "planned only",
        "not yet run",
        "待补充",
        "待本任务完成",
        "补充真实命令结果",
        "占位待补",
        "后续补充验证",
    )
    return any(marker in lowered for marker in forbidden)


def require_contains(errors: list[str], path: Path, text: str, markers: tuple[str, ...]) -> None:
    missing = [marker for marker in markers if marker not in text]
    if missing:
        errors.append(f"{rel(path)} missing required markers: {', '.join(missing)}")


def validate_task_graph(errors: list[str]) -> tuple[list[Task], set[str]]:
    graph_text = read_text(TASK_GRAPH)
    state_text = read_text(CURRENT_STATE)
    tasks = parse_task_graph(graph_text)
    task_ids = [task.task_id for task in tasks]

    if not tasks:
        errors.append(f"{rel(TASK_GRAPH)} has no tasks")

    duplicates = sorted({task_id for task_id in task_ids if task_ids.count(task_id) > 1})
    if duplicates:
        errors.append(f"{rel(TASK_GRAPH)} has duplicate tasks: {', '.join(duplicates)}")

    for task in tasks:
        if not task.phase or not task.file:
            errors.append(f"{rel(TASK_GRAPH)} task {task.task_id} is missing phase or file")
            continue
        if not task_file_path(task).exists():
            errors.append(f"task {task.task_id} points to missing file: {task.file}")

    done_tasks = parse_block_list(state_text, "done_tasks")
    pending_tasks = parse_block_list(state_text, "pending_tasks")
    done = set(done_tasks)
    graph = set(task_ids)

    unknown_done = sorted(done - graph)
    if unknown_done:
        errors.append(f"{rel(CURRENT_STATE)} contains unknown done tasks: {', '.join(unknown_done)}")

    if parse_scalar(state_text, "current_task") is None and not pending_tasks:
        missing_done = [task_id for task_id in task_ids if task_id not in done]
        if missing_done:
            errors.append(
                f"{rel(CURRENT_STATE)} has no current/pending task but these graph tasks are not done: "
                + ", ".join(missing_done)
            )

    status = parse_scalar(state_text, "status") or ""
    if "complete" in status:
        if set(task_ids) != done:
            errors.append(f"{rel(CURRENT_STATE)} status is complete but done_tasks does not match task graph")
        last_completed = parse_scalar(state_text, "last_completed_task")
        if tasks and last_completed != tasks[-1].task_id:
            errors.append(
                f"{rel(CURRENT_STATE)} last_completed_task={last_completed!r}, expected {tasks[-1].task_id!r}"
            )

    return tasks, done


def validate_agent_runs(errors: list[str], tasks: list[Task], done: set[str]) -> None:
    readme = AGENT_RUNS / "README.md"
    readme_text = read_text(readme)
    require_contains(
        errors,
        readme,
        readme_text,
        ("输入", "Agent 决策", "修改", "验证", "未验证边界", "下一步"),
    )

    run_files = sorted(path for path in AGENT_RUNS.glob("*.md") if path.name != "README.md")
    runs_by_task: dict[str, list[Path]] = {}
    for path in run_files:
        task_id = agent_run_task_id(path)
        if not task_id:
            errors.append(f"{rel(path)} does not follow YYYY-MM-DD-<task-id>.md")
            continue
        runs_by_task.setdefault(task_id, []).append(path)

    graph_ids = {task.task_id for task in tasks}
    task_order = [task.task_id for task in tasks]
    required_run_tasks = [task_id for task_id in task_order if task_id in done and task_id != "INIT-001"]
    for task_id in required_run_tasks:
        if task_id not in runs_by_task:
            errors.append(f"done task {task_id} has no agent run summary in {rel(AGENT_RUNS)}")

    for task_id, paths in sorted(runs_by_task.items()):
        if task_id not in graph_ids:
            errors.append(f"{', '.join(rel(path) for path in paths)} references task not in task graph: {task_id}")
        if len(paths) > 1:
            errors.append(
                f"task {task_id} has multiple agent run summaries: "
                + ", ".join(rel(path) for path in paths)
            )

    for path in run_files:
        text = read_text(path)
        task_id = agent_run_task_id(path) or path.stem
        if len(text.strip()) < 220:
            errors.append(f"{rel(path)} is too short to be useful evidence")
        if task_id not in text:
            errors.append(f"{rel(path)} does not mention its task id {task_id}")
        if not has_verification(text):
            errors.append(f"{rel(path)} lacks concrete verification commands/results")
        if not has_boundary(text):
            errors.append(f"{rel(path)} lacks explicit unverified boundary or next-step language")
        if has_placeholder_language(text):
            errors.append(f"{rel(path)} contains placeholder/planned-only language")


def validate_boundary_docs(errors: list[str]) -> None:
    required_docs = {
        "README.md": (
            "SQLite first",
            "当前阶段暂不考虑 Docker",
            "configured_unverified",
            "当前 CI 会在 PR",
        ),
        "docs/source-report-gap-map.md": (
            "当前仍不完整",
            "剩余差距集中",
            "PostgreSQL/MySQL/Redis",
        ),
        "docs/production-readiness-backlog.md": (
            "configured_unverified",
            "Current Next Task",
            "Completion Boundary",
        ),
        "docs/known-issues-and-roadmap.md": (
            "PostgreSQL/MySQL 未真实验证",
            "Redis/Celery 未真实验证",
            "真实支付",
            "对象存储",
        ),
        "docs/delivery-completion-audit.md": (
            "未完成但不阻塞 P0",
            "PostgreSQL/MySQL/Redis/Celery 未真实验证",
            "真实支付",
        ),
        "docs/ai-development-proof.md": (
            "验证命令和结果摘要",
            "未验证能力边界",
            "configured_unverified",
        ),
    }

    for relative_path, markers in required_docs.items():
        path = ROOT / relative_path
        require_contains(errors, path, read_text(path), markers)

    workflow = ROOT / ".github/workflows/ci.yml"
    require_contains(errors, workflow, read_text(workflow), ("validate_agent_evidence.py",))


def main() -> int:
    errors: list[str] = []
    try:
        tasks, done = validate_task_graph(errors)
        validate_agent_runs(errors, tasks, done)
        validate_boundary_docs(errors)
    except AssertionError as exc:
        errors.append(str(exc))

    if errors:
        print("Agent evidence gate failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Agent evidence gate passed.")
    print(f"- tasks checked: {len(tasks)}")
    print(f"- agent run summaries checked: {len(list(AGENT_RUNS.glob('20*.md')))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
