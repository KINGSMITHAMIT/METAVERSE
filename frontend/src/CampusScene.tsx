import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { drawBuilding, drawStudent, project, WORLD_HEIGHT, WORLD_WIDTH, ZONES } from './diorama'
import type { Zone } from './diorama'
import type { MapData, Player, Rect } from './model'

const TILE = 32
const PREVIEW: MapData = {
  width: 30, height: 18, meeting: { x: 21, y: 2, width: 7, height: 7 },
  walls: [[0,0,30,1],[0,17,30,1],[0,1,1,16],[29,1,1,16],[20,1,9,1],[20,2,1,4],[20,7,1,3],[20,9,9,1],[28,2,1,7]]
    .map(([x,y,width,height]) => ({x,y,width,height})),
  tables: [[13,4,4,2],[13,11,4,2],[23,4,3,2]].map(([x,y,width,height]) => ({x,y,width,height})),
}

function furniture(g: Phaser.GameObjects.Graphics, rect: Rect, meeting: boolean) {
  const x = rect.x * TILE, y = rect.y * TILE, w = rect.width * TILE
  const wood = meeting ? 0xcba173 : 0xd7a465
  g.fillStyle(0x65553b, .22).fillRect(x + 4, y + 17, w, 50)
  for (let i = 18; i < w - 8; i += 30) {
    for (const dy of [0, 42]) {
      g.fillStyle(0x375e51).fillRoundedRect(x + i - 8, y + dy, 17, 22, 4)
      g.fillStyle(0x60887b).fillRect(x + i - 6, y + dy + 2, 13, 5)
    }
  }
  g.fillStyle(0x85623a).fillRoundedRect(x + 1, y + 13, w - 2, 39, 5)
  g.fillStyle(wood).fillRoundedRect(x + 1, y + 10, w - 2, 34, 5)
  g.lineStyle(2, 0xf5d99e).lineBetween(x + 7, y + 14, x + w - 7, y + 14)
  g.fillStyle(0xfaf1d7).fillRect(x + 17, y + 21, 19, 12)
  g.fillStyle(0x507d9b).fillRect(x + w - 28, y + 19, 13, 10)
  g.fillStyle(0x7e553e).fillRect(x + w / 2 - 3, y + 27, 9, 8)
}
function plant(g: Phaser.GameObjects.Graphics, x: number, y: number, scale = 1) {
  const box = (dx: number, dy: number, w: number, h: number, color: number) =>
    g.fillStyle(color).fillRect(x + dx * scale, y + dy * scale, w * scale, h * scale)
  box(-9, 5, 18, 13, 0x9e5d44)
  box(-11, 3, 22, 5, 0xd2865e)
  box(-2, -19, 5, 27, 0x285945)
  box(-15, -15, 13, 10, 0x487651)
  box(2, -20, 13, 12, 0x578f60)
  box(-7, -29, 11, 13, 0x6b9b62)
  box(4, -4, 12, 8, 0x397651)
}
function decor(scene: Phaser.Scene, map: MapData) {
  const g = scene.add.graphics()
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const meeting = x >= 21 && x < 28 && y >= 2 && y < 9
      const lobby = x >= 2 && x <= 9 && y >= 7 && y <= 15
      const studio = x >= 11 && x <= 18 && y >= 3 && y <= 14
      const color = meeting ? (x + y) % 2 ? 0xc2ad9e : 0xc9b6a7
        : lobby ? (x + y) % 2 ? 0xb2c29f : 0xb9c8a7
        : studio ? (x + y) % 2 ? 0xe3c68d : 0xe8ce98
        : (x + y) % 2 ? 0xeadfc5 : 0xeee4cd
      g.fillStyle(color).fillRect(x * TILE, y * TILE, TILE, TILE)
      g.lineStyle(1, 0x806b45, .09).strokeRect(x * TILE, y * TILE, TILE, TILE)
    }
  }
  g.fillStyle(0x77966d).fillRoundedRect(104, 250, 158, 199, 7)
  g.fillStyle(0x8eab81).fillRoundedRect(111, 257, 144, 185, 4)
  g.lineStyle(2, 0xc7d6a6, .65).strokeRoundedRect(117, 263, 132, 173, 3)
  for (let i = 0; i < 6; i++) {
    g.fillStyle(0xd2d4ac, .48).fillRect(131 + i * 19, 274, 5, 5)
    g.fillRect(131 + i * 19, 426, 5, 5)
  }
  g.fillStyle(0x896b44).fillRoundedRect(65, 84, 212, 53, 8)
  g.fillStyle(0xd2ab6d).fillRoundedRect(65, 77, 212, 49, 7)
  g.fillStyle(0x3b6554).fillRoundedRect(84, 68, 39, 24, 3)
  g.fillStyle(0xfaf1d7).fillRect(144, 90, 33, 18)
  g.fillStyle(0xaa6f4d).fillRect(232, 87, 19, 20)
  for (const wall of map.walls) {
    const x = wall.x * TILE, y = wall.y * TILE, w = wall.width * TILE, h = wall.height * TILE
    g.fillStyle(0x6a523b, .19).fillRect(x + 4, y + 7, w, h)
    g.fillStyle(0x566759).fillRect(x, y, w, h)
    g.fillStyle(0x718176).fillRect(x + 2, y + 2, w - 4, h - 8)
    g.fillStyle(0xa2a489).fillRect(x + 2, y + 3, w - 4, 4)
    if (wall.width > 1) for (let i = 1; i < wall.width; i++) {
      g.lineStyle(1, 0x92968a, .65).lineBetween(x + i * TILE, y + 9, x + i * TILE, y + h - 6)
    }
  }
  for (const table of map.tables) furniture(g, table, table.x > 20)
  for (const [x,y,s] of [[72,170,1],[275,173,1],[69,483,1],[303,484,1],[618,96,1],[617,481,1],[865,255,.8],[860,448,1.2]]) plant(g, x, y, s)
  g.fillStyle(0x6e8a78).fillRoundedRect(718, 408, 84, 52, 6)
  g.fillStyle(0x94a68e).fillRoundedRect(723, 413, 74, 39, 5)
  g.fillStyle(0xc49161).fillRect(755, 380, 28, 21)
  g.fillStyle(0xf0d4a4).fillRect(757, 380, 24, 15)
  const label = (x: number, y: number, value: string, color = '#435743') =>
    scene.add.text(x, y, value, { fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color }).setOrigin(.5)
  label(184, 300, 'THE LOBBY')
  label(477, 102, 'PROJECT STUDIO')
  label(477, 332, 'COLLAB TABLES')
  label(784, 94, 'PRIVATE MEETING', '#563f45')
  label(750, 348, 'QUIET CORNER')
}

