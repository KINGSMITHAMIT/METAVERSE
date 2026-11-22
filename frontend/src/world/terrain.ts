import map from './data/atlas.json'
import geographyUrl from './data/geography.json?url'
import buildingsUrl from './data/imagery-buildings.json?url'
import { indexPaths } from './paths'
import { loadCover, paintCover, paintCanopy } from './landcover'

export { geographyUrl }

export type Point = { x: number; y: number }
export type Camera = Point & { zoom: number }
export const home: Camera = { x: 115, y: -115, zoom: 1 }
export const bounds = map.bounds
export const anchors: Record<string, number[]> = map.anchors
export const coordinates = (x: number, y: number) => ({
  lat: map.origin[1] - y / map.metresPerDegree[1],
  lon: map.origin[0] + x / map.metresPerDegree[0],
})
export const constrain = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
export const bounded = (v: Camera): Camera => ({
  x: constrain(v.x, bounds[0], bounds[2]),
  y: constrain(v.y, bounds[1], bounds[3]),
  zoom: constrain(v.zoom, 0.24, 5.2),
})

type Feature = {
  kind: string
  height: number
  rings: number[][]
  x: number
  y: number
  radius: number
  area: number
  seed: number
}
type Raw = [string, string | number, number[][]]
let features: Feature[] = []
function prepare([kind, detail, rings]: Raw): Feature {
  const p = rings[0]
  let l = Infinity,
    r = -Infinity,
    t = Infinity,
    b = -Infinity,
    doubleArea = 0
  for (let i = 0; i < p.length; i += 2) {
    l = Math.min(p[i], l)
    r = Math.max(p[i], r)
    t = Math.min(p[i + 1], t)
    b = Math.max(p[i + 1], b)
    if (i > 0) doubleArea += p[i - 2] * p[i + 1] - p[i] * p[i - 1]
  }
  const area = Math.abs(doubleArea) / 2
  const seed = Math.abs(Math.round(l * 17 + t * 29)) % 17
  // Unknown roof heights are illustrative massing derived from footprint size.
  const height = Number(detail) || (area > 750 ? 15 + (seed % 5) : area > 200 ? 10 : 5 + (seed % 4))
  return {
    kind,
    rings,
    height,
    x: (l + r) / 2,
    y: (t + b) / 2,
    radius: Math.hypot(r - l, b - t) / 2,
    area,
    seed,
  }
}
const rank: Record<string, number> = {
  campus: 0,
  wood: 1,
  green: 1,
  water: 1,
  sport: 2,
  stream: 3,
  rail: 4,
  path: 5,
  lane: 6,
  street: 7,
  avenue: 8,
  tree: 9,
  building: 10,
}
const cosine = 0.849,
  sine = 0.528,
  pitch = 0.61
function depth(x: number, y: number) {
  return x * sine + y * cosine
}
let loading: Promise<void> | undefined
export function loadMap() {
  if (!loading) {
    const data = async (url: string): Promise<Raw[]> => {
      const response = await fetch(url)
      if (!response.ok) throw Error('Map data could not be loaded')
      return response.json()
    }
    loading = Promise.all([data(geographyUrl), data(buildingsUrl), loadCover()])
      .then(([osm, imagery]) => {
        indexPaths(
          osm
            .filter(([kind]) => ['street', 'lane', 'path', 'avenue'].includes(kind))
            .flatMap(([, , rings]) => rings),
        )
        features = [...osm, ...imagery].map(prepare)
        features.sort(
          (a, b) =>
            rank[a.kind] - rank[b.kind] ||
            (a.kind === 'building' ? depth(a.x, a.y) - depth(b.x, b.y) : b.area - a.area),
        )
      })
      .catch((e) => {
        loading = undefined
        throw e
      })
  }
  return loading
}

export function view(width: number, height: number, camera: Camera) {
  const narrow = width < 700
  const span = Math.min(width * (narrow ? 1.4 : 0.965), height * (narrow ? 2.05 : 2.32))
  const cx = width * (narrow ? 0.5 : 0.53),
    cy = height * (narrow ? 0.52 : 0.54)
  const scale = (span / (narrow ? 1320 : 1630)) * camera.zoom
  const half = span / 2,
    rise = Math.min(span * (narrow ? 0.39 : 0.254), height * 0.42)
  const diamond = [
    [cx - half, cy - rise * 0.13],
    [cx - half * 0.2, cy - rise],
    [cx + half, cy + rise * 0.13],
    [cx + half * 0.2, cy + rise],
  ]
  const project = (x: number, y: number, z = 0) => ({
    x: cx + ((x - camera.x) * cosine - (y - camera.y) * sine) * scale,
    y: cy + (depth(x - camera.x, y - camera.y) * pitch - z * 0.85) * scale,
  })
  const unproject = (dx: number, dy: number) => ({
    x: (dx * cosine + (dy * sine) / pitch) / scale,
    y: (-dx * sine + (dy * cosine) / pitch) / scale,
  })
  const within = (x: number, y: number) =>
    diamond.every((a, i) => {
      const b = diamond[(i + 1) % 4]
      return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) >= 0
    })
  return { span, cx, cy, scale, diamond, project, unproject, within }
}

