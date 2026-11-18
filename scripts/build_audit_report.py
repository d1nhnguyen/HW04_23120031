#!/usr/bin/env python3
"""Dựng ai/AI_Audit_Report.md từ transcript Claude Code của HW04 (dùng lại parser của export_prompt_log.py).

Mỗi lượt: công cụ AI, thời gian, prompt nguyên văn, tóm tắt output. Tóm tắt output là câu mở đầu của câu trả lời
cuối cùng trong lượt, trích tự động (câu trả lời của AI-1 và AI-2 luôn mở đầu bằng kết quả). Output nguyên văn đầy đủ
nằm ở Phụ lục A (ai/prompt_log.md, sinh bởi export_prompt_log.py).

    python3 scripts/build_audit_report.py
"""
import re
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_prompt_log import DEFAULT_SOURCES, MODEL_NAMES, PROJECTS, TZ, fence, parse_session  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "ai" / "AI_Audit_Report.md"


def first_sentence(text, limit=260):
    text = re.sub(r"`{3,}.*?`{3,}", " ", text, flags=re.S)       # bỏ khối code
    text = re.sub(r"^\s*(#+|[-*]|\|).*$", "", text, flags=re.M)   # bỏ tiêu đề, gạch đầu dòng, bảng
    text = re.sub(r"\*\*|__|\[([^\]]+)\]\([^)]+\)", lambda m: m.group(1) or "", text)
    text = re.sub(r"\s+", " ", text).strip()
    m = re.match(r"(.+?[.!?:])(\s|$)", text)
    s = m.group(1) if m else text
    return s if len(s) <= limit else s[:limit].rsplit(" ", 1)[0] + " …"


def summary(it):
    if not it["outputs"]:
        return "(không có văn bản trả lời; lệnh của công cụ, ví dụ /login hoặc /model)"
    return first_sentence(it["outputs"][-1])


