#!/usr/bin/env python3
"""
Kiểm tra CƠ HỌC bộ script test của một feature theo references/review-checklist.md.

Linter chỉ bắt những lỗi máy nhìn thấy được trong mã và file dữ liệu:
chờ cố định dưới mọi hình thức, dữ liệu ghi cứng trong script, số test case và số kiểu
assertion so với ngưỡng trong automation.config.json, đủ ba browser, dấu "Run by".

Linter KHÔNG biết kết quả mong đợi (expected) đúng hay sai so với đặc tả, không biết một
assertion có "đỏ được khi SUT sai" hay không, và không mở ảnh bằng chứng. Ba việc đó vẫn là
của người review ở bước B6.

Cách dùng (chạy từ gốc dự án):
    python3 <skill>/scripts/lint_suite.py <feature> [--root DIR] [--spec FILE ...] [--no-list]

    <feature>   tên thư mục trong tests/ và tiền tố file trong data/, ví dụ fr15
    --spec      kiểm các file này thay cho tests/<feature>/*.spec.ts (dùng để kiểm một bản thô)
    --no-list   không gọi `npx playwright test --list` (bỏ qua mục đếm test và ba browser)

Mã thoát: 1 nếu có ERROR, 0 nếu không (WARN chỉ là nhắc nhở).
"""
import argparse
import glob
import json
import os
import re
import subprocess
import sys

msgs = []


def add(level, where, text):
    msgs.append((level, where, text))


# --------------------------------------------------------------------------- #
# Đọc mã nguồn
# --------------------------------------------------------------------------- #

def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def strip_comments(src):
    """Thay chú thích bằng khoảng trắng, giữ nguyên số dòng. Không đụng '//' trong 'http://'."""
    def blank(m):
        return re.sub(r"[^\n]", " ", m.group(0))
    src = re.sub(r"/\*.*?\*/", blank, src, flags=re.S)
    src = re.sub(r"(?<![:'\"`\\/])//[^\n]*", blank, src)
    return src


def line_of(src, pos):
    return src.count("\n", 0, pos) + 1


def has_comment_above(raw, line, span=6):
    """Có chú thích trong `span` dòng ngay phía trên dòng `line` (1-based) hay không."""
    lines = raw.split("\n")
    above = lines[max(0, line - 1 - span):line - 1]
    return any(re.search(r"^\s*(//|/\*|\*)", l) for l in above)


# --------------------------------------------------------------------------- #
# 1. Chờ theo thời gian cố định, dưới mọi hình thức
# --------------------------------------------------------------------------- #

FIXED_WAITS = [
    (r"\bwaitForTimeout\s*\(", "waitForTimeout: chờ cố định"),
    (r"\bsetTimeout\s*\(", "setTimeout: chờ cố định"),
    (r"\bsleep\s*\(", "sleep: chờ cố định"),
]
EVENT_WAITS = r"\bwaitFor(Response|Request|Event)\s*\("


def check_waits(path, raw, code):
    for pattern, label in FIXED_WAITS:
        for m in re.finditer(pattern, code):
            add("ERROR", f"{path}:{line_of(code, m.start())}", label)
    # waitForResponse / waitForRequest / waitForEvent rồi nuốt lỗi timeout = ngủ đủ timeout khi không có sự kiện
    for m in re.finditer(EVENT_WAITS, code):
        statement = code[m.start():m.start() + 400].split(";")[0]
        if re.search(r"\.catch\s*\(", statement):
            add("ERROR", f"{path}:{line_of(code, m.start())}",
                f"waitFor{m.group(1)}(...) rồi .catch(): khi không có sự kiện, lệnh này ngủ đủ timeout "
                "(chờ cố định trá hình)")
    for m in re.finditer(r"waitForLoadState\s*\(\s*['\"]networkidle['\"]", code):
        add("WARN", f"{path}:{line_of(code, m.start())}",
            "waitForLoadState('networkidle'): chờ theo khoảng lặng cố định, dễ flaky")
    # timeout ghi số: chỉ chấp nhận khi có chú thích nêu căn cứ ngay phía trên
    for m in re.finditer(r"\btimeout\s*:\s*\d+", code):
        line = line_of(code, m.start())
        if not has_comment_above(raw, line):
            add("WARN", f"{path}:{line}",
                f"'{m.group(0)}' không có chú thích nêu căn cứ ngay phía trên; rút hay nới timeout phải có lý do")


