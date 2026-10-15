# Phân công chi tiết Backend và Database theo chức năng

## Quy ước chung

- Phạm vi: toàn bộ frontend trừ `dashboard.html`.
- Response thành công: `{ "success": true, "data": … }`. Response lỗi: `{ "success": false, "error": { "code": "…", "message": "…" } }`.
- Backend validate toàn bộ input dù frontend đã kiểm tra. Không trả SQL, stack trace hay thông tin nội bộ.
- Route admin bắt buộc có phiên đăng nhập và role `admin`, `staff` hoặc `employee`. Không đăng nhập trả 401; không đủ quyền trả 403.
- Dữ liệu công khai chỉ trả bản ghi `is_published=true` và dữ liệu nội dung đã xuất bản.

---

## SF01 — Trang chủ

### Mục tiêu

Hiển thị menu, hero, carousel dịch vụ, bài viết, logo đối tác và footer. Mỗi section tải độc lập để lỗi một API không làm hỏng section khác.

### Nhiệm vụ Database

1. Tạo/chuẩn hóa `site_settings` để chứa cấu hình công khai dùng ở trang chủ, tối thiểu `default_slide_audience` (`customer` hoặc `business`), timestamps.
2. Tạo `service_slides`: `id`, `audience`, `title`, `alt`, `image_url`, `sort_order`, `is_published`, timestamps. Ràng buộc `audience` là `customer|business`, URL HTTP/HTTPS, `sort_order >= 0`.
3. Tạo `articles`: `id`, `title`, `summary`, `published_at`, `image_url`, `url`, `sort_order`, `is_published`, timestamps. URL ảnh và URL bài viết phải hợp lệ nếu có.
4. Tạo `customers`: `id`, `name`, `logo_url`, `sort_order`, `is_published`, timestamps.
5. Tạo `site_content` với unique `(page_key, content_key)` cho nội dung hero: `eyebrow`, `hero_slogan`, `hero_description`, `hero_image_url`, `service_heading`, `article_heading`, `customer_heading`.
6. Tạo index `(audience, is_published, sort_order)` cho slide và `(is_published, sort_order)` cho articles/customers. Seed dữ liệu đang hiển thị trong FE.

### Nhiệm vụ Backend

1. `GET /api/v1/site-settings`: trả `data.default_slide_audience`; cache ngắn hạn nếu cần, không trả cấu hình quản trị.
2. `GET /api/v1/site-content?page=home`: trả chính xác các key home đã xuất bản.
3. `GET /api/v1/service-slides?audience=customer|business`: validate audience, chỉ trả tối đa 3 slide đã xuất bản theo `sort_order ASC, id ASC`. Mỗi item gồm `id`, `title`, `alt`, `image_url`, `sort_order`.
4. `GET /api/v1/articles`: chỉ trả bài đã xuất bản, sắp xếp `sort_order ASC, published_at DESC`; mỗi item gồm `id`, `title`, `summary`, `published_at`, `image_url`, `url`.
5. `GET /api/v1/customers`: chỉ trả đối tác đã xuất bản theo `sort_order ASC`; mỗi item gồm `id`, `name`, `logo_url`.
6. Mỗi endpoint đọc độc lập, timeout/lỗi của articles không được làm hỏng response settings, slides hay customers.

### Phụ thuộc Frontend cần bàn giao

1. `home.js` đã tải riêng từng section; bổ sung nút Pause/Play cho carousel, có `aria-pressed`, dừng timer khi Pause và đổi nhãn rõ ràng.
2. Tôn trọng `prefers-reduced-motion`: không tự chạy carousel; vẫn cho người dùng chuyển ảnh bằng nút.
3. API không có dữ liệu hoặc lỗi phải giữ hero/footer HTML mặc định và hiển thị trạng thái lỗi riêng của section.

### Nghiệm thu

