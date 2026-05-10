# ADR-0003: PostgreSQL as Production Target Database

## Status
Accepted

## Context
The system currently uses SQLite for local development and all automated testing. PostgreSQL and MySQL DSNs can be parsed by the configuration layer, but neither has been connected or verified with real migrations, queries, or concurrent transactions.

## Decision
PostgreSQL is the primary production target database. SQLite remains the local-first development and testing database. MySQL support is retained as configuration-compatible but deprioritized.

## Rationale
- PostgreSQL provides robust transaction isolation, row-level locking, JSON support, and full-text search needed for production ERP workloads.
- The wallet/payment system requires `SELECT FOR UPDATE` and concurrent deduction safety that SQLite cannot verify.
- Django's ORM abstracts most differences, but production verification must happen on the target database.
- MySQL is kept as a fallback option if deployment constraints require it, but is not the primary verification target.

## Verification Layers
| Layer | Database | Purpose |
| --- | --- | --- |
| Local dev | SQLite | Fast iteration, no external dependencies |
| CI / automated tests | SQLite | Reproducible, fast test execution |
| Pre-production verification | PostgreSQL | Migration, concurrent transactions, wallet safety |
| Production | PostgreSQL | Real workload |

## Consequences
- All new models and queries must be compatible with both SQLite and PostgreSQL.
- `SELECT FOR UPDATE`, JSON fields, and case-sensitive queries must be tested on PostgreSQL before claiming production readiness.
- The `configured_unverified` status is used until real PostgreSQL verification is complete.
- MySQL-specific features are not relied upon.
