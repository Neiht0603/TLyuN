# Phân công Backend và Database cho frontend TLyuN

## Phạm vi

Áp dụng cho `index`, `services`, `warehouses`, `contact`, `login`, `register`, `admin-content` và `admin-collections`. Không bao gồm `dashboard.html`.

Mọi API trả JSON theo khuôn dạng:

```json
{ "success": true, "data": {} }
```

Khi lỗi, trả `{ "success": false, "error": { "code": "…", "message": "…" } }`; không trả SQL hay stack trace.

## Database

### 1. Tài khoản và phiên đăng nhập

- Tạo/chuẩn hóa `users`: `id`, `account_type` (`customer`, `business`, `staff`, `employee`, `admin`), `full_name`, `company_name` nullable, `email`, `phone`, `date_of_birth`, `password_hash`, timestamps.
- Unique cho `email` và `phone`; kiểm tra `company_name` bắt buộc khi `account_type=business`.
- Tạo bảng session/token theo cơ chế xác thực của dự án; token/cookie phải có hạn dùng và có thể bị thu hồi khi đăng xuất.
- Seed tối thiểu một tài khoản quản trị để kiểm thử CMS.

### 2. Dữ liệu nghiệp vụ

- `contact_messages`: họ tên, email, điện thoại, nội dung, cờ đồng ý riêng tư, thời điểm gửi và trạng thái xử lý.
- `transport_quotes`: `user_id`, điểm lấy/giao, khối lượng, ba kích thước, loại xe, `booking_type` (`whole_vehicle`, `goods_only`), số lượng, ghi chú, trạng thái, timestamps.
- `warehouses`: tên, thành phố, loại kho (`standard`, `cold`, `mini`, `container`), hình thức lưu trữ (`ambient`, `chilled`, `frozen`), diện tích, giá/m², đơn vị giá, ảnh, mô tả, `sort_order`, `is_published`, timestamps. Chỉ mục cho bộ lọc city/type/storage/price và thứ tự.

### 3. Dữ liệu nội dung CMS

- `site_content` với unique `(page_key, content_key)`, giá trị JSON, `is_published`, timestamps. Page hợp lệ: `home`, `services`, `warehouses`, `contact`, `login`, `register`.
- `service_slides`: `audience` (`customer`, `business`), title, alt, image URL, sort order, published.
- `articles`: title, summary, published date, image URL, external URL, sort order, published.
- `customers`: name, logo URL, sort order, published.
- Thêm chỉ mục `(is_published, sort_order)` cho các danh sách; `(audience, is_published, sort_order)` cho slide.
- Migration có rollback và seed idempotent lấy nội dung mặc định từ frontend. Ràng buộc URL HTTP/HTTPS, độ dài trường, số không âm và enum ở cả DB lẫn backend.

## Backend

### A. Xác thực: login và register

- `POST /api/v1/auth/register`: nhận đúng payload FE: `account_type`, `full_name`, `company_name` (business), `email`, `phone`, `date_of_birth`, `password`, `password_confirmation`, `privacy_consent`. Validate mật khẩu tối thiểu 8 ký tự, email/điện thoại unique, ngày sinh hợp lệ và consent bắt buộc. Hash mật khẩu.
- `POST /api/v1/auth/login`: nhận `identifier` (email hoặc điện thoại) và `password`; tạo phiên cookie an toàn.
- `GET /api/v1/auth/me`: trả `id`, `full_name`, `email`, `role`/`account_type` cần thiết cho kiểm tra đăng nhập và trang quản trị.
- `POST /api/v1/auth/logout`: thu hồi phiên hiện tại.
- Các route cần đăng nhập trả 401 nếu không có phiên; mọi endpoint admin trả 403 nếu role không thuộc `admin`, `staff`, `employee`.

### B. Liên hệ và báo giá

- `POST /api/v1/contact-messages`: validate `full_name`, email, phone, message và `privacy_consent=true`; lưu vào `contact_messages`.
- `POST /api/v1/transport-quotes`: bắt buộc đăng nhập; nhận `pickup_location`, `delivery_location`, `weight_kg`, `length_cm`, `width_cm`, `height_cm`, `vehicle_type`, `booking_type`, `quantity`, `notes`. Các số phải lớn hơn 0, quantity nguyên dương.

### C. API công khai

- `GET /api/v1/site-content?page={home|services|warehouses|contact|login|register}`: chỉ trả nội dung đã xuất bản. Giữ HTML mặc định của FE khi dữ liệu thiếu hoặc API lỗi.
- `GET /api/v1/site-settings`: trả cấu hình dùng ở trang chủ, tối thiểu dữ liệu cần để FE xác định audience cho carousel.
- `GET /api/v1/service-slides?audience=customer|business`, `GET /api/v1/articles`, `GET /api/v1/customers`: chỉ trả bản ghi đã xuất bản, sắp xếp `sort_order` tăng dần.
- `GET /api/v1/warehouses`: nhận `city`, `warehouse_type`, `storage_type`, `min_price`, `max_price`, `sort_by`, `sort_order`, `page`, `limit`. Chỉ trả kho đã xuất bản, phân trang và trả `items` cùng `pagination.current_page`, `pagination.total_pages`, `pagination.total`.

### D. CMS quản trị

- Bảo vệ toàn bộ `/api/v1/admin/*` bằng middleware xác thực + phân quyền trên server.
- `GET/POST /api/v1/admin/site-content`: trả/lưu `data.pages`; allowlist field đúng các form trong `admin-content.html`. POST lưu trong transaction và không nhận thông tin tài khoản/mật khẩu.
- `GET /api/v1/admin/{service-slides|articles|customers|warehouses}?page=1&limit=20`, slide nhận thêm `audience`.
- `POST /api/v1/admin/{collection}/save`: tạo khi không có `id`, cập nhật khi có `id`.
- `POST /api/v1/admin/{collection}/delete` nhận `{ "id": "…" }`; kiểm tra liên kết dữ liệu trước khi xóa kho, ưu tiên soft delete khi cần lưu lịch sử.
- Danh sách admin phải trả `data.items` và `data.pagination.total_pages`; từng item có `id`, `is_published` và đúng field FE gửi.

## Thứ tự triển khai và nghiệm thu

1. DB migrations, constraints, indexes và seed.
2. Auth và middleware, sau đó contact/transport quote.
3. API warehouse và ba collection công khai.
4. Site content public và CMS admin.
5. Kiểm thử API: validation, 401/403, phân trang/lọc, draft không lộ ra public, CRUD còn dữ liệu sau khi tải lại.

Hoàn thành khi từng form FE gửi được dữ liệu đúng endpoint, danh sách kho lọc/phân trang được, nội dung CMS xuất bản xuất hiện ở trang công khai và người không có quyền không truy cập được API admin.
