// Tiny synthesized CRT power sounds: a static burst plus a low thump (on) or a falling zap (off).
let ctx

function noiseBurst(ac, start, duration, gain) {
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * duration), ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = ac.createBufferSource()
  src.buffer = buffer
  const filter = ac.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 1200
  const g = ac.createGain()
  g.gain.setValueAtTime(gain, start)
  g.gain.exponentialRampToValueAtTime(0.001, start + duration)
  src.connect(filter).connect(g).connect(ac.destination)
  src.start(start)
}

function tone(ac, start, duration, from, to, gain) {
  const osc = ac.createOscillator()
  osc.frequency.setValueAtTime(from, start)
  osc.frequency.exponentialRampToValueAtTime(to, start + duration)
  const g = ac.createGain()
  g.gain.setValueAtTime(gain, start)
  g.gain.exponentialRampToValueAtTime(0.001, start + duration)
  osc.connect(g).connect(ac.destination)
  osc.start(start)
  osc.stop(start + duration)
}

// iOS only starts an AudioContext from a tap: call this from one (Play does) and it stays running.
export function unlockCRTSound() {
  ctx ??= new AudioContext()
  ctx.resume()
}

export function playCRTSound(on) {
  ctx ??= new AudioContext()
  ctx.resume()
  const t = ctx.currentTime
  if (on) {
    tone(ctx, t, 0.35, 90, 45, 0.35)
    noiseBurst(ctx, t + 0.05, 0.45, 0.12)
  } else {
    tone(ctx, t, 0.18, 900, 120, 0.12)
    noiseBurst(ctx, t, 0.15, 0.08)
  }
}