def main():
    items = []
    for folder, prefix, role in DEFAULT_SOURCES:
        for f in sorted((PROJECTS / folder).glob(f"{prefix}*.jsonl")):
            items.extend(parse_session(f, role))
    items.sort(key=lambda it: it["time"])
    first, last = items[0]["time"], items[-1]["time"]
    n1 = sum(it["role"] == "AI-1" for it in items)
    n2 = len(items) - n1

    out = [
        "# AI Audit Report · HW04 · 23120031",
        "",
        "Phụ lục bắt buộc theo đề HW04 §9 và mẫu [AI-02] – FIT@HCMUS – AI Audit Report.",
        "",
        "> Mục 1–3, bảng ở mục 4 và mục 6 được dựng tự động bằng `scripts/build_audit_report.py` từ transcript của "
        "hai phiên AI. Mục 5 do AI-2 soạn nháp, sinh viên đọc và duyệt.",
        "",
        "## 1. Thông tin sinh viên",
        "",
        "| Mục | Giá trị |",
        "| --- | --- |",
        "| Họ tên sinh viên (in hoa) | NGUYỄN PHÚ DINH |",
        "| MSSV | 23120031 |",
        "| Lớp / Khoá | CQ2023/3 |",
        "| Mã bài tập | HW04 – AI-Assisted Automation Testing trên EShop |",
        f"| Thời gian dùng AI | {first:%d/%m/%Y %H:%M} – {last:%d/%m/%Y %H:%M} (GMT+7) |",
        "| Có dùng AI | [x] Có [ ] Không |",
        "",
        "**Khai báo theo đề §9:** _I use AI tools for the following tasks_ – tôi sử dụng công cụ AI cho các công việc sau: "
        "đọc đề và lập kế hoạch; dựng dự án Playwright và script điều khiển SUT; chọn test case từ bộ test case HW02; "
        "khảo sát trang thật; sinh file dữ liệu, Page Object và spec cho FR-15, FR-01, FR-10; review và sửa script; "
        "chạy ba browser và phân loại test fail; xây dựng Agent Skill `data-driven-web-automation`; nháp tài liệu nộp "
        "(gap analysis, bug report, README, báo cáo). Các phần không do AI làm: HTML report chính thức (sinh viên tự chạy), "
        "video demo, AI Critique.",
        "",
        "## 2. Công cụ AI",
        "",
        "| Vai trò | Công cụ | Phiên bản | Model | Phiên (transcript) | Số lượt |",
        "| --- | --- | --- | --- | --- | --- |",
        f"| AI-1 – viết script | Claude Code (VS Code extension) | 2.1.325 | Claude Fable 5.2; Claude Opus 5.5 từ lượt có `/model opus` | `843d9cd5`, `cea4708c` | {n1} |",
        f"| AI-2 – review | Claude Code CLI | 2.1.326 | Claude Fable 5.2 | `7ed1ce04` | {n2} |",
        "",
        "Công cụ kiểm thử (không phải AI): Playwright Test 1.65.1 với Playwright HTML reporter; TypeScript (`tsc --noEmit`).",
        "",
        "## 3. Cách audit",
        "",
        "- **Nguồn:** transcript `.jsonl` của Claude Code trong `~/.claude/projects/` "
        "(`-home-npdinh-study-Homeworks` cho AI-1, `-home-npdinh-study-Homeworks-HW04-HW04-23120031` cho AI-2). "
        "`scripts/export_prompt_log.py` (dựa trên script cùng tên của HW02) trích từng lượt; `scripts/build_audit_report.py` dựng file này.",
        "- **Một lượt** = một prompt sinh viên gửi, cùng mọi câu trả lời và hành động của AI cho tới prompt kế tiếp. "
        "Không tính thông báo của hệ thống (tác vụ nền, tóm tắt hội thoại).",
        "- **Prompt** giữ nguyên văn, kể cả phần dán vào. **Tóm tắt output** là câu mở đầu của câu trả lời cuối trong lượt, "
        "trích tự động; output nguyên văn đầy đủ và danh sách hành động AI đã chạy nằm ở **Phụ lục A: `ai/prompt_log.md`**.",
        "- **Cách hai phiên làm việc với nhau:** sinh viên dán kết quả của AI-1 sang AI-2; AI-2 đối chiếu với đặc tả, mã nguồn SUT "
        "và tracker rồi đề xuất sửa; sinh viên chọn, sửa lời và gửi prompt cho AI-1. Vì vậy nhiều prompt của AI-1 có nội dung "
        "giống phần đề xuất trong output của lượt AI-2 ngay trước đó.",
        "- **Đánh giá output AI** (sai ở đâu, ai phát hiện, vì sao AI sai) nằm trong gap analysis của từng feature: "
        "`report/fr15_gap_analysis.md`, `report/fr01_gap_analysis.md`, `report/fr10_gap_analysis.md`. Output dạng file là "
        "các commit trong `git_commit_log.txt`; bản thô AI sinh ở bước B4 lưu nguyên văn trong `raw/<feature>/`.",
        "",
        f"## 4. Bảng audit — {len(items)} lượt",
        "",
        "| # | Thời gian (GMT+7) | Vai trò | Công cụ, model | Prompt (rút gọn) | Tóm tắt output |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for i, it in enumerate(items, 1):
        model = MODEL_NAMES.get(it["model"], it["model"] or "–")
        tool = "VS Code" if "VS Code" in it["tool"] else "CLI"
        short = re.sub(r"\s+", " ", it["prompt"])[:110].replace("|", "\\|")
        out.append(f"| {i} | {it['time']:%Y-%m-%d %H:%M} | {it['role']} | {tool}, {model} | {short} | "
                   f"{summary(it).replace('|', chr(92) + '|')} |")
    out += ["", "## 5. Nhận xét của sinh viên", "", "**AI giúp được gì.** AI làm phần lớn việc sinh code: Page Object, spec, file dữ liệu, fixture, script chạy "
            "và Agent Skill. AI cũng soạn bản nháp các tài liệu: gap analysis, bug report, AI Critique và mục này.", "",
            "**AI sai ở đâu.** Chủ yếu ở assertion, cách chờ và bằng chứng. Danh sách đầy đủ nằm ở "
            "`report/fr15_gap_analysis.md`, `report/fr01_gap_analysis.md` và `report/fr10_gap_analysis.md`; "
            "tóm tắt ở `ai/AI_Critique.md`.", "",
            "**Cách kiểm soát.**", "",
            "- Tôi duyệt test case và kết quả mong đợi theo đặc tả ở các điểm dừng.",
            "- Một phiên AI thứ hai (AI-2) chỉ dùng để review kết quả của phiên viết script (AI-1).",
            "- Cổng tự động trước mỗi commit: `tsc --noEmit`, `lint_suite.py`, chạy lại trên Chromium và chạy lặp.",
            "- Chín lượt chạy chính thức và video demo do tôi tự chạy và tự quay.", "",
            "**Giới hạn.** Ở FR-15 tôi đọc từng diff. Ở FR-01 và FR-10, vì sát hạn nộp, tôi không đọc từng diff mà "
            "dựa vào cổng tự động và AI-2. Các bản nháp do AI soạn được tôi đọc và duyệt trước khi nộp.", "",
            "## 6. Chi tiết từng lượt (prompt nguyên văn)", ""]
    for i, it in enumerate(items, 1):
        model = MODEL_NAMES.get(it["model"], it["model"] or "–")
        out += [
            f"### #{i} · {it['time']:%Y-%m-%d %H:%M:%S} · {it['role']} · phiên `{it['session']}`",
            "",
            f"- **Công cụ AI:** {it['tool']} {it['version']}, model {model}",
            f"- **Tóm tắt output:** {summary(it)}",
            f"- **Số hành động AI đã chạy:** {len(it['actions'])} (danh sách ở Phụ lục A, lượt #{i})",
            "",
            "**Prompt (nguyên văn):**",
            "",
            fence(it["prompt"], "text"),
            "",
        ]
    out += ["## Chữ ký", "", "Sinh viên: ______________________ Ngày: ____ / ____ / 2026", ""]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(out), encoding="utf-8")
    print(f"{len(items)} lượt -> {OUT} (dựng lúc {datetime.now(TZ):%Y-%m-%d %H:%M})")


if __name__ == "__main__":
    main()
