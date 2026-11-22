import { check, sleep } from 'k6'
import http from 'k6/http'
import ws from 'k6/ws'
import { Counter, Trend } from 'k6/metrics'
import { SharedArray } from 'k6/data'
import exec from 'k6/execution'

const delivery = new Trend('movement_delivery_ms', true)
const reconnected = new Counter('clients_reconnected')
const reconnect = new Trend('reconnect_snapshot_ms', true)
const payload = new Counter('outbound_json_bytes')
const observerUpdates = new Counter('observer_updates')
const clients = new Counter('clients_with_snapshot')
const intents = new Counter('movement_intents')
const roster = new SharedArray('roster', () => [JSON.parse(open(__ENV.ROSTER || '/tmp/campus-bench.json'))])[0]
const count = Number(__ENV.CLIENTS || 100)
const base = __ENV.BASE_URL || 'http://127.0.0.1:8081'
const origin = __ENV.ORIGIN || 'http://localhost:5173'
const workload = __ENV.WORKLOAD || 'crowd'
const seconds = Number(__ENV.MOVE_SECONDS || 12)

export const options = {
  scenarios: { movement: { executor: 'per-vu-iterations', vus: count, iterations: 1, maxDuration: '85s' } },
  thresholds: { clients_with_snapshot: ['count==' + count], clients_reconnected: ['count==' + count], checks: ['rate==1'] },
  summaryTrendStats: ['med', 'p(95)', 'max', 'count'],
}

export function setup() {
  return { start: Date.now() + 14_000 }
}

export default function ({ start }) {
  const index = exec.vu.idInTest - 1
  const client = roster.memberships[index]
  const csrf = http.get(base + '/api/csrf')
  if (!check(csrf, { 'csrf issued': response => response.status === 200 })) return
  const login = http.post(base + '/api/login', JSON.stringify({ username: client.username, password: roster.password }), {
    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf.json('token') },
  })
  if (!check(login, { 'login succeeded': response => response.status === 200 })) return

  const address = base.replace(/^http/, 'ws') + '/ws/campus?workspace=' + client[workload]
  const params = { headers: { Origin: origin, Cookie: 'JSESSIONID=' + login.cookies.JSESSIONID[0].value } }
  const corner = workload === 'split' ? 0 : index % 4
  const paths = [
    ['left', 3, 'down', 3], ['up', 8, 'left', 3],
    ['down', 3, 'right', 13], ['up', 9, 'right', 12],
  ]
  const path = paths[corner]
  const movementStart = start + 2500
  const movementEnd = movementStart + seconds * 1000
  let warmup = 0
  let direction = 0

  const first = ws.connect(address, params, socket => {
    socket.on('message', raw => {
      const event = JSON.parse(raw)
      if (event.type === 'snapshot') clients.add(1)
      if (Date.now() >= movementStart && Date.now() <= movementEnd) {
        payload.add(raw.length) // Protocol is ASCII for the seeded workload.
        if (event.type === 'position' && event.data.player.username !== client.username && event.data.sentAt >= movementStart) {
          observerUpdates.add(1)
          delivery.add(Date.now() - event.data.sentAt)
        }
      }
    })
    socket.setInterval(() => socket.send('{"v":1,"type":"ping"}'), 5000)
    socket.setInterval(() => {
      const now = Date.now()
      if (now < start || now >= movementEnd) return
      if (now < movementStart) {
        if (warmup < path[1] + path[3]) {
          socket.send(JSON.stringify({ v: 1, type: 'move', direction: warmup < path[1] ? path[0] : path[2] }))
          warmup++
        }
        return
      }
      direction++
      intents.add(1)
      socket.send(JSON.stringify({ v: 1, type: 'move', direction: direction % 2 ? 'right' : 'left', sentAt: now }))
    }, 100)
    socket.setTimeout(() => socket.close(), Math.max(1, movementEnd + 100 - Date.now()))
  })
  if (!check(first, { 'connected': response => response && response.status === 101 })) return
  sleep(.1 + (index % 10) * .025)
  const began = Date.now()
  const second = ws.connect(address, params, socket => {
    socket.on('message', raw => {
      if (JSON.parse(raw).type === 'snapshot') {
        reconnect.add(Date.now() - began)
        reconnected.add(1)
        socket.close()
      }
    })
    socket.setTimeout(() => socket.close(), 5000)
  })
  check(second, { 'reconnected': response => response && response.status === 101 })
}
