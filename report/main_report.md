# Báo cáo HW04 – AI-Assisted Automation Testing · 23120031

| Mục | Giá trị |
| --- | --- |
| Sinh viên | NGUYỄN PHÚ DINH – 23120031 |
| Repo | https://github.com/d1nhnguyen/HW04_23120031 |
| Video demo | https://youtu.be/bMuzCpj23Xg |
| SUT | EShop SUT (bản dùng chung của nhóm), issue tại https://github.com/d1nhnguyen/eshop-sut/issues |

## 1. Mục tiêu và phạm vi

Tự động hóa kiểm thử ba feature web đã thiết kế test case ở HW02, bằng script do AI sinh và được review:

| Feature | Giao diện | Test case | Chọn test case | Gap analysis |
| --- | --- | --- | --- | --- |
| FR-15 Quản lý sản phẩm | Web Admin, mục Sản phẩm | 15 | `report/fr15_testcases.md` | `report/fr15_gap_analysis.md` |
| FR-01 Đăng ký tài khoản | Web khách hàng, `/register` | 17 (15 từ HW02, 2 bổ sung) | `report/fr01_testcases.md` | `report/fr01_gap_analysis.md` |
| FR-10 Trạng thái đơn hàng | Web Admin mục Đơn hàng, trang Hồ sơ | 13 (11 từ HW02, 2 bổ sung) | `report/fr10_testcases.md` | `report/fr10_gap_analysis.md` |

Kết quả mong đợi lấy từ đặc tả (README của SUT), không lấy từ hành vi của SUT. Điều đặc tả không quy định được ghi rõ là giả định hoặc quan sát trong file dữ liệu.

## 2. Môi trường và công cụ

| Thành phần | Phiên bản |
| --- | --- |
| Hệ điều hành | Ubuntu 24.04.5 LTS |
| Node.js | 22.23.4 |
| Playwright Test | 1.65.1, Playwright HTML reporter |
| Browser | Chromium 159.0.8154.6, Firefox 159.0, WebKit 27.2 (bản đi kèm Playwright) |
| TypeScript | 7.0.2 (`tsc --noEmit` làm bước kiểm kiểu) |
| SUT | backend `:3000`, web `:5173`, admin `:5174`; điều khiển bằng `scripts/sut.sh` |
| Công cụ AI | Claude Code (VS Code extension và CLI); chi tiết ở `ai/AI_Audit_Report.md` |

## 3. Phương pháp

### 3.1 Kiến trúc bộ test

- **Data-driven:** mọi giá trị test của một feature nằm trong `data/<feature>.<tên>.json`; spec chỉ chứa logic và sinh test bằng một vòng `for...of`.
- **Page Object:** `pages/`, với phần dùng chung tách riêng (`ProbedPage`, `AdminShell`, `WebShell`, `OrderTable`).
- **Tham số dự án** trong `automation.config.json`: mã người chạy, URL, tài khoản, lệnh reset SUT, tracker.
- **Mỗi test có bốn bước:** `arrange` (dựng dữ liệu qua API), `act` (một thao tác trên giao diện), `assertUi` (soft, không tải lại trang), `assertServer` (đọc lại dữ liệu qua API).
- **Không chờ theo thời gian cố định:** biết "đã xong" bằng số XHR đang chờ đếm ngay trong trang.
- **Bằng chứng:** test tự chụp riêng vùng chứa kết quả (bảng, form, dòng đơn) và đính vào report.

### 3.2 Dữ liệu và môi trường mỗi lượt

- `global-setup.ts` reset SUT về seed **một lần** ở đầu mỗi lượt (feature × browser) và dừng ngay nếu một trong ba dịch vụ không phản hồi.
- Trong lượt, mỗi test tự tạo dữ liệu qua API với hậu tố duy nhất.
- Dọn dữ liệu theo id trong fixture (FR-15, FR-01). FR-10 không dọn được vì SUT không có API xóa đơn; giới hạn này ghi trong `report/fr10_testcases.md`.

### 3.3 Quy trình làm việc với AI

- **Hai phiên AI:** AI-1 viết script, AI-2 review. Mô tả ở `ai/AI_Audit_Report.md` mục 3.
- **Agent Skill** `.claude/skills/data-driven-web-automation/`: 9 bước (B0–B8), ba điểm dừng bắt buộc, hai script `lint_suite.py` và `run_matrix.py`, danh sách kiểm 8 mục.
- **Mức kiểm của sinh viên khác nhau theo feature:**

