# FR-10 Trạng thái đơn hàng – review và gap analysis script do AI sinh

Hai phiên AI giống FR-15 và FR-01:

- **AI-1 (phiên viết script):** Claude Code (VS Code extension), model Claude Opus 5.5, dùng skill `data-driven-web-automation` ở chế độ sinh mới.
- **AI-2 (phiên review):** Claude Code CLI, model Claude Fable 5.2.

**Cách kiểm.** Vì sát hạn, quy trình của skill được rút gọn:

- Chỉ còn **một điểm dừng**, sau B3. Bảng test case, bảng locator và tóm tắt file dữ liệu được tôi duyệt cùng nhận xét của AI-2.
- Từ B4 tới B8, tôi **không đọc từng diff**. AI-1 tự commit và push sau mỗi nhóm khi đạt đủ ba cổng tự động: `tsc --noEmit` sạch, `lint_suite.py fr10` không có ERROR, và **hai lượt Chromium liên tiếp** cho cùng danh sách pass / fail. AI-2 kiểm lại ở mốc cuối.

Bản thô B4 lưu nguyên văn trong `raw/fr10/` (commit `3c078fc`). Các lỗi dưới đây được sửa ở các commit `[FR-10][B6-…]` và `[FR-10][B7-webkit]`.

## 1. Kết quả sau khi sửa

Lượt chính thức ngày 2026-11-18, trên code đã commit (`4ba7051`); số đọc từ chính ba report.

| Browser  | Pass | Fail | Thời gian | Report |
| -------- | ---- | ---- | --------- | ------ |
| Chromium | 9    | 4    | 29,6 giây | `reports/fr10-chromium/` |
| Firefox  | 9    | 4    | 60,4 giây | `reports/fr10-firefox/` |
| WebKit   | 9    | 4    | 48,3 giây | `reports/fr10-webkit/` |

Bốn test fail đều do bug của SUT (mục 4), cùng bộ assertion fail trên ba browser. Chín case kỳ vọng pass được lặp 5 lần trên Firefox và WebKit bằng `run_matrix.py` (trace tắt): 45 / 45 lượt pass ở mỗi browser.

## 2. Mục chính: lỗi chỉ có trên WebKit, và trace che mất nó

### 2.1 Diễn biến

| Thời điểm (2026-11-18) | Việc | Kết quả |
| --- | --- | --- |
| 09:53–10:01 | Bản thô và ba nhóm sửa B6, mỗi nhóm qua đủ ba cổng | Chromium 9 / 4 ở mọi lượt |
| 10:01 | `run_matrix.py fr10` lần đầu | Chromium 9 / 4, Firefox 9 / 4, **WebKit 6 / 7**: cả 5 case trên trang Hồ sơ (DT-06, DT-07, DT-14, DT-27, UI-02) fail vì trang hiện "Vui lòng đăng nhập" |
| 10:05–10:15 | Chạy riêng các case đó bằng `npx playwright test`, chạy cả suite WebKit hai lần, lặp 5 lần 9 case kỳ vọng pass | Tất cả pass, kể cả lượt lặp 45 / 45. Lỗi như đã biến mất |
| 10:21 | Commit B8 (cổng Chromium đạt), rồi `run_matrix.py fr10` lần hai | WebKit lại 6 / 7 |
| 10:25 | Chạy riêng DT-06 trên WebKit, trace tắt so với trace bật | Trace tắt: fail 3 / 4. Trace bật: pass 4 / 4 |
| 10:27 | Chạy bản sao suite có ghi log mạng và `localStorage` | Tìm ra nguyên nhân gốc (mục 2.2) |
| 10:29–10:39 | Sửa, commit `4ba7051`; chạy lại `run_matrix.py` và lặp 5 lần (trace tắt) | WebKit 9 / 4; lặp 5 lần: 45 / 45 trên Firefox và WebKit |

### 2.2 Nguyên nhân gốc

