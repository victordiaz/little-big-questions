import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Loader } from '@react-three/drei'
import { EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import Room, { HIGHLIGHT_POSTERS } from './Room.jsx'
import CameraRig, { SHOTS } from './CameraRig.jsx'
import InfoPanel from './InfoPanel.jsx'
import TVControls, { CHANNELS } from './TVControls.jsx'
import { INTRO_SECONDS, OUTRO_SECONDS, Intro, Outro } from './labs/intro.jsx'
import { Newsroom, useShow } from './labs/show.jsx'
import { playSting } from './labs/sting.js'
import './labs/labs.css'

// Highlight posters: time for the camera to reach the posters (when it isn't there yet), then
// the team poster lights up on its own for TEAM_HOLD, then the partners light up staggered: each
// starts STAGGER after the last and stays lit for HOLD. Watch TV moves on to the TV after a beat.
const POSTER_LEAD_MS = 1000
const TEAM_HOLD_MS = 3000
const POSTER_STAGGER_MS = 250
const POSTER_HOLD_MS = 700
const POSTER_AFTER_MS = 300

// The Video channel plays ?video=<url>, or a video file dropped on the page.
// Start on a channel with ?channel=video|logo|show (default: the logo, until Watch TV starts
// the programme).
const START_CHANNEL = new URLSearchParams(window.location.search).get('channel')
// The TV panel (channels, the show's rundown, posters) only shows with ?debug.
const DEBUG = new URLSearchParams(window.location.search).has('debug')

export default function App() {
  const [videoSrc, setVideoSrc] = useState(() => new URLSearchParams(window.location.search).get('video'))
  const [muted, setMuted] = useState(true)
  // The set starts off: Watch TV (or the power button) switches it on
  const [tvOn, setTvOn] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [shot, setShot] = useState('overview')
  const [infoOpen, setInfoOpen] = useState(false)
  const [channel, setChannel] = useState(START_CHANNEL in CHANNELS ? START_CHANNEL : 'logo')
  const [logoTheme, setLogoTheme] = useState('studio')
  const [logoTake, setLogoTake] = useState(0)
  // After the last story the show rolls the outro, then the set switches off (closing).
  const [closing, setClosing] = useState(false)
  const show = useShow({
    onEnd: () => {
      changeChannel('outro')
      setClosing(true)
    },
  })

  const replayLogo = () => {
    setLogoTake((t) => t + 1)
    if (!muted) playSting()
  }
  const toggleSound = () => {
    setMuted(!muted)
    // turning sound on mid-intro restarts it, so the jingle lines up with the animation
    if (muted && (channel === 'logo' || channel === 'outro')) {
      setLogoTake((t) => t + 1)
      playSting()
    }
  }
  // Highlight posters: go to the posters, light up the team, then Nebius, NVIDIA, Black Forest
  // Labs and Tavily in a staggered wave, then `then()` (Watch TV goes on to the TV). Pressing it
  // again starts over; picking another shot or channel stops it.
  const [lit, setLit] = useState([])
  const highlightTimers = useRef([])
  const stopPosters = () => {
    highlightTimers.current.forEach(clearTimeout)
    highlightTimers.current = []
    setLit([])
  }
  const highlightPosters = (then) => {
    stopPosters()
    const lead = shot === 'partners' ? 0 : POSTER_LEAD_MS
    setOpening(null)
    setShot('partners')
    const [team, ...partners] = HIGHLIGHT_POSTERS
    const light = (name, on, off) => [
      setTimeout(() => setLit((l) => [...l, name]), on),
      setTimeout(() => setLit((l) => l.filter((n) => n !== name)), off),
    ]
    const wave = lead + TEAM_HOLD_MS
    const end = wave + (partners.length - 1) * POSTER_STAGGER_MS + POSTER_HOLD_MS
    highlightTimers.current = [
      ...light(team, lead, wave),
      ...partners.flatMap((name, i) => light(name, wave + i * POSTER_STAGGER_MS, wave + i * POSTER_STAGGER_MS + POSTER_HOLD_MS)),
      ...(then ? [setTimeout(then, end + POSTER_AFTER_MS)] : []),
    ]
  }
  useEffect(() => () => highlightTimers.current.forEach(clearTimeout), [])

  // Watch TV opens the programme: the team and partner posters, then the camera sits down in front
  // of the TV, the logo intro plays once the set is on, then the news show.
  // null, or where it's up to: 'seating' waits for the camera to arrive and switch the set on
  // (see SHOTS.watchTV), 'intro' plays the logo.
  const [opening, setOpening] = useState(null)
  const watchTV = () => {
    // watching means listening: the jingle and Olive's voice need sound
    setMuted(false)
    setClosing(false)
    highlightPosters(() => {
      setShot('watchTV')
      setOpening('seating')
    })
  }
  const pickShot = (key) => {
    if (key === 'watchTV') return watchTV()
    stopPosters()
    setOpening(null)
    setShot(key)
  }
  // The camera switches the set on when it arrives; that's the opening's cue for the intro.
  const onCameraTv = (on) => {
    setTvOn(on)
    if (on) setOpening((o) => (o === 'seating' ? 'intro' : o))
  }

  useEffect(() => {
    if (opening !== 'intro') return
    setChannel('logo')
    setLogoTake((t) => t + 1)
    if (!muted) playSting()
    const timer = setTimeout(() => {
      setOpening(null)
      setChannel('show')
      show.goStory(0)
      show.setAuto(true)
    }, INTRO_SECONDS * 1000)
    return () => clearTimeout(timer)
    // runs once per opening; muted is read as it is when the intro starts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening])

  // The end of the show: once the outro has played, switch the set off.
  useEffect(() => {
    if (!closing || channel !== 'outro' || !tvOn) return
    const timer = setTimeout(() => {
      setClosing(false)
      setTvOn(false)
    }, OUTRO_SECONDS * 1000)
    return () => clearTimeout(timer)
  }, [closing, channel, tvOn])

  const changeChannel = (next) => {
    stopPosters()
    setOpening(null)
    setClosing(false)
    setChannel(next)
    setTvOn(true)
    // the bumpers (logo intro, outro) start from the top, with the jingle
    if ((next === 'logo' || next === 'outro') && next !== channel) replayLogo()
  }
  const logo = { theme: logoTheme, setTheme: (t) => (setLogoTheme(t), replayLogo()), replay: replayLogo }

  // The labs pages rendered live on the TV screen: App renders them into this element through a
  // portal, and TVFeed in Room.jsx places the element on the screen in 3D.
  const feedEl = useMemo(() => document.createElement('div'), [])
  const feed =
    channel === 'logo' ? (
      <div className="labs tv-labs">
        <Intro key={`${logoTheme}-${logoTake}`} theme={logoTheme} />
      </div>
    ) : channel === 'outro' ? (
      <div className="labs tv-labs">
        <Outro key={`${logoTheme}-${logoTake}`} theme={logoTheme} />
      </div>
    ) : channel === 'show' ? (
      <div className="labs tv-labs view-tv">
        <Newsroom
          story={show.story}
          segment={show.segment}
          auto={show.auto}
          onDone={show.next}
          // Olive speaks when the room's sound is on
          voice={!muted && tvOn}
        />
      </div>
    ) : null

  useEffect(() => {
    if (!videoSrc?.startsWith('blob:')) return
    return () => URL.revokeObjectURL(videoSrc)
  }, [videoSrc])

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('video/'))
    if (!file) return
    setVideoSrc(URL.createObjectURL(file))
    setChannel('video')
  }

  return (
    <div
      style={{ height: '100%' }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {/* dpr: N8AO's cost grows with the pixel count, so retina screens render at 1.5x, not 2x */}
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        gl={{ toneMapping: THREE.AgXToneMapping }}
        camera={{ position: [9.5, 8, 7.5], fov: 30, near: 0.05, far: 100 }}
        dpr={[1, 1.5]}
      >
        <color attach="background" args={['#6a6188']} />
        <CameraRig shot={shot} onTvChange={onCameraTv} />
        <Lights />
        <Suspense fallback={null}>
          <Room
            videoSrc={videoSrc}
            feedEl={feed ? feedEl : null}
            muted={muted}
            tvOn={tvOn}
            onToggleTV={() => setTvOn((on) => !on)}
            lit={lit}
          />
        </Suspense>
        {/* Stand-in for Blender's raytraced AO/GI: darkens corners, under furniture and wall joins.
            The composer turns off renderer tone mapping, so AgX is applied here instead. */}
        <EffectComposer multisampling={0}>
          {/* half resolution and medium quality: the AO is soft anyway, and this was the heaviest pass */}
          <N8AO aoRadius={0.8} distanceFalloff={1} intensity={3.5} quality="medium" halfRes />
          <ToneMapping mode={ToneMappingMode.AGX} />
        </EffectComposer>
      </Canvas>
      <Loader />

      <div className="shots">
        {Object.entries(SHOTS).filter(([, s]) => !s.hidden).map(([key, s]) => (
          <button key={key} className={key === shot ? 'active' : ''} onClick={() => pickShot(key)}>
            <span className="shot-label">{s.label}</span>
            <span className="shot-short">{s.short}</span>
          </button>
        ))}
      </div>
      {feed &&
        createPortal(
          <>
            <div className="tv-feed-picture">{feed}</div>
            {/* keyed by channel, so switching plays a burst of static; the outro closes the
                programme, so it cuts in clean */}
            {channel !== 'outro' && <div className="tv-feed-static" key={channel} />}
            <div className="tv-feed-glass" />
          </>,
          feedEl,
        )}
      {DEBUG && (
        <TVControls
          channel={channel}
          onChannel={changeChannel}
          show={show}
          logo={logo}
          tvOn={tvOn}
          onToggleTV={() => setTvOn((on) => !on)}
          muted={muted}
          onToggleSound={toggleSound}
          onWatch={watchTV}
          onHighlightPosters={() => highlightPosters()}
          highlighting={lit.length > 0}
        />
      )}
      <button className="info-button" onClick={() => setInfoOpen(true)} aria-label="How this was made">
        i
      </button>
      <InfoPanel open={infoOpen} onClose={() => setInfoOpen(false)} />
      {dragging && <div className="drop-hint">Drop to play on the TV</div>}
    </div>
  )
}

// Light values ported from the Blender scene (linear colours; Blender watts -> three units:
// sun W/m² ≈ lux scale, point W / 4π ≈ candela scale).
const linear = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace)
const WORLD = linear(0.2, 0.18, 0.34)
const WORLD_STRENGTH = 0.6
// Blender sun rotation (63°, 0°, -100°) points along (0.877, -0.155, -0.454) in Blender space,
// which is (0.877, -0.454, 0.155) in three.js space. The light sits opposite that direction.
const SUN_DIR = new THREE.Vector3(0.877, -0.454, 0.155).normalize()
const SUN_POS = SUN_DIR.clone().multiplyScalar(-10).toArray()

function Lights() {
  return (
    <>
      {/* uniform world light: Blender radiance L gives albedo * L, three ambient gives albedo * I / π */}
      <ambientLight color={WORLD} intensity={WORLD_STRENGTH * Math.PI} />
      {/* warm evening sun through the window (left wall) */}
      <directionalLight
        position={SUN_POS}
        color={linear(1.0, 0.78, 0.55)}
        intensity={7}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-radius={8}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-far={40}
      />
      {/* lava lamp: Blender 40 W point */}
      <pointLight position={[2.25, 1.255, -3.51]} color={linear(1.0, 0.45, 0.15)} intensity={40 / (4 * Math.PI)} decay={2} />
      {/* the TV glow lives in Room.jsx so it can follow the CRT power animation */}
    </>
  )
}
