#!/bin/bash
# Xuất PDF cho tài liệu nộp bài: pandoc -> HTML (nhúng ảnh) -> Chrome headless. Dựa trên scripts/build_pdf.sh của HW02.
# Dùng:
#   scripts/build_pdf.sh                    -> báo cáo chính, AI Audit Report, AI Critique  -> pdf/<tên>.pdf
#   scripts/build_pdf.sh file1.md [...]     -> chỉ các file chỉ định
# AI Critique còn là khung (có dòng "CHƯA VIẾT") thì bị bỏ qua, không xuất PDF rỗng.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CSS="$ROOT/scripts/pdf.css"
OUT="$ROOT/pdf"
mkdir -p "$OUT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ $# -eq 0 ]; then
  set -- "$ROOT/report/main_report.md" "$ROOT/ai/AI_Audit_Report.md" "$ROOT/ai/AI_Critique.md"
fi

for md in "$@"; do
  if [ ! -f "$md" ]; then echo "bỏ qua: không có $md" >&2; continue; fi
  if grep -q "CHƯA VIẾT" "$md"; then echo "bỏ qua: $md còn là khung (CHƯA VIẾT)" >&2; continue; fi
  dir="$(cd "$(dirname "$md")" && pwd)"
  name="$(basename "$md" .md)"
  title="$(grep -m1 '^# ' "$md" | sed 's/^# //')"
  # chạy trong thư mục của file để đường dẫn ảnh tương đối được nhúng đúng
  (cd "$dir" && pandoc "$name.md" -f gfm -t html5 -s --embed-resources --css "$CSS" \
     --metadata title="${title:-$name}" -V title= -o "$TMP/$name.html")
  google-chrome --headless=new --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="$OUT/$name.pdf" "file://$TMP/$name.html" 2>/dev/null
  echo "$OUT/$name.pdf"
done