Ngay sau khi đăng nhập, trang chủ gửi `GET /api/users/me` để kiểm phiên. Script mở trang Hồ sơ bằng `page.goto('/profile')`, lệnh này tải lại toàn bộ trang và hủy yêu cầu đang chạy. Trên WebKit, app xử lý yêu cầu bị hủy như một lỗi và **xóa token khỏi `localStorage`**. Log ghi "token trước goto: true", "token sau goto: false". Trang Hồ sơ vì vậy mở ra ở trạng thái chưa đăng nhập.

Sửa: mở trang Hồ sơ bằng link "Chào, …" trên thanh điều hướng (điều hướng trong SPA, không tải lại trang), giống người dùng thật. Không thêm chờ, không thêm retry.

### 2.3 Vì sao lỗi thoát qua được

| #  | Điều gì | Sai / thiếu ở đâu | Bài học | Ai phát hiện | Vì sao AI sai |
| -- | ------- | ----------------- | ------- | ------------ | ------------- |
| W1 | `ProfilePage.open()` dùng `page.goto` ngay sau đăng nhập (`raw/fr10/B4_v1_profile.page.ts.txt` dòng 23) | Tải lại trang hủy yêu cầu kiểm phiên đang chạy | Không tải lại trang khi app còn yêu cầu đang chạy; điều hướng như người dùng | Chạy (`run_matrix`), AI-1 tìm nguyên nhân | AI dùng `goto` như cách mặc định để mở trang, không xét tới yêu cầu đang chạy của trang trước |
| W2 | Cổng tự động chỉ chạy Chromium | Lỗi chỉ có trên WebKit, nên cả 5 commit trước `4ba7051` đều qua cổng; commit B8 được tạo khi lỗi còn đó | Cổng một browser không thay được bước chạy ba browser | Chạy | Thiết kế cổng (do người dùng và AI-2 chọn để tiết kiệm thời gian) chấp nhận rủi ro này |
| W3 | Để có trace khi gỡ lỗi, AI-1 chạy lượt lặp bằng `npx playwright test` thay vì `run_matrix.py` | Không có `REPORT_DIR` nên trace bật; trace làm mỗi bước chậm đủ để yêu cầu kịp xong, lỗi biến mất: 45 / 45 pass là yên tâm giả | Lượt lặp kiểm độ ổn định phải chạy với trace tắt (đã thêm vào `review-checklist.md` của skill) | AI-1, khi so trace tắt và trace bật | AI coi trace là công cụ quan sát trung lập, không tính tới việc nó đổi thời gian |
| W4 | Hai giả thuyết đầu: token chưa kịp ghi lúc chuyển trang; WebKit đưa mã 304 thẳng cho XHR | Cả hai sai, đã bác bỏ bằng thí nghiệm | Kiểm từng giả thuyết bằng thí nghiệm trước khi sửa | AI-1 | – (đây là cách làm đúng: không sửa theo giả thuyết chưa kiểm) |

**Hành vi của SUT chưa báo:** app xóa token khi yêu cầu kiểm phiên bị hủy. Người dùng Safari tải lại trang ngay sau đăng nhập có thể bị đăng xuất. Chưa tìm trên tracker và chưa báo.

## 3. Các điểm sai hoặc thiếu khác

