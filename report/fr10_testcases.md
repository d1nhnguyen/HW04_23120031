# FR-10 Trạng thái đơn hàng – test case chọn để tự động hóa (B1)

Phạm vi: Web Admin `http://localhost:5174` mục **Đơn hàng**, và trang **Hồ sơ** (`/profile`, bảng Lịch sử đơn hàng) của Web khách hàng `http://localhost:5173`. 11 test case web lấy từ HW02 (`scripts/fr10/cases.json`), giữ nguyên ID; hai case `FR10-UI-*` là case bổ sung ở HW04. Kết quả mong đợi lấy từ đặc tả (README của SUT), không lấy từ hành vi thực tế của SUT.

## 1. Câu đặc tả dùng làm kết quả mong đợi

| Mã | Nguồn | Nguyên văn |
| --- | --- | --- |
| S1 | FR-10 | "Đơn hàng có **5 trạng thái** và phải tuân theo sơ đồ chuyển đổi sau": `pending` →[Admin xác nhận]→ `confirmed` →[Admin giao hàng]→ `shipping` →[Admin hoàn tất]→ `delivered`; `pending` và `confirmed` →[User/Admin hủy]→ `canceled` |
| S2 | FR-10 | "Trạng thái `delivered` và `canceled` là **trạng thái kết thúc** — không được phép chuyển sang bất kỳ trạng thái nào khác." |
| S3 | FR-10 | "Khi đơn hàng đã ở trạng thái `shipping`, **User không được phép tự hủy** — chỉ Admin mới có thể thao tác." |
| S4 | FR-10 | "Mọi chuyển đổi không hợp lệ phải trả về lỗi với thông báo phù hợp." |
| S5 | FR-11 | "Trạng thái phải được dịch sang tiếng Việt rõ ràng và phân biệt màu sắc." |

Thao tác được phép, suy ra từ S1–S3 theo sơ đồ:

| Trạng thái | Admin | User |
| --- | --- | --- |
| pending | → confirmed, → canceled | → canceled |
| confirmed | → shipping, → canceled | → canceled |
| shipping | → delivered | (không) |
| delivered, canceled | (không) | (không) |

**Giả định A1 (đặc tả mơ hồ).** Admin không được chuyển `shipping → canceled`. Sơ đồ không vẽ chuyển đó, nhưng S3 viết "chỉ Admin mới có thể thao tác" ở trạng thái `shipping`, có thể hiểu là Admin hủy được. Suite theo sơ đồ: dòng Đang giao trên Web Admin chỉ được có nút "Hoàn thành". Nên hỏi lại trợ giảng.

## 2. 13 test case được chọn

| # | ID | Giao diện | Mục tiêu | Đơn setup → nút bấm | Kết quả mong đợi theo đặc tả | Web ở HW02 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | FR10-DT-01 | Admin | Xác nhận | pending → "Xác nhận" | S1: đơn thành `confirmed`; đơn khác giữ nguyên | Pass |
| 2 | FR10-DT-02 | Admin | Giao hàng | confirmed → "Giao hàng" | S1: `shipping` | Pass |
| 3 | FR10-DT-03 | Admin | Hoàn tất | shipping → "Hoàn thành" | S1: `delivered` | Pass |
| 4 | FR10-DT-04 | Admin | Hủy ở pending | pending → "Hủy" | S1: `canceled` | Pass |
| 5 | FR10-DT-05 | Admin | Hủy ở confirmed | confirmed → "Hủy" | S1: `canceled` | Pass |
| 6 | FR10-DT-06 | Hồ sơ | User hủy ở pending | pending → "Hủy đơn" | S1: `canceled` | Pass |
| 7 | FR10-DT-07 | Hồ sơ | User hủy ở confirmed | confirmed → "Hủy đơn" | S1: `canceled` | Pass |
| 8 | FR10-DT-09 | Admin | Ra khỏi trạng thái kết thúc | canceled → "Đánh dấu Đã giao" | S2, S4: từ chối (≥ 400), đơn giữ `canceled` | Fail (BUG-30) |
| 9 | FR10-DT-14 | Hồ sơ | User hủy ở shipping | shipping → "Hủy đơn" | S3, S4: từ chối (≥ 400), đơn giữ `shipping`, không báo "thành công" | Fail (BUG-31) |
| 10 | FR10-DT-26 | Admin | Bộ nút ở trạng thái chưa kết thúc (phạm vi thu hẹp, xem mục 3) | pending, confirmed, shipping | S1, A1: mỗi dòng có đúng nút của các chuyển được phép | Fail (vì dòng Đã hủy, nay thuộc UI-01) → HW04 kỳ vọng pass |
| 11 | FR10-DT-27 | Hồ sơ | Bộ nút ở trạng thái chưa kết thúc (phạm vi thu hẹp, xem mục 3) | pending, confirmed, shipping | S1, S3: "Hủy đơn" chỉ ở pending, confirmed; không có ở shipping | Fail (BUG-31) |
| 12 | FR10-UI-01 | Admin | Bộ nút ở trạng thái kết thúc (bổ sung) | delivered, canceled | S2: không có nút nào | (HW02 nằm trong DT-26) |
| 13 | FR10-UI-02 | Hồ sơ | Bộ nút ở trạng thái kết thúc (bổ sung) | delivered, canceled | S2: không có nút nào | (HW02 nằm trong DT-27) |

