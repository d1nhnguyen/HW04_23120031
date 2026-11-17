# FR-01 Đăng ký tài khoản – test case chọn để tự động hóa (B1)

Phạm vi: Web khách hàng `http://localhost:5173/register`. Test case lấy từ HW02 (`scripts/fr01/cases.json`), giữ nguyên ID; hai case `FR01-WA-*` là case bổ sung ở HW04. Kết quả mong đợi lấy từ đặc tả (README của SUT), không lấy từ hành vi thực tế của SUT.

## 1. Câu đặc tả dùng làm kết quả mong đợi

| Mã | Nguồn | Nguyên văn |
| --- | --- | --- |
| S1 | FR-01 | "Người dùng phải cung cấp: **Họ Tên**, **Email**, **Mật khẩu**." |
| S2 | FR-01 | "Email phải có định dạng hợp lệ (`user@domain.com`) và là duy nhất trong hệ thống." |
| S3 | FR-01 | "**Yêu cầu mật khẩu mạnh**: Tối thiểu 8 ký tự, có ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt (`@`, `$`, `!`, `%`, `*`, `?`, `&`)." |
| S4 | FR-01 | "Phải có trường **Xác nhận mật khẩu** — hệ thống từ chối nếu hai trường không khớp." |
| S5 | FR-01 | "Sau khi đăng ký thành công, người dùng được chuyển tới trang Đăng nhập." |

## 2. 17 test case được chọn

Mặc định: Họ Tên `Nguyen Van A`, Mật khẩu `Abcdef1@`, Email duy nhất do script sinh. Cột "Dữ liệu chính" chỉ ghi chỗ khác mặc định. Cột "Web ở HW02" là kết quả trên Chrome ngày 2026-10-20, chỉ để tham khảo.

| # | ID | Mục tiêu | Dữ liệu chính | Kết quả mong đợi theo đặc tả | Web ở HW02 | Lý do chọn |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | FR01-DT-01 | Đăng ký hợp lệ điển hình | Mật khẩu đúng 8 ký tự | S1, S2, S3, S5: tạo tài khoản, chuyển tới trang Đăng nhập, đăng nhập được | Fail (BUG-15) | Luồng chính; biên hợp lệ của độ dài Mật khẩu |
| 2 | FR01-BV-04 | Mật khẩu 9 ký tự | `Abcdefg1@` | S3, S5: thành công | Fail (BUG-15) | Biên + 1 phía hợp lệ |
| 3 | FR01-BV-14 | Họ Tên 1 ký tự | Họ Tên `A` | S1, S5: thành công | Blocked (BUG-15) | Biên hợp lệ của "phải cung cấp Họ Tên" |
| 4 | FR01-DT-08 | Bỏ trống Họ Tên | Họ Tên rỗng | S1: từ chối vì Họ Tên, không tạo tài khoản | Pass | Cặp biên với case 3 |
| 5 | FR01-DT-10 | Bỏ trống Email | Email rỗng | S1: từ chối vì Email | Pass | Ô bắt buộc thứ hai |
| 6 | FR01-DT-19 | Bỏ trống Mật khẩu | Mật khẩu rỗng | S1: từ chối vì Mật khẩu | Pass | Ô bắt buộc thứ ba |
| 7 | FR01-DT-11 | Email thiếu `@` | `fr01.dt11…example.com` | S2: từ chối vì Email | Blocked (BUG-15) | Đại diện sai định dạng email |
| 8 | FR01-DT-17 | Email đã tồn tại | Email của một tài khoản tạo ở setup, Mật khẩu `Newpass1@` | S2: từ chối vì trùng, không thêm tài khoản, tài khoản có sẵn vẫn đăng nhập được | Blocked (BUG-15) | Ràng buộc "duy nhất" |
| 9 | FR01-BV-03 | Mật khẩu 7 ký tự, đủ 4 loại | `Abcde1@` | S3: từ chối vì Mật khẩu | Pass | Cặp biên với case 1 |
| 10 | FR01-DT-21 | Không có chữ hoa | `abcdef1@` | S3: từ chối vì Mật khẩu | Pass | Từng điều kiện của S3 |
| 11 | FR01-DT-22 | Không có chữ thường | `ABCDEF1@` | S3: từ chối vì Mật khẩu | Pass | nt |
| 12 | FR01-DT-23 | Không có chữ số | `Abcdefg@` | S3: từ chối vì Mật khẩu | Pass | nt |
| 13 | FR01-DT-24 | Không có ký tự đặc biệt | `Abcdefg1` | S3: từ chối vì Mật khẩu | Pass | nt |
| 14 | FR01-DT-29 | Ký tự "đặc biệt" duy nhất là dấu cách | `Abcdef1␣` | S3: từ chối vì Mật khẩu (dấu cách không thuộc tập S3 liệt kê) | Fail (BUG-15) | Ký tự ngoài tập mà SUT nhận |
| 15 | FR01-DT-27 | Xác nhận mật khẩu khác Mật khẩu | Xác nhận `Abcdef2@` | S4: có ô Xác nhận mật khẩu; từ chối vì không khớp | Fail (BUG-16) | Ràng buộc S4 |
| 16 | FR01-WA-11 | Biến thể của case 7 với mật khẩu form hiện đang nhận | Email `fr01.wa11…example.com`, Mật khẩu `Abcdef1␣` | S2: từ chối, không tạo tài khoản | (lượt khảo sát: tạo tài khoản) | Case 7 bị BUG-15 che |
| 17 | FR01-WA-17 | Biến thể của case 8 với mật khẩu form hiện đang nhận | Email của tài khoản tạo ở setup, Mật khẩu `Newpass1␣` | S2: từ chối, không tạo tài khoản, tài khoản có sẵn vẫn đăng nhập được | (lượt khảo sát: tạo tài khoản) | Case 8 bị BUG-15 che |

