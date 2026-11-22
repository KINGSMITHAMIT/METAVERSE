import type { MapData, Player, Rect } from './model'

export type Zone = 'lobby' | 'studio' | 'meeting'
export const ZONES = [
  { id: 'lobby', title: 'Lobby', use: 'Arrival & hangouts', x: 5, y: 10 },
  { id: 'studio', title: 'Project studio', use: 'Shared project tables', x: 14, y: 8 },
  { id: 'meeting', title: 'Meeting room', use: 'Opt-in private voice', x: 24, y: 6 },
] as const
export const WORLD_WIDTH = 490
export const WORLD_HEIGHT = 280

// Nine horizontal pixels and four vertical pixels per tile edge keep the
// diagonal steps legible when the small canvas is enlarged.
export function project(x: number, y: number, z = 0): [number, number] {
  return [Math.round(190 + (x - y) * 9), Math.round(49 + (x + y) * 4 - z)]
}

type Ink = readonly [string, string, string]
const wood: Ink = ['#db9c69', '#ad6f52', '#865043']
const cream: Ink = ['#f6d7a7', '#c89f7b', '#ad8267']
const iron: Ink = ['#777e99', '#464b65', '#35394f']
const wall: Ink = ['#8b87a9', '#b4a9be', '#938aa5']
const jade: Ink = ['#86bdab', '#579382', '#41786f']
const violet: Ink = ['#b8a2dc', '#9074bc', '#705c96']

