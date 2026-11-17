---
name: data-driven-web-automation
description: Generate, maintain and review data-driven, multi-browser Playwright test scripts for ONE web feature of a system under test. Three modes - generate a new suite from the specification; maintain an existing suite when the UI, the specification or the test cases change; review an existing suite (written by a person or an AI) against a fixed checklist. Workflow - pick test cases from the specification, survey the live page to build a locator table, create the JSON data file, generate the Page Object and spec, lint, trial-run on one browser, review, run on three browsers (Chromium / Firefox / WebKit), classify failing tests (SUT bug vs script fault). Three mandatory human approval stops, never commits by itself. Use this skill whenever the user asks to automate test cases for a feature, "tự động hóa test case", "viết script Playwright", "sinh script automation", "data-driven test", "chạy đa browser", "review script test", "sửa / bảo trì script test", or hands over an existing spec file and asks whether it is good, even if they do not name Playwright. Not for writing reports, bug reports, audit logs or packaging a submission.
---

# Sinh, bảo trì và review script test data-driven, đa browser cho một feature web

Skill làm việc trên **một feature** mỗi lần. Phạm vi chỉ là script test: test case được chọn, bảng locator, file dữ liệu, Page Object, spec, kết quả chạy và phân loại test fail. Viết báo cáo, bug report, nhật ký AI và đóng gói bài nộp nằm ngoài skill này.

Mọi giá trị test đi qua **một file dữ liệu** (`data/<feature>.<tên>.json`); spec chỉ chứa logic. Hai script đi kèm làm phần việc máy làm tốt hơn người: `scripts/lint_suite.py` kiểm cơ học các mục của danh sách kiểm, `scripts/run_matrix.py` chạy ba browser và so kết quả. Đọc `references/review-checklist.md` trước khi sinh code: nó là tám lỗi đã gặp thật, mỗi lỗi có lý do và cách kiểm.

## Ba quy tắc xuyên suốt

1. **Ba điểm dừng bắt buộc: sau B1, sau B3 và ở B6.** Ở mỗi điểm, in phần "Điểm dừng" rồi chờ người dùng duyệt. Các bước còn lại chạy liền và báo kết quả ở điểm dừng kế tiếp. Ba điểm này được chọn vì đó là nơi sai lầm đắt nhất: chọn sai test case, sai kết quả mong đợi trong dữ liệu, và sửa script theo hướng làm test xanh.
2. **Không tự commit, không push, không đăng gì ra ngoài** (issue, bình luận). Ở điểm dừng, nêu file đã đổi và gợi ý thông điệp commit; người dùng quyết định.
3. **Kết quả mong đợi lấy từ đặc tả, không lấy từ hành vi của SUT.** Khi một test đỏ, không sửa expected cho xanh. Sửa script nếu script sai; giữ nguyên nếu SUT sai.

## Tham số của dự án

Mọi giá trị riêng của dự án là tham số trong `automation.config.json` ở gốc dự án. Không ghi cứng vào Page Object, spec hay skill. Thiếu giá trị thì **hỏi người dùng**, không đoán.

| Tham số | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| `runBy` | Mã người chạy, hiện ở tiêu đề report và annotation | `<mã sinh viên>` |
| `minTestCases` | Số test case tối thiểu của một feature | `12` |
| `minAssertionKinds` | Số kiểu assertion khác nhau tối thiểu của một feature | `3` |
| `spec` | File đặc tả và mục của feature | `README.md`, mục FR-xx |
| `sut.dir` | Thư mục SUT trên máy | `<đường dẫn>` |
| `sut.resetCommand` | Lệnh đưa dữ liệu về seed | `scripts/sut.sh reset` |
| `sut.services` | Các dịch vụ phải phản hồi trước khi chạy; mỗi dịch vụ tham chiếu một khóa trong `urls` để địa chỉ chỉ ghi ở một nơi | tên + khóa `urls` + đường dẫn kiểm |
| `urls` | URL của API và từng giao diện | `api`, `admin`, `web` |
| `accounts` | Tài khoản test theo vai trò | `admin`, `user` |
| `bugTracker` | Repo chứa issue của SUT | `<owner>/<repo>` |

## Cấu trúc dự án mà skill tạo ra và dùng lại

```
automation.config.json      tham số của dự án
playwright.config.ts        3 project, 1 worker, report theo REPORT_DIR, reporter json khi có JSON_REPORT
global-setup.ts             reset một lần + kiểm tra môi trường
support/                    DÙNG CHUNG: đọc tham số, gọi API có đăng nhập, bộ ghi dấu vết trong trang
pages/                      Page Object; phần đăng nhập / điều hướng dùng chung tách khỏi trang của feature
data/<feature>.<tên>.json   toàn bộ giá trị test của feature
tests/<feature>/*.spec.ts   một vòng for...of sinh test từ file dữ liệu
raw/<feature>/              bản thô đầu tiên của mỗi lần sinh code
```

