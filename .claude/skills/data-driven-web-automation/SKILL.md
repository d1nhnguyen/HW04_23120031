---
name: data-driven-web-automation
description: Generate and maintain data-driven, multi-browser Playwright test scripts for ONE web feature of a system under test, step by step, with a human approval stop after every step and no automatic commits. Steps - pick test cases from the specification, survey the live page to build a locator table, create the JSON data file, generate the Page Object and spec, trial-run on one browser, review against a fixed checklist, run on three browsers (Chromium / Firefox / WebKit), classify failing tests (SUT bug vs script fault). Use this skill whenever the user asks to automate test cases for a feature, "tự động hóa test case", "viết script Playwright", "sinh script automation", "data-driven test", "chạy đa browser", or wants an existing automated suite reviewed, fixed or extended, even if they do not name Playwright. Not for writing reports, bug reports, audit logs or packaging a submission.
---

# Sinh và bảo trì script test data-driven, đa browser cho một feature web

Skill dẫn qua 9 bước cho **một feature**. Phạm vi chỉ là script test: test case được chọn, bảng locator, file dữ liệu, Page Object, spec, kết quả chạy và phân loại test fail. Viết báo cáo, bug report, nhật ký AI và đóng gói bài nộp nằm ngoài skill này.

## Ba quy tắc xuyên suốt

1. **Dừng sau mỗi bước.** Cuối mỗi bước, in phần "Điểm dừng" của bước đó rồi chờ người dùng duyệt. Không làm gộp hai bước. Người dùng chịu trách nhiệm về script; họ chỉ kiểm soát được nếu được xem từng bước một.
2. **Không tự commit, không push, không đăng gì ra ngoài** (issue, bình luận). Ở điểm dừng, nêu file đã đổi và gợi ý thông điệp commit; người dùng quyết định.
3. **Kết quả mong đợi lấy từ đặc tả, không lấy từ hành vi của SUT.** Khi một test đỏ, không sửa expected cho xanh. Sửa script nếu script sai; giữ nguyên nếu SUT sai.

## Tham số của dự án

Mọi giá trị riêng của dự án là tham số. Không ghi cứng vào Page Object, spec hay skill.

| Tham số | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| `runBy` | Mã người chạy, hiện ở tiêu đề report và annotation | `<mã sinh viên>` |
| `sut.dir` | Thư mục SUT trên máy | `<đường dẫn>` |
| `sut.resetCommand` | Lệnh đưa dữ liệu về seed | `scripts/sut.sh reset` |
| `sut.services` | Các dịch vụ phải phản hồi trước khi chạy; mỗi dịch vụ tham chiếu một khóa trong `urls` để địa chỉ chỉ ghi ở một nơi | tên + khóa `urls` + đường dẫn kiểm |
| `urls` | URL của API và từng giao diện | `api`, `admin`, `web` |
| `accounts` | Tài khoản test theo vai trò | `admin`, `user` |
| `bugTracker` | Repo chứa issue của SUT | `<owner>/<repo>` |
| `spec` | File đặc tả và mục của feature | `README.md`, mục FR-xx |
| `minAssertionKinds` | Số kiểu assertion khác nhau tối thiểu mà suite của một feature phải dùng | `3` |

Tham số nằm trong `automation.config.json` ở gốc dự án; biến môi trường cùng tên ghi đè. Nếu file chưa có hoặc thiếu giá trị, **hỏi người dùng**, không đoán.

## Cấu trúc dự án mà skill tạo ra và dùng lại

```
automation.config.json      tham số của dự án
playwright.config.ts        3 project (chromium, firefox, webkit), 1 worker, report theo REPORT_DIR
global-setup.ts             reset một lần + kiểm tra môi trường
support/                    DÙNG CHUNG: đọc tham số, gọi API có đăng nhập, bộ ghi dấu vết trong trang
pages/                      Page Object; phần đăng nhập / điều hướng dùng chung tách khỏi trang của feature
data/<feature>.<tên>.json   toàn bộ giá trị test của feature
tests/<feature>/*.spec.ts   một vòng for...of sinh test từ file dữ liệu
raw/<feature>/              bản thô đầu tiên của mỗi lần sinh code
```

Trước khi sinh code cho feature mới, **đọc `support/` và `pages/` đang có và dùng lại**. Chỉ viết mới phần riêng của feature. Nếu một đoạn sắp được viết lần thứ hai (đăng nhập, gọi API, chờ trang ổn định), tách nó ra phần dùng chung trước, và nêu việc tách đó ở điểm dừng.

## Các bước

### B0 · Tham số và môi trường

- Đọc `automation.config.json`; hỏi những giá trị còn thiếu.
- Kiểm tra SUT đang chạy (mọi `sut.services` phản hồi, đăng nhập được bằng từng tài khoản).
- Kiểm tra dự án đã có Playwright Test, ba browser và bước kiểm kiểu (`tsc --noEmit`).

**Điểm dừng:** bảng tham số đang dùng, trạng thái từng dịch vụ, thứ còn thiếu.

