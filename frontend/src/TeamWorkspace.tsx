import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Box, ChevronLeft,
  ChevronRight, Compass, Copy, DoorOpen, Expand, Grid2X2, Headphones, Keyboard, Layers3,
  MapPin, Map as MapIcon, Minus, Plus, ScanFace, ScanLine, Sofa, Table2, Users, X,
} from 'lucide-react'
import { CampusScene } from './CampusScene'
import { VoiceControls } from './VoiceControls'
import { api, inside } from './model'
import type { Details, Direction, MapData, Workspace } from './model'
import { useCampus } from './useCampus'
import { ZONES } from './diorama'
import type { Zone } from './diorama'
import { PixelPortrait } from './PixelPortrait'
import './styles.css'

const KEY: Record<string, Direction> = {
  ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left',
  w: 'up', d: 'right', s: 'down', a: 'left',
}

const staticPreview = import.meta.env.MODE === 'preview'

export default function TeamWorkspace() {
  const [account, setAccount] = useState('')
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [details, setDetails] = useState<Details>()
  const [layout, setLayout] = useState<MapData>()
  const [register, setRegister] = useState(false)
  const [error, setError] = useState('')
  const guide = useRef<HTMLDialogElement>(null)
  const mapCard = useRef<HTMLElement>(null)
  const [view, setView] = useState<'diorama' | 'plan'>('diorama')
  const [zone, setZone] = useState<Zone>()
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    const changed = () => setExpanded(document.fullscreenElement === mapCard.current)
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])
  const [invite, setInvite] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const workspaceId = details?.workspace.id
  const campus = useCampus(workspaceId)
  const me = campus.players.find(player => player.username === campus.you)
  const voiceBlocked = details?.members.some(member => member.username === account && member.voiceBlocked) ?? false

  useEffect(() => {
    if (staticPreview) return
    void api<{ username: string }>('/me').then(user => setAccount(user.username)).catch(() => {})
  }, [])
  useEffect(() => {
    if (account) void api<Workspace[]>('/workspaces').then(setWorkspaces).catch(showError)
  }, [account])
  useEffect(() => {
    if (campus.state !== 'signed out') return
    setAccount('')
    setDetails(undefined)
    setWorkspaces([])
    setError('Your session ended. Sign in to rejoin the workspace.')
  }, [campus.state])
  useEffect(() => {
    if (!workspaceId) return
    let stopped = false
    const timer = window.setInterval(() => {
      void api<Details>(`/workspaces/${workspaceId}`).then(next => {
        if (!stopped) setDetails(next)
      }).catch(() => {})
    }, 4000)
    return () => { stopped = true; window.clearInterval(timer) }
  }, [workspaceId])
  useEffect(() => {
    if (campus.state !== 'live') return
    let direction: Direction | undefined
    const interval = window.setInterval(() => { if (direction) campus.move(direction) }, 120)
    const keydown = (event: KeyboardEvent) => {
      if (guide.current?.open) return
      if ((event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable]'))
          || event.altKey || event.ctrlKey || event.metaKey) return
      const next = KEY[event.key]
      if (!next) return
      event.preventDefault()
      if (!event.repeat) {
        campus.move(next)
        direction = next
      }
    }
    const keyup = (event: KeyboardEvent) => { if (KEY[event.key] === direction) direction = undefined }
    const blur = () => { direction = undefined }
    window.addEventListener('keydown', keydown)
    window.addEventListener('keyup', keyup)
    window.addEventListener('blur', blur)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('keydown', keydown)
      window.removeEventListener('keyup', keyup)
      window.removeEventListener('blur', blur)
    }
  }, [campus.state, campus.move])

  function showError(cause: unknown) {
    setError(cause instanceof Error ? cause.message : 'Something went wrong.')
  }

  async function run(callback: () => Promise<void>) {
    setError('')
    setBusy(true)
    try { await callback() } catch (cause) { showError(cause) } finally { setBusy(false) }
  }

  function read(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    return Object.fromEntries(new FormData(event.currentTarget))
  }

  async function enter(id: string) {
    setInvite('')
    setZone(undefined)
    const next = await api<Details>(`/workspaces/${id}`)
    setLayout(next)
    setDetails(next)
  }

  function section(icon: ReactNode, title: string, children: ReactNode) {
    return <section className="side-section"><h2>{icon}{title}</h2>{children}</section>
  }

  return <>
    <header className="top">
      <div className="top-inner">
        <button className="brand" onClick={() => { setDetails(undefined); setZone(undefined); setError('') }}>
          <span className="brand-icon"><Layers3 size={24} strokeWidth={2.4} /></span>
          Campus Commons
        </button>
        <a className="team-world" href="./index.html"><Compass size={16}/> KIIT world</a>
        <nav aria-label="Main navigation">
          <button className="nav-active" onClick={() => { setDetails(undefined); setZone(undefined) }}><Compass size={16} /> Campus</button>
          <button onClick={() => guide.current?.showModal()}><BookOpen size={16} /> Field guide</button>
        </nav>
        <div className="identity"><span className="avatar-frame"><PixelPortrait name={account || 'visitor'} /></span>
          <span>{account || 'Visitor'}</span>
          {account && <button aria-label="Sign out" title="Sign out" onClick={() => void run(async () => {
            await api('/logout', 'POST'); setDetails(undefined); setAccount(''); setWorkspaces([]); setZone(undefined)
          })}><DoorOpen size={16} /></button>}
        </div>
      </div>
    </header>
    <dialog ref={guide} className="guide" aria-labelledby="guide-title">
      <div className="guide-heading"><BookOpen size={20} /><h2 id="guide-title">Campus field guide</h2>
        <button autoFocus aria-label="Close field guide" onClick={() => guide.current?.close()}><X size={18} /></button>
      </div>
      <dl>
        <dt>Meet your team</dt><dd>Create a workspace after signing in, or paste the invitation code from your host.</dd>
        <dt>Move around</dt><dd>Use WASD, the arrow keys, or the on-screen arrows. Switch to Floor plan for a straight-down view.</dd>
        <dt>Find a room</dt><dd>Select a room in the directory to zoom in. Choose Reset view to see the whole building.</dd>
        <dt>Talk in private</dt><dd>Enter the meeting room through the gap in its left wall, then choose Join voice to turn on your microphone.</dd>
      </dl>
    </dialog>
    <main>
      <div className="intro">
        <div><h1>{details?.workspace.title ?? 'Campus explorer'}</h1>
          <p>{details ? 'Find your teammates on the map and meet at a project table.' : 'Explore the spaces where your team can study, build, and meet.'}</p>
        </div>
        <a className="mobile-access" href="#workspace-controls">{account ? 'Workspace controls' : 'Campus access'} <ArrowDown size={14} /></a>
      </div>
      <div className="layout">
        <section ref={mapCard} className="map-card" aria-label="Campus scene">
          <div className="card-title">
            <div className="card-name"><span className="icon-box"><Box size={19} /></span>
              <div><h2>Commons Building</h2><p>Ground floor</p></div>
            </div>
            <div className="map-actions">
              <span className={`status ${campus.state === 'live' ? 'connected' : ''}`} role="status"><i />{campus.state === 'live' ? 'Live' : campus.state === 'preview' ? 'Map preview' : campus.state}</span>
              {document.fullscreenEnabled && <button className="icon-button" aria-label={expanded ? 'Exit expanded map' : 'Expand map'} title={expanded ? 'Exit expanded map' : 'Expand map'} onClick={() => {
                const action = expanded ? document.exitFullscreen() : mapCard.current?.requestFullscreen()
                void action?.catch(showError)
              }}>{expanded ? <Minus size={16} /> : <Expand size={16} />}</button>}
            </div>
          </div>
          <div className={`map-wrap ${view}`}>
            <div className="view-switch" role="group" aria-label="Map view">
              <button aria-pressed={view === 'diorama'} onClick={() => setView('diorama')}><Box size={13} /> Diorama</button>
              <button aria-pressed={view === 'plan'} onClick={() => setView('plan')}><MapIcon size={13} /> Floor plan</button>
            </div>
            <CampusScene map={details ? layout : undefined} players={campus.players} you={campus.you} view={view} selected={zone} />
          </div>
          <div className="map-footer">
            <div className="map-context"><MapPin size={15} />{zone ? ZONES.find(item => item.id === zone)?.title : 'Building overview'}
              {zone && <button className="reset" onClick={() => setZone(undefined)}>Reset view</button>}
            </div>
            {details ? <div className="directions" aria-label="Movement controls">
              <Keyboard size={16} />
              {([['left', ArrowLeft], ['up', ArrowUp], ['down', ArrowDown], ['right', ArrowRight]] as const).map(([direction, Icon]) =>
                <button key={direction} aria-label={`Move ${direction}`} disabled={campus.state !== 'live'} onClick={() => campus.move(direction)}><Icon size={15} /></button>)}
            </div> : <span className="key-hint"><Keyboard size={16} /> Move with <kbd>WASD</kbd> or arrow keys</span>}
          </div>
          {me && <div className="location" aria-label="Your position">Your position <output>{me.x}, {me.y}</output></div>}
          {campus.collision > 0 && <span className="sr-only" aria-live="polite">Movement blocked ({campus.collision})</span>}
        </section>
        <aside className="sidebar" id="workspace-controls" aria-label="Workspace controls">
          {staticPreview ? section(<Users size={23} />, 'Team workspace preview', <>
            <p className="hint">Explore the rooms below. Run the full app to sign in, invite teammates, and join voice.</p>
            <a className="setup-link" href="https://github.com/KINGSMITHAMIT/METAVERSE#run-the-demo">Multiplayer setup <ArrowRight size={14} /></a>
          </>) : !account ? section(<ScanFace size={23} />, register ? 'Create an account' : 'Campus access', <>
            <p className="hint">{register ? 'Choose an account name your teammates can invite.' : 'Sign in to enter a shared workspace.'}</p>
            <form onSubmit={event => {
              const data = read(event)
              void run(async () => {
                if (register) await api('/register', 'POST', data)
                setAccount((await api<{ username: string }>('/login', 'POST', data)).username)
              })
            }}>
              <label>Username<input name="username" autoComplete="username" placeholder="Your username" required minLength={3} maxLength={24} /></label>
              <label>Password<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? 'At least 8 characters' : 'Your password'} required minLength={8} /></label>
              <button className="primary" disabled={busy}>{register ? 'Create account' : 'Sign in'}<ArrowRight size={16} /></button>
            </form>
            <button className="text-button" onClick={() => { setRegister(!register); setError('') }}>
              {register ? 'I already have an account' : 'Create an account'}
            </button>
          </>) : !details ? <>
            {section(<Grid2X2 size={18} />, 'Your workspaces', <>
              <ul className="workspace-list">{workspaces.map(workspace => <li key={workspace.id}>
                <button onClick={() => void run(() => enter(workspace.id))}>{workspace.title}<ArrowRight size={15} /></button>
              </li>)}</ul>
              <form onSubmit={event => {
                const data = read(event)
                void run(async () => {
                  const workspace = await api<Workspace>('/workspaces', 'POST', data)
                  setWorkspaces(previous => [...previous, workspace])
                  await enter(workspace.id)
                })
              }}>
                <label>Workspace name<input name="title" placeholder="e.g. Studio Team" required maxLength={60} /></label>
                <button className="primary" disabled={busy}>Create workspace<Plus size={16} /></button>
              </form>
            </>)}
            {section(<DoorOpen size={18} />, 'Accept an invitation', <form onSubmit={event => {
              const data = read(event)
              void run(async () => {
                const workspace = await api<Workspace>('/workspaces/accept', 'POST', data)
                setWorkspaces(previous => [...previous.filter(item => item.id !== workspace.id), workspace])
                await enter(workspace.id)
              })
            }}>
              <label>Invitation code<input name="code" placeholder="Paste the code" required /></label>
              <button className="secondary" disabled={busy}>Join workspace<ArrowRight size={16} /></button>
            </form>)}
          </> : <>
            {section(<Users size={18} />, 'On the map', <>
              <ul className="roster" aria-label="Visible players">{[...campus.players].sort((a, b) => a.username.localeCompare(b.username)).map(player => <li key={player.username} data-position={`${player.x}, ${player.y}`}>
                <span className="mini-avatar"><PixelPortrait name={player.username} /></span>
                <strong>{player.username}</strong><span>{player.username === account ? 'You' : `${player.x}, ${player.y}`}</span>
              </li>)}</ul>
              <button className="text-button" onClick={() => { setDetails(undefined); setError('') }}><ChevronLeft size={16} /> All workspaces</button>
            </>)}
            <section className="side-section"><VoiceControls workspace={details.workspace.id} blocked={voiceBlocked} eligible={!voiceBlocked && !!me && campus.state === 'live' && inside(details.meeting, me)} /></section>
            {details.workspace.owner === account && section(<Plus size={18} />, 'Manage teammates', <>
              <form onSubmit={event => {
                const data = read(event)
                void run(async () => {
                  const result = await api<{ code: string }>(`/workspaces/${details.workspace.id}/invites`, 'POST', data)
                  setInvite(result.code); setCopied(false)
                })
              }}>
                <label>Teammate username<input name="username" placeholder="Their account name" required /></label>
                <button className="secondary" disabled={busy}>Create invitation<Plus size={14} /></button>
              </form>
              {invite && <div className="invite"><code>{invite}</code><button aria-label="Copy invitation" onClick={() => void run(async () => {
                await navigator.clipboard.writeText(invite); setCopied(true)
              })}><Copy size={16} /></button><small>{copied ? 'Copied' : 'Expires in one hour'}</small></div>}
              {details.members.filter(member => member.username !== account).map(member =>
                <button key={member.username} className="block" onClick={() => void run(async () => {
                  await api(`/workspaces/${details.workspace.id}/voice/${encodeURIComponent(member.username)}`, 'DELETE')
                  setDetails(current => current && ({
                    ...current, members: current.members.map(item => item.username === member.username ? { ...item, voiceBlocked: true } : item),
                  }))
                })} disabled={busy || member.voiceBlocked}>
                  {member.voiceBlocked ? `${member.username} removed from voice` : `Remove ${member.username} from voice`}
                </button>)}
            </>)}
          </>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <section className="directory">
            <h2><ScanLine size={17} /> Room directory</h2>
            {ZONES.map(item => {
              const Icon = item.id === 'lobby' ? Sofa : item.id === 'studio' ? Table2 : Headphones
              return <button key={item.id} aria-pressed={zone === item.id} onClick={() => {
                setZone(zone === item.id ? undefined : item.id)
                if (window.matchMedia('(max-width: 760px)').matches) mapCard.current?.scrollIntoView({ block: 'start' })
              }}>
                <span className={`zone-icon ${item.id}`}><Icon size={17} /></span>
                <span><strong>{item.title}</strong><small>{item.use}</small></span>
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            })}
          </section>
        </aside>
      </div>
    </main>

  </>
}
