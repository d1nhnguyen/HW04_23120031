#!/usr/bin/env python3
"""Trích prompt + output từ transcript Claude Code (.jsonl) của HW04 thành ai/prompt_log.md.

Dựa trên scripts/export_prompt_log.py của HW02. Khác biệt:
- đọc hai thư mục transcript: phiên viết script (AI-1, VS Code extension) và phiên review (AI-2, CLI);
- bóc thẻ <pasted_content> để giữ nguyên văn prompt dán vào;
- công cụ (VS Code / CLI), phiên bản và model ghi theo từng lượt, lấy từ chính transcript;
- không còn phần Google Antigravity (HW04 không dùng).

Ví dụ:
    python3 scripts/export_prompt_log.py
    python3 scripts/export_prompt_log.py --since 2026-11-15T00:00 --out ai/prompt_log.md
"""
import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Ho_Chi_Minh")
PROJECTS = Path.home() / ".claude/projects"
# (thư mục transcript, tiền tố phiên, nhãn vai trò)
DEFAULT_SOURCES = [
    ("-home-npdinh-study-Homeworks", "843d9cd5", "AI-1"),
    ("-home-npdinh-study-Homeworks", "cea4708c", "AI-1"),
    ("-home-npdinh-study-Homeworks-HW04-HW04-23120031", "7ed1ce04", "AI-2"),
]
DEFAULT_OUT = Path(__file__).resolve().parent.parent / "ai" / "prompt_log.md"
# Nội dung do harness tự chèn vào tin nhắn, không phải chữ sinh viên gõ
HIDDEN_TAGS = re.compile(
    r"<(system-reminder|ide_selection|ide_opened_file|local-command-stdout|local-command-caveat)>.*?</\1>",
    re.S,
)
PASTED = re.compile(r"<pasted_content[^>]*>\s*(.*?)\s*</pasted_content[^>]*>", re.S)
SLASH_CMD = re.compile(r"<command-name>(.*?)</command-name>.*?<command-args>(.*?)</command-args>", re.S)
MODEL_NAMES = {"claude-fable-5-2": "Claude Fable 5.2", "claude-opus-5-5": "Claude Opus 5.5"}
ENTRYPOINTS = {"claude-vscode": "Claude Code (VS Code extension)", "cli": "Claude Code CLI"}


def local_time(ts):
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(TZ)


def user_prompt(content):
    if isinstance(content, str):
        blocks, images = [content], 0
    else:
        blocks = [b.get("text", "") for b in content if b.get("type") == "text"]
        images = sum(1 for b in content if b.get("type") == "image")
    text = "\n".join(HIDDEN_TAGS.sub("", b).strip() for b in blocks).strip()
    text = PASTED.sub(lambda m: m.group(1), text)
    m = SLASH_CMD.search(text)
    if m:
        text = f"{m.group(1)} {m.group(2)}".strip()
    if images:
        text += f"\n[kèm {images} ảnh]"
    return text.strip()


def describe_tool(block):
    name, inp = block.get("name", "?"), block.get("input") or {}
    if name == "Bash":
        detail = inp.get("description") or inp.get("command", "").splitlines()[0]
    elif name in ("Read", "Write", "Edit", "NotebookEdit"):
        detail = inp.get("file_path", "")
    elif name in ("Agent", "Skill"):
        detail = inp.get("description", "") or inp.get("skill", "")
    elif name.startswith("mcp__playwright__"):
        detail = "khảo sát trang thật bằng Playwright MCP"
    else:
        detail = ", ".join(f"{k}={str(v)[:60]}" for k, v in list(inp.items())[:2])
    return f"`{name}` — {detail}".rstrip(" —")


