# Rollback Plan: Workspace Context Switcher

## Tổng Quan

Tài liệu mô tả quy trình rollback tính năng Workspace Context Switcher về trạng thái trước khi triển khai. Rollback được thiết kế zero-downtime và không gây mất dữ liệu.

**Nguyên tắc:** Disable feature flag → hệ thống lập tức fallback về JWT-only resolution. Không cần re-authentication, không mất dữ liệu nghiệp vụ.

---

## 1. Disable Feature Flag (Bước Đầu Tiên)

### Cách thực hiện

Đặt biến môi trường trong `.env` hoặc hệ thống quản lý cấu hình:

```env
CONTEXT_SWITCHER_ENABLED=false
```

Restart application hoặc reload environment (tùy deployment platform).

### Hiệu ứng tức thì

| Thành phần | Hành vi sau khi disable |
|---|---|
| TenantMiddleware | Bỏ qua Redis context session resolution, dùng JWT schoolId trực tiếp |
| `POST /api/v1/context/switch` | Không thực thi context switch (skip logic) |
| `GET /api/v1/context/accessible-schools` | Trả về dựa trên JWT claims thuần |
| `GET /api/v1/context/current` | Resolve từ JWT, không đọc Redis session |
| Existing endpoints | Hoạt động bình thường với JWT-based resolution |

### Disable theo trường cụ thể

Nếu chỉ cần rollback cho một số trường:

```env
CONTEXT_SWITCHER_ENABLED=true
CONTEXT_SWITCHER_DISABLED_SCHOOLS=<school-uuid-1>,<school-uuid-2>
```

---

## 2. Không Cần Re-authentication

- JWT payload **không thay đổi** trong suốt quá trình triển khai và rollback
- Existing access tokens và refresh tokens vẫn hợp lệ
- Users **không cần đăng nhập lại** sau khi disable feature flag
- Login/refresh endpoints không bị ảnh hưởng

---

## 3. Không Mất Dữ liệu

### Redis Context Sessions

- Key pattern: `context:session:{userId}`
- TTL: 24 giờ → tự expire nếu không được truy cập
- Khi feature disabled: sessions không được đọc, tự hết hạn
- **Tùy chọn:** Flush sessions ngay lập tức nếu muốn giải phóng Redis memory:

```bash
# Xóa tất cả context sessions (optional)
redis-cli --scan --pattern "context:session:*" | xargs redis-cli DEL
```

### Dữ liệu nghiệp vụ

- **Không ảnh hưởng** đến dữ liệu teachers, schools, classes, timetables
- Audit logs của context switch vẫn được giữ nguyên trong `audit_logs` table
- Không có dữ liệu nghiệp vụ nào phụ thuộc vào context session

---

## 4. Database Rollback (Tùy Chọn)

> ⚠️ **CHỈ thực hiện nếu muốn xóa hoàn toàn schema changes.** Thông thường chỉ cần disable feature flag là đủ.

### Điều kiện tiên quyết

- Không có user nào đang giữ role `company_admin`
- Không có user nào có giá trị `company_school_id` khác NULL

### Kiểm tra trước khi rollback

```sql
-- Kiểm tra có user nào có role company_admin không
SELECT COUNT(*) FROM users WHERE role = 'company_admin';

-- Kiểm tra có user nào có company_school_id không
SELECT COUNT(*) FROM users WHERE company_school_id IS NOT NULL;
```

**Nếu kết quả > 0:** Phải chuyển users về role khác và clear `company_school_id` trước khi chạy migration down.

### Chạy migration rollback

```bash
# Rollback feature flag seed migration
npx typeorm migration:revert -d src/database/data-source.ts
# Rollback: 1751900100000-seed-workspace-context-switcher-feature-flag

# Rollback schema migration (company_admin role + companySchoolId column)
npx typeorm migration:revert -d src/database/data-source.ts
# Rollback: 1751900000000-add-workspace-context-roles-and-column
```

### Migration down() thực hiện