| Feature | Sinh viên kiểm thế nào |
| --- | --- |
| FR-15 | Đọc từng diff, duyệt ở mọi điểm dừng |
| FR-01 | Duyệt ba điểm dừng; từ nhóm sửa thứ hai, cổng tự động (tsc, lint, Chromium đúng 8 / 9) và AI-2 thay cho đọc diff |
| FR-10 | Một điểm dừng sau B3; cổng tự động (tsc, lint, hai lượt Chromium cùng danh sách) và AI-2 |

**Đánh đổi giữa đọc diff và cổng tự động.** Ở FR-15 tôi đọc từng diff nên hiểu script này rõ nhất, nhưng cũng mất nhiều thời gian nhất. Ở FR-01 và FR-10, vì sát hạn nộp, tôi thay việc đọc diff bằng ba cổng tự động và phiên AI review. Cách này nhanh hơn nhiều và vẫn bắt được lỗi cơ học, nhưng có hai giới hạn:

- **Cổng chỉ chạy Chromium.** Lỗi riêng của WebKit ở FR-10 lọt qua cổng và chỉ lộ ra ở ma trận ba browser (mục 2 của `report/fr10_gap_analysis.md`).
- **Cổng không biết expected có đúng đặc tả hay không.** Phần đó vẫn dựa vào các điểm dừng nơi tôi duyệt test case và file dữ liệu.

Vì vậy tôi nắm FR-01 và FR-10 ở mức thiết kế test và kết quả, không ở mức từng dòng code như FR-15.

## 4. Kết quả

| Feature | Chromium | Firefox | WebKit | Report |
| --- | --- | --- | --- | --- |
| FR-15 | 7 pass / 8 fail · 66,4 giây | 7 / 8 · 115,2 giây | 7 / 8 · 89,5 giây | `reports/fr15-<browser>/` |
| FR-01 | 8 / 9 · 42,2 giây | 8 / 9 · 87,1 giây | 8 / 9 · 61,3 giây | `reports/fr01-<browser>/` |
| FR-10 | 9 / 4 · 29,6 giây | 9 / 4 · 60,4 giây | 9 / 4 · 48,3 giây | `reports/fr10-<browser>/` |

Tổng: 3 feature, 45 test case, 9 lượt browser, 135 lượt thực thi; **72 pass / 63 fail**. Mọi test fail là do bug của SUT (mục 5), và mỗi test case cho cùng kết quả trên cả ba browser. Chín lượt chạy ngày 2026-11-18 từ 04:33 tới 04:58 UTC; tiêu đề mỗi report có "Run by: 23120031" kèm thời điểm ISO. Bảng tổng hợp đầy đủ ở `README.md` mục 2.

**Ghi chú về lượt FR-15 trên WebKit.** Theo ghi nhận của sinh viên: trong video demo, lượt WebKit của FR-15 chạy có cửa sổ trình duyệt (`--headed`) ra 5 pass / 10 fail, do 8 test quá thời gian khi cửa sổ trình duyệt bị cửa sổ khác che. Report chính thức `reports/fr15-webkit/` là lượt chạy lại ở chế độ nền (không có cửa sổ), bắt đầu lúc 04:52 UTC (2026-11-18T04:52:03.706Z trong tiêu đề report), ra 7 / 8 như hai browser còn lại. Report của lượt có cửa sổ đã bị lượt chạy lại ghi đè nên không có trong repo.

Độ ổn định (lặp 5 lần các case kỳ vọng pass trên Firefox và WebKit, trace tắt):

| Feature | Firefox | WebKit |
| --- | --- | --- |
| FR-15 | 35 / 35 | 35 / 35 |
| FR-01 | 40 / 40 | 40 / 40 |
| FR-10 | 45 / 45 | 45 / 45 |

Lượt lặp FR-15 đầu tiên (2026-11-17 13:00, ghi trong `report/fr15_gap_analysis.md`) chạy khi trace còn bật cho mọi lượt, tức đúng điều kiện có thể che lỗi tranh chấp thời gian. Nó được chạy lại ngày 2026-11-18 bằng `run_matrix.py` (trace tắt): 35 / 35 trên Firefox và 35 / 35 trên WebKit. Số trong bảng là của lượt chạy lại; số FR-01 và FR-10 cũng là lượt trace tắt.

## 5. Bug

13 bug, mỗi bug có issue trên tracker của nhóm. Không có bug mới so với HW02 / HW03; mọi test fail đều khớp issue đã có.

