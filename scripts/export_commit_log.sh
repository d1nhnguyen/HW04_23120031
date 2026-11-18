#!/usr/bin/env bash
# Xuất git log ra git_commit_log.txt. Cột "spec" = commit có sửa file .spec.ts (chỉ những commit này tính vào ngưỡng 8 của đề).
# Commit chứa chính file này không tự liệt kê được: chạy lại script ngay trước khi đóng gói bài nộp.
set -eu
cd "$(dirname "$0")/.."
out=git_commit_log.txt
spec=$(git log --format=%H -- 'tests/**/*.spec.ts')
{
  echo "Git commit log – HW04 23120031 – repo https://github.com/d1nhnguyen/HW04_23120031"
  echo "Xuất lúc $(date '+%Y-%m-%d %H:%M:%S %z') bằng scripts/export_commit_log.sh"
  echo "Tổng: $(git rev-list --count HEAD) commit; có sửa .spec.ts: $(echo "$spec" | grep -c .) (ngưỡng của đề: 8)"
  echo
  echo "spec | hash    | thời gian                 | tác giả     | thông điệp"
  git log --reverse --date=format:'%Y-%m-%d %H:%M:%S %z' --format='%H|%h|%ad|%an|%s' | while IFS='|' read -r full short date author subject; do
    if echo "$spec" | grep -q "$full"; then mark="  x "; else mark="    "; fi
    printf '%s | %s | %s | %s | %s\n' "$mark" "$short" "$date" "$author" "$subject"
  done
  echo
  echo "===== Chi tiết (git log --stat) ====="
  git log --reverse --stat --date=iso
} > "$out"
echo "đã ghi $out"
