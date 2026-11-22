import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Radio } from 'lucide-react'
import { Room, RoomEvent } from 'livekit-client'
import type { RemoteParticipant, RemoteTrack } from 'livekit-client'
import { api } from './model'

export function VoiceControls({ workspace, eligible, blocked }: { workspace?: string; eligible: boolean; blocked: boolean }) {
  const active = useRef<Room | null>(null)
  const audio = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'off' | 'joining' | 'live'>('off')
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState('')
  const leave = useCallback(() => {
    const room = active.current
    active.current = null
    if (room) void room.disconnect()
    audio.current?.replaceChildren()
    setStatus('off')
  }, [])

  useEffect(() => {
    if (!eligible) leave()
    return leave
  }, [workspace, eligible, leave])

  async function join() {
    if (!workspace || active.current) return
    setStatus('joining')
    setError('')
    const room = new Room()
    active.current = room
    const elements = new Map<RemoteTrack, { element: HTMLMediaElement; participant: RemoteParticipant }>()
    const remove = (track: RemoteTrack) => {
      const item = elements.get(track)
      if (item) {
        track.detach(item.element)
        item.element.remove()
        elements.delete(track)
      }
    }
    room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      if (track.kind === 'audio' && active.current === room) {
        const element = track.attach()
        elements.set(track, { element, participant })
        audio.current?.append(element)
      }
    })
    room.on(RoomEvent.TrackUnsubscribed, remove)
    room.on(RoomEvent.ParticipantDisconnected, participant => {
      for (const [track, item] of elements) if (item.participant === participant) remove(track)
    })
    room.on(RoomEvent.Disconnected, () => {
      if (active.current === room) leave()
    })
    try {
      const ticket = await api<{ url: string; token: string }>(`/workspaces/${workspace}/voice`, 'POST')
      if (active.current !== room) return
      await room.connect(ticket.url, ticket.token, { maxRetries: 0 })
      if (active.current !== room) { await room.disconnect(); return }
      await room.localParticipant.setMicrophoneEnabled(true)
      if (active.current !== room) { await room.disconnect(); return }
      setMuted(false)
      setStatus('live')
    } catch (cause) {
      if (active.current === room) {
        leave()
        setError(cause instanceof Error ? cause.message : 'Could not connect to voice.')
      }
    }
  }

  async function toggleMute() {
    const room = active.current
    if (!room) return
    try {
      await room.localParticipant.setMicrophoneEnabled(muted)
      setMuted(!muted)
    } catch {
      setError('Could not change the microphone state.')
    }
  }

  return <div className="voice">
    <span className="icon-box plum"><Radio size={17} /></span>
    <div className="voice-content">
      <strong>Private meeting</strong>
      <p>{status === 'live' ? 'Voice connected' : blocked ? 'The host removed your voice access.' : eligible ? 'You’re in the meeting zone.' : 'Walk into the room to join voice.'}</p>
      {status === 'live' ? <div className="voice-actions">
        <button className="small-button" onClick={() => void toggleMute()}>{muted ? <MicOff size={14} /> : <Mic size={14} />}{muted ? 'Unmute' : 'Mute'}</button>
        <button className="small-button" onClick={leave}>Leave voice</button>
      </div> : eligible && <button className="small-button" disabled={status === 'joining'} onClick={() => void join()}>
        <Mic size={14} />{status === 'joining' ? 'Joining…' : 'Join voice'}
      </button>}
      {error && <p className="error" role="alert">{error}</p>}
      <div ref={audio} />
    </div>
  </div>
}