const daylight = {
  soil: '#b29c75',
  soilSide: '#948776',
  lip: '#e6ddae',
  land: '#c4d4aa',
  grid: '#819778',
  campus: '#aad09f',
  wood: '#73a886',
  green: '#8bbe89',
  water: '#83c4c2',
  sport: '#8dc59b',
  sportLine: '#d5e9c7',
  roadEdge: '#aaad94',
  road: '#e6dfc4',
  mainRoad: '#eee5cd',
  path: '#d5d5ae',
  rail: '#9c9f8e',
  shade: 'rgba(47,72,66,.19)',
  roof: ['#f5f0d8', '#e8eddb', '#f7e6cf', '#d8e3d9'],
  wallA: '#bcc7b7',
  wallB: '#9daea8',
  rim: '#faf5e6',
  window: '#879e9d',
  tree: '#74a982',
}
const night: typeof daylight = {
  soil: '#464b55',
  soilSide: '#373e48',
  lip: '#727d70',
  land: '#495f58',
  grid: '#708479',
  campus: '#4b6d5a',
  wood: '#335d50',
  green: '#44765f',
  water: '#487c83',
  sport: '#54856d',
  sportLine: '#8da991',
  roadEdge: '#45575a',
  road: '#79837f',
  mainRoad: '#94978c',
  path: '#61796a',
  rail: '#738084',
  shade: 'rgba(13,22,33,.31)',
  roof: ['#9caeae', '#829a9c', '#b1afa4', '#91a4a2'],
  wallA: '#75898b',
  wallB: '#576e75',
  rim: '#bfcbc0',
  window: '#e1c38b',
  tree: '#4b795d',
}

