# FR-15 Quản lý sản phẩm – review và gap analysis script do AI sinh

Bài này dùng hai phiên AI tách biệt:

- **AI-1 (phiên viết script):** Claude Code (VS Code extension). Phiên này khảo sát trang, sinh dữ liệu, Page Object và spec, rồi sửa theo yêu cầu.
- **AI-2 (phiên review):** Claude Code CLI, model Claude Fable 5.2. Phiên này chỉ đọc kết quả và diff của AI-1 để tìm lỗi. Mỗi điểm AI-2 nêu đều được tôi kiểm lại trên code trước khi yêu cầu AI-1 sửa.

Bản thô AI sinh ở bước B4 được lưu nguyên văn trong `raw/fr15/` (commit `e829452`). Các lỗi dưới đây được sửa ở các commit `[FR-15][B6-…]` và `[FR-15][B7]`.

## 1. Kết quả sau khi sửa

| Browser  | Pass | Fail | Thời gian | Report                   |
| -------- | ---- | ---- | --------- | ------------------------ |
| Chromium | 7    | 8    | 66,4 giây | `reports/fr15-chromium/` |
| Firefox  | 7    | 8    | 115,2 giây | `reports/fr15-firefox/`  |
| WebKit   | 7    | 8    | 89,5 giây | `reports/fr15-webkit/`   |

Ba report là lượt chính thức ngày 2026-11-18 (04:33–04:53 UTC), chạy trên code cuối cùng. Lượt WebKit là lượt chạy lại ở chế độ nền; xem ghi chú ở mục 4 của `report/main_report.md`.

Tám test fail đều do bug của SUT (mục 4), không do script: mỗi case có cùng một bộ assertion fail trên cả ba browser.

Bảy case kỳ vọng pass được lặp 5 lần trên Firefox và WebKit, hai lượt:

| Lượt lặp | Trace | Firefox | WebKit | Ghi chú |
| --- | --- | --- | --- | --- |
| 2026-11-17 13:00 | **Bật** | 35 / 35 pass | 35 / 35 pass | Lúc đó cấu hình đặt `trace: 'retain-on-failure'` cho mọi lượt (trace được ghi trong mọi test, chỉ bị bỏ khi test pass). Trace làm mỗi bước chậm đi và có thể che lỗi tranh chấp thời gian (xem mục 2 của `report/fr10_gap_analysis.md`), nên lượt này không đủ làm bằng chứng về độ ổn định |
| 2026-11-18 | **Tắt** | 35 / 35 pass | 35 / 35 pass | Chạy lại bằng `run_matrix.py fr15 --repeat-each 5` (đặt `REPORT_DIR`, nên trace tắt như lượt chính thức). Đây là số dùng trong báo cáo |

## 2. AI sai hoặc thiếu ở đâu

Cột "Ai phát hiện": **SV** = sinh viên thấy khi review; **AI-1** = phiên AI viết script tự nêu là điểm yếu; **AI-2** = phiên AI review nêu, sinh viên xác nhận rồi yêu cầu sửa; **Chạy** = lộ ra khi chạy.

### 2.1 Bước chọn test case và dữ liệu (B1–B3)

