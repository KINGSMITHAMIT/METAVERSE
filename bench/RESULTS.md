# Local movement benchmark

Measured on 22 November 2026 against this checkout with 100 simulated WebSocket clients. All four runs reached 100 initial snapshots and 100 reconnect snapshots, with all 400 HTTP and socket status checks passing in each run.

| Delivery | Workload | Clients | Move intents | Observer updates | Delivery p95 | Outbound JSON | Java CPU seconds / mean | Reconnect p95 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Broadcast | One room, dispersed | 100 | 11,999 | 1,065,972 | 68 ms | 118,326,677 B | 20.75 / 70.9% | 14 ms |
| Nearby | One room, dispersed | 100 | 12,000 | 273,983 | 9 ms | 33,652,720 B | 30.11 / 103.2% | 40.04 ms |
| Broadcast | Five rooms, clustered | 100 | 12,000 | 222,756 | 5 ms | 25,778,603 B | 13.48 / 46.3% | 15.04 ms |
| Nearby | Five rooms, clustered | 100 | 12,000 | 227,544 | 2 ms | 26,331,754 B | 12.80 / 44.0% | 17 ms |

## Reproduce

Use a local PostgreSQL database and a Linux host with Java 21, Node 22+, and k6 1.2.3. The run script starts and stops its own Java instances on loopback port 8081. It seeds benchmark accounts and workspaces in the configured database.

```sh
docker compose up -d --wait postgres
./mvnw -DskipTests package
CLIENTS=100 MOVE_SECONDS=12 bench/run.sh
```

Set `K6` to an explicit executable path if needed. Set `BENCH_OUT` to choose the output directory. The runner emits k6 text and JSON summaries and per-run Java CPU readings. It uses the same database fixture for both delivery modes.

## Method

- Linux x86-64 cloud instance, AMD EPYC 9V74, five CPUs visible and a four-CPU cgroup quota. OpenJDK 21.0.13, k6 1.2.3, PostgreSQL 16.16. Each benchmark JVM used a 256 MiB initial heap, 768 MiB maximum heap, and `ActiveProcessorCount=4` in a shared execution environment.
- Each virtual user authenticated, joined a room, and moved to a predefined lane. The crowded workload distributed users across four map areas in one workspace. The split workload used five workspaces of 20 users and placed players close together within each workspace. Both used the same 100 ms movement interval for 12 seconds and then staggered reconnects across a 225 ms window. The second scenario in each mode reused the first scenario's JVM.
- Sender-to-observer latency starts at the timestamp the k6 sender attaches to a movement intent and ends when an observing k6 client parses the corresponding accepted update. It excludes the sender's own echo, uses a common host clock, and includes queueing, transport, and observer scheduling. It describes delivered updates during the window. It does not estimate latency for filtered or undelivered updates.
- Outbound JSON counts WebSocket text payloads received during the measurement window, including sender echoes, visibility events, blocked moves, and heartbeat replies. It excludes transport and protocol framing, HTTP, warm-up and reconnect snapshots, and messages received after the window. The seeded workload used ASCII, so measured text lengths equal UTF-8 byte counts.
- Reconnect latency runs from before the new connection attempt through receipt of its first complete snapshot. Java CPU comes from process user and system ticks while the k6 run is active, including authentication, warm-up, and reconnect. It excludes PostgreSQL and k6. A mean of 100% represents one fully used core.

## Trade-offs

For a dispersed crowd, nearby delivery sent 72% fewer outbound JSON bytes and reduced observed movement p95 from 68 ms to 9 ms. Java CPU rose from 20.75 to 30.11 seconds and reconnect p95 rose from 14 to 40.04 ms. The workload and accounting cannot isolate CPU cost to any one operation.

In the five clustered rooms, most teammates were already within range. Nearby mode sent about 2% more measured bytes and both delivery p95 values were in the single-digit milliseconds. Under these conditions, there was little traffic benefit from maintaining the grid.

These are four local observations, one per mode and workload, with a co-located load generator and shared CPU. They characterize these workloads and leave production capacity and Internet latency unmeasured.
