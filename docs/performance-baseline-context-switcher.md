# Performance Baseline — Workspace Context Switcher

## 1. Tổng Quan

Tài liệu này ghi nhận các mục tiêu hiệu suất (performance targets), kết quả đo lường baseline, và chiến lược tối ưu hóa cho module Workspace Context Switcher.

**Ngày tạo:** 2025-01  
**Trạng thái:** Template — chờ kết quả load test thực tế  
**Spec liên quan:** `.kiro/specs/workspace-context-switcher`  
**Requirements:** 17.1, 17.2, 17.3, 17.4

---

## 2. Mục Tiêu Hiệu Suất (Performance Targets)

Các chỉ tiêu SLA được định nghĩa từ requirements:

| Endpoint | Metric | Target | Ghi chú |
|----------|--------|--------|---------|
| `POST /api/v1/context/switch` | P95 Latency | < 300ms | Context switch chính |
| `POST /api/v1/context/switch` | P99 Latency | < 500ms | Worst case chấp nhận được |
| `GET /api/v1/context/accessible-schools` | P95 Latency | < 500ms | Tính toán danh sách trường |
| `GET /api/v1/context/current` | P95 Latency | < 200ms | Đọc context hiện tại |

### Điều kiện load test

| Thông số | Giá trị |
|----------|---------|
| Concurrent users | 1000 |
| Ramp-up time | 30s |
| Duration | 5 phút (steady state) |
| Think time | 1–3s giữa các request |
| Environment | Staging (cùng spec với production) |

---

## 3. Kiến Trúc Liên Quan Đến Hiệu Suất

```
Client → API Gateway → JwtAuthGuard → TenantMiddleware → ContextService → Redis/PostgreSQL
```

### Các thành phần ảnh hưởng latency

| Thành phần | Vai trò | Latency dự kiến |
|------------|---------|-----------------|
| JwtAuthGuard | Xác thực JWT token | < 5ms |
| TenantMiddleware | Resolve context (Redis lookup) | 5–20ms |
| Redis GET/SET | Đọc/ghi context session | 1–5ms |
| PostgreSQL Query | Truy vấn danh sách trường | 10–50ms |
| HierarchyService | Tính toán cây phân cấp | 5–30ms (cached) |
| Network overhead | Round-trip client ↔ server | 10–50ms |

---

## 4. Bottleneck Tiềm Năng

### 4.1 Redis Latency

**Vấn đề:** Redis context session lookup trên mỗi request (TenantMiddleware).

**Tác động:** Nếu Redis latency > 50ms → ảnh hưởng P95 của tất cả endpoint.

**Giải pháp:**
- Connection pooling (ioredis cluster mode)
- Redis instance cùng VPC/region với app server
- Timeout 500ms với fallback về JWT schoolId
- Monitor `redis_context_hit` / `redis_context_miss` metrics

### 4.2 Database Queries (Accessible Schools)

**Vấn đề:** `GET /accessible-schools` cần query nhiều bảng (schools, teacher_school_assignments) và tính toán hierarchy.

**Tác động:** COMPANY_ADMIN và SUPER_ADMIN có query phức tạp hơn do nhiều trường.

**Giải pháp:**
- Cache accessible schools với TTL 5 phút (`accessible-schools:{userId}`)
- Index compound: `idx_schools_parent_school_id_status`
- Index: `idx_teacher_school_assignments_teacher_id_status`
- Giới hạn tối đa 50 trường/response (đã implement)
- HierarchyService cache với TTL 15 phút

### 4.3 Concurrent Write Contention (Context Switch)

**Vấn đề:** 1000 users switch cùng lúc → Redis write contention.

**Tác động:** Redis single-threaded, nhưng SET operation rất nhẹ (< 1ms mỗi lệnh).

**Giải pháp:**
- Redis pipeline/batch nếu cần
- Không cần distributed lock (mỗi user switch cho chính mình)
- Rate limiting 30 req/min/user ngăn abuse

### 4.4 Audit Log Write

**Vấn đề:** Mỗi context switch ghi audit log vào PostgreSQL.

**Tác động:** Nếu audit write chậm → tăng latency context switch.

**Giải pháp:**
- Audit log ghi async qua event (WorkspaceChangedEvent)
- Audit subscriber failure KHÔNG rollback context switch
- Batch insert nếu throughput cao

### 4.5 Network Latency (Distributed Components)