- Hero nhận slogan từ API; Customer/Business dẫn đến `login.html?audience=customer|business`.
- API slides trả nhiều hơn 3 bản ghi thì frontend vẫn chỉ nhận tối đa 3 bản ghi.
- Chặn hoặc làm lỗi API articles không làm menu, hero, footer, slide hoặc logo đối tác biến mất.
- Carousel quay vòng, pause được và không tự chạy khi bật giảm chuyển động.

---

## SF02 — Dịch vụ và yêu cầu báo giá

### Nhiệm vụ Database

1. Thêm `site_content` page `services`: `eyebrow`, `title`, `description`, `quote_heading`, `transport_title`, `transport_subtitle`, `transport_steps` JSON, `value_added_heading`, `value_added_intro`, `value_added_services` JSON.
2. Tạo `transport_quotes`: `id`, `user_id` FK, `pickup_location`, `delivery_location`, `weight_kg`, `length_cm`, `width_cm`, `height_cm`, `vehicle_type`, `booking_type`, `quantity`, `notes`, `status`, timestamps.
3. Check constraint số đo > 0, quantity là số nguyên > 0 và `booking_type` thuộc `whole_vehicle|goods_only`; index `user_id, created_at`.

### Nhiệm vụ Backend

1. `GET /api/v1/site-content?page=services`: trả nội dung xuất bản, với `transport_steps` và `value_added_services` là mảng JSON `{ title, description }`.
2. `GET /api/v1/service-slides?audience=customer`: tái sử dụng hợp đồng SF01 cho carousel trang dịch vụ.
3. `POST /api/v1/transport-quotes`: yêu cầu đăng nhập; validate toàn bộ payload FE; gán `user_id` từ session, không nhận `user_id` từ client; lưu transaction; trả ID yêu cầu vừa tạo.
4. Nếu chưa đăng nhập trả 401 để FE lưu bản nháp rồi chuyển trang login; không tạo báo giá chưa có user.

### Nghiệm thu

- Báo giá hợp lệ còn tồn tại trong DB sau refresh; user khác không thể sửa/đọc qua ID đoán được.
- Các giá trị 0, âm, booking_type sai và quantity lẻ bị trả 422 với message an toàn.

---

## SF03 — Hệ thống kho

### Nhiệm vụ Database

1. Tạo/chuẩn hóa `warehouses`: `id`, `name`, `city`, `warehouse_type`, `storage_type`, `area_m2`, `price_per_m2`, `price_unit`, `image_url`, `description`, `sort_order`, `is_published`, timestamps.
2. Check enum: warehouse `standard|cold|mini|container`, storage `ambient|chilled|frozen`; diện tích/giá không âm.
3. Index các trường lọc `city`, `warehouse_type`, `storage_type`, `price_per_m2`, `is_published`.

### Nhiệm vụ Backend

1. `GET /api/v1/site-content?page=warehouses`: trả eyebrow/title/description đã xuất bản.
2. `GET /api/v1/warehouses`: validate `city`, `warehouse_type`, `storage_type`, `min_price`, `max_price`, `sort_by`, `sort_order`, `page`, `limit`; giới hạn limit tối đa 100.
3. Chỉ cho phép `sort_by` trong allowlist (ví dụ `price_per_m2`, `area_m2`, `name`); không ghép trực tiếp tên cột từ query.
4. Khi `min_price > max_price`, trả 422. Response gồm `data.items` và `data.pagination: { current_page, total_pages, total }`.

### Nghiệm thu

- Lọc kết hợp các điều kiện, sắp xếp và phân trang 8 item/trang hoạt động.
- Kho draft không xuất hiện từ API công khai.

---

## SF04 — Liên hệ

### Nhiệm vụ Database

1. Thêm `site_content` page `contact`: eyebrow/title/description/details_title/details_description/emails JSON.
2. Tạo `contact_messages`: `id`, `full_name`, `email`, `phone`, `message`, `privacy_consent_at`, `status`, timestamps.
3. Bắt buộc email, phone, message và thời điểm consent; index `status, created_at`.

