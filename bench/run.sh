#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${K6:=k6}" "${CLIENTS:=100}" "${MOVE_SECONDS:=12}" "${BENCH_OUT:=target/bench}"
mkdir -p "$BENCH_OUT"
export ROSTER="$(realpath "$BENCH_OUT")/roster.json" CLIENTS MOVE_SECONDS
java_pid=
stop() { if [[ -n "$java_pid" ]]; then kill "$java_pid" 2>/dev/null || true; wait "$java_pid" || true; fi; }
trap stop EXIT
start() {
  SERVER_PORT=8081 POSITION_MODE="$1" java -XX:ActiveProcessorCount=4 -Xms256m -Xmx768m -jar target/commons-0.1.0.jar >"$BENCH_OUT/server.log" 2>&1 &
  java_pid=$!
  for ((i=0; i<60; i++)); do
    if curl -fsS http://127.0.0.1:8081/actuator/health >/dev/null 2>&1; then return; fi
    if ! kill -0 "$java_pid" 2>/dev/null; then break; fi
    sleep 1
  done
  cat "$BENCH_OUT/server.log" >&2
  exit 1
}
sample_cpu() {
  awk '{print $14+$15}' "/proc/$java_pid/stat"
}
run() {
  local key="$1-$2" before after start_time end_time
  before=$(sample_cpu)
  start_time=$(date +%s.%N)
  WORKLOAD="$2" "$K6" run --quiet --summary-export "$BENCH_OUT/$key.json" bench/movement.js | tee "$BENCH_OUT/$key.txt"
  end_time=$(date +%s.%N)
  after=$(sample_cpu)
  awk -v before="$before" -v after="$after" -v start="$start_time" -v end="$end_time" -v hz="$(getconf CLK_TCK)" \
    'BEGIN {printf "Java CPU seconds: %.2f\nMean CPU (one core = 100%%): %.1f%%\n", (after-before)/hz, 100*(after-before)/hz/(end-start)}' \
    | tee "$BENCH_OUT/$key.cpu"
}
start broadcast
BASE_URL=http://127.0.0.1:8081 node bench/provision.mjs
run broadcast crowd
run broadcast split
stop
start nearby
run nearby crowd
run nearby split