**Vấn đề:** App server, Redis, PostgreSQL có thể ở các node khác nhau.

**Giải pháp:**
- Deploy cùng VPC/availability zone
- Connection pooling cho PostgreSQL (TypeORM pool size ≥ 20)
- Keep-alive connections cho Redis

---

## 5. Chiến Lược Tối Ưu Hóa

### 5.1 Caching Layer

| Cache Key | TTL | Invalidation |
|-----------|-----|-------------|
| `context:session:{userId}` | 24h (reset on access) | Context switch / logout |
| `accessible-schools:{userId}` | 5 phút | School assignment change |
| `hierarchy:{rootSchoolId}` | 15 phút | School structure change |
| `permission:{roleId}` | 10 phút | Role/permission change |

### 5.2 Connection Pooling

```typescript
// TypeORM DataSource config (khuyến nghị)
{
  type: 'postgres',
  extra: {
    max: 20,              // max connections
    min: 5,               // min idle connections
    idleTimeoutMillis: 30000,
  },
}

// Redis (ioredis)
{
  maxRetriesPerRequest: 3,
  connectTimeout: 5000,
  lazyConnect: true,
}
```

### 5.3 Query Optimization

```sql
-- Index cho accessible schools query (COMPANY_ADMIN)
CREATE INDEX idx_schools_parent_status 
ON schools(parent_school_id, status) 
WHERE deleted_at IS NULL;

-- Index cho teacher school assignments
CREATE INDEX idx_tsa_teacher_status 
ON teacher_school_assignments(teacher_id, status) 
WHERE deleted_at IS NULL;

-- Index cho context session validation
CREATE INDEX idx_schools_id_status 
ON schools(id, status) 
WHERE deleted_at IS NULL;
```

### 5.4 Async Side Effects

Các tác vụ phụ KHÔNG nằm trong critical path:
- ✅ Audit logging (async via WorkspaceChangedEvent)
- ✅ Cache invalidation (async via event subscriber)
- ✅ Analytics tracking (async)
- ✅ WebSocket notification (async)
- ❌ Redis session write (đồng bộ - cần cho correctness)
- ❌ School validation (đồng bộ - cần cho security)

---

## 6. Hướng Dẫn Chạy Load Test (k6)

### 6.1 Cài đặt k6

```bash
# macOS
brew install k6

# Windows (Chocolatey)
choco install k6

# Docker
docker pull grafana/k6
```

### 6.2 Chạy test

```bash
# Chạy load test context switch
k6 run tests/performance/context-switch-load-test.k6.js

# Chạy với output InfluxDB (cho Grafana dashboard)
k6 run --out influxdb=http://localhost:8086/k6 tests/performance/context-switch-load-test.k6.js

# Chạy với custom environment variables
k6 run -e BASE_URL=https://staging-api.nbk.edu.vn -e TOKEN=<jwt_token> tests/performance/context-switch-load-test.k6.js
```

### 6.3 Cấu trúc k6 script

Script k6 đặt tại: `tests/performance/context-switch-load-test.k6.js`

Script bao gồm các scenario:
1. **context_switch** — 1000 VUs switch context liên tục
2. **accessible_schools** — 500 VUs gọi accessible schools
3. **current_context** — 500 VUs gọi current context

### 6.4 Thresholds (pass/fail criteria)

```javascript
export const options = {
  thresholds: {
    'http_req_duration{endpoint:switch}': ['p(95)<300', 'p(99)<500'],
    'http_req_duration{endpoint:accessible-schools}': ['p(95)<500'],
    'http_req_duration{endpoint:current}': ['p(95)<200'],
    http_req_failed: ['rate<0.01'], // < 1% error rate
  },
};
```

---

## 7. Kết Quả Baseline (Chờ Điền Sau Lần Chạy Đầu)

### 7.1 POST /api/v1/context/switch

| Metric | Kết quả | Target | Pass/Fail |
|--------|---------|--------|-----------|
| P50 | ___ ms | — | — |
| P90 | ___ ms | — | — |
| P95 | ___ ms | < 300ms | ⬜ |
| P99 | ___ ms | < 500ms | ⬜ |
| Max | ___ ms | — | — |
| Throughput | ___ req/s | — | — |
| Error rate | ___ % | < 1% | ⬜ |

### 7.2 GET /api/v1/context/accessible-schools

