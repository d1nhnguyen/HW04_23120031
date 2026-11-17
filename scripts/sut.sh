#!/usr/bin/env bash
# Điều khiển SUT EShop cho bộ test HW04.
#   scripts/sut.sh start    bật backend (3000), frontend-web (5173), frontend-admin (5174)
#   scripts/sut.sh stop     dừng đúng các tiến trình do `start` bật (không killall node)
#   scripts/sut.sh reset    dừng backend, nạp lại seed bằng `node database.js`, bật lại backend
#   scripts/sut.sh status   xem tiến trình và cổng
# Biến môi trường:
#   SUT_DIR        thư mục SUT (mặc định: sut.dir trong automation.config.json)
#   SUT_STATE_DIR  nơi ghi log và PID (mặc định $TMPDIR/eshop-sut-<uid>)
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Thư mục SUT: biến môi trường SUT_DIR; nếu không có thì lấy sut.dir trong automation.config.json
SUT_DIR="${SUT_DIR:-$(node -p "require('$ROOT/automation.config.json').sut.dir" 2>/dev/null)}"
STATE_DIR="${SUT_STATE_DIR:-${TMPDIR:-/tmp}/eshop-sut-$(id -u)}"
API="http://localhost:3000/api"

declare -A DIR=([backend]=backend [web]=frontend-web [admin]=frontend-admin)
declare -A PORT=([backend]=3000 [web]=5173 [admin]=5174)
declare -A URL=([backend]="$API/products" [web]="http://localhost:5173/" [admin]="http://localhost:5174/")
declare -A CMD=(
  [backend]="node server.js"
  [web]="npm run dev -- --port 5173 --strictPort"
  [admin]="npm run dev -- --port 5174 --strictPort"
)

die() { echo "sut.sh: $*" >&2; exit 1; }

pid_of() { cat "$STATE_DIR/$1.pid" 2>/dev/null; }

# PID còn sống và đúng là tiến trình chạy trong thư mục SUT (tránh nhầm khi PID bị tái sử dụng)
is_ours() {
  local pid; pid="$(pid_of "$1")"
  [ -n "$pid" ] && [ "$(readlink "/proc/$pid/cwd" 2>/dev/null)" = "$SUT_DIR/${DIR[$1]}" ]
}

port_busy() { lsof -ti "tcp:$1" -sTCP:LISTEN > /dev/null 2>&1; }

wait_url() {
  local i
  for i in $(seq 1 100); do
    curl -s -o /dev/null --max-time 2 "$1" && return 0
    sleep 0.3
  done
  return 1
}

start_one() {
  local name="$1"
  if is_ours "$name"; then echo "$name: đang chạy (PID $(pid_of "$name"))"; return 0; fi
  port_busy "${PORT[$name]}" && die "cổng ${PORT[$name]} đang bị tiến trình khác dùng, không bật $name"
  # setsid: tiến trình thành trưởng nhóm riêng, để stop dừng được cả npm lẫn vite con của nó
  ( cd "$SUT_DIR/${DIR[$name]}" && exec setsid nohup ${CMD[$name]} > "$STATE_DIR/$name.log" 2>&1 < /dev/null ) &
  echo $! > "$STATE_DIR/$name.pid"
  if wait_url "${URL[$name]}"; then
    echo "$name: đã bật, PID $(pid_of "$name"), cổng ${PORT[$name]}, log $STATE_DIR/$name.log"
  else
    die "$name không phản hồi tại ${URL[$name]} – xem $STATE_DIR/$name.log"
  fi
}

stop_one() {
  local name="$1" pid i
  pid="$(pid_of "$name")"
  if ! is_ours "$name"; then
    [ -n "$pid" ] && echo "$name: PID $pid không còn là tiến trình của SUT, bỏ qua"
    rm -f "$STATE_DIR/$name.pid"
    return 0
  fi
  kill -TERM -- "-$pid" 2>/dev/null
  for i in $(seq 1 50); do
    kill -0 -- "-$pid" 2>/dev/null || break
    sleep 0.1
  done
  kill -0 -- "-$pid" 2>/dev/null && kill -KILL -- "-$pid" 2>/dev/null
  rm -f "$STATE_DIR/$name.pid"
  echo "$name: đã dừng (PID $pid)"
}

[ -d "$SUT_DIR/backend" ] || die "không thấy SUT ở $SUT_DIR (đặt biến SUT_DIR)"
mkdir -p "$STATE_DIR"

case "${1:-}" in
  start)
    for n in backend web admin; do start_one "$n"; done
    ;;
  stop)
    for n in admin web backend; do stop_one "$n"; done
    ;;
  reset)
    stop_one backend
    port_busy 3000 && die "cổng 3000 vẫn bị tiến trình khác dùng, không reset"
    ( cd "$SUT_DIR/backend" && timeout 30 node database.js ) > "$STATE_DIR/reset.log" 2>&1 \
      || die "node database.js lỗi – xem $STATE_DIR/reset.log"
    start_one backend
    echo "reset: dữ liệu đã về seed"
    ;;
  status)
    for n in backend web admin; do
      if is_ours "$n"; then echo "$n: chạy, PID $(pid_of "$n"), cổng ${PORT[$n]}"
      else echo "$n: không chạy"; fi
    done
    ;;
  *)
    die "dùng: scripts/sut.sh start|stop|reset|status"
    ;;
esac