export function drawBuilding(ctx: CanvasRenderingContext2D, layout: MapData) {
  const jobs: { order: number; paint: () => void }[] = []
  const poly = (points: [number, number][], color: string) => {
    ctx.fillStyle = color
    ctx.beginPath()
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
    ctx.closePath()
    ctx.fill()
  }
  const top = (x: number, y: number, w: number, d: number, z: number, color: string) =>
    poly([project(x, y, z), project(x + w, y, z), project(x + w, y + d, z), project(x, y + d, z)], color)
  function box(x: number, y: number, w: number, d: number, z: number, h: number, colors: Ink) {
    const a = x + w, b = y + d, roof = z + h
    poly([project(x, b, roof), project(a, b, roof), project(a, b, z), project(x, b, z)], colors[1])
    poly([project(a, y, roof), project(a, b, roof), project(a, b, z), project(a, y, z)], colors[2])
    top(x, y, w, d, roof, colors[0])
  }
  function object(x: number, y: number, paint: () => void) {
    jobs.push({ order: x + y, paint })
  }
  function rug(x: number, y: number, w: number, d: number, colors: string[]) {
    top(x, y, w, d, 0, colors[0])
    top(x + .12, y + .12, w - .24, d - .24, 0, colors[1])
    top(x + .26, y + .26, w - .52, d - .52, 0, colors[0])
    for (let i = .6; i < w - .5; i += 1) {
      top(x + i, y + .45, .22, .22, 0, colors[1])
      top(x + i, y + d - .6, .22, .22, 0, colors[1])
    }
  }
  function shadow(x: number, y: number, w: number, d: number) {
    top(x + .18, y + .22, w, d, 0, '#48334a2b')
  }
  function plant(x: number, y: number, size = 1) {
    object(x + .5, y + .5, () => {
      shadow(x, y, 1, 1)
      const pot: Ink = ['#f3c49a', '#cc9777', '#9b715e']
      box(x, y, .75, .75, 0, 5, pot)
      box(x - .08, y - .08, .9, .9, 4, 2, pot)
      for (const [dx, dy, h, side] of [[.22,.18,8,.52],[-.22,.13,7,.57],[.52,.25,6,.47],[.12,.58,5,.48],[.14,.18,12,.4]]) {
        box(x + dx, y + dy, side * size, side * size, 5, h * size, ['#98ce8c', '#5a9b71', '#417e65'])
      }
    })
  }
  function couch(x: number, y: number, w: number, tint: Ink) {
    object(x + w / 2, y + .8, () => {
      shadow(x, y, w + .2, 1.4)
      box(x, y, w, 1.3, 0, 4, iron)
      box(x, y, w, 1.3, 3, 5, tint)
      box(x, y, w, .3, 7, 7, tint)
      for (let i = .3; i < w - .4; i += 1) box(x + i, y + .34, .9, .8, 7, 2, tint)
      for (const end of [x, x + w - .25]) box(end, y, .25, 1.3, 7, 3, tint)
    })
  }
  function monitor(x: number, y: number, z: number) {
    box(x + .4, y, .35, .5, z, 2, iron)
    box(x, y, 1.25, .17, z + 2, 8, iron)
    const screen = (offset: number, w: number, h: number, base: number, color: string) =>
      poly([project(x + offset, y + .18, base), project(x + offset + w, y + .18, base),
        project(x + offset + w, y + .18, base + h), project(x + offset, y + .18, base + h)], color)
    screen(.1, 1.05, 6, z + 3, '#9bded4')
    screen(.25, .5, 1, z + 6, '#edf8da')
    box(x + .18, y + .5, .85, .33, z, 1, iron)
  }
  function table(rect: Rect, privateRoom: boolean) {
    const { x, y, width: w, height: d } = rect
    const tint = privateRoom ? violet : jade
    for (let i = .4; i < w - .5; i += 1.6) {
      for (const cy of [y - .7, y + d - .1]) {
        object(x + i + .5, cy + .5, () => {
          box(x + i + .2, cy + .15, .4, .4, 0, 4, iron)
          box(x + i, cy, .85, .75, 4, 3, tint)
          box(x + i, cy + (cy < y ? 0 : .62), .85, .13, 7, 4, tint)
        })
      }
    }
    object(x + w / 2, y + d / 2, () => {
      shadow(x, y, w + .25, d + .2)
      for (const dx of [.18, w - .45]) for (const dy of [.15, d - .4]) {
        box(x + dx, y + dy, .26, .24, 0, 7, wood)
      }
      box(x, y, w, d, 7, 3, privateRoom ? cream : wood)
      if (!privateRoom) monitor(x + .4, y + .4, 10)
      box(x + w - 1.1, y + .7, .65, .55, 10, 1, cream)
      box(x + w - 1, y + .75, .48, .4, 11, 1, violet)
    })
  }

  box(0, 0, layout.width, layout.height, -7, 6, ['#cec8d2','#635e7a','#48475e'])
  box(.1, .1, layout.width - .2, layout.height - .2, -2, 2, cream)
  const boards = ['#e3c6a4','#e9ccaa','#dfbd9c','#eed5af']
  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x += 2) {
      const left = Math.max(0, x - (y % 2))
      top(left, y, x ? 2 : 2 - y % 2, .95, 0, boards[(x * 7 + y * 3) % 4])
    }
    if (y % 2) top(layout.width - 1, y, 1, .95, 0, boards[y % 4])
  }
  rug(1.4, 7, 8.1, 8.8, ['#8fb9a1','#cbdeae'])
  rug(11.4, 3, 7.3, 11.3, ['#d1a578','#f3ce93'])
  rug(21, 2, 7, 7, ['#aa9ebb','#dbcae3'])
  // Tall rear walls and low foreground cutaways leave the walkable gaps visible.
  for (const rect of layout.walls) {
    const { x, y, width: w, height: d } = rect
    const rear = y === 0 || (x === 0 && d > 1) || (x === 20 && y === 1)
    object(x + .1, y + .1, () => {
      const h = rear ? 22 : 4
      box(x, y, w, d, 0, h, wall)
      box(x, y, w, d, h, 2, ['#c2bcd3','#77788f','#676a82'])
      if (rear) box(x, y, w, d, 0, 3, iron)
    })
  }
  function windowBay(x: number, y: number, w: number, leftWall: boolean) {
    object(x + .5, y + .5, () => {
      const panel = (offset: number, width: number, z: number, h: number, colors: Ink) => {
        if (leftWall) box(x, y + offset, .14, width, z, h, colors)
        else box(x + offset, y, width, .14, z, h, colors)
      }
      panel(0, w, 7, 13, iron)
      for (let i = .13; i < w - .2; i += 1.14) {
        panel(i, .96, 8, 10, ['#bef1e4','#a7d9dd','#94cbd2'])
        panel(i + .2, .18, 10, 6, ['#dbf8ec','#d4eff1','#c1e4e8'])
      }
      panel(-.1, w + .2, 6, 2, cream)
    })
  }
  windowBay(2, 1, 4.7, false)
  windowBay(13, 1, 4.7, false)
  windowBay(22, 2, 4.7, false)
  windowBay(1, 8, 3.6, true)
  windowBay(1, 12.4, 3.6, true)

  // A pin board and a clock occupy the studio's back wall.
  object(12, 1.4, () => {
    const face = (x: number, w: number, z: number, h: number, color: string) =>
      poly([project(x, 1.18, z), project(x + w, 1.18, z),
        project(x + w, 1.18, z + h), project(x, 1.18, z + h)], color)
    face(10.8, 2.1, 9, 10, '#565269')
    face(10.94, 1.82, 10, 8, '#f0c78a')
    face(11.12, .53, 12, 4, '#fff1c5')
    face(11.82, .35, 13, 3, '#c28ba3')
    face(12.22, .29, 11, 3, '#87b9a7')
    const [cx, cy] = project(18, 1.18, 15)
    ctx.fillStyle = '#565269'
    ctx.fillRect(cx - 3, cy - 4, 7, 8)
    ctx.fillStyle = '#f4dfba'
    ctx.fillRect(cx - 2, cy - 3, 5, 6)
    ctx.fillStyle = '#605469'
    ctx.fillRect(cx, cy - 2, 1, 3)
    ctx.fillRect(cx, cy, 2, 1)
  })
  function shelf(x: number, y: number, w: number) {
    object(x + w / 2, y + .6, () => {
      box(x, y, w, .8, 0, 16, wood)
      const spines = ['#667c94','#eac386','#ac7f9e','#83ab98','#dd9c82']
      for (const z of [2, 9]) {
        for (let i = 0; i < Math.floor(w * 3) - 1; i++) {
          const c = spines[(i + z) % spines.length]
          box(x + .22 + i * .32, y + .73, .24, .14, z, 4 + (i % 3), [c, c, '#816d70'])
        }
      }
      box(x - .1, y - .05, w + .2, .98, 16, 2, cream)
    })
  }
  shelf(7.6, 1.2, 3.7)
  shelf(22.2, 2.4, 2.5)
  couch(2.4, 8.2, 3.6, jade)
  rug(22.5, 11, 5.3, 4.2, ['#b2b7bd', '#d6cfbb'])
  couch(23.3, 11.6, 3.8, violet)
  object(25.2, 14.1, () => {
    box(24.5, 13.5, 1.7, 1.1, 0, 3, wood)
    box(24.4, 13.4, 1.9, 1.3, 3, 2, cream)
    box(24.8, 13.7, .64, .5, 5, 1, jade)
  })
  object(4.8, 11, () => {
    box(4.3, 10.7, 1.8, 1.1, 0, 4, wood)
    box(4.3, 10.7, 1.8, 1.1, 4, 2, cream)
    box(4.5, 11, .56, .38, 6, 1, violet)
  })
  object(4, 3.5, () => {
    box(2, 3, 4.6, 1.25, 0, 9, wood)
    box(1.9, 2.9, 4.8, 1.45, 9, 2, cream)
    monitor(2.7, 3.2, 11)
  })
  for (const rect of layout.tables) table(rect, rect.x >= layout.meeting.x)
  for (const [x, y, size] of [[2, 2, 1], [8.9, 5, 1.2], [2, 15.5, 1.2], [18.2, 2, 1.3],
    [12, 15, 1.05], [27, 7.2, 1], [26.6, 11.5, 1.15], [27, 15.3, 1.45]]) plant(x, y, size)
  for (const job of jobs.sort((a, b) => a.order - b.order)) job.paint()
}

// Each identity keeps its palette across rooms and reconnects.
export function drawStudent(ctx: CanvasRenderingContext2D, player: Player) {
  const hash = Array.from(player.username).reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0)
  const jacket = ['#9c81d3', '#5aaf9e', '#e39670', '#839ed0', '#dbb361'][hash % 5]
  const skin = ['#deb493', '#aa7656', '#e4ba96', '#c18d6a'][hash % 4]
  const hair = ['#463c51', '#764c38', '#46392f', '#ae8058'][hash % 4]
  const pixels = [
    '   hhhh   ', '  hhhhhh  ', '  hsssshh ', '  hsesss  ', '   ssss   ',
    '  jjjjjj  ', ' sjjljjjs ', ' sjjjjjjs ', '  jjjjjj  ', '   pp pp  ', '   ff ff  ',
  ]
  const colors: Record<string, string> = { h: hair, s: skin, e: '#423944', j: jacket, l: '#e9e5dc', p: '#41485c', f: '#e9e4d5' }
  pixels.forEach((row, y) => Array.from(row).forEach((pixel, x) => {
    if (pixel === ' ') return
    ctx.fillStyle = colors[pixel]
    ctx.fillRect(x, y, 1, 1)
  }))
}
