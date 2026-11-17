# FR-15 Quản lý sản phẩm – test case chọn để tự động hóa (B1)

Phạm vi: Web Admin `http://localhost:5174`, mục **Sản phẩm**. Test case lấy từ HW02 (`scripts/fr15/cases.json`), giữ nguyên ID. Kết quả mong đợi lấy từ đặc tả (README của SUT), không lấy từ hành vi thực tế của SUT.

## 1. Câu đặc tả dùng làm kết quả mong đợi

| Mã | Nguồn | Nguyên văn |
| --- | --- | --- |
| S1 | FR-15 | "Admin có thể Thêm / Xem / Sửa / Xóa sản phẩm." |
| S2 | FR-15 | "Tên sản phẩm: bắt buộc, tối đa 255 ký tự." |
| S3 | FR-15 | "Giá: bắt buộc, phải là số **dương** (> 0)." |
| S4 | FR-15 | "Danh mục: bắt buộc, phải chọn từ danh sách có sẵn." |
| S5 | FR-15 | "Khi Sửa một sản phẩm, chỉ sản phẩm đó bị thay đổi — các sản phẩm khác giữ nguyên." |
| S6 | SEC-04 | "Mọi dữ liệu từ user nhập vào khi hiển thị trên UI phải được escape đúng cách, không dùng `innerHTML` trực tiếp." |

## 2. 15 test case được chọn

| # | ID | Thao tác | Mục tiêu | Dữ liệu chính | Kết quả mong đợi theo đặc tả | Web ở HW02 | Lý do chọn |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | FR15-DT-01 | Thêm | Thêm với dữ liệu hợp lệ điển hình, chọn Danh mục khác giá trị mặc định | Tên `Sac nhanh USB-C 20W`, Giá `350000`, Danh mục `Phụ kiện` (id 3; mặc định của form là `Điện thoại`, id 1) | S1, S4: sản phẩm mới có trong danh sách với đúng Tên và Giá; Danh mục được lưu là `Phụ kiện` | Pass | Happy path của Thêm; kiểm ràng buộc Danh mục |
| 2 | FR15-DT-03 | Thêm | Tên có ký tự HTML hiển thị nguyên văn | Tên `<b>Loa Bluetooth</b> Mini`, Giá `500000` | S1, S6: thêm thành công; danh sách hiển thị đúng chuỗi `<b>Loa Bluetooth</b> Mini`, không in đậm | Pass | Kiểm hiển thị an toàn; dùng kiểu assertion khác (nội dung văn bản nguyên văn) |
| 3 | FR15-BV-04 | Thêm | Tên dài 255 ký tự | Tên 255 ký tự, Giá `350000` | S2 "tối đa 255 ký tự": chấp nhận, lưu đủ 255 ký tự | Pass | Biên trên hợp lệ của Tên |
| 4 | FR15-BV-05 | Thêm | Tên dài 256 ký tự | Tên 256 ký tự, Giá `350000` | S2: từ chối, không tạo sản phẩm | Fail (BUG-26) | Biên trên + 1, cặp với case 3 |
| 5 | FR15-DT-05 | Thêm | Bỏ trống Tên | Tên rỗng, Giá `350000` | S2 "bắt buộc": từ chối, không tạo sản phẩm | Pass | Negative mà giao diện chặn đúng |
| 6 | FR15-DT-06 | Thêm | Tên chỉ gồm khoảng trắng | Tên 3 dấu cách, Giá `350000` | S2 "bắt buộc": từ chối, không tạo sản phẩm (giả định A2 của HW02: tên chỉ gồm khoảng trắng coi như bỏ trống) | Fail (BUG-27) | Negative mà giao diện không chặn |
| 7 | FR15-BV-14 | Thêm | Giá bằng 1 | Giá `1` | S3 "số dương (> 0)": chấp nhận | Pass | Biên dưới hợp lệ của Giá |
| 8 | FR15-DT-08 | Thêm | Giá bằng 0 | Giá `0` | S3 "> 0": từ chối, không tạo sản phẩm | Fail (BUG-24) | Biên dưới − 1, cặp với case 7 |
| 9 | FR15-DT-09 | Thêm | Giá âm | Giá `-50000` | S3 "số dương": từ chối, không tạo sản phẩm | Fail (BUG-24) | Lớp không hợp lệ: số âm |
| 10 | FR15-DT-10 | Thêm | Bỏ trống Giá | Giá để trống | S3 "bắt buộc": từ chối, không tạo sản phẩm | Fail (BUG-25) | Thiếu trường bắt buộc |
| 11 | FR15-DT-15 | Sửa | Sửa Giá, các sản phẩm khác giữ nguyên | Giá mới `42000000` | S1, S5: chỉ sản phẩm được sửa đổi Giá; các sản phẩm khác giữ nguyên | Pass | Happy path của Sửa; kiểm đúng câu S5 |
| 12 | FR15-DT-34 | Sửa | Chỉ sửa Giá, Tên và Danh mục do form điền sẵn được giữ nguyên | Chỉ chạm ô Giá, Giá mới `43000000` | S5: Tên và Danh mục của sản phẩm không đổi | Pass | Kiểm form Sửa điền sẵn đúng; dùng assertion kiểu giá trị ô nhập |
| 13 | FR15-DT-17 | Sửa | Sửa với Tên rỗng | Xóa trắng ô Tên | S2 "bắt buộc": từ chối, sản phẩm giữ nguyên | Pass | Negative của Sửa |
| 14 | FR15-DT-20 | Sửa | Sửa Giá thành 0 | Giá mới `0` | S3: từ chối, sản phẩm giữ Giá cũ | Fail (BUG-24) | Biên Giá trên thao tác Sửa |
| 15 | FR15-DT-30 | Xóa | Xóa sản phẩm, các sản phẩm khác giữ nguyên | – | S1: sản phẩm không còn trong danh sách; các sản phẩm khác còn nguyên | Pass | Happy path của Xóa |