| Metric | Kết quả | Target | Pass/Fail |
|--------|---------|--------|-----------|
| P50 | ___ ms | — | — |
| P90 | ___ ms | — | — |
| P95 | ___ ms | < 500ms | ⬜ |
| P99 | ___ ms | — | — |
| Max | ___ ms | — | — |
| Throughput | ___ req/s | — | — |
| Error rate | ___ % | < 1% | ⬜ |

### 7.3 GET /api/v1/context/current

| Metric | Kết quả | Target | Pass/Fail |
|--------|---------|--------|-----------|
| P50 | ___ ms | — | — |
| P90 | ___ ms | — | — |
| P95 | ___ ms | < 200ms | ⬜ |
| P99 | ___ ms | — | — |
| Max | ___ ms | — | — |
| Throughput | ___ req/s | — | — |
| Error rate | ___ % | < 1% | ⬜ |

### 7.4 Tổng hợp hệ thống

| Metric | Kết quả |
|--------|---------|
| Total requests | ___ |
| Total VUs (peak) | 1000 |
| Test duration | ___ min |
| Redis connection pool usage | ___ % |
| PostgreSQL connection pool usage | ___ % |
| CPU usage (app server) | ___ % |
| Memory usage (app server) | ___ MB |

---

## 8. Hành Động Khắc Phục (Nếu Không Đạt Target)

### Nếu P95 context switch > 300ms

1. Kiểm tra Redis latency (`redis-cli --latency`)
2. Kiểm tra network latency giữa app và Redis
3. Review audit log write — chuyển hoàn toàn async nếu chưa
4. Kiểm tra accessible schools computation — bật cache nếu chưa
5. Profile với `clinic.js` hoặc Node.js `--inspect`

### Nếu P95 accessible schools > 500ms

1. Kiểm tra query plan với `EXPLAIN ANALYZE`
2. Xác nhận index `idx_schools_parent_status` tồn tại
3. Bật cache `accessible-schools:{userId}` (TTL 5 phút)
4. Giảm N+1 query (kiểm tra có query child schools riêng không)
5. Xem xét materialized view cho SUPER_ADMIN (nhiều trường)

### Nếu P95 current context > 200ms

1. Endpoint này chủ yếu là Redis GET → kiểm tra Redis health
2. Kiểm tra school detail lookup có bị N+1 không
3. Xem xét cache school metadata (name, code) cùng context session

### Nếu error rate > 1%

1. Kiểm tra rate limiting (429) — có quá aggressive không
2. Kiểm tra connection pool exhaustion (PostgreSQL/Redis)
3. Kiểm tra memory leak / GC pressure
4. Review error logs với correlationId

---

## 9. Prometheus Metrics Cần Monitor

| Metric | Type | Mục đích |
|--------|------|----------|
| `context_switch_total` | Counter | Tổng số switch (label: status) |
| `context_switch_failed` | Counter | Số switch thất bại |
| `redis_context_hit` | Counter | Cache hit rate |
| `redis_context_miss` | Counter | Cache miss rate |
| `context_resolution_time` | Histogram | Thời gian resolve context (ms) |
| `global_view_requests` | Counter | Số request Global View |
| `http_request_duration_seconds` | Histogram | Latency tổng thể |

### Grafana Dashboard Queries (PromQL)

```promql
# P95 context switch latency
histogram_quantile(0.95, rate(context_resolution_time_bucket[5m]))

# Cache hit rate
rate(redis_context_hit[5m]) / (rate(redis_context_hit[5m]) + rate(redis_context_miss[5m]))

# Error rate
rate(context_switch_failed[5m]) / rate(context_switch_total[5m])
```

---

## 10. Lịch Chạy Load Test

| Lần | Ngày | Môi trường | Người thực hiện | Kết quả |
|-----|------|------------|-----------------|---------|
| 1 | ___ | Staging | ___ | Chờ |
| 2 | ___ | Staging | ___ | Chờ |
| 3 (Pre-prod) | ___ | Production-like | ___ | Chờ |

---

## 11. Tài Liệu Tham Khảo

- [k6 Documentation](https://k6.io/docs/)
- [Grafana k6 Cloud](https://k6.io/cloud/)
- [NestJS Performance Best Practices](https://docs.nestjs.com/faq/performance)
- Spec: `.kiro/specs/workspace-context-switcher/design.md` — Architecture section
- Spec: `.kiro/specs/workspace-context-switcher/requirements.md` — Requirement 17
- Script: `tests/performance/context-switch-load-test.k6.js` (task 20.1)