export function drawTerrain(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  camera: Camera,
  dark: boolean,
) {
  const { project, unproject, scale, diamond, cx, cy, span } = view(w, h, camera)
  const c = dark ? night : daylight
  const pointPath = (points: number[][]) => {
    ctx.beginPath()
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.closePath()
  }
  const path = (f: Feature, lift = 0) => {
    ctx.beginPath()
    for (const ring of f.rings)
      for (let i = 0; i < ring.length; i += 2) {
        const p = project(ring[i], ring[i + 1], lift)
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      }
  }
  ctx.clearRect(0, 0, w, h)
  const slab = Math.min(22, span * 0.014)
  ctx.save()
  ctx.shadowColor = dark ? '#07171c77' : '#55736f50'
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 18
  pointPath(diamond)
  ctx.fillStyle = c.soil
  ctx.fill()
  ctx.restore()
  for (const i of [2, 3]) {
    const a = diamond[i],
      b = diamond[(i + 1) % 4]
    pointPath([a, b, [b[0], b[1] + slab], [a[0], a[1] + slab]])
    ctx.fillStyle = i === 2 ? c.soil : c.soilSide
    ctx.fill()
    pointPath([a, b, [b[0], b[1] + 3], [a[0], a[1] + 3]])
    ctx.fillStyle = c.lip
    ctx.fill()
  }
  ctx.save()
  pointPath(diamond)
  ctx.clip()
  ctx.fillStyle = dark ? '#455354' : '#d3d7c3'
  ctx.fillRect(0, 0, w, h)
  const [west, north, east, south] = bounds
  pointPath(
    [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ].map(([x, y]) => {
      const p = project(x, y)
      return [p.x, p.y]
    }),
  )
  ctx.clip()
  ctx.fillStyle = c.land
  ctx.fillRect(0, 0, w, h)
  paintCover(ctx, project, dark)
  // A fine stipple represents the ground between surveyed features.
  ctx.fillStyle = c.grid
  ctx.globalAlpha = 0.3
  for (let y = 0; y < h; y += 11)
    for (let x = (y % 2) * 6; x < w; x += 12) ctx.fillRect(x, y, 0.75, 0.75)
  ctx.globalAlpha = 1
  const visible = features.filter((f) => {
    const p = project(f.x, f.y)
    const pad = f.radius * scale + (f.kind === 'building' ? f.height * scale : 0) + 5
    return (
      Math.abs(p.x - cx) < span / 2 + pad &&
      p.x >= -pad &&
      p.x <= w + pad &&
      p.y >= -pad &&
      p.y <= h + pad &&
      Math.abs(p.y - cy) < h * 0.45 + pad
    )
  })
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const corners = diamond.map(([x, y]) => unproject(x - cx, y - cy))
  const extent = [
    camera.x + Math.min(...corners.map((p) => p.x)),
    camera.y + Math.min(...corners.map((p) => p.y)),
    camera.x + Math.max(...corners.map((p) => p.x)),
    camera.y + Math.max(...corners.map((p) => p.y)),
  ]
  let canopyDrawn = false
  for (const f of visible) {
    if (!canopyDrawn && rank[f.kind] >= 3) {
      paintCanopy(ctx, project, dark, scale, extent)
      canopyDrawn = true
    }
    const kind = f.kind
    if (['campus', 'wood', 'green', 'water', 'sport'].includes(kind)) {
      path(f)
      ctx.fillStyle = c[kind as 'campus']
      ctx.fill('evenodd')
      if (kind === 'sport') {
        ctx.strokeStyle = c.sportLine
        ctx.lineWidth = Math.max(1, scale * 2.5)
        ctx.stroke()
        // Inset contours retain the outline and orientation of each mapped playing field.
        ctx.save()
        ctx.clip('evenodd')
        const p = project(f.x, f.y)
        ctx.translate(p.x, p.y)
        ctx.scale(0.91, 0.91)
        ctx.translate(-p.x, -p.y)
        path(f)
        ctx.lineWidth = Math.max(0.65, scale)
        ctx.stroke()
        ctx.restore()
      }
    } else if (kind === 'tree') {
      const p = project(f.x, f.y)
      ctx.beginPath()
      ctx.arc(p.x, p.y, Math.max(1.2, 4 * scale), 0, Math.PI * 2)
      ctx.fillStyle = c.tree
      ctx.fill()
    } else if (kind === 'building') {
      if (f.area * scale * scale < 1) continue
      const height = f.height,
        roofPixels = height * scale
      const center = project(f.x, f.y)
      ctx.save()
      ctx.translate(roofPixels * 0.42, roofPixels * 0.17)
      path(f)
      ctx.fillStyle = c.shade
      ctx.fill('evenodd')
      ctx.restore()
      if (roofPixels > 1.2) {
        for (const ring of f.rings) {
          const faces = []
          for (let i = 2; i < ring.length; i += 2) {
            const a = project(ring[i - 2], ring[i - 1]),
              b = project(ring[i], ring[i + 1])
            faces.push({ a, b })
          }
          faces.sort((a, b) => a.a.y + a.b.y - b.a.y - b.b.y)
          for (const { a, b } of faces) {
            const lift = roofPixels * 0.85
            pointPath([
              [a.x, a.y],
              [b.x, b.y],
              [b.x, b.y - lift],
              [a.x, a.y - lift],
            ])
            ctx.fillStyle = (b.y - a.y) * (b.x - a.x) > 0 ? c.wallB : c.wallA
            ctx.fill()
            if (roofPixels > 8 && a.y + b.y > center.y * 2 - 1 && Math.abs(b.x - a.x) > 12) {
              const bays = Math.floor(Math.abs(b.x - a.x) / Math.max(5, scale * 6))
              ctx.strokeStyle = c.window
              ctx.lineWidth = Math.max(0.7, scale * 1.15)
              for (let j = 1; j <= bays; j++) {
                const t = j / (bays + 1),
                  x = a.x + (b.x - a.x) * t,
                  y = a.y + (b.y - a.y) * t
                ctx.beginPath()
                ctx.moveTo(x, y - lift * 0.69)
                ctx.lineTo(x, y - lift * 0.3)
                ctx.stroke()
              }
            }
          }
        }
      }
      path(f, height)
      ctx.fillStyle = c.roof[f.seed % 4]
      ctx.fill('evenodd')
      if (roofPixels > 5) {
        ctx.strokeStyle = c.rim
        ctx.lineWidth = Math.min(1, scale * 0.7)
        ctx.stroke()
      }
    } else {
      const width =
        (
          { avenue: 10, street: 6, lane: 3.5, path: 1.8, stream: 3, rail: 2.5 } as Record<string, number>
        )[kind] ?? 3
      path(f)
      ctx.lineWidth = Math.max(0.8, width * scale) + Math.min(2, scale * 1.8)
      ctx.strokeStyle = c.roadEdge
      ctx.stroke()
      ctx.lineWidth = Math.max(0.7, width * scale)
      ctx.strokeStyle =
        kind === 'stream'
          ? c.water
          : kind === 'rail'
            ? c.rail
            : kind === 'path'
              ? c.path
              : kind === 'avenue'
                ? c.mainRoad
                : c.road
      ctx.stroke()
    }
  }
  ctx.restore()
}