function makeAvatar(scene: Phaser.Scene, player: Player, mine: boolean, showName: boolean) {
  const key = 'student-' + player.username
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.createCanvas(key, 10, 11)!
    drawStudent(texture.context, player)
    texture.refresh()
  }
  const node = scene.add.container()
  const shadow = scene.add.ellipse(0, 1, 16, 6, 0x383345, .32)
  if (mine) shadow.setStrokeStyle(2, 0xd8efaa)
  node.add([shadow, scene.add.image(0, 0, key).setOrigin(.5, 1).setScale(2)])
  if (showName) node.add(scene.add.text(0, -24, mine ? 'YOU' : player.username, {
    fontFamily: 'monospace', fontSize: '11px', color: '#faf8ff',
    backgroundColor: '#342e48', padding: { x: 3, y: 2 },
  }).setOrigin(.5, 1))
  return node
}

type SceneProps = {
  map?: MapData
  players: Player[]
  you?: string
  view: 'diorama' | 'plan'
  selected?: Zone
}

export function CampusScene({ map, players, you, view, selected }: SceneProps) {
  const host = useRef<HTMLDivElement>(null)
  const current = useRef({ players, you, selected })
  useEffect(() => { current.current = { players, you, selected } }, [players, you, selected])

  useEffect(() => {
    const layout = map ?? PREVIEW
    const iso = view === 'diorama'
    const width = iso ? WORLD_WIDTH * 2 : layout.width * TILE
    const height = iso ? WORLD_HEIGHT * 2 : layout.height * TILE
    const nodes = new Map<string, Phaser.GameObjects.Container>()
    const point = (x: number, y: number) => {
      if (!iso) return [(x + .5) * TILE, (y + .5) * TILE]
      const [px, py] = project(x + .5, y + .5)
      return [px * 2, py * 2]
    }
    const labels: Phaser.GameObjects.Text[] = []
    let labelScale = 0
    let previous: Player[] | undefined
    let focus: Zone | undefined
    const previews = [{ username: 'maya', x: 6, y: 12 }, { username: 'eli', x: 13, y: 7 }, { username: 'jules', x: 23, y: 7 }]
    const game = new Phaser.Game({
      type: Phaser.CANVAS, pixelArt: true, parent: host.current!, transparent: iso,
      backgroundColor: iso ? 'rgba(0,0,0,0)' : '#e8dec4', width, height,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      audio: { noAudio: true },
      scene: {
        create(this: Phaser.Scene) {
          if (!iso) { decor(this, layout); return }
          const texture = this.textures.createCanvas('building', WORLD_WIDTH, WORLD_HEIGHT)!
          drawBuilding(texture.context, layout)
          texture.refresh()
          this.add.image(0, 0, 'building').setOrigin(0).setScale(2)
          for (const zone of ZONES) {
            const [px, py] = point(zone.x, zone.y)
            const label = this.add.text(px, py - 44, zone.title.toUpperCase(), {
              fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold',
              color: '#f2effa', backgroundColor: '#282438', padding: { x: 7, y: 4 },
            }).setOrigin(.5, 1)
            labels.push(label)
            this.add.rectangle(px, label.y + 6, 2, 12, 0x494053)
          }
        },
        update(this: Phaser.Scene) {
          const active = current.current.selected
          if (focus !== active) {
            focus = active
            const zone = ZONES.find(item => item.id === active)
            const camera = this.cameras.main
            const [cx, cy] = zone ? point(zone.x, zone.y) : [width / 2, height / 2]
            camera.setZoom(zone ? 1.65 : 1).centerOn(cx, cy)
          }
          // Keep signs readable at phone widths and in expanded or zoomed views.
          const displayScale = this.scale.displaySize.width / width * this.cameras.main.zoom
          if (iso && displayScale > 0 && labelScale !== displayScale) {
            labelScale = displayScale
            labels.forEach((label, index) => {
              const compact = displayScale < .6
              label.setText(compact ? ['LOBBY', 'STUDIO', 'MEETING'][index] : ZONES[index].title.toUpperCase())
              label.setScale(Math.max(1, .8 / displayScale))
            })
          }
          const list = map ? current.current.players : previews
          if (previous === list) return
          previous = list
          for (const [name, node] of nodes) {
            if (!list.some(player => player.username === name)) {
              this.tweens.killTweensOf(node)
              node.destroy()
              nodes.delete(name)
            }
          }
          for (const player of list) {
            const [px, py] = point(player.x, player.y)
            const mine = current.current.you === player.username
            let node = nodes.get(player.username)
            if (!node) {
              node = makeAvatar(this, player, mine, Boolean(map)).setPosition(px, py)
              nodes.set(player.username, node)
            } else if (node.getData('x') !== player.x || node.getData('y') !== player.y) {
              this.tweens.killTweensOf(node)
              this.tweens.add({ targets: node, x: px, y: py, duration: 90 })
            }
            node.setDepth(py + 1).setData({ x: player.x, y: player.y })
          }
        },
      },
    })
    return () => game.destroy(true)
  }, [map, view])
  return <div className="game" ref={host} role="img" aria-label={`${view === 'plan' ? 'Floor plan' : 'Isometric campus'} showing the lobby, project studio, and private meeting room`} />
}
