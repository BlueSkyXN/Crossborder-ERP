# ADR-0005: Unverified Capabilities Must Be Marked with Status

## Status
Accepted

## Context
The system has many capabilities at different maturity levels: some are fully tested with SQLite, some have configuration parsed but no real connection, some are planned but not implemented. There is a risk of overstating readiness — e.g., claiming PostgreSQL support because the DSN parses, or claiming payment integration because a provider interface exists.

## Decision
All capabilities must carry an explicit verification status. Unverified capabilities must not be described as complete.

## Status Values
| Status | Meaning |
| --- | --- |
| `not_implemented` | No code exists |
| `planned` | Designed but not coded |
| `local_verified` | Works with SQLite / local / fake providers |
| `configured_unverified` | Configuration can be parsed, but no real connection or runtime test |
| `sandbox_verified` | Verified against third-party sandbox or staging environment |
| `production_verified` | Verified in real production with evidence |
| `deprecated` | No longer maintained |
| `blocked_confirm` | Blocked on human business/compliance confirmation |

## Rationale
- Prevents false readiness claims that could lead to data loss, financial errors, or security incidents in production.
- Enables AI agents and human reviewers to accurately assess what is truly ready.
- The status vocabulary is shared across documentation, code comments, provider implementations, and task tracking.

## Consequences
- Every provider, integration point, and infrastructure dependency must declare its status.
- Documentation, README, and agent evidence must use these exact terms.
- Fake, local, and disabled providers must not be presented as production-ready.
- Status transitions require evidence (test results, logs, screenshots) stored in `docs/agent-runs/`.