### Nhiệm vụ Backend

1. `GET /api/v1/site-content?page=contact`: chỉ trả nội dung xuất bản và `emails` là mảng email hợp lệ.
2. `POST /api/v1/contact-messages`: không cần đăng nhập; validate họ tên, email, điện thoại, message, `privacy_consent=true`; lưu message; trả 201/response success.
3. Thêm rate limit theo IP/email để hạn chế spam; không tiết lộ rule rate limit nội bộ trong message lỗi.

### Nghiệm thu

- Gửi hợp lệ tạo một bản ghi. Thiếu consent hoặc email sai không tạo bản ghi.
- Lỗi gửi liên hệ chỉ ảnh hưởng form, không ảnh hưởng thông tin email tĩnh.

---

## SF05 — Đăng ký và đăng nhập

### Nhiệm vụ Database

1. Tạo `users` gồm `id`, `account_type`, `full_name`, `company_name` nullable, `email`, `phone`, `date_of_birth`, `password_hash`, timestamps, trạng thái tài khoản.
2. Unique email và phone; `company_name` bắt buộc với business. Không lưu password thô hay password confirmation.
3. Tạo session/token storage phù hợp cơ chế dự án; hỗ trợ thu hồi session lúc logout.

### Nhiệm vụ Backend

1. `GET /api/v1/site-content?page=login|register`: chỉ trả copy hiển thị; tuyệt đối không nhận/trả field password qua CMS.
2. `POST /api/v1/auth/register`: validate payload theo form; hash password bằng thuật toán được framework hỗ trợ; trả 409 cho email/phone trùng, 422 cho dữ liệu sai.
3. `POST /api/v1/auth/login`: cho phép `identifier` là email hoặc phone; kiểm tra mật khẩu; tạo cookie session HttpOnly, Secure trong production, SameSite phù hợp.
4. `GET /api/v1/auth/me`: trả dữ liệu tối thiểu FE cần, gồm role.
5. `POST /api/v1/auth/logout`: xóa/thu hồi session hiện tại.
6. Rate limit login/register; log audit an toàn cho đăng nhập lỗi và thay đổi role.

### Nghiệm thu

- Luồng Customer/Business giữ `audience` và `returnTo` sau đăng nhập.
- Business thiếu company_name bị từ chối; user login bằng email hoặc phone được.

---

## SF06 — Quản trị nội dung và danh sách

### Nhiệm vụ Database

1. Dùng các bảng CMS ở SF01–SF04; thêm soft-delete/audit log nếu cần lưu lịch sử thay đổi.
2. `site_content` unique `(page_key, content_key)` để update không tạo trùng. Seed phải idempotent và không ghi đè nội dung quản trị đã sửa.

### Nhiệm vụ Backend

1. Áp dụng middleware admin cho mọi `/api/v1/admin/*`.
2. `GET /api/v1/admin/site-content`: trả `data.pages` cho sáu trang: home, services, warehouses, contact, login, register.
3. `POST /api/v1/admin/site-content`: chỉ nhận allowlist field. Lưu toàn bộ thay đổi transaction; chuẩn hóa các list JSON; không nhận password, user ID, token hay field form auth.
4. `GET /api/v1/admin/{service-slides|articles|customers|warehouses}?page=&limit=`: trả cả draft, `data.items`, `data.pagination.total_pages`.
5. `POST /api/v1/admin/{collection}/save`: tạo/cập nhật theo `id`, validate schema từng collection và image URL HTTP/HTTPS.
6. `POST /api/v1/admin/{collection}/delete`: kiểm tra ID tồn tại; warehouse có liên kết dữ liệu thì trả conflict hoặc soft-delete theo chính sách đã chọn.

### Nghiệm thu

- User thường gọi trực tiếp API admin nhận 401/403.
- Admin tạo/sửa/xóa được từng collection; dữ liệu vẫn còn sau refresh.
- Draft thấy trong trang admin, không thấy ở các API công khai.