| Phân loại | Số case | Case |
| --- | --- | --- |
| Chuyển hợp lệ (accept) | 7 | 1–7 |
| Chuyển không hợp lệ (reject) | 2 | 8, 9 |
| Bộ nút theo trạng thái (view) | 4 | 10–13 |
| Web Admin / Hồ sơ | 8 / 5 | 1–5, 8, 10, 12 / 6, 7, 9, 11, 13 |
| Dựa vào S1 / S2 / S3 / S4 | 9 / 3 / 2 / 2 | S1: 1–7, 10, 11 · S2: 8, 12, 13 · S3: 9, 11 · S4: 8, 9 |

Mỗi case kiểm hai tầng. Giao diện: nhãn trạng thái của dòng đơn, bộ nút, các dòng khác giữ nguyên, không tải lại trang. Server: `GET /api/orders/:id` của đơn đích, các đơn khác trong `GET /api/admin/orders` giữ nguyên. Case accept kiểm phản hồi 2xx của yêu cầu đổi trạng thái / hủy đơn; case reject bấm thật nút đang có và kiểm phản hồi ≥ 400.

## 3. Khác biệt so với HW02

- **Đơn test tự tạo.** HW02 thao tác trên đơn #1–#5 tạo sẵn sau mỗi lần khởi động lại backend. Ở HW04 dữ liệu chỉ reset một lần mỗi lượt feature × browser, nên mỗi test tự tạo đơn bằng `POST /api/checkout` rồi đưa tới trạng thái cần qua các chuyển hợp lệ.
- **Không dọn được.** SUT không có API xóa đơn. Mọi assertion bám vào id của đơn test tự tạo; "các đơn khác giữ nguyên" so với bản chụp ngay trước thao tác; dữ liệu về seed ở lần reset đầu lượt.
- **Phạm vi của DT-26 và DT-27 thu hẹp so với HW02.** HW02 kiểm cả 5 trạng thái; HW04 bỏ `delivered` và `canceled`, phần đó chuyển sang FR10-UI-01 (Admin) và FR10-UI-02 (Hồ sơ), để mỗi trạng thái chỉ được kiểm ở một case. Hệ quả: DT-26 đổi từ **Fail ở HW02** (vì dòng Đã hủy có nút "Đánh dấu Đã giao") sang **kỳ vọng pass** ở HW04; lỗi đó nay do FR10-UI-01 bắt. DT-27 vẫn kỳ vọng fail vì dòng Đang giao (BUG-31).
- **DT-09, DT-14 bấm thật nút đang có trên giao diện.** Việc nút không được tồn tại do FR10-UI-01 và FR10-DT-27 kiểm.

## 4. Test case không tự động hóa được trên web

| Case HW02 | Lý do |
| --- | --- |
| Chuyển không hợp lệ của Admin mà giao diện không có nút (ví dụ `pending → delivered`, `delivered → pending`, `shipping → canceled`) | Giao diện chỉ hiện nút cho một số chuyển; không có cách gửi chuyển đó qua giao diện. Đã kiểm qua API ở HW02 |
| User hủy đơn của người khác, đơn không tồn tại | Trang Hồ sơ chỉ liệt kê đơn của chính user |
| Giá trị `status` sai kiểu, không thuộc 5 trạng thái | Chỉ gửi được qua API |
