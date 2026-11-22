import { bounds } from './data/atlas.json'

export type Heading = 'up' | 'down' | 'left' | 'right'
interface Junction {
  x: number
  y: number
  next: Set<Junction>
}
export interface Walker {
  from: Junction
  to: Junction
  distance: number
}
let junctions: Junction[] = []

export function indexPaths(lines: number[][]) {
  const nodes = new Map<string, Junction>()
  const get = (x: number, y: number) => {
    const id = x + ',' + y
    let node = nodes.get(id)
    if (!node) {
      node = { x, y, next: new Set() }
      nodes.set(id, node)
    }
    return node
  }
  for (const line of lines) {
    let prev: Junction | undefined
    for (let i = 0; i < line.length; i += 2) {
      const x = line[i],
        y = line[i + 1]
      if (x < bounds[0] || y < bounds[1] || x > bounds[2] || y > bounds[3]) {
        prev = undefined
        continue
      }
      const node = get(x, y)
      if (prev && node !== prev) {
        prev.next.add(node)
        node.next.add(prev)
      }
      prev = node
    }
  }
  junctions = [...nodes.values()]
}

const length = (a: Junction, b: Junction) => Math.hypot(b.x - a.x, b.y - a.y)
export function position(walker: Walker) {
  const { from, to, distance } = walker,
    t = distance / length(from, to)
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}

export function startWalk(x: number, y: number): Walker | undefined {
  let nearest = Infinity,
    best: Walker | undefined
  for (const a of junctions)
    for (const b of a.next) {
      if (a.x > b.x || (a.x === b.x && a.y > b.y)) continue
      const dx = b.x - a.x,
        dy = b.y - a.y,
        len = length(a, b)
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (len * len)))
      const distance = (a.x + t * dx - x) ** 2 + (a.y + t * dy - y) ** 2
      if (distance < nearest) {
        nearest = distance
        best = { from: a, to: b, distance: t * len }
      }
    }
  return best
}

function score(a: Junction, b: Junction, heading: Heading) {
  const dx = b.x - a.x,
    dy = b.y - a.y
  const x = dx * 0.849 - dy * 0.528,
    y = (dx * 0.528 + dy * 0.849) * 0.61
  return { up: -y, down: y, left: -x, right: x }[heading] / Math.hypot(x, y)
}

export function stepOnPath(walker: Walker, heading: Heading, metres: number): Walker {
  let { from, to, distance } = walker
  const edgeLength = length(from, to)
  const at = distance < 0.001 ? from : edgeLength - distance < 0.001 ? to : undefined
  if (at) {
    const next = [...at.next].sort((a, b) => score(at, b, heading) - score(at, a, heading))[0]
    if (!next || score(at, next, heading) <= 0.05) return walker
    from = at
    to = next
    distance = 0
  }
  if (score(from, to, heading) < 0) {
    distance = length(from, to) - distance
    ;[from, to] = [to, from]
  }
  // Many OSM ways meet at intermediate shape points. Carry remaining travel across them.
  for (let i = 0; i < 60 && metres > 0; i++) {
    const edge = length(from, to),
      remaining = edge - distance
    if (metres < remaining) return { from, to, distance: distance + metres }
    metres -= remaining
    distance = edge
    let winner: Junction | undefined,
      alignment = 0.05
    for (const candidate of to.next) {
      const fit = score(to, candidate, heading)
      if (candidate !== from && fit > alignment) {
        winner = candidate
        alignment = fit
      }
    }
    if (!winner) break
    from = to
    to = winner
    distance = 0
  }
  return { from, to, distance }
}