| #   | AI viết gì                                                                            | Sai / thiếu ở đâu                                                               | Sửa thành                                                         | Ai phát hiện                             | Vì sao AI sai                                                                          |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| G1  | Câu tóm tắt bảng test case: "7 pass, 6 fail, 1 chưa biết"                             | Chính bảng AI lập cho 8 Pass / 5 Fail / 1 chưa chạy                             | Đếm lại theo bảng                                                 | AI-2 nêu, SV xác nhận và yêu cầu sửa     | Giới hạn của model: viết câu tóm tắt mà không đếm lại từ bảng                          |
| G2  | Chỉ trích ràng buộc Tên và Giá làm kết quả mong đợi                                   | Bỏ sót câu đặc tả "Danh mục: bắt buộc, phải chọn từ danh sách có sẵn"           | FR15-DT-01 chọn Danh mục khác mặc định và kiểm Danh mục được lưu  | AI-2 nêu, SV xác nhận và yêu cầu sửa     | Prompt chỉ nêu ví dụ về Tên và Giá; AI bám theo ví dụ thay vì rà đủ đặc tả             |
| G3  | Đề xuất FR15-DT-11 (Giá không phải số) chạy trên web                                  | Ô Giá là `type="number"`, mỗi browser xử lý khác nhau nên kết quả không ổn định | Chuyển sang danh sách không tự động hóa được; thêm DT-03 và DT-06 | AI-1 nêu rủi ro, SV quyết định           | Đặc thù feature: prompt yêu cầu có biên "không phải số", AI cố đáp ứng thay vì từ chối |
| G4  | Nói "case reject kiểm cả giao diện lẫn server"                                        | File dữ liệu của 10 case Thêm không có `server.othersUnchanged`                 | Thêm trường này cho 10 case                                       | AI-2 nêu, SV xác nhận và yêu cầu sửa     | Giới hạn của model: mô tả trong câu trả lời không khớp với dữ liệu đã sinh             |
| G5  | Gọi bug hiển thị sau khi Sửa là "nhiều khả năng là bug mới" và đặt nhãn `NEW-UI-EDIT` | Bug đã có issue #87 (BUG-41) trên repo nhóm                                     | Đổi nhãn thành `BUG-41`, chạy lại ba lượt                         | AI-1, khi SV yêu cầu report ghi số issue | AI chỉ đối chiếu với 6 bug FR-15 trong bài HW02, không tìm trên tracker chung          |

### 2.2 Script bản thô (B4) – `raw/fr15/B4_v1_products.spec.ts.txt`

| #   | Vị trí           | AI viết gì                                                                 | Sai / thiếu ở đâu                                                                                          | Sửa thành                                                                                                                                           | Ai phát hiện                         | Vì sao AI sai                                                                                                                                                                                                                                                                                               |
| --- | ---------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G6  | dòng 195         | Case Tên rỗng: kiểm `validity.valueMissing === true`                       | Thuộc tính này luôn đúng với ô `required` đang rỗng, kể cả khi chưa bấm Lưu; không chứng minh form bị chặn | Kiểm ô Tên nhận sự kiện `invalid`, form không bắn `submit`, không có yêu cầu ghi, form giữ nguyên trạng thái (đã thử trên 3 browser trước khi dùng) | AI-2 nêu, SV xác nhận và yêu cầu sửa | Chất lượng prompt: prompt B4 của tôi ghi "kiểm validity.valueMissing", tức tôi chỉ định sẵn cách kiểm thay vì nêu điều cần chứng minh là form bị chặn khi bấm Lưu. AI làm đúng câu chữ và không kiểm lại xem thuộc tính đó có đổi giá trị trước và sau cú click hay không                                   |
| G7  | dòng 192         | Case accept chỉ assert "có gửi yêu cầu"; case reject không assert phản hồi | Không kiểm status. Khi fail, report chỉ nói "bảng có 6 dòng", không nói server đã trả 200 cho dữ liệu sai  | Accept: phản hồi 2xx. Reject: nếu có yêu cầu thì status ≥ 400, kèm thông điệp "SUT đã NHẬN dữ liệu sai…"                                            | AI-2 nêu, SV xác nhận và yêu cầu sửa | File dữ liệu không có trường status; AI coi phản hồi mạng chỉ là mốc đồng bộ, không phải thứ cần kiểm                                                                                                                                                                                                       |
| G8  | dòng 43, 153–154 | `SETTLE_MS = 3000` với `waitForResponse(...).catch(() => null)`            | Là một lần ngủ cố định trá hình: case không gửi yêu cầu luôn chờ đủ 3 giây                                 | Ghi yêu cầu bằng `page.on('request')`; chờ theo số XHR đang chờ đếm ngay trong trang; case validation không chờ                                     | AI-1 nêu, SV yêu cầu sửa             | Chất lượng prompt kết hợp giới hạn của model: prompt cấm tên hàm `waitForTimeout` mà không nêu ý định là không được chờ theo thời gian cố định. Để kết luận "không có yêu cầu nào được gửi", AI cần một điểm dừng và chọn cách quen thuộc là chờ có giới hạn rồi bỏ qua lỗi, đúng câu chữ nhưng trái ý định |
| G9  | dòng 222–224     | Assertion giao diện dùng timeout mặc định 5 giây                           | Test fail vì bug mất 16 giây (3 assertion × 5 giây); lượt Chromium mất 2,4 phút                            | Sau khi trang đã ổn định, assertion giao diện chỉ thử lại 1 giây; lượt Chromium còn 54 giây                                                         | Chạy                                 | AI không tính chi phí thời gian của test fail, trong khi 8 / 15 test được kỳ vọng fail                                                                                                                                                                                                                      |
| G10 | dòng 212         | Bảng mong đợi nối dòng mới vào cuối                                        | Giả định thứ tự mà đặc tả không quy định                                                                   | So bảng không phụ thuộc thứ tự, thêm assertion "có đúng một dòng mang tên này"                                                                      | AI-1 nêu, SV yêu cầu sửa             | Suy từ hành vi quan sát của SUT thay vì từ đặc tả                                                                                                                                                                                                                                                           |
| G11 | dòng 222–224     | `toHaveCount` / `toHaveText` không có thông điệp                           | Report không nói test kiểm gì, phải đọc số dòng code                                                       | Thêm thông điệp tiếng Việt cho mọi assertion giao diện                                                                                              | Chạy                                 | Prompt không yêu cầu; AI chỉ viết thông điệp cho assertion phía server                                                                                                                                                                                                                                      |
| G12 | dòng 108         | Trường `bug` là một giá trị                                                | FR15-DT-20 lộ hai bug (BUG-24 và BUG-41) nhưng chỉ ghi được một                                            | `bug` là danh sách, mỗi bug một annotation                                                                                                          | Chạy                                 | Thiết kế dữ liệu ở B3 chưa lường trường hợp một case lộ nhiều bug                                                                                                                                                                                                                                           |
| G13 | thân test        | Một hàm test dài khoảng 170 dòng                                           | Khó đọc, khó chỉ ra bước Arrange – Act – Assert                                                            | Tách `arrange`, `act`, `assertUi`, `assertServer`                                                                                                   | AI-2 nêu, SV xác nhận và yêu cầu sửa | Prompt yêu cầu theo 3A nhưng không yêu cầu tách hàm                                                                                                                                                                                                                                                         |