Trước khi sinh code cho feature mới, **đọc `support/` và `pages/` đang có và dùng lại**. Chỉ viết mới phần riêng của feature. Đoạn nào sắp được viết lần thứ hai (đăng nhập, gọi API, chờ trang ổn định) thì tách ra phần dùng chung trước.

## B0 · Xác định chế độ, tham số và môi trường

| Người dùng đưa… | Chế độ | Bước chạy | Điểm dừng áp dụng |
| --- | --- | --- | --- |
| đặc tả / tên feature chưa có script | **Sinh mới** | B1 → B8 | sau B1, sau B3, ở B6 |
| script đang có + thay đổi (giao diện đổi, đặc tả đổi, thêm test case) | **Bảo trì** | chỉ các bước bị ảnh hưởng (bảng dưới), rồi B5 → B8 | sau B1 nếu bộ test case đổi; sau B3 nếu file dữ liệu đổi; ở B6 luôn có |
| script có sẵn (người hoặc AI viết) + "review / chấm / kiểm tra" | **Review** | lint → B5 → B6, rồi B7 → B8 nếu người dùng muốn | ở B6; **không sửa dòng code nào trước điểm dừng này** |

Chế độ Bảo trì, bước phải làm lại:

| Thay đổi | Làm lại |
| --- | --- |
| Giao diện đổi | B2 cho phần đổi, sửa Page Object; không sửa spec nếu chỉ locator đổi |
| Thêm / bớt test case | B1 cho case mới, B3; chỉ sửa spec nếu case cần một kiểu kiểm chưa có |
| Đặc tả đổi | B1 cho câu đặc tả đổi, cập nhật `expected` ở B3 |

Sau khi xác định chế độ:

- Đọc `automation.config.json`; hỏi những giá trị còn thiếu.
- Kiểm tra SUT đang chạy (mọi `sut.services` phản hồi, đăng nhập được bằng từng tài khoản).
- Kiểm tra dự án đã có Playwright Test, ba browser và bước kiểm kiểu (`tsc --noEmit`).

Không có điểm dừng riêng; báo chế độ, tham số và trạng thái môi trường ở điểm dừng kế tiếp. Nếu môi trường chưa sẵn sàng hoặc thiếu tham số thì dừng ngay để hỏi.

## B1 · Chọn test case theo đặc tả

- Trích **nguyên văn** các câu đặc tả của feature và đánh mã (S1, S2…). Rà đủ mọi ràng buộc trong mục đặc tả, không chỉ những ràng buộc người dùng lấy làm ví dụ.
- Nếu đã có bộ test case thiết kế trước, chọn từ đó và giữ nguyên ID. Nếu chưa, đề xuất test case mới.
- Chọn cho đủ `minTestCases`, gồm positive, negative, giá trị biên theo cặp (biên hợp lệ và biên + 1), và mọi thao tác của feature.
- Mỗi case ghi: ID, thao tác, mục tiêu, dữ liệu chính, kết quả mong đợi **kèm mã câu đặc tả**, lý do chọn.
- Lập riêng danh sách case **không tự động hóa được trên giao diện** kèm lý do. Case mà kết quả phụ thuộc cách từng browser xử lý ô nhập thì xếp vào đây thay vì cố làm.
- Đếm lại các con số tóm tắt từ chính bảng vừa lập trước khi viết ra.

**ĐIỂM DỪNG 1:** chế độ, tham số và trạng thái môi trường (từ B0); bảng test case; bảng phân bố; danh sách không tự động hóa được.

## B2 · Khảo sát trang thật, lập bảng locator