Kết quả web ở HW02 của 15 case: **9 Pass, 6 Fail**. Sáu case Fail ứng với bốn bug đã có issue: BUG-24 (Giá bằng 0 hoặc âm), BUG-25 (thiếu Giá), BUG-26 (Tên dài hơn 255 ký tự) và BUG-27 (Tên chỉ gồm khoảng trắng).

| Phân loại | Số case | Case |
| --- | --- | --- |
| Thêm | 10 | 1–10 |
| Sửa | 4 | 11–14 |
| Xóa | 1 | 15 |
| Positive | 7 | 1, 2, 3, 7, 11, 12, 15 |
| Negative | 8 | 4, 5, 6, 8, 9, 10, 13, 14 |
| Giá trị biên | 5 | 3, 4, 7, 8, 14 |

## 3. Khác biệt so với HW02

- **Đối tượng của case Sửa và Xóa.** HW02 sửa và xóa thẳng sản phẩm seed (id 2, 3, 5) vì dữ liệu được reset trước mỗi test case. Ở HW04 dữ liệu chỉ reset một lần ở đầu mỗi lượt feature × browser, nên mỗi test tự tạo một sản phẩm qua API rồi sửa hoặc xóa chính sản phẩm đó. ID, mục tiêu và kết quả mong đợi giữ nguyên.
- **Hậu tố duy nhất trong Tên.** Tên sản phẩm mang hậu tố riêng của từng test để các test không đụng nhau. Ở case 3 và 4, hậu tố nằm trong tổng độ dài: tên vẫn dài đúng 255 và 256 ký tự.
- **FR15-DT-01.** Danh mục `Phụ kiện` (id 3) đã có trong dữ liệu HW02; HW04 bổ sung bước kiểm Danh mục được lưu. Bảng sản phẩm trên Web Admin không có cột Danh mục, nên bước này kiểm qua form Sửa hoặc qua API.

## 4. Test case không tự động hóa được trên web

| Case | Nội dung | Lý do |
| --- | --- | --- |
| FR15-DT-11, FR15-DT-23 | Thêm / Sửa với Giá không phải số (`abc`) | Ô Giá là `type="number"`: giao diện không nhận chuỗi chữ, và các browser xử lý ô số khác nhau nên kết quả không ổn định giữa ba browser |
| FR15-DT-12, FR15-DT-24 | Không có Danh mục | Ô Danh mục là danh sách chọn, luôn có sẵn một giá trị |
| FR15-DT-13, DT-14, DT-25, DT-26, BV-18, BV-20 | Danh mục ngoài danh sách hoặc không phải số | Danh sách chọn chỉ chứa các danh mục đang tồn tại |
| FR15-DT-27, DT-28, DT-31, DT-32, BV-21, BV-24, BV-25, BV-27 | Sửa / Xóa sản phẩm có id không tồn tại hoặc không phải số | Nút Sửa / Xóa chỉ có trên dòng sản phẩm đang tồn tại; giao diện không cho nhập id |
| FR15-DT-29, FR15-DT-33 | Sửa / Xóa sản phẩm vừa bị xóa | Cần hai phiên trình duyệt (một phiên giữ danh sách cũ); phức tạp và dễ flaky nên không làm |

Các case này đã được kiểm qua API ở HW02 (BUG-25, BUG-28, BUG-29).

## 5. Test case tự động hóa được nhưng không chọn

Các case web còn lại của HW02 lặp lại cùng lớp tương đương với 15 case trên: Tên dài 1, 2, 254 ký tự; Tên 255 / 256 ký tự có dấu; Giá −1, −0,01, 0,01; và các bản Sửa của cùng một lỗi (FR15-DT-18, DT-19, DT-21, DT-22, BV-09, BV-10, BV-16, BV-17).