1. Xóa records trong `feature_flags` với `flag_key = 'workspace_context_switcher'`
2. Drop index `idx_users_company_school_id`
3. Drop FK constraint `FK_users_company_school_id`
4. Drop column `company_school_id` từ bảng `users`
5. Recreate `user_role_enum` không có `company_admin`

---

## 5. Quy Trình Rollback Từng Bước

### Kịch bản A: Rollback nhanh (chỉ disable feature)

| Bước | Hành động | Thời gian | Rủi ro |
|------|-----------|-----------|--------|
| 1 | Set `CONTEXT_SWITCHER_ENABLED=false` trong env | 1 phút | Không |
| 2 | Restart/redeploy application | 2-5 phút | Downtime ngắn nếu không có rolling deploy |
| 3 | Verify: các API call dùng JWT resolution | 1 phút | Không |
| 4 | (Optional) Flush Redis context sessions | 1 phút | Không |

**Tổng thời gian:** ~5 phút

### Kịch bản B: Rollback hoàn toàn (xóa schema changes)

| Bước | Hành động | Thời gian | Rủi ro |
|------|-----------|-----------|--------|
| 1 | Set `CONTEXT_SWITCHER_ENABLED=false` | 1 phút | Không |
| 2 | Restart application | 2-5 phút | Không |
| 3 | Verify system hoạt động bình thường | 5 phút | Không |
| 4 | Kiểm tra không có users với role `company_admin` | 1 phút | Không |
| 5 | Chạy `migration:revert` (2 migrations) | 2 phút | Lỗi nếu có users company_admin |
| 6 | Restart application | 2-5 phút | Không |
| 7 | Flush Redis context sessions | 1 phút | Không |
| 8 | Verify final state | 5 phút | Không |

**Tổng thời gian:** ~20 phút

---

## 6. Verification Sau Rollback

### Kiểm tra hệ thống hoạt động bình thường

```bash
# Health check
curl -s http://localhost:3000/api/v1/health | jq .

# Login vẫn hoạt động
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"..."}' | jq .status

# Existing API calls dùng JWT-based resolution
curl -s http://localhost:3000/api/v1/teachers \
  -H "Authorization: Bearer <token>" | jq .success
```

### Checklist xác nhận

- [ ] Application khởi động không lỗi
- [ ] Login/refresh token hoạt động bình thường
- [ ] API calls resolve tenant từ JWT schoolId
- [ ] X-School-Id header cho SUPER_ADMIN impersonation vẫn hoạt động
- [ ] Không có error logs liên quan đến context module
- [ ] SchoolScopeGuard hoạt động bình thường

---

## 7. Rủi Ro và Lưu Ý

| Rủi ro | Mức độ | Giải pháp |
|--------|--------|-----------|
| Users đang ở giữa context switch khi disable | Thấp | Request hiện tại hoàn thành, request tiếp theo dùng JWT |
| Redis sessions chưa expire gây confusion | Không | Sessions không được đọc khi feature disabled |
| Frontend vẫn gửi X-School-Id header | Không | TenantMiddleware xử lý header theo logic cũ (SUPER_ADMIN impersonation) |
| Migration revert thất bại do users có role company_admin | Trung bình | Phải update users về role khác trước khi revert |
| Cache cũ còn tồn tại trong Redis | Thấp | Cache có TTL ngắn (5-15 phút), tự expire |

### Lưu ý quan trọng

1. **Kịch bản A là đủ** cho hầu hết trường hợp rollback — không cần chạy migration revert
2. Chỉ chạy Kịch bản B nếu quyết định **xóa hoàn toàn** tính năng khỏi codebase
3. Database migration revert **không thể đảo ngược** nếu enum `company_admin` đã được sử dụng
4. Nên thực hiện rollback trong khung giờ ít traffic (22:00 - 06:00)

---

## 8. Contacts

| Vai trò | Trách nhiệm |
|---------|-------------|
| DevOps | Thay đổi environment variables, restart application |
| Backend Lead | Quyết định kịch bản rollback, chạy migration revert |
| DBA | Verify database state, hỗ trợ migration issues |
| QA | Verify hệ thống sau rollback |