- Mở trang thật bằng trình duyệt (Playwright MCP hoặc `npx playwright codegen`). Đối chiếu với mã giao diện nếu được phép đọc.
- Mỗi phần tử một dòng: phần tử, locator, vì sao bền, rủi ro. Ưu tiên role, label, placeholder, test-id; nút lặp theo dòng thì khoanh vùng theo dòng trước.
- **Thực hiện thử từng thao tác** của feature một lần và ghi: thao tác nào bật `alert()` / `confirm()` và nguyên văn; thao tác nào thành công mà **không** có thông báo; ô nào có kiểm tra bắt buộc của trình duyệt.
- Ghi mọi hành vi lạ thấy được (ví dụ giao diện hiển thị khác dữ liệu phía server). Chưa gọi nó là bug mới; việc đó thuộc B8.
- **Không thử thao tác có thể khóa hoặc làm hỏng tài khoản dùng chung** trong `accounts`: đăng nhập sai nhiều lần (SUT có thể khóa tài khoản), đổi mật khẩu, đổi vai trò, xóa tài khoản. Mọi test sau đó đều phụ thuộc các tài khoản này. Cần thử những thao tác đó thì tạo một tài khoản tạm, thử trên nó, rồi xóa. Nếu không tạo được tài khoản tạm, dừng lại hỏi người dùng thay vì thử trên tài khoản dùng chung.
- Trả SUT về trạng thái ban đầu sau khi thử, và ghi lại mọi thứ đã thay đổi mà không hoàn lại được.

Chạy liền sang B3; bảng locator được báo ở điểm dừng 2.

## B3 · Tạo file dữ liệu

- Một file `data/<feature>.<tên>.json`, mỗi test case một dòng: `id`, `title`, thao tác, `bug` (danh sách mã bug mà case được kỳ vọng làm lộ ra; rỗng nếu kỳ vọng pass), `input`, `setup` (dữ liệu phải tạo trước qua API), `expected`.
- `expected` mô tả **cả hai tầng**: giao diện (thay đổi trên vùng hiển thị, phần còn lại giữ nguyên) và server (dữ liệu sau thao tác, phần còn lại giữ nguyên), cùng thông báo nếu đặc tả quy định.
- Giá trị phải duy nhất giữa các test (tên, email) mang hậu tố do script sinh. Với case biên độ dài, ghi dạng `{"length": N}` và hậu tố nằm **trong** tổng độ dài.
- Điều gì lấy từ quan sát ở B2 chứ không từ đặc tả (ví dụ có alert hay không) thì ghi rõ là quan sát.
- Không để giá trị test nào trong script. Tài khoản và URL thuộc tham số dự án, không thuộc file này.

**ĐIỂM DỪNG 2:** bảng locator, bảng thông báo theo thao tác và danh sách hành vi lạ (từ B2); file dữ liệu; bảng tóm tắt (ID, thao tác, kỳ vọng, bug); các điểm tự quyết cần người dùng xem.

## B4 · Sinh Page Object và spec

- Page Object theo bảng locator B2; test không chứa selector.
- Spec đọc file dữ liệu, một vòng `for...of`, thân test tách thành `arrange`, `act`, `assertUi`, `assertServer`.
- Viết theo `references/review-checklist.md` ngay từ đầu, không đợi tới bước review.
- Gắn annotation "Run by" và từng mã bug vào mỗi test. Không dùng `test.fail()` để đảo màu test được kỳ vọng fail.
- Lưu nguyên văn bản vừa sinh vào `raw/<feature>/` trước khi sửa bất cứ gì.
- Kiểm kiểu và kiểm cơ học, sửa hết ERROR trước khi chạy test:

```bash
npx tsc --noEmit
python3 <skill>/scripts/lint_suite.py <feature>
```

- Lập bảng **kiểu assertion × test**: mỗi dòng một kiểu (điều hướng, nội dung / hiển thị, số lượng, giá trị ô nhập, trạng thái phần tử, hộp thoại, phản hồi mạng, dữ liệu phía server…), ghi matcher dùng, nó kiểm điều gì và dùng ở những test case nào. Hai matcher kiểm cùng một loại sự việc tính là một kiểu. Linter đếm số kiểu; phần "dùng ở test nào" phải tự lập. Nếu số kiểu thấp hơn `minAssertionKinds`, nêu rõ là chưa đạt và đề xuất kiểu còn thiếu; không thêm assertion vô nghĩa chỉ để đủ số.

Chạy liền sang B5.

## B5 · Chạy thử trên một browser

- Chạy trên Chromium, không đặt `REPORT_DIR` (report tạm, có trace để gỡ lỗi).
- Lập bảng: test case, kết quả, thời gian, lý do fail.
- Với mỗi test fail, đọc danh sách assertion fail và kết luận sơ bộ: do SUT hay do script. Kiểm dữ liệu SUT sau lượt chạy đã về như trước chưa.
- Mở ít nhất một ảnh bằng chứng của một test fail và nhìn tận mắt.

Chạy liền sang B6.

## B6 · Review theo danh sách kiểm

