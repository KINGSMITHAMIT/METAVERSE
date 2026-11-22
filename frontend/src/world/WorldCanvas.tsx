import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction, PointerEvent as ReactPointer } from 'react'
import { BookOpen, Building2, Flag, House, Flower2, HeartPulse, Utensils } from 'lucide-react'
import { anchors, bounded, drawTerrain, loadMap, view } from './terrain'
import type { Camera, Point } from './terrain'
import type { Heading } from './paths'
import { places } from './places'
import type { Place } from './places'

export const groupIcons = {
  Campus: Building2,
  Learning: BookOpen,
  Sports: Flag,
  Gardens: Flower2,
  Health: HeartPulse,
  Dining: Utensils,
  Residence: House,
}

interface Props {
  camera: Camera
  setCamera: Dispatch<SetStateAction<Camera>>
  dark: boolean
  selected?: Place
  choose: (place: Place) => void
  walker?: Point
  onWalk: (direction: Heading, fast: boolean) => void
  onInteract: () => void
}

export default function WorldCanvas({
  camera,
  setCamera,
  dark,
  selected,
  choose,
  walker,
  onWalk,
  onInteract,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 1, h: 1 })
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    loadMap()
      .then(() => {
        if (active) setStatus('ready')
      })
      .catch(() => {
        if (active) setStatus('error')
      })
    return () => {
      active = false
    }
  }, [attempt])
  const pointers = useRef(new Map<number, Point>())
  useLayoutEffect(() => {
    const node = container.current!
    const observer = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  useLayoutEffect(() => {
    const el = canvas.current!,
      ctx = el.getContext('2d')
    if (!ctx || status !== 'ready' || size.w < 2 || size.h < 2) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.round(size.w * ratio),
      h = Math.round(size.h * ratio)
    if (el.width !== w || el.height !== h) {
      el.width = w
      el.height = h
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    drawTerrain(ctx, size.w, size.h, camera, dark)
  }, [size, camera, dark, status])

  useEffect(() => {
    const el = canvas.current!
    const zoom = (event: WheelEvent) => {
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      setCamera((old) => {
        const here = view(size.w, size.h, old)
        const dx = event.clientX - rect.left - here.cx,
          dy = event.clientY - rect.top - here.cy
        const p = here.unproject(dx, dy)
        const next = bounded({
          ...old,
          zoom: old.zoom * Math.exp(-Math.max(-120, Math.min(120, event.deltaY)) * 0.0025),
        })
        const q = view(size.w, size.h, next).unproject(dx, dy)
        return bounded({ ...next, x: old.x + p.x - q.x, y: old.y + p.y - q.y })
      })
    }
    el.addEventListener('wheel', zoom, { passive: false })
    return () => el.removeEventListener('wheel', zoom)
  }, [size, setCamera])

  const frame = view(size.w, size.h, camera)
  const pan = (dx: number, dy: number, zoomFactor = 1) =>
    setCamera((old) => {
      const delta = view(size.w, size.h, old).unproject(dx, dy)
      return bounded({ x: old.x + delta.x, y: old.y + delta.y, zoom: old.zoom * zoomFactor })
    })
  const move = (e: ReactPointer<HTMLCanvasElement>) => {
    const points = pointers.current,
      previous = points.get(e.pointerId)
    if (!previous) return
    const next = { x: e.clientX, y: e.clientY }
    const other = Array.from(points.entries()).find(([id]) => id !== e.pointerId)?.[1]
    points.set(e.pointerId, next)
    if (other) {
      const before = Math.hypot(previous.x - other.x, previous.y - other.y)
      const after = Math.hypot(next.x - other.x, next.y - other.y)
      if (before > 3 && after > 3)
        pan((previous.x - next.x) / 2, (previous.y - next.y) / 2, after / before)
    } else pan(previous.x - next.x, previous.y - next.y)
  }
  const player = walker && frame.project(walker.x, walker.y)
  const labels: { id: string; x: number; y: number; width: number; place: Place }[] = []
  const prioritized = selected ? [selected, ...places.filter((p) => p.id !== selected.id)] : places
  for (const place of prioritized) {
    const [x, y] = anchors[place.id],
      pin = frame.project(x, y, 15)
    const width = place.short.length * 6.9 + 43
    if (
      !frame.within(pin.x, pin.y) ||
      pin.x - width / 2 < 6 ||
      pin.x + width / 2 > size.w - 6 ||
      pin.y < 48 ||
      pin.y > size.h - 25
    )
      continue
    if (
      labels.some(
        (other) =>
          Math.abs(other.x - pin.x) < (other.width + width) / 2 + 6 && Math.abs(other.y - pin.y) < 44,
      )
    )
      continue
    if (camera.zoom < 1.3 && labels.length >= (size.w < 700 ? 4 : 6)) continue
    labels.push({ id: place.id, x: pin.x, y: pin.y, width, place })
  }
  return (
    <div className="world-surface" ref={container}>
      <canvas
        ref={canvas}
        tabIndex={0}
        aria-label="Interactive KIIT map. Drag to pan, or use the arrow keys. Use plus and minus to zoom."
        onPointerDown={(e) => {
          e.currentTarget.focus({ preventScroll: true })
          e.currentTarget.setPointerCapture(e.pointerId)
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        }}
        onPointerMove={move}
        onLostPointerCapture={(e) => pointers.current.delete(e.pointerId)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 110 : 46
          const delta: Record<string, number[]> = {
            ArrowLeft: [-step, 0],
            a: [-step, 0],
            ArrowRight: [step, 0],
            d: [step, 0],
            ArrowUp: [0, -step],
            w: [0, -step],
            ArrowDown: [0, step],
            s: [0, step],
          }
          if (walker && (e.key === 'e' || e.key === 'Enter')) {
            e.preventDefault()
            onInteract()
            return
          }
          if (walker && e.key in delta) {
            e.preventDefault()
            const [x, y] = delta[e.key]
            onWalk(x < 0 ? 'left' : x > 0 ? 'right' : y < 0 ? 'up' : 'down', e.shiftKey)
            return
          }
          if (e.key in delta) {
            e.preventDefault()
            pan(delta[e.key][0], delta[e.key][1])
          }
          if (['+', '=', '-'].includes(e.key)) {
            e.preventDefault()
            pan(0, 0, e.key === '-' ? 1 / 1.25 : 1.25)
          }
        }}
      />
      {player && frame.within(player.x, player.y) && (
        <span className="wc-walker" style={{ left: player.x, top: player.y }} aria-label="Your position">
          <i />
          <b />
          You
        </span>
      )}
      {status !== 'ready' && (
        <div className="wc-loading" role="status">
          {status === 'loading' ? (
            'Loading campus map…'
          ) : (
            <button
              onClick={() => {
                setStatus('loading')
                setAttempt((n) => n + 1)
              }}
            >
              Map data unavailable · Retry
            </button>
          )}
        </div>
      )}
      {status === 'ready' &&
        labels.map(({ id, x, y, place }) => {
          const Icon = groupIcons[place.group]
          return (
            <button
              key={id}
              className={'world-pin' + (selected?.id === id ? ' current' : '')}
              style={{ left: x, top: y }}
              aria-label={'Explore ' + place.name}
              onClick={() => choose(place)}
            >
              <Icon size={13} />
              {place.short}
            </button>
          )
        })}
    </div>
  )
}
