# ADR-0001: Preserve Django Modular Monolith

## Status
Accepted

## Context
The Crossborder-ERP system is built as a Django modular monolith with domain-specific apps (`iam`, `members`, `parcels`, `waybills`, `finance`, etc.). As the system grows toward production readiness, there is a question of whether to decompose into microservices.

## Decision
Preserve the Django modular monolith architecture. Do not split into microservices.

## Rationale
- The current system is a single-tenant ERP with well-defined domain boundaries via Django apps.
- A monolith simplifies transactions, data consistency, deployment, and debugging.
- Django's app system already provides module isolation without network overhead.
- The team size and traffic profile do not justify microservice complexity.
- Provider abstractions at the module boundary provide the same external-system decoupling without service boundaries.

## Consequences
- All domain logic stays in one Django process.
- Cross-domain calls are direct Python imports, not HTTP/gRPC.
- Scaling is vertical first; horizontal via read replicas or task workers if needed.
- If microservices become necessary later, the provider and service layer boundaries make extraction straightforward.
