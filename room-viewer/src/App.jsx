import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import Room, { HIGHLIGHT_POSTERS } from './Room.jsx'
import CameraRig, { SHOTS } from './CameraRig.jsx'
import TVControls, { CHANNELS } from './TVControls.jsx'
import { INTRO_SECONDS, OUTRO_SECONDS, Intro, Outro } from './labs/intro.jsx'
import { Newsroom, useShow } from './labs/show.jsx'
import { playSting } from './labs/sting.js'
import { unlockMedia } from './labs/media.js'
import { unlockCRTSound } from './crtSound.js'
import { Lockup } from './labs/brand.jsx'
import { hideBoot, setBootProgress } from './boot.js'
import './labs/labs.css'

// Highlight posters: time for the camera to reach the posters (when it isn't there yet), then
// the team poster lights up on its own for TEAM_HOLD, then the partners light up staggered: each
// starts STAGGER after the last and stays lit for HOLD.
const POSTER_LEAD_MS = 1000
const TEAM_HOLD_MS = 3000
const POSTER_STAGGER_MS = 250
const POSTER_HOLD_MS = 700

// The Video channel plays ?video=<url>, or a video file dropped on the page.
// Start on a channel with ?channel=video|logo|show (default: the logo, until Watch TV starts
// the programme).
const START_CHANNEL = new URLSearchParams(window.location.search).get('channel')
// The TV panel (channels, the show's rundown, posters) only shows with ?debug.
const DEBUG = new URLSearchParams(window.location.search).has('debug')

// The info panel renders the README with a markdown stack about a sixth the size of the viewer,
// so it loads on its own: in the background once the room is ready, or when first opened.
const loadInfoPanel = () => import('./InfoPanel.jsx')
const InfoPanel = lazy(loadInfoPanel)

// The welcome card: what the show is for, then the three things it wants kids to take away.
const ABOUT = {
  lead: 'Helping kids make sense of the big, sometimes scary things happening in the world.',
  body: 'We take real news, like elections, wars or climate, and turn it into friendly cartoon stories: honest, never frightening.',
  // two lines each, so the three columns line up
  points: [
    ['🌍', 'The world is\ncomplicated'],
    ['🤝', 'People see it\ndifferently'],
    ['❓', 'Your questions\nmatter'],
  ],
}

// iOS plays sound only when it's started from a tap, and the show's sounds start seconds after
// Play. Called in the tap itself, this lets them play later (see media.js).
function unlockSound() {
  unlockMedia()
  unlockCRTSound()
}