- Chạy `lint_suite.py` trước; nó lo phần cơ học. **Linter không biết expected đúng hay sai**, không biết một assertion có đỏ được khi SUT sai hay không, và không mở ảnh. Ba việc đó phải tự làm.
- Đi qua **từng mục** của `references/review-checklist.md` trên code hiện có. Mỗi mục ghi: đạt hay chưa, bằng chứng (file và dòng), đề xuất sửa. Ở chế độ Review, chỉ nêu phát hiện, chưa sửa.
- Kiểm chứng **mọi** `expected` trong file dữ liệu với câu đặc tả tương ứng. Đây là việc quan trọng nhất của bước này.

**ĐIỂM DỪNG 3:** danh sách file và điểm yếu đã biết của bản vừa sinh (từ B4); bảng kiểu assertion × test; kết quả lint; bảng kết quả chạy thử (từ B5); bảng review theo tám mục kèm đề xuất sửa xếp theo nhóm.

Ở điểm dừng này, **trước nhóm sửa đầu tiên**, nhắc người dùng commit bản thô (spec, Page Object, file dữ liệu và `raw/<feature>/`) để lịch sử có mốc trước khi sửa. Skill không tự commit; chỉ nhắc và gợi ý thông điệp.

Sau khi người dùng duyệt, sửa **theo từng nhóm** (assertion, chờ, dễ đọc…). Sau mỗi nhóm: `tsc --noEmit`, lint, chạy lại Chromium, báo diff tóm tắt và thời gian trước / sau, gợi ý thông điệp commit, rồi **dừng lại** chờ duyệt trước nhóm kế tiếp. Với mỗi lỗi, ghi lại bản thô viết gì và vì sao viết như vậy; người dùng cần thông tin này để tự phân tích.

## B7 · Chạy đủ ba browser

```bash
python3 <skill>/scripts/run_matrix.py <feature>                 # lượt gỡ lỗi, report ra thư mục tạm
python3 <skill>/scripts/run_matrix.py <feature> --repeat-each 5 --grep "<các case kỳ vọng pass>" --browsers firefox,webkit
```

- Script in bảng test case × browser và so **bộ assertion fail** của từng case giữa các browser, không chỉ so pass / fail. Mã thoát 1 nghĩa là có case lệch hoặc lúc pass lúc fail; mã 2 nghĩa là có lượt không chạy được.
- Case lệch giữa các browser: tìm nguyên nhân gốc trước khi sửa. Không thêm retry, không nới timeout khi chưa có bằng chứng.
- Lượt chính thức (report nằm trong dự án) do **người dùng tự chạy**: `python3 <skill>/scripts/run_matrix.py <feature> --out reports`. Skill chỉ đưa lệnh.

Chạy liền sang B8.

## B8 · Phân loại test fail

Với mỗi test fail, xếp vào đúng một loại và nêu bằng chứng:

| Loại | Dấu hiệu | Việc làm |
| --- | --- | --- |
| Bug của SUT, đã có issue | Tìm thấy issue khớp trên `bugTracker` | Ghi mã bug vào trường `bug` của case |
| Bug của SUT, chưa có issue | Đã tìm trên `bugTracker` và không thấy | Soạn mô tả bug cho người dùng; không tự tạo issue |
| Lỗi script | Assertion sai, locator sai, chờ sai | Quay lại B6 |
| Lỗi môi trường | Dịch vụ không chạy, dữ liệu bẩn | Sửa môi trường, chạy lại |

- **Tìm trên tracker trước khi gọi là bug mới**, bằng nhiều từ khóa (mã feature, tên thao tác, triệu chứng). Mã bug trong tiêu đề issue có thể khác số issue; ghi cả hai.
- Mỗi test fail phải có ảnh cho thấy lỗi. Mở ảnh ra xem trước khi coi nó là bằng chứng.

**Báo cáo cuối** (ngắn, không chép lại code): bảng ba browser; bảng test fail → loại → bug / issue → ảnh bằng chứng; lệnh cho lượt chính thức; danh sách việc người dùng phải tự làm.

## Tài nguyên

- `references/review-checklist.md`: tám mục kiểm khi review, mỗi mục có lý do, cách kiểm và lỗi đã gặp thật. Đọc ở B4 và B6.
- `scripts/lint_suite.py <feature>`: kiểm cơ học (chờ cố định dưới mọi hình thức, dữ liệu ghi cứng trong script, số test case và số kiểu assertion so với ngưỡng, ba browser, "Run by"). Mã thoát 1 khi có ERROR. Không biết expected đúng hay sai. Thêm `--spec <file>` để kiểm một bản thô.
- `scripts/run_matrix.py <feature>`: chạy ba browser, mỗi lượt một `REPORT_DIR`, in bảng test case × browser và so bộ assertion fail. Cần `playwright.config.ts` bật reporter `json` khi có biến `JSON_REPORT`.
