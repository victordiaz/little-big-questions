import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'

// Room centre in three.js space (Blender Z-up, exported as Y-up: x, z, -y).
const ROOM_CENTER = [2, 1.1, -2]
// Same viewing direction as the Blender camera; the overview frames this much of the room.
const OVERVIEW_DIR = new THREE.Vector3(7.5, 7.1, 9.5).normalize()
const VIEW_W = 8
const VIEW_H = 6

/**
 * Camera shots. `position`/`target` in three.js space; `tvBefore`/`tvAfter` switch the TV
 * when the move starts / once the camera has arrived. Overview and orbit are fitted to the window.
 */
export const SHOTS = {
  overview: { label: 'Overview', smoothTime: 0.9 },
  watchTV: {
    label: 'Watch TV',
    // sitting on the floor in front of the CRT
    position: [2.1, 0.95, -2.5],
    target: [0.5, 1.14, -2.6],
    smoothTime: 1.1,
    tvBefore: false,
    tvAfter: true,
  },
  posters: { label: 'Posters', position: [1.9, 1.55, 0.9], target: [1.9, 1.7, -4], smoothTime: 0.9 },
  dgx: { label: 'DGX Spark', position: [1.05, 1.2, -1.6], target: [0.3, 0.97, -2.15], smoothTime: 0.9 },
  bed: { label: 'From bed', position: [3.45, 1.15, -3.55], target: [0.5, 1.1, -2.6], smoothTime: 1.0 },
  orbit: { label: 'Orbit', smoothTime: 0.9 },
}

function overviewPose(camera, size) {
  const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  const aspect = size.width / size.height
  const dist = Math.max(VIEW_H / 2 / halfTan, VIEW_W / 2 / (halfTan * aspect))
  const position = OVERVIEW_DIR.clone().multiplyScalar(dist).add(new THREE.Vector3(...ROOM_CENTER))
  return { position: position.toArray(), target: ROOM_CENTER }
}

export default function CameraRig({ shot, onTvChange }) {
  const controls = useRef()
  const { camera, size } = useThree()
  const run = useRef(0) // bumps on every new shot so stale moves don't fire their TV switch
  const arrived = useRef(false)

  const pose = (name) => (SHOTS[name].position ? SHOTS[name] : overviewPose(camera, size))

  useEffect(() => {
    const c = controls.current
    if (!c) return
    const id = ++run.current
    const s = SHOTS[shot]
    const { position, target } = pose(shot)
    arrived.current = false
    c.smoothTime = s.smoothTime
    if (s.tvBefore !== undefined) onTvChange(s.tvBefore)
    c.setLookAt(...position, ...target, true).then(() => {
      if (run.current !== id) return
      arrived.current = true
      if (s.tvAfter !== undefined) setTimeout(() => run.current === id && onTvChange(s.tvAfter), 400)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot])

  // Keep the overview framed when the window is resized.
  useEffect(() => {
    if (shot !== 'overview' && shot !== 'orbit') return
    const { position, target } = overviewPose(camera, size)
    controls.current?.setLookAt(...position, ...target, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height])

  useFrame((_, dt) => {
    if (shot === 'orbit' && arrived.current) controls.current?.rotate(dt * 0.3, 0, false)
  })

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={0.3}
      maxDistance={30}
      maxPolarAngle={Math.PI / 2.1}
    />
  )
}
