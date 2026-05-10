# ADR-0004: No Big-Bang Refactor

## Status
Accepted

## Context
The codebase has organically grown through iterative AI-driven development. Some apps follow a flat structure (models + views + serializers), while the target architecture recommends a richer layering (selectors, services, providers, enums). There is a temptation to refactor everything at once to match the target structure.

## Decision
Do not perform big-bang refactors. Adopt the target architecture incrementally, starting with low-risk apps as samples.

## Rationale
- Big-bang refactors introduce high risk of regression across the entire system.
- The current flat structure is functional and well-tested for the P0 scope.
- Incremental migration allows each refactored module to be verified independently.
- Low-risk apps (`content`, `addresses`, `regions`) serve as reference implementations before touching high-risk modules (`finance`, `waybills`, `parcels`).

## Rules
1. Start with one low-risk app as a sample (e.g., `content` or `addresses`).
2. Do not move `finance`, `waybills`, or `parcels` until the sample is proven stable.
3. Each migration must maintain URL, response structure, and frontend compatibility.
4. Each migration must add or retain tests proving behavior equivalence.
5. Do not do a one-time full-repo directory reorganization.

## Consequences
- The codebase will temporarily have mixed architectural patterns (old flat + new layered).
- Documentation must clarify which pattern is the target and which apps have been migrated.
- New apps should follow the target pattern from the start.
