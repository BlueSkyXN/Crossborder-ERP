# ADR-0002: External Dependencies Must Use Provider Abstraction

## Status
Accepted

## Context
The system interacts with external services: payment gateways, logistics APIs, notification channels (SMS/email/WeChat), object storage, virus scanning, and procurement platforms. Hardcoding these integrations throughout views, serializers, and services creates tight coupling and makes testing and local development difficult.

## Decision
All external system interactions must go through a provider abstraction layer. Each provider domain must include at least one of: `disabled`, `local`, or `fake` implementation.

## Rationale
- Provider abstraction enables local development without external accounts or credentials.
- Tests can use fake providers for deterministic, fast verification.
- Switching between sandbox and production implementations requires only configuration changes.
- The provider status model (`disabled` → `local` → `fake` → `configured_unverified` → `sandbox_verified` → `production_verified`) prevents false claims of readiness.

## Provider Interface Minimum
Every provider must expose:
- `code`: unique identifier string
- `status`: one of the defined status values
- `validate_configuration()`: check if required config is present
- `health_check()`: verify runtime connectivity (for real providers)

## Consequences
- No external API calls in views, serializers, or direct model methods.
- Each provider domain lives in `apps/<domain>/providers/<provider_type>/`.
- Settings select the active provider via environment variables.
- Fake/disabled providers must be safe defaults — they must not silently succeed for operations that should fail in production.