| Phân loại | Số case | Case |
| --- | --- | --- |
| Positive | 3 | 1, 2, 3 |
| Negative | 14 | 4–17 |
| Giá trị biên | 5 | 1, 2, 9 (độ dài Mật khẩu 8 / 9 / 7); 3, 4 (Họ Tên 1 / 0 ký tự) |
| Dựa vào S1 | 5 | 1, 3, 4, 5, 6 |
| Dựa vào S2 | 5 | 1, 7, 8, 16, 17 |
| Dựa vào S3 | 8 | 1, 2, 9, 10, 11, 12, 13, 14 |
| Dựa vào S4 | 1 | 15 |
| Dựa vào S5 | 3 | 1, 2, 3 |

Feature chỉ có một thao tác (Đăng ký); cả 17 case dùng thao tác này.

## 3. Khác biệt so với HW02

- **Lý do từ chối.** Case reject kiểm cả lý do từ chối thuộc về ô nào. Đặc tả không quy định câu chữ thông báo, nên cách nhận diện (sự kiện `invalid` của trình duyệt trên đúng ô, hoặc từ khóa trong thông báo lỗi) là **giả định** (A7 của HW02), ghi trong `data/fr01.register.json`, mục `assumptions`.
- **FR01-DT-17.** HW02 đăng ký trùng với tài khoản seed `test@eshop.com`. Ở HW04 mọi test sau đó phụ thuộc tài khoản seed, nên case tự tạo một tài khoản qua API ở setup rồi đăng ký trùng với nó.
- **FR01-WA-11, FR01-WA-17 (case bổ sung).** BUG-15 làm form từ chối mọi mật khẩu hợp lệ trước khi email được kiểm, nên case 7 và 8 đỏ vì mật khẩu chứ không vì email. Hai biến thể dùng mật khẩu mà form hiện đang nhận (ký tự đặc biệt là dấu cách, theo quan sát ở B2). Giới hạn:
  - Mật khẩu đó không hợp lệ theo S3, nên một hệ thống đúng có thể từ chối vì mật khẩu. Hai case không assert lý do từ chối.
  - Case đỏ chứng minh SUT đã nhận lượt đăng ký vi phạm S2. Case xanh không chứng minh email được kiểm.
  - Khi BUG-15 được sửa, hai case này hết tác dụng; case 7 và 8 thay thế chúng.
- **Hậu tố duy nhất trong Email.** Dữ liệu chỉ reset một lần mỗi lượt feature × browser, nên email mang hậu tố riêng của từng test.

## 4. Test case không tự động hóa được trên web

| Case | Nội dung | Lý do |
| --- | --- | --- |
| FR01-DT-26, DT-28, BV-20, BV-21 | Các biến thể của Xác nhận mật khẩu (bỏ trống, khác hoa / thường, thiếu / thừa 1 ký tự) | Form không có ô Xác nhận mật khẩu (BUG-16). Không có ô thì không nhập được giá trị để phân biệt các biến thể; cả bốn sẽ dừng ở cùng một assertion với FR01-DT-27 |
| Phần "API trả 200 / 4xx" của mọi case | Mã phản hồi khi gọi thẳng API | Thuộc kênh API, đã kiểm ở HW02; suite này chạy trên giao diện |

## 5. Test case tự động hóa được nhưng không chọn

Ô Email của form là `type="text"` (BUG-21, issue #21 và #111), nên trình duyệt không can thiệp vào giá trị email. Ba case dưới đây vì vậy tự động hóa được; chúng không được chọn vì expected dựa trên giả định của HW02, không dựa trên câu đặc tả:

| Case | Nội dung | Lý do không chọn |
| --- | --- | --- |
| FR01-DT-14 | Tên miền của Email không có dấu `.` | Expected "từ chối" dựa trên giả định A2. S2 chỉ cho một ví dụ `user@domain.com` |
| FR01-DT-02 | Email có khoảng trắng đầu / cuối được lưu sau khi bỏ khoảng trắng | Expected dựa trên giả định A4 |
| FR01-BV-19 | Email đã tồn tại có 1 khoảng trắng ở đầu | Giả định A4; dùng tài khoản seed; bị BUG-15 che giống FR01-DT-17 |

Các case khác không chọn:

- FR01-DT-09, DT-18, DT-30, DT-31, DT-32, BV-05, BV-16, BV-18: expected dựa trên giả định A3, A4, A5, A10 của HW02.
- FR01-DT-03…07, DT-12, DT-13, DT-15, DT-16, DT-20, DT-25, BV-01, BV-02, BV-06…13, BV-15, BV-17: cùng lớp tương đương với case đã chọn.