# --------------------------------------------------------------------------- #
# 2. Dữ liệu ghi cứng trong script
# --------------------------------------------------------------------------- #

# Khóa mà giá trị là TỪ KHÓA của cấu trúc dữ liệu chứ không phải giá trị test.
# {"ref": "setup"} nghĩa là "lấy giá trị đã tạo ở setup": "setup" là tên một phần của test case,
# script được phép viết nó ra (ví dụ trong kiểu `{ ref: 'setup' }`).
STRUCTURAL_KEYS = ("ref",)


def data_leaves(node, under=None, out=None):
    """Thu các giá trị test trong file dữ liệu: mọi giá trị dưới input / setup, và chuỗi dài, số lớn dưới expected.
    Bỏ qua giá trị của các khóa trong STRUCTURAL_KEYS."""
    out = out if out is not None else set()
    if isinstance(node, dict):
        for key, value in node.items():
            if key in STRUCTURAL_KEYS:
                continue
            data_leaves(value, key if key in ("input", "setup", "expected") else under, out)
    elif isinstance(node, list):
        for value in node:
            data_leaves(value, under, out)
    elif under in ("input", "setup"):
        if isinstance(node, str) and len(node.strip()) >= 3:
            out.add(node)
        elif isinstance(node, (int, float)) and not isinstance(node, bool) and abs(node) >= 100:
            out.add(node)
    elif under == "expected":
        if isinstance(node, str) and len(node) >= 8 and (" " in node or not node.isascii()):
            out.add(node)
        elif isinstance(node, (int, float)) and not isinstance(node, bool) and abs(node) >= 100:
            out.add(node)
    return out


def config_secrets(config):
    """Giá trị riêng của dự án không được xuất hiện trong script."""
    values = {}
    if config.get("runBy"):
        values[str(config["runBy"])] = "runBy"
    for name, acc in (config.get("accounts") or {}).items():
        for field in ("email", "password"):
            if acc.get(field):
                values[acc[field]] = f"accounts.{name}.{field}"
    for name, value in (config.get("urls") or {}).items():
        values[value] = f"urls.{name}"
    if (config.get("sut") or {}).get("dir"):
        values[config["sut"]["dir"]] = "sut.dir"
    return values


def literal_pattern(value):
    if isinstance(value, str):
        return r"(['\"`])" + re.escape(value) + r"\1"
    text = str(int(value)) if float(value).is_integer() else str(value)
    return r"(?<![\w.])" + re.escape(text) + r"(?![\w.])"


def check_hardcoded(path, code, leaves, secrets, is_spec):
    for value, key in secrets.items():
        for m in re.finditer(re.escape(value), code):
            add("ERROR", f"{path}:{line_of(code, m.start())}",
                f"giá trị riêng của dự án ghi cứng trong script ({key} trong automation.config.json)")
    if not is_spec:
        return
    for value in sorted(leaves, key=str):
        for m in re.finditer(literal_pattern(value), code):
            shown = value if not isinstance(value, str) or len(value) <= 40 else value[:40] + "…"
            add("ERROR", f"{path}:{line_of(code, m.start())}",
                f"giá trị test ghi cứng trong spec, đã có trong file dữ liệu: {shown!r}")
    for m in re.finditer(r"[\w.+-]+@[\w-]+\.[\w.]+", code):
        add("ERROR", f"{path}:{line_of(code, m.start())}", f"địa chỉ email ghi cứng trong spec: {m.group(0)}")
    for m in re.finditer(r"https?://[^\s'\"`)]+", code):
        add("ERROR", f"{path}:{line_of(code, m.start())}", f"URL ghi cứng trong spec: {m.group(0)}")
    for m in re.finditer(r"\b(const|let)\s+\w+\s*(:[^=]+)?=\s*\[\s*\{", code):
        add("WARN", f"{path}:{line_of(code, m.start())}",
            "mảng object khai báo ngay trong spec; nếu là dữ liệu test thì phải chuyển ra file dữ liệu")


