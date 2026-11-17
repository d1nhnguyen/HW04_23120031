#!/usr/bin/env python3
"""
Chạy bộ test của MỘT feature trên ba browser, mỗi lượt một REPORT_DIR riêng, rồi in bảng
test case × browser và so bộ assertion fail của từng test case giữa các browser.

Cách dùng (chạy từ gốc dự án):
    python3 <skill>/scripts/run_matrix.py <feature> [--out DIR] [--browsers a,b,c] [--root DIR]
                                                    [--grep PATTERN] [--repeat-each N]

    <feature>     tên thư mục trong tests/, ví dụ fr15
    --out DIR     thư mục chứa report. Mặc định là một thư mục tạm (lượt gỡ lỗi).
                  Lượt chính thức: --out reports  → reports/<feature>-<browser>/index.html
    --browsers    mặc định chromium,firefox,webkit

Mỗi lượt là một lệnh `npx playwright test` riêng, nên global-setup (reset + kiểm môi trường)
chạy một lần cho mỗi feature × browser. Kết quả đọc từ JSON reporter, bật qua biến môi trường
JSON_REPORT (playwright.config.ts phải có reporter json đọc biến này).

Mã thoát:
    0  cả ba lượt chạy được và mọi test case cho cùng kết quả, cùng bộ assertion fail trên mọi browser
    1  có test case lệch giữa các browser (kết quả hoặc bộ assertion fail)
    2  có lượt không chạy được (môi trường chưa sẵn sàng, lỗi cấu hình)
Test fail vì bug của SUT KHÔNG làm mã thoát khác 0: đó là kết quả hợp lệ.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile

ANSI = re.compile(r"\x1b\[[0-9;]*m")


def normalise(message):
    """Dòng đầu của thông báo lỗi, bỏ màu và bỏ phần thay đổi theo lượt chạy (chuỗi trong nháy)."""
    first = ANSI.sub("", message or "").strip().split("\n")[0]
    first = re.sub(r"^Error:\s*", "", first)
    return re.sub(r'"[^"]*"', '"…"', first)


def collect(suite, out):
    for spec in suite.get("specs", []):
        for test in spec.get("tests", []):
            results = test.get("results", [])
            last = results[-1] if results else {}
            errors = [normalise(e.get("message")) for e in last.get("errors", [])]
            out.setdefault(spec["title"], []).append({
                "status": last.get("status", "không chạy"),
                "ms": last.get("duration", 0),
                "errors": errors,
            })
    for child in suite.get("suites", []):
        collect(child, out)


def run_browser(root, feature, browser, report_dir, json_path, extra):
    env = dict(os.environ, REPORT_DIR=report_dir, JSON_REPORT=json_path)
    command = ["npx", "playwright", "test", os.path.join("tests", feature), f"--project={browser}"] + extra
    proc = subprocess.run(command, cwd=root, env=env, capture_output=True, text=True)
    if not os.path.exists(json_path):
        return None, (proc.stdout + proc.stderr).strip()[-600:]
    with open(json_path, encoding="utf-8") as f:
        report = json.load(f)
    tests = {}
    for suite in report.get("suites", []):
        collect(suite, tests)
    if not tests:
        global_errors = [ANSI.sub("", e.get("message", "")) for e in report.get("errors", [])]
        return None, ("\n".join(global_errors) or (proc.stdout + proc.stderr)).strip()[-600:]
    return tests, None


def short(title):
    return title.split(" – ")[0].split(" - ")[0]


def verdict(runs):
    """Một test case trên một browser (có thể nhiều lần lặp): Pass nếu mọi lần pass."""
    statuses = {r["status"] for r in runs}
    if statuses == {"passed"}:
        return "Pass"
    if "passed" in statuses:
        return "Lúc pass lúc fail"
    if statuses == {"skipped"}:
        return "Bỏ qua"
    return "Fail"


def main():
    parser = argparse.ArgumentParser(description="Chạy một feature trên ba browser và so kết quả.")
    parser.add_argument("feature")
    parser.add_argument("--out")
    parser.add_argument("--browsers", default="chromium,firefox,webkit")
    parser.add_argument("--root", default=".")
    parser.add_argument("--grep")
    parser.add_argument("--repeat-each", type=int)
    args = parser.parse_args()

    root = os.path.abspath(args.root)
    browsers = [b.strip() for b in args.browsers.split(",") if b.strip()]
    out = os.path.abspath(args.out) if args.out else tempfile.mkdtemp(prefix=f"run-matrix-{args.feature}-")
    os.makedirs(out, exist_ok=True)
    json_dir = tempfile.mkdtemp(prefix="run-matrix-json-")
    extra = []
    if args.grep:
        extra += ["-g", args.grep]
    if args.repeat_each:
        extra += [f"--repeat-each={args.repeat_each}"]

    print(f"Feature {args.feature} · browser: {', '.join(browsers)} · report: {out}"
          + ("" if args.out else "  (thư mục tạm, lượt gỡ lỗi)"))

    results, broken = {}, []
    for browser in browsers:
        report_dir = os.path.join(out, f"{args.feature}-{browser}")
        print(f"  chạy {browser} …", flush=True)
        tests, error = run_browser(root, args.feature, browser, report_dir,
                                   os.path.join(json_dir, f"{browser}.json"), extra)
        if tests is None:
            broken.append(browser)
            print(f"  [{browser}] KHÔNG CHẠY ĐƯỢC:\n{error}\n")
        else:
            results[browser] = tests
            passed = sum(1 for runs in tests.values() if verdict(runs) == "Pass")
            seconds = sum(r["ms"] for runs in tests.values() for r in runs) / 1000
            print(f"  [{browser}] {passed} pass / {len(tests) - passed} fail · {seconds:.0f} giây · {report_dir}/index.html")

    if not results:
        print("\nKhông lượt nào chạy được. Kiểm tra SUT rồi chạy lại.")
        return 2

    titles = []
    for tests in results.values():
        for title in tests:
            if title not in titles:
                titles.append(title)
    ran = [b for b in browsers if b in results]

    # --- bảng test case × browser ---
    width = max(len(short(t)) for t in titles)
    print("\n| " + "Test case".ljust(width) + " | " + " | ".join(b.ljust(18) for b in ran) + " | Assertion fail |")
    print("| " + "-" * width + " | " + " | ".join("-" * 18 for _ in ran) + " | --- |")
    mismatches, flaky = [], []
    for title in titles:
        cells, verdicts, error_sets = [], [], []
        for browser in ran:
            runs = results[browser].get(title)
            if not runs:
                cells.append("không có".ljust(18))
                verdicts.append("không có")
                error_sets.append(None)
                continue
            v = verdict(runs)
            seconds = sum(r["ms"] for r in runs) / len(runs) / 1000
            cells.append(f"{v} {seconds:.1f}s".ljust(18))
            verdicts.append(v)
            error_sets.append(tuple(sorted({tuple(r["errors"]) for r in runs})))
            if v == "Lúc pass lúc fail":
                flaky.append((short(title), browser))
        same_verdict = len(set(verdicts)) == 1
        same_errors = len(set(error_sets)) == 1
        n_errors = len(error_sets[0][0]) if error_sets[0] else 0
        if same_verdict and same_errors:
            note = "–" if n_errors == 0 else f"{n_errors}, giống nhau"
        else:
            note = "LỆCH"
            mismatches.append((title, dict(zip(ran, zip(verdicts, error_sets)))))
        print("| " + short(title).ljust(width) + " | " + " | ".join(cells) + f" | {note} |")

    print("\nTổng: " + " · ".join(
        f"{b} {sum(1 for r in results[b].values() if verdict(r) == 'Pass')} pass / "
        f"{sum(1 for r in results[b].values() if verdict(r) != 'Pass')} fail" for b in ran))

    # --- bộ assertion fail của từng test case fail (lấy từ browser đầu tiên) ---
    failing = [t for t in titles if verdict(results[ran[0]].get(t, [{"status": "?"}])) != "Pass"]
    if failing:
        print(f"\nBộ assertion fail ({ran[0]}):")
        for title in failing:
            errors = results[ran[0]][title][-1]["errors"]
            print(f"  {short(title)} ({len(errors)}):")
            for error in errors:
                print(f"    - {error[:110]}")

    if mismatches:
        print("\nTEST CASE LỆCH GIỮA CÁC BROWSER (tìm nguyên nhân gốc trước khi sửa; không thêm retry, không nới timeout):")
        for title, by_browser in mismatches:
            print(f"  {short(title)}")
            for browser, (v, errors) in by_browser.items():
                print(f"    [{browser}] {v}: {list(errors[0]) if errors else '–'}")
    if flaky:
        print("\nLÚC PASS LÚC FAIL (flaky): " + ", ".join(f"{t} [{b}]" for t, b in flaky))
    if broken:
        print(f"\nLượt không chạy được: {', '.join(broken)}")
        return 2
    if mismatches or flaky:
        return 1
    print("\nMọi test case cho cùng kết quả và cùng bộ assertion fail trên " + ", ".join(ran) + ".")
    return 0


if __name__ == "__main__":
    sys.exit(main())
