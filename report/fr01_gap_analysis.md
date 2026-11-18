# FR-01 Đăng ký tài khoản – review và gap analysis script do AI sinh

Hai phiên AI giống FR-15:

- **AI-1 (phiên viết script):** Claude Code (VS Code extension), dùng skill `data-driven-web-automation` ở chế độ sinh mới. Model Claude Fable 5.2 tới lượt #79 của prompt log, từ đó Claude Opus 5.5.
- **AI-2 (phiên review):** Claude Code CLI, model Claude Fable 5.2. Tôi dán kết quả ở mỗi điểm dừng của AI-1 sang AI-2; AI-2 đối chiếu với đặc tả, mã giao diện, kết quả HW02 và tracker rồi đề xuất sửa.

**Cách kiểm khác FR-15.** Ở FR-15, mỗi điểm sửa đều được tôi đọc trên diff. Ở FR-01:

- Ba điểm dừng của skill (sau B1, sau B3, ở B6) được tôi duyệt cùng nhận xét của AI-2.
- Từ nhóm sửa thứ hai trở đi (2026-11-18 09:17), tôi **không đọc từng diff**. AI-1 tự commit và push sau mỗi nhóm khi đạt đủ ba cổng tự động: `tsc --noEmit` sạch, `lint_suite.py fr01` không có ERROR, và một lượt Chromium ra đúng 8 pass / 9 fail với cùng danh sách case như lượt chạy thử B5. AI-2 kiểm lại ở từng mốc thay cho việc tôi đọc diff.

Bản thô B4 lưu nguyên văn trong `raw/fr01/` (commit `3572a33`). Các lỗi dưới đây được sửa ở các commit `[FR-01][B6-…]` và `[FR-01][B8]`.

## 1. Kết quả sau khi sửa

**Lượt chính thức: chưa có.** Ba report `reports/fr01-<browser>/` chưa được chạy (kiểm ngày 2026-11-18 lúc 10:45). Bảng dưới là lượt gỡ lỗi cuối của `run_matrix.py` trên code đã commit (`7bf5424`, report ở thư mục tạm, không nộp); thay bằng số của lượt chính thức khi có.

| Browser  | Pass | Fail | Thời gian (lượt gỡ lỗi) | Report chính thức         |
| -------- | ---- | ---- | ----------------------- | ------------------------- |
| Chromium | 8    | 9    | 36,2 giây               | `reports/fr01-chromium/` (chưa có) |
| Firefox  | 8    | 9    | 77,6 giây               | `reports/fr01-firefox/` (chưa có)  |
| WebKit   | 8    | 9    | 58,2 giây               | `reports/fr01-webkit/` (chưa có)   |

Chín test fail đều do bug của SUT (mục 4): mỗi case có cùng một bộ assertion fail trên cả ba browser. Tám case kỳ vọng pass được lặp 5 lần trên Firefox và WebKit bằng `run_matrix.py` (trace tắt): 40 / 40 lượt pass ở mỗi browser.

## 2. AI sai hoặc thiếu ở đâu

Cột "Ai phát hiện": **SV** = sinh viên; **AI-1** = phiên viết script tự nêu; **AI-2** = phiên review nêu, sinh viên chuyển sang AI-1; **Chạy** = lộ ra khi chạy.

### 2.1 Bước chọn test case và dữ liệu (B1–B3)

