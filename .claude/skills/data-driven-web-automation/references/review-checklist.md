# Danh sách kiểm khi review script test

Tám mục dưới đây đến từ những lỗi đã gặp thật khi tự động hóa một feature CRUD trên trang quản trị. Mỗi mục có: vì sao quan trọng, cách kiểm, và lỗi đã gặp. Ở bước B6, đi qua từng mục và ghi đạt / chưa đạt kèm file và dòng.

`scripts/lint_suite.py` kiểm được phần cơ học của các mục dưới đây. Cột "Máy kiểm" cho biết phần nào; phần còn lại phải tự review.

| Mục | Máy kiểm (lint_suite) | Phải tự review |
| --- | --- | --- |
| 1. Expected theo đặc tả | Mỗi test case có `expected` | Expected có đúng với câu đặc tả không |
| 2. Assertion đỏ được khi SUT sai | Số kiểu assertion so với ngưỡng | Từng assertion có fail khi SUT làm sai không |
| 3. Giao diện lẫn server | Có tải lại trang trong test không | Mỗi case có đủ hai tầng không |
| 4. Không chờ cố định | `waitForTimeout`, `setTimeout`, `sleep`, `waitFor…().catch()`, timeout ghi số không có chú thích | Căn cứ của chú thích có thật không |
| 5. Dọn theo id trong fixture | Có fixture (`await use`) | Việc dọn có theo id và có trả SUT về như cũ không |
| 6. Kiểm môi trường | `globalSetup` được khai báo và có kiểm dịch vụ | Thử làm sai một địa chỉ để thấy nó dừng thật |
| 7. Tìm trên tracker | – | Toàn bộ |
| 8. Ảnh bằng chứng | Test có tự chụp / đính ảnh | Mở ảnh ra xem |

Ngoài tám mục, linter còn kiểm: giá trị test và giá trị riêng của dự án ghi cứng trong script, số test case so với `minTestCases`, đủ ba browser, annotation và tiêu đề report có "Run by", `test.only` / `test.fail`.

## 1. Kết quả mong đợi theo đặc tả

**Vì sao:** test mà expected được suy từ hành vi của SUT thì luôn xanh, kể cả khi SUT sai.

**Cách kiểm:**
- Mỗi `expected` trong file dữ liệu trỏ được tới một câu đặc tả trích nguyên văn.
- Điều gì đặc tả không quy định (thứ tự dòng, có alert hay không, định dạng hiển thị ngoài phạm vi feature) thì hoặc không assert, hoặc ghi rõ là lấy từ quan sát.
- Khi test đỏ, không ai sửa expected cho khớp SUT.

**Lỗi đã gặp:** bảng mong đợi nối dòng mới vào cuối, vì SUT hiện như vậy; đặc tả không nói gì về thứ tự. Sửa bằng cách so hai bảng sau khi sắp xếp, cộng một assertion "có đúng một dòng mang tên này".

## 2. Assertion phải đỏ được khi SUT sai

**Vì sao:** một assertion luôn đúng không kiểm gì cả. Câu hỏi cần đặt cho mỗi assertion: "nếu SUT làm sai đúng điều này, dòng này có fail không?"

**Cách kiểm:**
- Với mỗi assertion, nêu được một hành vi sai của SUT làm nó fail.
- Assertion về "bị chặn" phải dựa vào sự kiện xảy ra khi người dùng thao tác, không dựa vào trạng thái vốn đã đúng từ trước.
- Case accept kiểm phản hồi 2xx; case reject kiểm phản hồi ≥ 400 nếu có yêu cầu được gửi.

**Lỗi đã gặp:** case bỏ trống ô bắt buộc kiểm `validity.valueMissing === true`. Thuộc tính này đúng ngay khi ô rỗng, kể cả khi chưa bấm nút, nên không chứng minh form bị chặn. Sửa thành: ô đó nhận sự kiện `invalid`, form không bắn `submit`, không có yêu cầu ghi nào, form giữ nguyên giá trị. Dấu hiệu này được thử trên cả ba browser trước khi dùng.

## 3. Assert cả giao diện lẫn server

**Vì sao:** hai tầng có thể lệch nhau. Giao diện đúng mà server sai là mất dữ liệu; server đúng mà giao diện sai là người dùng thấy thông tin sai.

**Cách kiểm:**
- Mỗi case có assertion trên vùng hiển thị **và** trên dữ liệu đọc lại qua API.
- "Phần còn lại giữ nguyên" được kiểm bằng cách chụp toàn bộ trước và sau rồi so, ở cả hai tầng.
- Assert giao diện ngay sau thao tác, không tải lại trang; tải lại sẽ che lỗi hiển thị.
- Assertion giao diện dùng soft để các tầng sau vẫn được kiểm; assertion dữ liệu phía server dùng `expect` thường.

