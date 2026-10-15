# Phân công CMS TLyuN: DB, BE và FE

## Phạm vi

Quản trị nội dung cho năm nhóm trang:

1. Trang chủ.
2. Dịch vụ.
3. Hệ thống kho.
4. Liên hệ.
5. Đăng nhập/đăng ký — chỉ nội dung tĩnh; không cho thay đổi trường, validation, payload hoặc luồng xác thực.

Các danh sách được quản trị riêng: slide dịch vụ, bài viết, khách hàng/đối tác và kho. Tin nhắn liên hệ, tài khoản, mật khẩu, báo giá và các giao dịch không phải nội dung CMS.

Quyền quản trị phải được xác thực và kiểm tra ở BE trên mọi request. Ẩn giao diện FE không thay thế kiểm tra quyền ở máy chủ.

## Đầu việc DB

1. Rà soát database hiện có và thống nhất tên/schema trước khi tạo migration. Thư mục hiện có là `database/shema`; không đổi tên hoặc xóa dữ liệu hiện hữu ngoài phạm vi.
2. Tạo migration cho nội dung tĩnh theo `page_key` và `content_key`, có kiểu/giá trị JSON phù hợp, trạng thái xuất bản và timestamps; đặt unique key để cập nhật không tạo bản ghi trùng.
3. Bổ sung hoặc chuẩn hóa bảng cho slide dịch vụ, bài viết, khách hàng/đối tác và kho; có ID ổn định, URL ảnh, thứ tự hiển thị, trạng thái xuất bản và timestamps.
4. Thêm chỉ mục cho tra cứu trang, audience, trạng thái và thứ tự hiển thị.
5. Tạo seed nội dung ban đầu lấy từ các nội dung đang được chốt trong FE; seed phải lặp lại an toàn và không ghi đè nội dung đã được biên tập.
6. Bổ sung ràng buộc độ dài, trường bắt buộc, giá/diện tích không âm, enum kho/audience; quyết định soft-delete cho nội dung cần lưu lịch sử.
7. Viết kiểm thử migration, rollback (nếu quy trình hỗ trợ), seed lặp lại và ràng buộc dữ liệu.

## Đầu việc BE

1. Kiểm tra phiên đăng nhập và role `admin`/`staff`/`employee` ở phía server cho toàn bộ `/api/v1/admin/*`; từ chối mặc định và trả 401/403 theo hợp đồng chung.
2. Triển khai `GET /api/v1/admin/site-content` và `POST /api/v1/admin/site-content` để đọc/lưu nội dung tĩnh theo page key. Lưu toàn bộ payload trong một transaction; từ chối key không nằm trong allowlist.
3. Triển khai public `GET /api/v1/site-content?page={home|services|warehouses|contact|login|register}`. Chỉ trả trường công khai đã xuất bản; không trả draft hoặc dữ liệu nội bộ.
4. Triển khai CRUD có xác thực cho `/api/v1/admin/service-slides`, `/api/v1/admin/articles`, `/api/v1/admin/customers` và `/api/v1/admin/warehouses`. Hỗ trợ phân trang, sắp thứ tự, trạng thái xuất bản và bộ lọc audience cho slide.
5. Giữ API đọc công khai hiện có (`/site-settings`, `/service-slides`, `/articles`, `/customers`, `/warehouses`) tương thích; dữ liệu CMS đã xuất bản phải được phản ánh qua các API này.
6. Validate URL HTTP/HTTPS, độ dài, kiểu số, enum và unique ID; dùng transaction khi lưu nội dung nhiều bản ghi. Trả lỗi an toàn theo `{ success, data, error }`, không lộ SQL/stack trace.
7. Viết kiểm thử quyền, CRUD, validation, pagination, publication/draft, persistence và đảm bảo POST tạo báo giá/tin nhắn/tài khoản không bị thay đổi.

### Hợp đồng FE/BE cho trang quản trị