# --------------------------------------------------------------------------- #
# 3. Kiểu assertion
# --------------------------------------------------------------------------- #

ASSERTION_KINDS = [
    ("Điều hướng", r"\.toHaveURL\(|\.toHaveTitle\("),
    ("Nội dung / hiển thị", r"\.toBeVisible\(|\.toBeHidden\(|\.toHaveText\(|\.toContainText\(|\.toBeAttached\("),
    ("Số lượng phần tử", r"\.toHaveCount\("),
    ("Giá trị ô nhập / thuộc tính", r"\.toHaveValue\(|\.toHaveValues\(|\.toHaveAttribute\(|\.toBeChecked\(|\.toHaveJSProperty\("),
    ("Trạng thái phần tử", r"\.toBeEnabled\(|\.toBeDisabled\(|\.toBeFocused\(|\.toBeEditable\("),
    ("Hộp thoại", r"\bdialogs\b[^;]{0,300}?\)\s*\.to\w+\(|dialog\.message\(\)"),
    ("Phản hồi mạng", r"\b(expect|soft)\w*(\.\w+)*\([^;]{0,200}?\.(status|ok)\(\)"),
    ("Dữ liệu đọc lại / giá trị tính được",
     r"\)\s*\.(not\.)?(toBe|toEqual|toStrictEqual|toBeNull|toBeDefined|toBeGreaterThan\w*|toBeLessThan\w*|toContain|toMatchObject)\("),
]


def assertion_kinds(code_by_path):
    found = []
    for name, pattern in ASSERTION_KINDS:
        count = sum(len(re.findall(pattern, code)) for code in code_by_path.values())
        if count:
            found.append((name, count))
    return found


# --------------------------------------------------------------------------- #
# 4. Số test case, ba browser (qua `npx playwright test --list`)
# --------------------------------------------------------------------------- #

def list_tests(root, target):
    try:
        result = subprocess.run(["npx", "playwright", "test", target, "--list"], cwd=root,
                                capture_output=True, text=True, timeout=120)
    except (OSError, subprocess.TimeoutExpired) as error:
        return None, str(error)
    per_project = {}
    for line in result.stdout.splitlines():
        m = re.match(r"\s*\[([^\]]+)\]\s+›", line)
        if m:
            per_project[m.group(1)] = per_project.get(m.group(1), 0) + 1
    if not per_project:
        return None, (result.stdout + result.stderr).strip()[-400:]
    return per_project, None


# --------------------------------------------------------------------------- #
# Chạy
# --------------------------------------------------------------------------- #

