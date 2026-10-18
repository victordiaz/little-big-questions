import { Suspense, useEffect, useState } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Loader } from '@react-three/drei'
import { EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import Room from './Room.jsx'
import CameraRig, { SHOTS } from './CameraRig.jsx'
import InfoPanel from './InfoPanel.jsx'

// Default TV video. Override with ?video=<url>, or drop a video file on the page.
const DEFAULT_VIDEO = '/videos/big-buck-bunny.mp4'

export default function App() {
  const [videoSrc, setVideoSrc] = useState(
    () => new URLSearchParams(window.location.search).get('video') || DEFAULT_VIDEO,
  )
  const [muted, setMuted] = useState(true)
  const [tvOn, setTvOn] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [shot, setShot] = useState('overview')
  const [infoOpen, setInfoOpen] = useState(false)

  useEffect(() => {
    if (!videoSrc.startsWith('blob:')) return
    return () => URL.revokeObjectURL(videoSrc)
  }, [videoSrc])

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('video/'))
    if (file) setVideoSrc(URL.createObjectURL(file))
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
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        gl={{ toneMapping: THREE.AgXToneMapping }}
        camera={{ position: [9.5, 8, 7.5], fov: 30, near: 0.05, far: 100 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#6a6188']} />
        <CameraRig shot={shot} onTvChange={setTvOn} />
        <Lights />
        <Suspense fallback={null}>
          <Room videoSrc={videoSrc} muted={muted} tvOn={tvOn} onToggleTV={() => setTvOn((on) => !on)} />
        </Suspense>
        {/* Stand-in for Blender's raytraced AO/GI: darkens corners, under furniture and wall joins.
            The composer turns off renderer tone mapping, so AgX is applied here instead. */}
        <EffectComposer multisampling={0}>
          <N8AO aoRadius={0.8} distanceFalloff={1} intensity={3.5} quality="high" />
          <ToneMapping mode={ToneMappingMode.AGX} />
        </EffectComposer>
      </Canvas>
      <Loader />

      <div className="shots">
        {Object.entries(SHOTS).map(([key, s]) => (
          <button key={key} className={key === shot ? 'active' : ''} onClick={() => setShot(key)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="hud">
        <button onClick={() => setTvOn((on) => !on)}>{tvOn ? 'TV off' : 'TV on'}</button>
        <button onClick={() => setMuted((m) => !m)}>{muted ? 'Sound on' : 'Sound off'}</button>
        <span>Click the TV to switch it, or drop a video file to play it</span>
      </div>
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