| #  | AI viết gì | Sai / thiếu ở đâu | Sửa thành | Ai phát hiện | Vì sao AI sai |
| -- | ---------- | ----------------- | --------- | ------------ | ------------- |
| G1 | Loại FR01-DT-14, DT-02, BV-19 vì "kết quả phụ thuộc cách từng browser xử lý ô `type="email"`" | Ô Email của form là `type="text"` (issue #21, #111). Lý do loại sai sự kiện | Ba case vẫn bị loại, nhưng vì expected dựa trên giả định A2, A4 của HW02 chứ không dựa trên câu đặc tả | AI-2, đối chiếu `Register.jsx` và tracker | AI khẳng định một chi tiết giao diện ở B1, trước khi khảo sát trang thật ở B2, dựa trên yêu cầu `type="email"` của FR-22 |
| G2 | Bảng phân bố: S3 có 9 case | Cột "Mong đợi" của chính bảng chỉ có 8 case trích S3 | Đếm lại bằng script từ file dữ liệu | AI-2 | Lặp lại lỗi G1 của FR-15 dù skill đã có dòng "đếm lại từ bảng": AI viết con số tóm tắt mà không đếm |
| G3 | FR01-DT-17 đăng ký trùng với tài khoản seed `test@eshop.com` | Đây là tài khoản dùng chung của mọi test; SUT có bug cho tạo tài khoản trùng (#20), nên test có thể làm bẩn tài khoản đó | Setup tạo một tài khoản qua API rồi đăng ký trùng với chính nó | AI-2 | AI giữ nguyên dữ liệu của HW02 (nơi dữ liệu được reset trước mỗi case) mà không xét lại điều kiện reset một lần mỗi lượt của HW04 |
| G4 | Nêu rằng BUG-15 che mất DT-11 và DT-17, và đề xuất thay hai case này bằng case khác | Thay đi thì suite không còn case nào chạm tới định dạng và tính duy nhất của email | Giữ DT-11, DT-17 và thêm hai case biến thể FR01-WA-11, WA-17 dùng mật khẩu form đang nhận, ghi rõ giới hạn | AI-1 nêu rủi ro; AI-2 đề xuất case biến thể; SV quyết định | AI chọn cách làm suite "xanh dễ hiểu" thay vì giữ phạm vi kiểm của đặc tả |
| G5 | Locator ô nhập: `form div` chứa `label` có đúng chữ | Sẽ khớp nhầm nếu form có thêm một `div` bao ngoài cả ba ô | Chọn ô nằm ngay sau nhãn: `label:text-is("…") + input` | AI-2, trước B4 | AI chọn locator chạy được trên trang hiện tại, chưa xét trang thay đổi về sau |

AI-2 cũng nêu trước hai rủi ro ở điểm dừng 2 và chúng được đưa vào yêu cầu B4 nên không thành lỗi:
- DT-27 gọi `fill` vào ô Xác nhận mật khẩu không tồn tại sẽ treo 30 giây.
- Phép so "các tài khoản khác giữ nguyên" sẽ bị nhiễu nếu chụp danh sách sau khi thử đăng nhập (đăng nhập làm đổi `login_attempts`).

### 2.2 Script bản thô (B4) – `raw/fr01/B4_v1_register.spec.ts.txt`

| #   | Vị trí | AI viết gì | Sai / thiếu ở đâu | Sửa thành | Ai phát hiện | Vì sao AI sai |
| --- | ------ | ---------- | ----------------- | --------- | ------------ | ------------- |
| G6  | dòng 199 | Ba case bỏ trống ô bắt buộc (DT-08, DT-10, DT-19) chỉ kiểm ô nào nhận sự kiện `invalid` | Không chứng minh form thật sự không được gửi; FR-15 đã kiểm thêm `submit` | Kiểm thêm: form không bắn `submit`, không có yêu cầu đăng ký nào | AI-2 | AI không mang lại đủ bài học G6 của FR-15 sang feature mới dù dùng chung bộ ghi dấu vết |
| G7  | dòng 250–257 | Assertion "tài khoản mới đúng tên, email" và "đăng nhập được" | Chưa từng chạy tới: cả ba case accept dừng sớm vì BUG-15 | Chứng minh bằng bản sao suite ngoài repo: chạy tới, xanh khi đúng, đỏ đúng dòng khi đổi giá trị mong đợi | AI-1 nêu ở B6 | Một assertion chưa bao giờ chạy thì không biết nó đúng hay sai; AI chỉ nhận ra khi rà mục 2 của danh sách kiểm |
| G8  | dòng 183–193 | Mỗi assertion giao diện sau assertion URL chờ 1 giây | Khi URL đã sai, ba assertion lần lượt chờ: case accept fail mất 4,5 giây so với 1,2 giây của case pass | Chỉ assertion URL đầu tiên được chờ; khi URL sai, các assertion sau kiểm một lần. Còn 2,1–2,4 giây | AI-1 nêu ở B6 | AI áp cùng một thời gian chờ cho mọi assertion, không phân biệt trang còn đổi hay đã ở trạng thái cuối |
| G9  | dòng 292 | Chỉ chụp trang sau thao tác | Với DT-29, WA-11, WA-17 (SUT nhận sai và chuyển trang), ảnh chỉ là trang Đăng nhập trống, không thấy đã nhập gì hay tài khoản nào được tạo | Chụp thêm form ngay trước khi bấm; đính danh sách tài khoản mới phía server vào report | AI-1, khi mở ảnh ở B5 | AI dựng bằng chứng theo mẫu FR-15 (chụp sau thao tác) mà không xét trang có thể chuyển đi mất |
| G10 | dòng 149–150 | Assertion "form phải có ô Xác nhận mật khẩu" nằm trong bước `act` | Lẫn assertion vào bước thao tác | Chuyển sang `assertUi`; `act` chỉ còn đếm để quyết định có điền hay không | AI-1 nêu ở B6 | Viết assertion ngay chỗ cần thông tin, không theo cấu trúc arrange / act / assert |

### 2.3 Lỗi AI tạo ra trong lúc sửa

| #   | AI viết gì | Sai ở đâu | Sửa thành | Ai phát hiện | Vì sao AI sai |
| --- | ---------- | --------- | --------- | ------------ | ------------- |
| G11 | Linter báo ERROR ở kiểu `{ ref: 'setup' }`; AI đổi kiểu thành `{ ref: string }` cho linter im | `setup` là từ khóa của cấu trúc dữ liệu, không phải giá trị test; nới kiểu làm spec yếu đi (mất kiểm lỗi gõ nhầm lúc kiểm kiểu) | Trả kiểu về `'setup'`; sửa `lint_suite.py` bỏ qua giá trị của khóa `ref`; kiểm linter vẫn báo 3 ERROR trên bản thô FR-15 | AI-2 | AI coi linter là đúng và sửa code cho khớp công cụ, thay vì hỏi cảnh báo có đúng không |

### 2.4 Phân loại bug (B8)

| #   | AI viết gì | Sai / thiếu ở đâu | Sửa thành | Ai phát hiện | Vì sao AI sai |
| --- | ---------- | ----------------- | --------- | ------------ | ------------- |
| G12 | Trường `bug` chỉ ghi mã, ví dụ `BUG-15` | Mã BUG trong tiêu đề không duy nhất trên tracker (BUG-43, 44, 45 mỗi mã có hai issue); nhiều bug FR-01 có issue trùng nội dung của thành viên khác (#110–#113) | Ghi `BUG-15 (#15, trùng nội dung: #110 BUG-64)`; `meta.bugIssues` liệt kê đủ | AI-2 nhắc trước B8; AI-1 thực hiện | Định dạng kế thừa từ FR-15, nơi chỉ có một bug có issue trùng |

## 3. Nhận xét chung

- **Test xanh không có nghĩa là tính năng đúng.** Năm case mật khẩu yếu (BV-03, DT-21…24) xanh vì form từ chối gần như mọi mật khẩu, kể cả mật khẩu đúng (BUG-15). Ba case positive đỏ cho thấy bộ kiểm mật khẩu sai, nên năm case xanh không chứng minh được phần từ chối của nó đúng (AI-2 nêu ở điểm dừng 2).
- **AI lặp lại lỗi đã có trong bài học.** G2 lặp G1 của FR-15, G6 lặp G6 của FR-15, dù skill đã ghi cả hai.
- **Sửa code cho khớp công cụ là một kiểu lỗi riêng (G11).** Linter sai, và AI làm yếu spec để linter im.
- **Cổng tự động thay cho đọc diff có giới hạn.** Cổng chỉ bắt được lỗi làm đổi kết quả Chromium. Ở FR-01 các nhóm sửa sau B6 không lộ lỗi mới, nhưng cổng không kiểm được ý nghĩa của assertion hay lời văn trong dữ liệu; phần đó dựa vào AI-2.

## 4. Test fail và bug tương ứng

| Test case | Bug (issue; issue trùng nội dung) | Tầng lộ lỗi |
| --- | --- | --- |
| FR01-DT-01, BV-04, BV-14 | BUG-15 (#15; #110) | Form báo "Mật khẩu quá yếu", không gửi yêu cầu, không tạo tài khoản |
| FR01-DT-11, DT-17 | BUG-15 (#15; #110) | Lý do từ chối là mật khẩu, không phải email: phần kiểm email chưa được chạm tới |
| FR01-DT-29 | BUG-15 (#15; #110), BUG-19 (#19) | Form nhận mật khẩu có dấu cách, server trả 200, tạo tài khoản |
| FR01-DT-27 | BUG-16 (#16; #113), BUG-15 | Không có ô Xác nhận mật khẩu; lý do từ chối là mật khẩu |
| FR01-WA-11 | BUG-21 (#21; #111), BUG-18 (#18) | Server trả 200, tạo tài khoản email không có `@` |
| FR01-WA-17 | BUG-20 (#20; #112) | Server trả 200, tạo tài khoản thứ hai cùng email |

Chi tiết từng bug: `bugs/Bug_Report.md`. Bảng chọn test case và các case không tự động hóa được: `report/fr01_testcases.md`.