### 2.3 Lỗi AI tạo ra trong lúc sửa (B6–B7)

| #   | AI viết gì                                                             | Sai ở đâu                                                                                                                                         | Sửa thành                                                     | Ai phát hiện                         | Vì sao AI sai                                                                                                                                                                                                |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G14 | `void page.addInitScript(...)` trong constructor của Page Object       | Không được await, nên không có gì bảo đảm script đã cài xong trước `goto`                                                                         | Bước `installProbe()` được await ở đầu `login()`              | AI-2 nêu, SV xác nhận và yêu cầu sửa | Constructor không await được; AI chọn `void` cho gọn thay vì chuyển sang bước async                                                                                                                          |
| G15 | Giữ `"state": "valueMissing"` trong file dữ liệu sau khi đổi cách kiểm | Tên trường không còn khớp với cách kiểm mới                                                                                                       | `"blockedBy": "browser-required"`                             | AI-2 nêu, SV xác nhận và yêu cầu sửa | AI sửa script nhưng không rà lại dữ liệu mô tả nó                                                                                                                                                            |
| G16 | Không cài `typescript`, không có `tsconfig.json` trong dự án           | Dự án chưa từng có bước kiểm kiểu                                                                                                                 | Thêm `typescript` và `tsconfig.json`                          | AI-2 nêu, SV xác nhận và yêu cầu sửa | Đặc thù công cụ: Playwright chạy thẳng file `.ts` mà không kiểm kiểu, nên suite vẫn chạy và pass dù thiếu bước này. Prompt của tôi không yêu cầu kiểm kiểu, và AI không tự đề xuất vì không có lỗi nào lộ ra |
| G17 | `global-setup.ts` chỉ reset backend                                    | Ở lượt chính thức thứ hai, hai frontend không chạy nên cả 15 test fail vì môi trường chứ không vì bug; chỉ phát hiện khi đọc report sau lượt chạy | Kiểm cả ba dịch vụ trước khi chạy, dừng ngay với thông báo rõ | AI-2 nêu, SV xác nhận và yêu cầu sửa | AI chỉ nghĩ tới dữ liệu, không nghĩ tới tình huống dịch vụ không chạy                                                                                                                                        |
| G18 | Report chính thức bật trace cho test fail                              | Ba report FR-15 nặng 29 MB                                                                                                                        | Tắt trace ở lượt chính thức, còn 4,8 MB                       | AI-1 và AI-2 cùng nêu                | Cấu hình ban đầu phục vụ gỡ lỗi, chưa tính tới việc report nằm trong repo                                                                                                                                    |

