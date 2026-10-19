// iOS only lets a page start sound from a tap, and it remembers that per media element. The
// show's sounds (the jingle, Olive's lines, a story's narration) start seconds after Play, so
// each kind plays through one shared element that Play unlocks: unlockMedia() runs a moment of
// silence through all of them while the tap is still being handled.

const elements = {}

export function sharedAudio(name) {
  return (elements[name] ??= new Audio())
}

// The story video moves between Newsroom mounts instead of being re-created, so it stays unlocked.
export function storyVideo() {
  if (!elements.video) {
    const v = document.createElement('video')
    v.playsInline = true
    v.preload = 'metadata'
    v.muted = true
    elements.video = v
  }
  return elements.video
}

let silence
// A tenth of a second of 8 kHz, 8-bit silence as a WAV file.
function silenceUrl() {
  if (silence) return silence
  const samples = 800
  const buf = new DataView(new ArrayBuffer(44 + samples))
  const text = (at, s) => [...s].forEach((c, i) => buf.setUint8(at + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  buf.setUint32(4, 36 + samples, true)
  text(8, 'WAVEfmt ')
  buf.setUint32(16, 16, true)
  buf.setUint16(20, 1, true) // PCM
  buf.setUint16(22, 1, true) // mono
  buf.setUint32(24, 8000, true)
  buf.setUint32(28, 8000, true)
  buf.setUint16(32, 1, true)
  buf.setUint16(34, 8, true)
  text(36, 'data')
  buf.setUint32(40, samples, true)
  for (let i = 0; i < samples; i++) buf.setUint8(44 + i, 128)
  silence = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
  return silence
}

// Call from a click or tap handler, before any state changes that start sound.
export function unlockMedia() {
  // iOS 17+: play through the silent switch, like a video app (Web Audio otherwise obeys it)
  if (navigator.audioSession) navigator.audioSession.type = 'playback'
  for (const el of [sharedAudio('jingle'), sharedAudio('voice'), storyVideo()]) {
    // one that's already playing is unlocked
    if (!el.paused) continue
    el.src = silenceUrl()
    el.muted = false
    el.play().catch(() => {})
  }
}
