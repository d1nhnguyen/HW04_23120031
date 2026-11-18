# HW04 – AI-Assisted Automation Testing · 23120031

Tự động hóa kiểm thử ba feature web của EShop SUT bằng Playwright Test (TypeScript), data-driven, chạy trên Chromium, Firefox và WebKit. Script do AI sinh và được review, sửa, ghi lại trong gap analysis của từng feature.

- **Repo:** https://github.com/d1nhnguyen/HW04_23120031
- **Video demo (Task 2):** _(chưa có)_
- **Video Agent Skill:** _(chưa có)_
- **Bug tracker của SUT:** https://github.com/d1nhnguyen/eshop-sut/issues

## 1. Bảng tự chấm

| No. | Tiêu chí | Điểm tối đa | Tự chấm |
| --- | --- | --- | --- |
| 1 | Task 1 – Feature A: FR-15 Quản lý sản phẩm (Web Admin) | 25 | |
| 1 | Task 1 – Feature B: FR-01 Đăng ký tài khoản (Web khách hàng) | 25 | |
| 1 | Task 1 – Feature C: FR-10 Trạng thái đơn hàng (Web Admin, trang Hồ sơ) | 25 | |
| 2 | Task 2 – Demo video | 15 | |
| 3 | Agent Skills | 10 | |
| | **Tổng** | **100** | |

## 2. Tổng hợp kết quả test

| Chỉ số | Giá trị | Nguồn |
| --- | --- | --- |
| Số feature | 3 | FR-15, FR-01, FR-10 |
| Số test case tự động hóa | 45 | `data/fr15.products.json` (15), `data/fr01.register.json` (17), `data/fr10.orders.json` (13) |
| Số lượt browser | 9 | 3 feature × 3 browser, mỗi lượt một HTML report trong `reports/` |
| Số lượt thực thi test | 135 | 45 test case × 3 browser |
| Pass | _(chờ lượt chính thức)_ | `reports/<feature>-<browser>/index.html` |
| Fail | _(chờ lượt chính thức)_ | như trên |
| Số bug (issue) | 13 | FR-15: 5, FR-01: 6, FR-10: 2; chi tiết ở `bugs/Bug_Report.md` |
| Commit có sửa `.spec.ts` | 15 (ngưỡng 8) | `git_commit_log.txt` |

Theo từng lượt chính thức:

| Feature | Chromium | Firefox | WebKit |
| --- | --- | --- | --- |
| FR-15 | _(chờ)_ | _(chờ)_ | _(chờ)_ |
| FR-01 | _(chờ)_ | _(chờ)_ | _(chờ)_ |
| FR-10 | _(chờ)_ | _(chờ)_ | _(chờ)_ |

> **Lưu ý cho bản nháp (xóa trước khi nộp).** Tới 2026-11-18 10:45, `reports/` chỉ có ba report FR-15 chạy ngày 2026-11-17, trước các lần sửa code dùng chung. Chín lượt chính thức cần chạy lại rồi điền bảng trên từ chính các report đó. Để đối chiếu, các lượt gỡ lỗi cuối (report ở thư mục tạm, không nộp) cho:
>
> | Feature | Chromium | Firefox | WebKit | Thời điểm |
> | --- | --- | --- | --- | --- |
> | FR-15 | 7 pass / 8 fail | – | – | 2026-11-18, sau commit `42d2a67` |
> | FR-01 | 8 / 9 | 8 / 9 | 8 / 9 | 2026-11-18 09:33 |
> | FR-10 | 9 / 4 | 9 / 4 | 9 / 4 | 2026-11-18 10:29 |

## 3. Tài liệu

| Tài liệu | File |
| --- | --- |
| Báo cáo chính | `report/main_report.md` |
| Test case được chọn | `report/fr15_testcases.md`, `report/fr01_testcases.md`, `report/fr10_testcases.md` |
| Gap analysis script do AI sinh | `report/fr15_gap_analysis.md`, `report/fr01_gap_analysis.md`, `report/fr10_gap_analysis.md` |
| Bug report | `bugs/Bug_Report.md` |
| AI Audit Report | `ai/AI_Audit_Report.md` (Phụ lục A: `ai/prompt_log.md`) |
| AI Critique | _(sinh viên tự viết)_ |
| Git commit log | `git_commit_log.txt` |
| HTML report | `reports/<feature>-<browser>/index.html` |
| Agent Skill | `.claude/skills/data-driven-web-automation/` |

## 4. Cấu trúc dự án

```
automation.config.json      tham số của dự án: runBy, URL, tài khoản, lệnh reset SUT, tracker
playwright.config.ts        3 project, 1 worker, report theo REPORT_DIR, tiêu đề "Run by: 23120031 · <ISO>"
global-setup.ts             reset SUT một lần mỗi lượt + kiểm ba dịch vụ trước khi chạy
support/                    đọc tham số, gọi API có đăng nhập, bộ ghi dấu vết trong trang
pages/                      Page Object
data/<feature>.<tên>.json   toàn bộ giá trị test của từng feature
tests/<feature>/*.spec.ts   một vòng for...of sinh test từ file dữ liệu
raw/<feature>/              bản thô AI sinh ở bước B4, giữ nguyên văn
scripts/sut.sh              start / stop / reset / status của SUT
scripts/export_prompt_log.py  trích prompt log từ transcript Claude Code
```

## 5. Cách chạy

```bash
npm ci && npx playwright install
scripts/sut.sh start                      # bật backend, web, admin của SUT
npx tsc --noEmit                          # kiểm kiểu

# Một lượt chính thức cho mỗi feature × browser (report vào reports/)
python3 .claude/skills/data-driven-web-automation/scripts/run_matrix.py fr15 --out reports
python3 .claude/skills/data-driven-web-automation/scripts/run_matrix.py fr01 --out reports
python3 .claude/skills/data-driven-web-automation/scripts/run_matrix.py fr10 --out reports
```

Mỗi lượt (feature × browser) reset SUT về seed một lần ở đầu. Test fail vì bug của SUT là kết quả mong đợi; mã thoát khác 0 không có nghĩa là lỗi môi trường.