def parse_session(path, role):
    interactions, seen = [], set()
    current = None
    for line in path.open(encoding="utf-8"):
        o = json.loads(line)
        if o.get("type") not in ("user", "assistant") or o.get("isSidechain"):
            continue
        if o.get("uuid") in seen:
            continue
        seen.add(o.get("uuid"))
        msg = o["message"]
        content = msg["content"]
        if o["type"] == "user":
            if isinstance(content, list) and any(isinstance(b, dict) and b.get("type") == "tool_result" for b in content):
                continue
            # Thông báo của hệ thống (tác vụ nền, tóm tắt hội thoại) không phải chữ sinh viên gõ
            if o.get("isMeta") or o.get("isCompactSummary") or o.get("promptSource") == "system":
                continue
            prompt = user_prompt(content)
            if not prompt:
                continue
            current = {
                "time": local_time(o["timestamp"]),
                "session": path.stem[:8],
                "role": role,
                "tool": ENTRYPOINTS.get(o.get("entrypoint", ""), o.get("entrypoint", "Claude Code")),
                "version": o.get("version", ""),
                "model": "",
                "prompt": prompt,
                "outputs": [],
                "actions": [],
            }
            interactions.append(current)
        elif current is not None:
            current["model"] = current["model"] or msg.get("model", "")
            for b in content:
                if b.get("type") == "text" and b.get("text", "").strip():
                    current["outputs"].append(b["text"].strip())
                elif b.get("type") == "tool_use":
                    current["actions"].append(describe_tool(b))
    return interactions


def fence(text, lang):
    longest = max((len(m) for m in re.findall(r"`{3,}", text)), default=0)
    ticks = "`" * max(4, longest + 1)
    return f"{ticks}{lang}\n{text}\n{ticks}"


def tool_header(it):
    model = MODEL_NAMES.get(it["model"], it["model"] or "n/a")
    return f"{it['tool']} {it['version']}, model {model}"


def render(interactions, generated_at):
    out = [
        "# Phụ lục A — Prompt log HW04 (trích tự động từ transcript Claude Code)",
        "",
        f"> Sinh bởi `scripts/export_prompt_log.py` lúc {generated_at:%Y-%m-%d %H:%M} (GMT+7). "
        "Prompt và output của AI được giữ **nguyên văn**. Không đưa vào: phần suy luận ẩn của model, "
        "nội dung file / kết quả lệnh mà AI đọc được (chỉ liệt kê tên hành động).",
        "> **AI-1** = phiên viết script (Claude Code, VS Code extension); **AI-2** = phiên review (Claude Code CLI).",
        "",
        "| # | Thời gian (GMT+7) | Vai trò | Phiên | Model | Prompt (rút gọn) |",
        "|---|---|---|---|---|---|",
    ]
    for i, it in enumerate(interactions, 1):
        short = re.sub(r"\s+", " ", it["prompt"])[:90].replace("|", "\\|")
        model = MODEL_NAMES.get(it["model"], it["model"] or "n/a")
        out.append(f"| {i} | {it['time']:%Y-%m-%d %H:%M} | {it['role']} | `{it['session']}` | {model} | {short} |")
    for i, it in enumerate(interactions, 1):
        out += [
            "",
            f"## #{i} · {it['time']:%Y-%m-%d %H:%M:%S} · {it['role']} · phiên `{it['session']}`",
            "",
            f"- **Công cụ AI:** {tool_header(it)}",
            "",
            "**Prompt (nguyên văn):**",
            "",
            fence(it["prompt"], "text"),
            "",
            "**Output AI (nguyên văn):**",
            "",
            fence("\n\n".join(it["outputs"]) or "(không có văn bản trả lời)", "markdown"),
        ]
        if it["actions"]:
            out += ["", f"<details><summary>Hành động AI đã thực hiện ({len(it['actions'])})</summary>", ""]
            out += [f"{n}. {a}" for n, a in enumerate(it["actions"], 1)]
            out += ["", "</details>"]
    return "\n".join(out) + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--since", help="chỉ lấy lượt từ thời điểm này, GMT+7 (vd 2026-11-15T00:00)")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--json", type=Path, help="ghi thêm danh sách lượt dạng JSON (để dựng bảng audit)")
    args = ap.parse_args()

    items = []
    for folder, prefix, role in DEFAULT_SOURCES:
        for f in sorted((PROJECTS / folder).glob(f"{prefix}*.jsonl")):
            items.extend(parse_session(f, role))
    interactions = sorted(items, key=lambda it: it["time"])
    if args.since:
        since = datetime.fromisoformat(args.since).replace(tzinfo=TZ)
        interactions = [it for it in interactions if it["time"] >= since]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(render(interactions, datetime.now(TZ)), encoding="utf-8")
    if args.json:
        args.json.write_text(json.dumps([
            {**{k: v for k, v in it.items() if k != "time"}, "time": it["time"].isoformat(),
             "n_actions": len(it["actions"])} for it in interactions], ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(interactions)} lượt từ {len({it['session'] for it in interactions})} phiên -> {args.out}")


if __name__ == "__main__":
    main()
