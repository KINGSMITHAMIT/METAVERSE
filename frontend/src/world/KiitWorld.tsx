import Panorama from './Panorama'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Compass,
  ExternalLink,
  Globe2,
  Info,
  Layers3,
  LocateFixed,
  Map,
  MapPin,
  Minus,
  Moon,
  Footprints,
  ArrowUp,
  ArrowDown,
  MousePointer2,
  Plus,
  ScanEye,
  Search,
  Sun,
  Users,
  X,
} from 'lucide-react'
import WorldCanvas, { groupIcons } from './WorldCanvas'
import { anchors, bounded, coordinates, geographyUrl, home } from './terrain'
import { position, startWalk, stepOnPath } from './paths'
import type { Walker, Heading } from './paths'
import { places, scenes, tourUrl } from './places'
import type { Place } from './places'
import './world.css'

type Panel = 'places' | 'scenes' | 'sources'
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/atheletics/g, 'athletics')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
function readScene() {
  const id = Number(new URLSearchParams(location.search).get('scene'))
  return Number.isInteger(id) && id >= 1 && id <= scenes.length ? id : undefined
}

export default function KiitWorld() {
  const [camera, setCamera] = useState(home)
  const [walker, setWalker] = useState<Walker>()
  const [walkStatus, setWalkStatus] = useState('')
  const [selected, setSelected] = useState<Place>()
  const [scene, setScene] = useState<number | undefined>(readScene)
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('kiit-map-theme') === 'night'
    } catch {
      return false
    }
  })
  const [panel, setPanel] = useState<Panel>('places')
  const [query, setQuery] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const closeTourButton = useRef<HTMLButtonElement>(null)
  const searchButton = useRef<HTMLButtonElement>(null)
  const [page, setPage] = useState(1)
  const [isOpen, setOpen] = useState(false)
  useEffect(() => {
    const pop = () => {
      setScene(readScene())
      dialog.current?.close()
    }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])
  useEffect(() => {
    document.title = scene
      ? scenes[scene - 1].name + ' · KIIT virtual tour'
      : 'KIIT University · Campus Commons'
  }, [scene])
  const openPanel = (tab: Panel) => {
    setPanel(tab)
    setPage(1)
    setQuery('')
    setOpen(true)
    if (!dialog.current?.open) dialog.current?.showModal()
    if (tab !== 'sources') requestAnimationFrame(() => input.current?.focus())
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !(e.target instanceof HTMLInputElement) &&
        !dialog.current?.open &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        e.preventDefault()
        openPanel(scene ? 'scenes' : 'places')
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [scene])
  const select = (place: Place) => {
    if (scene) closeScene()
    const [x, y] = anchors[place.id]
    setWalker(undefined)
    setWalkStatus('')
    setSelected(place)
    setCamera(bounded({ x, y, zoom: 1.65 }))
    dialog.current?.close()
  }
  const reset = () => {
    setCamera(home)
    setSelected(undefined)
    setWalker(undefined)
    setWalkStatus('')
  }
  const player = walker && position(walker)
  const nearby =
    player &&
    places
      .map((place) => {
        const [x, y] = anchors[place.id]
        return { place, distance: Math.hypot(player.x - x, player.y - y) }
      })
      .filter((v) => v.place.scene && v.distance < 115)
      .sort((a, b) => a.distance - b.distance)[0]?.place
  const focusMap = () =>
    requestAnimationFrame(() => document.querySelector('canvas')?.focus({ preventScroll: true }))
  const toggleWalk = () => {
    if (walker) {
      setWalker(undefined)
      setWalkStatus('')
      focusMap()
      return
    }
    const next = startWalk(camera.x, camera.y)
    if (!next) {
      setWalkStatus('The paths are loading. Try again in a moment.')
      return
    }
    setSelected(undefined)
    setWalkStatus('')
    setWalker(next)
    setCamera({ ...position(next), zoom: 2.35 })
    focusMap()
  }
  const walk = (heading: Heading, fast: boolean) => {
    if (!walker) return
    const next = stepOnPath(walker, heading, fast ? 22 : 8)
    setWalker(next)
    setCamera((c) => bounded({ ...c, ...position(next) }))
  }
  const openScene = (number: number) => {
    const url = new URL(location.href)
    url.searchParams.set('scene', String(number))
    if (scene) history.replaceState(history.state, '', url)
    else history.pushState({ kiitTour: true }, '', url)
    setScene(number)
    dialog.current?.close()
    requestAnimationFrame(() => closeTourButton.current?.focus())
  }
  const closeScene = () => {
    if (history.state?.kiitTour) history.back()
    else {
      const url = new URL(location.href)
      url.searchParams.delete('scene')
      history.replaceState(null, '', url)
      setScene(undefined)
    }
    requestAnimationFrame(() => searchButton.current?.focus())
  }
  const toggleTheme = () => {
    setDark(!dark)
    try {
      localStorage.setItem('kiit-map-theme', dark ? 'day' : 'night')
    } catch {
      /* Storage may be unavailable in private browsers. */
    }
  }
  const changeTab = (next: Panel) => {
    setPanel(next)
    setPage(1)
    input.current?.focus()
  }
  const pos = coordinates(camera.x, camera.y)
  const words = normalize(query).split(' ').filter(Boolean)
  const matches = (s: string) => words.every((word) => normalize(s).includes(word))
  const foundPlaces = places.filter((p) =>
    matches(p.name + ' ' + p.short + ' ' + p.group + ' ' + p.description),
  )
  const foundScenes = scenes.filter((s) => matches([s.name, ...s.groups, s.number].join(' ')))
  const found = panel === 'places' ? foundPlaces.length : foundScenes.length
  const placePos = selected && coordinates(...(anchors[selected.id] as [number, number]))
  return (
    <div className={'wc' + (dark ? ' night' : '')}>
      <header className="wc-header">
        <a href="./index.html" className="wc-brand" aria-label="Campus Commons home">
          <span className="wc-mark">
            <Layers3 size={23} />
          </span>
          Campus Commons
        </a>
        <span className="wc-header-divider" />
        <span className="wc-project">World explorer</span>
        <div className="wc-header-end">
          <button
            className="wc-icon theme"
            onClick={toggleTheme}
            aria-label={'Switch to ' + (dark ? 'day' : 'night') + ' theme'}
            title={dark ? 'Day theme' : 'Night theme'}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <a href="?space=team" className="wc-team">
            <Users size={16} />
            <span>Team workspace</span>
            <ArrowUpRight size={14} />
          </a>
        </div>
      </header>
      {scene ? (
        <section className="wc-viewer" aria-label="University panorama">
          <div className="wc-viewer-bar">
            <button ref={closeTourButton} className="wc-chip" onClick={closeScene}>
              <ArrowLeft size={16} />
              World map
            </button>
            <div>
              <small>
                {scenes[scene - 1].groups.join(' / ') || 'KIIT virtual tour'} · View {scene}
              </small>
              <h1>{scenes[scene - 1].name}</h1>
            </div>
            <button className="wc-chip" onClick={() => openPanel('scenes')}>
              <Search size={16} />
              <span>Find a scene</span>
            </button>
            <a
              className="wc-icon"
              href={tourUrl(scene)}
              aria-label="Open panorama on the official tour site"
              title="Open official tour"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={17} />
            </a>
          </div>
          <Panorama key={scene} number={scene} />
          <div className="wc-viewer-credit">
            Panorama hosted by KIIT’s virtual tour provider.{' '}
            <a href={tourUrl(scene)} target="_blank" rel="noreferrer">
              Open original view <ExternalLink size={12} />
            </a>
          </div>
        </section>
      ) : (
        <section className="wc-stage" aria-label="KIIT campus explorer">
          <WorldCanvas
            camera={camera}
            setCamera={setCamera}
            dark={dark}
            selected={selected}
            choose={select}
            walker={player}
            onWalk={walk}
            onInteract={() => {
              if (nearby?.scene) openScene(nearby.scene)
            }}
          />
          <div className="wc-heading">
            <div className="wc-location">
              <span /> CAMPUS ATLAS
            </div>
            <h1>
              KIIT University<span>.</span>
            </h1>
            <p>
              <MapPin size={15} /> Bhubaneswar, Odisha
            </p>
          </div>
          <button ref={searchButton} className="wc-search" onClick={() => openPanel('places')}>
            <Search size={16} />
            Find a place <kbd>/</kbd>
          </button>
          <div className="wc-controls" aria-label="Map controls">
            <span className="wc-compass" aria-label="North points to the upper right">
              N<span>➤</span>
            </span>
            <button
              className="wc-icon"
              aria-label="Zoom in"
              disabled={camera.zoom >= 5.2}
              onClick={() => setCamera((c) => bounded({ ...c, zoom: c.zoom * 1.3 }))}
            >
              <Plus size={18} />
            </button>
            <button
              className="wc-icon"
              aria-label="Zoom out"
              disabled={camera.zoom <= 0.24}
              onClick={() => setCamera((c) => bounded({ ...c, zoom: c.zoom / 1.3 }))}
            >
              <Minus size={18} />
            </button>
            <button
              className="wc-icon"
              aria-label="Reset map view"
              title="Reset map view"
              onClick={reset}
            >
              <LocateFixed size={18} />
            </button>
          </div>
          {selected && (
            <section className="wc-place" aria-label="Selected landmark">
              <div className="wc-place-top">
                <small>
                  <MapPin size={13} />
                  {selected.group}
                </small>
                <button
                  className="wc-icon"
                  aria-label="Close landmark details"
                  onClick={() => setSelected(undefined)}
                >
                  <X size={15} />
                </button>
              </div>
              <h2>{selected.name}</h2>
              <p>{selected.description}</p>
              <div className="wc-place-actions">
                {selected.scene && (
                  <button onClick={() => openScene(selected.scene!)}>
                    <ScanEye size={15} />
                    {selected.sceneLabel || 'Enter 360° view'}
                  </button>
                )}
                {placePos && (
                  <a
                    href={
                      'https://www.google.com/maps/search/?api=1&query=' +
                      placePos.lat.toFixed(6) +
                      ',' +
                      placePos.lon.toFixed(6)
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on Maps <ArrowUpRight size={13} />
                  </a>
                )}
              </div>
            </section>
          )}
          {(walker || walkStatus) && (
            <div className="wc-walk-panel">
              <small>
                <Footprints size={13} />
                Walking the campus
              </small>
              <p>
                {walkStatus ||
                  'Follow mapped roads with WASD or the arrows. Hold Shift for a longer step.'}
              </p>
              {walker && (
                <div className="wc-pad">
                  {(
                    [
                      ['left', ArrowLeft],
                      ['up', ArrowUp],
                      ['down', ArrowDown],
                      ['right', ArrowRight],
                    ] as const
                  ).map(([dir, Icon]) => (
                    <button key={dir} onClick={() => walk(dir, false)} aria-label={'Walk ' + dir}>
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              )}
              {nearby?.scene && (
                <button className="wc-nearby" onClick={() => openScene(nearby.scene!)}>
                  {nearby.short} · Enter 360° <ArrowRight size={13} />
                </button>
              )}
            </div>
          )}
          <div className="wc-dock">
            <button onClick={toggleWalk} aria-pressed={!!walker}>
              <span className="dock-icon walking">
                <Footprints size={19} />
              </span>
              <span>{walker ? 'End walk' : 'Walk'}</span>
            </button>
            <span className="dock-separator" />
            <button onClick={() => openPanel('places')}>
              <span className="dock-icon">
                <Map size={19} />
              </span>
              <span>Landmarks</span>
              <ChevronRight size={14} />
            </button>
            <span className="dock-separator" />
            <button onClick={() => openPanel('scenes')}>
              <span className="dock-icon panorama">
                <ScanEye size={19} />
              </span>
              <span>360° tours</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </section>
      )}
      <footer className="wc-footer">
        {!scene && (
          <span className="wc-coordinates">
            <Globe2 size={13} />
            {pos.lat.toFixed(4)}° N &nbsp; {pos.lon.toFixed(4)}° E
          </span>
        )}
        {!scene && (
          <span className="wc-hint">
            <MousePointer2 size={13} />
            Drag to explore <i /> Scroll to zoom
          </span>
        )}
        <div className="wc-attribution">
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            © OpenStreetMap contributors
          </a>
          <span> · Microsoft · ESA</span>
          <button aria-label="Map sources and controls" onClick={() => openPanel('sources')}>
            <Info size={14} />
          </button>
        </div>
      </footer>
      <dialog
        className="wc-dialog"
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close()
        }}
        aria-labelledby="index-title"
      >
        <div className="wc-index">
          <div className="wc-index-title">
            <span className="wc-index-mark">
              <Compass size={21} />
            </span>
            <h2 id="index-title">{panel === 'sources' ? 'About this atlas' : 'Explore KIIT'}</h2>
            <button
              className="wc-icon"
              aria-label="Close directory"
              onClick={() => dialog.current?.close()}
            >
              <X size={19} />
            </button>
          </div>
          {panel === 'sources' ? (
            <div className="wc-about">
              <h3>Map &amp; buildings</h3>
              <p>
                Roads, landmarks and surveyed outlines come from OpenStreetMap. Microsoft imagery-derived
                footprints fill gaps. Tree cover, grass and water follow ESA WorldCover 2021 at 10 m
                resolution. Unmeasured roof heights, façades and individual tree symbols are
                illustrative. WorldCover contains modified Copernicus Sentinel data (2021). The map
                covers the Patia campus district and its surroundings.
              </p>
              <p>
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                  OpenStreetMap contributors · ODbL
                </a>
                <br />
                <a
                  href="https://github.com/microsoft/GlobalMLBuildingFootprints"
                  target="_blank"
                  rel="noreferrer"
                >
                  Microsoft Global ML Building Footprints
                </a>
                <br />
                <a href="https://cdla.dev/permissive-2-0/" target="_blank" rel="noreferrer">
                  CDLA Permissive 2.0 license
                </a>
                <br />
                <a href="https://doi.org/10.5281/zenodo.7254221" target="_blank" rel="noreferrer">
                  ESA WorldCover 2021 · CC BY 4.0
                </a>
                <br />
                <a href={geographyUrl} download="kiit-osm-geography.json">
                  Download derived OpenStreetMap geometry
                </a>
              </p>
              <h3>University panoramas</h3>
              <p>
                Explore all {scenes.length} published viewpoints from KIIT’s virtual tour. Views retain
                the university’s sequence and labels. Photography loads from its tour provider and
                requires an internet connection.
              </p>
              <a href="https://kiit.ac.in/tour/" target="_blank" rel="noreferrer">
                KIIT’s official virtual tour <ExternalLink size={13} />
              </a>
              <h3>Map controls</h3>
              <p>
                Drag to pan and pinch or scroll to zoom. Focus the map and use WASD or the arrow keys to
                pan, Shift for a larger step, and + or − to zoom. Choose Walk to follow roads on foot. E
                or Enter opens a nearby linked panorama. Press / to find a place.
              </p>
            </div>
          ) : (
            <>
              <div className="wc-index-tabs">
                <button aria-pressed={panel === 'places'} onClick={() => changeTab('places')}>
                  <MapPin size={15} />
                  Landmarks <b>{places.length}</b>
                </button>
                <button aria-pressed={panel === 'scenes'} onClick={() => changeTab('scenes')}>
                  <ScanEye size={15} />
                  360° views <b>{scenes.length}</b>
                </button>
              </div>
              <label className="wc-index-search">
                <Search size={17} />
                <input
                  ref={input}
                  type="search"
                  aria-label="Search the directory"
                  value={query}
                  placeholder={
                    panel === 'places'
                      ? 'Search campus landmarks'
                      : 'Search by scene, school or view number'
                  }
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPage(1)
                  }}
                />
              </label>
              {panel === 'scenes' && (
                <div className="wc-filters" aria-label="Tour shortcuts">
                  {['Aerial View', 'Central Library', 'Sports'].map((group) => (
                    <button
                      key={group}
                      aria-pressed={query === group}
                      onClick={() => {
                        setQuery(query === group ? '' : group)
                        setPage(1)
                      }}
                    >
                      {group}
                    </button>
                  ))}
                </div>
              )}
              <div className="wc-result-count" aria-live="polite">
                {found} {panel === 'places' ? 'landmarks' : 'views'}
              </div>
              <div className="wc-results" key={panel + query}>
                {isOpen &&
                  (panel === 'places'
                    ? foundPlaces.map((p) => {
                        const Icon = groupIcons[p.group]
                        return (
                          <button key={p.id} onClick={() => select(p)}>
                            <span className="wc-result-icon">
                              <Icon size={17} />
                            </span>
                            <strong>
                              {p.name}
                              <small>{p.group}</small>
                            </strong>
                            <ChevronRight size={15} />
                          </button>
                        )
                      })
                    : foundScenes.slice(0, page * 40).map((s) => (
                        <button key={s.number} onClick={() => openScene(s.number)}>
                          <span className="wc-result-icon">
                            <ScanEye size={17} />
                          </span>
                          <strong>
                            {s.name}
                            <small>
                              {s.groups.join(' / ') || 'Official tour'} · View {s.number}
                            </small>
                          </strong>
                          <ArrowUpRight size={16} />
                        </button>
                      )))}
                {panel === 'scenes' && found > page * 40 && (
                  <button className="wc-more" onClick={() => setPage((n) => n + 1)}>
                    Show more views <ArrowRight size={15} />
                  </button>
                )}
                {!found && <p className="wc-empty">No matches for “{query}”.</p>}
              </div>
            </>
          )}
        </div>
      </dialog>
    </div>
  )
}
