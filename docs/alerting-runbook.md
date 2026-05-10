# Alerting & Monitoring Runbook

> Status: **template** — populate thresholds & PagerDuty/Slack details when staging
> environment is provisioned.

## 1. Health & Readiness Endpoints

| Endpoint       | Purpose               | Expected Response |
|----------------|-----------------------|-------------------|
| `GET /api/health/` | Liveness probe (K8s)  | `200 {"status":"ok"}` |
| `GET /api/readiness/` | Readiness probe (K8s) | `200 {"status":"ok"}` or `503` |

### Recommended probe config (Kubernetes)
```yaml
livenessProbe:
  httpGet:
    path: /api/health/
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 15
readinessProbe:
  httpGet:
    path: /api/readiness/
    port: 8000
  initialDelaySeconds: 5
  periodSeconds: 10
```

## 2. Structured Logging

Production uses JSON-line logging (`apps.common.logging.StructuredJsonFormatter`).
Each line contains:

```json
{
  "timestamp": "2025-01-01T00:00:00+00:00",
  "level": "ERROR",
  "logger": "apps.finance.services",
  "message": "...",
  "request_id": "abc-123",
  "user_id": 42
}
```

### Key fields for alerting

| Field         | Alert when                              |
|---------------|-----------------------------------------|
| `level`       | `ERROR` count > 10 / 5 min             |
| `level`       | `CRITICAL` — any occurrence → page      |
| `status_code` | 5xx rate > 1% of total requests         |
| `duration_ms` | p95 > 2000 ms                           |

## 3. Recommended Alerts

### P1 — Page immediately
- Readiness endpoint returns 503 for > 2 consecutive checks
- Any `CRITICAL` log entry
- Database connection failure

### P2 — Notify within 15 min
- 5xx error rate > 1% over 5 min window
- API p95 latency > 2 seconds
- Disk usage > 90% on MEDIA_ROOT volume

### P3 — Daily review
- 4xx error rate > 10%
- Login throttle trigger count > 100/hour
- Password reset request spike (> 3x baseline)

## 4. External Provider Monitoring

Each provider abstraction exposes `.health_check()`:

```python
from apps.files.providers.registry import get_storage_provider
health = get_storage_provider().health_check()
# {"provider": "local", "healthy": true}
```

The `/api/readiness/` endpoint includes provider health in its response.
When external providers (S3, ClamAV, payment gateways) are integrated:
- Add their health to readiness checks
- Set up independent uptime monitors for each external dependency

## 5. TODO_CONFIRM

- [ ] Confirm PagerDuty / OpsGenie / Slack integration details
- [ ] Set actual threshold values based on baseline traffic
- [ ] Configure log aggregation destination (ELK / CloudWatch / GCP Logging)
- [ ] Add APM instrumentation (Sentry / Datadog / New Relic)