| Feature | Bug |
| --- | --- |
| FR-15 | BUG-24 (#24), BUG-25 (#25), BUG-26 (#26), BUG-27 (#27), BUG-41 (#87) |
| FR-01 | BUG-15 (#15), BUG-16 (#16), BUG-18 (#18), BUG-19 (#19), BUG-20 (#20), BUG-21 (#21) |
| FR-10 | BUG-30 (#30), BUG-31 (#31) |

Chi tiết, các bước tái hiện, issue trùng nội dung và ảnh: `bugs/Bug_Report.md`.

## 6. Review và gap analysis script do AI sinh

Mỗi feature có một file riêng (bảng ở mục 1). Các điểm nổi bật:

- **FR-15:** assertion chạy xanh mà không chứng minh điều cần chứng minh (`validity.valueMissing`); chờ cố định trá hình (`waitForResponse().catch()`); ảnh lúc fail không thấy dòng lỗi.
- **FR-01:** AI khẳng định chi tiết giao diện trước khi khảo sát trang; sửa code cho khớp một cảnh báo sai của linter; assertion của nhánh accept chưa từng chạy tới, được chứng minh bằng bản sao suite ngoài repo.
- **FR-10:** lỗi chỉ có trên WebKit (`page.goto` hủy yêu cầu kiểm phiên, app xóa token) thoát qua cổng Chromium; trace làm lỗi biến mất nên lượt lặp với trace bật cho kết quả xanh giả.

**Phân tích chung qua ba feature.** Ba điểm lặp lại ở cả ba feature:

1. **Lỗi nặng nhất nằm ở assertion và bằng chứng, không nằm ở selector.** Selector ít phải sửa, vì trước khi sinh code luôn có bước khảo sát trang thật.
2. **Test xanh không đồng nghĩa với đúng.** `valueMissing` ở FR-15 luôn đúng; năm case mật khẩu yếu ở FR-01 xanh vì form từ chối gần như mọi mật khẩu, kể cả mật khẩu hợp lệ; lượt lặp ở FR-10 xanh giả do trace che lỗi.
3. **Bài học đã ghi vẫn bị lặp lại.** Lỗi ảnh bằng chứng không cho thấy bug xuất hiện ở cả FR-15 lẫn FR-10, dù đã có trong danh sách kiểm.

Bản thô của FR-01 và FR-10 không lặp lại hai lỗi lớn của FR-15 (chờ cố định, assertion luôn đúng) nhờ skill và danh sách kiểm, nhưng mỗi feature vẫn lộ ra một loại lỗi mới mà danh sách chưa có. Phần lớn lỗi do phiên AI review nêu; vai trò của tôi là quyết định test case, giữ expected theo đặc tả, và duyệt hoặc bác các đề xuất sửa.

## 7. Agent Skill

`.claude/skills/data-driven-web-automation/`, gồm `SKILL.md`, `references/review-checklist.md`, `scripts/lint_suite.py`, `scripts/run_matrix.py`. Skill được xây từ FR-15, rồi dùng ở chế độ sinh mới cho FR-01 và FR-10. Những lần skill được sửa sau khi dùng:

- `lint_suite.py` bỏ qua giá trị của khóa `ref` (FR-01, gap G11).
- `review-checklist.md` thêm bài học "lượt lặp phải chạy với trace tắt" (FR-10).

Video dùng skill: không quay; chỉ nộp skill.

## 8. Sử dụng AI

- **AI Audit Report:** `ai/AI_Audit_Report.md`; Phụ lục A, prompt và output nguyên văn: `ai/prompt_log.md`.
- **AI Critique:** `ai/AI_Critique.md` _(sinh viên tự viết, 200–300 từ)_.
- **PDF:** `scripts/build_pdf.sh` xuất PDF cho báo cáo chính, AI Audit Report và AI Critique vào `pdf/`.

## 9. Hạn chế và việc còn lại

- FR-10 không dọn được đơn test; bảng đơn dài thêm qua mỗi lượt.
- Giả định A1 của FR-10 (Admin có hủy được đơn `shipping` không) cần hỏi trợ giảng.
- Hai quan sát về SUT chưa báo: app xóa token khi yêu cầu kiểm phiên bị hủy; doanh thu Dashboard (FR-13) lệch. Ghi ở `TODO_thu_cong.md`.

## Phụ lục

| Tài liệu | File |
| --- | --- |
| README (tự chấm, tổng hợp test) | `README.md` |
| Git commit log | `git_commit_log.txt` |
| Bản thô AI sinh ở B4 | `raw/fr15/`, `raw/fr01/`, `raw/fr10/` |
| HTML report | `reports/<feature>-<browser>/index.html` |
