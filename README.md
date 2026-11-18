# HW04 – AI-Assisted Automation Testing · 23120031

Tự động hóa kiểm thử ba feature web của EShop SUT bằng Playwright Test (TypeScript), data-driven, chạy trên Chromium, Firefox và WebKit. Script do AI sinh và được review, sửa, ghi lại trong gap analysis của từng feature.

- **Repo:** https://github.com/d1nhnguyen/HW04_23120031
- **Video demo (Task 2):** https://youtu.be/bMuzCpj23Xg
- **Video Agent Skill:** không quay (chỉ nộp skill)
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
| Pass | 72 | tổng 9 report: FR-15 21, FR-01 24, FR-10 27 |
| Fail | 63 | tổng 9 report: FR-15 24, FR-01 27, FR-10 12; mọi test fail là do bug của SUT |
| Số bug (issue) | 13 | FR-15: 5, FR-01: 6, FR-10: 2; chi tiết ở `bugs/Bug_Report.md` |
| Commit có sửa `.spec.ts` | 15 (ngưỡng 8) | `git_commit_log.txt` |

Theo từng lượt chính thức (pass / fail, thời gian; số đọc từ chính các file `reports/<feature>-<browser>/index.html`):

| Feature | Chromium | Firefox | WebKit |
| --- | --- | --- | --- |
| FR-15 | 7 / 8 · 66,4 giây | 7 / 8 · 115,2 giây | 7 / 8 · 89,5 giây |
| FR-01 | 8 / 9 · 42,2 giây | 8 / 9 · 87,1 giây | 8 / 9 · 61,3 giây |
| FR-10 | 9 / 4 · 29,6 giây | 9 / 4 · 60,4 giây | 9 / 4 · 48,3 giây |

Chín lượt chạy ngày 2026-11-18 từ 04:33 tới 04:58 UTC (11:33–11:58 GMT+7); tiêu đề mỗi report có "Run by: 23120031" kèm thời điểm ISO. Mỗi test case cho cùng kết quả trên cả ba browser.

## 3. Tài liệu

| Tài liệu | File |
| --- | --- |
| Báo cáo chính | `report/main_report.md` |
| Test case được chọn | `report/fr15_testcases.md`, `report/fr01_testcases.md`, `report/fr10_testcases.md` |
| Gap analysis script do AI sinh | `report/fr15_gap_analysis.md`, `report/fr01_gap_analysis.md`, `report/fr10_gap_analysis.md` |
| Bug report | `bugs/Bug_Report.md` |
| AI Audit Report | `ai/AI_Audit_Report.md` (Phụ lục A: `ai/prompt_log.md`) |
| AI Critique | `ai/AI_Critique.md` (sinh viên tự viết) |
| PDF của báo cáo chính, AI Audit Report, AI Critique | `pdf/` (xuất bằng `scripts/build_pdf.sh`) |
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