### 2.4 Bằng chứng trong report

| # | AI viết gì | Sai / thiếu ở đâu | Sửa thành | Ai phát hiện | Vì sao AI sai |
| --- | --- | --- | --- | --- | --- |
| G19 | Cấu hình `screenshot: 'only-on-failure'` từ giai đoạn 0, coi ảnh lúc fail là bằng chứng của bug | Ảnh tự động chỉ chụp khung nhìn, trong khi dòng lỗi nằm cuối bảng. Ở 4 / 5 bug, ảnh trong ba report hiện tại chỉ thấy form trống và dòng đầu bảng, không thấy bug. Chụp cả trang (`fullPage`) cũng không được vì trang Admin cuộn bên trong một khung cố định | Test chụp riêng bảng sản phẩm ngay sau thao tác và đính vào report (commit `328221b`); ba report chính thức sẽ được chạy lại | AI-1, khi mở ảnh để đăng lên issue | Cả hai phiên AI chỉ kiểm report qua tiêu đề, số pass / fail và annotation, không mở ảnh nào cho tới khi cần đăng lên issue |

## 3. Nhận xét chung

- **Lỗi nặng nhất nằm ở assertion, không nằm ở selector.** Selector của bản thô gần như không phải sửa, vì trước khi sinh code đã có bước B2 khảo sát trang thật. Ngược lại, hai assertion quan trọng (G6, G7) chạy xanh mà không chứng minh điều test cần chứng minh. Một test xanh chưa nói lên gì nếu tôi chưa tự hỏi nó sẽ đỏ trong trường hợp nào.
- **Prompt nêu cách làm thì AI làm đúng cách đó, kể cả khi cách đó sai.** G6 đến từ việc tôi chỉ định sẵn thuộc tính cần kiểm; G8 đến từ việc tôi cấm một tên hàm thay vì nêu ý định.
- **Sửa một lỗi có thể sinh lỗi khác.** Hai lỗi G14 và G15 xuất hiện trong chính các lần sửa ở B6.
- **AI suy kết quả mong đợi từ hành vi của SUT.** Giả định dòng mới nằm cuối bảng (G10) và nhãn "bug mới" (G5) đều đến từ việc nhìn SUT hoặc nhìn một phạm vi hẹp, không đối chiếu với đặc tả và tracker.
- **Điều AI làm đúng.** Dự đoán 7 pass / 8 fail trước khi chạy khớp với kết quả thật; việc dọn dữ liệu theo id hoạt động cả khi test fail; AI tự nêu trước một số điểm yếu (G8, G10) trong bản thô.

## 4. Test fail và bug tương ứng

| Test case              | Bug            | Tầng lộ lỗi                                        |
| ---------------------- | -------------- | -------------------------------------------------- |
| FR15-BV-05             | BUG-26         | Phản hồi 200, bảng thêm dòng, server thêm sản phẩm |
| FR15-DT-06             | BUG-27         | Như trên                                           |
| FR15-DT-08, FR15-DT-09 | BUG-24         | Như trên                                           |
| FR15-DT-10             | BUG-25         | Như trên                                           |
| FR15-DT-15, FR15-DT-34 | BUG-41         | Chỉ giao diện; dữ liệu phía server đúng            |
| FR15-DT-20             | BUG-24, BUG-41 | Phản hồi 200, server lưu giá 0, bảng hiển thị sai  |

Chi tiết từng bug: `bugs/Bug_Report.md`.

## 5. Test case không tự động hóa được

Xem mục 4 của `report/fr15_testcases.md`: 20 test case của HW02 không có thao tác tương ứng trên giao diện (Giá không phải số, Danh mục ngoài danh sách, id sản phẩm không tồn tại) hoặc cần hai phiên trình duyệt.