### B1 · Chọn test case theo đặc tả

- Trích **nguyên văn** các câu đặc tả của feature và đánh mã (S1, S2…). Rà đủ mọi ràng buộc trong mục đặc tả, không chỉ những ràng buộc người dùng lấy làm ví dụ.
- Nếu đã có bộ test case thiết kế trước, chọn từ đó và giữ nguyên ID. Nếu chưa, đề xuất test case mới.
- Chọn cho đủ: positive, negative, giá trị biên theo cặp (biên hợp lệ và biên + 1), và mọi thao tác của feature.
- Mỗi case ghi: ID, thao tác, mục tiêu, dữ liệu chính, kết quả mong đợi **kèm mã câu đặc tả**, lý do chọn.
- Lập riêng danh sách case **không tự động hóa được trên giao diện** kèm lý do. Case mà kết quả phụ thuộc cách từng browser xử lý ô nhập thì xếp vào đây thay vì cố làm.
- Đếm lại các con số tóm tắt từ chính bảng vừa lập trước khi viết ra.

**Điểm dừng:** bảng test case, bảng phân bố, danh sách không tự động hóa được.

### B2 · Khảo sát trang thật, lập bảng locator

- Mở trang thật bằng trình duyệt (Playwright MCP hoặc `npx playwright codegen`). Đối chiếu với mã giao diện nếu được phép đọc.
- Mỗi phần tử một dòng: phần tử, locator, vì sao bền, rủi ro. Ưu tiên role, label, placeholder, test-id; nút lặp theo dòng thì khoanh vùng theo dòng trước.
- **Thực hiện thử từng thao tác** của feature một lần và ghi: thao tác nào bật `alert()` / `confirm()` và nguyên văn; thao tác nào thành công mà **không** có thông báo; ô nào có kiểm tra bắt buộc của trình duyệt.
- Ghi mọi hành vi lạ thấy được (ví dụ giao diện hiển thị khác dữ liệu phía server). Chưa gọi nó là bug mới; việc đó thuộc B8.
- **Không thử thao tác có thể khóa hoặc làm hỏng tài khoản dùng chung** trong `accounts`: đăng nhập sai nhiều lần (SUT có thể khóa tài khoản), đổi mật khẩu, đổi vai trò, xóa tài khoản. Mọi test sau đó đều phụ thuộc các tài khoản này. Cần thử những thao tác đó thì tạo một tài khoản tạm, thử trên nó, rồi xóa. Nếu không tạo được tài khoản tạm, dừng lại hỏi người dùng thay vì thử trên tài khoản dùng chung.
- Trả SUT về trạng thái ban đầu sau khi thử, và nêu ở điểm dừng mọi thứ đã thay đổi mà không hoàn lại được.

**Điểm dừng:** bảng locator, bảng thông báo theo thao tác, danh sách hành vi lạ.

### B3 · Tạo file dữ liệu

- Một file `data/<feature>.<tên>.json`, mỗi test case một dòng: `id`, `title`, thao tác, `bug` (danh sách mã bug mà case được kỳ vọng làm lộ ra; rỗng nếu kỳ vọng pass), `input`, `setup` (dữ liệu phải tạo trước qua API), `expected`.
- `expected` mô tả **cả hai tầng**: giao diện (thay đổi trên vùng hiển thị, phần còn lại giữ nguyên) và server (dữ liệu sau thao tác, phần còn lại giữ nguyên), cùng thông báo nếu đặc tả quy định.
- Giá trị phải duy nhất giữa các test (tên, email) mang hậu tố do script sinh. Với case biên độ dài, ghi dạng `{"length": N}` và hậu tố nằm **trong** tổng độ dài.
- Điều gì lấy từ quan sát ở B2 chứ không từ đặc tả (ví dụ có alert hay không) thì ghi rõ là quan sát.
- Không để giá trị test nào trong script. Tài khoản và URL thuộc tham số dự án, không thuộc file này.

**Điểm dừng:** file dữ liệu, bảng tóm tắt (ID, thao tác, kỳ vọng, bug), các điểm tự quyết cần người dùng xem.

### B4 · Sinh Page Object và spec

- Page Object theo bảng locator B2; test không chứa selector.
- Spec đọc file dữ liệu, một vòng `for...of`, thân test tách thành `arrange`, `act`, `assertUi`, `assertServer`.
- Viết theo `references/review-checklist.md` ngay từ đầu, không đợi tới bước review.
- Gắn annotation "Run by" và từng mã bug vào mỗi test. Không dùng `test.fail()` để đảo màu test được kỳ vọng fail.
- Lưu nguyên văn bản vừa sinh vào `raw/<feature>/` trước khi sửa bất cứ gì.
- Kiểm bằng `tsc --noEmit` và `npx playwright test --list`. **Chưa chạy test.**
- Tự nêu các điểm yếu đã biết của bản này.

