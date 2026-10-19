import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'

// Room centre in three.js space (Blender Z-up, exported as Y-up: x, z, -y).
const ROOM_CENTER = [2, 1.1, -2]
// Same viewing direction as the Blender camera; the overview frames this much of the room.
const OVERVIEW_DIR = new THREE.Vector3(7.5, 7.1, 9.5).normalize()
const VIEW_W = 8
const VIEW_H = 6
// The shots are framed for a landscape window. The field of view is vertical, so on a portrait
// phone it widens until the view is at least as wide as on a square window; otherwise the TV and
// the posters would be cropped at the sides.
const BASE_FOV = 30
// The room is open only towards +x and +z (the walls are at x = 0 and z = -4). Orbiting stays
// within that quarter, so the camera never ends up behind a wall, where the TV picture (HTML drawn
// over the scene) would show through. A shot outside it (From bed) widens the range to include it.
const AZIMUTH_MIN = 0
const AZIMUTH_MAX = Math.PI / 2
// Panning keeps what the camera looks at inside the room.
const ROOM_BOUNDS = new THREE.Box3(new THREE.Vector3(0, 0, -4), new THREE.Vector3(4, 2.6, 0))

/**
 * Camera shots. `position`/`target` in three.js space; `tvBefore`/`tvAfter` switch the TV
 * when the move starts / once the camera has arrived; `short` labels the button on phones;
 * `hidden` shots get no button. The
 * overview is fitted to the window.
 */
export const SHOTS = {
  overview: { label: 'Overview', short: 'Room', smoothTime: 0.9 },
  watchTV: {
    label: 'Watch TV',
    short: 'TV',
    // sitting on the floor in front of the CRT
    position: [2.1, 0.95, -2.5],
    target: [0.5, 1.14, -2.6],
    smoothTime: 1.1,
    // switches the set on as the camera settles (the move's eased tail takes seconds to come to
    // rest, too long to wait); one that's already on stays on
    tvAfter: true,
    tvDelay: 1.2,
  },
  posters: { label: 'Posters', short: 'Posters', position: [1.9, 1.55, 0.9], target: [1.9, 1.7, -4], smoothTime: 0.9 },
  bed: { label: 'From bed', short: 'Bed', position: [3.45, 1.15, -3.55], target: [0.5, 1.1, -2.6], smoothTime: 1.0 },
  // the corner with the team poster and the Nebius, NVIDIA, Black Forest Labs and Tavily posters;
  // used by Highlight posters, so it has no button of its own
  partners: { label: 'Partners', position: [3.3, 1.65, -0.55], target: [0.75, 1.65, -3.55], smoothTime: 0.9, hidden: true },
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

  const pose = (name) => (SHOTS[name].position ? SHOTS[name] : overviewPose(camera, size))

  // before the shot effects, which frame the overview with this field of view
  useEffect(() => {
    const aspect = size.width / size.height
    const halfTan = Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2))
    camera.fov = aspect < 1 ? THREE.MathUtils.radToDeg(2 * Math.atan(halfTan / aspect)) : BASE_FOV
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height])

  useEffect(() => {
    const c = controls.current
    if (!c) return
    const id = ++run.current
    const s = SHOTS[shot]
    const { position, target } = pose(shot)
    // the same angle as CameraControls' azimuth: around the target, from +z towards +x
    const azimuth = Math.atan2(position[0] - target[0], position[2] - target[2])
    c.minAzimuthAngle = Math.min(AZIMUTH_MIN, azimuth)
    c.maxAzimuthAngle = Math.max(AZIMUTH_MAX, azimuth)
    c.smoothTime = s.smoothTime
    if (s.tvBefore !== undefined) onTvChange(s.tvBefore)
    c.setLookAt(...position, ...target, true)
    if (s.tvAfter === undefined) return
    const timer = setTimeout(() => run.current === id && onTvChange(s.tvAfter), s.tvDelay * 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot])

  // Keep the overview framed when the window is resized.
  useEffect(() => {
    if (shot !== 'overview') return
    const { position, target } = overviewPose(camera, size)
    controls.current?.setLookAt(...position, ...target, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height])

  useEffect(() => {
    controls.current?.setBoundary(ROOM_BOUNDS)
  }, [])

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
