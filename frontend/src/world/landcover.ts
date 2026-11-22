import imageUrl from './data/landcover.png'
import atlas from './data/atlas.json'

interface Cover {
  pixels: Uint8ClampedArray
  width: number
  height: number
  surface: HTMLCanvasElement[]
}
let cover: Cover | undefined

export async function loadCover() {
  if (cover) return
  const img = new Image()
  img.src = imageUrl
  await img.decode()
  const surface = [document.createElement('canvas'), document.createElement('canvas')]
  const colors: Record<number, string[]> = {
    10: ['7fa67a', '365e50'],
    20: ['a8bf86', '4d6855'],
    30: ['baca90', '61785a'],
    40: ['c4c998', '686e58'],
    60: ['d0c3a6', '716e64'],
    80: ['7fb2b3', '417179'],
    90: ['95b39a', '467365'],
  }
  let pixels: Uint8ClampedArray | undefined
  surface.forEach((tile, theme) => {
    tile.width = img.width
    tile.height = img.height
    const ctx = tile.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const samples = ctx.getImageData(0, 0, img.width, img.height)
    if (!pixels) pixels = samples.data.slice()
    for (let i = 0; i < samples.data.length; i += 4) {
      const hex = colors[samples.data[i]]?.[theme]
      if (!hex) {
        samples.data[i + 3] = 0
        continue
      }
      for (let j = 0; j < 3; j++) samples.data[i + j] = parseInt(hex.slice(j * 2, j * 2 + 2), 16)
    }
    ctx.putImageData(samples, 0, 0)
  })
  cover = { pixels: pixels!, width: img.width, height: img.height, surface }
}

type Project = (x: number, y: number, z?: number) => { x: number; y: number }
export function paintCover(ctx: CanvasRenderingContext2D, project: Project, dark: boolean) {
  if (!cover) return
  const [l, t, r, b] = atlas.bounds,
    p = project(l, t),
    q = project(r, t),
    v = project(l, b)
  ctx.save()
  ctx.transform(
    (q.x - p.x) / cover.width,
    (q.y - p.y) / cover.width,
    (v.x - p.x) / cover.height,
    (v.y - p.y) / cover.height,
    p.x,
    p.y,
  )
  ctx.globalAlpha = 0.89
  ctx.drawImage(cover.surface[dark ? 1 : 0], 0, 0)
  ctx.restore()
}

export function paintCanopy(
  ctx: CanvasRenderingContext2D,
  project: Project,
  dark: boolean,
  scale: number,
  area: number[],
) {
  if (!cover || scale < 0.26) return
  const [l, t, r, b] = atlas.bounds,
    dx = (r - l) / cover.width,
    dy = (b - t) / cover.height
  const left = Math.max(0, Math.floor((area[0] - l) / dx)),
    right = Math.min(cover.width - 1, Math.ceil((area[2] - l) / dx))
  const top = Math.max(0, Math.floor((area[1] - t) / dy)),
    bottom = Math.min(cover.height - 1, Math.ceil((area[3] - t) / dy))
  const shadow = dark ? '#284f45' : '#678f70',
    canopy = dark ? '#4c745b' : '#91bb83',
    light = dark ? '#5b8065' : '#a6c88c'
  // Symbols sample tree-class pixels. Zooming retains the same positions within the cover.
  const stride = scale < 0.44 ? 4 : 2
  for (let row = top - (top % stride); row <= bottom; row += stride)
    for (let col = left - (left % stride); col <= right; col += stride) {
      if (cover.pixels[4 * (row * cover.width + col)] !== 10) continue
      const seed = ((col * 3109) ^ (row * 7919)) >>> 0,
        x = l + (col + 0.35 + (seed % 11) / 18) * dx,
        y = t + (row + 0.35 + ((seed >> 4) % 11) / 18) * dy
      const p = project(x, y, 2),
        radius = (4.1 + (seed % 4)) * scale
      ctx.beginPath()
      ctx.ellipse(
        p.x + radius * 0.32,
        p.y + radius * 0.23,
        radius * 1.25,
        radius * 0.61,
        0.12,
        0,
        Math.PI * 2,
      )
      ctx.fillStyle = shadow
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(p.x, p.y - radius * 0.38, radius, radius * 0.84, 0, 0, Math.PI * 2)
      ctx.fillStyle = canopy
      ctx.fill()
      if (radius > 2.5) {
        ctx.beginPath()
        ctx.ellipse(
          p.x - radius * 0.22,
          p.y - radius * 0.64,
          radius * 0.68,
          radius * 0.51,
          -0.3,
          0,
          Math.PI * 2,
        )
        ctx.fillStyle = light
        ctx.fill()
      }
    }
}
