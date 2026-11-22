import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, LocateFixed, Minus, Plus } from 'lucide-react'
import cubes from './data/panoramas.json'
import { scenes, tourUrl } from './places'

const faces = {
  f: '',
  r: 'rotateY(-90deg)',
  b: 'rotateY(180deg)',
  l: 'rotateY(90deg)',
  u: 'rotateX(-90deg)',
  d: 'rotateX(90deg)',
}
const limit = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n))

export default function Panorama({ number }: { number: number }) {
  const [template, initialYaw, initialPitch] = cubes[number - 1] as [string, number, number]
  const initial = { yaw: initialYaw, pitch: -initialPitch, fov: 74 }
  const [camera, setCamera] = useState(initial)
  const [height, setHeight] = useState(500)
  const [loaded, setLoaded] = useState(0)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const stage = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; x: number; y: number } | undefined>(undefined)
  const f = height / (2 * Math.tan((camera.fov * Math.PI) / 360))
  useLayoutEffect(() => {
    const el = stage.current!
    const measure = new ResizeObserver(([entry]) => setHeight(Math.max(1, entry.contentRect.height)))
    measure.observe(el)
    return () => measure.disconnect()
  }, [])
  const turn = (x: number, y: number) =>
    setCamera((c) => ({ ...c, yaw: c.yaw + x, pitch: limit(c.pitch + y, -85, 85) }))
  const zoom = (delta: number) => setCamera((c) => ({ ...c, fov: limit(c.fov + delta, 42, 96) }))
  return (
    <div className="wc-pano-frame">
      <div
        ref={stage}
        tabIndex={0}
        role="region"
        aria-label={
          '360° panorama of ' + scenes[number - 1].name + '. Drag to look around or use the arrow keys.'
        }
        className="wc-pano-stage"
        style={{ perspective: f }}
        onPointerDown={(e) => {
          if (drag.current) return
          e.currentTarget.focus({ preventScroll: true })
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
        }}
        onPointerMove={(e) => {
          const last = drag.current
          if (!last || last.id !== e.pointerId) return
          const sensitivity = 180 / (Math.PI * f)
          turn((last.x - e.clientX) * sensitivity, (e.clientY - last.y) * sensitivity)
          drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
        }}
        onLostPointerCapture={(e) => {
          if (drag.current?.id === e.pointerId) drag.current = undefined
        }}
        onKeyDown={(e) => {
          const step: Record<string, number[]> = {
            ArrowLeft: [-12, 0],
            ArrowRight: [12, 0],
            ArrowUp: [0, 10],
            ArrowDown: [0, -10],
          }
          if (e.key in step) {
            e.preventDefault()
            turn(step[e.key][0], step[e.key][1])
          }
          if (['+', '=', '-'].includes(e.key)) {
            e.preventDefault()
            zoom(e.key === '-' ? 8 : -8)
          }
        }}
      >
        <div
          className="wc-cube"
          style={{
            transform:
              'translateZ(' + f + 'px) rotateX(' + camera.pitch + 'deg) rotateY(' + camera.yaw + 'deg)',
          }}
          key={attempt}
          aria-hidden="true"
        >
          {Object.entries(faces).map(([face, rotation]) => (
            <div
              key={face}
              className="wc-cube-face"
              style={{ transform: rotation + ' translateZ(-511.9px)' }}
            >
              {[0, 1, 2, 3].map((tile) => {
                const path = template
                  .replace('{face}', face)
                  .replace('{row}', String(Math.floor(tile / 2)))
                  .replace('{column}', String(tile % 2))
                return (
                  <img
                    key={tile}
                    alt=""
                    draggable={false}
                    src={new URL(path, tourUrl(number)).href}
                    onLoad={() => setLoaded((n) => n + 1)}
                    onError={() => setError(true)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      {error ? (
        <div className="wc-pano-status" role="alert">
          The tour provider could not load this view.
          <button
            onClick={() => {
              setLoaded(0)
              setError(false)
              setAttempt((n) => n + 1)
            }}
          >
            Retry
          </button>
          <a href={tourUrl(number)} target="_blank" rel="noreferrer">
            Open official tour
          </a>
        </div>
      ) : (
        loaded < 24 && (
          <div className="wc-pano-status" role="status">
            Loading campus photography…
          </div>
        )
      )}
      <div className="wc-pano-controls" aria-label="Panorama controls">
        <button aria-label="Turn left" onClick={() => turn(-24, 0)}>
          <ArrowLeft size={17} />
        </button>
        <button aria-label="Turn right" onClick={() => turn(24, 0)}>
          <ArrowRight size={17} />
        </button>
        <i />
        <button aria-label="Zoom panorama in" disabled={camera.fov <= 42} onClick={() => zoom(-8)}>
          <Plus size={17} />
        </button>
        <button aria-label="Zoom panorama out" disabled={camera.fov >= 96} onClick={() => zoom(8)}>
          <Minus size={17} />
        </button>
        <button aria-label="Reset panorama view" onClick={() => setCamera(initial)}>
          <LocateFixed size={17} />
        </button>
      </div>
    </div>
  )
}