| #  | AI viết gì | Sai / thiếu ở đâu | Sửa thành | Ai phát hiện | Vì sao AI sai |
| -- | ---------- | ----------------- | --------- | ------------ | ------------- |
| G1 | Giữ DT-26, DT-27 với đủ 5 trạng thái như HW02 và thêm hai case cho trạng thái kết thúc | Hai trạng thái kết thúc bị kiểm hai lần, một bug bị đếm hai lần | Thu hẹp DT-26, DT-27 còn 3 trạng thái, ghi chú phạm vi đổi (DT-26: Fail ở HW02 → kỳ vọng pass) | AI-1 nêu; AI-2 yêu cầu ghi chú | AI giữ ID và phạm vi cũ, không xét chồng lấn với case mới |
| G2 | Ghi "theo chỉ dẫn của người dùng, Admin không hủy được đơn `shipping`" | Đây là chỗ đặc tả mơ hồ (sơ đồ không vẽ, câu chữ viết "chỉ Admin mới có thể thao tác"), không phải chỉ dẫn | Ghi là giả định A1, suite theo sơ đồ; đưa vào câu hỏi cho trợ giảng | AI-2 | AI dựa vào câu chữ của prompt thay vì gọi tên sự mơ hồ của đặc tả |
| G3 | Kế hoạch dữ liệu không ghi rõ case accept phải kiểm phản hồi 2xx | Thiếu so với FR-15, FR-01 | Thêm quy ước `expected.outcome`: accept → 2xx | AI-2 | – |
| G4 | `raw/fr10/B4_v1_orders.spec.ts.txt` dòng 175: case accept thiếu nút dùng `soft(0).toBe(1)` | So hai hằng số, thông báo lỗi không chỉ ra phần tử | `toHaveCount(1)` trên locator của nút; thử trên bản sao với nhãn nút không tồn tại thì đỏ đúng thông báo | AI-1 ở B6 | Viết cho nhanh một nhánh hiếm chạy |
| G5 | Dòng 309: chụp cả bảng đơn sau thao tác | Bảng nằm trong khung cuộn, ảnh bị cắt mất phần dưới; không có ảnh trước khi bấm nên ảnh DT-14 không cho thấy đơn từng là "Đang giao" | Chụp riêng từng dòng đơn của test, trước và sau thao tác | AI-1, khi mở ảnh ở B6 | Lặp lại bài học G19 của FR-15 dù mục 8 của danh sách kiểm đã ghi "chụp cả trang không giải quyết được nếu trang cuộn bên trong một khung cố định" |
| G6 | `escapeRegExp` viết hai lần; `web-shell` phải import nó từ `order-table` | Trùng code, phụ thuộc vô lý | Gom về `support/regexp.ts`; chạy lại cổng FR-01 và (theo nhắc của AI-2) FR-15 | AI-1 ở B6 | Tách phần dùng chung chưa triệt để |

## 4. Nhận xét chung

- **Quy trình rút gọn để lộ đúng chỗ yếu của nó.** Cổng Chromium cho phép commit nhanh, nhưng không thấy lỗi chỉ có trên WebKit. Lỗi chỉ lộ ra ở `run_matrix` ba browser.
- **Một lượt "xanh" có thể là yên tâm giả.** Lượt lặp 45 / 45 với trace bật đã không chứng minh được gì. Điều kiện chạy kiểm độ ổn định phải giống điều kiện chạy chính thức.
- **Không sửa theo giả thuyết chưa kiểm.** Hai giả thuyết đầu đều sai; nếu sửa theo chúng (ví dụ thêm chờ sau đăng nhập), lỗi sẽ bị che thêm một lớp nữa.
- **Bài học cũ vẫn bị lặp.** G5 lặp G19 của FR-15.

## 5. Test fail và bug tương ứng

| Test case | Bug (issue; issue trùng nội dung) | Tầng lộ lỗi |
| --- | --- | --- |
| FR10-DT-09 | BUG-30 (#30) | Admin bấm "Đánh dấu Đã giao" ở đơn Đã hủy: `PUT` trả 200, đơn thành `delivered` trên giao diện và server |
| FR10-UI-01 | BUG-30 (#30) | Dòng đơn Đã hủy trên Web Admin có nút "Đánh dấu Đã giao" |
| FR10-DT-14 | BUG-31 (#31; #115) | User hủy đơn Đang giao: `PUT` trả 200, báo "Hủy đơn thành công!", đơn thành `canceled` |
| FR10-DT-27 | BUG-31 (#31; #115) | Dòng đơn Đang giao trên trang Hồ sơ có nút "Hủy đơn" |

Chi tiết từng bug: `bugs/Bug_Report.md`. Bảng chọn test case, giả định A1 và các case không tự động hóa được: `report/fr10_testcases.md`.