- `GET /api/v1/admin/site-content` trả `{ success: true, data: { pages: { home, services, warehouses, contact, login, register } } }`.
- `POST /api/v1/admin/site-content` nhận `{ pages: { home, services, warehouses, contact, login, register } }`, trả về nội dung đã lưu trong `data.pages`.
- Key nội dung home: `eyebrow,hero_slogan,hero_description,hero_image_url,service_heading,article_heading,customer_heading`.
- Key services: `eyebrow,title,description,quote_heading,transport_title,transport_subtitle,transport_steps[{title,description}],value_added_heading,value_added_intro,value_added_services[{title,description}]`.
- Key warehouses: `eyebrow,title,description`. Key contact: `eyebrow,title,description,details_title,details_description,emails[]`.
- Key login: `eyebrow,title,description,register_prompt,register_link_label`. Key register: `eyebrow,title,description,password_hint,privacy_text,login_prompt,login_link_label`. Không trả hoặc nhận field tài khoản/mật khẩu qua CMS.
- Đọc danh sách quản trị qua `GET /api/v1/admin/{service-slides|articles|customers|warehouses}?page=1&limit=20`. Slide nhận thêm query `audience=customer|business`.
- Tạo/cập nhật dùng `POST /api/v1/admin/{collection}/save`, payload chứa ID khi cập nhật; xóa dùng `POST /api/v1/admin/{collection}/delete` với `{ id }`.
- Danh sách trả trong `data.items` và `data.pagination.total_pages`; từng item có `id,is_published`. Slide gồm `audience,title,alt,image_url,sort_order`; bài viết gồm `title,summary,published_at,image_url,url,sort_order`; đối tác gồm `name,logo_url,sort_order`; kho gồm `name,city,warehouse_type,storage_type,area_m2,price_per_m2,price_unit,image_url,description,sort_order`.
- Các trang công khai chỉ nhận trường đã xuất bản từ `GET /api/v1/site-content?page=...`. FE không dùng response admin ở trang công khai.

Trong nội dung dịch vụ, `transport_steps` và `value_added_services` được biên tập theo từng dòng `tên|mô tả`; email liên hệ theo từng dòng. API vẫn nhận/trả mảng JSON đã chuẩn hóa, không lưu chuỗi textarea.

## Đầu việc FE

1. Thêm `frontend/pages/admin-content.html` để chỉnh nội dung tĩnh năm nhóm trang, gồm tiêu đề, mô tả, thông tin hiển thị và các danh sách bước/dịch vụ/email có trong schema.
2. Thêm `frontend/pages/admin-collections.html` để quản trị slide, bài viết, đối tác và bản ghi kho; tạo, sửa, xóa và xem trạng thái API.
3. Chỉ mở giao diện cho role quản trị được BE xác nhận; chuyển người chưa đăng nhập tới đăng nhập, thông báo rõ khi không đủ quyền. Luôn dựa vào 401/403 của BE, không giả lập role ở trình duyệt.
4. Không cung cấp bộ sửa nội dung làm thay đổi ID input, tên field, validation, consent hoặc payload trong login/register; chỉ cho sửa copy tĩnh.
5. Sau khi BE triển khai public API, gắn nội dung đã xuất bản lên năm nhóm trang mà không thay đổi hợp đồng form hiện có. Giữ giá trị HTML mặc định khi API lỗi và thông báo trạng thái độc lập.
6. Bảo đảm responsive, keyboard/focus, loading/empty/error/success và chặn gửi lặp; không lưu bí mật hay token vào dữ liệu nội dung.
7. Viết kiểm thử FE cho phân quyền giao diện, mapping dữ liệu, validation form biên tập, lỗi API và CRUD sau khi mock/API tích hợp sẵn sàng.

## Điều kiện nghiệm thu tích hợp

- Nhân viên/quản trị có thể sửa nội dung năm nhóm trang và CRUD bốn danh sách; thay đổi được lưu trong DB và còn sau khi tải lại.
- Người dùng không đăng nhập hoặc không có quyền không thể đọc/sửa endpoint admin kể cả khi gọi API trực tiếp.
- Nội dung đã xuất bản cập nhật trên trang công khai; nội dung nháp không xuất hiện công khai.
- Không thay đổi luồng đăng nhập/đăng ký, báo giá vận chuyển, gửi liên hệ hoặc lọc/phân trang kho.
- Lỗi xác thực, validation và lỗi máy chủ có trạng thái phân biệt, không hiển thị thông tin nội bộ.

## Trạng thái bàn giao trong workspace

- FE: đã thêm `admin-content.html` và `admin-collections.html`, role gate phía giao diện, form biên tập copy, CRUD UI cho bốn danh sách và mapping public content có fallback.
- BE/DB: đây là đầu việc được phân công, chưa triển khai endpoint/migration trong workspace. Các trang admin sẽ báo lỗi API cho tới khi các endpoint trong hợp đồng được triển khai.
- Mock API: hỗ trợ đọc nội dung công khai để xem nội dung mặc định; không giả lập endpoint admin hay quyền quản trị.