- Lập bảng **kiểu assertion × test**: mỗi dòng một kiểu (điều hướng, nội dung / hiển thị, số lượng, giá trị ô nhập, trạng thái phần tử, hộp thoại, phản hồi mạng, dữ liệu phía server…), ghi matcher dùng, nó kiểm điều gì và dùng ở những test case nào. Hai matcher kiểm cùng một loại sự việc tính là một kiểu. Nếu số kiểu thấp hơn `minAssertionKinds`, nêu rõ là chưa đạt và đề xuất kiểu còn thiếu; không thêm assertion vô nghĩa chỉ để đủ số.

**Điểm dừng:** danh sách file, bảng kiểu assertion × test (kèm số kiểu so với `minAssertionKinds`), cách đáp ứng từng mục của danh sách kiểm, điểm yếu đã biết.

### B5 · Chạy thử trên một browser

- Chạy trên Chromium, không đặt `REPORT_DIR` (report tạm, có trace để gỡ lỗi).
- Lập bảng: test case, kết quả, thời gian, lý do fail.
- Với mỗi test fail, đọc danh sách assertion fail và kết luận sơ bộ: do SUT hay do script. Kiểm dữ liệu SUT sau lượt chạy đã về như trước chưa.

**Điểm dừng:** bảng kết quả, nhận định từng test fail, thời gian cả lượt.

### B6 · Review theo danh sách kiểm

- Đi qua **từng mục** của `references/review-checklist.md` trên code hiện có. Mỗi mục ghi: đạt hay chưa, bằng chứng (file và dòng), đề xuất sửa.
- Người dùng cũng review và nêu điểm họ thấy. Sửa theo từng nhóm (assertion, chờ, dễ đọc…), mỗi nhóm một lần dừng, để mỗi nhóm thành một commit riêng nếu người dùng muốn.
- Sau mỗi nhóm sửa: `tsc --noEmit`, chạy lại Chromium, báo kết quả và thời gian trước / sau.
- Với mỗi lỗi, ghi lại bản thô viết gì và vì sao viết như vậy; người dùng cần thông tin này để tự phân tích.

**Điểm dừng (mỗi nhóm):** diff tóm tắt, kết quả chạy lại, gợi ý thông điệp commit.

### B7 · Chạy đủ ba browser

- Chạy Chromium, Firefox, WebKit, mỗi lượt một `REPORT_DIR` trong **thư mục tạm**. Đây là lượt gỡ lỗi.
- Lập bảng test case × 3 browser. So cả **bộ assertion fail** của từng case giữa các browser, không chỉ so pass / fail.
- Case lệch giữa các browser: tìm nguyên nhân gốc trước khi sửa. Không thêm retry, không nới timeout khi chưa có bằng chứng.
- Chạy các case kỳ vọng pass với `--repeat-each=5` trên hai browser chậm nhất để dò flaky.
- Lượt chính thức (report nằm trong dự án) do **người dùng tự chạy**; skill chỉ đưa lệnh.

**Điểm dừng:** bảng ba browser, kết quả lặp lại, lệnh cho lượt chính thức.

### B8 · Phân loại test fail

Với mỗi test fail, xếp vào đúng một loại và nêu bằng chứng:

| Loại | Dấu hiệu | Việc làm |
| --- | --- | --- |
| Bug của SUT, đã có issue | Tìm thấy issue khớp trên `bugTracker` | Ghi mã bug vào trường `bug` của case |
| Bug của SUT, chưa có issue | Đã tìm trên `bugTracker` và không thấy | Soạn mô tả bug cho người dùng; không tự tạo issue |
| Lỗi script | Assertion sai, locator sai, chờ sai | Quay lại B6 |
| Lỗi môi trường | Dịch vụ không chạy, dữ liệu bẩn | Sửa môi trường, chạy lại |

- **Tìm trên tracker trước khi gọi là bug mới**, bằng nhiều từ khóa (mã feature, tên thao tác, triệu chứng). Mã bug trong tiêu đề issue có thể khác số issue; ghi cả hai.
- Mỗi test fail phải có ảnh cho thấy lỗi. Mở ảnh ra xem trước khi coi nó là bằng chứng.

**Điểm dừng:** bảng test fail → loại → bug / issue → ảnh bằng chứng; danh sách việc người dùng phải tự làm.

## Bảo trì script đã có

Khi giao diện hoặc đặc tả đổi, hoặc cần thêm test case:

- Giao diện đổi: làm lại B2 cho phần đổi, sửa Page Object, rồi B5 → B7. Không sửa spec nếu chỉ locator đổi.
- Thêm test case: thêm dòng vào file dữ liệu (B3). Chỉ sửa spec nếu case cần một kiểu kiểm chưa có.
- Đặc tả đổi: làm lại B1 cho câu đặc tả đổi, cập nhật `expected` trong file dữ liệu.
- Mọi thay đổi đều qua B6 và B7 trước khi coi là xong.

## Tài liệu kèm theo

- `references/review-checklist.md`: 8 mục kiểm khi review, mỗi mục có lý do, cách kiểm và ví dụ lỗi đã gặp thật. Đọc ở B4 và B6.
