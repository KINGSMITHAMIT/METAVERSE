import { useCallback, useEffect, useRef, useState } from 'react'
import type { Direction, Player } from './model'

type Snapshot = { type: 'snapshot'; data: { you: string; players: Player[] } }
type Update = { type: 'position'; data: { player: Player } }
type Presence = { type: 'upsert' | 'blocked'; data: Player } | { type: 'leave'; data: string }
type Event = { v: number } & (Snapshot | Update | Presence | { type: 'pong' })
type State = 'preview' | 'connecting' | 'live' | 'reconnecting' | 'taken over' | 'signed out'

export function useCampus(id?: string) {
  const active = useRef<WebSocket | null>(null)
  const [state, setState] = useState<State>('preview')
  const [players, setPlayers] = useState<Player[]>([])
  const [you, setYou] = useState<string>()
  const [collision, setCollision] = useState(0)

  useEffect(() => {
    setPlayers([])
    setYou(undefined)
    setCollision(0)
    if (!id) {
      setState('preview')
      return
    }
    let stopped = false
    let attempts = 0
    let retry: number | undefined
    let heartbeat: number | undefined
    const connect = () => {
      const endpoint = new URL('/ws/campus', window.location.href)
      endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:'
      endpoint.searchParams.set('workspace', id)
      const socket = new WebSocket(endpoint)
      active.current = socket
      let lastReceived = Date.now()
      socket.onopen = () => {
        lastReceived = Date.now()
        heartbeat = window.setInterval(() => {
          if (Date.now() - lastReceived > 21_000) {
            socket.close(4000)
          } else if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ v: 1, type: 'ping' }))
          }
        }, 7000)
      }
      socket.onmessage = ({ data }) => {
        if (stopped || active.current !== socket) return
        lastReceived = Date.now()
        const event: Event = JSON.parse(data)
        if (event.v !== 1) return
        switch (event.type) {
          case 'snapshot':
            attempts = 0
            setPlayers(event.data.players)
            setYou(event.data.you)
            setState('live')
            return
          case 'leave': {
            const departed = event.data
            setPlayers(current => current.filter(player => player.username !== departed))
            return
          }
          case 'blocked':
            setCollision(value => value + 1)
            return
          case 'position':
          case 'upsert': {
            const update = event.type === 'position' ? event.data.player : event.data
            setPlayers(current => [...current.filter(player => player.username !== update.username), update])
            return
          }
        }
      }
      socket.onclose = ({ code }) => {
        window.clearInterval(heartbeat)
        if (stopped) return
        active.current = null
        if (code === 4003) {
          setState('signed out')
          return
        }
        if (code === 4001) {
          setState('taken over')
          return
        }
        setState('reconnecting')
        retry = window.setTimeout(async () => {
          const session = await fetch('/api/me').catch(() => null)
          if (stopped) return
          if (session?.status === 401) {
            setState('signed out')
          } else {
            connect()
          }
        }, Math.min(8000, 350 * 2 ** attempts++) + Math.random() * 180)
      }
    }
    setState('connecting')
    connect()
    return () => {
      stopped = true
      window.clearTimeout(retry)
      window.clearInterval(heartbeat)
      active.current?.close()
      active.current = null
    }
  }, [id])

  const move = useCallback((direction: Direction) => {
    if (active.current?.readyState === WebSocket.OPEN) {
      active.current.send(JSON.stringify({ v: 1, type: 'move', direction }))
    }
  }, [])

  return { state, players, you, collision, move }
}
