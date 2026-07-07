# Performance Tests — Workspace Context Switcher

## Prerequisites

1. Install [k6](https://k6.io/docs/get-started/installation/):
   ```bash
   # Windows (chocolatey)
   choco install k6

   # macOS
   brew install k6

   # Linux (Debian/Ubuntu)
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
     --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
     sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update && sudo apt-get install k6
   ```

2. Ensure the application is running and seeded with test users.

## Running Tests

### Local (default BASE_URL: http://localhost:3000)

```bash
k6 run test/performance/context-switch.k6.ts
```

### Against staging/production

```bash
k6 run --env BASE_URL=https://staging.nbk.edu.vn test/performance/context-switch.k6.ts
```

### With custom test users

```bash
k6 run --env BASE_URL=http://localhost:3000 \
  --env TEST_USERS='[{"email":"admin@test.com","password":"pass","role":"super_admin","schoolIds":["id1","id2"]}]' \
  test/performance/context-switch.k6.ts
```

## Scenarios

| Scenario | Endpoint | Max VUs | SLA Target |
|---|---|---|---|
| context_switch | POST /api/v1/context/switch | 1000 | P95 < 300ms, P99 < 500ms |
| accessible_schools | GET /api/v1/context/accessible-schools | 500 | P95 < 500ms |
| current_context | GET /api/v1/context/current | 500 | P95 < 200ms |

## Thresholds

If any threshold fails, k6 exits with a non-zero code. Thresholds configured:

- `context_switch_duration`: P95 < 300ms, P99 < 500ms
- `accessible_schools_duration`: P95 < 500ms
- `current_context_duration`: P95 < 200ms
- Success rates > 95% for all endpoints
- Overall HTTP failure rate < 5%

## Custom Metrics

| Metric | Type | Description |
|---|---|---|
| `context_switch_duration` | Trend | Latency for context switch requests |
| `accessible_schools_duration` | Trend | Latency for accessible schools requests |
| `current_context_duration` | Trend | Latency for current context requests |
| `context_switch_success` | Rate | Success rate for context switch |
| `accessible_schools_success` | Rate | Success rate for accessible schools |
| `current_context_success` | Rate | Success rate for current context |
| `*_errors` | Counter | Error count per endpoint |

## Requirements Validated

- **17.1**: POST /api/v1/context/switch P95 < 300ms, P99 < 500ms
- **17.2**: 1000 concurrent users switching context
- **17.3**: GET /api/v1/context/accessible-schools P95 < 500ms
- **17.4**: GET /api/v1/context/current P95 < 200ms
