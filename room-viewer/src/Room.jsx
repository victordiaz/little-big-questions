import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { CSS3DObject, CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js'
import { useGLTF, useVideoTexture } from '@react-three/drei'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { createCRTMaterial } from './crtMaterial.js'
import { playCRTSound } from './crtSound.js'

const MODEL_URL = '/models/retro_bedroom.glb'

// Meshes that should not block the sun (the glowing pane behind the window).
const NO_SHADOW = new Set(['WinPane'])
// Clicking any of these toggles the TV.
const TV_PARTS = new Set(['TVBody', 'TVBack', 'TVScreenImg', 'TVPowerButton', 'TVPowerLED', 'TVBezelBtns'])

const LED_ON = new THREE.Color(0.2, 2.5, 0.4)
const LED_OFF = new THREE.Color(0.25, 0.02, 0.02)

// `feedEl`, when given, is a DOM element with live HTML (the logo intro or the news show, rendered
// into it by App through a portal) that is shown on the TV instead of the video.
export default function Room({ videoSrc, feedEl, muted, tvOn, onToggleTV }) {
  const { scene } = useGLTF(MODEL_URL)
  const [hoverTV, setHoverTV] = useState(false)

  useEffect(() => {
    scene.traverse((obj) => {
      if (!obj.isMesh) return
      obj.castShadow = !NO_SHADOW.has(obj.name) && obj.name !== 'Ground'
      obj.receiveShadow = true
      // Glowing parts (lava lamp, stars, window) read as pure emission in Blender. Lit materials
      // get blown out by the nearby point lights, so render them unlit at their emission colour.
      // The power LED is driven by the TV state below instead.
      const m = obj.material
      if (obj.name !== 'TVPowerLED' && m?.emissive && !m.emissiveMap && m.emissiveIntensity > 0 && m.emissive.getHex() !== 0) {
        obj.material = new THREE.MeshBasicMaterial({
          color: m.emissive.clone().multiplyScalar(m.emissiveIntensity),
        })
        obj.castShadow = false
      }
    })
  }, [scene])

  const screen = useMemo(() => scene.getObjectByName('TVScreenImg'), [scene])
  const led = useMemo(() => scene.getObjectByName('TVPowerLED'), [scene])

  useEffect(() => {
    if (!led) return
    led.material = new THREE.MeshBasicMaterial({ color: tvOn ? LED_ON : LED_OFF })
    return () => led.material.dispose()
  }, [led, tvOn])

  useEffect(() => {
    document.body.style.cursor = hoverTV ? 'pointer' : ''
  }, [hoverTV])

  const isTV = (e) => TV_PARTS.has(e.object.name)

  return (
    <>
      <primitive
        object={scene}
        onClick={(e) => {
          if (!isTV(e)) return
          e.stopPropagation()
          onToggleTV()
        }}
        onPointerMove={(e) => setHoverTV(isTV(e))}
        onPointerOut={() => setHoverTV(false)}
      />
      {screen && feedEl && <TVFeed screen={screen} el={feedEl} muted={muted} on={tvOn} />}
      {screen && !feedEl && videoSrc && (
        <TVVideo key={videoSrc} screen={screen} src={videoSrc} muted={muted} on={tvOn} />
      )}
    </>
  )
}

// Seconds for the CRT power-on / power-off animation.
const POWER_ON_TIME = 0.75
const POWER_OFF_TIME = 0.45
// TV glow on the room: Blender's 25 W, 0.45 m area light as radiance (W / (A·π)),
// scaled by the screen's power. An area light only shines forward, so the bezel isn't blown out.
const TV_GLOW = 25 / (0.45 * 0.45 * Math.PI)
RectAreaLightUniformsLib.init()

/** Plays a video on the TV through a CRT shader and animates the tube switching on and off. */
function TVVideo({ screen, src, muted, on }) {
  const texture = useVideoTexture(src, { muted: true, loop: true, start: true, playsInline: true })
  const material = useMemo(() => createCRTMaterial(texture), [texture])
  const glow = useRef()
  const firstRender = useRef(true)

  useEffect(() => {
    // glTF UVs expect unflipped textures.
    texture.flipY = false
    texture.colorSpace = THREE.SRGBColorSpace

    const video = texture.image
    const fit = () => {
      screen.geometry.computeBoundingBox()
      const size = screen.geometry.boundingBox.getSize(new THREE.Vector3())
      const dims = [size.x, size.y, size.z].sort((a, b) => b - a)
      const screenAspect = dims[0] / dims[1]
      const videoAspect = video.videoWidth / video.videoHeight || 16 / 9
      // Crop the wider side so the video fills the screen without stretching.
      if (videoAspect > screenAspect) {
        texture.repeat.set(screenAspect / videoAspect, 1)
      } else {
        texture.repeat.set(1, videoAspect / screenAspect)
      }
      texture.offset.set((1 - texture.repeat.x) / 2, (1 - texture.repeat.y) / 2)
      // the shader reads the crop through texture.matrix
      texture.updateMatrix()
    }
    if (video.readyState >= 1) fit()
    else video.addEventListener('loadedmetadata', fit, { once: true })
  }, [screen, texture])

  useEffect(() => {
    const original = screen.material
    screen.material = material
    return () => {
      screen.material = original
      material.dispose()
    }
  }, [screen, material])

  useEffect(() => {
    const video = texture.image
    video.muted = muted
    if (on) video.play().catch(() => {})
    // pausing waits for the power-off animation to finish (see useFrame)
    if (firstRender.current) {
      firstRender.current = false
      material.uniforms.power.value = on ? 1 : 0
    } else if (!muted) {
      playCRTSound(on)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture, on])

  useEffect(() => {
    texture.image.muted = muted
  }, [texture, muted])

  useFrame((_, dt) => {
    const u = material.uniforms
    u.time.value += dt
    const step = on ? dt / POWER_ON_TIME : -dt / POWER_OFF_TIME
    const p = THREE.MathUtils.clamp(u.power.value + step, 0, 1)
    if (p === 0 && u.power.value > 0) texture.image.pause()
    u.power.value = p
    if (glow.current) glow.current.intensity = TV_GLOW * p
  })

  // screen centre in three.js space, just in front of the glass, facing into the room (+x)
  return (
    <rectAreaLight
      ref={glow}
      position={[0.58, 1.16, -2.6]}
      rotation={[0, -Math.PI / 2, 0]}
      width={0.5}
      height={0.38}
      color={TV_GLOW_COLOR}
    />
  )
}

const TV_GLOW_COLOR = new THREE.Color().setRGB(0.6, 0.8, 1.0, THREE.LinearSRGBColorSpace)

// Width of the HTML page laid onto the screen, in CSS px. The page keeps the screen's aspect.
const FEED_WIDTH = 640
const GLASS_OFF = new THREE.Color(0.03, 0.033, 0.037)

/**
 * Shows live HTML on the TV. `el` is placed on the screen's surface with three's CSS3DRenderer
 * (a CSS 3D transform that follows the camera), so it stays ordinary interactive React DOM
 * instead of a texture. The CRT look (scanlines, power on/off, channel static) is CSS, see .tv-feed.
 */
function TVFeed({ screen, el, muted, on }) {
  const { gl, camera, size } = useThree()
  const glow = useRef()
  const power = useRef(on ? 1 : 0)
  const firstRender = useRef(true)

  const { position, width, height } = useMemo(() => {
    screen.updateWorldMatrix(true, false)
    const box = new THREE.Box3().setFromObject(screen)
    const dims = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    // The screen faces +x: z is its width, y its height. Sit the page just in front of the glass.
    return { position: [box.max.x + 0.004, center.y, center.z], width: dims.z, height: dims.y }
  }, [screen])

  // A second, DOM-only scene holding the page, drawn over the WebGL canvas.
  const css = useMemo(() => {
    const renderer = new CSS3DRenderer()
    Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' })
    const scene = new THREE.Scene()
    const page = new CSS3DObject(el)
    return { renderer, scene, page }
  }, [el])

  useEffect(() => {
    const { renderer, scene, page } = css
    el.style.width = `${FEED_WIDTH}px`
    el.style.height = `${Math.round((FEED_WIDTH * height) / width)}px`
    el.style.pointerEvents = 'none'
    page.position.set(...position)
    page.rotation.set(0, Math.PI / 2, 0)
    // CSS3D maps one CSS px to one world unit
    page.scale.setScalar(width / FEED_WIDTH)
    // added here (not in useMemo) so it pairs with the cleanup, which StrictMode runs between mounts
    scene.add(page)
    gl.domElement.parentElement.appendChild(renderer.domElement)
    return () => {
      renderer.domElement.remove()
      scene.remove(page)
    }
  }, [css, el, gl, position, width, height])

  useEffect(() => css.renderer.setSize(size.width, size.height), [css, size])

  useEffect(() => {
    el.className = `tv-feed ${on ? 'on' : 'off'}`
    if (firstRender.current) firstRender.current = false
    else if (!muted) playCRTSound(on)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el, on])

  // Dark glass behind the page, so the power-off collapse shows a black tube.
  useEffect(() => {
    const original = screen.material
    const glass = new THREE.MeshBasicMaterial({ color: GLASS_OFF })
    screen.material = glass
    return () => {
      screen.material = original
      glass.dispose()
    }
  }, [screen])

  useFrame((_, dt) => {
    css.renderer.render(css.scene, camera)
    const step = on ? dt / POWER_ON_TIME : -dt / POWER_OFF_TIME
    power.current = THREE.MathUtils.clamp(power.current + step, 0, 1)
    if (glow.current) glow.current.intensity = TV_GLOW * power.current
  })

  return (
    <rectAreaLight
      ref={glow}
      position={[0.58, 1.16, -2.6]}
      rotation={[0, -Math.PI / 2, 0]}
      width={0.5}
      height={0.38}
      color={TV_GLOW_COLOR}
    />
  )
}

useGLTF.preload(MODEL_URL)