**Lỗi đã gặp:** sau khi sửa một bản ghi, bảng đổi tên mọi dòng và giữ giá cũ, trong khi dữ liệu phía server đúng. Chỉ assertion giao diện không tải lại trang mới bắt được.

## 4. Không chờ theo thời gian cố định, dưới bất kỳ hình thức nào

**Vì sao:** chờ cố định vừa chậm vừa flaky. Cấm tên một hàm là chưa đủ, vì cùng ý đó viết được theo cách khác.

**Cách kiểm:**
- Không có `waitForTimeout`, `setTimeout`, `sleep`.
- Không có `waitForResponse` / `waitForRequest` kèm timeout rồi `.catch(() => null)`: khi không có yêu cầu nào, nó ngủ đủ timeout.
- Biết "đã xong" bằng trạng thái quan sát được: số yêu cầu đang chờ trong trang về 0, phần tử đổi trạng thái.
- Rút ngắn timeout của assertion chỉ khi đã có căn cứ rằng trang ở trạng thái cuối, và ghi căn cứ đó trong code.
- Đo thời gian: test fail không được chậm hơn test pass nhiều lần.

**Lỗi đã gặp:** `SETTLE_MS = 3000` với `waitForResponse(...).catch`. Case không gửi yêu cầu luôn chờ đủ 3 giây, và mỗi test fail mất 16 giây vì ba assertion giao diện chờ hết 5 giây. Sau khi chuyển sang đếm yêu cầu đang chờ ngay trong trang, lượt chạy giảm từ 2,4 phút xuống 54 giây.

## 5. Dọn dữ liệu theo id, trong fixture

**Vì sao:** dữ liệu chỉ reset một lần mỗi lượt, nên test phải tự dọn. Dọn theo tên bỏ sót bản ghi có tên rỗng hoặc chỉ gồm khoảng trắng, chính là thứ các case negative tạo ra khi SUT có bug.

**Cách kiểm:**
- Fixture chụp tập id trước test và xóa mọi id mới sau `use()`, nên vẫn chạy khi test fail.
- Sau một lượt chạy có test fail, dữ liệu SUT trở lại đúng như trước lượt chạy.
- Assertion không dựa vào số lượng tuyệt đối; so với bản chụp trước thao tác.

## 6. Kiểm môi trường trước khi chạy

**Vì sao:** khi một dịch vụ không chạy, mọi test đỏ vì môi trường. Report đỏ đó trông giống hệt report đỏ vì bug.

**Cách kiểm:**
- `global-setup` gọi thử mọi dịch vụ và dừng ngay với thông báo nêu tên dịch vụ và lệnh bật.
- Thử một lần với một dịch vụ bị trỏ sai địa chỉ để thấy nó dừng thật.

**Lỗi đã gặp:** ở một lượt chính thức, hai frontend không chạy, cả 15 test fail, và chỉ phát hiện khi đọc report sau lượt chạy.

## 7. Tìm trên tracker trước khi gọi là bug mới

**Vì sao:** gọi một bug đã có là "mới" làm sai nhãn trong dữ liệu, trong report và trong bug report, và có thể sinh issue trùng.

**Cách kiểm:**
- Trước khi gắn nhãn bug mới, tìm trên `bugTracker` bằng mã feature, tên thao tác và triệu chứng; xem cả issue đã đóng và issue của người khác.
- Ghi cả mã bug lẫn số issue; hai số này có thể khác nhau.

**Lỗi đã gặp:** một lỗi hiển thị được gắn nhãn "bug mới" vì chỉ được đối chiếu với danh sách bug của chính người làm. Trên tracker chung đã có issue cho nó từ một tuần trước.

## 8. Chụp riêng vùng chứa bằng chứng, và mở ảnh ra xem

**Vì sao:** ảnh tự động lúc fail chỉ chụp khung nhìn. Nếu vùng lỗi nằm ngoài khung nhìn, report có ảnh nhưng ảnh không cho thấy lỗi.

**Cách kiểm:**
- Test chụp riêng phần tử chứa kết quả (bảng, form) ngay sau thao tác và đính vào report.
- Chụp cả trang không giải quyết được nếu trang cuộn bên trong một khung cố định.
- Sau lượt chạy, mở ít nhất một ảnh ở mỗi report và nhìn tận mắt. Kiểm report qua tiêu đề và số pass / fail là chưa đủ.

**Lỗi đã gặp:** ở 4 / 5 bug, ảnh trong report chỉ thấy form trống và dòng đầu bảng. Không ai mở ảnh cho tới lúc cần đính vào issue.