export default function App() {
  const [videoSrc, setVideoSrc] = useState(() => new URLSearchParams(window.location.search).get('video'))
  const [muted, setMuted] = useState(true)
  // The set starts off: Watch TV (or the power button) switches it on
  const [tvOn, setTvOn] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [shot, setShot] = useState('overview')
  const [infoOpen, setInfoOpen] = useState(false)
  // false until the room has loaded and drawn its first frames; the loading screen covers it till then
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!ready) return
    hideBoot()
    const idle = window.requestIdleCallback ?? ((f) => setTimeout(f, 2000))
    idle(() => loadInfoPanel())
  }, [ready])
  // mounted from the first open on, so closing it can still animate
  const [infoUsed, setInfoUsed] = useState(false)
  // 'welcome' shows what the show is about and a Play button, 'playing' runs the programme once,
  // 'explore' shows the camera shots. Debug and ?channel= links go straight to exploring.
  const [stage, setStage] = useState(DEBUG || START_CHANNEL ? 'explore' : 'welcome')
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
    if (muted) unlockSound()
    setMuted(!muted)
    // turning sound on mid-intro restarts it, so the jingle lines up with the animation
    if (muted && (channel === 'logo' || channel === 'outro')) {
      setLogoTake((t) => t + 1)
      playSting()
    }
  }
  // Highlight posters (TV panel): go to the posters, light up the team, then Nebius, NVIDIA,
  // Black Forest Labs and Tavily in a staggered wave. Pressing it again starts over; picking
  // another shot or channel stops it.
  const [lit, setLit] = useState([])
  const highlightTimers = useRef([])
  const stopPosters = () => {
    highlightTimers.current.forEach(clearTimeout)
    highlightTimers.current = []
    setLit([])
  }
  const highlightPosters = () => {
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
    highlightTimers.current = [
      ...light(team, lead, wave),
      ...partners.flatMap((name, i) => light(name, wave + i * POSTER_STAGGER_MS, wave + i * POSTER_STAGGER_MS + POSTER_HOLD_MS)),
    ]
  }
  useEffect(() => () => highlightTimers.current.forEach(clearTimeout), [])

  // Play (and Play again) opens the programme: the camera sits down in front of the TV, the logo
  // intro plays once the set is on, then the news show. The Watch TV shot only moves the camera.
  // null, or where it's up to: 'seating' waits for the camera to arrive and switch the set on
  // (see SHOTS.watchTV), 'intro' plays the logo.
  const [opening, setOpening] = useState(null)
  // read when the camera arrives, which is after the render that started the move
  const openingRef = useRef(opening)
  openingRef.current = opening
  const startProgramme = () => {
    // watching means listening: the jingle and Olive's voice need sound
    unlockSound()
    setMuted(false)
    setClosing(false)
    stopPosters()
    if (shot === 'watchTV') {
      // already seated, so the camera won't move and switch the set on: start right away
      setTvOn(true)
      setOpening('intro')
    } else {
      setShot('watchTV')
      setOpening('seating')
    }
  }
  const play = () => {
    setStage('playing')
    startProgramme()
  }
  const pickShot = (key) => {
    stopPosters()
    // going to the TV doesn't interrupt an opening that is already heading there
    if (key !== 'watchTV') setOpening(null)
    setShot(key)
  }
  // When the programme is opening, the camera switches the set on as it arrives; that's the cue
  // for the intro. Otherwise the Watch TV shot leaves the set as it is.
  const onCameraTv = (on) => {
    if (!on || openingRef.current !== 'seating') return
    setTvOn(true)
    setOpening('intro')
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
      setStage('explore')
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
          <SceneReady onReady={() => setReady(true)} />
        </Suspense>
        {/* Stand-in for Blender's raytraced AO/GI: darkens corners, under furniture and wall joins.
            The composer turns off renderer tone mapping, so AgX is applied here instead. */}
        <EffectComposer multisampling={0}>
          {/* half resolution and medium quality: the AO is soft anyway, and this was the heaviest pass */}
          <N8AO aoRadius={0.8} distanceFalloff={1} intensity={3.5} quality="medium" halfRes />
          <ToneMapping mode={ToneMappingMode.AGX} />
        </EffectComposer>
      </Canvas>
      <BootProgress />

      {ready && stage === 'welcome' && (
        <div className="welcome">
          <Lockup layout="horizontal" tone="reverse" size={40} />
          <h1 className="welcome-lead">{ABOUT.lead}</h1>
          <p>{ABOUT.body}</p>
          <ul className="welcome-points">
            {ABOUT.points.map(([icon, text]) => (
              <li key={text}>
                <span className="welcome-icon" aria-hidden="true">
                  {icon}
                </span>
                {text}
              </li>
            ))}
          </ul>
          <button className="welcome-play" onClick={play}>
            ▶ Play
          </button>
        </div>
      )}
      {ready && stage === 'playing' && (
        <button className="skip-button" onClick={() => setStage('explore')}>
          Explore the room
        </button>
      )}
      {ready && stage === 'explore' && (
        <div className="shots">
          {Object.entries(SHOTS).filter(([, s]) => !s.hidden).map(([key, s]) => (
            <button key={key} className={key === shot ? 'active' : ''} onClick={() => pickShot(key)}>
              <span className="shot-label">{s.label}</span>
              <span className="shot-short">{s.short}</span>
            </button>
          ))}
          <button className="replay" onClick={play}>
            <span className="shot-label">↻ Play again</span>
            <span className="shot-short">↻</span>
          </button>
        </div>
      )}
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
          onWatch={startProgramme}
          onHighlightPosters={highlightPosters}
          highlighting={lit.length > 0}
        />
      )}
      {ready && (
        <button className="info-button" onClick={() => (setInfoUsed(true), setInfoOpen(true))} aria-label="How this was made">
          i
        </button>
      )}
      {infoUsed && (
        <Suspense fallback={null}>
          <InfoPanel open={infoOpen} onClose={() => setInfoOpen(false)} />
        </Suspense>
      )}
      {dragging && <div className="drop-hint">Drop to play on the TV</div>}
    </div>
  )
}

// Mounts beside the room inside its Suspense, so it runs once everything has loaded. It waits a
// few frames more, while the first renders compile the shaders and the scene can stutter.
function SceneReady({ onReady }) {
  const frames = useRef(0)
  useFrame(() => {
    if (++frames.current === 4) onReady()
  })
  return null
}

// Moves the loading screen's bar with the room's downloads (model, textures).
function BootProgress() {
  const progress = useProgress((s) => s.progress)
  useEffect(() => setBootProgress(progress / 100), [progress])
  return null
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
