import { useEffect, useRef } from 'react'
import { drawStudent } from './diorama'

export function PixelPortrait({ name }: { name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 10, 11)
    drawStudent(ctx, { username: name, x: 0, y: 0 })
  }, [name])
  return <canvas ref={canvas} width={10} height={11} className="portrait" aria-hidden="true" />
}