def main():
    parser = argparse.ArgumentParser(description="Kiểm tra cơ học bộ script test của một feature.")
    parser.add_argument("feature")
    parser.add_argument("--root", default=".")
    parser.add_argument("--spec", nargs="*")
    parser.add_argument("--no-list", action="store_true")
    args = parser.parse_args()
    root = os.path.abspath(args.root)

    def rel(path):
        return os.path.relpath(path, root)

    # --- tham số của dự án ---
    config_path = os.path.join(root, "automation.config.json")
    if not os.path.exists(config_path):
        add("ERROR", "automation.config.json", "không có file tham số của dự án")
        config = {}
    else:
        config = json.loads(read(config_path))
    for key in ("runBy", "minTestCases", "minAssertionKinds"):
        if not config.get(key):
            add("ERROR", "automation.config.json", f"thiếu tham số '{key}'")
    min_cases = int(config.get("minTestCases") or 0)
    min_kinds = int(config.get("minAssertionKinds") or 0)

    # --- file của feature ---
    custom_spec = bool(args.spec)
    specs = [os.path.abspath(p) for p in args.spec] if custom_spec else sorted(
        glob.glob(os.path.join(root, "tests", args.feature, "**", "*.spec.ts"), recursive=True))
    if not specs:
        add("ERROR", f"tests/{args.feature}/", "không có file .spec.ts nào")
    data_files = sorted(glob.glob(os.path.join(root, "data", f"{args.feature}.*.json")) +
                        glob.glob(os.path.join(root, "data", f"{args.feature}.*.csv")))
    if not data_files:
        add("ERROR", f"data/{args.feature}.*", "không có file dữ liệu .json / .csv riêng cho feature")
    shared = sorted(glob.glob(os.path.join(root, "pages", "*.ts")) + glob.glob(os.path.join(root, "support", "*.ts")))

    leaves, n_cases = set(), 0
    for path in data_files:
        if not path.endswith(".json"):
            add("WARN", rel(path), "file CSV: linter chưa đọc giá trị để dò dữ liệu ghi cứng, chỉ đếm số dòng")
            n_cases += max(0, len(read(path).strip().splitlines()) - 1)
            continue
        data = json.loads(read(path))
        cases = data.get("cases") if isinstance(data, dict) else data
        if not isinstance(cases, list):
            add("ERROR", rel(path), "không tìm thấy danh sách test case (mảng ở gốc hoặc khóa 'cases')")
            continue
        n_cases += len(cases)
        data_leaves(cases, None, leaves)
        ids = [c.get("id") for c in cases if isinstance(c, dict)]
        for dup in sorted({i for i in ids if ids.count(i) > 1}, key=str):
            add("ERROR", rel(path), f"trùng id test case: {dup}")
        for c in cases:
            if isinstance(c, dict) and "expected" not in c:
                add("ERROR", rel(path), f"{c.get('id')}: không có 'expected'")

    secrets = config_secrets(config)
    spec_code = {}
    for path in specs:
        raw = read(path)
        code = strip_comments(raw)
        spec_code[rel(path)] = code
        check_waits(rel(path), raw, code)
        check_hardcoded(rel(path), code, leaves, secrets, is_spec=True)
        for m in re.finditer(r"\btest\.only\s*\(|\bdescribe\.only\s*\(", code):
            add("ERROR", f"{rel(path)}:{line_of(code, m.start())}", "test.only: phần còn lại của suite không chạy")
        for m in re.finditer(r"\btest\.(fail|fixme|skip)\s*\(", code):
            add("WARN", f"{rel(path)}:{line_of(code, m.start())}",
                f"test.{m.group(1)}: test được kỳ vọng fail vì bug phải để đỏ, không đảo màu hay bỏ qua")
        for m in re.finditer(r"\.reload\s*\(", code):
            add("WARN", f"{rel(path)}:{line_of(code, m.start())}",
                "tải lại trang trong test: assert sau khi tải lại sẽ che lỗi hiển thị")
        if not re.search(r"readFileSync|require\([^)]*\.json|from\s+['\"][^'\"]*\.json|csv", code):
            add("ERROR", rel(path), "spec không đọc file dữ liệu nào")
        if not re.search(r"for\s*\(\s*const\s+\w+\s+of\s+", code):
            add("WARN", rel(path), "không thấy vòng for...of sinh test từ dữ liệu")
        if not re.search(r"['\"]Run by['\"]", code):
            add("ERROR", rel(path), "spec không gắn annotation 'Run by' vào test")
        if not re.search(r"await\s+use\s*\(", code):
            add("WARN", rel(path), "không thấy fixture (await use(...)): việc dọn dữ liệu có chạy khi test fail không?")
        if not re.search(r"\.screenshot\s*\(|testInfo\.attach\s*\(", code):
            add("WARN", rel(path), "test không tự chụp vùng chứa bằng chứng; ảnh tự động lúc fail chỉ chụp khung nhìn")
    shared_code = {}
    for path in shared:
        raw = read(path)
        code = strip_comments(raw)
        shared_code[rel(path)] = code
        check_waits(rel(path), raw, code)
        check_hardcoded(rel(path), code, leaves, secrets, is_spec=False)

    # --- cấu hình Playwright ---
    pw_path = os.path.join(root, "playwright.config.ts")
    if os.path.exists(pw_path):
        pw = strip_comments(read(pw_path))
        check_hardcoded("playwright.config.ts", pw, leaves, secrets, is_spec=False)
        if not re.search(r"title\s*:\s*[`'\"][^`'\"]*Run by", pw):
            add("ERROR", "playwright.config.ts", "tiêu đề HTML report không có 'Run by'")
        if not re.search(r"toISOString\s*\(", pw):
            add("WARN", "playwright.config.ts", "không thấy timestamp ISO đi kèm 'Run by'")
        m = re.search(r"\bretries\s*:\s*(\d+)", pw)
        if m and int(m.group(1)) > 0:
            add("WARN", "playwright.config.ts", f"retries = {m.group(1)}: retry che flaky, không chữa nó")
        if not re.search(r"\bglobalSetup\s*:", pw):
            add("ERROR", "playwright.config.ts", "không khai báo globalSetup (kiểm môi trường trước khi chạy)")
    else:
        add("ERROR", "playwright.config.ts", "không có file cấu hình Playwright")
    gs_path = os.path.join(root, "global-setup.ts")
    if os.path.exists(gs_path):
        gs = strip_comments(read(gs_path))
        check_hardcoded("global-setup.ts", gs, leaves, secrets, is_spec=False)
        if not re.search(r"services", gs):
            add("ERROR", "global-setup.ts", "global-setup không kiểm tra các dịch vụ của SUT trước khi chạy")

    # --- số test case ---
    if min_cases and n_cases < min_cases:
        add("ERROR", f"data/{args.feature}.*", f"có {n_cases} test case trong file dữ liệu, ngưỡng minTestCases là {min_cases}")

    # --- kiểu assertion ---
    # Chỉ đếm trong spec: expect trong Page Object và lớp API là bước đồng bộ / dựng dữ liệu, không phải assertion của test.
    kinds = assertion_kinds(spec_code)
    if min_kinds and len(kinds) < min_kinds:
        add("ERROR", f"tests/{args.feature}/", f"chỉ có {len(kinds)} kiểu assertion, ngưỡng minAssertionKinds là {min_kinds}")

    # --- ba browser, số test thật ---
    per_project = None
    if custom_spec:
        add("WARN", "--spec", "kiểm file chỉ định: bỏ qua mục đếm test thật và ba browser")
    elif not args.no_list and specs:
        per_project, error = list_tests(root, os.path.join("tests", args.feature))
        if per_project is None:
            add("ERROR", "npx playwright test --list", f"không liệt kê được test: {error}")
        else:
            if len(per_project) < 3:
                add("ERROR", "playwright.config.ts",
                    f"chỉ có {len(per_project)} browser ({', '.join(per_project)}), cần ít nhất 3")
            for project, count in per_project.items():
                if min_cases and count < min_cases:
                    add("ERROR", f"[{project}]", f"{count} test, ngưỡng minTestCases là {min_cases}")
                if n_cases and count != n_cases:
                    add("WARN", f"[{project}]", f"{count} test nhưng file dữ liệu có {n_cases} test case")

    # --- in kết quả ---
    order = {"ERROR": 0, "WARN": 1}
    for level, where, text in sorted(msgs, key=lambda m: (order[m[0]], m[1])):
        print(f"[{level}] {where}: {text}")
    n_err = sum(1 for m in msgs if m[0] == "ERROR")
    n_warn = len(msgs) - n_err
    if msgs:
        print()
    print(f"Feature {args.feature}: {len(specs)} spec · {n_cases} test case trong file dữ liệu"
          + (f" (ngưỡng {min_cases})" if min_cases else ""))
    if per_project:
        print("Browser: " + ", ".join(f"{name} ({count} test)" for name, count in per_project.items()))
    print(f"Kiểu assertion: {len(kinds)}" + (f" (ngưỡng {min_kinds})" if min_kinds else ""))
    for name, count in kinds:
        print(f"  - {name}: {count} chỗ")
    print(f"\n{n_err} ERROR · {n_warn} WARN")
    print("Lưu ý: linter chỉ kiểm cơ học. Nó KHÔNG biết expected đúng hay sai so với đặc tả, "
          "không biết assertion có đỏ được khi SUT sai hay không, và không mở ảnh bằng chứng.")
    return 1 if n_err else 0


if __name__ == "__main__":
    sys.exit(main())
